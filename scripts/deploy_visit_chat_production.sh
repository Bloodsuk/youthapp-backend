#!/usr/bin/env bash
# Safe production deploy: pull, build, optional visit_chat DB table, restart API.
# Does not drop or alter existing tables. GPS tracking and auth routes are unchanged.
#
# On the server (SSH):
#   cd ~/youthapp-backend   # or set APP_DIR
#   bash scripts/deploy_visit_chat_production.sh
#
# Override paths/names if needed:
#   APP_DIR=/var/www/youthapp-backend PM2_NAME=youthapp-backend bash scripts/deploy_visit_chat_production.sh

set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/youthapp-backend}"
ENV_FILE="${ENV_FILE:-$APP_DIR/env/live.env}"
PM2_NAME="${PM2_NAME:-youthapp-backend}"
BRANCH="${BRANCH:-main}"

echo "==> Deploy youthapp-backend in ${APP_DIR}"
cd "$APP_DIR"

echo "==> Pull latest ${BRANCH}"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "==> Install dependencies"
npm ci

echo "==> Build"
npm run build

echo "==> DB migration (visit_chat_messages — CREATE TABLE IF NOT EXISTS)"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
else
  echo "WARN: ${ENV_FILE} not found. Run migration manually:"
  echo "  mysql -h HOST -u USER -p DATABASE < scripts/create_visit_chat_messages.sql"
fi

if [[ -n "${DB_HOST:-}" && -n "${DB_USER:-}" && -n "${PASSWORD:-}" && -n "${DATABASE:-}" ]]; then
  mysql -h "$DB_HOST" -u "$DB_USER" -p"$PASSWORD" "$DATABASE" \
    < scripts/create_visit_chat_messages.sql
  echo "Migration applied (or table already existed)."
else
  echo "WARN: DB_HOST/DB_USER/PASSWORD/DATABASE not set — skipped auto migration."
fi

echo "==> Restart API"
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart "$PM2_NAME" --update-env
  pm2 status "$PM2_NAME"
else
  echo "pm2 not found. Restart your Node process manually after this script."
fi

echo ""
echo "Deploy complete."
echo "  - Existing GPS socket events (update_location, track_job, etc.) unchanged."
echo "  - Visit chat: /api/visit_chat/* and visit_chat_* socket events (after migration)."
