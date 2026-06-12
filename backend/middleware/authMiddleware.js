const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await pool.query(
      `SELECT u.*, r.name as role_name, r.permissions,
              p.is_active as pharmacy_is_active,
              p.subscription_expires_at
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN pharmacies p ON u.pharmacy_id = p.id
       WHERE u.id = $1 AND u.is_active = TRUE AND u.deleted_at IS NULL
         AND (u.pharmacy_id IS NULL OR p.deleted_at IS NULL)`,
      [decoded.userId]
    );

    if (!result.rows[0]) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }

    const user = result.rows[0];

    // Superadmin bypasses pharmacy checks
    if (user.role_name !== 'superadmin' && user.pharmacy_id) {
      // Block if pharmacy is inactive (manually suspended by superadmin)
      if (!user.pharmacy_is_active) {
        return res.status(403).json({
          success: false,
          code: 'PHARMACY_SUSPENDED',
          message: 'Your pharmacy service has been suspended. Please contact the Super Admin.'
        });
      }
      // Block if subscription has expired
      if (user.subscription_expires_at && new Date(user.subscription_expires_at) < new Date()) {
        return res.status(403).json({
          success: false,
          code: 'SUBSCRIPTION_EXPIRED',
          message: 'Your subscription has expired. Please contact the Super Admin to renew.'
        });
      }
    }

    req.user = user;
    req.user.permissions = user.permissions || {};
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    if (!allowedRoles.includes(req.user.role_name)) {
      return res.status(403).json({ success: false, message: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
};

const authorizePharmacy = (req, res, next) => {
  if (req.user.role_name === 'superadmin') return next();
  const pharmacyId = parseInt(req.params.pharmacyId || req.body.pharmacy_id || req.query.pharmacy_id);
  if (pharmacyId && pharmacyId !== req.user.pharmacy_id) {
    return res.status(403).json({ success: false, message: 'Access denied to this pharmacy' });
  }
  if (!req.params.pharmacyId) {
    req.pharmacyId = req.user.pharmacy_id;
  } else {
    req.pharmacyId = pharmacyId;
  }
  next();
};

module.exports = { authenticate, authorize, authorizePharmacy };