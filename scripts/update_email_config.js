const mysql = require('mysql2/promise');
require('dotenv').config({ path: './env/development.env' });

async function updateEmailConfig() {
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

    // Update email configuration with new Mailgun credentials
    const [result] = await connection.execute(`
      UPDATE email_configuration 
      SET 
        smtp_host = ?,
        smtp_port = ?,
        smtp_username = ?,
        smtp_password = ?,
        smtp_encryption = ?
      WHERE id = 1
    `, [
      'smtp.mailgun.org',
      '587',
      'info@mg.youth-revisited.co.uk',
      'YouthRevisited@YR!23@',
      'tls'
    ]);

    if (result.affectedRows > 0) {
      console.log('✅ Email configuration updated successfully!');
      console.log('📧 New SMTP Settings:');
      console.log('   Host: smtp.mailgun.org');
      console.log('   Port: 587');
      console.log('   Username: info@mg.youth-revisited.co.uk');
      console.log('   Password: YouthRevisited@YR!23@');
      console.log('   Encryption: TLS');
    } else {
      console.log('❌ No rows updated. Email configuration might not exist.');
    }

    // Verify the update
    const [rows] = await connection.execute('SELECT * FROM email_configuration WHERE id = 1');
    console.log('\n📊 Current Email Configuration:');
    console.log(JSON.stringify(rows[0], null, 2));

  } catch (error) {
    console.error('❌ Error updating email configuration:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\nDatabase connection closed.');
    }
  }
}

// Run the script
updateEmailConfig();
