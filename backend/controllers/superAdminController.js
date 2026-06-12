const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { createAuditLog } = require('../middleware/auditMiddleware');

// GET all pharmacies
exports.getAllPharmacies = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', status } = req.query;
    const offset = (page - 1) * limit;

    let where = ['p.deleted_at IS NULL'];
    const params = [];
    if (search) { params.push(`%${search}%`); where.push(`(p.name ILIKE $${params.length} OR p.email ILIKE $${params.length})`); }
    if (status === 'active') where.push('p.is_active = TRUE');
    if (status === 'inactive') where.push('p.is_active = FALSE');

    const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const countResult = await pool.query(`SELECT COUNT(*) FROM pharmacies p ${whereStr}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const result = await pool.query(
      `SELECT p.*,
        (SELECT COUNT(*) FROM users u WHERE u.pharmacy_id = p.id AND u.deleted_at IS NULL) as user_count,
        (SELECT COUNT(*) FROM medicines m WHERE m.pharmacy_id = p.id AND m.deleted_at IS NULL) as medicine_count,
        (SELECT SUM(total_amount) FROM sales s WHERE s.pharmacy_id = p.id AND s.status = 'completed') as total_sales
       FROM pharmacies p ${whereStr}
       ORDER BY p.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// CREATE pharmacy
exports.createPharmacy = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { name, address, phone, email, license_number, tax_number, invoice_prefix,
            tax_rate, currency, admin_name, admin_email, admin_password,
            subscription_expires_at, is_active } = req.body;

    // Create pharmacy
    const pharmResult = await client.query(
      `INSERT INTO pharmacies (name, address, phone, email, license_number, tax_number, invoice_prefix, tax_rate, currency, subscription_expires_at, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [name, address, phone, email, license_number, tax_number, invoice_prefix || 'INV', tax_rate || 0, currency || 'NPR',
       subscription_expires_at || null, is_active !== false]
    );
    const pharmacy = pharmResult.rows[0];

    // Create default settings
    await client.query(
      'INSERT INTO settings (pharmacy_id) VALUES ($1)',
      [pharmacy.id]
    );

    // Create admin user if provided
    if (admin_email && admin_password) {
      const roleResult = await client.query("SELECT id FROM roles WHERE name = 'admin'");
      const hash = await bcrypt.hash(admin_password, 12);
      // Derive username from email prefix
      const admin_username = req.body.admin_username || admin_email.split('@')[0];
      await client.query(
        `INSERT INTO users (pharmacy_id, role_id, name, username, email, password_hash)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [pharmacy.id, roleResult.rows[0].id, admin_name || 'Admin', admin_username, admin_email, hash]
      );
    }

    // Create default medicine categories
    const categories = ['Antibiotics', 'Analgesics', 'Antacids', 'Vitamins', 'Antihistamines', 'Cardiovascular', 'Diabetes', 'Respiratory', 'Dermatology', 'Others'];
    for (const cat of categories) {
      await client.query('INSERT INTO medicine_categories (pharmacy_id, name) VALUES ($1, $2)', [pharmacy.id, cat]);
    }

    await client.query('COMMIT');

    await createAuditLog({
      pharmacyId: null,
      userId: req.user.id,
      userName: req.user.name,
      action: 'Created Pharmacy',
      module: 'Pharmacies',
      entityType: 'pharmacy',
      entityId: pharmacy.id,
      newValues: { name, email },
      ipAddress: req.ip
    });

    res.status(201).json({ success: true, data: pharmacy, message: 'Pharmacy created successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    if (error.code === '23505') {
      return res.status(400).json({ success: false, message: 'A pharmacy or user with this email already exists and is active' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};

// GET pharmacy by ID
exports.getPharmacy = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*,
        (SELECT COUNT(*) FROM users u WHERE u.pharmacy_id = p.id AND u.deleted_at IS NULL) as user_count,
        (SELECT COUNT(*) FROM medicines m WHERE m.pharmacy_id = p.id AND m.deleted_at IS NULL) as medicine_count,
        (SELECT COALESCE(SUM(total_amount),0) FROM sales s WHERE s.pharmacy_id = p.id AND s.status = 'completed') as total_sales,
        (SELECT COUNT(*) FROM sales s WHERE s.pharmacy_id = p.id AND DATE(s.sale_date) = CURRENT_DATE AND s.status = 'completed') as today_sales_count
       FROM pharmacies p WHERE p.id = $1 AND p.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Pharmacy not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// UPDATE pharmacy
exports.updatePharmacy = async (req, res) => {
  try {
    const { name, address, phone, email, license_number, tax_number, invoice_prefix,
            tax_rate, currency, is_active, subscription_expires_at } = req.body;

    const result = await pool.query(
      `UPDATE pharmacies SET name=$1, address=$2, phone=$3, email=$4, license_number=$5,
        tax_number=$6, invoice_prefix=$7, tax_rate=$8, currency=$9, is_active=$10,
        subscription_expires_at=$11
       WHERE id=$12 AND deleted_at IS NULL RETURNING *`,
      [name, address, phone, email, license_number, tax_number, invoice_prefix, tax_rate, currency,
       is_active, subscription_expires_at || null, req.params.id]
    );

    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Pharmacy not found' });

    await createAuditLog({
      pharmacyId: null, userId: req.user.id, userName: req.user.name,
      action: 'Updated Pharmacy', module: 'Pharmacies',
      entityType: 'pharmacy', entityId: parseInt(req.params.id),
      ipAddress: req.ip
    });

    res.json({ success: true, data: result.rows[0], message: 'Pharmacy updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


// RENEW pharmacy subscription
exports.renewPharmacy = async (req, res) => {
  try {
    const { subscription_expires_at } = req.body;
    if (!subscription_expires_at) {
      return res.status(400).json({ success: false, message: "New expiry date is required" });
    }
    const result = await pool.query(
      `UPDATE pharmacies SET subscription_expires_at=$1, is_active=TRUE WHERE id=$2 AND deleted_at IS NULL RETURNING *`,
      [subscription_expires_at, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: "Pharmacy not found" });
    await createAuditLog({ pharmacyId: null, userId: req.user.id, userName: req.user.name, action: "Renewed Pharmacy Subscription", module: "Pharmacies", entityType: "pharmacy", entityId: parseInt(req.params.id), newValues: { subscription_expires_at }, ipAddress: req.ip });
    res.json({ success: true, data: result.rows[0], message: "Pharmacy subscription renewed successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// DELETE pharmacy — cascade soft-delete all related data
exports.deletePharmacy = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pharmId = req.params.id;

    // Verify pharmacy exists
    const check = await client.query('SELECT id, name FROM pharmacies WHERE id = $1 AND deleted_at IS NULL', [pharmId]);
    if (!check.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Pharmacy not found' });
    }

    const now = 'NOW()';
    // Soft-delete all users belonging to this pharmacy
    await client.query('UPDATE users SET deleted_at = NOW(), is_active = FALSE WHERE pharmacy_id = $1 AND deleted_at IS NULL', [pharmId]);
    // Soft-delete medicines
    await client.query('UPDATE medicines SET deleted_at = NOW() WHERE pharmacy_id = $1 AND deleted_at IS NULL', [pharmId]);
    // Soft-delete purchases
    await client.query('UPDATE purchases SET deleted_at = NOW() WHERE pharmacy_id = $1 AND deleted_at IS NULL', [pharmId]);
    // Soft-delete suppliers
    await client.query('UPDATE suppliers SET deleted_at = NOW() WHERE pharmacy_id = $1 AND deleted_at IS NULL', [pharmId]);
    // Finally soft-delete the pharmacy itself
    await client.query('UPDATE pharmacies SET deleted_at = NOW(), is_active = FALSE WHERE id = $1', [pharmId]);

    await client.query('COMMIT');

    await createAuditLog({
      pharmacyId: null, userId: req.user.id, userName: req.user.name,
      action: 'Deleted Pharmacy', module: 'Pharmacies',
      entityType: 'pharmacy', entityId: parseInt(pharmId),
      newValues: { name: check.rows[0].name }, ipAddress: req.ip
    });

    res.json({ success: true, message: 'Pharmacy and all related data deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};

// SuperAdmin Dashboard stats — pharmacy & subscription overview only (no revenue)
exports.getDashboardStats = async (req, res) => {
  try {
    const [pharmacies, activePharmacies, totalUsers, recentPharmacies, expiringSoon, expired] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM pharmacies WHERE deleted_at IS NULL'),
      pool.query('SELECT COUNT(*) FROM pharmacies WHERE is_active = TRUE AND deleted_at IS NULL'),
      pool.query(`SELECT COUNT(*) FROM users u
        LEFT JOIN pharmacies p ON u.pharmacy_id = p.id
        WHERE u.deleted_at IS NULL
          AND u.role_id != (SELECT id FROM roles WHERE name='superadmin')
          AND (u.pharmacy_id IS NULL OR p.deleted_at IS NULL)`),
      pool.query('SELECT p.*, (SELECT COUNT(*) FROM users u WHERE u.pharmacy_id = p.id AND u.deleted_at IS NULL) as user_count FROM pharmacies p WHERE p.deleted_at IS NULL ORDER BY p.created_at DESC LIMIT 5'),
      pool.query("SELECT COUNT(*) FROM pharmacies WHERE deleted_at IS NULL AND is_active = TRUE AND subscription_expires_at BETWEEN NOW() AND NOW() + INTERVAL '30 days'"),
      pool.query('SELECT COUNT(*) FROM pharmacies WHERE deleted_at IS NULL AND subscription_expires_at < NOW()'),
    ]);

    res.json({
      success: true,
      data: {
        totalPharmacies: parseInt(pharmacies.rows[0].count),
        activePharmacies: parseInt(activePharmacies.rows[0].count),
        inactivePharmacies: parseInt(pharmacies.rows[0].count) - parseInt(activePharmacies.rows[0].count),
        totalUsers: parseInt(totalUsers.rows[0].count),
        subscriptionExpiringSoon: parseInt(expiringSoon.rows[0].count),
        subscriptionExpired: parseInt(expired.rows[0].count),
        recentPharmacies: recentPharmacies.rows
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get all users across all pharmacies (SuperAdmin)
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, pharmacy_id, search } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    let where = ["u.deleted_at IS NULL AND r.name != 'superadmin'"];

    if (pharmacy_id) { params.push(pharmacy_id); where.push(`u.pharmacy_id = $${params.length}`); }
    if (search) { params.push(`%${search}%`); where.push(`(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`); }

    const whereStr = 'WHERE ' + where.join(' AND ');
    const countResult = await pool.query(`SELECT COUNT(*) FROM users u JOIN roles r ON u.role_id = r.id ${whereStr}`, params);

    params.push(limit, offset);
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.is_active, u.last_login, u.created_at,
              r.name as role, p.name as pharmacy_name, p.id as pharmacy_id
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN pharmacies p ON u.pharmacy_id = p.id
       ${whereStr}
       ORDER BY u.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: { total: parseInt(countResult.rows[0].count), page: parseInt(page), limit: parseInt(limit) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get audit logs (SuperAdmin)
exports.getAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, pharmacy_id, module, from_date, to_date } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    let where = [];

    if (pharmacy_id) { params.push(pharmacy_id); where.push(`a.pharmacy_id = $${params.length}`); }
    if (module) { params.push(module); where.push(`a.module = $${params.length}`); }
    if (from_date) { params.push(from_date); where.push(`DATE(a.created_at) >= $${params.length}`); }
    if (to_date) { params.push(to_date); where.push(`DATE(a.created_at) <= $${params.length}`); }

    const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const countResult = await pool.query(`SELECT COUNT(*) FROM audit_logs a ${whereStr}`, params);

    params.push(limit, offset);
    const result = await pool.query(
      `SELECT a.*, p.name as pharmacy_name
       FROM audit_logs a
       LEFT JOIN pharmacies p ON a.pharmacy_id = p.id
       ${whereStr}
       ORDER BY a.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: { total: parseInt(countResult.rows[0].count), page: parseInt(page), limit: parseInt(limit) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};