const pool = require('../config/db');
const { createAuditLog } = require('../middleware/auditMiddleware');

exports.getInventory = async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacy_id;
    const { page = 1, limit = 50, search = '', filter } = req.query;
    const offset = (page - 1) * limit;
    const params = [pharmacyId];
    let where = ['m.pharmacy_id = $1', 'm.deleted_at IS NULL'];

    if (search) { params.push(`%${search}%`); where.push(`(m.name ILIKE $${params.length} OR m.generic_name ILIKE $${params.length})`); }

    const whereStr = 'WHERE ' + where.join(' AND ');

    let havingClause = '';
    if (filter === 'low_stock') {
      // Use per-medicine min_stock_level if set, otherwise fall back to global low_stock_threshold from settings
      const settingsResult = await pool.query('SELECT low_stock_threshold FROM settings WHERE pharmacy_id = $1', [pharmacyId]);
      const globalThreshold = settingsResult.rows[0]?.low_stock_threshold || 10;
      params.push(globalThreshold);
      const thresholdParam = params.length;
      havingClause = `HAVING COALESCE(SUM(CASE WHEN ib.is_damaged=FALSE AND (ib.expiry_date IS NULL OR ib.expiry_date>CURRENT_DATE) THEN ib.available_quantity ELSE 0 END),0) <= GREATEST(m.min_stock_level, $${thresholdParam}) AND COALESCE(SUM(CASE WHEN ib.is_damaged=FALSE AND (ib.expiry_date IS NULL OR ib.expiry_date>CURRENT_DATE) THEN ib.available_quantity ELSE 0 END),0) > 0`;
    }
    if (filter === 'out_of_stock') havingClause = 'HAVING COALESCE(SUM(CASE WHEN ib.is_damaged=FALSE AND (ib.expiry_date IS NULL OR ib.expiry_date>CURRENT_DATE) THEN ib.available_quantity ELSE 0 END),0) = 0';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM (
        SELECT m.id FROM medicines m LEFT JOIN inventory_batches ib ON ib.medicine_id = m.id ${whereStr}
        GROUP BY m.id, m.min_stock_level ${havingClause}
      ) sub`,
      params
    );

    params.push(limit, offset);
    const result = await pool.query(
      `SELECT m.id, m.name, m.generic_name, m.brand_name, m.unit, m.min_stock_level, mc.name as category_name,
        COALESCE(SUM(CASE WHEN ib.is_damaged=FALSE AND (ib.expiry_date IS NULL OR ib.expiry_date>CURRENT_DATE) THEN ib.available_quantity ELSE 0 END),0) as current_stock,
        COALESCE(SUM(CASE WHEN ib.is_damaged=FALSE THEN ib.available_quantity ELSE 0 END),0) as total_stock,
        MIN(CASE WHEN ib.is_damaged=FALSE AND ib.available_quantity>0 AND ib.expiry_date IS NOT NULL THEN ib.expiry_date END) as nearest_expiry,
        COUNT(DISTINCT CASE WHEN ib.available_quantity > 0 THEN ib.id END) as batch_count
       FROM medicines m
       LEFT JOIN medicine_categories mc ON m.category_id = mc.id
       LEFT JOIN inventory_batches ib ON ib.medicine_id = m.id
       ${whereStr}
       GROUP BY m.id, m.name, m.generic_name, m.brand_name, m.unit, m.min_stock_level, mc.name
       ${havingClause}
       ORDER BY m.name ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
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

exports.getBatches = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ib.*, m.name as medicine_name, m.unit FROM inventory_batches ib
       JOIN medicines m ON ib.medicine_id = m.id
       WHERE ib.pharmacy_id = $1 AND ib.medicine_id = $2
       ORDER BY ib.expiry_date ASC NULLS LAST`,
      [req.user.pharmacy_id, req.params.medicineId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getExpiryAlerts = async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacy_id;
    const { days = 90 } = req.query;

    const result = await pool.query(
      `SELECT ib.*, m.name as medicine_name, m.unit, m.generic_name,
        CASE
          WHEN ib.expiry_date < CURRENT_DATE THEN 'expired'
          WHEN ib.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'critical'
          WHEN ib.expiry_date <= CURRENT_DATE + INTERVAL '60 days' THEN 'warning'
          ELSE 'alert'
        END as expiry_status,
        (ib.expiry_date - CURRENT_DATE) as days_to_expiry
       FROM inventory_batches ib
       JOIN medicines m ON ib.medicine_id = m.id
       WHERE ib.pharmacy_id = $1 AND ib.is_damaged = FALSE AND ib.available_quantity > 0
         AND ib.expiry_date IS NOT NULL AND ib.expiry_date <= CURRENT_DATE + ($2 || ' days')::INTERVAL
       ORDER BY ib.expiry_date ASC`,
      [pharmacyId, days]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.adjustStock = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { medicine_id, inventory_batch_id, adjustment_type, quantity, reason, notes,
            batch_number, expiry_date, purchase_rate } = req.body;
    const pharmacyId = req.user.pharmacy_id;

    let batchId = inventory_batch_id;

    if (adjustment_type === 'add' || adjustment_type === 'opening') {
      if (!batchId) {
        // Create new batch
        const newBatch = await client.query(
          `INSERT INTO inventory_batches (pharmacy_id, medicine_id, batch_number, expiry_date, initial_quantity, available_quantity, purchase_rate)
           VALUES ($1,$2,$3,$4,$5,$5,$6) RETURNING id`,
          [pharmacyId, medicine_id, batch_number, expiry_date || null, quantity, purchase_rate || 0]
        );
        batchId = newBatch.rows[0].id;
      } else {
        await client.query(
          'UPDATE inventory_batches SET available_quantity = available_quantity + $1 WHERE id = $2',
          [quantity, batchId]
        );
      }
    } else if (adjustment_type === 'remove' || adjustment_type === 'damage') {
      await client.query(
        'UPDATE inventory_batches SET available_quantity = GREATEST(0, available_quantity - $1) WHERE id = $2',
        [quantity, batchId]
      );
      if (adjustment_type === 'damage') {
        await client.query('UPDATE inventory_batches SET is_damaged = TRUE, damage_notes = $1 WHERE id = $2', [notes, batchId]);
      }
    } else if (adjustment_type === 'reconcile') {
      await client.query(
        'UPDATE inventory_batches SET available_quantity = $1 WHERE id = $2',
        [quantity, batchId]
      );
    }

    await client.query(
      `INSERT INTO stock_adjustments (pharmacy_id, medicine_id, inventory_batch_id, created_by, adjustment_type, quantity, reason, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [pharmacyId, medicine_id, batchId, req.user.id, adjustment_type, quantity, reason, notes]
    );

    await client.query('COMMIT');

    await createAuditLog({
      pharmacyId, userId: req.user.id, userName: req.user.name,
      action: `Stock Adjusted (${adjustment_type})`, module: 'Inventory',
      entityType: 'inventory_batch', entityId: batchId,
      newValues: { adjustment_type, quantity, reason }, ipAddress: req.ip
    });

    res.json({ success: true, message: 'Stock adjusted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};