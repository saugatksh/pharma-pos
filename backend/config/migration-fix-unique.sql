-- ============================================================
-- MIGRATION: Fix unique constraints to respect soft-delete
-- Run this once on your existing database.
-- ============================================================

-- 1. Drop the old global unique constraints on users
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;

-- 2. Drop the old plain indexes (will be replaced by partial ones)
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_username;

-- 3. Create partial unique indexes — only enforce uniqueness on active (non-deleted) rows
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_active
  ON users(email)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_active
  ON users(username)
  WHERE deleted_at IS NULL AND username IS NOT NULL;

-- Done. Deleted users no longer block re-registration of their email/username.