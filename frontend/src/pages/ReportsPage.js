import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { LoadingSpinner } from '../components/UI';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import toast from 'react-hot-toast';

export default function ReportsPage() {
  const { user } = useAuth();
  const cur = user?.pharmacyCurrency || 'NPR';
  const [activeTab, setActiveTab] = useState('sales');
  const [salesData, setSalesData] = useState([]);
  const [profitData, setProfitData] = useState([]);
  const [profitSummary, setProfitSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState([]);
  const [fromDate, setFromDate] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; });
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchSalesReport = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/reports/sales?from_date=${fromDate}&to_date=${toDate}&group_by=day`);
      setSalesData(data.data.map(d => ({
        ...d,
        period: new Date(d.period).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        total_sales: parseFloat(d.total_sales || 0),
        transaction_count: parseInt(d.transaction_count || 0)
      })));
    } catch { toast.error('Failed to load sales report'); }
    finally { setLoading(false); }
  };

  const fetchPaymentBreakdown = async () => {
    try {
      const { data } = await api.get(`/reports/payment-breakdown?from_date=${fromDate}&to_date=${toDate}`);
      const colorMap = { cash: '#16a34a', card: '#2563eb', qr: '#7c3aed' };
      setPaymentData(
        (data.data || []).map(row => ({
          name: row.payment_method === 'card' ? 'Card / Online' : row.payment_method.charAt(0).toUpperCase() + row.payment_method.slice(1),
          value: parseFloat(row.total_amount || 0),
          count: parseInt(row.transaction_count || 0),
          color: colorMap[row.payment_method] || '#6b7280',
        })).filter(d => d.value > 0)
      );
    } catch {}
  };

  const fetchProfitReport = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/reports/profit?from_date=${fromDate}&to_date=${toDate}`);
      setProfitData(data.data.slice(0, 20).map(d => ({
        ...d,
        total_revenue: parseFloat(d.total_revenue || 0),
        total_cost: parseFloat(d.total_cost || 0),
        total_profit: parseFloat(d.total_profit || 0),
      })));
      setProfitSummary(data.summary);
    } catch { toast.error('Failed to load profit report'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (activeTab === 'sales') { fetchSalesReport(); fetchPaymentBreakdown(); }
    else fetchProfitReport();
  }, [activeTab, fromDate, toDate]);

  const fmt = n => `${cur} ${parseFloat(n || 0).toLocaleString('en-NP', { minimumFractionDigits: 2 })}`;

  const totalSales = salesData.reduce((s, d) => s + d.total_sales, 0);
  const totalTransactions = salesData.reduce((s, d) => s + d.transaction_count, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold dm-text-primary">Reports & Analytics</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[['sales', '📊 Sales Report'], ['profit', '💰 Profit Report']].map(([t, l]) => (
          <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === t ? 'bg-green-600 text-white' : 'bg-gray-100 dm-text-primary hover:bg-gray-200'}`}>{l}</button>
        ))}
      </div>

      {/* Date Filter */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium dm-text-secondary mb-1">From Date</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium dm-text-secondary mb-1">To Date</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="input" />
          </div>
          {/* Quick filters */}
          {[
            { label: 'Today', fn: () => { const t = new Date().toISOString().split('T')[0]; setFromDate(t); setToDate(t); } },
            { label: 'This Week', fn: () => { const d = new Date(); const mon = new Date(d.setDate(d.getDate() - d.getDay() + 1)); setFromDate(mon.toISOString().split('T')[0]); setToDate(new Date().toISOString().split('T')[0]); } },
            { label: 'This Month', fn: () => { const d = new Date(); setFromDate(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]); setToDate(new Date().toISOString().split('T')[0]); } },
          ].map(q => (
            <button key={q.label} onClick={q.fn} className="btn-secondary text-xs py-1.5">{q.label}</button>
          ))}
        </div>
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          {activeTab === 'sales' && (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Total Revenue', value: fmt(totalSales), icon: '💰', color: 'text-green-700' },
                  { label: 'Transactions', value: totalTransactions, icon: '🧾', color: 'text-blue-700' },
                  { label: 'Avg per Day', value: fmt(salesData.length ? totalSales / salesData.length : 0), icon: '📅', color: 'text-purple-700' },
                ].map(s => (
                  <div key={s.label} className="card">
                    <div className="text-2xl mb-1">{s.icon}</div>
                    <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-sm dm-text-muted">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Bar Chart */}
              <div className="card">
                <h3 className="text-base font-semibold dm-text-primary mb-4">Daily Sales Revenue</h3>
                {salesData.length === 0 ? (
                  <div className="text-center py-12 dm-text-muted">No sales data in selected period</div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={salesData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => `${cur} ${parseFloat(v).toFixed(2)}`} />
                      <Bar dataKey="total_sales" fill="#16a34a" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Payment Method Breakdown Chart */}
              {paymentData.length > 0 && (
                <div className="card">
                  <h3 className="text-base font-semibold dm-text-primary mb-4">💳 Sales by Payment Method</h3>
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={paymentData} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                          dataKey="value" nameKey="name" paddingAngle={3} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}
                          labelLine={true}>
                          {paymentData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip formatter={(v) => fmt(v)} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-col gap-3 min-w-[160px]">
                      {paymentData.map((d, i) => (
                        <div key={i} className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full inline-block" style={{ background: d.color }}></span>
                            <span className="text-sm dm-text-secondary">{d.name}</span>
                          </div>
                          <span className="text-sm font-bold dm-text-primary">{fmt(d.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Sales Table */}
              <div className="card p-0 overflow-hidden">
                <div className="px-4 py-3 border-b dm-border-card"><h3 className="font-semibold dm-text-primary text-sm">Daily Breakdown</h3></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50"><tr>{['Date', 'Transactions', 'Total Sales', 'Discounts', 'Avg Sale'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold dm-text-muted">{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-y dm-border-card">
                      {salesData.map((d, i) => (
                        <tr key={i} className="dm-row-hover">
                          <td className="px-4 py-3 font-medium">{d.period}</td>
                          <td className="px-4 py-3">{d.transaction_count}</td>
                          <td className="px-4 py-3 font-semibold text-green-700">{fmt(d.total_sales)}</td>
                          <td className="px-4 py-3 text-yellow-600">{fmt(d.total_discounts)}</td>
                          <td className="px-4 py-3">{fmt(d.avg_sale)}</td>
                        </tr>
                      ))}
                      {salesData.length === 0 && <tr><td colSpan={5} className="text-center py-8 dm-text-muted">No data</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'profit' && (
            <div className="space-y-4">
              {/* Profit Summary */}
              {profitSummary && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { label: 'Total Revenue', value: fmt(profitSummary.total_revenue), icon: '💵', color: 'text-green-700' },
                    { label: 'Total Cost', value: fmt(profitSummary.total_cost), icon: '💸', color: 'text-red-600' },
                    { label: 'Gross Profit', value: fmt(profitSummary.total_profit), icon: '📈', color: parseFloat(profitSummary.total_profit) >= 0 ? 'text-green-700' : 'text-red-600' },
                  ].map(s => (
                    <div key={s.label} className="card">
                      <div className="text-2xl mb-1">{s.icon}</div>
                      <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                      <div className="text-sm dm-text-muted">{s.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Top medicines chart */}
              <div className="card">
                <h3 className="text-base font-semibold dm-text-primary mb-4">Top 10 Medicines by Profit</h3>
                {profitData.length === 0 ? <div className="text-center py-12 dm-text-muted">No data in selected period</div> : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={profitData.slice(0, 10)} layout="vertical" margin={{ left: 120 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="medicine_name" tick={{ fontSize: 10 }} width={120} />
                      <Tooltip formatter={v => `${cur} ${parseFloat(v).toFixed(2)}`} />
                      <Bar dataKey="total_profit" fill="#16a34a" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Profit Table */}
              <div className="card p-0 overflow-hidden">
                <div className="px-4 py-3 border-b dm-border-card"><h3 className="font-semibold dm-text-primary text-sm">Medicine-wise Profit</h3></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50"><tr>{['Medicine', 'Qty Sold', 'Revenue', 'Cost', 'Profit', 'Margin%'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold dm-text-muted">{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-y dm-border-card">
                      {profitData.map((d, i) => {
                        const margin = d.total_revenue > 0 ? ((d.total_profit / d.total_revenue) * 100).toFixed(1) : 0;
                        return (
                          <tr key={i} className="dm-row-hover">
                            <td className="px-4 py-3 font-medium">{d.medicine_name}</td>
                            <td className="px-4 py-3">{d.total_sold}</td>
                            <td className="px-4 py-3 text-green-700">{fmt(d.total_revenue)}</td>
                            <td className="px-4 py-3 text-red-600">{fmt(d.total_cost)}</td>
                            <td className="px-4 py-3 font-semibold text-green-700">{fmt(d.total_profit)}</td>
                            <td className="px-4 py-3">{margin}%</td>
                          </tr>
                        );
                      })}
                      {profitData.length === 0 && <tr><td colSpan={6} className="text-center py-8 dm-text-muted">No data</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}