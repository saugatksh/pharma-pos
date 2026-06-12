const pool = require('../config/db');
const { createAuditLog } = require('../middleware/auditMiddleware');

exports.getSales = async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacy_id;
    const { page = 1, limit = 20, from_date, to_date, payment_method, status } = req.query;
    const offset = (page - 1) * limit;
    const params = [pharmacyId];
    let where = ['s.pharmacy_id = $1'];

    if (from_date) { params.push(from_date); where.push(`DATE(s.sale_date) >= $${params.length}`); }
    if (to_date) { params.push(to_date); where.push(`DATE(s.sale_date) <= $${params.length}`); }
    if (payment_method) { params.push(payment_method); where.push(`s.payment_method = $${params.length}`); }
    if (status) { params.push(status); where.push(`s.status = $${params.length}`); }

    const whereStr = 'WHERE ' + where.join(' AND ');
    const countResult = await pool.query(`SELECT COUNT(*) FROM sales s ${whereStr}`, params);

    params.push(limit, offset);
    const result = await pool.query(
      `SELECT s.*, u.name as created_by_name FROM sales s LEFT JOIN users u ON s.created_by = u.id
       ${whereStr} ORDER BY s.sale_date DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    // Attach items to each sale for the list view
    const saleIds = result.rows.map(r => r.id);
    let itemsMap = {};
    if (saleIds.length > 0) {
      const itemsResult = await pool.query(
        `SELECT si.sale_id, si.medicine_id, SUM(si.quantity) as quantity, m.name as medicine_name
         FROM sale_items si JOIN medicines m ON si.medicine_id = m.id
         WHERE si.sale_id = ANY($1)
         GROUP BY si.sale_id, si.medicine_id, m.name`,
        [saleIds]
      );
      for (const item of itemsResult.rows) {
        if (!itemsMap[item.sale_id]) itemsMap[item.sale_id] = [];
        itemsMap[item.sale_id].push(item);
      }
    }
    const salesWithItems = result.rows.map(s => ({ ...s, items: itemsMap[s.id] || [] }));

    res.json({
      success: true, data: salesWithItems,
      pagination: { total: parseInt(countResult.rows[0].count), page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(parseInt(countResult.rows[0].count) / limit) }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getSale = async (req, res) => {
  try {
    const sale = await pool.query(
      `SELECT s.*, u.name as created_by_name FROM sales s LEFT JOIN users u ON s.created_by = u.id
       WHERE s.id = $1 AND s.pharmacy_id = $2`,
      [req.params.id, req.user.pharmacy_id]
    );
    if (!sale.rows[0]) return res.status(404).json({ success: false, message: 'Sale not found' });

    // Aggregate sale_items by medicine; also collect individual sale_item ids for returns
    const items = await pool.query(
      `SELECT si.medicine_id,
              SUM(si.quantity) as quantity,
              ROUND(SUM(si.total_amount) / NULLIF(SUM(si.quantity), 0), 2) as unit_price,
              SUM(si.total_amount) as total_amount,
              MAX(si.discount_percent) as discount_percent,
              m.name as medicine_name, m.unit,
              array_agg(si.id ORDER BY si.id) as sale_item_ids,
              MIN(si.id) as id
       FROM sale_items si JOIN medicines m ON si.medicine_id = m.id
       WHERE si.sale_id = $1
       GROUP BY si.medicine_id, m.name, m.unit
       ORDER BY m.name`,
      [req.params.id]
    );

    const pharmacy = await pool.query(
      `SELECT p.*, s.invoice_footer, s.invoice_terms, s.allow_negative_stock
       FROM pharmacies p LEFT JOIN settings s ON s.pharmacy_id = p.id
       WHERE p.id = $1`,
      [req.user.pharmacy_id]
    );

    res.json({ success: true, data: { ...sale.rows[0], items: items.rows, pharmacy: pharmacy.rows[0] } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.createSale = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pharmacyId = req.user.pharmacy_id;
    const { customer_name, customer_phone, items, discount_amount = 0, discount_percent = 0,
            payment_method = 'cash', amount_paid, notes } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Sale must have at least one item' });
    }

    // Load pharmacy settings (for allow_negative_stock)
    const settingsResult = await client.query(
      `SELECT allow_negative_stock FROM settings WHERE pharmacy_id = $1`,
      [pharmacyId]
    );
    const allowNegativeStock = settingsResult.rows[0]?.allow_negative_stock || false;

    // Validate stock availability using FEFO
    for (const item of items) {
      const stockCheck = await client.query(
        `SELECT COALESCE(SUM(available_quantity), 0) as total_stock
         FROM inventory_batches
         WHERE medicine_id = $1 AND pharmacy_id = $2 AND is_damaged = FALSE
           AND (expiry_date IS NULL OR expiry_date > CURRENT_DATE)`,
        [item.medicine_id, pharmacyId]
      );

      if (!allowNegativeStock && parseInt(stockCheck.rows[0].total_stock) < item.quantity) {
        const med = await client.query('SELECT name FROM medicines WHERE id = $1', [item.medicine_id]);
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${med.rows[0]?.name}. Available: ${stockCheck.rows[0].total_stock}`
        });
      }
    }

    // Get pharmacy settings for tax & invoice
    const pharmResult = await client.query('SELECT * FROM pharmacies WHERE id = $1', [pharmacyId]);
    const pharmacy = pharmResult.rows[0];

    // Generate invoice number
    const invoiceNumber = `${pharmacy.invoice_prefix}-${String(pharmacy.invoice_counter).padStart(6, '0')}`;
    await client.query('UPDATE pharmacies SET invoice_counter = invoice_counter + 1 WHERE id = $1', [pharmacyId]);

    // Calculate totals
    let subtotal = 0;
    const processedItems = [];

    for (const item of items) {
      const med = await client.query('SELECT selling_price FROM medicines WHERE id = $1', [item.medicine_id]);
      const unitPrice = item.unit_price || med.rows[0].selling_price;
      const itemDiscount = item.discount_percent || 0;
      const itemTotal = (unitPrice * item.quantity) * (1 - itemDiscount / 100);
      subtotal += itemTotal;
      processedItems.push({ ...item, unit_price: unitPrice, discount_percent: itemDiscount, total_amount: itemTotal });
    }

    const taxRate = pharmacy.tax_rate || 0;
    const taxAmount = (subtotal - parseFloat(discount_amount)) * (taxRate / 100);
    const totalAmount = subtotal - parseFloat(discount_amount) + taxAmount;
    const changeAmount = Math.max(0, (parseFloat(amount_paid) || totalAmount) - totalAmount);

    // Create sale record
    const saleResult = await client.query(
      `INSERT INTO sales (pharmacy_id, created_by, invoice_number, customer_name, customer_phone,
        subtotal, discount_amount, discount_percent, tax_amount, total_amount, amount_paid, change_amount, payment_method, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [pharmacyId, req.user.id, invoiceNumber, customer_name, customer_phone,
       subtotal, discount_amount, discount_percent, taxAmount, totalAmount,
       amount_paid || totalAmount, changeAmount, payment_method, notes]
    );
    const sale = saleResult.rows[0];

    // Process each item with FEFO deduction
    for (const item of processedItems) {
      // Get batches ordered by expiry date (FEFO - earliest expiry first)
      const batches = await client.query(
        `SELECT id, batch_number, expiry_date, available_quantity, purchase_rate
         FROM inventory_batches
         WHERE medicine_id = $1 AND pharmacy_id = $2 AND is_damaged = FALSE
           AND available_quantity > 0 AND (expiry_date IS NULL OR expiry_date > CURRENT_DATE)
         ORDER BY expiry_date ASC NULLS LAST, id ASC`,
        [item.medicine_id, pharmacyId]
      );

      let remainingQty = item.quantity;
      let purchaseRate = 0;

      for (const batch of batches.rows) {
        if (remainingQty <= 0) break;
        const deductQty = Math.min(remainingQty, batch.available_quantity);
        purchaseRate = batch.purchase_rate;

        await client.query(
          'UPDATE inventory_batches SET available_quantity = available_quantity - $1, updated_at = NOW() WHERE id = $2',
          [deductQty, batch.id]
        );

        // Record sale item for this batch
        if (deductQty > 0) {
          await client.query(
            `INSERT INTO sale_items (sale_id, medicine_id, inventory_batch_id, batch_number, expiry_date, quantity, unit_price, discount_percent, total_amount, purchase_rate)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [sale.id, item.medicine_id, batch.id, batch.batch_number, batch.expiry_date,
             deductQty, item.unit_price, item.discount_percent,
             (item.unit_price * deductQty) * (1 - item.discount_percent / 100), purchaseRate]
          );
        }
        remainingQty -= deductQty;
      }
    }

    await client.query('COMMIT');

    await createAuditLog({
      pharmacyId, userId: req.user.id, userName: req.user.name,
      action: 'Created Sale', module: 'Sales',
      entityType: 'sale', entityId: sale.id,
      newValues: { invoice_number: invoiceNumber, total_amount: totalAmount }, ipAddress: req.ip
    });

    res.status(201).json({ success: true, data: { ...sale, items: processedItems }, message: 'Sale created successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};

exports.cancelSale = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sale = await client.query(
      'SELECT * FROM sales WHERE id = $1 AND pharmacy_id = $2 AND status = $3',
      [req.params.id, req.user.pharmacy_id, 'completed']
    );
    if (!sale.rows[0]) return res.status(404).json({ success: false, message: 'Sale not found or already cancelled' });

    // Restore inventory
    const items = await client.query('SELECT * FROM sale_items WHERE sale_id = $1', [req.params.id]);
    for (const item of items.rows) {
      if (item.inventory_batch_id) {
        await client.query(
          'UPDATE inventory_batches SET available_quantity = available_quantity + $1 WHERE id = $2',
          [item.quantity, item.inventory_batch_id]
        );
      }
    }

    await client.query('UPDATE sales SET status = $1 WHERE id = $2', ['cancelled', req.params.id]);
    await client.query('COMMIT');
    res.json({ success: true, message: 'Sale cancelled and inventory restored' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacy_id;

    const [todaySales, monthSales, totalMedicines, lowStock, expiringCount, recentSales, recentPurchases] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(total_amount),0) as amount, COUNT(*) as count FROM sales WHERE pharmacy_id=$1 AND DATE(sale_date)=CURRENT_DATE AND status='completed'`, [pharmacyId]),
      pool.query(`SELECT COALESCE(SUM(total_amount),0) as amount FROM sales WHERE pharmacy_id=$1 AND DATE_TRUNC('month',sale_date)=DATE_TRUNC('month',NOW()) AND status='completed'`, [pharmacyId]),
      pool.query(`SELECT COUNT(*) FROM medicines WHERE pharmacy_id=$1 AND deleted_at IS NULL AND is_active=TRUE`, [pharmacyId]),
      pool.query(`SELECT COUNT(DISTINCT m.id) FROM medicines m
        WHERE m.pharmacy_id=$1 AND m.deleted_at IS NULL AND m.is_active=TRUE
        AND COALESCE((SELECT SUM(ib.available_quantity) FROM inventory_batches ib WHERE ib.medicine_id=m.id AND ib.is_damaged=FALSE AND (ib.expiry_date IS NULL OR ib.expiry_date>CURRENT_DATE)),0) <= m.min_stock_level`, [pharmacyId]),
      pool.query(`SELECT COUNT(*) FROM inventory_batches WHERE pharmacy_id=$1 AND is_damaged=FALSE AND available_quantity>0 AND expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'`, [pharmacyId]),
      pool.query(`SELECT s.*, u.name as cashier FROM sales s LEFT JOIN users u ON s.created_by=u.id WHERE s.pharmacy_id=$1 AND s.status='completed' ORDER BY s.sale_date DESC LIMIT 5`, [pharmacyId]),
      pool.query(`SELECT p.*, s.name as supplier_name FROM purchases p LEFT JOIN suppliers s ON p.supplier_id=s.id WHERE p.pharmacy_id=$1 AND p.deleted_at IS NULL ORDER BY p.created_at DESC LIMIT 5`, [pharmacyId]),
    ]);

    const inventoryValue = await pool.query(
      `SELECT COALESCE(SUM(ib.available_quantity * ib.purchase_rate),0) as value FROM inventory_batches ib WHERE ib.pharmacy_id=$1 AND ib.is_damaged=FALSE`,
      [pharmacyId]
    );

    res.json({
      success: true,
      data: {
        todaySalesAmount: parseFloat(todaySales.rows[0].amount),
        todaySalesCount: parseInt(todaySales.rows[0].count),
        monthSalesAmount: parseFloat(monthSales.rows[0].amount),
        totalMedicines: parseInt(totalMedicines.rows[0].count),
        lowStockCount: parseInt(lowStock.rows[0].count),
        expiringCount: parseInt(expiringCount.rows[0].count),
        inventoryValue: parseFloat(inventoryValue.rows[0].value),
        recentSales: recentSales.rows,
        recentPurchases: recentPurchases.rows
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};