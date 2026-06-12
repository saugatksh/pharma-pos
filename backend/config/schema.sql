-- ============================================================
-- PHARMA POS - Complete Database Schema
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ROLES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  permissions JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PHARMACIES TABLE (for SuperAdmin multi-pharmacy management)
-- ============================================================
CREATE TABLE IF NOT EXISTS pharmacies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  license_number VARCHAR(100),
  tax_number VARCHAR(100),
  logo_url TEXT,
  invoice_prefix VARCHAR(20) DEFAULT 'INV',
  invoice_counter INTEGER DEFAULT 1,
  tax_rate DECIMAL(5,2) DEFAULT 0.00,
  currency VARCHAR(10) DEFAULT 'NPR',
  is_active BOOLEAN DEFAULT TRUE,
  subscription_plan VARCHAR(50) DEFAULT 'standard',
  subscription_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  pharmacy_id INTEGER REFERENCES pharmacies(id),
  role_id INTEGER REFERENCES roles(id),
  name VARCHAR(255) NOT NULL,
  username VARCHAR(100),
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMPTZ,
  refresh_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_pharmacy ON users(pharmacy_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_active ON users(email) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_active ON users(username) WHERE deleted_at IS NULL AND username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);

-- ============================================================
-- SUPPLIERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  pharmacy_id INTEGER NOT NULL REFERENCES pharmacies(id),
  name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_suppliers_pharmacy ON suppliers(pharmacy_id);

