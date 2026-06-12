import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Modal, LoadingSpinner, EmptyState } from '../components/UI';
import toast from 'react-hot-toast';

export default function ReturnsPage() {
  const [activeTab, setActiveTab] = useState('customer');
  const [customerReturns, setCustomerReturns] = useState([]);
  const [supplierReturns, setSupplierReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);

  // Detail view modal
  const [detailModal, setDetailModal] = useState(null); // { type: 'customer'|'supplier', data: {...} }
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Customer return form
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [saleData, setSaleData] = useState(null);
  const [searchingSale, setSearchingSale] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [returnReason, setReturnReason] = useState('');
  const [savingReturn, setSavingReturn] = useState(false);

  // Supplier return form
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [supplierReturnItems, setSupplierReturnItems] = useState([]);
  const [supplierReturnReason, setSupplierReturnReason] = useState('damaged');
  const [supplierReturnNotes, setSupplierReturnNotes] = useState('');
  const [medSearch, setMedSearch] = useState('');
  const [medResults, setMedResults] = useState([]);
  const [batches, setBatches] = useState([]);

  useEffect(() => {
    fetchReturns();
    api.get('/suppliers').then(r => setSuppliers(r.data.data)).catch(() => {});
  }, []);

  const fetchReturns = async () => {
    setLoading(true);
    try {
      const [cr, sr] = await Promise.allSettled([
        api.get('/returns/customer'),
        api.get('/returns/supplier'),
      ]);
      setCustomerReturns(cr.status === 'fulfilled' ? (cr.value.data.data || []) : []);
      setSupplierReturns(sr.status === 'fulfilled' ? (sr.value.data.data || []) : []);
    } catch { }
    finally { setLoading(false); }
  };

  const openDetail = async (type, id) => {
    setLoadingDetail(true);
    setDetailModal({ type, data: null });
    try {
      const { data } = await api.get(`/returns/${type}/${id}`);
      setDetailModal({ type, data: data.data });
    } catch {
      toast.error('Failed to load return details');
      setDetailModal(null);
    } finally { setLoadingDetail(false); }
  };

  const searchSale = async () => {
    if (!invoiceNumber.trim()) return toast.error('Enter invoice number');
    setSearchingSale(true);
    try {
      const { data } = await api.get(`/sales?limit=100`);
      const found = data.data.find(s => s.invoice_number === invoiceNumber.trim());
      if (!found) return toast.error('Invoice not found');
      const detail = await api.get(`/sales/${found.id}`);
      setSaleData(detail.data.data);
      setSelectedItems(detail.data.data.items.map(i => ({ ...i, return_qty: 0, selected: false })));
    } catch { toast.error('Sale not found'); }
    finally { setSearchingSale(false); }
  };

  const handleCustomerReturn = async () => {
    const items = selectedItems.filter(i => i.selected && i.return_qty > 0);
    if (items.length === 0) return toast.error('Select items to return');
    setSavingReturn(true);
    try {
      await api.post('/returns/customer', {
        sale_id: saleData.id,
        items: items.map(i => ({ medicine_id: i.medicine_id, quantity: i.return_qty })),
        reason: returnReason
      });
      toast.success('✅ Customer return processed & inventory updated');
      setShowCustomerModal(false);
      setSaleData(null); setInvoiceNumber(''); setSelectedItems([]);
      fetchReturns();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSavingReturn(false); }
  };

  const searchMedForReturn = async (q) => {
    setMedSearch(q);
    if (!q.trim()) { setMedResults([]); return; }
    const { data } = await api.get(`/medicines/search?q=${encodeURIComponent(q)}`);
    setMedResults(data.data);
  };

  const selectMedForReturn = async (med) => {
    setMedSearch(''); setMedResults([]);
    const { data } = await api.get(`/inventory/batches/${med.id}`);
    setBatches(data.data.filter(b => b.available_quantity > 0));
    if (data.data.length === 0) return toast.error('No available batches for this medicine');
  };

  const addSupplierReturnItem = (batch) => {
    if (supplierReturnItems.find(i => i.inventory_batch_id === batch.id)) return toast.error('Already added');
    setSupplierReturnItems([...supplierReturnItems, {
      inventory_batch_id: batch.id,
      batch_number: batch.batch_number,
      medicine_name: batch.medicine_name,
      available_qty: batch.available_quantity,
      quantity: 1,
      purchase_rate: batch.purchase_rate
    }]);
    setBatches([]);
  };

  const handleSupplierReturn = async () => {
    if (!supplierId) return toast.error('Select supplier');
    if (supplierReturnItems.length === 0) return toast.error('Add items to return');
    setSavingReturn(true);
    try {
      await api.post('/returns/supplier', {
        supplier_id: supplierId,
        items: supplierReturnItems.map(i => ({ inventory_batch_id: i.inventory_batch_id, quantity: i.quantity })),
        reason: supplierReturnReason,
        notes: supplierReturnNotes
      });
      toast.success('✅ Supplier return processed & inventory deducted');
      setShowSupplierModal(false);
      setSupplierId(''); setSupplierReturnItems([]); setSupplierReturnNotes('');
      fetchReturns();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSavingReturn(false); }
  };

  const totalRefundCustomer = customerReturns.reduce((s, r) => s + parseFloat(r.total_refund || 0), 0);
  const totalSupplierCredit = supplierReturns.reduce((s, r) => s + parseFloat(r.total_amount || 0), 0);

  const fmt = (n) => parseFloat(n || 0).toFixed(2);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold dm-text-primary">Returns</h1>
          <p className="text-sm dm-text-muted mt-0.5">Manage customer & supplier returns</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCustomerModal(true)} className="btn-primary">↩️ Customer Return</button>
          <button onClick={() => setShowSupplierModal(true)} className="bg-orange-600 text-white px-4 py-2 rounded-xl hover:bg-orange-700 transition-colors font-medium text-sm shadow-sm">🔄 Supplier Return</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="text-xs font-semibold dm-text-muted uppercase tracking-wide mb-1">Total Customer Refunds</div>
          <div className="text-2xl font-bold text-emerald-600">NPR {fmt(totalRefundCustomer)}</div>
          <div className="text-xs dm-text-muted mt-1">{customerReturns.length} return(s) processed</div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-semibold dm-text-muted uppercase tracking-wide mb-1">Total Supplier Returns</div>
          <div className="text-2xl font-bold text-orange-600">NPR {fmt(totalSupplierCredit)}</div>
          <div className="text-xs dm-text-muted mt-1">{supplierReturns.length} return(s) processed</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[['customer', '↩️ Customer Returns', customerReturns.length], ['supplier', '🔄 Supplier Returns', supplierReturns.length]].map(([t, l, count]) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 ${activeTab === t ? 'bg-emerald-600 text-white' : 'dm-bg-card dm-text-secondary dm-border-card border hover:border-emerald-300'}`}>
            {l}
            {count > 0 && <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${activeTab === t ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'}`}>{count}</span>}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-8"><LoadingSpinner /></div>
        ) : activeTab === 'customer' ? (
          customerReturns.length === 0 ? (
            <EmptyState icon="↩️" title="No customer returns" subtitle="Process a customer return to see it here" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b dm-border-card" style={{ background: 'var(--bg-table-head)' }}>
                  <tr>{['Return #', 'Invoice #', 'Date', 'Items Returned', 'Refund Amount', 'Reason', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold dm-text-muted uppercase">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y dm-border-card">
                  {customerReturns.map(r => (
                    <tr key={r.id} className="dm-row-hover">
                      <td className="px-4 py-3 font-mono text-xs font-semibold dm-text-primary">{r.return_number}</td>
                      <td className="px-4 py-3 dm-text-secondary">{r.invoice_number}</td>
                      <td className="px-4 py-3 dm-text-muted text-xs">{new Date(r.return_date || r.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3 text-center dm-text-secondary font-semibold">{parseInt(r.item_count) || 0}</td>
                      <td className="px-4 py-3 font-semibold text-emerald-600">NPR {fmt(r.total_refund)}</td>
                      <td className="px-4 py-3 dm-text-muted">{r.reason || '—'}</td>
                      <td className="px-4 py-3"><span className="badge-green">{r.status}</span></td>
                      <td className="px-4 py-3">
                        <button onClick={() => openDetail('customer', r.id)}
                          className="text-xs px-2 py-1 rounded-lg border dm-border-card dm-text-secondary hover:border-emerald-400 hover:text-emerald-600 transition-colors">
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          supplierReturns.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-3">🔄</div>
              <p className="font-semibold dm-text-secondary">No supplier returns yet</p>
              <p className="text-sm dm-text-muted mt-1">Process a supplier return using the button above</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b dm-border-card" style={{ background: 'var(--bg-table-head)' }}>
                  <tr>{['Return #', 'Supplier', 'Date', 'Items', 'Value', 'Reason', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold dm-text-muted uppercase">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y dm-border-card">
                  {supplierReturns.map(r => (
                    <tr key={r.id} className="dm-row-hover">
                      <td className="px-4 py-3 font-mono text-xs font-semibold dm-text-primary">{r.return_number || `SR-${r.id}`}</td>
                      <td className="px-4 py-3 dm-text-secondary">{r.supplier_name || '—'}</td>
                      <td className="px-4 py-3 dm-text-muted text-xs">{new Date(r.return_date || r.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3 text-center dm-text-secondary font-semibold">{parseInt(r.item_count) || 0}</td>
                      <td className="px-4 py-3 font-semibold text-orange-600">NPR {fmt(r.total_amount)}</td>
                      <td className="px-4 py-3 capitalize dm-text-muted">{r.reason || '—'}</td>
                      <td className="px-4 py-3"><span className="badge-yellow">{r.status || 'processed'}</span></td>
                      <td className="px-4 py-3">
                        <button onClick={() => openDetail('supplier', r.id)}
                          className="text-xs px-2 py-1 rounded-lg border dm-border-card dm-text-secondary hover:border-orange-400 hover:text-orange-600 transition-colors">
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Return Detail Modal */}
      <Modal open={!!detailModal} onClose={() => setDetailModal(null)}
        title={detailModal?.type === 'customer' ? '↩️ Customer Return Details' : '🔄 Supplier Return Details'}
        size="lg">
        {loadingDetail || !detailModal?.data ? (
          <div className="p-8 flex justify-center"><LoadingSpinner /></div>
        ) : detailModal.type === 'customer' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-table-head)' }}>
                <div className="text-xs dm-text-muted mb-1">Return Number</div>
                <div className="font-bold dm-text-primary font-mono">{detailModal.data.return_number}</div>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-table-head)' }}>
                <div className="text-xs dm-text-muted mb-1">Original Invoice</div>
                <div className="font-bold dm-text-primary">{detailModal.data.invoice_number}</div>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-table-head)' }}>
                <div className="text-xs dm-text-muted mb-1">Customer</div>
                <div className="font-medium dm-text-primary">{detailModal.data.customer_name || 'Walk-in'}</div>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-table-head)' }}>
                <div className="text-xs dm-text-muted mb-1">Return Date</div>
                <div className="font-medium dm-text-primary">{new Date(detailModal.data.return_date || detailModal.data.created_at).toLocaleString()}</div>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-table-head)' }}>
                <div className="text-xs dm-text-muted mb-1">Reason</div>
                <div className="font-medium dm-text-primary">{detailModal.data.reason || '—'}</div>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-table-head)' }}>
                <div className="text-xs dm-text-muted mb-1">Processed By</div>
                <div className="font-medium dm-text-primary">{detailModal.data.created_by_name || '—'}</div>
              </div>
            </div>
            <div className="border dm-border-card rounded-lg overflow-hidden">
              <div className="px-4 py-2 text-xs font-semibold dm-text-muted uppercase" style={{ background: 'var(--bg-table-head)' }}>Returned Items</div>
              <table className="w-full text-sm">
                <thead style={{ background: 'var(--bg-table-head)' }}>
                  <tr>
                    {['Medicine', 'Qty Returned', 'Unit Price', 'Refund Amount'].map(h => (
                      <th key={h} className="text-left px-4 py-2 text-xs font-semibold dm-text-muted">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y dm-border-card">
                  {(detailModal.data.items || []).map((item, i) => (
                    <tr key={i} className="dm-row-hover">
                      <td className="px-4 py-2 font-medium dm-text-primary">{item.medicine_name}</td>
                      <td className="px-4 py-2 dm-text-secondary">{item.quantity}</td>
                      <td className="px-4 py-2 dm-text-secondary">NPR {fmt(item.unit_price)}</td>
                      <td className="px-4 py-2 font-semibold text-emerald-600">NPR {fmt(item.refund_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end">
              <div className="rounded-lg px-5 py-3 bg-emerald-50 border border-emerald-200 text-emerald-700">
                <span className="text-sm">Total Refund: </span>
                <span className="text-lg font-bold">NPR {fmt(detailModal.data.total_refund)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-table-head)' }}>
                <div className="text-xs dm-text-muted mb-1">Return Number</div>
                <div className="font-bold dm-text-primary font-mono">{detailModal.data.return_number}</div>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-table-head)' }}>
                <div className="text-xs dm-text-muted mb-1">Supplier</div>
                <div className="font-bold dm-text-primary">{detailModal.data.supplier_name || '—'}</div>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-table-head)' }}>
                <div className="text-xs dm-text-muted mb-1">Return Date</div>
                <div className="font-medium dm-text-primary">{new Date(detailModal.data.return_date || detailModal.data.created_at).toLocaleString()}</div>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-table-head)' }}>
                <div className="text-xs dm-text-muted mb-1">Reason</div>
                <div className="font-medium dm-text-primary capitalize">{detailModal.data.reason || '—'}</div>
              </div>
              <div className="rounded-lg p-3 col-span-2" style={{ background: 'var(--bg-table-head)' }}>
                <div className="text-xs dm-text-muted mb-1">Notes</div>
                <div className="font-medium dm-text-primary">{detailModal.data.notes || '—'}</div>
              </div>
            </div>
            <div className="border dm-border-card rounded-lg overflow-hidden">
              <div className="px-4 py-2 text-xs font-semibold dm-text-muted uppercase" style={{ background: 'var(--bg-table-head)' }}>Returned Items</div>
              <table className="w-full text-sm">
                <thead style={{ background: 'var(--bg-table-head)' }}>
                  <tr>
                    {['Medicine', 'Batch', 'Qty', 'Purchase Rate', 'Total Value'].map(h => (
                      <th key={h} className="text-left px-4 py-2 text-xs font-semibold dm-text-muted">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y dm-border-card">
                  {(detailModal.data.items || []).map((item, i) => (
                    <tr key={i} className="dm-row-hover">
                      <td className="px-4 py-2 font-medium dm-text-primary">{item.medicine_name}</td>
                      <td className="px-4 py-2 font-mono text-xs dm-text-muted">{item.batch_number || '—'}</td>
                      <td className="px-4 py-2 dm-text-secondary">{item.quantity}</td>
                      <td className="px-4 py-2 dm-text-secondary">NPR {fmt(item.purchase_rate)}</td>
                      <td className="px-4 py-2 font-semibold text-orange-600">NPR {fmt(item.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end">
              <div className="rounded-lg px-5 py-3 bg-orange-50 border border-orange-200 text-orange-700">
                <span className="text-sm">Total Value: </span>
                <span className="text-lg font-bold">NPR {fmt(detailModal.data.total_amount)}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Customer Return Modal */}
      <Modal open={showCustomerModal} onClose={() => { setShowCustomerModal(false); setSaleData(null); setInvoiceNumber(''); }} title="Process Customer Return" size="lg">
        <div className="space-y-4">
          <div className="flex gap-2">
            <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchSale()}
              placeholder="Enter invoice number (e.g. INV-000001)"
              className="input flex-1" />
            <button onClick={searchSale} disabled={searchingSale} className="btn-primary px-4">
              {searchingSale ? '...' : '🔍 Find'}
            </button>
          </div>

          {saleData && (
            <>
              <div className="rounded-lg p-3 text-sm" style={{ background: 'var(--bg-table-head)' }}>
                <div className="flex justify-between flex-wrap gap-2">
                  <span className="dm-text-secondary">Invoice: <strong className="dm-text-primary">{saleData.invoice_number}</strong></span>
                  <span className="dm-text-secondary">Date: {new Date(saleData.sale_date).toLocaleDateString()}</span>
                  <span className="dm-text-secondary">Total: <strong className="text-emerald-600">NPR {fmt(saleData.total_amount)}</strong></span>
                </div>
                {saleData.customer_name && <div className="mt-1 dm-text-secondary">Customer: {saleData.customer_name}</div>}
              </div>

              <div className="text-sm font-medium dm-text-primary">Select items to return:</div>
              <div className="border dm-border-card rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead style={{ background: 'var(--bg-table-head)' }}>
                    <tr>
                      {['✓', 'Medicine', 'Sold Qty', 'Unit Price', 'Return Qty'].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-xs font-semibold dm-text-muted">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y dm-border-card">
                    {selectedItems.map((item, i) => (
                      <tr key={i} className="dm-row-hover">
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={item.selected || false} onChange={e => {
                            const updated = [...selectedItems];
                            updated[i] = { ...item, selected: e.target.checked };
                            setSelectedItems(updated);
                          }} className="w-4 h-4 rounded text-emerald-600" />
                        </td>
                        <td className="px-3 py-2 font-medium dm-text-primary">{item.medicine_name}</td>
                        <td className="px-3 py-2 dm-text-secondary">{item.quantity}</td>
                        <td className="px-3 py-2 dm-text-secondary">NPR {fmt(item.unit_price)}</td>
                        <td className="px-3 py-2">
                          <input type="number" min="0" max={item.quantity}
                            value={item.return_qty || 0}
                            onChange={e => {
                              const updated = [...selectedItems];
                              updated[i] = { ...item, return_qty: Math.min(parseInt(e.target.value) || 0, item.quantity) };
                              setSelectedItems(updated);
                            }}
                            disabled={!item.selected}
                            className="w-20 input px-2 py-1 text-xs disabled:opacity-50" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedItems.some(i => i.selected && i.return_qty > 0) && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">
                  <strong>Estimated Refund: NPR {
                    selectedItems
                      .filter(i => i.selected && i.return_qty > 0)
                      .reduce((s, i) => s + (i.return_qty * parseFloat(i.unit_price)), 0)
                      .toFixed(2)
                  }</strong>
                  <span className="ml-3 text-xs opacity-75">• Inventory will be restocked automatically</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium dm-text-primary mb-1">Return Reason</label>
                <input value={returnReason} onChange={e => setReturnReason(e.target.value)} className="input" placeholder="e.g. Expired, Wrong medicine, Customer complaint" />
              </div>

              <div className="flex gap-3 justify-end">
                <button onClick={() => { setShowCustomerModal(false); setSaleData(null); setInvoiceNumber(''); }} className="btn-secondary">Cancel</button>
                <button onClick={handleCustomerReturn} disabled={savingReturn} className="btn-primary">
                  {savingReturn ? 'Processing...' : 'Process Return'}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Supplier Return Modal */}
      <Modal open={showSupplierModal} onClose={() => setShowSupplierModal(false)} title="Process Supplier Return" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium dm-text-primary mb-1">Supplier *</label>
              <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="input">
                <option value="">Select Supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium dm-text-primary mb-1">Reason *</label>
              <select value={supplierReturnReason} onChange={e => setSupplierReturnReason(e.target.value)} className="input">
                <option value="damaged">Damaged Stock</option>
                <option value="expired">Expired Stock</option>
                <option value="wrong_item">Wrong Item</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium dm-text-primary mb-1">Search Medicine to Return</label>
            <div className="relative">
              <input value={medSearch} onChange={e => searchMedForReturn(e.target.value)} placeholder="Type medicine name..." className="input" />
              {medResults.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 dm-bg-card dm-border-card border rounded-xl shadow-lg max-h-40 overflow-y-auto">
                  {medResults.map(m => (
                    <button key={m.id} onClick={() => selectMedForReturn(m)} className="w-full text-left px-3 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-sm border-b dm-border-card dm-text-primary">
                      {m.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {batches.length > 0 && (
            <div className="border dm-border-card rounded-lg overflow-hidden">
              <div className="px-3 py-2 text-xs font-semibold dm-text-muted" style={{ background: 'var(--bg-table-head)' }}>Select Batch to Return</div>
              {batches.map(b => (
                <button key={b.id} onClick={() => addSupplierReturnItem(b)}
                  className="w-full text-left px-3 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-sm border-b dm-border-card flex justify-between items-center dm-text-primary">
                  <span>Batch: {b.batch_number || 'N/A'} — Exp: {b.expiry_date ? new Date(b.expiry_date).toLocaleDateString() : 'N/A'}</span>
                  <span className="text-xs dm-text-muted">Qty: {b.available_quantity}</span>
                </button>
              ))}
            </div>
          )}

          {supplierReturnItems.length > 0 && (
            <div className="border dm-border-card rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead style={{ background: 'var(--bg-table-head)' }}><tr>
                  {['Medicine', 'Batch', 'Available', 'Return Qty', 'Value', ''].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-xs font-semibold dm-text-muted">{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y dm-border-card">
                  {supplierReturnItems.map((item, i) => (
                    <tr key={i} className="dm-row-hover">
                      <td className="px-3 py-2 font-medium dm-text-primary">{item.medicine_name}</td>
                      <td className="px-3 py-2 font-mono text-xs dm-text-muted">{item.batch_number || '—'}</td>
                      <td className="px-3 py-2 dm-text-secondary">{item.available_qty}</td>
                      <td className="px-3 py-2">
                        <input type="number" min="1" max={item.available_qty} value={item.quantity}
                          onChange={e => {
                            const updated = [...supplierReturnItems];
                            updated[i] = { ...updated[i], quantity: Math.min(parseInt(e.target.value) || 1, item.available_qty) };
                            setSupplierReturnItems(updated);
                          }}
                          className="w-20 input px-2 py-1 text-xs" />
                      </td>
                      <td className="px-3 py-2 text-xs dm-text-secondary">NPR {fmt(item.quantity * item.purchase_rate)}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => setSupplierReturnItems(supplierReturnItems.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-3 py-2 text-right text-sm font-semibold text-orange-600 border-t dm-border-card">
                Total: NPR {fmt(supplierReturnItems.reduce((s, i) => s + i.quantity * i.purchase_rate, 0))}
                <span className="ml-3 text-xs font-normal dm-text-muted">• Inventory will be deducted automatically</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium dm-text-primary mb-1">Notes</label>
            <input value={supplierReturnNotes} onChange={e => setSupplierReturnNotes(e.target.value)} className="input" placeholder="Optional notes" />
          </div>

          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowSupplierModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSupplierReturn} disabled={savingReturn} className="bg-orange-600 text-white px-4 py-2 rounded-xl hover:bg-orange-700 font-medium text-sm disabled:opacity-50">
              {savingReturn ? 'Processing...' : 'Process Return'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}