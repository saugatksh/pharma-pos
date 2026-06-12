// UsersPage.js
import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Modal, LoadingSpinner, EmptyState, Badge } from '../components/UI';
import toast from 'react-hot-toast';

export function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [resetId, setResetId] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', role: 'staff', is_active: true });
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users');
      setUsers(data.data);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', email: '', phone: '', password: '', role: 'staff', is_active: true });
    setShowModal(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    setForm({ name: u.name, phone: u.phone || '', role: u.role, is_active: u.is_active });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/users/${editing.id}`, form);
        toast.success('User updated');
      } else {
        await api.post('/users', form);
        toast.success('User created');
      }
      setShowModal(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!newPassword || newPassword.length < 6) return toast.error('Password must be at least 6 characters');
    try {
      await api.put(`/users/${resetId}/reset-password`, { new_password: newPassword });
      toast.success('Password reset');
      setResetId(null);
      setNewPassword('');
    } catch {
      toast.error('Failed');
    }
  };

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold dm-text-primary">User Management</h1>
        <button onClick={openAdd} className="btn-primary text-sm whitespace-nowrap">
          + Add User
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <LoadingSpinner />
        ) : users.length === 0 ? (
          <EmptyState icon="👥" title="No users" />
        ) : (
          <>
            {/* ── Desktop table (md+) ── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Name', 'Email', 'Phone', 'Role', 'Last Login', 'Status', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold dm-text-muted uppercase whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y dm-border-card">
                  {users.map(u => (
                    <tr key={u.id} className="dm-row-hover">
                      <td className="px-4 py-3 font-medium dm-text-primary whitespace-nowrap">{u.name}</td>
                      <td className="px-4 py-3 dm-text-secondary">{u.email}</td>
                      <td className="px-4 py-3 dm-text-muted">{u.phone || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge type={u.role === 'admin' ? 'green' : 'blue'}>{u.role}</Badge>
                      </td>
                      <td className="px-4 py-3 dm-text-muted text-xs whitespace-nowrap">
                        {u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge type={u.is_active ? 'green' : 'gray'}>{u.is_active ? 'Active' : 'Disabled'}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-3">
                          <button
                            onClick={() => openEdit(u)}
                            className="text-blue-600 text-xs font-medium hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setResetId(u.id)}
                            className="text-orange-500 text-xs hover:underline"
                          >
                            Reset Pwd
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Mobile cards (< md) ── */}
            <div className="md:hidden divide-y dm-border-card">
              {users.map(u => (
                <div key={u.id} className="p-4 space-y-3">
                  {/* Top row: name + status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold dm-text-primary truncate">{u.name}</p>
                      <p className="text-xs dm-text-secondary truncate mt-0.5">{u.email}</p>
                    </div>
                    <Badge type={u.is_active ? 'green' : 'gray'} className="flex-shrink-0">
                      {u.is_active ? 'Active' : 'Disabled'}
                    </Badge>
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <div>
                      <span className="dm-text-muted">Phone</span>
                      <p className="dm-text-secondary font-medium mt-0.5">{u.phone || '—'}</p>
                    </div>
                    <div>
                      <span className="dm-text-muted">Role</span>
                      <div className="mt-0.5">
                        <Badge type={u.role === 'admin' ? 'green' : 'blue'}>{u.role}</Badge>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <span className="dm-text-muted">Last Login</span>
                      <p className="dm-text-secondary font-medium mt-0.5">
                        {u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => openEdit(u)}
                      className="flex-1 py-1.5 rounded-lg text-xs font-medium text-blue-600 border border-blue-200 hover:bg-blue-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setResetId(u.id)}
                      className="flex-1 py-1.5 rounded-lg text-xs font-medium text-orange-500 border border-orange-200 hover:bg-orange-50 transition-colors"
                    >
                      Reset Password
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Add / Edit User Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit User' : 'Add User'}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium dm-text-primary mb-1">Name *</label>
            <input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="input"
              required
            />
          </div>
          {!editing && (
            <div>
              <label className="block text-sm font-medium dm-text-primary mb-1">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="input"
                required
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium dm-text-primary mb-1">Phone</label>
            <input
              value={form.phone || ''}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              className="input"
            />
          </div>
          {!editing && (
            <div>
              <label className="block text-sm font-medium dm-text-primary mb-1">Password *</label>
              <input
                type="password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="input"
                required
                minLength={6}
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium dm-text-primary mb-1">Role</label>
            <select
              value={form.role}
              onChange={e => setForm({ ...form, role: e.target.value })}
              className="input"
            >
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ua"
              checked={form.is_active !== false}
              onChange={e => setForm({ ...form, is_active: e.target.checked })}
            />
            <label htmlFor="ua" className="text-sm dm-text-primary">Active</label>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal open={!!resetId} onClose={() => setResetId(null)} title="Reset Password" size="sm">
        <div className="space-y-3">
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="New password (min 6 chars)"
            className="input"
            minLength={6}
          />
          <div className="flex gap-3 justify-end">
            <button onClick={() => setResetId(null)} className="btn-secondary">Cancel</button>
            <button onClick={handleReset} className="btn-primary">Reset</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default UsersPage;
