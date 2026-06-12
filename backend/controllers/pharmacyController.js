const pool = require('../config/db');
const { createAuditLog } = require('../middleware/auditMiddleware');

// ============================================================
// SUPPLIER CONTROLLER
// ============================================================
exports.getSuppliers = async (req, res) => {
  try {
    const { search = '' } = req.query;
    const params = [req.user.pharmacy_id];
    let where = ['pharmacy_id = $1', 'deleted_at IS NULL'];
    if (search) { params.push(`%${search}%`); where.push(`(name ILIKE $${params.length} OR contact_person ILIKE $${params.length})`); }

    const result = await pool.query(
      `SELECT * FROM suppliers WHERE ${where.join(' AND ')} ORDER BY name ASC`, params
    );
    res.json({ success: true, data: result.rows });
  } catch (error) { res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.createSupplier = async (req, res) => {
  try {
    const { name, contact_person, phone, email, address } = req.body;
    const result = await pool.query(
      `INSERT INTO suppliers (pharmacy_id, name, contact_person, phone, email, address)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user.pharmacy_id, name, contact_person, phone, email, address]
    );
    await createAuditLog({ pharmacyId: req.user.pharmacy_id, userId: req.user.id, userName: req.user.name, action: 'Added Supplier', module: 'Suppliers', entityType: 'supplier', entityId: result.rows[0].id, ipAddress: req.ip });
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) { res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.updateSupplier = async (req, res) => {
  try {
    const { name, contact_person, phone, email, address, is_active } = req.body;
    const result = await pool.query(
      `UPDATE suppliers SET name=$1, contact_person=$2, phone=$3, email=$4, address=$5, is_active=$6 WHERE id=$7 AND pharmacy_id=$8 RETURNING *`,
      [name, contact_person, phone, email, address, is_active !== false, req.params.id, req.user.pharmacy_id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Supplier not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) { res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.deleteSupplier = async (req, res) => {
  try {
    await pool.query('UPDATE suppliers SET deleted_at = NOW() WHERE id=$1 AND pharmacy_id=$2', [req.params.id, req.user.pharmacy_id]);
    res.json({ success: true, message: 'Supplier deleted' });
  } catch (error) { res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.getSupplierReturnHistory = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT sr.*, u.name as created_by_name FROM supplier_returns sr LEFT JOIN users u ON sr.created_by = u.id
       WHERE sr.supplier_id = $1 AND sr.pharmacy_id = $2 ORDER BY sr.created_at DESC`,
      [req.params.id, req.user.pharmacy_id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) { res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.getSupplierPurchaseHistory = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, u.name as created_by_name FROM purchases p LEFT JOIN users u ON p.created_by = u.id
       WHERE p.supplier_id = $1 AND p.pharmacy_id = $2 AND p.deleted_at IS NULL ORDER BY p.purchase_date DESC`,
      [req.params.id, req.user.pharmacy_id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) { res.status(500).json({ success: false, message: 'Server error' }); }
};

// ============================================================
// USER CONTROLLER (Admin manages pharmacy users)
// ============================================================
exports.getUsers = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.is_active, u.last_login, u.created_at, r.name as role
       FROM users u JOIN roles r ON u.role_id = r.id
       WHERE u.pharmacy_id = $1 AND u.deleted_at IS NULL AND r.name != 'superadmin'
       ORDER BY u.created_at DESC`,
      [req.user.pharmacy_id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) { res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.createUser = async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const { name, email, phone, password, role } = req.body;
    const roleResult = await pool.query("SELECT id FROM roles WHERE name = $1 AND name != 'superadmin'", [role]);
    if (!roleResult.rows[0]) return res.status(400).json({ success: false, message: 'Invalid role' });

    const hash = await bcrypt.hash(password, 12);
    const { username } = req.body;
    const derivedUsername = username || email.split('@')[0];
    const result = await pool.query(
      `INSERT INTO users (pharmacy_id, role_id, name, username, email, phone, password_hash) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, name, username, email, phone`,
      [req.user.pharmacy_id, roleResult.rows[0].id, name, derivedUsername, email, phone, hash]
    );
    await createAuditLog({ pharmacyId: req.user.pharmacy_id, userId: req.user.id, userName: req.user.name, action: 'Created User', module: 'Users', entityType: 'user', entityId: result.rows[0].id, newValues: { name, email, role }, ipAddress: req.ip });
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') return res.status(400).json({ success: false, message: 'A user with this email already exists and is active' });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { name, phone, is_active, role } = req.body;
    let roleId = null;
    if (role) {
      const roleResult = await pool.query("SELECT id FROM roles WHERE name=$1 AND name!='superadmin'", [role]);
      if (!roleResult.rows[0]) return res.status(400).json({ success: false, message: 'Invalid role' });
      roleId = roleResult.rows[0].id;
    }

    const result = await pool.query(
      `UPDATE users SET name=$1, phone=$2, is_active=$3 ${roleId ? ', role_id=$4' : ''} WHERE id=${roleId ? '$5' : '$4'} AND pharmacy_id=${roleId ? '$6' : '$5'} AND deleted_at IS NULL RETURNING id, name, email, is_active`,
      roleId ? [name, phone, is_active, roleId, req.params.id, req.user.pharmacy_id]
             : [name, phone, is_active, req.params.id, req.user.pharmacy_id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) { res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.resetPassword = async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const { new_password } = req.body;
    const hash = await bcrypt.hash(new_password, 12);
    await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2 AND pharmacy_id=$3', [hash, req.params.id, req.user.pharmacy_id]);
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) { res.status(500).json({ success: false, message: 'Server error' }); }
};

// ============================================================
// RETURNS CONTROLLER
// ============================================================
exports.createCustomerReturn = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { sale_id, items, reason } = req.body;
    const pharmacyId = req.user.pharmacy_id;

    const sale = await client.query('SELECT * FROM sales WHERE id=$1 AND pharmacy_id=$2 AND status=$3', [sale_id, pharmacyId, 'completed']);
    if (!sale.rows[0]) return res.status(400).json({ success: false, message: 'Sale not found or not eligible for return' });

    const countResult = await client.query('SELECT COUNT(*) FROM customer_returns WHERE pharmacy_id=$1', [pharmacyId]);
    const returnNumber = `CR-${String(parseInt(countResult.rows[0].count) + 1).padStart(5, '0')}`;
    let totalRefund = 0;

    const returnResult = await client.query(
      `INSERT INTO customer_returns (pharmacy_id, sale_id, created_by, return_number, reason) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [pharmacyId, sale_id, req.user.id, returnNumber, reason]
    );
    const returnId = returnResult.rows[0].id;

    for (const item of items) {
      let returnQtyLeft = item.quantity;

      // Resolve medicine_id: prefer direct, fall back via sale_item_id
      let medicineId = item.medicine_id;
      if (!medicineId && item.sale_item_id) {
        const siRow = await client.query('SELECT medicine_id FROM sale_items WHERE id=$1 AND sale_id=$2', [item.sale_item_id, sale_id]);
        if (siRow.rows[0]) medicineId = siRow.rows[0].medicine_id;
      }
      if (!medicineId) continue;

      // Get all sale_item rows for this medicine (may span multiple batches)
      const saleItems = await client.query(
        'SELECT * FROM sale_items WHERE sale_id=$1 AND medicine_id=$2 ORDER BY id ASC',
        [sale_id, medicineId]
      );
      if (!saleItems.rows.length) continue;

      for (const si of saleItems.rows) {
        if (returnQtyLeft <= 0) break;
        const qtyFromThisBatch = Math.min(returnQtyLeft, si.quantity);
        const refund = qtyFromThisBatch * parseFloat(si.unit_price);
        totalRefund += refund;

        await client.query(
          `INSERT INTO customer_return_items (customer_return_id, sale_item_id, medicine_id, inventory_batch_id, quantity, unit_price, refund_amount)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [returnId, si.id, si.medicine_id, si.inventory_batch_id, qtyFromThisBatch, si.unit_price, refund]
        );

        // Restore inventory to the exact batch it was deducted from
        if (si.inventory_batch_id) {
          await client.query(
            'UPDATE inventory_batches SET available_quantity = available_quantity + $1, updated_at = NOW() WHERE id=$2',
            [qtyFromThisBatch, si.inventory_batch_id]
          );
        }
        returnQtyLeft -= qtyFromThisBatch;
      }
    }

    await client.query('UPDATE customer_returns SET total_refund=$1 WHERE id=$2', [totalRefund, returnId]);
    await client.query('COMMIT');
    res.status(201).json({ success: true, data: { return_number: returnNumber, total_refund: totalRefund }, message: 'Return processed successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally { client.release(); }
};

exports.getCustomerReturns = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cr.*, s.invoice_number,
        (SELECT COUNT(*) FROM customer_return_items cri WHERE cri.customer_return_id = cr.id) AS item_count,
        u.name as created_by_name
       FROM customer_returns cr
       JOIN sales s ON cr.sale_id = s.id
       LEFT JOIN users u ON cr.created_by = u.id
       WHERE cr.pharmacy_id=$1 ORDER BY cr.created_at DESC`,
      [req.user.pharmacy_id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) { res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.getCustomerReturn = async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacy_id;
    const cr = await pool.query(
      `SELECT cr.*, s.invoice_number, s.customer_name, s.customer_phone, u.name as created_by_name
       FROM customer_returns cr
       JOIN sales s ON cr.sale_id = s.id
       LEFT JOIN users u ON cr.created_by = u.id
       WHERE cr.id=$1 AND cr.pharmacy_id=$2`,
      [req.params.id, pharmacyId]
    );
    if (!cr.rows[0]) return res.status(404).json({ success: false, message: 'Return not found' });
    const items = await pool.query(
      `SELECT cri.*, m.name as medicine_name, m.unit
       FROM customer_return_items cri
       JOIN medicines m ON cri.medicine_id = m.id
       WHERE cri.customer_return_id=$1`,
      [req.params.id]
    );
    res.json({ success: true, data: { ...cr.rows[0], items: items.rows } });
  } catch (error) { res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.getSupplierReturns = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT sr.*, sup.name as supplier_name,
        (SELECT COUNT(*) FROM supplier_return_items sri WHERE sri.supplier_return_id = sr.id) AS item_count,
        u.name as created_by_name
       FROM supplier_returns sr
       LEFT JOIN suppliers sup ON sr.supplier_id = sup.id
       LEFT JOIN users u ON sr.created_by = u.id
       WHERE sr.pharmacy_id=$1 ORDER BY sr.created_at DESC`,
      [req.user.pharmacy_id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) { res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.getSupplierReturn = async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacy_id;
    const sr = await pool.query(
      `SELECT sr.*, sup.name as supplier_name, u.name as created_by_name
       FROM supplier_returns sr
       LEFT JOIN suppliers sup ON sr.supplier_id = sup.id
       LEFT JOIN users u ON sr.created_by = u.id
       WHERE sr.id=$1 AND sr.pharmacy_id=$2`,
      [req.params.id, pharmacyId]
    );
    if (!sr.rows[0]) return res.status(404).json({ success: false, message: 'Return not found' });
    const items = await pool.query(
      `SELECT sri.*, m.name as medicine_name
       FROM supplier_return_items sri
       JOIN medicines m ON sri.medicine_id = m.id
       WHERE sri.supplier_return_id=$1`,
      [req.params.id]
    );
    res.json({ success: true, data: { ...sr.rows[0], items: items.rows } });
  } catch (error) { res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.createSupplierReturn = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { supplier_id, items, reason, notes } = req.body;
    const pharmacyId = req.user.pharmacy_id;

    // Normalize reason to match DB CHECK constraint
    const validReasons = ['damaged', 'expired', 'other'];
    const safeReason = validReasons.includes(reason) ? reason : 'other';

    const countResult = await client.query('SELECT COUNT(*) FROM supplier_returns WHERE pharmacy_id=$1', [pharmacyId]);
    const returnNumber = `SR-${String(parseInt(countResult.rows[0].count) + 1).padStart(5, '0')}`;
    let totalAmount = 0;

    const returnResult = await client.query(
      `INSERT INTO supplier_returns (pharmacy_id, supplier_id, created_by, return_number, reason, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [pharmacyId, supplier_id, req.user.id, returnNumber, safeReason, notes]
    );

    for (const item of items) {
      const batch = await client.query('SELECT * FROM inventory_batches WHERE id=$1 AND pharmacy_id=$2', [item.inventory_batch_id, pharmacyId]);
      if (!batch.rows[0]) continue;
      const amount = item.quantity * batch.rows[0].purchase_rate;
      totalAmount += amount;

      await client.query(
        `INSERT INTO supplier_return_items (supplier_return_id, medicine_id, inventory_batch_id, batch_number, quantity, purchase_rate, total_amount) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [returnResult.rows[0].id, batch.rows[0].medicine_id, item.inventory_batch_id, batch.rows[0].batch_number, item.quantity, batch.rows[0].purchase_rate, amount]
      );
      await client.query('UPDATE inventory_batches SET available_quantity = GREATEST(0, available_quantity - $1) WHERE id=$2', [item.quantity, item.inventory_batch_id]);
    }

    await client.query('UPDATE supplier_returns SET total_amount=$1 WHERE id=$2', [totalAmount, returnResult.rows[0].id]);
    await client.query('COMMIT');
    res.status(201).json({ success: true, data: { return_number: returnNumber, total_amount: totalAmount } });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: 'Server error' });
  } finally { client.release(); }
};

// ============================================================
// REPORTS CONTROLLER
// ============================================================
exports.getSalesReport = async (req, res) => {
  try {
    const { from_date, to_date, group_by = 'day' } = req.query;
    const pharmacyId = req.user.pharmacy_id;
    const params = [pharmacyId, from_date || 'NOW() - INTERVAL \'30 days\'', to_date || 'NOW()'];

    const result = await pool.query(
      `SELECT
        DATE_TRUNC($4, sale_date) as period,
        COUNT(*) as transaction_count,
        SUM(total_amount) as total_sales,
        SUM(discount_amount) as total_discounts,
        SUM(tax_amount) as total_tax,
        AVG(total_amount) as avg_sale
       FROM sales
       WHERE pharmacy_id=$1 AND status='completed'
         AND DATE(sale_date) BETWEEN $2 AND $3
       GROUP BY DATE_TRUNC($4, sale_date)
       ORDER BY period ASC`,
      [pharmacyId, from_date, to_date, group_by]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) { res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.getPaymentBreakdown = async (req, res) => {
  try {
    const { from_date, to_date } = req.query;
    const pharmacyId = req.user.pharmacy_id;
    const result = await pool.query(
      `SELECT payment_method,
        COUNT(*) as transaction_count,
        SUM(total_amount) as total_amount
       FROM sales
       WHERE pharmacy_id=$1 AND status='completed'
         AND ($2::date IS NULL OR DATE(sale_date) >= $2)
         AND ($3::date IS NULL OR DATE(sale_date) <= $3)
       GROUP BY payment_method`,
      [pharmacyId, from_date || null, to_date || null]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) { res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.getProfitReport = async (req, res) => {
  try {
    const { from_date, to_date } = req.query;
    const pharmacyId = req.user.pharmacy_id;

    const result = await pool.query(
      `SELECT
        m.name as medicine_name,
        SUM(si.quantity) as total_sold,
        SUM(si.quantity * si.unit_price) as total_revenue,
        SUM(si.quantity * si.purchase_rate) as total_cost,
        SUM(si.quantity * (si.unit_price - si.purchase_rate)) as total_profit
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       JOIN medicines m ON si.medicine_id = m.id
       WHERE s.pharmacy_id=$1 AND s.status='completed'
         AND ($2::date IS NULL OR DATE(s.sale_date) >= $2)
         AND ($3::date IS NULL OR DATE(s.sale_date) <= $3)
       GROUP BY m.id, m.name
       ORDER BY total_profit DESC`,
      [pharmacyId, from_date || null, to_date || null]
    );

    const summary = await pool.query(
      `SELECT SUM(si.quantity * si.unit_price) as total_revenue,
        SUM(si.quantity * si.purchase_rate) as total_cost,
        SUM(si.quantity * (si.unit_price - si.purchase_rate)) as total_profit
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       WHERE s.pharmacy_id=$1 AND s.status='completed'
         AND ($2::date IS NULL OR DATE(s.sale_date) >= $2)
         AND ($3::date IS NULL OR DATE(s.sale_date) <= $3)`,
      [pharmacyId, from_date || null, to_date || null]
    );

    res.json({ success: true, data: result.rows, summary: summary.rows[0] });
  } catch (error) { res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.getAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, module, from_date, to_date } = req.query;
    const pharmacyId = req.user.pharmacy_id;
    const offset = (page - 1) * limit;
    const params = [pharmacyId];
    let where = ['pharmacy_id = $1'];

    if (module) { params.push(module); where.push(`module = $${params.length}`); }
    if (from_date) { params.push(from_date); where.push(`DATE(created_at) >= $${params.length}`); }
    if (to_date) { params.push(to_date); where.push(`DATE(created_at) <= $${params.length}`); }

    const whereStr = 'WHERE ' + where.join(' AND ');
    const countResult = await pool.query(`SELECT COUNT(*) FROM audit_logs ${whereStr}`, params);
    params.push(limit, offset);
    const result = await pool.query(
      `SELECT * FROM audit_logs ${whereStr} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ success: true, data: result.rows, pagination: { total: parseInt(countResult.rows[0].count), page: parseInt(page), limit: parseInt(limit) } });
  } catch (error) { res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.getSettings = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, s.invoice_footer, s.invoice_terms, s.low_stock_threshold, s.expiry_alert_days, s.allow_negative_stock, s.require_batch_number
       FROM pharmacies p LEFT JOIN settings s ON s.pharmacy_id = p.id
       WHERE p.id=$1`,
      [req.user.pharmacy_id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) { res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.updateSettings = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { name, address, phone, email, license_number, tax_number, invoice_prefix, tax_rate, currency, logo_url,
            invoice_footer, invoice_terms, low_stock_threshold, expiry_alert_days, allow_negative_stock, require_batch_number } = req.body;

    await client.query(
      `UPDATE pharmacies SET name=$1, address=$2, phone=$3, email=$4, license_number=$5, tax_number=$6, invoice_prefix=$7, tax_rate=$8, currency=$9, logo_url=$10 WHERE id=$11`,
      [name, address, phone, email, license_number, tax_number, invoice_prefix, tax_rate, currency, logo_url || null, req.user.pharmacy_id]
    );

    await client.query(
      `INSERT INTO settings (pharmacy_id, invoice_footer, invoice_terms, low_stock_threshold, expiry_alert_days, allow_negative_stock, require_batch_number)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (pharmacy_id) DO UPDATE SET invoice_footer=$2, invoice_terms=$3, low_stock_threshold=$4, expiry_alert_days=$5, allow_negative_stock=$6, require_batch_number=$7, updated_at=NOW()`,
      [req.user.pharmacy_id, invoice_footer, invoice_terms, low_stock_threshold || 10, expiry_alert_days || 90, allow_negative_stock || false, require_batch_number !== false]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: 'Server error' });
  } finally { client.release(); }
};