const bcrypt = require('bcryptjs');
const pool = require('./config/db');

async function fixPasswords() {
  try {
    // Set superadmin password
    const superadminHash = await bcrypt.hash('superadmin@26@saugat', 12);
    const result = await pool.query(
      `UPDATE users SET password_hash = $1, username = COALESCE(username, 'superadmin') WHERE email = 'superadmin@pharma.com'`,
      [superadminHash]
    );
    console.log(`✅ SuperAdmin password set. Rows updated: ${result.rowCount}`);
    console.log('   Email: superadmin@pharma.com');
    console.log('   Username: superadmin');
    console.log('   Password: superadmin@26@saugat');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}
fixPasswords();
