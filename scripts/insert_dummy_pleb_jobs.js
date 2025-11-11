const mysql = require('mysql2/promise');
require('dotenv').config({ path: './env/development.env' });

async function insertDummyPlebJobs() {
  let connection;

  // Allow overriding pleb_id via CLI arg: node scripts/insert_dummy_pleb_jobs.js 414
  const plebId = Number(process.argv[2] || 414);

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'root',
      password: process.env.PASSWORD || '',
      database: process.env.DATABASE 
    });

    console.log('Connected to database successfully!');
    console.log(`Target pleb_id: ${plebId}`);

    const rows = [
      { tracking_number: `TRK-${plebId}-001`, order_id: 9001, job_status: 'Assigned' },
      { tracking_number: `TRK-${plebId}-002`, order_id: 9002, job_status: 'Picked Up' },
      { tracking_number: `TRK-${plebId}-003`, order_id: 9003, job_status: 'In Transit' },
      { tracking_number: `TRK-${plebId}-004`, order_id: 9004, job_status: 'Delivered' },
      { tracking_number: `TRK-${plebId}-005`, order_id: 9005, job_status: 'Cancelled' },
    ];

    const insertSql = `
      INSERT INTO pleb_jobs (
        tracking_number,
        pleb_id,
        order_id,
        job_status,
        created_at
      ) VALUES (?, ?, ?, ?, NOW())
    `;

    for (const r of rows) {
      await connection.execute(insertSql, [
        r.tracking_number,
        plebId,
        r.order_id,
        r.job_status,
      ]);
      console.log(`Inserted: ${r.tracking_number} (${r.job_status})`);
    }

    console.log('✅ Dummy pleb_jobs created successfully!');
  } catch (error) {
    console.error('❌ Error inserting dummy pleb_jobs:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed.');
    }
  }
}

// Run the script
insertDummyPlebJobs();


