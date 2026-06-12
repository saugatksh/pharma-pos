/**
 * PharmaPOS - One-Time Setup Script
 * Usage: node setup.js
 */
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'pharma_pos',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

async function setup() {
  const client = await pool.connect();
  try {
    console.log('🔧 PharmaPOS Setup Starting...\n');

    // 1. Run schema
    console.log('📋 Creating database schema...');
    const schema = fs.readFileSync(path.join(__dirname, 'config/schema.sql'), 'utf8');
    await client.query(schema);
    console.log('   ✅ Schema created\n');

    // 2. Run seed
    console.log('🌱 Seeding initial data...');
    const seed = fs.readFileSync(path.join(__dirname, 'config/seed.sql'), 'utf8');
    await client.query(seed);
    console.log('   ✅ Data seeded\n');

    // 3. Set superadmin password
    console.log('🔐 Setting superadmin password...');
    const password = 'superadmin@26@saugat';
    const hash = await bcrypt.hash(password, 12);
    const verified = await bcrypt.compare(password, hash);
    if (!verified) throw new Error('Hash verification failed!');

    const result = await client.query(
      `UPDATE users SET password_hash = $1, username = COALESCE(username, 'superadmin')
       WHERE email = 'superadmin@pharma.com' RETURNING email, name`,
      [hash]
    );

    result.rows.forEach(r => console.log(`   ✅ ${r.name} (${r.email})`));
    console.log('\n🎉 Setup complete!');
    console.log('\n📋 SuperAdmin Account:');
    console.log('   Username : superadmin');
    console.log('   Email    : superadmin@pharma.com');
    console.log('   Password : superadmin@26@saugat\n');

  } catch (err) {
    console.error('❌ Setup failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

setup();
