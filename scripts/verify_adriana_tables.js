/**
 * Verify Adriana (phleb 1585) loads correctly from the tables the app now uses.
 * Requires SSH tunnel + env/live.env.
 *
 *   node scripts/verify_adriana_tables.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../env/live.env") });
const mysql = require("mysql2/promise");

const PHLEB_ID = Number(process.env.VERIFY_PHLEB_ID || 1585);
const WP_BASE =
  process.env.WP_CONTRACT_FILES_BASE_URL ||
  "https://www.practitioner.youth-revisited.co.uk";

const COMPLIANCE_ROWS = [
  "identity",
  "dbs_adults",
  "dbs_children",
  "hep_b",
  "occ_health",
  "cv_quals",
  "right_to_work",
  "sop_reading",
  "practical_competency",
];

function mapStatus(raw) {
  if (raw === "verified" || raw === "override" || raw === "not_applicable") {
    return "valid";
  }
  if (raw === "submitted") return "pendingReview";
  return "missing";
}

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.PASSWORD,
    database: process.env.DATABASE,
  });

  const [[host]] = await conn.query("SELECT @@hostname AS h");
  console.log("DB:", host.h, "| phleb_id:", PHLEB_ID);

  const [contracts] = await conn.query(
    `SELECT id, application_id, full_name,
            CASE WHEN youth_signature IS NOT NULL AND TRIM(youth_signature) <> '' THEN 'approved' ELSE 'submitted' END AS status,
            CASE WHEN cv_file IS NOT NULL AND TRIM(cv_file) <> '' THEN 1 ELSE 0 END AS has_cv,
            CASE WHEN dbs_adults IS NOT NULL AND TRIM(dbs_adults) <> '' THEN 1 ELSE 0 END AS has_dbs,
            CASE WHEN hep_b_proof IS NOT NULL AND TRIM(hep_b_proof) <> '' THEN 1 ELSE 0 END AS has_hep,
            CASE WHEN right_to_work IS NOT NULL AND TRIM(right_to_work) <> '' THEN 1 ELSE 0 END AS has_rtw
     FROM wp_phleb_contracts WHERE application_id = ? ORDER BY id DESC`,
    [PHLEB_ID]
  );
  console.log("\nCONTRACTS (wp_phleb_contracts):", contracts.length);
  for (const c of contracts) {
    console.log(
      `  #${c.id} ${c.full_name} status=${c.status} files(cv/dbs/hep/rtw)=${c.has_cv}/${c.has_dbs}/${c.has_hep}/${c.has_rtw}`
    );
    console.log(`  sample URL base: ${WP_BASE}/assets/...`);
  }

  const [comp] = await conn.query(
    `SELECT row_key, status FROM npn_phleb_compliance WHERE phleb_id = ?`,
    [PHLEB_ID]
  );
  const byKey = Object.fromEntries(comp.map((r) => [r.row_key, r.status]));
  console.log("\nCOMPLIANCE (npn_phleb_compliance → app statuses):");
  for (const key of COMPLIANCE_ROWS) {
    const raw = byKey[key] || "empty";
    console.log(`  ${key}: ${raw} → ${mapStatus(raw)}`);
  }

  const [sops] = await conn.query(
    `SELECT id, title, is_required_ack, is_active
     FROM npn_sop_documents
     WHERE is_active = 1
     ORDER BY is_required_ack DESC, title ASC`
  );
  console.log("\nSOPS (is_required_ack):");
  for (const s of sops) {
    const hidden = /Safeguarding\s+Presentation/i.test(s.title);
    console.log(
      `  #${s.id} ${s.title} required=${s.is_required_ack} ${hidden ? "(hidden from app)" : ""}`
    );
  }

  const okContracts = contracts.length > 0;
  const okSubmitted = ["dbs_adults", "hep_b", "right_to_work", "cv_quals"].every(
    (k) => mapStatus(byKey[k] || "empty") === "pendingReview"
  );
  const okSops = sops.filter((s) => Number(s.is_required_ack) === 1).length === 3;

  console.log("\nVERIFY:");
  console.log("  contracts load:", okContracts ? "PASS" : "FAIL");
  console.log("  submitted compliance rows:", okSubmitted ? "PASS" : "FAIL");
  console.log("  three required SOPs:", okSops ? "PASS" : "FAIL");

  await conn.end();
  if (!okContracts || !okSubmitted || !okSops) process.exit(1);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
