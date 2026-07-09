#!/usr/bin/env bash
# Update STRIPE_SECRET_KEY on production and restart PM2.
# Run from your Mac (needs SSH access to the live server).
#
# Usage:
#   SSHPASS='your-ssh-password' \
#   NEW_STRIPE_SECRET_KEY='sk_live_...' \
#   bash scripts/update_production_stripe_key.sh
#
# Optional:
#   SSH_USER=youth-revisited-prapp SSH_HOST=69.62.124.145
#   REMOTE_APP_DIR=~/youthapp-backend
#   ENV_FILE=env/development.env
#   PM2_NAME=youth-backend

set -euo pipefail

SSH_USER="${SSH_USER:-youth-revisited-prapp}"
SSH_HOST="${SSH_HOST:-69.62.124.145}"
REMOTE_APP_DIR="${REMOTE_APP_DIR:-\$HOME/youthapp-backend}"
ENV_FILE="${ENV_FILE:-env/development.env}"
PM2_NAME="${PM2_NAME:-youth-backend}"

if [[ -z "${SSHPASS:-}" ]]; then
  echo "ERROR: Set SSHPASS to your SSH password (or use key-based SSH and run the remote block manually)."
  exit 1
fi

if [[ -z "${NEW_STRIPE_SECRET_KEY:-}" ]]; then
  echo "ERROR: Set NEW_STRIPE_SECRET_KEY=sk_live_..."
  exit 1
fi

if [[ ! "$NEW_STRIPE_SECRET_KEY" =~ ^sk_(live|test)_ ]]; then
  echo "ERROR: NEW_STRIPE_SECRET_KEY must start with sk_live_ or sk_test_"
  exit 1
fi

if ! command -v sshpass >/dev/null 2>&1; then
  echo "ERROR: sshpass not found. Install with: brew install sshpass"
  exit 1
fi

echo "==> Updating Stripe secret on ${SSH_USER}@${SSH_HOST}"
sshpass -e ssh -o StrictHostKeyChecking=accept-new "${SSH_USER}@${SSH_HOST}" \
  "REMOTE_APP_DIR='${REMOTE_APP_DIR}' ENV_FILE='${ENV_FILE}' PM2_NAME='${PM2_NAME}' NEW_STRIPE_SECRET_KEY='${NEW_STRIPE_SECRET_KEY}' bash -s" <<'REMOTE'
set -euo pipefail
cd "${REMOTE_APP_DIR}"
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ERROR: ${ENV_FILE} not found in $(pwd)"
  exit 1
fi

cp "${ENV_FILE}" "${ENV_FILE}.bak.$(date +%Y%m%d%H%M%S)"
if grep -q '^STRIPE_SECRET_KEY=' "${ENV_FILE}"; then
  perl -i -pe 'BEGIN {$k=$ENV{NEW_STRIPE_SECRET_KEY}} s/^STRIPE_SECRET_KEY=.*/STRIPE_SECRET_KEY=$k/' "${ENV_FILE}"
else
  printf '\nSTRIPE_SECRET_KEY=%s\n' "${NEW_STRIPE_SECRET_KEY}" >> "${ENV_FILE}"
fi

echo "==> Stripe key suffix on server: $(grep '^STRIPE_SECRET_KEY=' "${ENV_FILE}" | sed 's/.*\(....\)$/****\1/')"

export PATH="$HOME/.nvm/versions/node/v22.17.0/bin:$PATH"
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart "${PM2_NAME}" --update-env
  pm2 status "${PM2_NAME}" || true
else
  echo "WARN: pm2 not found — restart Node manually"
fi
REMOTE

echo "==> Done. Retry Stripe payment in the app."
