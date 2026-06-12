import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';

// Pages
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import MedicinesPage from './pages/MedicinesPage';
import SuppliersPage from './pages/SuppliersPage';
import PurchasesPage from './pages/PurchasesPage';
import InventoryPage from './pages/InventoryPage';
import SalesPage from './pages/SalesPage';
import ReturnsPage from './pages/ReturnsPage';
import ReportsPage from './pages/ReportsPage';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';
import PharmaciesPage from './pages/PharmaciesPage';
import AuditLogsPage from './pages/AuditLogsPage';
import PlatformReportsPage from './pages/PlatformReportsPage';

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
};

const DashboardRouter = () => {
  const { user } = useAuth();
  if (user?.role === 'superadmin') return <SuperAdminDashboard />;
  return <AdminDashboard />;
};

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<DashboardRouter />} />
        <Route path="pharmacies" element={<ProtectedRoute roles={['superadmin']}><PharmaciesPage /></ProtectedRoute>} />
        <Route path="audit-logs-sa" element={<ProtectedRoute roles={['superadmin']}><AuditLogsPage superAdmin /></ProtectedRoute>} />
        <Route path="platform-reports" element={<ProtectedRoute roles={['superadmin']}><PlatformReportsPage /></ProtectedRoute>} />
        <Route path="medicines" element={<ProtectedRoute roles={['admin', 'staff']}><MedicinesPage /></ProtectedRoute>} />
        <Route path="suppliers" element={<ProtectedRoute roles={['admin']}><SuppliersPage /></ProtectedRoute>} />
        <Route path="purchases" element={<ProtectedRoute roles={['admin']}><PurchasesPage /></ProtectedRoute>} />
        <Route path="inventory" element={<ProtectedRoute roles={['admin', 'staff']}><InventoryPage /></ProtectedRoute>} />
        <Route path="sales" element={<ProtectedRoute roles={['admin', 'staff']}><SalesPage /></ProtectedRoute>} />
        <Route path="returns" element={<ProtectedRoute roles={['admin']}><ReturnsPage /></ProtectedRoute>} />
        <Route path="reports" element={<ProtectedRoute roles={['admin']}><ReportsPage /></ProtectedRoute>} />
        <Route path="users" element={<ProtectedRoute roles={['admin']}><UsersPage /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute roles={['admin']}><SettingsPage /></ProtectedRoute>} />
        <Route path="audit-logs" element={<ProtectedRoute roles={['admin']}><AuditLogsPage /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster position="top-right" toastOptions={{ duration: 3000, style: { borderRadius: '10px', background: '#333', color: '#fff' } }} />
      </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
  );
}
