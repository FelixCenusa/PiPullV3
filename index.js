const express = require("express");
const session = require('express-session');
const passport = require('passport');
const rateLimit = require('express-rate-limit');
require('dotenv').config(); // To use environment variables
// Require passport configuration
require('./passportConfig');

const app = express();

// Cloudflare tunnel -> cloudflared -> us (on 127.0.0.1). Without this, Express
// sees every request as coming from 127.0.0.1 and rate-limiting would bucket
// all users together. Trust only loopback, not arbitrary X-Forwarded-For.
app.set('trust proxy', 'loopback');

const fs = require('fs');
const path = require('path');

// List of directories to create if they don't exist
const directories = [
    path.join(__dirname, 'uploads'),
    path.join(__dirname, 'uploads', 'companyLogos'),
    path.join(__dirname, 'uploads', 'labelStyles'),
    path.join(__dirname, 'uploads', 'profiles')
].filter(dir => !fs.existsSync(dir));

// Function to create directories if they don't exist
directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
    }
});

const indexRoutes = require("./routes/indexRoutes.js");
const port = 1337;

// Require TimeToMove module
const TimeToMove = require('./src/TimeToMove');

// Record server start
TimeToMove.recordServerStart();

// Handle server stop to record server stoppedAt time
process.on('SIGINT', async () => {
    await TimeToMove.recordServerStop();
    process.exit();
});

// Periodically update server last alive time
setInterval(() => {
    TimeToMove.updateServerLastAlive();
}, 60000); // Update every 60 seconds

// SSRF-probe early-reject. Scanner bots sweep with query params like ?next=,
// ?url=, ?target=, ?return= pointing at cloud metadata endpoints
// (169.254.169.254 AWS, metadata.google.internal GCP) or localhost loopback.
// None of our legitimate routes take such params; the app doesn't fetch URLs
// on behalf of clients. On 2026-04-17 a burst of these probes opened one DB
// connection per hit, exhausted max_connections, and took the site down for
// ~5min. Drop them with a 400 before any middleware below can allocate.
const ssrfProbeRegex = /169\.254\.|metadata\.google|metadata\.goog|127\.0\.0\.1|\blocalhost\b|0\.0\.0\.0/i;
app.use((req, res, next) => {
    const qIdx = req.url.indexOf('?');
    if (qIdx !== -1 && ssrfProbeRegex.test(req.url.slice(qIdx + 1))) {
        return res.status(400).send('Bad request');
    }
    next();
});

// Scanner-pattern early-reject. Today's outage (2026-04-30) was caused by
// path-based scanners hitting /env.json, /settings.json, /config.json,
// /runtime-config.js, /__env.js, /api/config etc. The SSRF middleware above
// only checks the QUERY string. These hits matched the unvalidated /:username
// route and ran two DB queries each.
//
// Patterns are deliberately NARROW: only well-known scanner targets that
// cannot collide with user-namespaced paths. User-controlled segments like
// /:username/.git or /:username/api/config are NOT blocked here -- those
// belong on the Cloudflare WAF + the route-param validators below.
const scannerPathRegex = /^\/(?:wp-config|wp-login|wp-admin|phpinfo|server-status|env\.js|env\.json|__env\.js|runtime-config\.js|app-config\.json|config\.js|config\.json|settings\.json|api\/config|graphql)(?:[/?]|$)/i;
const scannerExtRegex  = /^\/[^/]+\.(?:env|env\.[a-z]+|tfstate|tfvars|pem|p12|key|sqlite3?|bak|sql)$/i;
app.use((req, res, next) => {
    if (scannerPathRegex.test(req.path) || scannerExtRegex.test(req.path)) {
        return res.status(404).end();
    }
    next();
});

// Per-request deadline. Caps the blast radius of any future slow-await
// regression: a single hung handler returns 504 after 10s instead of holding
// a DB pool slot indefinitely. Without this, one slow-await + sustained
// scanner traffic = the recurring 3-week outage cadence (handlers pile up,
// pool fills, host swaps, cloudflared times out).
//
// Long-running routes (upload, downloadAll, generate-pdf) are exempt -- they
// stream large payloads and a 10s cap would falsely 504 honest users on slow
// connections. Those paths still have their own try/catch and the global
// http.Server requestTimeout below as a final backstop.
const longRunningPathRegex = /\/(?:upload|downloadAll|generate-pdf)(?:[/?]|$)/i;
app.use((req, res, next) => {
    if (!longRunningPathRegex.test(req.path)) {
        res.setTimeout(10_000, () => {
            if (!res.headersSent) res.status(504).end();
        });
    }
    next();
});

