import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Modal, LoadingSpinner, EmptyState, SearchInput, Badge, Pagination } from '../components/UI';
import toast from 'react-hot-toast';

export default function InventoryPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'stock');
  const [inventory, setInventory] = useState([]);
  const [expiryAlerts, setExpiryAlerts] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(searchParams.get('filter') || '');
  const [page, setPage] = useState(1);
  const [adjustModal, setAdjustModal] = useState(false);
  const [batchModal, setBatchModal] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ medicine_id: '', inventory_batch_id: '', adjustment_type: 'add', quantity: '', reason: '', notes: '', batch_number: '', expiry_date: '', purchase_rate: '' });
  const [medSearch, setMedSearch] = useState('');
  const [medResults, setMedResults] = useState([]);
  const [saving, setSaving] = useState(false);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page, limit: 30 });
      if (search) p.set('search', search);
      if (filter) p.set('filter', filter);
      const { data } = await api.get(`/inventory?${p}`);
      setInventory(data.data); setPagination(data.pagination);
    } catch { toast.error('Failed to load inventory'); }
    finally { setLoading(false); }
  }, [page, search, filter]);

  const fetchExpiryAlerts = useCallback(async () => {
    try {
      const alertDays = user?.pharmacySettings?.expiry_alert_days || 90;
      const { data } = await api.get(`/inventory/expiry-alerts?days=${alertDays}`);
      setExpiryAlerts(data.data);
    } catch {}
  }, []);

  useEffect(() => {
    if (activeTab === 'stock') fetchInventory();
    else fetchExpiryAlerts();
  }, [activeTab, fetchInventory, fetchExpiryAlerts]);

  useEffect(() => {
    if (!medSearch.trim()) { setMedResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await api.get(`/medicines/search?q=${encodeURIComponent(medSearch)}`);
      setMedResults(data.data);
    }, 300);
    return () => clearTimeout(t);
  }, [medSearch]);

  const viewBatches = async (medicineId) => {
    const { data } = await api.get(`/inventory/batches/${medicineId}`);
    setBatchModal(data.data);
  };

  const handleAdjust = async (e) => {
    e.preventDefault();
    if (!adjustForm.medicine_id || !adjustForm.quantity) return toast.error('Medicine and quantity required');
    setSaving(true);
    try {
      await api.post('/inventory/adjust', adjustForm);
      toast.success('Stock adjusted successfully');
      setAdjustModal(false);
      setAdjustForm({ medicine_id: '', inventory_batch_id: '', adjustment_type: 'add', quantity: '', reason: '', notes: '', batch_number: '', expiry_date: '', purchase_rate: '' });
      setMedSearch('');
      fetchInventory();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to adjust stock'); }
    finally { setSaving(false); }
  };

  const expiryStatusColor = (status) => {
    if (status === 'expired' || status === 'critical') return 'red';
    if (status === 'warning') return 'yellow';
    return 'blue';
  };

  const stockStatusColor = (stock, min) => {
    if (stock === 0) return 'red';
    if (stock <= min) return 'yellow';
    return 'green';
  };

  const expiryLabel = (status) => {
    if (status === 'expired') return 'Expired';
    if (status === 'critical') return '≤ 30 days';
    if (status === 'warning') return '≤ 60 days';
    return '≤ 90 days';
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold dm-text-primary">Inventory</h1>
          <p className="text-sm dm-text-muted mt-0.5">View and monitor your current stock levels</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setActiveTab('stock')} className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${activeTab === 'stock' ? 'bg-emerald-600 text-white shadow-md' : 'dm-bg-card dm-text-secondary dm-border-card border hover:border-emerald-300'}`}>📦 Stock</button>
          <button onClick={() => setActiveTab('expiry')} className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${activeTab === 'expiry' ? 'bg-red-600 text-white shadow-md' : 'dm-bg-card dm-text-secondary dm-border-card border hover:border-red-300'}`}>⏰ Expiry</button>
          {isAdmin && (
            <button onClick={() => setAdjustModal(true)} className="px-3 py-2 rounded-xl text-xs sm:text-sm font-medium border-2 border-dashed border-amber-400 text-amber-600 hover:bg-amber-50 transition-all">
              ⚖️ Adjust
            </button>
          )}
          {isAdmin && (
            <button onClick={() => navigate('/purchases')} className="btn-primary text-xs sm:text-sm px-3 py-2">
              🛒 New Purchase
            </button>
          )}
        </div>
      </div>

      {activeTab === 'stock' ? (
        <>
          <div className="card p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search medicines..." />
              </div>
              <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }} className="input w-full sm:w-44">
                <option value="">All Stock</option>
                <option value="low_stock">Low Stock</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>
            </div>
          </div>

          <div className="card p-0 overflow-hidden">
            {loading ? <LoadingSpinner /> : inventory.length === 0 ? (
              <EmptyState icon="📦" title="No inventory records" subtitle="Stock will appear here after purchases" />
            ) : (
              <>
                {/* ── Desktop table (md+) ── */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Medicine', 'Category', 'Unit', 'Current Stock', 'Min Level', 'Nearest Expiry', 'Batches', 'Actions'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-semibold dm-text-muted uppercase whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y dm-border-card">
                      {inventory.map(item => (
                        <tr key={item.id} className="dm-row-hover">
                          <td className="px-4 py-3">
                            <div className="font-medium dm-text-primary">{item.name}</div>
                            <div className="text-xs dm-text-muted">{item.generic_name}</div>
                          </td>
                          <td className="px-4 py-3 dm-text-muted text-xs">{item.category_name || '—'}</td>
                          <td className="px-4 py-3 dm-text-muted">{item.unit}</td>
                          <td className="px-4 py-3">
                            <Badge type={stockStatusColor(parseInt(item.current_stock), item.min_stock_level)}>
                              {item.current_stock} {item.unit}
                            </Badge>
                            {parseInt(item.current_stock) === 0 && <div className="text-xs text-red-500 mt-1">Out of Stock</div>}
                            {parseInt(item.current_stock) > 0 && parseInt(item.current_stock) <= item.min_stock_level && <div className="text-xs text-yellow-600 mt-1">Low Stock</div>}
                          </td>
                          <td className="px-4 py-3 dm-text-muted">{item.min_stock_level}</td>
                          <td className="px-4 py-3 text-xs">
                            {item.nearest_expiry ? (
                              <span className={new Date(item.nearest_expiry) < new Date() ? 'text-red-600 font-semibold' : new Date(item.nearest_expiry) < new Date(Date.now() + 30 * 86400000) ? 'text-orange-600 font-semibold' : 'dm-text-muted'}>
                                {new Date(item.nearest_expiry).toLocaleDateString()}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3 dm-text-muted">{item.batch_count}</td>
                          <td className="px-4 py-3">
                            <button onClick={() => viewBatches(item.id)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Batches</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* ── Mobile cards (< md) ── */}
                <div className="md:hidden divide-y dm-border-card">
                  {inventory.map(item => (
                    <div key={item.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium dm-text-primary">{item.name}</p>
                          {item.generic_name && <p className="text-xs dm-text-muted mt-0.5">{item.generic_name}</p>}
                        </div>
                        <Badge type={stockStatusColor(parseInt(item.current_stock), item.min_stock_level)} className="flex-shrink-0">
                          {item.current_stock} {item.unit}
                        </Badge>
                      </div>
                      {(parseInt(item.current_stock) === 0) && <p className="text-xs text-red-500 font-medium">⚠️ Out of Stock</p>}
                      {parseInt(item.current_stock) > 0 && parseInt(item.current_stock) <= item.min_stock_level && <p className="text-xs text-yellow-600 font-medium">⚠️ Low Stock</p>}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <div>
                          <span className="dm-text-muted">Category</span>
                          <p className="dm-text-secondary font-medium">{item.category_name || '—'}</p>
                        </div>
                        <div>
                          <span className="dm-text-muted">Min Level</span>
                          <p className="dm-text-secondary font-medium">{item.min_stock_level} {item.unit}</p>
                        </div>
                        <div>
                          <span className="dm-text-muted">Nearest Expiry</span>
                          <p className={`font-medium ${item.nearest_expiry && new Date(item.nearest_expiry) < new Date() ? 'text-red-600' : item.nearest_expiry && new Date(item.nearest_expiry) < new Date(Date.now() + 30 * 86400000) ? 'text-orange-600' : 'dm-text-secondary'}`}>
                            {item.nearest_expiry ? new Date(item.nearest_expiry).toLocaleDateString() : '—'}
                          </p>
                        </div>
                        <div>
                          <span className="dm-text-muted">Batches</span>
                          <p className="dm-text-secondary font-medium">{item.batch_count}</p>
                        </div>
                      </div>
                      <button onClick={() => viewBatches(item.id)} className="w-full py-1.5 rounded-lg text-xs font-medium text-blue-700 border border-blue-200 hover:bg-blue-50 transition-colors">
                        View Batches
                      </button>
                    </div>
                  ))}
                </div>

                <div className="px-4 sm:px-6 pb-4"><Pagination pagination={pagination} onPageChange={setPage} /></div>
              </>
            )}
          </div>
        </>
      ) : (
        /* Expiry Alerts */
        <div className="card p-0 overflow-hidden">
          {expiryAlerts.length === 0 ? (
            <EmptyState icon="✅" title="No expiry alerts" subtitle="All medicines are within safe expiry dates" />
          ) : (
            <>
              {/* ── Desktop table ── */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Medicine', 'Batch', 'Expiry Date', 'Days Left', 'Qty Available', 'Status'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold dm-text-muted uppercase whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y dm-border-card">
                    {expiryAlerts.map(item => (
                      <tr key={item.id} className="dm-row-hover">
                        <td className="px-4 py-3">
                          <div className="font-medium dm-text-primary">{item.medicine_name}</div>
                          <div className="text-xs dm-text-muted">{item.generic_name}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{item.batch_number || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{new Date(item.expiry_date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 font-semibold">
                          <span className={item.days_to_expiry < 0 ? 'text-red-600' : item.days_to_expiry <= 30 ? 'text-orange-600' : 'text-yellow-600'}>
                            {item.days_to_expiry < 0 ? `${Math.abs(item.days_to_expiry)} days ago` : `${item.days_to_expiry} days`}
                          </span>
                        </td>
                        <td className="px-4 py-3">{item.available_quantity} {item.unit}</td>
                        <td className="px-4 py-3">
                          <Badge type={expiryStatusColor(item.expiry_status)}>{expiryLabel(item.expiry_status)}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Mobile cards ── */}
              <div className="md:hidden divide-y dm-border-card">
                {expiryAlerts.map(item => (
                  <div key={item.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium dm-text-primary">{item.medicine_name}</p>
                        {item.generic_name && <p className="text-xs dm-text-muted mt-0.5">{item.generic_name}</p>}
                      </div>
                      <Badge type={expiryStatusColor(item.expiry_status)} className="flex-shrink-0">
                        {expiryLabel(item.expiry_status)}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <div>
                        <span className="dm-text-muted">Batch</span>
                        <p className="font-mono dm-text-secondary">{item.batch_number || '—'}</p>
                      </div>
                      <div>
                        <span className="dm-text-muted">Expiry Date</span>
                        <p className="dm-text-secondary font-medium">{new Date(item.expiry_date).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <span className="dm-text-muted">Days Left</span>
                        <p className={`font-semibold ${item.days_to_expiry < 0 ? 'text-red-600' : item.days_to_expiry <= 30 ? 'text-orange-600' : 'text-yellow-600'}`}>
                          {item.days_to_expiry < 0 ? `${Math.abs(item.days_to_expiry)}d ago` : `${item.days_to_expiry} days`}
                        </p>
                      </div>
                      <div>
                        <span className="dm-text-muted">Available Qty</span>
                        <p className="dm-text-secondary font-medium">{item.available_quantity} {item.unit}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Batch Details Modal */}
      <Modal open={!!batchModal} onClose={() => setBatchModal(null)} title="Batch Details" size="lg">
        {batchModal && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: '380px' }}>
              <thead className="bg-gray-50">
                <tr>{['Batch #', 'Expiry', 'Initial Qty', 'Available', 'Rate', 'Status'].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-xs font-semibold dm-text-muted whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y dm-border-card">
                {batchModal.map(b => (
                  <tr key={b.id}>
                    <td className="px-3 py-2 font-mono text-xs">{b.batch_number || '—'}</td>
                    <td className="px-3 py-2 text-sm whitespace-nowrap">{b.expiry_date ? new Date(b.expiry_date).toLocaleDateString() : 'No Expiry'}</td>
                    <td className="px-3 py-2">{b.initial_quantity}</td>
                    <td className="px-3 py-2 font-semibold">{b.available_quantity}</td>
                    <td className="px-3 py-2">{parseFloat(b.purchase_rate).toFixed(2)}</td>
                    <td className="px-3 py-2">
                      {b.is_damaged
                        ? <Badge type="red">Damaged</Badge>
                        : b.expiry_date && new Date(b.expiry_date) < new Date()
                          ? <Badge type="red">Expired</Badge>
                          : parseInt(b.available_quantity) === 0
                            ? <Badge type="gray">Inactive</Badge>
                            : <Badge type="green">Active</Badge>}
                    </td>
                  </tr>
                ))}
                {batchModal.length === 0 && <tr><td colSpan={6} className="text-center py-6 dm-text-muted">No batch records</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* Adjust Stock Modal */}
      {isAdmin && (
        <Modal open={adjustModal} onClose={() => setAdjustModal(false)} title="⚖️ Stock Adjustment" size="md">
          <form onSubmit={handleAdjust} className="space-y-4">
            <div className="rounded-xl p-3 border-l-4 border-amber-400 text-xs"
              style={{ background: 'rgba(251,191,36,0.08)', borderTop: '1px solid rgba(251,191,36,0.2)', borderRight: '1px solid rgba(251,191,36,0.2)', borderBottom: '1px solid rgba(251,191,36,0.2)' }}>
              <div className="font-semibold text-amber-600 mb-1">⚠️ Use this for corrections only</div>
              <div className="dm-text-muted">To add stock from a supplier, use <strong className="text-blue-500 cursor-pointer underline" onClick={() => { setAdjustModal(false); navigate('/purchases'); }}>Purchases → New Purchase</strong> instead.</div>
            </div>
            <div>
              <label className="block text-sm font-medium dm-text-primary mb-1">Medicine *</label>
              <div className="relative">
                <input
                  value={adjustForm.medicine_name || medSearch}
                  onChange={e => { setMedSearch(e.target.value); if (!e.target.value) setAdjustForm({...adjustForm, medicine_id: '', medicine_name: ''}); }}
                  placeholder="Search medicine..."
                  className="input"
                />
                {medResults.length > 0 && medSearch && (
                  <div className="absolute z-20 top-full left-0 right-0 bg-white border dm-border-card rounded shadow-lg max-h-40 overflow-y-auto">
                    {medResults.map(m => (
                      <button key={m.id} type="button" onClick={() => { setAdjustForm({...adjustForm, medicine_id: m.id, medicine_name: m.name}); setMedSearch(''); setMedResults([]); }}
                        className="w-full text-left px-3 py-2 hover:bg-green-50 text-sm border-b">
                        {m.name} <span className="dm-text-muted text-xs">Stock: {m.current_stock}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium dm-text-primary mb-1">Adjustment Type *</label>
              <select value={adjustForm.adjustment_type} onChange={e => setAdjustForm({...adjustForm, adjustment_type: e.target.value})} className="input" required>
                <option value="add">Add Stock</option>
                <option value="opening">Opening Stock</option>
                <option value="remove">Remove Stock</option>
                <option value="damage">Mark as Damaged</option>
                <option value="reconcile">Reconcile (Set Quantity)</option>
              </select>
            </div>
            {(adjustForm.adjustment_type === 'add' || adjustForm.adjustment_type === 'opening') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium dm-text-primary mb-1">Batch Number</label>
                  <input value={adjustForm.batch_number} onChange={e => setAdjustForm({...adjustForm, batch_number: e.target.value})} className="input" placeholder="Optional" />
                </div>
                <div>
                  <label className="block text-sm font-medium dm-text-primary mb-1">Expiry Date</label>
                  <input type="date" value={adjustForm.expiry_date} onChange={e => setAdjustForm({...adjustForm, expiry_date: e.target.value})} className="input" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium dm-text-primary mb-1">Purchase Rate</label>
                  <input type="number" step="0.01" value={adjustForm.purchase_rate} onChange={e => setAdjustForm({...adjustForm, purchase_rate: e.target.value})} className="input" placeholder="0.00" />
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium dm-text-primary mb-1">Quantity *</label>
              <input type="number" min="1" value={adjustForm.quantity} onChange={e => setAdjustForm({...adjustForm, quantity: e.target.value})} className="input" required />
            </div>
            <div>
              <label className="block text-sm font-medium dm-text-primary mb-1">Reason</label>
              <input value={adjustForm.reason} onChange={e => setAdjustForm({...adjustForm, reason: e.target.value})} className="input" placeholder="Reason for adjustment" />
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setAdjustModal(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Adjust Stock'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
