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

// Other middleware (bodyParser, routes, etc.)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static("public"));
app.set("view engine", "ejs");

// Per-IP rate limit on dynamic routes. Placed AFTER the static middleware
// above so legit page loads (HTML + many static assets) only count as one
// hit for the limiter. Scanner bursts that hammer dynamic paths from a
// single IP get throttled well before they can saturate the DB pool.
// Key source: CF-Connecting-IP (Cloudflare forwards the real client IP
// here). Falls back to req.ip, which `trust proxy` above resolves to
// X-Forwarded-For when cloudflared sets it.
app.use(rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => req.headers['cf-connecting-ip'] || req.ip,
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
app.use((err, req, res, next) => {
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

app.listen(port, () =>{
    console.log(`Server is listening on port: ${port}`);
});

// Require and run the cron tasks
require('./cronTasks');