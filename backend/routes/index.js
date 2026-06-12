const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');

// Controllers
const authCtrl = require('../controllers/authController');
const superAdminCtrl = require('../controllers/superAdminController');
const medicineCtrl = require('../controllers/medicineController');
const purchaseCtrl = require('../controllers/purchaseController');
const salesCtrl = require('../controllers/salesController');
const inventoryCtrl = require('../controllers/inventoryController');
const pharmacyCtrl = require('../controllers/pharmacyController');

// ============================================================
// AUTH ROUTES
// ============================================================
router.post('/auth/login', authCtrl.login);
router.post('/auth/refresh', authCtrl.refresh);
router.post('/auth/logout', authenticate, authCtrl.logout);
router.get('/auth/me', authenticate, authCtrl.getMe);
router.put('/auth/change-password', authenticate, authCtrl.changePassword);

// ============================================================
// SUPER ADMIN ROUTES
// ============================================================
router.get('/superadmin/dashboard', authenticate, authorize('superadmin'), superAdminCtrl.getDashboardStats);
router.get('/superadmin/pharmacies', authenticate, authorize('superadmin'), superAdminCtrl.getAllPharmacies);
router.post('/superadmin/pharmacies', authenticate, authorize('superadmin'), superAdminCtrl.createPharmacy);
router.get('/superadmin/pharmacies/:id', authenticate, authorize('superadmin'), superAdminCtrl.getPharmacy);
router.put('/superadmin/pharmacies/:id', authenticate, authorize('superadmin'), superAdminCtrl.updatePharmacy);
router.delete('/superadmin/pharmacies/:id', authenticate, authorize('superadmin'), superAdminCtrl.deletePharmacy);
router.post('/superadmin/pharmacies/:id/renew', authenticate, authorize('superadmin'), superAdminCtrl.renewPharmacy);
router.get('/superadmin/users', authenticate, authorize('superadmin'), superAdminCtrl.getAllUsers);
router.get('/superadmin/audit-logs', authenticate, authorize('superadmin'), superAdminCtrl.getAuditLogs);

// ============================================================
// DASHBOARD
// ============================================================
router.get('/dashboard', authenticate, authorize('admin', 'staff'), salesCtrl.getDashboardStats);

// ============================================================
// MEDICINE ROUTES
// ============================================================
router.get('/medicines/search', authenticate, medicineCtrl.searchMedicines);
router.get('/medicines/categories', authenticate, medicineCtrl.getCategories);
router.get('/medicines', authenticate, medicineCtrl.getMedicines);
router.post('/medicines', authenticate, authorize('admin'), medicineCtrl.createMedicine);
router.get('/medicines/:id', authenticate, medicineCtrl.getMedicine);
router.put('/medicines/:id', authenticate, authorize('admin'), medicineCtrl.updateMedicine);
router.delete('/medicines/:id', authenticate, authorize('admin'), medicineCtrl.deleteMedicine);

// ============================================================
// SUPPLIER ROUTES
// ============================================================
router.get('/suppliers', authenticate, authorize('admin'), pharmacyCtrl.getSuppliers);
router.post('/suppliers', authenticate, authorize('admin'), pharmacyCtrl.createSupplier);
router.put('/suppliers/:id', authenticate, authorize('admin'), pharmacyCtrl.updateSupplier);
router.delete('/suppliers/:id', authenticate, authorize('admin'), pharmacyCtrl.deleteSupplier);
router.get('/suppliers/:id/purchases', authenticate, authorize('admin'), pharmacyCtrl.getSupplierPurchaseHistory);
router.get('/suppliers/:id/returns', authenticate, authorize('admin'), pharmacyCtrl.getSupplierReturnHistory);

// ============================================================
// PURCHASE ROUTES
// ============================================================
router.get('/purchases', authenticate, authorize('admin'), purchaseCtrl.getPurchases);
router.post('/purchases', authenticate, authorize('admin'), purchaseCtrl.createPurchase);
router.get('/purchases/:id', authenticate, authorize('admin'), purchaseCtrl.getPurchase);
router.delete('/purchases/:id', authenticate, authorize('admin'), purchaseCtrl.deletePurchase);

// ============================================================
// INVENTORY ROUTES
// ============================================================
router.get('/inventory', authenticate, inventoryCtrl.getInventory);
router.get('/inventory/expiry-alerts', authenticate, inventoryCtrl.getExpiryAlerts);
router.get('/inventory/batches/:medicineId', authenticate, inventoryCtrl.getBatches);
router.post('/inventory/adjust', authenticate, authorize('admin'), inventoryCtrl.adjustStock);

// ============================================================
// SALES ROUTES
// ============================================================
router.get('/sales', authenticate, salesCtrl.getSales);
router.post('/sales', authenticate, authorize('admin', 'staff'), salesCtrl.createSale);
router.get('/sales/:id', authenticate, salesCtrl.getSale);
router.put('/sales/:id/cancel', authenticate, authorize('admin'), salesCtrl.cancelSale);

// ============================================================
// RETURNS ROUTES
// ============================================================
router.get('/returns/customer', authenticate, authorize('admin', 'staff'), pharmacyCtrl.getCustomerReturns);
router.get('/returns/customer/:id', authenticate, authorize('admin', 'staff'), pharmacyCtrl.getCustomerReturn);
router.post('/returns/customer', authenticate, authorize('admin', 'staff'), pharmacyCtrl.createCustomerReturn);
router.get('/returns/supplier', authenticate, authorize('admin', 'staff'), pharmacyCtrl.getSupplierReturns);
router.get('/returns/supplier/:id', authenticate, authorize('admin', 'staff'), pharmacyCtrl.getSupplierReturn);
router.post('/returns/supplier', authenticate, authorize('admin', 'staff'), pharmacyCtrl.createSupplierReturn);

// ============================================================
// REPORTS ROUTES (Admin only)
// ============================================================
router.get('/reports/sales', authenticate, authorize('admin'), pharmacyCtrl.getSalesReport);
router.get('/reports/payment-breakdown', authenticate, authorize('admin'), pharmacyCtrl.getPaymentBreakdown);
router.get('/reports/profit', authenticate, authorize('admin'), pharmacyCtrl.getProfitReport);
router.get('/reports/audit-logs', authenticate, authorize('admin'), pharmacyCtrl.getAuditLogs);

// ============================================================
// SETTINGS ROUTES
// ============================================================
router.get('/settings', authenticate, authorize('admin'), pharmacyCtrl.getSettings);
router.put('/settings', authenticate, authorize('admin'), pharmacyCtrl.updateSettings);

// ============================================================
// USER MANAGEMENT ROUTES (Admin)
// ============================================================
router.get('/users', authenticate, authorize('admin'), pharmacyCtrl.getUsers);
router.post('/users', authenticate, authorize('admin'), pharmacyCtrl.createUser);
router.put('/users/:id', authenticate, authorize('admin'), pharmacyCtrl.updateUser);
router.put('/users/:id/reset-password', authenticate, authorize('admin'), pharmacyCtrl.resetPassword);

module.exports = router;