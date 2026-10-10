#!/usr/bin/env bash
# The design loop's capture step as one command (docs/plans/RUNBOOK.md §4).
#   scripts/capture-group.sh <group> [--screens id,id]  build, serve on 3100, capture, stop the server,
#                                                       write shots/<group>/changed.txt
#   The previous capture is the baseline automatically, so changed.txt always means "changed since the last capture".
#   scripts/capture-group.sh --accept <group>           optional: make the current capture the baseline now
# Full output goes to .superpowers/run/capture-<group>.log; stdout is a short summary.
# The server is stopped by the pid listening on 3100, never by name (other projects run Node here).
set -uo pipefail
cd "$(dirname "$0")/.."

port=3100
listener() { ss -ltnp 2>/dev/null | awk -v p=":$port" '$4 ~ p"$"' | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2; }
stop_server() { local pid; pid="$(listener)"; if [ -n "$pid" ]; then kill "$pid"; fi; }

if [ "${1:-}" = "--accept" ]; then
  shots="docs/design/loop/shots/${2:?usage: capture-group.sh --accept <group>}"
  [ -f "$shots/hashes.new" ] || { echo "nothing to accept: no capture in $shots"; exit 1; }
  cp "$shots/hashes.new" "$shots/hashes.prev"
  echo "baseline for $2 updated"
  exit 0
fi

group="${1:?usage: capture-group.sh <group> [--screens id,id]}"
shift
shots="docs/design/loop/shots/$group"
log=".superpowers/run/capture-$group.log"
mkdir -p .superpowers/run

if [ -n "$(listener)" ]; then
  echo "STOP: pid $(listener) already listens on $port. Not touching it."
  exit 3
fi

# Last capture becomes the baseline (nobody has to remember to accept it).
if [ -f "$shots/hashes.new" ]; then mv "$shots/hashes.new" "$shots/hashes.prev"; fi

echo "== build" > "$log"
pnpm build >> "$log" 2>&1 || { echo "BUILD FAILED (log: $log)"; tail -15 "$log"; exit 1; }

echo "== start" >> "$log"
ROOFY_DATA=fake nohup pnpm start >> "$log" 2>&1 &
ready=0
for _ in $(seq 1 90); do
  if curl -fs -o /dev/null "http://127.0.0.1:$port/"; then ready=1; break; fi
  sleep 1
done
if [ "$ready" != 1 ]; then
  stop_server
  echo "SERVER DID NOT START (log: $log)"
  tail -15 "$log"
  exit 1
fi

echo "== capture" >> "$log"
pnpm design:capture "$group" "$@" >> "$log" 2>&1
status=$?
stop_server

# A failed capture leaves a partial hashes.new that would become the next baseline: drop it, keep hashes.prev.
if [ "$status" != 0 ]; then
  rm -f "$shots/hashes.new" "$shots/changed.txt"
  echo "CAPTURE FAILED, exit $status (log: $log); baseline hashes.prev kept"
  tail -10 "$log"
  exit 1
fi

# Hash every PNG so the critics can be given only what changed since the last accepted capture.
( cd "$shots" && find . -name '*.png' | sort | xargs sha256sum ) > "$shots/hashes.new"
comm -13 <(sort "$shots/hashes.prev" 2>/dev/null) <(sort "$shots/hashes.new") \
  | awk '{print $2}' | grep -E '^\./slices/|installed|keyboard|landscape|tablet' > "$shots/changed.txt" || true

echo "capture exit code: $status (details: $log and $shots/checks.md)"
echo "critic-visible images changed since the last capture: $(wc -l < "$shots/changed.txt") of $(grep -cE ' \./slices/|installed|keyboard|landscape|tablet' "$shots/hashes.new")"
echo "list: $shots/changed.txt"
sed -n 1,8p "$shots/checks.md" 2>/dev/null
exit 0
