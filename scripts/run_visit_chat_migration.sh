#!/usr/bin/env bash
# Create visit_chat_messages (safe: CREATE TABLE IF NOT EXISTS only).
# Usage:
#   bash scripts/run_visit_chat_migration.sh           # env/local.env
#   bash scripts/run_visit_chat_migration.sh live      # env/live.env (tunnel must be open)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:-local}"
ENV_FILE="$ROOT/env/${MODE}.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

HOST="${DB_HOST:-127.0.0.1}"
USER="${DB_USER:-}"
PASS="${DB_PASS:-${PASSWORD:-}}"
DB="${DATABASE:-practitionermaindb}"

if [[ -z "$USER" || -z "$PASS" ]]; then
  echo "DB_USER and PASSWORD must be set in $ENV_FILE"
  exit 1
fi

echo "Creating visit_chat_messages on $USER@$HOST / $DB ..."
mysql -h "$HOST" -u "$USER" -p"$PASS" "$DB" < "$ROOT/scripts/create_visit_chat_messages.sql"
mysql -h "$HOST" -u "$USER" -p"$PASS" "$DB" -e "DESCRIBE visit_chat_messages;"
echo "Done."
