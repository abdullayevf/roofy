#!/usr/bin/env bash
# Runs the conductor in a loop, a fresh session each time, until .superpowers/STOP appears.
# Usage: scripts/loop.sh [max_sessions]   (default 20). Stop it: touch .superpowers/STOP
set -uo pipefail
cd "$(dirname "$0")/.."

MAX=${1:-20}
STOP=.superpowers/STOP
LOGDIR=.superpowers/run/loop
LEDGER=$(grep -o '\.superpowers/sdd/[^`]*progress\.md' docs/plans/PROGRESS.md | head -1)
mkdir -p "$LOGDIR"

exec 9>.superpowers/run/loop.lock
flock -n 9 || { echo "Another loop is already running."; exit 1; }

state() { echo "$(git rev-parse HEAD) $(md5sum "$LEDGER" 2>/dev/null | cut -c1-32)"; }

stalls=0
for ((i = 1; i <= MAX; i++)); do
  [ -f "$STOP" ] && { echo "STOP: $(cat "$STOP")"; exit 0; }
  log="$LOGDIR/$(date +%m%d-%H%M)-$i.log"
  before=$(state)
  echo "[$(date +%T)] session $i/$MAX → $log"

  CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=7200000 \
    claude -p "$(cat scripts/loop/PROMPT.md)" \
      --model opus --permission-mode bypassPermissions < /dev/null > "$log" 2>&1
  tail -5 "$log"

  if grep -qiE 'usage limit|rate limit|limit reached|resets at' "$log"; then
    echo "Usage limit. Sleeping 1 hour."; sleep 3600; ((i--)); continue
  fi

  if [ "$(state)" = "$before" ]; then
    ((stalls++))
    [ $stalls -ge 2 ] && { echo "No progress in 2 sessions; see $log" > "$STOP"; cat "$STOP"; exit 1; }
  else
    stalls=0
  fi
done
echo "Reached $MAX sessions."
