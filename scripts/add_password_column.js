const mysql = require('mysql2/promise');
require('dotenv').config({ path: './env/development.env' });

async function addPasswordColumn() {
  let connection;
  
  try {
    // Create database connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'znHi3Ozs',
      password: process.env.PASSWORD || 'AghhnvPmOfP7aUzT',
      database: process.env.DATABASE || 'practitionermaindb'
    });

    console.log('Connected to database successfully!');

    // Check if password column already exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'phlebotomy_applications' 
      AND COLUMN_NAME = 'password'
    `, [process.env.DATABASE || 'practitionermaindb']);

    if (columns.length > 0) {
      console.log('✅ Password column already exists in phlebotomy_applications table!');
      return;
    }

    // Add password column
    await connection.execute(`
      ALTER TABLE phlebotomy_applications 
      ADD COLUMN password VARCHAR(255) NULL AFTER email
    `);

    console.log('✅ Password column added successfully to phlebotomy_applications table!');
    console.log('📊 Column: password VARCHAR(255) NULL');
    console.log('📍 Position: After email column');

  } catch (error) {
    console.error('❌ Error adding password column:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed.');
    }
  }
}

// Run the script
addPasswordColumn();

