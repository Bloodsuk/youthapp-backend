#!/usr/bin/env bash
# Forward live MySQL (on the server as 127.0.0.1) to your Mac port 3306.
# Run in a separate terminal and keep it open while using npm run dev:live.
#
# Usage (defaults match production prapp server):
#   ./scripts/tunnel-live-db.sh
# Or override:
#   LIVE_SSH_USER=other LIVE_SSH_HOST=other.host ./scripts/tunnel-live-db.sh
#
# Same as:
#   ssh -L 3306:127.0.0.1:3306 youth-revisited-prapp@69.62.124.145
#
set -euo pipefail

USER="${LIVE_SSH_USER:-youth-revisited-prapp}"
HOST="${LIVE_SSH_HOST:-69.62.124.145}"

echo "Opening tunnel: localhost:3306 -> ${HOST}:127.0.0.1:3306"
echo "Leave this running. In another terminal: npm run dev:live && ngrok http 7020"
exec ssh -N -L 3306:127.0.0.1:3306 "${USER}@${HOST}"
