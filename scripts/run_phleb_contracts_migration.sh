#!/usr/bin/env bash
# Create npn_phleb_contracts (phlebotomist onboarding contracts).
# Usage:
#   bash scripts/run_phleb_contracts_migration.sh
#   bash scripts/run_phleb_contracts_migration.sh live
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_NAME="${1:-local}"
ENV_FILE="$ROOT/env/${ENV_NAME}.env"
[[ "$ENV_NAME" == "live" ]] && ENV_FILE="$ROOT/env/live.env"
[[ "$ENV_NAME" == "development" ]] && ENV_FILE="$ROOT/env/development.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE"
  exit 1
fi

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

mysql -h"${DB_HOST:-127.0.0.1}" -u"$DB_USER" -p"$PASSWORD" "$DATABASE" \
  < "$ROOT/scripts/add_npn_phleb_contracts.sql"

echo "OK: npn_phleb_contracts"
