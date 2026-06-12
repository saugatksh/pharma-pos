const pool = require('../config/db');
const { createAuditLog } = require('../middleware/auditMiddleware');

exports.getMedicines = async (req, res) => {
  try {
    const pharmacyId = req.user.role_name === 'superadmin' ? req.query.pharmacy_id : req.user.pharmacy_id;
    const { page = 1, limit = 50, search = '', category_id, status } = req.query;
    const offset = (page - 1) * limit;
    const params = [pharmacyId];
    let where = ['m.pharmacy_id = $1', 'm.deleted_at IS NULL'];

    if (search) { params.push(`%${search}%`); where.push(`(m.name ILIKE $${params.length} OR m.generic_name ILIKE $${params.length} OR m.brand_name ILIKE $${params.length})`); }
    if (category_id) { params.push(category_id); where.push(`m.category_id = $${params.length}`); }
    if (status === 'active') where.push('m.is_active = TRUE');
    if (status === 'inactive') where.push('m.is_active = FALSE');

    const whereStr = 'WHERE ' + where.join(' AND ');
    const countResult = await pool.query(`SELECT COUNT(*) FROM medicines m ${whereStr}`, params);

    params.push(limit, offset);
    const result = await pool.query(
      `SELECT m.*, mc.name as category_name,
        COALESCE((SELECT SUM(ib.available_quantity) FROM inventory_batches ib
                  WHERE ib.medicine_id = m.id AND ib.is_damaged = FALSE AND (ib.expiry_date IS NULL OR ib.expiry_date > CURRENT_DATE)), 0) as current_stock
       FROM medicines m
       LEFT JOIN medicine_categories mc ON m.category_id = mc.id
       ${whereStr}
       ORDER BY m.name ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: { total: parseInt(countResult.rows[0].count), page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(parseInt(countResult.rows[0].count) / limit) }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getMedicine = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.*, mc.name as category_name,
        COALESCE((SELECT SUM(ib.available_quantity) FROM inventory_batches ib WHERE ib.medicine_id = m.id AND ib.is_damaged = FALSE AND (ib.expiry_date IS NULL OR ib.expiry_date > CURRENT_DATE)), 0) as current_stock
       FROM medicines m LEFT JOIN medicine_categories mc ON m.category_id = mc.id
       WHERE m.id = $1 AND m.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Medicine not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.createMedicine = async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacy_id;
    const { name, generic_name, brand_name, category_id, unit, description, purchase_price, selling_price, min_stock_level } = req.body;

    const result = await pool.query(
      `INSERT INTO medicines (pharmacy_id, category_id, name, generic_name, brand_name, unit, description, purchase_price, selling_price, min_stock_level)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [pharmacyId, category_id, name, generic_name, brand_name, unit || 'Tablet', description, purchase_price, selling_price, min_stock_level || 10]
    );

    await createAuditLog({
      pharmacyId, userId: req.user.id, userName: req.user.name,
      action: 'Added Medicine', module: 'Medicines',
      entityType: 'medicine', entityId: result.rows[0].id,
      newValues: { name, generic_name }, ipAddress: req.ip
    });

    res.status(201).json({ success: true, data: result.rows[0], message: 'Medicine created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateMedicine = async (req, res) => {
  try {
    const { name, generic_name, brand_name, category_id, unit, description, purchase_price, selling_price, min_stock_level, is_active } = req.body;

    const result = await pool.query(
      `UPDATE medicines SET name=$1, generic_name=$2, brand_name=$3, category_id=$4, unit=$5,
        description=$6, purchase_price=$7, selling_price=$8, min_stock_level=$9, is_active=$10
       WHERE id=$11 AND pharmacy_id=$12 AND deleted_at IS NULL RETURNING *`,
      [name, generic_name, brand_name, category_id, unit, description, purchase_price, selling_price, min_stock_level, is_active !== false, req.params.id, req.user.pharmacy_id]
    );

    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Medicine not found' });

    await createAuditLog({
      pharmacyId: req.user.pharmacy_id, userId: req.user.id, userName: req.user.name,
      action: 'Updated Medicine', module: 'Medicines',
      entityType: 'medicine', entityId: parseInt(req.params.id),
      newValues: req.body, ipAddress: req.ip
    });

    res.json({ success: true, data: result.rows[0], message: 'Medicine updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deleteMedicine = async (req, res) => {
  try {
    await pool.query(
      'UPDATE medicines SET deleted_at = NOW() WHERE id = $1 AND pharmacy_id = $2',
      [req.params.id, req.user.pharmacy_id]
    );
    await createAuditLog({
      pharmacyId: req.user.pharmacy_id, userId: req.user.id, userName: req.user.name,
      action: 'Deleted Medicine', module: 'Medicines',
      entityType: 'medicine', entityId: parseInt(req.params.id), ipAddress: req.ip
    });
    res.json({ success: true, message: 'Medicine deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getCategories = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM medicine_categories WHERE pharmacy_id = $1 ORDER BY name',
      [req.user.pharmacy_id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.searchMedicines = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 1) return res.json({ success: true, data: [] });

    const result = await pool.query(
      `SELECT m.id, m.name, m.generic_name, m.brand_name, m.unit, m.selling_price, m.purchase_price,
        COALESCE((SELECT SUM(ib.available_quantity) FROM inventory_batches ib
                  WHERE ib.medicine_id = m.id AND ib.is_damaged = FALSE AND (ib.expiry_date IS NULL OR ib.expiry_date > CURRENT_DATE)), 0) as current_stock
       FROM medicines m
       WHERE m.pharmacy_id = $1 AND m.deleted_at IS NULL AND m.is_active = TRUE
         AND (m.name ILIKE $2 OR m.generic_name ILIKE $2 OR m.brand_name ILIKE $2)
       ORDER BY m.name LIMIT 20`,
      [req.user.pharmacy_id, `%${q}%`]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
