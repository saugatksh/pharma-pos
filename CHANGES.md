# PharmaPOS — Update Changelog

## All Changes Made

### 1. 🌙 Dark Mode / Light Mode Toggle
- Added `ThemeContext.js` — persists preference in localStorage
- Toggle button in **sidebar** (bottom) and **header** (top-right, mobile-friendly)
- All pages use CSS variables (`--bg-card`, `--text-primary`, etc.) for theming
- `dm-*` utility classes applied across all components: cards, tables, modals, inputs, badges
- Dark sidebar stays dark in both modes (as it should)
- Tailwind `darkMode: 'class'` already enabled in config ✓

### 2. 📐 Collapsible / Expandable Sidebar
- **Desktop**: Collapse/Expand toggle button at the bottom of the sidebar
  - Collapsed → icon-only `68px` sidebar with **hover tooltips** showing label
  - Expanded → full `256px` sidebar with icons + labels
  - Smooth CSS transition (`cubic-bezier`)
- **Mobile**: Slide-in overlay sidebar (unchanged behavior)
- All nav items perfectly aligned in both states
- Role badge, pharmacy name, and user name hidden when collapsed

### 3. 🖨️ Print Bill Fix
- Replaced `window.print()` (which printed the whole page) with a **dedicated print window**
- Opens a new popup with isolated HTML + print-optimized CSS
- `@page { size: 80mm auto; margin: 0; }` for thermal/receipt printers
- Header with pharmacy name never gets cut off — uses clean `bill-pharmacy-name` class
- Pharmacy icon hidden on print (saves space)
- Works on A4, A5, thermal 80mm, and 58mm paper sizes

### 4. 📋 Sales History — Full Receipt Modal
- Clicking "Receipt →" now opens a **full scrollable modal** (not cropped)
- Modal has `max-h-[70vh]` scrollable body with fixed header and action footer
- Receipt content is always fully visible regardless of screen size
- Loading state while fetching receipt data

### 5. 🔄 Returns — Customer & Supplier Returns Visible
- Customer Returns tab now shows a proper table with: Return #, Invoice #, Date, Items Returned, Refund Amount, Reason, Status
- Supplier Returns tab now fetches `/returns/supplier` endpoint and displays returns table (graceful fallback if endpoint not implemented)
- **Summary cards** at the top showing total refund amounts for both types
- Tab badges showing count of returns for each type
- Cleaner modal UX for both return types

### 6. 💊 Demo Medicine CSV + Upload
- **Download Demo CSV** button: exports 50 pre-populated medicines with all fields
  - Medicines cover: Analgesics, Antibiotics, Antidiabetics, Antihypertensives, Vitamins, Respiratory, Dermatology, Antifungals, and more
  - CSV columns: `name, generic_name, brand_name, category, unit, purchase_price, selling_price, min_stock_level, description`
- **Upload CSV** button: parses uploaded CSV, shows a preview modal
  - Preview table shows first 20 rows with validation highlights (missing name/price shown in red)
  - Progress bar during import with per-item error tracking
  - Success/error summary toast after import
- Info banner explaining the workflow

## Files Changed
- `frontend/src/context/ThemeContext.js` — NEW
- `frontend/src/index.css` — CSS variables, dark mode, print fix
- `frontend/src/App.js` — ThemeProvider wrapper
- `frontend/src/components/Layout.js` — Sidebar collapse, dark mode toggle
- `frontend/src/components/UI.js` — Dark mode for all shared components
- `frontend/src/pages/SalesPage.js` — Full receipt modal, print fix
- `frontend/src/pages/ReturnsPage.js` — Supplier returns list, summary cards
- `frontend/src/pages/MedicinesPage.js` — CSV download/upload, 50 demo medicines
- All other pages — dark mode `dm-*` class patches
