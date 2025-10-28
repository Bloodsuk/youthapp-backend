const mysql = require('mysql2/promise');
require('dotenv').config({ path: './env/development.env' });

async function insertDummyPhlebotomist() {
  let connection;
  
  try {
    // Create database connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER ,
      password: process.env.PASSWORD ,
      database: process.env.DATABASE
    });

    console.log('Connected to database successfully!');

    // Check if phlebotomist already exists
    const [existing] = await connection.execute(
      'SELECT id FROM phlebotomy_applications WHERE email = ?',
      ['hafizg367@gmail.com']
    );

    if (existing.length > 0) {
      console.log('Phlebotomist with email hafizg367@gmail.com already exists!');
      return;
    }

    // Insert dummy phlebotomist
    const [result] = await connection.execute(`
      INSERT INTO phlebotomy_applications (
        full_name,
        home_address,
        phone,
        email,
        employment_type,
        working_hours,
        other_job,
        unavailable_times,
        drive,
        travel_radius,
        dbs,
        certifications,
        experience,
        exp_years,
        services,
        first_aid,
        first_aid_desc,
        trainer,
        trainer_desc,
        training_academy,
        payment_terms,
        extra_info,
        lat,
        lng,
        created_at,
        is_active,
        is_email_sent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)
    `, [
      'Hafiz Test User',
      '123 Test Street, London, UK',
      '+44 7123 456789',
      'hafizg367@gmail.com',
      'Full-time',
      '9:00 AM - 5:00 PM',
      'No',
      'Weekends',
      'Yes',
      '50 miles',
      'Yes',
      'Phlebotomy Certificate, CPR Certified',
      'Hospital phlebotomy, mobile blood collection',
      '3 years',
      'Blood collection, specimen handling, patient care',
      'Yes',
      'CPR and First Aid certified through Red Cross',
      'Yes',
      'Trained new phlebotomists at previous hospital',
      'LMA',
      'Yes',
      'Available for emergency calls',
      '51.5074',
      '-0.1278',
      1, // is_active
      0  // is_email_sent
    ]);

    console.log('✅ Dummy phlebotomist created successfully!');
    console.log('📧 Email: hafizg367@gmail.com');
    console.log('👤 Name: Hafiz Test User');
    console.log('🆔 ID:', result.insertId);
    console.log('📊 Status: Active (ready for testing)');

  } catch (error) {
    console.error('❌ Error creating dummy phlebotomist:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed.');
    }
  }
}

// Run the script
insertDummyPhlebotomist();
