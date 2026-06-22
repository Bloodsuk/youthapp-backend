#!/usr/bin/env bash
# Add npn_phleb_kit_stock + priority on npn_kit_requests (idempotent stock table; priority once).
# Usage:
#   bash scripts/run_kit_stock_migration.sh           # env/local.env
#   bash scripts/run_kit_stock_migration.sh live      # env/live.env (tunnel must be open)
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

ENV_FILE="$ENV_FILE" node <<'NODE'
const fs = require("fs");
const mysql = require("mysql2/promise");

const envPath = process.env.ENV_FILE;
const env = fs.readFileSync(envPath, "utf8");
const get = (k) => {
  const m = env.match(new RegExp("^" + k + "=(.+)$", "m"));
  return m ? m[1].trim() : null;
};

(async () => {
  const conn = await mysql.createConnection({
    host: get("DB_HOST") || "127.0.0.1",
    user: get("DB_USER"),
    password: get("PASSWORD") || get("DB_PASS"),
    database: get("DATABASE"),
  });

  const db = get("DATABASE");

  await conn.query(`
    CREATE TABLE IF NOT EXISTS npn_phleb_kit_stock (
      id int NOT NULL AUTO_INCREMENT,
      phleb_id int NOT NULL,
      kit_type_id int NOT NULL,
      current_balance int NOT NULL DEFAULT 0,
      updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_phleb_kit (phleb_id, kit_type_id),
      KEY idx_phleb (phleb_id),
      KEY idx_kit (kit_type_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);
  console.log("OK: npn_phleb_kit_stock");

  const [cols] = await conn.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = ? AND table_name = 'npn_kit_requests' AND column_name = 'priority'`,
    [db]
  );
  if (cols.length === 0) {
    await conn.query(`
      ALTER TABLE npn_kit_requests
      ADD COLUMN priority enum('Normal','Urgent') NOT NULL DEFAULT 'Normal'
      AFTER quantity_requested
    `);
    console.log("OK: added npn_kit_requests.priority");
  } else {
    console.log("SKIP: npn_kit_requests.priority already exists");
  }

  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
NODE

echo "Done."
