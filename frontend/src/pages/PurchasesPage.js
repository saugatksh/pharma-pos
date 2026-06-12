import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { Modal, ConfirmDialog, Pagination, LoadingSpinner, EmptyState, SearchInput, Badge } from '../components/UI';
import toast from 'react-hot-toast';

const defaultItem = { medicine_id: '', medicine_name: '', batch_number: '', expiry_date: '', quantity: 1, purchase_rate: '', selling_rate: '' };

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [viewModal, setViewModal] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [medSearch, setMedSearch] = useState('');
  const [medResults, setMedResults] = useState([]);
  const [activeItemIdx, setActiveItemIdx] = useState(null);

  const [form, setForm] = useState({
    supplier_id: '', invoice_number: '', purchase_date: new Date().toISOString().split('T')[0], notes: '',
    items: [{ ...defaultItem }]
  });

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page, limit: 20 });
      if (search) p.set('search', search);
      const { data } = await api.get(`/purchases?${p}`);
      setPurchases(data.data); setPagination(data.pagination);
    } catch { toast.error('Failed to load purchases'); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { fetchPurchases(); }, [fetchPurchases]);
  useEffect(() => {
    api.get('/suppliers').then(r => setSuppliers(r.data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!medSearch.trim()) { setMedResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await api.get(`/medicines/search?q=${encodeURIComponent(medSearch)}`);
      setMedResults(data.data);
    }, 300);
    return () => clearTimeout(t);
  }, [medSearch]);

  const selectMedicine = (med) => {
    const items = [...form.items];
    items[activeItemIdx] = { ...items[activeItemIdx], medicine_id: med.id, medicine_name: med.name, purchase_rate: med.purchase_price || '', selling_rate: med.selling_price || '' };
    setForm({ ...form, items });
    setMedSearch(''); setMedResults([]); setActiveItemIdx(null);
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { ...defaultItem }] });
  const removeItem = (i) => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });
  const updateItem = (i, field, value) => {
    const items = [...form.items];
    items[i] = { ...items[i], [field]: value };
    setForm({ ...form, items });
  };

  const totalAmount = form.items.reduce((s, i) => s + ((parseFloat(i.quantity) || 0) * (parseFloat(i.purchase_rate) || 0)), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.items.some(i => i.medicine_id)) return toast.error('Add at least one medicine');
    if (form.items.some(i => i.medicine_id && (!i.quantity || !i.purchase_rate || !i.selling_rate))) return toast.error('Fill quantity, purchase rate and selling rate for all items');
    setSaving(true);
    try {
      await api.post('/purchases', { ...form, items: form.items.filter(i => i.medicine_id) });
      toast.success('Purchase recorded & inventory updated');
      setShowModal(false);
      setForm({ supplier_id: '', invoice_number: '', purchase_date: new Date().toISOString().split('T')[0], notes: '', items: [{ ...defaultItem }] });
      fetchPurchases();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save purchase'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/purchases/${deleteId}`);
      toast.success('Purchase deleted');
      setDeleteId(null);
      fetchPurchases();
    } catch { toast.error('Failed to delete'); }
  };

  const viewPurchase = async (id) => {
    const { data } = await api.get(`/purchases/${id}`);
    setViewModal(data.data);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold dm-text-primary">Purchases</h1>
          <p className="text-sm dm-text-muted mt-0.5">Record supplier purchases — automatically updates inventory</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary whitespace-nowrap">+ New Purchase</button>
      </div>

      {/* Info banner */}
      <div className="rounded-2xl p-4 flex items-start gap-3"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderLeft: '4px solid #10b981' }}>
        <span className="text-xl flex-shrink-0">🔄</span>
        <div className="text-xs dm-text-muted">
          <strong className="dm-text-primary text-sm">Purchases automatically update Inventory.</strong>
          {' '}When you record a purchase, each medicine's batch is added to inventory with batch number, expiry date, and purchase cost.
        </div>
      </div>

      <div className="card p-4">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search by PO number or invoice..." />
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? <LoadingSpinner /> : purchases.length === 0 ? (
          <EmptyState icon="🛒" title="No purchases yet" action={<button onClick={() => setShowModal(true)} className="btn-primary">+ New Purchase</button>} />
        ) : (
          <>
            {/* ── Desktop table (md+) ── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['PO Number', 'Supplier', 'Date', 'Invoice #', 'Total', 'Status', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold dm-text-muted uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y dm-border-card">
                  {purchases.map(p => (
                    <tr key={p.id} className="dm-row-hover">
                      <td className="px-4 py-3 font-mono text-xs font-semibold dm-text-primary">{p.purchase_number}</td>
                      <td className="px-4 py-3 dm-text-primary">{p.supplier_name || '—'}</td>
                      <td className="px-4 py-3 dm-text-muted whitespace-nowrap">{new Date(p.purchase_date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 dm-text-muted">{p.invoice_number || '—'}</td>
                      <td className="px-4 py-3 font-semibold whitespace-nowrap">NPR {parseFloat(p.total_amount).toFixed(2)}</td>
                      <td className="px-4 py-3"><Badge type="green">{p.status}</Badge></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => viewPurchase(p.id)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">View</button>
                          <button onClick={() => setDeleteId(p.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Mobile cards (< md) ── */}
            <div className="md:hidden divide-y dm-border-card">
              {purchases.map(p => (
                <div key={p.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-bold dm-text-primary">{p.purchase_number}</p>
                      <p className="text-sm dm-text-secondary font-medium mt-0.5">{p.supplier_name || 'No supplier'}</p>
                    </div>
                    <Badge type="green" className="flex-shrink-0">{p.status}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div>
                      <span className="dm-text-muted">Date</span>
                      <p className="dm-text-secondary font-medium">{new Date(p.purchase_date).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <span className="dm-text-muted">Invoice #</span>
                      <p className="dm-text-secondary font-medium">{p.invoice_number || '—'}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="dm-text-muted">Total</span>
                      <p className="font-bold text-green-700 text-sm">NPR {parseFloat(p.total_amount).toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => viewPurchase(p.id)} className="flex-1 py-1.5 rounded-lg text-xs font-medium text-blue-700 border border-blue-200 hover:bg-blue-50 transition-colors">View Details</button>
                    <button onClick={() => setDeleteId(p.id)} className="flex-1 py-1.5 rounded-lg text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors">Delete</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-4 sm:px-6 pb-4"><Pagination pagination={pagination} onPageChange={setPage} /></div>
          </>
        )}
      </div>

      {/* New Purchase Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Purchase" size="xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium dm-text-secondary mb-1">Supplier</label>
              <select value={form.supplier_id} onChange={e => setForm({...form, supplier_id: e.target.value})} className="input text-sm">
                <option value="">Select Supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium dm-text-secondary mb-1">Invoice Number</label>
              <input value={form.invoice_number} onChange={e => setForm({...form, invoice_number: e.target.value})} className="input text-sm" placeholder="Supplier invoice #" />
            </div>
            <div>
              <label className="block text-xs font-medium dm-text-secondary mb-1">Purchase Date *</label>
              <input type="date" value={form.purchase_date} onChange={e => setForm({...form, purchase_date: e.target.value})} className="input text-sm" required />
            </div>
            <div>
              <label className="block text-xs font-medium dm-text-secondary mb-1">Notes</label>
              <input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="input text-sm" placeholder="Optional notes" />
            </div>
          </div>

          {/* Items table — scrollable on all sizes */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between">
              <h3 className="text-sm font-semibold dm-text-primary">Purchase Items</h3>
              <button type="button" onClick={addItem} className="text-green-600 text-sm hover:text-green-800 font-medium">+ Add Row</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{ minWidth: '680px' }}>
                <thead className="border-b bg-gray-50">
                  <tr>
                    {['Medicine *', 'Batch No', 'Expiry', 'Qty *', 'Purchase Rate *', 'Sell Rate *', 'Total', ''].map(h => (
                      <th key={h} className="text-left px-3 py-2 dm-text-muted font-semibold uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {form.items.map((item, i) => (
                    <tr key={i}>
                      <td className="px-2 py-2 relative min-w-[160px]">
                        <input
                          value={item.medicine_name || (activeItemIdx === i ? medSearch : '')}
                          onChange={e => { setMedSearch(e.target.value); setActiveItemIdx(i); if (!e.target.value) updateItem(i, 'medicine_id', ''); }}
                          onFocus={() => setActiveItemIdx(i)}
                          placeholder="Search medicine..."
                          className="input text-xs"
                        />
                        {activeItemIdx === i && medResults.length > 0 && (
                          <div className="absolute z-20 top-full left-0 right-0 bg-white border dm-border-card rounded shadow-lg max-h-40 overflow-y-auto">
                            {medResults.map(m => (
                              <button key={m.id} type="button" onClick={() => selectMedicine(m)}
                                className="w-full text-left px-3 py-2 hover:bg-green-50 border-b border-gray-50 text-xs">
                                <span className="font-medium">{m.name}</span>
                                <span className="dm-text-muted ml-2">Stock: {m.current_stock}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2"><input value={item.batch_number} onChange={e => updateItem(i, 'batch_number', e.target.value)} className="input text-xs w-24" placeholder="Batch #" /></td>
                      <td className="px-2 py-2"><input type="date" value={item.expiry_date} onChange={e => updateItem(i, 'expiry_date', e.target.value)} className="input text-xs w-32" /></td>
                      <td className="px-2 py-2"><input type="number" min="1" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} className="input text-xs w-16 text-right" required /></td>
                      <td className="px-2 py-2"><input type="number" step="0.01" min="0" value={item.purchase_rate} onChange={e => updateItem(i, 'purchase_rate', e.target.value)} className="input text-xs w-24 text-right" required /></td>
                      <td className="px-2 py-2"><input type="number" step="0.01" min="0" value={item.selling_rate} onChange={e => updateItem(i, 'selling_rate', e.target.value)} className="input text-xs w-24 text-right" required placeholder="0.00" /></td>
                      <td className="px-2 py-2 font-semibold text-right dm-text-primary whitespace-nowrap">{((item.quantity || 0) * (item.purchase_rate || 0)).toFixed(2)}</td>
                      <td className="px-2 py-2">
                        {form.items.length > 1 && <button type="button" onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600">✕</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t">
                  <tr>
                    <td colSpan={6} className="px-3 py-2 text-right font-semibold dm-text-primary">Total Amount:</td>
                    <td className="px-3 py-2 font-bold text-green-700 text-right whitespace-nowrap">NPR {totalAmount.toFixed(2)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Purchase'}</button>
          </div>
        </form>
      </Modal>

      {/* View Purchase Modal */}
      <Modal open={!!viewModal} onClose={() => setViewModal(null)} title={`Purchase: ${viewModal?.purchase_number}`} size="lg">
        {viewModal && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div><span className="dm-text-muted">Supplier:</span> <span className="font-medium">{viewModal.supplier_name || '—'}</span></div>
              <div><span className="dm-text-muted">Date:</span> <span className="font-medium">{new Date(viewModal.purchase_date).toLocaleDateString()}</span></div>
              <div><span className="dm-text-muted">Invoice #:</span> <span className="font-medium">{viewModal.invoice_number || '—'}</span></div>
              <div><span className="dm-text-muted">Total:</span> <span className="font-bold text-green-700">NPR {parseFloat(viewModal.total_amount).toFixed(2)}</span></div>
            </div>
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm" style={{ minWidth: '400px' }}>
                <thead className="bg-gray-50">
                  <tr>{['Medicine', 'Batch', 'Expiry', 'Qty', 'Rate', 'Total'].map(h => <th key={h} className="text-left px-3 py-2 text-xs font-semibold dm-text-muted whitespace-nowrap">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y dm-border-card">
                  {viewModal.items?.map((item, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2">{item.medicine_name}</td>
                      <td className="px-3 py-2">{item.batch_number || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : '—'}</td>
                      <td className="px-3 py-2">{item.quantity}</td>
                      <td className="px-3 py-2">{parseFloat(item.purchase_rate).toFixed(2)}</td>
                      <td className="px-3 py-2 font-semibold">{parseFloat(item.total_amount).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="Delete Purchase" message="Delete this purchase record? Note: Inventory will NOT be automatically reversed." confirmText="Delete" type="danger" />
    </div>
  );
}
