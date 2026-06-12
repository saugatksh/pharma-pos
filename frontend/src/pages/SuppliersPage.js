// SuppliersPage.js
import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { Modal, ConfirmDialog, LoadingSpinner, EmptyState, SearchInput, Badge } from '../components/UI';
import toast from 'react-hot-toast';

const defForm = { name: '', contact_person: '', phone: '', email: '', address: '' };

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defForm);
  const [deleteId, setDeleteId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [historyModal, setHistoryModal] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTab, setHistoryTab] = useState('purchases');
  const [historySupplierName, setHistorySupplierName] = useState('');

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (search) p.set('search', search);
      const { data } = await api.get(`/suppliers?${p}`);
      setSuppliers(data.data);
    } catch { toast.error('Failed to load suppliers'); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  const openCreate = () => { setEditing(null); setForm(defForm); setShowModal(true); };
  const openEdit = (s) => { setEditing(s); setForm(s); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return toast.error('Name is required');
    setSaving(true);
    try {
      if (editing) { await api.put(`/suppliers/${editing.id}`, form); toast.success('Supplier updated'); }
      else { await api.post('/suppliers', form); toast.success('Supplier added'); }
      setShowModal(false); fetchSuppliers();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try { await api.delete(`/suppliers/${deleteId}`); toast.success('Supplier deleted'); setDeleteId(null); fetchSuppliers(); }
    catch { toast.error('Failed to delete'); }
  };

  const viewHistory = async (supplier) => {
    setHistorySupplierName(supplier.name);
    setHistoryLoading(true);
    setHistoryModal({ purchases: [], returns: [] });
    setHistoryTab('purchases');
    try {
      const [purchasesRes, returnsRes] = await Promise.allSettled([
        api.get(`/suppliers/${supplier.id}/purchases`),
        api.get(`/suppliers/${supplier.id}/returns`),
      ]);
      const purchases = purchasesRes.status === 'fulfilled' ? purchasesRes.value.data.data || [] : [];
      const returns = returnsRes.status === 'fulfilled' ? returnsRes.value.data.data || [] : [];
      setHistoryModal({ purchases, returns });
    } catch { toast.error('Failed to load history'); }
    finally { setHistoryLoading(false); }
  };

  const fmt = (n) => parseFloat(n || 0).toFixed(2);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold dm-text-primary">Suppliers</h1>
          <p className="text-sm dm-text-muted mt-0.5">Manage your medicine suppliers</p>
        </div>
        <button onClick={openCreate} className="btn-primary whitespace-nowrap">+ Add Supplier</button>
      </div>

      <div className="card p-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search suppliers..." />
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? <LoadingSpinner /> : suppliers.length === 0 ? (
          <EmptyState icon="🏭" title="No suppliers" action={<button onClick={openCreate} className="btn-primary">+ Add Supplier</button>} />
        ) : (
          <>
            {/* ── Desktop table (md+) ── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b dm-border-card" style={{ background: 'var(--bg-table-head)' }}>
                    {['Name', 'Contact Person', 'Phone', 'Email', 'Status', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold dm-text-muted uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y dm-border-card">
                  {suppliers.map(s => (
                    <tr key={s.id} className="dm-row-hover transition-colors">
                      <td className="px-4 py-3 font-semibold dm-text-primary">{s.name}</td>
                      <td className="px-4 py-3 dm-text-secondary">{s.contact_person || '—'}</td>
                      <td className="px-4 py-3 dm-text-secondary">{s.phone || '—'}</td>
                      <td className="px-4 py-3 dm-text-secondary">{s.email || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge type={s.is_active ? 'green' : 'gray'}>{s.is_active ? 'Active' : 'Inactive'}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => viewHistory(s)} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors">History</button>
                          <button onClick={() => openEdit(s)} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">Edit</button>
                          <button onClick={() => setDeleteId(s.id)} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Mobile cards (< md) ── */}
            <div className="md:hidden divide-y dm-border-card">
              {suppliers.map(s => (
                <div key={s.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold dm-text-primary">{s.name}</p>
                      {s.contact_person && <p className="text-xs dm-text-muted mt-0.5">{s.contact_person}</p>}
                    </div>
                    <Badge type={s.is_active ? 'green' : 'gray'} className="flex-shrink-0">
                      {s.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <div>
                      <span className="dm-text-muted">Phone</span>
                      <p className="dm-text-secondary font-medium mt-0.5">{s.phone || '—'}</p>
                    </div>
                    <div>
                      <span className="dm-text-muted">Email</span>
                      <p className="dm-text-secondary font-medium mt-0.5 truncate">{s.email || '—'}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => viewHistory(s)} className="flex-1 py-1.5 rounded-lg text-xs font-medium text-emerald-700 border border-emerald-200 hover:bg-emerald-50 transition-colors">History</button>
                    <button onClick={() => openEdit(s)} className="flex-1 py-1.5 rounded-lg text-xs font-medium text-blue-700 border border-blue-200 hover:bg-blue-50 transition-colors">Edit</button>
                    <button onClick={() => setDeleteId(s.id)} className="flex-1 py-1.5 rounded-lg text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Add/Edit Supplier Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Supplier' : 'Add Supplier'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium dm-text-primary mb-1">Name *</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input" required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium dm-text-primary mb-1">Contact Person</label>
              <input value={form.contact_person || ''} onChange={e => setForm({...form, contact_person: e.target.value})} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium dm-text-primary mb-1">Phone</label>
              <input value={form.phone || ''} onChange={e => setForm({...form, phone: e.target.value})} className="input" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium dm-text-primary mb-1">Email</label>
              <input type="email" value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})} className="input" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium dm-text-primary mb-1">Address</label>
            <textarea value={form.address || ''} onChange={e => setForm({...form, address: e.target.value})} className="input" rows={2} />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : editing ? 'Update Supplier' : 'Add Supplier'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Supplier History Modal */}
      <Modal
        open={!!historyModal}
        onClose={() => setHistoryModal(null)}
        title={`${historySupplierName} — History`}
        size="lg"
      >
        {historyModal && (
          <div className="space-y-4">
            <div className="flex gap-2 border-b dm-border-card pb-3">
              <button
                onClick={() => setHistoryTab('purchases')}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  historyTab === 'purchases'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'dm-bg-card dm-text-secondary border dm-border-card hover:border-emerald-300'
                }`}
              >
                🛒 Purchases {historyModal.purchases.length > 0 && `(${historyModal.purchases.length})`}
              </button>
              <button
                onClick={() => setHistoryTab('returns')}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  historyTab === 'returns'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'dm-bg-card dm-text-secondary border dm-border-card hover:border-amber-300'
                }`}
              >
                ↩ Returns {historyModal.returns.length > 0 && `(${historyModal.returns.length})`}
              </button>
            </div>

            {historyLoading ? (
              <LoadingSpinner />
            ) : historyTab === 'purchases' ? (
              historyModal.purchases.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">🛒</div>
                  <p className="dm-text-muted text-sm">No purchases from this supplier</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border dm-border-card">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: 'var(--bg-table-head)' }}>
                        {['PO Number', 'Date', 'Invoice #', 'Total', 'Status'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-semibold dm-text-muted uppercase whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y dm-border-card">
                      {historyModal.purchases.map(p => (
                        <tr key={p.id} className="dm-row-hover">
                          <td className="px-4 py-3 font-mono text-xs font-bold dm-text-primary">{p.purchase_number}</td>
                          <td className="px-4 py-3 dm-text-secondary text-xs whitespace-nowrap">{new Date(p.purchase_date).toLocaleDateString()}</td>
                          <td className="px-4 py-3 dm-text-muted">{p.invoice_number || '—'}</td>
                          <td className="px-4 py-3 font-semibold dm-text-primary whitespace-nowrap">NPR {fmt(p.total_amount)}</td>
                          <td className="px-4 py-3"><Badge type="green">{p.status}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : historyModal.returns.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">↩</div>
                <p className="dm-text-muted text-sm">No returns recorded for this supplier</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border dm-border-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'var(--bg-table-head)' }}>
                      {['Return #', 'Date', 'Reason', 'Total', 'Notes'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold dm-text-muted uppercase whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y dm-border-card">
                    {historyModal.returns.map(r => (
                      <tr key={r.id} className="dm-row-hover">
                        <td className="px-4 py-3 font-mono text-xs font-bold dm-text-primary">{r.return_number}</td>
                        <td className="px-4 py-3 dm-text-secondary text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3 dm-text-secondary">{r.reason || '—'}</td>
                        <td className="px-4 py-3 font-semibold text-amber-600 whitespace-nowrap">NPR {fmt(r.total_amount)}</td>
                        <td className="px-4 py-3 dm-text-muted text-xs">{r.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Supplier"
        message="Are you sure you want to delete this supplier? This action cannot be undone."
        confirmText="Delete"
        type="danger"
      />
    </div>
  );
}
