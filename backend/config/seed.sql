-- ============================================================
-- SEED DATA - Roles & Default SuperAdmin
-- ============================================================

-- Insert Roles
INSERT INTO roles (name, permissions) VALUES
('superadmin', '{
  "dashboard": ["view_all"],
  "pharmacies": ["create", "read", "update", "delete"],
  "users": ["create", "read", "update", "delete"],
  "reports": ["view_all"],
  "audit_logs": ["view_all"],
  "settings": ["read", "update"]
}'),
('admin', '{
  "dashboard": ["view"],
  "sales": ["create", "edit", "cancel", "view", "process_returns"],
  "purchases": ["create", "edit", "delete", "view"],
  "inventory": ["view", "adjust", "add_opening", "reconcile", "damage", "expired"],
  "medicines": ["create", "edit", "delete", "update_price"],
  "suppliers": ["create", "edit", "delete"],
  "reports": ["sales", "purchase", "profit", "inventory", "expiry"],
  "users": ["create", "update", "disable", "reset_password", "assign_roles"],
  "settings": ["read", "update"],
  "audit_logs": ["view"]
}'),
('staff', '{
  "dashboard": ["view_today_sales", "view_stock"],
  "sales": ["create", "print"],
  "inventory": ["view", "view_expiry"]
}')
ON CONFLICT (name) DO NOTHING;

-- Default SuperAdmin user only
-- NOTE: After running this seed, run `node fix-password.js` to set the correct bcrypt hash.
INSERT INTO users (pharmacy_id, role_id, name, username, email, password_hash, is_active)
SELECT NULL, r.id, 'Super Admin', 'superadmin', 'superadmin@pharma.com',
  '$2b$12$placeholder.hash.will.be.replaced.by.fix.password.script',
  TRUE
FROM roles r WHERE r.name = 'superadmin'
ON CONFLICT (email) DO NOTHING;
