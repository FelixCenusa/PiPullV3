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

// connectionLimit 20 stays well under MariaDB's max_connections=60 cap so
// admin/backup sessions always have headroom. queueLimit 50 bounds how many
// requests can pile up waiting for a slot -- excess requests reject fast
// instead of hanging cloudflared until it times out.
const poolPromise = mysql.createPool({
    ...config,
    connectionLimit: 20,
    queueLimit: 50,
    waitForConnections: true,
    acquireTimeout: 10000,
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
