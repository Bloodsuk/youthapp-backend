#!/usr/bin/env node
/**
 * Seed training demo data for gpsphleb@test.com (phleb_id 1276) on live DB via SSH tunnel.
 * Safe to re-run — replaces matrix rows for this phleb and refreshes sign-offs / approved tasks.
 *
 * Usage: node scripts/seed_gpsphleb_training.js
 */
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../env/live.env') });

const PHLEB_EMAIL = process.env.PHLEB_EMAIL || 'gpsphleb@test.com';
const SIGNED_BY = 'Sarah M. (Clinical lead)';

const TRAINING_ROWS = [
  {
    item_name: 'Core venepuncture',
    completed_date: '2022-06-15',
    next_due_date: '2027-06-15',
  },
  {
    item_name: 'Home visit protocol',
    completed_date: '2025-01-20',
    next_due_date: '2027-01-20',
  },
  {
    item_name: 'Paediatric draw renewal',
    completed_date: '2024-06-01',
    next_due_date: '2026-06-15',
  },
  {
    item_name: 'IV cannulation practical',
    completed_date: null,
    next_due_date: null,
  },
];

const SIGNED_OFF_KEYS = [
  'identity_verified',
  'dbs_verified',
  'hep_b_verified',
  'insurance_verified',
  'right_to_work_verified',
  'sop_reading_confirmed',
];

const UNSIGNED_KEYS = [
  'cpd_reviewed',
  'cv_reviewed',
  'practical_competency_confirmed',
  'qualifications_reviewed',
];

/** Blood Draw (1) + B12 Injection (4) */
const APPROVED_TASK_IDS = [1, 4];

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER,
    password: process.env.PASSWORD,
    database: process.env.DATABASE || 'practitionermaindb',
  });

  const [users] = await conn.query(
    'SELECT id, email, full_name FROM phlebotomy_applications WHERE email = ? LIMIT 1',
    [PHLEB_EMAIL]
  );
  const phleb = users[0];
  if (!phleb) {
    throw new Error(`Phleb not found: ${PHLEB_EMAIL}`);
  }
  const phlebId = phleb.id;
  console.log(`Seeding training for ${phleb.email} (id ${phlebId})…`);

  await conn.query('DELETE FROM npn_phleb_training WHERE phleb_id = ?', [phlebId]);
  for (const row of TRAINING_ROWS) {
    await conn.query(
      `INSERT INTO npn_phleb_training (phleb_id, item_name, completed_date, next_due_date)
       VALUES (?, ?, ?, ?)`,
      [phlebId, row.item_name, row.completed_date, row.next_due_date]
    );
  }
  console.log(`  + ${TRAINING_ROWS.length} training matrix rows`);

  await conn.query(
    'UPDATE phlebotomy_applications SET approved_tasks = ? WHERE id = ?',
    [JSON.stringify(APPROVED_TASK_IDS), phlebId]
  );
  console.log(`  + approved_tasks = ${JSON.stringify(APPROVED_TASK_IDS)}`);

  for (const key of SIGNED_OFF_KEYS) {
    await conn.query(
      `UPDATE npn_phleb_signoffs
       SET signed_off = 1, signed_by = ?, signed_at = NOW()
       WHERE phleb_id = ? AND item_key = ?`,
      [SIGNED_BY, phlebId, key]
    );
  }
  for (const key of UNSIGNED_KEYS) {
    await conn.query(
      `UPDATE npn_phleb_signoffs
       SET signed_off = 0, signed_by = NULL, signed_at = NULL
       WHERE phleb_id = ? AND item_key = ?`,
      [phlebId, key]
    );
  }
  console.log(`  + ${SIGNED_OFF_KEYS.length} sign-offs completed, ${UNSIGNED_KEYS.length} pending`);

  const [trainCount] = await conn.query(
    'SELECT COUNT(*) AS c FROM npn_phleb_training WHERE phleb_id = ?',
    [phlebId]
  );
  const [signedCount] = await conn.query(
    'SELECT COUNT(*) AS c FROM npn_phleb_signoffs WHERE phleb_id = ? AND signed_off = 1',
    [phlebId]
  );
  const [app] = await conn.query(
    'SELECT approved_tasks FROM phlebotomy_applications WHERE id = ?',
    [phlebId]
  );

  console.log('\nDone.');
  console.log(`  Matrix rows: ${trainCount[0].c}`);
  console.log(`  Sign-offs complete: ${signedCount[0].c}`);
  console.log(`  approved_tasks: ${app[0].approved_tasks}`);

  await conn.end();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
