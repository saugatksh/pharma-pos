# 🔐 Fix: "Invalid Credentials" Login Error

## Root Cause

The `seed.sql` file contains a **bcrypt hash that does not match** the password `SuperAdmin@123`. 
The hash was likely generated from a different password or is a placeholder that was never properly computed.

bcrypt hashes cannot be reverse-engineered — even the same password generates a different hash each time — so the hash must be **regenerated at runtime** using `bcryptjs`.

---

## ✅ Fix (Choose One)

### Option 1 — Fresh Setup (Recommended for new installs)

```bash
cd backend
cp .env.example .env
# Edit .env with your PostgreSQL credentials

npm install
npm run setup   # Runs schema + seed + fixes all password hashes
npm start
```

### Option 2 — Already Have the DB Running

If you already ran `schema.sql` and `seed.sql` manually:

```bash
cd backend
node fix-password.js
```

This updates **all 3 demo users** with the correct bcrypt hash for `SuperAdmin@123`.

### Option 3 — Direct SQL Fix

Run this in psql after the backend's bcrypt hash is known:

```bash
# First, get the correct hash from Node.js:
node -e "require('bcryptjs').hash('SuperAdmin@123', 12).then(h => console.log(h))"

# Then paste that hash into:
UPDATE users 
SET password_hash = '<paste-hash-here>'
WHERE email IN (
  'superadmin@pharmapos.com',
  'admin@demopharmacy.com',
  'staff@demopharmacy.com'
);
```

---

## 📋 Demo Accounts (after fix)

| Role       | Email                        | Password        |
|------------|------------------------------|-----------------|
| SuperAdmin | superadmin@pharmapos.com     | SuperAdmin@123  |
| Admin      | admin@demopharmacy.com       | SuperAdmin@123  |
| Staff      | staff@demopharmacy.com       | SuperAdmin@123  |

---

## Files Changed

| File | Change |
|------|--------|
| `backend/setup.js` | **NEW** — one-shot setup script (schema + seed + password fix) |
| `backend/fix-password.js` | **NEW** — standalone password fix script |
| `backend/config/seed.sql` | Updated with clear comment about placeholder hash |
| `backend/package.json` | Added `npm run setup` and `npm run fix-passwords` scripts |
