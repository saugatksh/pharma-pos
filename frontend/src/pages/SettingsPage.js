import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { LoadingSpinner } from '../components/UI';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

// Defined OUTSIDE component so React never remounts them on re-render
const Section = ({ title, children }) => (
  <div className="card">
    <h2 className="text-base font-semibold dm-text-primary mb-4 pb-2 border-b dm-border-card">{title}</h2>
    <div className="space-y-4">{children}</div>
  </div>
);

const Field = ({ label, hint, children }) => (
  <div>
    <label className="block text-sm font-medium dm-text-primary mb-1">{label}</label>
    {children}
    {hint && <p className="text-xs dm-text-muted mt-1">{hint}</p>}
  </div>
);

export default function SettingsPage() {
  const { updateUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', address: '', phone: '', email: '', license_number: '', tax_number: '',
    invoice_prefix: 'INV', tax_rate: 0, currency: 'NPR', logo_url: '',
    invoice_footer: '', invoice_terms: '', low_stock_threshold: 10,
    expiry_alert_days: 90, allow_negative_stock: false, require_batch_number: true
  });

  useEffect(() => {
    api.get('/settings')
      .then(r => { if (r.data.data) setForm(f => ({ ...f, ...r.data.data })); })
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const set = useCallback((field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings', form);
      updateUser({
        pharmacyName: form.name,
        pharmacyCurrency: form.currency,
        pharmacyLogo: form.logo_url,
        pharmacySettings: {
          invoice_prefix: form.invoice_prefix,
          invoice_footer: form.invoice_footer,
          invoice_terms: form.invoice_terms,
          tax_rate: form.tax_rate,
          low_stock_threshold: form.low_stock_threshold,
          expiry_alert_days: form.expiry_alert_days,
          allow_negative_stock: form.allow_negative_stock,
          require_batch_number: form.require_batch_number,
        }
      });
      toast.success('Settings saved successfully');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold dm-text-primary">Settings</h1>
        <p className="text-sm dm-text-muted mt-0.5">Changes are applied immediately after saving</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Pharmacy Info ── */}
        <Section title="🏥 Pharmacy Information">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Pharmacy Name *">
              <input value={form.name || ''} onChange={set('name')} className="input" required />
            </Field>
            <Field label="Email">
              <input type="email" value={form.email || ''} onChange={set('email')} className="input" />
            </Field>
            <Field label="Phone">
              <input value={form.phone || ''} onChange={set('phone')} className="input" />
            </Field>
            <Field label="License Number">
              <input value={form.license_number || ''} onChange={set('license_number')} className="input" />
            </Field>
            <Field label="Tax/VAT Number">
              <input value={form.tax_number || ''} onChange={set('tax_number')} className="input" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Pharmacy Logo" hint="Upload an image (PNG, JPG, SVG). Max 1MB. Shown in the sidebar for all users.">
                <div className="flex items-center gap-4">
                  {form.logo_url && (
                    <img src={form.logo_url} alt="Logo" className="h-14 w-14 object-contain rounded-lg border dm-border-card bg-gray-50 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                      className="hidden"
                      id="logo-upload"
                      onChange={e => {
                        const file = e.target.files[0];
                        if (!file) return;
                        if (file.size > 1024 * 1024) { toast.error('Image must be under 1MB'); return; }
                        const reader = new FileReader();
                        reader.onload = ev => setForm(prev => ({ ...prev, logo_url: ev.target.result }));
                        reader.readAsDataURL(file);
                      }}
                    />
                    <label htmlFor="logo-upload" className="btn-secondary cursor-pointer inline-flex items-center gap-2 text-sm">
                      📁 {form.logo_url ? 'Change Logo' : 'Upload Logo'}
                    </label>
                    {form.logo_url && (
                      <button type="button" onClick={() => setForm(prev => ({ ...prev, logo_url: '' }))}
                        className="ml-2 text-xs text-red-500 hover:text-red-700">Remove</button>
                    )}
                  </div>
                </div>
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Address">
                <textarea value={form.address || ''} onChange={set('address')} className="input" rows={2} />
              </Field>
            </div>
          </div>
        </Section>

        {/* ── Invoice Settings ── */}
        <Section title="🧾 Invoice Settings">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Invoice Prefix" hint="Shown at start of every invoice number (e.g. INV-000001)">
              <input value={form.invoice_prefix || 'INV'} onChange={set('invoice_prefix')} className="input" maxLength={10} />
            </Field>
            <Field label="Tax Rate (%)" hint="Applied to every sale total">
              <input type="number" step="0.01" min="0" max="100" value={form.tax_rate ?? 0} onChange={set('tax_rate')} className="input" />
            </Field>
            <Field label="Currency" hint="Shown on receipts and throughout the app">
              <select value={form.currency || 'NPR'} onChange={set('currency')} className="input">
                {['NPR', 'USD', 'EUR', 'GBP', 'INR', 'PKR', 'BDT', 'LKR'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Invoice Footer Text" hint="Printed at the bottom of every receipt (e.g. 'Thank you for your business')">
            <textarea value={form.invoice_footer || ''} onChange={set('invoice_footer')} className="input" rows={2}
              placeholder="e.g. Thank you for your business!" />
          </Field>
          <Field label="Invoice Terms / Return Policy" hint="Printed below the footer on receipts">
            <textarea value={form.invoice_terms || ''} onChange={set('invoice_terms')} className="input" rows={2}
              placeholder="e.g. Medicines once sold are not returnable" />
          </Field>
        </Section>

        {/* ── Inventory Settings ── */}
        <Section title="⚠️ Inventory Settings">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Low Stock Threshold (units)" hint="Medicine is flagged as low stock when quantity falls at or below this number">
              <input type="number" min="1" value={form.low_stock_threshold ?? 10} onChange={set('low_stock_threshold')} className="input" />
            </Field>
            <Field label="Expiry Alert (days before)" hint="Medicines expiring within this many days appear in Expiry Alerts">
              <input type="number" min="1" value={form.expiry_alert_days ?? 90} onChange={set('expiry_alert_days')} className="input" />
            </Field>
          </div>
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={form.allow_negative_stock || false} onChange={set('allow_negative_stock')} className="rounded mt-0.5" />
              <div>
                <div className="text-sm font-medium dm-text-primary">Allow Negative Stock</div>
                <div className="text-xs dm-text-muted">Allow sales even when stock reaches zero. Not recommended — may cause inventory discrepancies.</div>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={form.require_batch_number !== false} onChange={set('require_batch_number')} className="rounded mt-0.5" />
              <div>
                <div className="text-sm font-medium dm-text-primary">Require Batch Number on Purchases</div>
                <div className="text-xs dm-text-muted">Enforce batch number entry when recording a new purchase.</div>
              </div>
            </label>
          </div>
        </Section>

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="btn-primary px-8">
            {saving ? 'Saving...' : '💾 Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}