# pi-scripts

Operational files that live on the Raspberry Pi outside the app directory.
They are versioned here so a power cycle, reinstall, or accidental `rm`
can't lose them, but **they are not auto-deployed** -- the Pi's cron
updater (`update_and_restart.sh` itself) only syncs the app code, not its
own source. If you change a file here, copy it to the Pi manually.

## Files

### `update_and_restart.sh`
Installed at `/home/felix/v3TimeToMove/update_and_restart.sh`. Cron runs
it every minute. Pulls latest code from GitHub, compares git HEAD
before/after, and only restarts PM2 if something actually changed.

Notable hardening (added 2026-04-11 after the Cloudflare 1033 outage):

1. **Sources nvm at the top** so `pm2` is on `PATH` under cron's minimal
   environment. Without this the script pulls new code but silently
   fails on `line 21: pm2: command not found`, leaving the Pi with new
   code on disk and the old Node process still serving traffic.
2. **Cleans up stale `.git/index.lock`** files left by a crashed git
   (OOM-killed, power-yanked mid-pull, etc.). Without this, any git
   crash wedges the cron updater permanently -- every subsequent run
   fails with `Unable to create '.git/index.lock': File exists`,
   `BEFORE==AFTER`, no PM2 restart, nothing logged.
3. **Uses `pm2 restart`, not `pm2 reload`** -- v3Time runs in fork mode
   where `reload` is a no-op. This was fixed before 2026-04-11 but the
   comment is preserved for anyone reading the script later.

### `99-lowmem.cnf`
Installed at `/etc/mysql/mariadb.conf.d/99-lowmem.cnf`. Caps MariaDB's
memory footprint on the 1.8GB Pi:

- `key_buffer_size = 16M` (was 128M -- MyISAM key cache the app doesn't use)
- `max_connections = 30` (was 151)
- `thread_cache_size = 8` (was 151)

Background: mariadbd had been OOM-killed at least 5 times in the 6 weeks
leading up to 2026-04-11, each time at ~1.5GB anon-rss. Combined with
the app bug that crashed on `.env` scanner probes, this is what took the
Pi into the wedged-userspace state where even sshd couldn't fork.

## How to sync a change from this repo to the Pi

```bash
# updater script
scp pi-scripts/update_and_restart.sh felixl:/home/felix/v3TimeToMove/update_and_restart.sh
ssh felixl 'chmod +x /home/felix/v3TimeToMove/update_and_restart.sh'

# MariaDB config (requires sudo on the Pi; restart needed for it to take effect)
scp pi-scripts/99-lowmem.cnf felixl:/tmp/99-lowmem.cnf
ssh felixl 'sudo install -o root -g root -m 644 /tmp/99-lowmem.cnf /etc/mysql/mariadb.conf.d/99-lowmem.cnf && sudo systemctl restart mariadb'
```
