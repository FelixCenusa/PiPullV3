// PM2 ecosystem file for the TimeToMove Pi.
//
// Why this exists: we want `max_memory_restart` so PM2 auto-recycles the
// Node process if it ever leaks past 200 MB. Without an ecosystem file PM2
// stores per-process options in its dump.pm2 binary -- they're hard to
// audit and easy to lose on a `pm2 delete`. With this file the canonical
// startup config is in git.
//
// First-time install on the Pi (run after pulling this repo):
//   pm2 delete v3Time && \
//     pm2 start /home/felix/v3TimeToMove/ecosystem.config.js && \
//     pm2 save
//
// After that, the cron's `pm2 restart v3Time` (in update_and_restart.sh)
// continues to work unchanged -- it matches by name, and the saved config
// carries through restart.

module.exports = {
  apps: [{
    name: 'v3Time',
    script: './index.js',
    cwd: '/home/felix/v3TimeToMove',
    instances: 1,
    exec_mode: 'fork',  // pm2 reload doesn't work in fork mode -- use restart

    // Recycle Node if it leaks past 200 MB. The healthy idle is ~85 MB; a
    // legitimate leak under heavy use should still stay <150 MB. Crossing
    // 200 MB is a clear signal something is wrong, and recycling drops the
    // hung handlers + stale heap allocations rather than letting them
    // dominate the host.
    max_memory_restart: '200M',

    // If the process keeps crashing on startup, stop trying after 10 attempts
    // instead of looping forever (which on a Pi can pile up zombie children
    // and consume the very memory we're trying to protect).
    max_restarts: 10,
    min_uptime: '30s',     // an attempt that survives <30s counts as a crash
    restart_delay: 4000,   // wait 4s between restarts

    env: {
      NODE_ENV: 'production',
    },
  }],
};
