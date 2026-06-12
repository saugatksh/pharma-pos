import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { LoadingSpinner } from '../components/UI';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import toast from 'react-hot-toast';

const COLORS = ['#16a34a', '#2563eb', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];

export default function PlatformReportsPage() {
  const [stats, setStats] = useState(null);
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/superadmin/dashboard'),
      api.get('/superadmin/pharmacies?limit=100'),
    ])
      .then(([statsRes, pharmRes]) => {
        setStats(statsRes.data.data);
        setPharmacies(pharmRes.data.data || []);
      })
      .catch(() => toast.error('Failed to load platform reports'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading platform reports..." />;

  // Build monthly registrations from pharmacies list
  const monthMap = {};
  pharmacies.forEach(p => {
    const month = new Date(p.created_at).toLocaleString('en-US', { year: 'numeric', month: 'short' });
    monthMap[month] = (monthMap[month] || 0) + 1;
  });
  const registrationData = Object.entries(monthMap)
    .sort((a, b) => new Date(a[0]) - new Date(b[0]))
    .slice(-12)
    .map(([month, count]) => ({ month, count }));

  // Subscription status pie
  const subscriptionData = [
    { name: 'Active', value: stats?.activePharmacies || 0 },
    { name: 'Inactive', value: stats?.inactivePharmacies || 0 },
    { name: 'Expiring Soon', value: stats?.subscriptionExpiringSoon || 0 },
    { name: 'Expired', value: stats?.subscriptionExpired || 0 },
  ].filter(d => d.value > 0);

  // Plan breakdown
  const planData = (stats?.planBreakdown || []).map(p => ({
    name: p.plan === 'none' ? 'No Plan' : p.plan,
    count: parseInt(p.count),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold dm-text-primary">Platform Reports</h1>
        <p className="dm-text-muted text-sm mt-1">Pharmacy registrations, subscription health, and platform usage overview</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Pharmacies', value: stats?.totalPharmacies || 0, icon: '🏥', color: 'text-blue-700' },
          { label: 'Active', value: stats?.activePharmacies || 0, icon: '✅', color: 'text-green-700' },
          { label: 'Total Users', value: stats?.totalUsers || 0, icon: '👥', color: 'text-purple-700' },
          { label: 'Subscriptions Expiring (30d)', value: stats?.subscriptionExpiringSoon || 0, icon: '⚠️', color: 'text-yellow-700' },
        ].map(s => (
          <div key={s.label} className="card">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-sm dm-text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly registrations */}
        <div className="card">
          <h3 className="text-base font-semibold dm-text-primary mb-4">Pharmacy Registrations (Last 12 Months)</h3>
          {registrationData.length === 0 ? (
            <div className="text-center py-12 dm-text-muted">No data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={registrationData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Registrations" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Subscription status pie */}
        <div className="card">
          <h3 className="text-base font-semibold dm-text-primary mb-4">Subscription Status</h3>
          {subscriptionData.length === 0 ? (
            <div className="text-center py-12 dm-text-muted">No data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={subscriptionData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                  {subscriptionData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Plan breakdown */}
      {planData.length > 0 && (
        <div className="card">
          <h3 className="text-base font-semibold dm-text-primary mb-4">Pharmacies by Subscription Plan</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={planData} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
              <Tooltip />
              <Bar dataKey="count" name="Pharmacies" fill="#16a34a" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* All pharmacies table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b dm-border-card">
          <h3 className="font-semibold dm-text-primary">All Pharmacies</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Pharmacy', 'Email', 'Phone', 'Users', 'Plan', 'Expires', 'Status', 'Registered'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold dm-text-muted uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y dm-border-card">
              {pharmacies.map(p => {
                const isExpired = p.subscription_expires_at && new Date(p.subscription_expires_at) < new Date();
                const isExpiringSoon = !isExpired && p.subscription_expires_at &&
                  (new Date(p.subscription_expires_at) - new Date()) < 30 * 24 * 60 * 60 * 1000;
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium dm-text-primary">{p.name}</td>
                    <td className="px-4 py-3 dm-text-muted text-xs">{p.email || '—'}</td>
                    <td className="px-4 py-3 dm-text-muted text-xs">{p.phone || '—'}</td>
                    <td className="px-4 py-3 dm-text-muted">{p.user_count || 0}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-blue-50 text-blue-700 rounded px-2 py-0.5 capitalize">
                        {p.subscription_plan || 'None'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {p.subscription_expires_at ? (
                        <span className={isExpired ? 'text-red-600 font-semibold' : isExpiringSoon ? 'text-yellow-600 font-semibold' : 'dm-text-muted'}>
                          {new Date(p.subscription_expires_at).toLocaleDateString()}
                          {isExpired && ' (Expired)'}
                          {isExpiringSoon && ' (Soon)'}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={p.is_active ? 'badge-green' : 'badge-red'}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 dm-text-muted text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
                  </tr>
                );
              })}
              {pharmacies.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 dm-text-muted">No pharmacies found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
