const pool = require('../config/db');
const { createAuditLog } = require('../middleware/auditMiddleware');

exports.getPurchases = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', supplier_id, from_date, to_date } = req.query;
    const pharmacyId = req.user.pharmacy_id;
    const offset = (page - 1) * limit;
    const params = [pharmacyId];
    let where = ['p.pharmacy_id = $1', 'p.deleted_at IS NULL'];

    if (search) { params.push(`%${search}%`); where.push(`(p.purchase_number ILIKE $${params.length} OR p.invoice_number ILIKE $${params.length})`); }
    if (supplier_id) { params.push(supplier_id); where.push(`p.supplier_id = $${params.length}`); }
    if (from_date) { params.push(from_date); where.push(`p.purchase_date >= $${params.length}`); }
    if (to_date) { params.push(to_date); where.push(`p.purchase_date <= $${params.length}`); }

    const whereStr = 'WHERE ' + where.join(' AND ');
    const countResult = await pool.query(`SELECT COUNT(*) FROM purchases p ${whereStr}`, params);

    params.push(limit, offset);
    const result = await pool.query(
      `SELECT p.*, s.name as supplier_name, u.name as created_by_name
       FROM purchases p
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       LEFT JOIN users u ON p.created_by = u.id
       ${whereStr}
       ORDER BY p.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      success: true, data: result.rows,
      pagination: { total: parseInt(countResult.rows[0].count), page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(parseInt(countResult.rows[0].count) / limit) }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getPurchase = async (req, res) => {
  try {
    const purchase = await pool.query(
      `SELECT p.*, s.name as supplier_name FROM purchases p LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE p.id = $1 AND p.pharmacy_id = $2 AND p.deleted_at IS NULL`,
      [req.params.id, req.user.pharmacy_id]
    );
    if (!purchase.rows[0]) return res.status(404).json({ success: false, message: 'Purchase not found' });

    const items = await pool.query(
      `SELECT pi.*, m.name as medicine_name, m.unit FROM purchase_items pi JOIN medicines m ON pi.medicine_id = m.id WHERE pi.purchase_id = $1`,
      [req.params.id]
    );

    res.json({ success: true, data: { ...purchase.rows[0], items: items.rows } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.createPurchase = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pharmacyId = req.user.pharmacy_id;
    const { supplier_id, purchase_date, invoice_number, notes, items } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Purchase must have at least one item' });
    }

    // Generate purchase number
    const countResult = await client.query(
      "SELECT COUNT(*) FROM purchases WHERE pharmacy_id = $1",
      [pharmacyId]
    );
    const purchaseNumber = `PO-${String(parseInt(countResult.rows[0].count) + 1).padStart(5, '0')}`;
    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.purchase_rate), 0);

    const purchaseResult = await client.query(
      `INSERT INTO purchases (pharmacy_id, supplier_id, created_by, purchase_number, invoice_number, purchase_date, total_amount, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [pharmacyId, supplier_id, req.user.id, purchaseNumber, invoice_number, purchase_date || new Date(), totalAmount, notes]
    );
    const purchase = purchaseResult.rows[0];

    // Insert items and update inventory (FEFO)
    for (const item of items) {
      const piResult = await client.query(
        `INSERT INTO purchase_items (purchase_id, medicine_id, batch_number, expiry_date, quantity, purchase_rate)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [purchase.id, item.medicine_id, item.batch_number, item.expiry_date || null, item.quantity, item.purchase_rate]
      );

      // Sync purchase_price and selling_price on the medicines table
      if (item.selling_rate !== undefined && item.selling_rate !== null && item.selling_rate !== '') {
        await client.query(
          `UPDATE medicines SET purchase_price = $1, selling_price = $2, updated_at = NOW() WHERE id = $3 AND pharmacy_id = $4`,
          [item.purchase_rate, item.selling_rate, item.medicine_id, pharmacyId]
        );
      } else {
        await client.query(
          `UPDATE medicines SET purchase_price = $1, updated_at = NOW() WHERE id = $2 AND pharmacy_id = $3`,
          [item.purchase_rate, item.medicine_id, pharmacyId]
        );
      }

      // Check if batch already exists, update or create
      const existingBatch = await client.query(
        `SELECT id FROM inventory_batches WHERE pharmacy_id=$1 AND medicine_id=$2 AND batch_number=$3 AND (expiry_date=$4 OR (expiry_date IS NULL AND $4 IS NULL))`,
        [pharmacyId, item.medicine_id, item.batch_number, item.expiry_date || null]
      );

      if (existingBatch.rows[0]) {
        await client.query(
          `UPDATE inventory_batches SET available_quantity = available_quantity + $1, initial_quantity = initial_quantity + $1, updated_at = NOW() WHERE id = $2`,
          [item.quantity, existingBatch.rows[0].id]
        );
      } else {
        await client.query(
          `INSERT INTO inventory_batches (pharmacy_id, medicine_id, purchase_item_id, batch_number, expiry_date, initial_quantity, available_quantity, purchase_rate)
           VALUES ($1,$2,$3,$4,$5,$6,$6,$7)`,
          [pharmacyId, item.medicine_id, piResult.rows[0].id, item.batch_number, item.expiry_date || null, item.quantity, item.purchase_rate]
        );
      }
    }

    await client.query('COMMIT');

    await createAuditLog({
      pharmacyId, userId: req.user.id, userName: req.user.name,
      action: 'Created Purchase', module: 'Purchases',
      entityType: 'purchase', entityId: purchase.id,
      newValues: { purchase_number: purchaseNumber, total_amount: totalAmount }, ipAddress: req.ip
    });

    res.status(201).json({ success: true, data: { ...purchase, items }, message: 'Purchase created successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};

exports.deletePurchase = async (req, res) => {
  try {
    await pool.query(
      'UPDATE purchases SET deleted_at = NOW() WHERE id = $1 AND pharmacy_id = $2',
      [req.params.id, req.user.pharmacy_id]
    );
    await createAuditLog({
      pharmacyId: req.user.pharmacy_id, userId: req.user.id, userName: req.user.name,
      action: 'Deleted Purchase', module: 'Purchases',
      entityType: 'purchase', entityId: parseInt(req.params.id), ipAddress: req.ip
    });
    res.json({ success: true, message: 'Purchase deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