-- ============================================================
-- MEDICINE CATEGORIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS medicine_categories (
  id SERIAL PRIMARY KEY,
  pharmacy_id INTEGER NOT NULL REFERENCES pharmacies(id),
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MEDICINES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS medicines (
  id SERIAL PRIMARY KEY,
  pharmacy_id INTEGER NOT NULL REFERENCES pharmacies(id),
  category_id INTEGER REFERENCES medicine_categories(id),
  name VARCHAR(255) NOT NULL,
  generic_name VARCHAR(255),
  brand_name VARCHAR(255),
  unit VARCHAR(50) NOT NULL DEFAULT 'Tablet',
  description TEXT,
  purchase_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  selling_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  min_stock_level INTEGER DEFAULT 10,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_medicines_pharmacy ON medicines(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name);

-- ============================================================
-- PURCHASES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS purchases (
  id SERIAL PRIMARY KEY,
  pharmacy_id INTEGER NOT NULL REFERENCES pharmacies(id),
  supplier_id INTEGER REFERENCES suppliers(id),
  created_by INTEGER REFERENCES users(id),
  purchase_number VARCHAR(50) NOT NULL,
  invoice_number VARCHAR(100),
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount DECIMAL(10,2) DEFAULT 0.00,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('draft', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_purchases_pharmacy ON purchases(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date);

-- ============================================================
-- PURCHASE ITEMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_items (
  id SERIAL PRIMARY KEY,
  purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  medicine_id INTEGER NOT NULL REFERENCES medicines(id),
  batch_number VARCHAR(100),
  expiry_date DATE,
  quantity INTEGER NOT NULL,
  purchase_rate DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(10,2) GENERATED ALWAYS AS (quantity * purchase_rate) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_medicine ON purchase_items(medicine_id);

-- ============================================================
-- INVENTORY BATCHES TABLE (FEFO tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_batches (
  id SERIAL PRIMARY KEY,
  pharmacy_id INTEGER NOT NULL REFERENCES pharmacies(id),
  medicine_id INTEGER NOT NULL REFERENCES medicines(id),
  purchase_item_id INTEGER REFERENCES purchase_items(id),
  batch_number VARCHAR(100),
  expiry_date DATE,
  initial_quantity INTEGER NOT NULL DEFAULT 0,
  available_quantity INTEGER NOT NULL DEFAULT 0,
  purchase_rate DECIMAL(10,2) DEFAULT 0.00,
  is_damaged BOOLEAN DEFAULT FALSE,
  damage_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_pharmacy ON inventory_batches(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_inventory_medicine ON inventory_batches(medicine_id);
CREATE INDEX IF NOT EXISTS idx_inventory_expiry ON inventory_batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_inventory_batch ON inventory_batches(batch_number);

-- ============================================================
-- SALES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  pharmacy_id INTEGER NOT NULL REFERENCES pharmacies(id),
  created_by INTEGER REFERENCES users(id),
  invoice_number VARCHAR(50) NOT NULL,
  sale_date TIMESTAMPTZ DEFAULT NOW(),
  customer_name VARCHAR(255),
  customer_phone VARCHAR(50),
  subtotal DECIMAL(10,2) DEFAULT 0.00,
  discount_amount DECIMAL(10,2) DEFAULT 0.00,
  discount_percent DECIMAL(5,2) DEFAULT 0.00,
  tax_amount DECIMAL(10,2) DEFAULT 0.00,
  total_amount DECIMAL(10,2) DEFAULT 0.00,
  amount_paid DECIMAL(10,2) DEFAULT 0.00,
  change_amount DECIMAL(10,2) DEFAULT 0.00,
  payment_method VARCHAR(20) DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'qr')),
  status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled', 'returned')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_pharmacy ON sales(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice_number);

-- ============================================================
-- SALE ITEMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS sale_items (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  medicine_id INTEGER NOT NULL REFERENCES medicines(id),
  inventory_batch_id INTEGER REFERENCES inventory_batches(id),
  batch_number VARCHAR(100),
  expiry_date DATE,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  discount_percent DECIMAL(5,2) DEFAULT 0.00,
  total_amount DECIMAL(10,2) NOT NULL,
  purchase_rate DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_medicine ON sale_items(medicine_id);

-- ============================================================
-- CUSTOMER RETURNS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_returns (
  id SERIAL PRIMARY KEY,
  pharmacy_id INTEGER NOT NULL REFERENCES pharmacies(id),
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  created_by INTEGER REFERENCES users(id),
  return_number VARCHAR(50) NOT NULL,
  return_date TIMESTAMPTZ DEFAULT NOW(),
  total_refund DECIMAL(10,2) DEFAULT 0.00,
  reason TEXT,
  status VARCHAR(20) DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CUSTOMER RETURN ITEMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_return_items (
  id SERIAL PRIMARY KEY,
  customer_return_id INTEGER NOT NULL REFERENCES customer_returns(id) ON DELETE CASCADE,
  sale_item_id INTEGER REFERENCES sale_items(id),
  medicine_id INTEGER NOT NULL REFERENCES medicines(id),
  inventory_batch_id INTEGER REFERENCES inventory_batches(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  refund_amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SUPPLIER RETURNS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS supplier_returns (
  id SERIAL PRIMARY KEY,
  pharmacy_id INTEGER NOT NULL REFERENCES pharmacies(id),
  supplier_id INTEGER REFERENCES suppliers(id),
  created_by INTEGER REFERENCES users(id),
  return_number VARCHAR(50) NOT NULL,
  return_date DATE DEFAULT CURRENT_DATE,
  total_amount DECIMAL(10,2) DEFAULT 0.00,
  reason VARCHAR(50) CHECK (reason IN ('damaged', 'expired', 'other')),
  notes TEXT,
  status VARCHAR(20) DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SUPPLIER RETURN ITEMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS supplier_return_items (
  id SERIAL PRIMARY KEY,
  supplier_return_id INTEGER NOT NULL REFERENCES supplier_returns(id) ON DELETE CASCADE,
  medicine_id INTEGER NOT NULL REFERENCES medicines(id),
  inventory_batch_id INTEGER REFERENCES inventory_batches(id),
  batch_number VARCHAR(100),
  quantity INTEGER NOT NULL,
  purchase_rate DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STOCK ADJUSTMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id SERIAL PRIMARY KEY,
  pharmacy_id INTEGER NOT NULL REFERENCES pharmacies(id),
  medicine_id INTEGER NOT NULL REFERENCES medicines(id),
  inventory_batch_id INTEGER REFERENCES inventory_batches(id),
  created_by INTEGER REFERENCES users(id),
  adjustment_type VARCHAR(20) NOT NULL CHECK (adjustment_type IN ('add', 'remove', 'damage', 'reconcile', 'opening')),
  quantity INTEGER NOT NULL,
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_adj_pharmacy ON stock_adjustments(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_stock_adj_medicine ON stock_adjustments(medicine_id);

-- ============================================================
-- AUDIT LOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  pharmacy_id INTEGER REFERENCES pharmacies(id),
  user_id INTEGER REFERENCES users(id),
  user_name VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  module VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id INTEGER,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_pharmacy ON audit_logs(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

-- ============================================================
-- SETTINGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  pharmacy_id INTEGER NOT NULL REFERENCES pharmacies(id) UNIQUE,
  invoice_footer TEXT,
  invoice_terms TEXT,
  low_stock_threshold INTEGER DEFAULT 10,
  expiry_alert_days INTEGER DEFAULT 90,
  allow_negative_stock BOOLEAN DEFAULT FALSE,
  require_batch_number BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_medicines_updated_at BEFORE UPDATE ON medicines
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_purchases_updated_at BEFORE UPDATE ON purchases
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_sales_updated_at BEFORE UPDATE ON sales
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_pharmacies_updated_at BEFORE UPDATE ON pharmacies
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();