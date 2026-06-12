import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { StatCard, LoadingSpinner, Badge } from '../components/UI';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const { user } = useAuth();
  const expiryDays = user?.pharmacySettings?.expiry_alert_days || 90;
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard')
      .then(r => setStats(r.data.data))
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading dashboard..." />;

  const cur = user?.pharmacyCurrency || 'NPR';
  const fmt = (n) => `${cur} ${new Intl.NumberFormat('en-NP').format(n || 0)}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold dm-text-primary">
            Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {user?.name?.split(' ')[0]}! 👋
          </h1>
          <p className="dm-text-muted text-sm mt-1">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        {user?.role === 'admin' && (
          <button onClick={() => navigate('/sales')} className="btn-primary flex items-center gap-2">
            🧾 New Sale
          </button>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Today's Sales"
          value={fmt(stats?.todaySalesAmount)}
          subtitle={`${stats?.todaySalesCount || 0} transactions`}
          icon="💰"
          color="green"
          onClick={() => navigate('/sales')}
        />
        <StatCard
          title="Month Sales"
          value={fmt(stats?.monthSalesAmount)}
          icon="📅"
          color="blue"
        />
        <StatCard
          title="Total Medicines"
          value={stats?.totalMedicines || 0}
          icon="💊"
          color="purple"
          onClick={() => navigate('/medicines')}
        />
        <StatCard
          title="Inventory Value"
          value={fmt(stats?.inventoryValue)}
          icon="📦"
          color="yellow"
          onClick={() => navigate('/inventory')}
        />
      </div>

      {/* Alerts Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div
          className={`card border-l-4 cursor-pointer hover:shadow-md transition-shadow ${
            stats?.lowStockCount > 0 ? 'border-l-yellow-500' : 'border-l-green-500'
          }`}
          onClick={() => navigate('/inventory?filter=low_stock')}
        >
          <div className="flex items-center gap-4">
            <span className="text-3xl">⚠️</span>
            <div>
              <div className="text-2xl font-bold dm-text-primary">{stats?.lowStockCount || 0}</div>
              <div className="text-sm dm-text-muted">Low Stock Medicines</div>
            </div>
          </div>
        </div>
        <div
          className={`card border-l-4 cursor-pointer hover:shadow-md transition-shadow ${
            stats?.expiringCount > 0 ? 'border-l-red-500' : 'border-l-green-500'
          }`}
          onClick={() => navigate('/inventory?tab=expiry')}
        >
          <div className="flex items-center gap-4">
            <span className="text-3xl">🗓️</span>
            <div>
              <div className="text-2xl font-bold dm-text-primary">{stats?.expiringCount || 0}</div>
              <div className="text-sm dm-text-muted">Expiring in {expiryDays} Days</div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Sales */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold dm-text-primary">Recent Sales</h2>
            <button onClick={() => navigate('/sales')} className="text-green-600 text-sm hover:underline">View All →</button>
          </div>
          <div className="space-y-2">
            {stats?.recentSales?.length === 0 && (
              <p className="text-center py-6 dm-text-muted text-sm">No sales today</p>
            )}
            {stats?.recentSales?.map(s => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <div className="text-sm font-medium dm-text-primary">{s.invoice_number}</div>
                  <div className="text-xs dm-text-muted">{s.cashier} · {new Date(s.sale_date).toLocaleTimeString()}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold dm-text-primary">{fmt(s.total_amount)}</div>
                  <Badge type={s.payment_method === 'cash' ? 'green' : s.payment_method === 'card' ? 'blue' : 'purple'}>
                    {s.payment_method}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Purchases */}
        {user?.role === 'admin' && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold dm-text-primary">Recent Purchases</h2>
              <button onClick={() => navigate('/purchases')} className="text-green-600 text-sm hover:underline">View All →</button>
            </div>
            <div className="space-y-2">
              {stats?.recentPurchases?.length === 0 && (
                <p className="text-center py-6 dm-text-muted text-sm">No recent purchases</p>
              )}
              {stats?.recentPurchases?.map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <div className="text-sm font-medium dm-text-primary">{p.purchase_number}</div>
                    <div className="text-xs dm-text-muted">{p.supplier_name || 'N/A'} · {new Date(p.purchase_date).toLocaleDateString()}</div>
                  </div>
                  <div className="text-sm font-semibold dm-text-primary">{fmt(p.total_amount)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}