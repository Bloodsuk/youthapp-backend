#!/usr/bin/env bash
# Full local DB reset + seed for YouthApp backend testing.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB="practitionermaindb"
USER="${DB_USER:-znHi3Ozs}"
PASS="${DB_PASS:-AghhnvPmOfP7aUzT}"
HOST="${DB_HOST:-127.0.0.1}"
MYSQL=(mysql -h "$HOST" -u "$USER" -p"$PASS")

echo "==> Recreating database $DB ..."
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
