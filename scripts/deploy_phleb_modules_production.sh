#!/usr/bin/env bash
# Safe production deploy: pull, build, additive DB only, restart API.
# Does NOT drop, truncate, or alter existing columns/data.
#
# Full guide: docs/phleb-modules-production-deploy.md
#
# On server:
#   cd ~/youthapp-backend
#   bash scripts/deploy_phleb_modules_production.sh
#
# Optional:
#   PM2_NAME=youth-backend ENV_FILE=env/development.env bash scripts/deploy_phleb_modules_production.sh

set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
PM2_NAME="${PM2_NAME:-youth-backend}"
BRANCH="${BRANCH:-main}"

cd "$APP_DIR"

if [[ -z "${ENV_FILE:-}" ]]; then
  for candidate in env/development.env env/production.env env/live.env; do
    if [[ -f "$candidate" ]] && grep -qE '^DB_USER=.+' "$candidate" && grep -qE '^DATABASE=.+' "$candidate"; then
      ENV_FILE="$candidate"
      break
    fi
  done
fi

if [[ -z "${ENV_FILE:-}" || ! -f "$ENV_FILE" ]]; then
  echo "ERROR: No env file with DB_USER and DATABASE set. Set ENV_FILE=env/development.env"
  exit 1
fi

echo "==> Deploy in ${APP_DIR} (env: ${ENV_FILE})"
echo "==> Host: $(hostname)"
echo "==> Git: $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"

echo "==> Pull ${BRANCH}"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"
echo "==> At commit: $(git rev-parse --short HEAD)"

echo "==> npm ci"
npm ci

echo "==> npm run build"
npm run build

echo "==> Additive DB migrations only (CREATE TABLE IF NOT EXISTS; priority column if missing)"
ENV_FILE="$ENV_FILE" node <<'NODE'
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const appDir = process.cwd();
const envPath = process.env.ENV_FILE;
const env = fs.readFileSync(envPath, "utf8");
const get = (k) => {
  const m = env.match(new RegExp("^" + k + "=(.*)$", "m"));
  return m ? m[1].trim() : "";
};

(async () => {
  const db = get("DATABASE");
  const conn = await mysql.createConnection({
    host: get("DB_HOST") || "127.0.0.1",
    user: get("DB_USER"),
    password: get("PASSWORD") || get("DB_PASS"),
    database: db,
  });

  const [[ordersBefore]] = await conn.query("SELECT COUNT(*) AS c FROM orders");
  console.log(`Sanity: orders count before = ${ordersBefore.c}`);

  const phlebFilesSql = fs.readFileSync(
    path.join(appDir, "scripts/add_npn_phleb_files.sql"),
    "utf8"
  );
  await conn.query(phlebFilesSql);
  console.log("OK: npn_phleb_files (CREATE TABLE IF NOT EXISTS)");

  const phlebContractsSql = fs.readFileSync(
    path.join(appDir, "scripts/add_npn_phleb_contracts.sql"),
    "utf8"
  );
  await conn.query(phlebContractsSql);
  console.log("OK: npn_phleb_contracts (CREATE TABLE IF NOT EXISTS)");

  const sopTablesSql = fs.readFileSync(
    path.join(appDir, "scripts/add_npn_sop_tables.sql"),
    "utf8"
  );
  for (const stmt of sopTablesSql.split(";").map((s) => s.trim()).filter(Boolean)) {
    await conn.query(stmt);
  }
  console.log("OK: npn_sop_documents / npn_sop_acknowledgements / npn_sop_document_views");

  const bookingColumnAdds = [
    ["available_days", "varchar(50) DEFAULT NULL"],
    ["blood_draw_issues", "varchar(5) DEFAULT NULL"],
    ["blood_draw_issue_types", "text DEFAULT NULL"],
    ["blood_draw_issue_detail", "text DEFAULT NULL"],
    ["customer_postcode", "varchar(10) DEFAULT NULL"],
  ];
  for (const [col, def] of bookingColumnAdds) {
    const [exists] = await conn.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = ? AND table_name = 'customer_phleb_bookings' AND column_name = ?`,
      [db, col]
    );
    if (exists.length === 0) {
      await conn.query(`ALTER TABLE customer_phleb_bookings ADD COLUMN ${col} ${def}`);
      console.log(`OK: customer_phleb_bookings.${col} (new column only)`);
    } else {
      console.log(`SKIP: customer_phleb_bookings.${col} already exists`);
    }
  }

  await conn.query(`CREATE TABLE IF NOT EXISTS npn_phleb_kit_stock (
    id int NOT NULL AUTO_INCREMENT,
    phleb_id int NOT NULL,
    kit_type_id int NOT NULL,
    current_balance int NOT NULL DEFAULT 0,
    updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_phleb_kit (phleb_id, kit_type_id),
    KEY idx_phleb (phleb_id),
    KEY idx_kit (kit_type_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);
  console.log("OK: npn_phleb_kit_stock (CREATE TABLE IF NOT EXISTS)");

  const [cols] = await conn.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = ? AND table_name = 'npn_kit_requests' AND column_name = 'priority'`,
    [db]
  );
  if (cols.length === 0) {
    await conn.query(`ALTER TABLE npn_kit_requests
      ADD COLUMN priority enum('Normal','Urgent') NOT NULL DEFAULT 'Normal'
      AFTER quantity_requested`);
    console.log("OK: added npn_kit_requests.priority (new column only)");
  } else {
    console.log("SKIP: npn_kit_requests.priority already exists");
  }

  const [[ordersAfter]] = await conn.query("SELECT COUNT(*) AS c FROM orders");
  console.log(`Sanity: orders count after = ${ordersAfter.c}`);
  if (Number(ordersBefore.c) !== Number(ordersAfter.c)) {
    throw new Error("Order count changed — aborting (should never happen)");
  }

  await conn.end();
})().catch((e) => {
  console.error("Migration failed:", e.message);
  process.exit(1);
});
NODE

echo "==> Restart ${PM2_NAME}"
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart "$PM2_NAME" --update-env
  pm2 status "$PM2_NAME"
else
  echo "WARN: pm2 not in PATH. Add NVM to PATH and run: pm2 restart ${PM2_NAME}"
  exit 1
fi

echo ""
echo "Deploy complete. Existing data untouched; only new tables/columns added if missing."
