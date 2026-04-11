#!/bin/bash
# Auto-updater for the Pi. Cron runs this every minute.
# Only restarts PM2 if git HEAD actually changed after the pull.
#
# Lives at /home/felix/v3TimeToMove/update_and_restart.sh on the Pi.
# Canonical copy is versioned in this repo under pi-scripts/.
# If you edit the Pi copy, sync it back here.

# Make pm2 (installed via nvm) available under cron's minimal PATH.
# Without this, the restart step silently fails with "pm2: command not found"
# and the Pi ends up with new code on disk but the old Node process still running.
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1

cd ~/v3TimeToMove || exit 1

# Clean up a stale .git/index.lock left by a crashed git run (OOM, hard reboot
# mid-pull, etc.). If the lock exists but no git binary is actually running,
# it's safe to remove. Without this the cron updater gets permanently wedged
# on "Unable to create '.git/index.lock': File exists" after any git crash.
if [ -f .git/index.lock ] && ! ps -eo comm | awk '$1 ~ /^git/' | grep -q .; then
    echo "$(date) - removing stale .git/index.lock" >> update_log.txt
    rm -f .git/index.lock
fi

# Get current commit hash before pull
BEFORE=$(git rev-parse HEAD)

# Reset local changes and pull latest
git reset --hard >/dev/null 2>&1
git pull origin main >/dev/null 2>&1

# Get commit hash after pull
AFTER=$(git rev-parse HEAD)

# Update the lastUpdated.md file
echo "Last update pulled at: $(date)" > lastUpdated.md

# Only restart PM2 if there were actual changes.
# pm2 restart (not reload) because v3Time runs in fork mode and reload is a no-op there.
if [ "$BEFORE" != "$AFTER" ]; then
    if command -v pm2 >/dev/null 2>&1; then
        pm2 restart v3Time >/dev/null 2>&1
        echo "$(date) - Updated from ${BEFORE:0:7} to ${AFTER:0:7}, restarted PM2" >> update_log.txt
    else
        echo "$(date) - Updated from ${BEFORE:0:7} to ${AFTER:0:7} but pm2 NOT FOUND (nvm sourcing failed?)" >> update_log.txt
    fi
fi
