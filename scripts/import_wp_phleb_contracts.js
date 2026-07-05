#!/usr/bin/env node
/**
 * Import legacy wp_phleb_contracts rows into npn_phleb_contracts.
 * Maps email / personal_email → phlebotomy_applications.id (phleb_id).
 *
 * Usage: node scripts/import_wp_phleb_contracts.js
 *        node scripts/import_wp_phleb_contracts.js live
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const root = path.join(__dirname, "..");
const envName = process.argv[2] || "live";
const envPath = path.join(root, "env", `${envName}.env`);
if (!fs.existsSync(envPath)) {
  console.error(`Missing ${envPath}`);
  process.exit(1);
}

const env = fs.readFileSync(envPath, "utf8");
const get = (k) => {
  const m = env.match(new RegExp("^" + k + "=(.*)$", "m"));
  return m ? m[1].trim() : "";
};

const WP_COLUMNS = [
  "contractor_name",
  "address",
  "phone",
  "email",
  "full_name",
  "dob",
  "home_address",
  "mobile_number",
  "personal_email",
  "emergency_contact",
  "areas_covered",
  "travel_radius",
  "available_days",
  "weekend_availability",
  "clinic_mobile",
  "own_vehicle",
  "account_name",
  "sort_code",
  "account_number",
  "payment_frequency",
  "cv_file",
  "phlebotomy_qualifications",
  "relevant_certificates",
  "cpd_training",
  "clinical_competencies",
  "hep_b_proof",
  "occupational_health_records",
  "dbs_adults",
  "dbs_children",
  "right_to_work",
  "utr_file",
  "contractor_signature",
  "contractor_signature_date",
  "youth_signature",
  "youth_signature_date",
  "declaration_signature",
  "declaration_name",
  "declaration_date",
  "bank_signature",
  "bank_signature_date",
];

(async () => {
  const conn = await mysql.createConnection({
    host: get("DB_HOST") || "127.0.0.1",
    user: get("DB_USER"),
    password: get("PASSWORD") || get("DB_PASS"),
    database: get("DATABASE"),
  });

  const [tables] = await conn.query("SHOW TABLES LIKE 'wp_phleb_contracts'");
  if (!tables.length) {
    console.log("SKIP: wp_phleb_contracts not found");
    await conn.end();
    return;
  }

  const [legacy] = await conn.query("SELECT * FROM wp_phleb_contracts ORDER BY id");
  let imported = 0;
  let skipped = 0;

  for (const row of legacy) {
    const email = String(row.personal_email || row.email || "")
      .trim()
      .toLowerCase();
    if (!email) {
      console.log(`SKIP wp id ${row.id}: no email`);
      skipped++;
      continue;
    }

    const [phlebs] = await conn.query(
      `SELECT id FROM phlebotomy_applications
       WHERE LOWER(TRIM(email)) = ? LIMIT 1`,
      [email]
    );
    if (!phlebs.length) {
      console.log(`SKIP wp id ${row.id}: no phleb for ${email}`);
      skipped++;
      continue;
    }

    const phlebId = phlebs[0].id;
    const [existing] = await conn.query(
      `SELECT id FROM npn_phleb_contracts
       WHERE phleb_id = ? AND created_at = ? LIMIT 1`,
      [phlebId, row.created_at]
    );
    if (existing.length) {
      skipped++;
      continue;
    }

    const cols = ["phleb_id", "created_at", "status", ...WP_COLUMNS];
    const placeholders = cols.map(() => "?").join(", ");
    const values = [
      phlebId,
      row.created_at || new Date(),
      "submitted",
      ...WP_COLUMNS.map((c) => row[c] ?? null),
    ];

    await conn.query(
      `INSERT INTO npn_phleb_contracts (${cols.join(", ")})
       VALUES (${placeholders})`,
      values
    );
    imported++;
    console.log(`OK: wp ${row.id} → npn phleb_id ${phlebId}`);
  }

  const [[{ c }]] = await conn.query(
    "SELECT COUNT(*) AS c FROM npn_phleb_contracts"
  );
  console.log(`Done: imported=${imported} skipped=${skipped} npn_total=${c}`);
  await conn.end();
})().catch((e) => {
  console.error("Import failed:", e.message);
  process.exit(1);
});
