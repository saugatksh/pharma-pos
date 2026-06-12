import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { LoadingSpinner, EmptyState, Pagination } from '../components/UI';
import toast from 'react-hot-toast';

export default function AuditLogsPage({ superAdmin = false }) {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [module, setModule] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const MODULES = ['Auth', 'Sales', 'Purchases', 'Inventory', 'Medicines', 'Suppliers', 'Users', 'Pharmacies', 'Settings'];

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page, limit: 50 });
      if (module) p.set('module', module);
      if (fromDate) p.set('from_date', fromDate);
      if (toDate) p.set('to_date', toDate);
      const endpoint = superAdmin ? `/superadmin/audit-logs?${p}` : `/reports/audit-logs?${p}`;
      const { data } = await api.get(endpoint);
      setLogs(data.data);
      setPagination(data.pagination);
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [page, module, fromDate, toDate, superAdmin]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const actionColor = (action) => {
    if (action.includes('Created') || action.includes('Added') || action.includes('Login')) return 'text-green-600 bg-green-50';
    if (action.includes('Updated') || action.includes('Adjusted') || action.includes('Reset')) return 'text-blue-600 bg-blue-50';
    if (action.includes('Deleted') || action.includes('Cancelled')) return 'text-red-600 bg-red-50';
    return 'dm-text-secondary bg-gray-50';
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold dm-text-primary">Audit Logs</h1>
        <p className="dm-text-muted text-sm mt-1">Track all actions performed in the system</p>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium dm-text-secondary mb-1">Module</label>
            <select
              value={module}
              onChange={e => { setModule(e.target.value); setPage(1); }}
              className="input w-full"
            >
              <option value="">All Modules</option>
              {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium dm-text-secondary mb-1">From Date</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="input w-full" />
          </div>
          <div>
            <label className="block text-xs font-medium dm-text-secondary mb-1">To Date</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="input w-full" />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => { setModule(''); setFromDate(''); setToDate(''); setPage(1); }}
              className="btn-secondary text-sm w-full"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Table / Cards */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <LoadingSpinner />
        ) : logs.length === 0 ? (
          <EmptyState icon="📋" title="No audit logs found" />
        ) : (
          <>
            {/* ── Desktop table (md+) ── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {[
                      ...(superAdmin ? ['Pharmacy'] : []),
                      'User', 'Action', 'Module', 'Entity', 'IP Address', 'Date & Time'
                    ].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold dm-text-muted uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y dm-border-card">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      {superAdmin && (
                        <td className="px-4 py-3 text-xs dm-text-muted">{log.pharmacy_name || '—'}</td>
                      )}
                      <td className="px-4 py-3">
                        <div className="font-medium dm-text-primary text-xs">{log.user_name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${actionColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs dm-text-muted">{log.module}</td>
                      <td className="px-4 py-3 text-xs dm-text-muted">
                        {log.entity_type && `${log.entity_type}${log.entity_id ? ` #${log.entity_id}` : ''}`}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono dm-text-muted">{log.ip_address || '—'}</td>
                      <td className="px-4 py-3 text-xs dm-text-muted whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Mobile cards (< md) ── */}
            <div className="md:hidden divide-y dm-border-card">
              {logs.map(log => (
                <div key={log.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium dm-text-primary">{log.user_name}</p>
                      {superAdmin && log.pharmacy_name && (
                        <p className="text-xs dm-text-muted mt-0.5">{log.pharmacy_name}</p>
                      )}
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${actionColor(log.action)}`}>
                      {log.action}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div>
                      <span className="dm-text-muted">Module</span>
                      <p className="dm-text-secondary font-medium">{log.module}</p>
                    </div>
                    {log.entity_type && (
                      <div>
                        <span className="dm-text-muted">Entity</span>
                        <p className="dm-text-secondary font-medium">
                          {log.entity_type}{log.entity_id ? ` #${log.entity_id}` : ''}
                        </p>
                      </div>
                    )}
                    <div>
                      <span className="dm-text-muted">IP</span>
                      <p className="dm-text-secondary font-mono">{log.ip_address || '—'}</p>
                    </div>
                    <div>
                      <span className="dm-text-muted">Time</span>
                      <p className="dm-text-secondary">
                        {new Date(log.created_at).toLocaleString('en-US', {
                          month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-4 sm:px-6 pb-4">
              <Pagination pagination={pagination} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
