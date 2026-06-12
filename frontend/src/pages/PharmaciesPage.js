import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { Modal, ConfirmDialog, Pagination, LoadingSpinner, EmptyState, SearchInput, Badge } from '../components/UI';
import toast from 'react-hot-toast';

const defForm = {
  name: '', address: '', phone: '', email: '', license_number: '', tax_number: '',
  invoice_prefix: 'INV', tax_rate: 0, currency: 'NPR',
  admin_name: '', admin_email: '', admin_password: '',
  subscription_expires_at: '', is_active: true
};

export default function PharmaciesPage() {
  const [pharmacies, setPharmacies] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewModal, setViewModal] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [renewModal, setRenewModal] = useState(null); // holds the pharmacy object
  const [renewDate, setRenewDate] = useState('');
  const [renewing, setRenewing] = useState(false);
  const [form, setForm] = useState(defForm);
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page, limit: 15 });
      if (search) p.set('search', search);
      const { data } = await api.get(`/superadmin/pharmacies?${p}`);
      setPharmacies(data.data);
      setPagination(data.pagination);
    } catch { toast.error('Failed to load pharmacies'); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { fetch(); }, [fetch]);

  const openCreate = () => { setEditing(null); setForm(defForm); setShowModal(true); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({
      ...defForm, ...p,
      subscription_expires_at: p.subscription_expires_at ? p.subscription_expires_at.split('T')[0] : '',
      admin_name: '', admin_email: '', admin_password: ''
    });
    setShowModal(true);
  };
  const viewDetails = async (id) => {
    const { data } = await api.get(`/superadmin/pharmacies/${id}`);
    setViewModal(data.data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return toast.error('Pharmacy name is required');
    if (!editing && (!form.admin_email || !form.admin_password)) return toast.error('Admin email and password are required for new pharmacy');
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/superadmin/pharmacies/${editing.id}`, form);
        toast.success('Pharmacy updated');
      } else {
        await api.post('/superadmin/pharmacies', form);
        toast.success('Pharmacy created with admin account');
      }
      setShowModal(false);
      fetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleRenew = async () => {
    if (!renewDate) return toast.error('Please select a new expiry date');
    setRenewing(true);
    try {
      await api.post(`/superadmin/pharmacies/${renewModal.id}/renew`, { subscription_expires_at: renewDate });
      toast.success('Subscription renewed successfully');
      setRenewModal(null);
      setRenewDate('');
      fetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to renew');
    } finally { setRenewing(false); }
  };

  const handleDelete = async () => {    try {
      await api.delete(`/superadmin/pharmacies/${deleteId}`);
      toast.success('Pharmacy deleted');
      setDeleteId(null);
      fetch();
    } catch { toast.error('Failed to delete'); }
  };

  const fmt = n => new Intl.NumberFormat('en-NP').format(n || 0);
  const fmtDate = d => d ? new Date(d).toLocaleDateString() : '—';

  const getExpiryBadge = (expiresAt, isActive) => {
    if (!expiresAt) return <Badge type="gray">No Expiry</Badge>;
    const now = new Date();
    const exp = new Date(expiresAt);
    const daysLeft = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return <Badge type="red">Expired</Badge>;
    if (daysLeft <= 30) return <Badge type="yellow">Expires Soon</Badge>;
    return <Badge type="green">Active</Badge>;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold dm-text-primary">Pharmacies</h1>
          <p className="text-sm dm-text-muted mt-1">Manage all pharmacies on the platform</p>
        </div>
        <button onClick={openCreate} className="btn-primary">+ Add Pharmacy</button>
      </div>

      <div className="card p-4">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search by name or email..." />
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? <LoadingSpinner /> : pharmacies.length === 0 ? (
          <EmptyState icon="🏥" title="No pharmacies yet"
            subtitle="Add your first pharmacy to get started"
            action={<button onClick={openCreate} className="btn-primary">+ Add Pharmacy</button>}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Pharmacy', 'Contact', 'Users', 'Medicines', 'Total Sales', 'Registered', 'Expires', 'Status', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold dm-text-muted uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-y dm-border-card">
                  {pharmacies.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium dm-text-primary">{p.name}</div>
                        <div className="text-xs dm-text-muted">{p.license_number || '—'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs dm-text-secondary">{p.phone || '—'}</div>
                        <div className="text-xs dm-text-muted">{p.email || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                          {p.user_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-700 text-xs font-bold">
                          {p.medicine_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-green-700 text-sm">
                        NPR {fmt(p.total_sales)}
                      </td>
                      <td className="px-4 py-3 text-xs dm-text-muted">
                        {fmtDate(p.created_at)}
                      </td>
                      <td className="px-4 py-3 text-xs dm-text-muted">
                        {fmtDate(p.subscription_expires_at)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge type={p.is_active ? 'green' : 'red'}>
                          {p.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => viewDetails(p.id)} className="dm-text-muted hover:dm-text-primary text-xs font-medium">View</button>
                          <button onClick={() => openEdit(p)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Edit</button>
                          <button onClick={() => { setRenewModal(p); setRenewDate(''); }} className="text-green-600 hover:text-green-800 text-xs font-medium">Renew</button>
                          <button onClick={() => setDeleteId(p.id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 pb-4">
              <Pagination pagination={pagination} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? `Edit: ${editing.name}` : 'Add New Pharmacy'} size="xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Pharmacy Info */}
          <div>
            <h3 className="text-sm font-semibold dm-text-primary mb-3 pb-1 border-b">🏥 Pharmacy Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium dm-text-secondary mb-1">Pharmacy Name *</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input text-sm" required placeholder="e.g. City Pharmacy" />
              </div>
              <div>
                <label className="block text-xs font-medium dm-text-secondary mb-1">Email</label>
                <input type="email" value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})} className="input text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium dm-text-secondary mb-1">Phone</label>
                <input value={form.phone || ''} onChange={e => setForm({...form, phone: e.target.value})} className="input text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium dm-text-secondary mb-1">License Number</label>
                <input value={form.license_number || ''} onChange={e => setForm({...form, license_number: e.target.value})} className="input text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium dm-text-secondary mb-1">Tax/VAT Number</label>
                <input value={form.tax_number || ''} onChange={e => setForm({...form, tax_number: e.target.value})} className="input text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium dm-text-secondary mb-1">Currency</label>
                <select value={form.currency || 'NPR'} onChange={e => setForm({...form, currency: e.target.value})} className="input text-sm">
                  {['NPR', 'USD', 'EUR', 'GBP', 'INR', 'PKR', 'BDT', 'LKR'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium dm-text-secondary mb-1">Invoice Prefix</label>
                <input value={form.invoice_prefix || 'INV'} onChange={e => setForm({...form, invoice_prefix: e.target.value})} className="input text-sm" maxLength={10} />
              </div>
              <div>
                <label className="block text-xs font-medium dm-text-secondary mb-1">Tax Rate (%)</label>
                <input type="number" step="0.01" min="0" max="100" value={form.tax_rate || 0} onChange={e => setForm({...form, tax_rate: e.target.value})} className="input text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium dm-text-secondary mb-1">Address</label>
                <textarea value={form.address || ''} onChange={e => setForm({...form, address: e.target.value})} className="input text-sm" rows={2} />
              </div>
            </div>
          </div>

          {/* Subscription */}
          <div>
            <h3 className="text-sm font-semibold dm-text-primary mb-3 pb-1 border-b">📋 Subscription</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium dm-text-secondary mb-1">Subscription Expires At</label>
                <input
                  type="date"
                  value={form.subscription_expires_at || ''}
                  onChange={e => setForm({...form, subscription_expires_at: e.target.value})}
                  className="input text-sm"
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_active !== false} onChange={e => setForm({...form, is_active: e.target.checked})} className="rounded" />
                  <span className="text-sm font-medium dm-text-primary">Active</span>
                </label>
              </div>
            </div>
          </div>

          {/* Admin Account (create only) */}
          {!editing && (
            <div>
              <h3 className="text-sm font-semibold dm-text-primary mb-3 pb-1 border-b">👤 Admin Account</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium dm-text-secondary mb-1">Admin Name</label>
                  <input value={form.admin_name} onChange={e => setForm({...form, admin_name: e.target.value})} className="input text-sm" placeholder="e.g. John Doe" />
                </div>
                <div>
                  <label className="block text-xs font-medium dm-text-secondary mb-1">Admin Email *</label>
                  <input type="email" value={form.admin_email} onChange={e => setForm({...form, admin_email: e.target.value})} className="input text-sm" required={!editing} />
                </div>
                <div>
                  <label className="block text-xs font-medium dm-text-secondary mb-1">Admin Password *</label>
                  <input type="password" value={form.admin_password} onChange={e => setForm({...form, admin_password: e.target.value})} className="input text-sm" required={!editing} minLength={6} />
                </div>
              </div>
              <p className="text-xs dm-text-muted mt-2">
                💡 An admin account will be created automatically. The admin can then create staff accounts.
              </p>
            </div>
          )}

          <div className="flex gap-3 justify-end border-t pt-4">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : editing ? 'Update Pharmacy' : 'Create Pharmacy'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Details Modal */}
      <Modal open={!!viewModal} onClose={() => setViewModal(null)} title={viewModal?.name} size="lg">
        {viewModal && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Users', value: viewModal.user_count, icon: '👥', color: 'bg-blue-50 text-blue-700' },
                { label: 'Medicines', value: viewModal.medicine_count, icon: '💊', color: 'bg-green-50 text-green-700' },
                { label: "Today's Sales", value: viewModal.today_sales_count, icon: '🧾', color: 'bg-yellow-50 text-yellow-700' },
                { label: 'Total Revenue', value: `NPR ${fmt(viewModal.total_sales)}`, icon: '💰', color: 'bg-purple-50 text-purple-700' },
              ].map(s => (
                <div key={s.label} className={`rounded-xl p-4 ${s.color}`}>
                  <div className="text-2xl mb-1">{s.icon}</div>
                  <div className="text-xl font-bold">{s.value}</div>
                  <div className="text-xs opacity-75">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Email', viewModal.email],
                ['Phone', viewModal.phone],
                ['License', viewModal.license_number],
                ['Tax Number', viewModal.tax_number],
                ['Currency', viewModal.currency],
                ['Invoice Prefix', viewModal.invoice_prefix],
                ['Tax Rate', `${viewModal.tax_rate}%`],
                ['Registered', viewModal.created_at ? new Date(viewModal.created_at).toLocaleDateString() : '—'],
                ['Expires At', viewModal.subscription_expires_at ? new Date(viewModal.subscription_expires_at).toLocaleDateString() : '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="dm-text-muted font-medium min-w-24">{k}:</span>
                  <span className="text-gray-800">{v || '—'}</span>
                </div>
              ))}
            </div>

            {viewModal.address && (
              <div className="text-sm">
                <span className="dm-text-muted font-medium">Address:</span>
                <p className="dm-text-primary mt-1">{viewModal.address}</p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Badge type={viewModal.is_active ? 'green' : 'red'}>{viewModal.is_active ? 'Active' : 'Inactive'}</Badge>
              {viewModal.subscription_expires_at && (() => {
                const daysLeft = Math.ceil((new Date(viewModal.subscription_expires_at) - new Date()) / (1000 * 60 * 60 * 24));
                if (daysLeft < 0) return <Badge type="red">Subscription Expired</Badge>;
                if (daysLeft <= 30) return <Badge type="yellow">{daysLeft}d until expiry</Badge>;
                return <Badge type="green">{daysLeft}d remaining</Badge>;
              })()}
            </div>
          </div>
        )}
      </Modal>

      {/* Renew Subscription Modal */}
      <Modal open={!!renewModal} onClose={() => setRenewModal(null)} title={`Renew: ${renewModal?.name}`} size="sm">
        {renewModal && (
          <div className="space-y-4">
            <div className="rounded-xl p-4 bg-green-50 text-green-800 text-sm">
              <div className="font-semibold mb-1">Current expiry</div>
              <div>{renewModal.subscription_expires_at ? new Date(renewModal.subscription_expires_at).toLocaleDateString() : 'Not set'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium dm-text-primary mb-1">New Expiry Date *</label>
              <input
                type="date"
                value={renewDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setRenewDate(e.target.value)}
                className="input text-sm w-full"
              />
              <p className="text-xs dm-text-muted mt-1">The pharmacy will be set to Active and users will regain access immediately.</p>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setRenewModal(null)} className="btn-secondary">Cancel</button>
              <button onClick={handleRenew} disabled={renewing || !renewDate} className="btn-primary">
                {renewing ? 'Renewing...' : '🔄 Renew Subscription'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="Delete Pharmacy"
        message="Are you sure you want to delete this pharmacy? All associated data will be soft-deleted and can be restored."
        confirmText="Delete" type="danger"
      />
    </div>
  );
}