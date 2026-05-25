#!/usr/bin/env bash
# Forward live MySQL (on the server as 127.0.0.1) to your Mac port 3306.
# Run in a separate terminal and keep it open while using npm run dev:live.
#
# Usage:
#   LIVE_SSH_USER=ubuntu LIVE_SSH_HOST=69.62.124.145 ./scripts/tunnel-live-db.sh
#
set -euo pipefail

USER="${LIVE_SSH_USER:-}"
HOST="${LIVE_SSH_HOST:-}"

if [[ -z "$USER" || -z "$HOST" ]]; then
  echo "Set SSH credentials from your hosting team:"
  echo "  LIVE_SSH_USER=your_user LIVE_SSH_HOST=your_server ./scripts/tunnel-live-db.sh"
  echo ""
  echo "Known hosts in this project (pick the one you can SSH into):"
  echo "  69.62.124.145  (env/development.env)"
  echo "  93.114.185.78  (env/production.env)"
  exit 1
fi

echo "Opening tunnel: localhost:3306 -> ${HOST}:127.0.0.1:3306"
echo "Leave this running. In another terminal: npm run dev:live && ngrok http 7020"
exec ssh -N -L 3306:127.0.0.1:3306 "${USER}@${HOST}"
