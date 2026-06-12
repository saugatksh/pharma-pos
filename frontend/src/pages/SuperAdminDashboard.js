import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { StatCard, LoadingSpinner } from '../components/UI';
import toast from 'react-hot-toast';

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/superadmin/dashboard')
      .then(r => setStats(r.data.data))
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading dashboard..." />;

  const fmtDate = d => d ? new Date(d).toLocaleDateString() : '—';

  const expiryLabel = (expiresAt) => {
    if (!expiresAt) return <span className="text-xs dm-text-muted">—</span>;
    const daysLeft = Math.ceil((new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return <span className="text-xs font-medium text-red-600">Expired</span>;
    if (daysLeft <= 30) return <span className="text-xs font-medium text-yellow-600">{fmtDate(expiresAt)} ⚠️</span>;
    return <span className="text-xs text-green-700">{fmtDate(expiresAt)}</span>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold dm-text-primary">Super Admin Dashboard</h1>
        <p className="dm-text-muted text-sm mt-1">Platform overview — pharmacies, users, and subscriptions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard title="Total Pharmacies" value={stats?.totalPharmacies || 0} icon="🏥" color="blue" onClick={() => navigate('/pharmacies')} />
        <StatCard title="Active Pharmacies" value={stats?.activePharmacies || 0} icon="✅" color="green" />
        <StatCard title="Inactive Pharmacies" value={stats?.inactivePharmacies || 0} icon="⛔" color="red" />
        <StatCard title="Expiring Soon" value={stats?.subscriptionExpiringSoon || 0} icon="⚠️" color="yellow" />
        <StatCard title="Expired" value={stats?.subscriptionExpired || 0} icon="🔴" color="red" />
      </div>

      {/* Recent Pharmacies */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold dm-text-primary">Recently Added Pharmacies</h2>
          <button onClick={() => navigate('/pharmacies')} className="text-green-600 text-sm hover:underline">View All →</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b dm-border-card">
                {['Pharmacy', 'Email', 'Users', 'Registered', 'Expires', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold dm-text-muted uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y dm-border-card">
              {stats?.recentPharmacies?.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate('/pharmacies')}>
                  <td className="px-4 py-3 font-medium dm-text-primary">{p.name}</td>
                  <td className="px-4 py-3 dm-text-muted">{p.email || '—'}</td>
                  <td className="px-4 py-3 dm-text-muted">{p.user_count}</td>
                  <td className="px-4 py-3 dm-text-muted text-xs">{fmtDate(p.created_at)}</td>
                  <td className="px-4 py-3">{expiryLabel(p.subscription_expires_at)}</td>
                  <td className="px-4 py-3">
                    <span className={p.is_active ? 'badge-green' : 'badge-red'}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
              {!stats?.recentPharmacies?.length && (
                <tr><td colSpan={6} className="text-center py-8 dm-text-muted">No pharmacies yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: 'Manage Pharmacies', desc: 'Add, edit, suspend or delete pharmacies and manage subscriptions', icon: '🏥', path: '/pharmacies', color: 'border-blue-200 hover:border-blue-400' },
          { label: 'Platform Reports', desc: 'Pharmacy registrations, subscription status and platform usage', icon: '📊', path: '/platform-reports', color: 'border-green-200 hover:border-green-400' },
        ].map(a => (
          <button key={a.label} onClick={() => navigate(a.path)}
            className={`card text-left border-2 transition-all hover:shadow-md ${a.color}`}>
            <div className="text-3xl mb-3">{a.icon}</div>
            <div className="font-semibold dm-text-primary">{a.label}</div>
            <div className="text-sm dm-text-muted mt-1">{a.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}