#!/usr/bin/env bash
# Create npn_phleb_files for phleb compliance uploads.
# Usage: bash scripts/run_phleb_files_migration.sh live
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

mysql -h"${DB_HOST:-127.0.0.1}" -u"$DB_USER" -p"$PASSWORD" "$DATABASE" < "$ROOT/scripts/add_npn_phleb_files.sql"
echo "OK: npn_phleb_files"
