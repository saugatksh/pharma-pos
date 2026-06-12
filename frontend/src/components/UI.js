import React from 'react';
import ReactDOM from 'react-dom';

export const Modal = ({ open, onClose, title, children, size = 'md' }) => {
  if (!open) return null;
  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', full: 'max-w-6xl' };

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', overflowY: 'auto', padding: '24px 16px' }}
    >
      <div
        className={`relative w-full ${sizes[size]} my-auto`}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: '20px',
          boxShadow: '0 32px 80px rgba(0,0,0,0.4)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b dm-border-card" style={{ borderRadius: '20px 20px 0 0' }}>
          <h3 className="text-lg font-semibold dm-text-primary">{title}</h3>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl dm-text-muted hover:text-red-500 hover:bg-red-50 transition-all text-xl leading-none"
            style={{ border: '1px solid var(--border-card)' }}
          >×</button>
        </div>
        {/* Body - scrollable */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>
          {children}
        </div>
      </div>
      {/* Backdrop click to close */}
      <div className="fixed inset-0 -z-10" onClick={onClose} />
    </div>,
    document.body
  );
};

export const ConfirmDialog = ({ open, onClose, onConfirm, title, message, confirmText = 'Confirm', type = 'danger' }) => {
  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="dm-text-secondary mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={onConfirm} className={type === 'danger' ? 'btn-danger' : 'btn-primary'}>{confirmText}</button>
      </div>
    </Modal>
  );
};

export const Pagination = ({ pagination, onPageChange }) => {
  if (!pagination || pagination.pages <= 1) return null;
  const { page, pages, total, limit } = pagination;
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  return (
    <div className="flex items-center justify-between pt-4 border-t dm-border-card">
      <span className="text-sm dm-text-muted">Showing {start}–{end} of {total}</span>
      <div className="flex gap-2">
        <button onClick={() => onPageChange(page - 1)} disabled={page <= 1}
          className="px-3 py-1 text-sm rounded-lg border dm-border-card dm-text-secondary hover:border-emerald-400 hover:text-emerald-600 disabled:opacity-40 transition-all dm-bg-card">
          ← Prev
        </button>
        <span className="px-3 py-1 text-sm bg-emerald-600 text-white rounded-lg font-semibold">{page}</span>
        <button onClick={() => onPageChange(page + 1)} disabled={page >= pages}
          className="px-3 py-1 text-sm rounded-lg border dm-border-card dm-text-secondary hover:border-emerald-400 hover:text-emerald-600 disabled:opacity-40 transition-all dm-bg-card">
          Next →
        </button>
      </div>
    </div>
  );
};

export const LoadingSpinner = ({ message = 'Loading...' }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-3">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
    <span className="dm-text-muted text-sm">{message}</span>
  </div>
);

export const EmptyState = ({ icon = '📭', title, subtitle, action }) => (
  <div className="text-center py-16">
    <div className="text-5xl mb-4">{icon}</div>
    <h3 className="text-lg font-medium dm-text-primary mb-1">{title}</h3>
    {subtitle && <p className="dm-text-muted text-sm mb-4">{subtitle}</p>}
    {action}
  </div>
);

export const StatCard = ({ title, value, subtitle, icon, color = 'green', onClick }) => {
  const colors = {
    green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30',
    yellow: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/30',
    red: 'bg-red-50 text-red-600 dark:bg-red-900/30',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30',
  };
  return (
    <div className={`card ${onClick ? 'cursor-pointer' : ''}`} onClick={onClick}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm dm-text-muted font-medium">{title}</p>
          <p className="text-2xl font-bold dm-text-primary mt-1">{value}</p>
          {subtitle && <p className="text-xs dm-text-muted mt-1">{subtitle}</p>}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${colors[color]}`}>{icon}</div>
      </div>
    </div>
  );
};

export const Badge = ({ children, type = 'gray' }) => {
  const types = {
    green: 'badge-green', red: 'badge-red', yellow: 'badge-yellow', blue: 'badge-blue', gray: 'badge-gray',
    purple: 'badge-purple',
  };
  return <span className={types[type] || 'badge-gray'}>{children}</span>;
};

export const SearchInput = ({ value, onChange, placeholder = 'Search...' }) => (
  <div className="relative">
    <span className="absolute left-3 top-1/2 -translate-y-1/2 dm-text-muted">🔍</span>
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="input pl-9"
    />
  </div>
);

export const Table = ({ columns, data, loading, emptyText = 'No records found' }) => {
  if (loading) return <LoadingSpinner />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b dm-border-card" style={{ background: 'var(--bg-table-head)' }}>
            {columns.map((col, i) => (
              <th key={i} className={`text-left px-4 py-3 text-xs font-semibold dm-text-muted uppercase tracking-wide ${col.className || ''}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y dm-border-card">
          {data.length === 0 ? (
            <tr><td colSpan={columns.length} className="text-center py-12 dm-text-muted">{emptyText}</td></tr>
          ) : (
            data.map((row, i) => (
              <tr key={i} className="dm-row-hover transition-colors">
                {columns.map((col, j) => (
                  <td key={j} className={`px-4 py-3 dm-text-primary ${col.className || ''}`}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
