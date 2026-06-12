# PharmaPOS - Pharmacy Management System

A full-stack pharmacy POS system built with React, Node.js, and PostgreSQL.

## Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### 1. PostgreSQL Database

Create a database and run the schema:

```bash
psql -U postgres
CREATE DATABASE pharma_pos;
\q

psql -U postgres -d pharma_pos -f backend/config/schema.sql
psql -U postgres -d pharma_pos -f backend/config/seed.sql

```

### Backend
```bash
cd backend
copy .env.example .env
# Edit .env with your DB credentials
npm install
node setup.js
npm start
```

### Frontend
```bash
cd frontend
copy .env.example .env
npm install
npm start
```

## Default Credentials

| Role       | Username    | Password              |
|------------|-------------|-----------------------|
| SuperAdmin | superadmin  | superadmin@26@saugat  |

Login at: http://localhost:3000

## Roles

- **SuperAdmin** — Manages pharmacies and system-wide settings
- **Admin** — Full pharmacy management (sales, inventory, users, reports)
- **Staff** — POS sales and inventory view

## Features

- 🧾 POS with checkout confirmation
- 💊 Medicine & inventory management
- 📊 Reports & analytics
- 👥 Multi-pharmacy, multi-user support
- 🖨️ Professional pharmacy bills (printable)
- 🔐 Secure JWT authentication with username login
