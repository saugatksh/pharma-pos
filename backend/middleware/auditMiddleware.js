const pool = require('../config/db');

const createAuditLog = async ({ pharmacyId, userId, userName, action, module, entityType, entityId, oldValues, newValues, ipAddress }) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs (pharmacy_id, user_id, user_name, action, module, entity_type, entity_id, old_values, new_values, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [pharmacyId, userId, userName, action, module, entityType, entityId,
       oldValues ? JSON.stringify(oldValues) : null,
       newValues ? JSON.stringify(newValues) : null,
       ipAddress]
    );
  } catch (error) {
    console.error('Audit log error:', error);
  }
};

module.exports = { createAuditLog };
