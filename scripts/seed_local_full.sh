#!/usr/bin/env bash
# Full LOCAL DB reset + seed for YouthApp backend testing.
# SAFETY: refuses to run against non-local hosts (never drops live/remote DBs).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB="${DATABASE:-practitionermaindb}"
USER="${DB_USER:-znHi3Ozs}"
PASS="${DB_PASS:-AghhnvPmOfP7aUzT}"
HOST="${DB_HOST:-127.0.0.1}"
MYSQL=(mysql -h "$HOST" -u "$USER" -p"$PASS")

is_local_host() {
  case "${1,,}" in
    127.0.0.1|localhost|::1) return 0 ;;
    *) return 1 ;;
  esac
}

if [[ "${DB_PROTECTED:-}" == "1" ]]; then
  echo "REFUSED: DB_PROTECTED=1 (live database). This script DROPs and recreates the database."
  echo "  Unset DB_PROTECTED only on a disposable local MySQL, never on live."
  exit 1
fi

if ! is_local_host "$HOST"; then
  echo "REFUSED: seed_local_full.sh only runs on local MySQL (127.0.0.1 / localhost)."
  echo "  DB_HOST=$HOST — this script DROPs and recreates the database."
  echo "  To protect live/remote data, it will not run against remote hosts."
  exit 1
fi

if [[ "${ALLOW_DESTRUCTIVE_DB:-}" != "1" ]]; then
  echo "REFUSED: set ALLOW_DESTRUCTIVE_DB=1 to confirm you want to DROP database \"$DB\" on $HOST."
  exit 1
fi

echo "==> Recreating database $DB on $HOST (local only) ..."
mysql -h "$HOST" -u root -e "DROP DATABASE IF EXISTS \`$DB\`; CREATE DATABASE \`$DB\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null \
  || "${MYSQL[@]}" -e "DROP DATABASE IF EXISTS \`$DB\`; CREATE DATABASE \`$DB\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

run_sql() {
  echo "==> $1"
  "${MYSQL[@]}" "$DB" < "$2"
}

run_sql "Core tables" "$ROOT/scripts/create_tables.sql"
run_sql "Phleb / pleb tables" "$ROOT/scripts/setup_local_testing.sql"
run_sql "Orders pleb columns" "$ROOT/scripts/add_orders_pleb_columns.sql"
run_sql "Tests-related tables + catalog seed" "$ROOT/scripts/add_tests_related_tables.sql"
run_sql "Bookings listing" "$ROOT/scripts/create_bookings_listing.sql"
run_sql "App versions" "$ROOT/scripts/create_app_versions_table.sql"
run_sql "Pleb availability" "$ROOT/scripts/create_pleb_availability_table.sql"
run_sql "Pleb date availability columns" "$ROOT/scripts/create_pleb_date_availability_table.sql" 2>/dev/null || true
run_sql "Reference data + admin" "$ROOT/scripts/seed_local_reference_data.sql"
run_sql "Test customer + phleb accounts" "$ROOT/scripts/seed_local_test_users.sql"
run_sql "Tracking test order + assigned job" "$ROOT/scripts/seed_tracking_test_job.sql"

echo "==> Done. Tables:"
"${MYSQL[@]}" -e "SHOW TABLES;" "$DB"
echo "==> Test logins: customer testcustomer@local.test / test123 | phleb testphleb@local.test / test123"
echo "==> Order 90001 assigned to phleb id 1 (job id may vary — check pleb_jobs)"
