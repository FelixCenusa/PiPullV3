#!/bin/bash
# Auto-updater for the Pi. Cron runs this every minute.
# Only restarts PM2 if git HEAD actually changed after the fetch.
#
# Lives at /home/felix/v3TimeToMove/update_and_restart.sh on the Pi.
# Canonical copy is versioned in this repo under pi-scripts/.
# If you edit the Pi copy, sync it back here.
#
# v2 (2026-05-01): switched from `git pull origin main` to
# `git fetch + git reset --hard origin/main`. The previous pull-into-current-
# branch pattern silently failed for ~2 weeks because:
#   1. The Pi's local branch was `master`, not `main`, so the merge had to
#      cross branch names (it succeeded at first, then got stuck once
#      untracked node_modules files conflicted with origin/main's tracked
#      ones).
#   2. The cron suppressed git's stderr (`>/dev/null 2>&1`), so the
#      "untracked working tree files would be overwritten by merge"
#      error never surfaced. The Pi was running 2-week-old code while
#      `update_log.txt` quietly recorded zero pulls.
# `git fetch + reset --hard origin/main` is destructive but correct: it
# forces local state to exactly match origin, ignoring branch name
# divergence and clobbering any local edits. We accept that because the Pi
# is a deployment target, not a dev environment -- nothing here should be
# manually edited and survive a pull.
#
# We DO NOT `git clean -fd`. That would wipe untracked files like
# manually-installed node_modules packages and the Pi's own
# update_log.txt / lastUpdated.md. Those should stay.

# Make pm2 (installed via nvm) available under cron's minimal PATH.
# Without this, the restart step silently fails with "pm2: command not found"
# and the Pi ends up with new code on disk but the old Node process still running.
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1

cd ~/v3TimeToMove || exit 1

LOG=/home/felix/v3TimeToMove/update_log.txt

# Clean up a stale .git/index.lock left by a crashed git run (OOM, hard reboot
# mid-pull, etc.). If the lock exists but no git binary is actually running,
# it's safe to remove.
if [ -f .git/index.lock ] && ! ps -eo comm | awk '$1 ~ /^git/' | grep -q .; then
    echo "$(date) - removing stale .git/index.lock" >> "$LOG"
    rm -f .git/index.lock
fi

# Capture commit before fetching.
BEFORE=$(git rev-parse HEAD 2>/dev/null || echo unknown)

# Fetch from origin. If this fails, log it -- network or auth issue.
if ! git fetch origin main 2>/tmp/git-fetch.err; then
    echo "$(date) - git fetch FAILED: $(tr -d '\n' </tmp/git-fetch.err)" >> "$LOG"
    rm -f /tmp/git-fetch.err
    exit 1
fi
rm -f /tmp/git-fetch.err

# What does origin/main say?
REMOTE=$(git rev-parse origin/main)

# If we're already at the remote tip, nothing to do.
if [ "$BEFORE" = "$REMOTE" ]; then
    exit 0
fi

# Force local state to exactly origin/main. -B creates/resets the local
# branch named main so we land on a sensible branch name regardless of
# previous state.
if ! git checkout -B main origin/main 2>/tmp/git-co.err; then
    echo "$(date) - git checkout FAILED: $(tr -d '\n' </tmp/git-co.err)" >> "$LOG"
    rm -f /tmp/git-co.err
    exit 1
fi
rm -f /tmp/git-co.err

if ! git reset --hard origin/main 2>/tmp/git-reset.err; then
    echo "$(date) - git reset FAILED: $(tr -d '\n' </tmp/git-reset.err)" >> "$LOG"
    rm -f /tmp/git-reset.err
    exit 1
fi
rm -f /tmp/git-reset.err

AFTER=$(git rev-parse HEAD)
echo "Last update pulled at: $(date)" > lastUpdated.md

# pm2 restart (not reload) because v3Time runs in fork mode and reload is
# a no-op there.
if command -v pm2 >/dev/null 2>&1; then
    pm2 restart v3Time >/dev/null 2>&1
    echo "$(date) - Updated from ${BEFORE:0:7} to ${AFTER:0:7}, restarted PM2" >> "$LOG"
else
    echo "$(date) - Updated from ${BEFORE:0:7} to ${AFTER:0:7} but pm2 NOT FOUND (nvm sourcing failed?)" >> "$LOG"
fi
