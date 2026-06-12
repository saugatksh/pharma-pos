const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Support both export styles: module.exports = { createAuditLog } or module.exports = createAuditLog
const auditModule = require('../middleware/auditMiddleware');
const createAuditLog = typeof auditModule === 'function'
  ? auditModule
  : (typeof auditModule.createAuditLog === 'function' ? auditModule.createAuditLog : async () => {});

const generateTokens = (userId, role) => {
  const accessToken = jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '15m' }
  );
  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
  );
  return { accessToken, refreshToken };
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    const result = await pool.query(
      `SELECT u.*, r.name as role_name, r.permissions,
              p.name as pharmacy_name, p.logo_url as pharmacy_logo,
              p.currency as pharmacy_currency,
              p.is_active as pharmacy_is_active,
              p.subscription_expires_at
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN pharmacies p ON u.pharmacy_id = p.id
       WHERE (LOWER(u.username) = LOWER($1) OR LOWER(u.email) = LOWER($1))
         AND u.deleted_at IS NULL
         AND (u.pharmacy_id IS NULL OR p.deleted_at IS NULL)`,
      [username]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    if (!user.is_active) {
      return res.status(401).json({ success: false, message: 'Account is disabled. Contact administrator.' });
    }
    // Block if pharmacy deleted
    if (user.pharmacy_id && !user.pharmacy_name) {
      return res.status(401).json({ success: false, message: 'This pharmacy account has been removed.' });
    }
    // Block if pharmacy suspended (inactive) — superadmin exempt
    if (user.role_name !== 'superadmin' && user.pharmacy_id && !user.pharmacy_is_active) {
      return res.status(403).json({
        success: false,
        code: 'PHARMACY_SUSPENDED',
        message: 'Your pharmacy service has been suspended. Please contact the Super Admin.'
      });
    }
    // Block if subscription expired — superadmin exempt
    if (user.role_name !== 'superadmin' && user.subscription_expires_at && new Date(user.subscription_expires_at) < new Date()) {
      return res.status(403).json({
        success: false,
        code: 'SUBSCRIPTION_EXPIRED',
        message: 'Your subscription has expired. Please contact the Super Admin to renew.'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.role_name);
    await pool.query('UPDATE users SET refresh_token = $1, last_login = NOW() WHERE id = $2', [refreshToken, user.id]);

    await createAuditLog({
      pharmacyId: user.pharmacy_id,
      userId: user.id,
      userName: user.name,
      action: 'Login',
      module: 'Auth',
      ipAddress: req.ip
    });

    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role_name,
        permissions: user.permissions,
        pharmacyId: user.pharmacy_id,
        pharmacyName: user.pharmacy_name,
        pharmacyLogo: user.pharmacy_logo,
        pharmacyCurrency: user.pharmacy_currency || 'NPR'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const result = await pool.query(
      `SELECT u.*, r.name as role_name,
              p.is_active as pharmacy_is_active, p.subscription_expires_at
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN pharmacies p ON u.pharmacy_id = p.id
       WHERE u.id = $1 AND u.refresh_token = $2 AND u.is_active = TRUE AND u.deleted_at IS NULL
         AND (u.pharmacy_id IS NULL OR p.deleted_at IS NULL)`,
      [decoded.userId, refreshToken]
    );

    if (!result.rows[0]) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    const user = result.rows[0];

    // Also block token refresh if pharmacy is now suspended/expired
    if (user.role_name !== 'superadmin' && user.pharmacy_id) {
      if (!user.pharmacy_is_active) {
        return res.status(403).json({ success: false, code: 'PHARMACY_SUSPENDED', message: 'Your pharmacy service has been suspended. Please contact the Super Admin.' });
      }
      if (user.subscription_expires_at && new Date(user.subscription_expires_at) < new Date()) {
        return res.status(403).json({ success: false, code: 'SUBSCRIPTION_EXPIRED', message: 'Your subscription has expired. Please contact the Super Admin to renew.' });
      }
    }

    const tokens = generateTokens(user.id, user.role_name);
    await pool.query('UPDATE users SET refresh_token = $1 WHERE id = $2', [tokens.refreshToken, user.id]);

    res.json({ success: true, ...tokens });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
};

exports.logout = async (req, res) => {
  try {
    await pool.query('UPDATE users SET refresh_token = NULL WHERE id = $1', [req.user.id]);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getMe = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.username, u.email, u.phone, u.pharmacy_id, u.last_login,
              r.name as role, r.permissions,
              p.name as pharmacy_name, p.logo_url, p.currency
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN pharmacies p ON u.pharmacy_id = p.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const isMatch = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }
    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = $1, refresh_token = NULL WHERE id = $2', [hash, req.user.id]);
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};