#!/usr/bin/env node
/**
 * Reset QA Test SOP for read-then-sign-off testing.
 * Usage: node scripts/seed_qa_test_sop.js
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

require("dotenv").config({ path: path.join(__dirname, "../env/live.env") });

const TITLE = "QA Test SOP";
const PDF_NAME = "sop-qa-test.pdf";
const PDF_REL = `uploads/${PDF_NAME}`;

// Minimal valid PDF (one blank page)
const MIN_PDF = Buffer.from(
  `%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R>>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1>>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]>>endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000052 00000 n 
0000000101 00000 n 
trailer<< /Size 4 /Root 1 0 R>>
startxref
178
%%EOF`,
  "utf8"
);

async function main() {
  const uploadDir = path.join(__dirname, "../public/uploads");
  fs.mkdirSync(uploadDir, { recursive: true });
  fs.writeFileSync(path.join(uploadDir, PDF_NAME), MIN_PDF);
  console.log("Wrote", path.join(uploadDir, PDF_NAME));

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    user: process.env.DB_USER,
    password: process.env.PASSWORD,
    database: process.env.DATABASE,
  });

  const [rows] = await conn.execute(
    "SELECT id FROM npn_sop_documents WHERE title = ? LIMIT 1",
    [TITLE]
  );

  let sopId;
  if (rows.length === 0) {
    const [ins] = await conn.execute(
      `INSERT INTO npn_sop_documents
         (title, description, current_version, file_url, is_active, created_by)
       VALUES (?, ?, '1.0', ?, 1, 'Admin')`,
      [TITLE, "End-to-end test document — open PDF then sign off.", PDF_REL]
    );
    sopId = ins.insertId;
    console.log("Created SOP id", sopId);
  } else {
    sopId = rows[0].id;
    await conn.execute(
      `UPDATE npn_sop_documents
       SET description = ?, current_version = '1.0', file_url = ?, is_active = 1
       WHERE id = ?`,
      [
        "End-to-end test document — open PDF then sign off.",
        PDF_REL,
        sopId,
      ]
    );
    console.log("Reset SOP id", sopId, "to version 1.0 with PDF");
  }

  await conn.execute("DELETE FROM npn_sop_acknowledgements WHERE sop_id = ?", [
    sopId,
  ]);
  await conn.execute("DELETE FROM npn_sop_document_views WHERE sop_id = ?", [
    sopId,
  ]);
  console.log("Cleared acknowledgements and views for fresh test.");

  await conn.end();
  console.log("\nTest as gpsphleb@test.com → SOPs:");
  console.log("  1. Status should be Pending");
  console.log("  2. Tap View document");
  console.log("  3. Then Sign off SOP");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