// Set up session middleware
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(session({
    secret: process.env.SESSION_SECRET,  // Use a strong secret key
    resave: false,            // Don't save session if unmodified
    saveUninitialized: true,  // Save uninitialized sessions
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Initialize Passport and restore authentication state, if any, from the session.
app.use(passport.initialize()); 
app.use(passport.session());  

// Other middleware (bodyParser, routes, etc.). Body limits cap the per-request
// memory cost of a malicious POST: 50 queued giant requests on a 1.8GB Pi can
// be the difference between OK and OOM-thrashing. File uploads go through
// multer's own limits, not these.
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));

app.use(express.static("public"));
app.set("view engine", "ejs");

// Per-IP rate limit. Placed AFTER express.static so legit page loads (HTML +
// many static assets) only count as one hit. Skips well-known static paths
// that any browser pulls without the user clicking. 60/min is tight enough
// to catch burst scanners (today's 30-paths-in-3sec sweep would have tripped
// after ~6 hits) and loose enough that a normal browsing session never sees
// a 429. CF-Connecting-IP keys on the real client IP; falls back to req.ip
// (resolved from XFF via the `trust proxy` setting above).
//
// Earlier two-tier design (10/min on single-segment) was rejected because it
// would throttle legitimate /felix-style profile reloads.
app.use(rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => req.headers['cf-connecting-ip'] || req.ip,
    skip: (req) => /^\/(?:favicon\.ico|robots\.txt|sitemap\.xml|static\/|assets\/|uploads\/)/.test(req.path),
    handler: (req, res) => {
        res.status(429).send('Too many requests, slow down.');
    },
}));

app.use((req, res, next) =>{
    console.log(`${new Date().toLocaleString()} Got a request on ${req.path}(${req.method})`);
    next();
});

app.use(indexRoutes);

// 404 fallback for any request that didn't match a route above.
app.use((req, res) => {
    res.status(404).send('Not found');
});

// Global Express error handler. Catches errors forwarded via next(err) and
// sync throws from middleware, so a single buggy request returns 500 instead
// of hanging cloudflared until it times out.
//
// Pool-saturation fast-fail: when the DB pool runs out (acquireTimeout fires
// or MariaDB's max_connections is hit) we 503 with Retry-After=5 instead of
// letting the 10s request deadline run out. Faster recovery, clearer signal
// in logs, and the client's retry hits a (probably) drained pool.
app.use((err, req, res, next) => {
    if (err && (
        err.code === 'PROTOCOL_CONNECTION_LOST' ||
        err.code === 'ER_CON_COUNT_ERROR' ||
        (err.message && /acquire|pool is closed/i.test(err.message))
    )) {
        if (!res.headersSent) {
            return res.set('Retry-After', '5').status(503).end();
        }
        return;
    }
    console.error(`[express-error] ${req.method} ${req.originalUrl}:`, err && err.stack ? err.stack : err);
    if (!res.headersSent) {
        res.status(500).send('Internal server error');
    }
});

// Process-level safety net: log and keep running. We deliberately do NOT exit,
// because under adversarial bot traffic a crash-on-error policy would put pm2
// into a restart loop and take the site down harder than the original bug.
process.on('unhandledRejection', (reason, promise) => {
    console.error('[unhandledRejection]', reason && reason.stack ? reason.stack : reason);
});
process.on('uncaughtException', (err) => {
    console.error('[uncaughtException]', err && err.stack ? err.stack : err);
});

// Bind to loopback only -- cloudflared is the sole ingress, so 0.0.0.0 would
// just expose us to the LAN for no reason.
const server = app.listen(port, '127.0.0.1', () =>{
    console.log(`Server is listening on port: ${port}`);
});

// Tighten http.Server timeouts. Node 16's defaults are generous (60s headers,
// no requestTimeout, 5s keepAlive) which lets slow-loris / connection-hold
// probes hold sockets open without ever completing a request. The rate
// limiter only counts at request completion, so it doesn't fire during the
// hold. headersTimeout=5s drops the slow-loris vector cleanly.
//
// requestTimeout is 60s, not 10s, because /upload streams real files. The
// per-request 10s middleware above (with the upload/download exemption)
// covers the API surface; this is the slow-but-honest backstop.
server.headersTimeout    = 5_000;
server.requestTimeout    = 60_000;
server.keepAliveTimeout  = 5_000;
server.maxConnections    = 100;

// Require and run the cron tasks
require('./cronTasks');