#!/usr/bin/env bash
# Source local SSH secrets (gitignored). Usage:
#   source scripts/load-ssh-local.sh
#   ./scripts/tunnel-live-db.sh
# Or:
#   source scripts/load-ssh-local.sh && expect ...

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FILE="${ROOT}/env/ssh.local.env"

if [[ ! -f "$FILE" ]]; then
  echo "Missing ${FILE}"
  echo "Copy env/ssh.local.env.example → env/ssh.local.env and fill SSHPASS."
  return 1 2>/dev/null || exit 1
fi

set -a
# shellcheck disable=SC1090
source "$FILE"
set +a

export LIVE_SSH_USER="${SSH_USER:-youth-revisited-prapp}"
export LIVE_SSH_HOST="${SSH_HOST:-69.62.124.145}"

if [[ -z "${SSHPASS:-}" || "$SSHPASS" == "your-ssh-password-here" ]]; then
  echo "ERROR: Set SSHPASS in env/ssh.local.env"
  return 1 2>/dev/null || exit 1
fi

echo "Loaded SSH local config for ${LIVE_SSH_USER}@${LIVE_SSH_HOST}"
