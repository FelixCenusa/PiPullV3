"use strict";

// Drop-in replacement for `require("promise-mysql")` that reuses a single
// process-wide connection pool instead of opening a fresh TCP+auth session
// per handler.
//
// Added 2026-04-17 after a scanner burst hit ~30 concurrent requests, each
// opening its own MariaDB connection. With max_connections=30 that tipped
// MariaDB into ER_CON_COUNT_ERROR and took the site down for ~5min. The
// site-wide fix is this pool.
//
// The call sites in src/TimeToMove.js all look like:
//     const db = await mysql.createConnection(config);
//     ...db.query(...)...
//     await db.end();
// To keep those ~74 sites unchanged, this module exposes the same
// `createConnection(config)` entry point. The returned object is a pooled
// connection; we override `.end()` to release back to the pool instead of
// closing the socket, so the existing `await db.end()` pattern becomes a
// correct pool-release.

const mysql = require("promise-mysql");
const config = require("./TimeToMove.js");

// 2026-04-30: tightened from 20/50/10000 -> 12/20/3000.
//
// connectionLimit 12 stays well under MariaDB's new max_connections=30 (down
// from 60) cap so admin/backup sessions always have headroom and per-thread
// MariaDB buffers don't dominate RSS. queueLimit 20 bounds pile-up to ~32
// in-flight requests max -- enough for legit traffic on a single-digit-user
// app, low enough that scanner bursts can't hold the whole queue. acquire
// timeout 3000 means saturated requests fail fast (returned as 503
// Retry-After-5 by the global error handler in index.js) instead of hanging
// cloudflared until it times out.
const poolPromise = mysql.createPool({
    ...config,
    connectionLimit: 12,
    queueLimit: 20,
    waitForConnections: true,
    acquireTimeout: 3000,
});

async function createConnection() {
    const pool = await poolPromise;
    const conn = await pool.getConnection();
    // Shadow the inherited .end() so old `await db.end()` calls release to
    // the pool instead of closing the physical connection.
    conn.end = () => { conn.release(); return Promise.resolve(); };
    return conn;
}

module.exports = {
    createConnection,
};
