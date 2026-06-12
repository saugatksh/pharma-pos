import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Modal, LoadingSpinner } from '../components/UI';
import toast from 'react-hot-toast';

const PAYMENT_METHODS = ['cash', 'card', 'qr'];

const PayIcon = ({ method }) => {
  if (method === 'cash') return <span>💵</span>;
  if (method === 'card') return <span>💳</span>;
  return <span>📱</span>;
};

export default function SalesPage() {
  const { user } = useAuth();
  const cur = user?.pharmacyCurrency || 'NPR';
  const searchRef = useRef(null);

  const [cartItems, setCartItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [checkoutConfirm, setCheckoutConfirm] = useState(false);

  const [sales, setSales] = useState([]);
  const [loadingSales, setLoadingSales] = useState(true);
  const [activeTab, setActiveTab] = useState('pos');
  const [receiptModal, setReceiptModal] = useState(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);
  const [taxRate, setTaxRate] = useState(0);

  useEffect(() => {
    // Fetch pharmacy settings to get the tax rate
    api.get('/settings').then(({ data }) => {
      setTaxRate(parseFloat(data.data?.tax_rate || 0));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab === 'history') fetchSales();
  }, [activeTab]);

  const fetchSales = async () => {
    setLoadingSales(true);
    try {
      const { data } = await api.get('/sales?limit=50&include_items=true');
      setSales(data.data);
    } catch { toast.error('Failed to load sales'); }
    finally { setLoadingSales(false); }
  };

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); setShowDropdown(false); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await api.get(`/medicines/search?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(data.data);
        setShowDropdown(true);
      } catch {} finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const addToCart = (medicine) => {
    setShowDropdown(false);
    setSearchQuery('');
    if (parseInt(medicine.current_stock) <= 0) { toast.error(`${medicine.name} is out of stock`); return; }
    const existing = cartItems.find(i => i.medicine_id === medicine.id);
    if (existing) {
      if (existing.quantity >= parseInt(medicine.current_stock)) { toast.error(`Only ${medicine.current_stock} units available`); return; }
      setCartItems(cartItems.map(i => i.medicine_id === medicine.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setCartItems([...cartItems, {
        medicine_id: medicine.id, name: medicine.name, unit: medicine.unit,
        unit_price: parseFloat(medicine.selling_price), quantity: 1,
        discount_percent: 0, max_stock: parseInt(medicine.current_stock),
        purchase_price: parseFloat(medicine.purchase_price || 0)
      }]);
    }
    searchRef.current?.focus();
  };

  const updateCartItem = (id, field, value) => {
    setCartItems(cartItems.map(item => {
      if (item.medicine_id !== id) return item;
      if (field === 'quantity') {
        // Allow empty string while typing, treat as 0 for display
        if (value === '' || value === '0' || value === 0) return { ...item, quantity: 0, quantityInput: '' };
        const parsed = parseInt(value);
        if (isNaN(parsed)) return item;
        return { ...item, quantity: Math.min(Math.max(0, parsed), item.max_stock), quantityInput: undefined };
      }
      if (field === 'unit_price') return { ...item, unit_price: parseFloat(value) || 0 };
      if (field === 'discount_percent') return { ...item, discount_percent: Math.max(0, Math.min(100, parseFloat(value) || 0)) };
      return item;
    }));
  };

  const removeFromCart = (id) => setCartItems(cartItems.filter(i => i.medicine_id !== id));

  const subtotal = cartItems.reduce((sum, i) => sum + (i.unit_price * i.quantity), 0);
  const discAmt = discountPercent > 0 ? subtotal * (discountPercent / 100) : parseFloat(discountAmount) || 0;
  const taxAmt = (subtotal - discAmt) * (taxRate / 100);
  const total = Math.max(0, subtotal - discAmt + taxAmt);
  const change = Math.max(0, (parseFloat(amountPaid) || 0) - total);

  const clearCart = () => {
    setCartItems([]); setCustomerName(''); setCustomerPhone('');
    setDiscountPercent(0); setDiscountAmount(0); setPaymentMethod('cash');
    setAmountPaid(''); setNotes('');
  };

  const handleCheckoutClick = () => {
    if (cartItems.length === 0) return toast.error('Cart is empty');
    if (paymentMethod === 'cash' && amountPaid && parseFloat(amountPaid) < total)
      return toast.error('Amount paid is less than total');
    setCheckoutConfirm(true);
  };

  const handleCheckoutConfirm = async () => {
    setCheckoutConfirm(false);
    setProcessing(true);
    try {
      const { data } = await api.post('/sales', {
        customer_name: customerName, customer_phone: customerPhone,
        items: cartItems.map(i => ({ medicine_id: i.medicine_id, quantity: i.quantity, unit_price: i.unit_price, discount_percent: i.discount_percent })),
        discount_amount: discAmt, discount_percent: discountPercent,
        tax_amount: taxAmt, tax_rate: taxRate,
        payment_method: paymentMethod, amount_paid: parseFloat(amountPaid) || total, notes
      });
      // Sale saved successfully — show success and clear cart immediately
      toast.success(`✅ Sale recorded! Invoice: ${data.data.invoice_number}`);
      clearCart();
      // Then load receipt separately; failure here doesn't affect the sale
      try {
        const saleData = await api.get(`/sales/${data.data.id}`);
        setReceiptModal(saleData.data.data);
      } catch {
        // Receipt load failed but sale is saved — user can reopen from history
        toast.error('Sale saved, but could not load receipt. Open from History.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Sale failed');
    } finally { setProcessing(false); }
  };

  const openReceipt = async (saleId) => {
    setLoadingReceipt(true);
    try {
      const r = await api.get(`/sales/${saleId}`);
      setReceiptModal(r.data.data);
    } catch { toast.error('Failed to load receipt'); }
    finally { setLoadingReceipt(false); }
  };

  const fmt = (n) => parseFloat(n || 0).toFixed(2);
  const fmtDate = (d) => new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const handlePrint = () => {
    if (!receiptModal) return;
    const r = receiptModal;
    const hasDiscount = parseFloat(r.items?.some(i => parseFloat(i.discount_percent) > 0));
    const itemRows = (r.items || []).map((item, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f8f8f8'}">
        <td style="padding:5px 6px;color:#666;font-size:10px;">${i+1}</td>
        <td style="padding:5px 6px;">
          <div style="font-weight:600;font-size:10px;color:#111;">${item.medicine_name || ''}</div>
          ${item.unit ? `<div style="font-size:9px;color:#888;">${item.unit}</div>` : ''}
        </td>
        <td style="padding:5px 6px;text-align:right;font-size:10px;">${item.quantity}</td>
        <td style="padding:5px 6px;text-align:right;font-size:10px;">${parseFloat(item.unit_price||0).toFixed(2)}</td>
        ${hasDiscount ? `<td style="padding:5px 6px;text-align:right;font-size:10px;color:#b45309;">${parseFloat(item.discount_percent)>0 ? item.discount_percent+'%' : '—'}</td>` : ''}
        <td style="padding:5px 6px;text-align:right;font-weight:700;font-size:10px;">${parseFloat(item.total_amount||0).toFixed(2)}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Invoice — ${r.invoice_number}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', Arial, sans-serif;
      background: #fff; color: #111;
      width: 76mm; margin: 0 auto; padding: 5mm 4mm 8mm;
      font-size: 10px; line-height: 1.4;
    }

    /* ── Header ── */
    .ph-header { text-align: center; padding-bottom: 8px; margin-bottom: 8px; border-bottom: 1.5px dashed #bbb; }
    .ph-logo { width: 36px; height: 36px; background: #f0fdf4; border-radius: 50%;
      display: flex; align-items: center; justify-content: center; margin: 0 auto 5px; }
    .ph-name { font-size: 13px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: #111; }
    .ph-meta { font-size: 9px; color: #555; margin-top: 1px; }
    .ph-license { font-size: 8.5px; color: #888; margin-top: 2px; }
    .tax-badge {
      display: inline-block; margin-top: 6px;
      background: #111; color: #fff;
      font-size: 9px; font-weight: 700; letter-spacing: 2px;
      padding: 3px 14px; border-radius: 3px;
      text-transform: uppercase;
    }

    /* ── Invoice meta ── */
    .inv-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 6px; margin-bottom: 6px; font-size: 9.5px; }
    .inv-meta .label { color: #777; }
    .inv-meta .value { font-weight: 600; color: #111; }
    .inv-meta .right { text-align: right; }

    /* ── Customer box ── */
    .cust-box { background: #f3f4f6; border-radius: 5px; padding: 5px 8px; margin-bottom: 6px; font-size: 9.5px; }
    .cust-box .label { color: #666; }
    .cust-box .name { font-weight: 700; color: #111; margin-left: 4px; }

    /* ── Items table ── */
    .items-wrap { border: 1px solid #e5e7eb; border-radius: 5px; overflow: hidden; margin-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #111; }
    thead th {
      color: #fff; font-size: 9px; font-weight: 700;
      padding: 5px 6px; text-transform: uppercase; letter-spacing: 0.4px;
    }
    thead th:first-child { text-align: left; }
    thead th.r { text-align: right; }
    thead th.l { text-align: left; }
    tbody td { border-bottom: 1px solid #f3f4f6; }
    tbody tr:last-child td { border-bottom: none; }

    /* ── Totals ── */
    .totals { border: 1px solid #e5e7eb; border-radius: 5px; padding: 7px 10px; background: #f9fafb; margin-bottom: 8px; }
    .t-row { display: flex; justify-content: space-between; font-size: 9.5px; margin-bottom: 3px; color: #444; }
    .t-row.disc { color: #b45309; }
    .t-row.total-main {
      font-size: 12px; font-weight: 800; color: #111;
      border-top: 1.5px solid #d1d5db; margin-top: 4px; padding-top: 5px; margin-bottom: 4px;
    }
    .t-row.paid { color: #374151; font-size: 9.5px; }
    .t-row.change { color: #047857; font-weight: 700; font-size: 9.5px; }

    /* ── Footer ── */
    .bill-footer { text-align: center; border-top: 1px dashed #ccc; padding-top: 7px; }
    .bill-footer .thanks { font-size: 10px; font-weight: 700; color: #111; margin-bottom: 3px; }
    .bill-footer .note { font-size: 8.5px; color: #777; margin-bottom: 1px; }
    .bill-footer .powered { font-size: 8px; color: #aaa; margin-top: 5px; }

    /* ── Barcode-style divider ── */
    .barcode-line { height: 2px; background: repeating-linear-gradient(90deg,#111 0,#111 3px,#fff 3px,#fff 5px); margin: 5px 0; border-radius: 1px; }
  </style>
</head>
<body>
  <div class="ph-header">
    <div class="ph-logo">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="7" y="1" width="4" height="16" rx="2" fill="#16a34a"/>
        <rect x="1" y="7" width="16" height="4" rx="2" fill="#16a34a"/>
      </svg>
    </div>
    <div class="ph-name">${r.pharmacy?.name || 'PharmaPOS'}</div>
    ${r.pharmacy?.address ? `<div class="ph-meta">${r.pharmacy.address}</div>` : ''}
    ${r.pharmacy?.phone ? `<div class="ph-meta">Tel: ${r.pharmacy.phone}</div>` : ''}
    ${r.pharmacy?.email ? `<div class="ph-meta">${r.pharmacy.email}</div>` : ''}
    ${r.pharmacy?.license_number ? `<div class="ph-license">License No: ${r.pharmacy.license_number}</div>` : ''}
    <div><span class="tax-badge">TAX INVOICE</span></div>
  </div>

  <div class="inv-meta">
    <div><span class="label">Invoice No: </span><span class="value">${r.invoice_number}</span></div>
    <div class="right"><span class="label">Date: </span><span class="value">${new Date(r.sale_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</span></div>
    <div><span class="label">Time: </span><span class="value">${new Date(r.sale_date).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span></div>
    <div class="right"><span class="label">Payment: </span><span class="value" style="text-transform:capitalize">${r.payment_method}</span></div>
  </div>

  ${r.customer_name ? `
  <div class="cust-box">
    <span class="label">Customer:</span><span class="name">${r.customer_name}</span>
    ${r.customer_phone ? `<span class="label" style="margin-left:6px;">· ${r.customer_phone}</span>` : ''}
  </div>` : ''}

  <div class="items-wrap">
    <table>
      <thead>
        <tr>
          <th class="l">#</th>
          <th class="l">Medicine</th>
          <th class="r">Qty</th>
          <th class="r">Rate</th>
          ${hasDiscount ? '<th class="r">Disc</th>' : ''}
          <th class="r">Amount</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
  </div>

  <div class="totals">
    <div class="t-row"><span>Subtotal</span><span>${cur} ${parseFloat(r.subtotal||0).toFixed(2)}</span></div>
    ${parseFloat(r.discount_amount) > 0 ? `
    <div class="t-row disc">
      <span>Discount${r.discount_percent > 0 ? ' ('+r.discount_percent+'%)' : ''}</span>
      <span>− ${cur} ${parseFloat(r.discount_amount).toFixed(2)}</span>
    </div>` : ''}
    ${parseFloat(r.tax_amount) > 0 ? `
    <div class="t-row" style="color:#2563eb;">
      <span>Tax</span>
      <span>+ ${cur} ${parseFloat(r.tax_amount).toFixed(2)}</span>
    </div>` : ''}
    <div class="t-row total-main"><span>TOTAL</span><span>${cur} ${parseFloat(r.total_amount||0).toFixed(2)}</span></div>
    <div class="t-row paid">
      <span>Paid (${r.payment_method})</span>
      <span>${cur} ${parseFloat(r.amount_paid||0).toFixed(2)}</span>
    </div>
    ${parseFloat(r.change_amount) > 0 ? `
    <div class="t-row change"><span>Change Returned</span><span>${cur} ${parseFloat(r.change_amount).toFixed(2)}</span></div>
    ` : ''}
  </div>

  <div class="barcode-line"></div>

  <div class="bill-footer">
    <div class="thanks">${r.pharmacy?.invoice_footer ? r.pharmacy.invoice_footer : '✦ Thank you for your purchase! ✦'}</div>
    ${r.pharmacy?.invoice_terms ? `<div class="note">${r.pharmacy.invoice_terms}</div>` : '<div class="note">Medicines once sold are not returnable.</div>'}
    <div class="powered">Powered by PharmaPOS &nbsp;·&nbsp; ${new Date().toLocaleDateString()}</div>
  </div>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=380,height=650,scrollbars=yes');
    if (!win) { toast.error('Popup blocked — allow popups and try again'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
  };

  return (
    <div className="space-y-5 animate-fadeInUp">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold dm-text-primary">Sales POS</h1>
          <p className="text-sm dm-text-muted mt-0.5">Point of Sale — {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="flex gap-2">
          {['pos', 'history'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-md'
                  : 'dm-bg-card dm-text-secondary dm-border-card border hover:border-emerald-300 hover:text-emerald-600'
              }`}>
              {tab === 'pos' ? '🧾 POS' : '📋 History'}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'pos' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left: Cart */}
          <div className="lg:col-span-2 space-y-4">
            {/* Search */}
            <div className="card p-4">
              <label className="block text-sm font-semibold dm-text-primary mb-2">🔍 Search Medicine</label>
              <div className="relative">
                <input ref={searchRef} type="text" value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                  placeholder="Type medicine name, generic name..." className="input pr-10" autoFocus />
                {searching && <span className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-emerald-500">⟳</span>}
                {showDropdown && (
                  <div className="absolute z-30 top-full left-0 right-0 mt-1 dm-bg-card dm-border-card border rounded-xl shadow-xl max-h-72 overflow-y-auto animate-slideDown">
                    {searchResults.length === 0
                      ? <div className="p-5 text-center dm-text-muted text-sm">No medicines found</div>
                      : searchResults.map(m => (
                        <button key={m.id} onClick={() => addToCart(m)}
                          className="w-full text-left px-4 py-3 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border-b dm-border-card last:border-0 transition-colors">
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="font-semibold dm-text-primary text-sm">{m.name}</span>
                              {m.generic_name && <span className="dm-text-muted text-xs ml-2">({m.generic_name})</span>}
                            </div>
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${parseInt(m.current_stock) > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                              {m.current_stock} {m.unit}
                            </span>
                          </div>
                          <div className="text-emerald-600 text-sm font-bold mt-0.5">{cur} {fmt(m.selling_price)}</div>
                        </button>
                      ))
                    }
                  </div>
                )}
              </div>
            </div>

            {/* Cart */}
            <div className="card p-0 overflow-hidden">
              <div className="px-5 py-3.5 border-b dm-border-card flex items-center justify-between" style={{ background: 'var(--bg-table-head)' }}>
                <h2 className="font-semibold dm-text-primary flex items-center gap-2">
                  🛒 Cart
                  {cartItems.length > 0 && <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">{cartItems.length}</span>}
                </h2>
                {cartItems.length > 0 && (
                  <button onClick={clearCart} className="text-sm text-red-400 hover:text-red-600 font-medium transition-colors">Clear All</button>
                )}
              </div>
              {cartItems.length === 0 ? (
                <div className="text-center py-16 dm-text-muted">
                  <div className="text-5xl mb-3">🛒</div>
                  <p className="text-sm font-medium">Search and add medicines above</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b dm-border-card" style={{ background: 'var(--bg-table-head)' }}>
                        {['Medicine', 'Unit Price', 'Qty', 'Total', ''].map(h => (
                          <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold dm-text-muted uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cartItems.map(item => {
                        const lineTotal = item.unit_price * item.quantity;
                        return (
                          <tr key={item.medicine_id} className="border-b dm-border-card dm-row-hover transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-semibold dm-text-primary text-sm">{item.name}</div>
                              <div className="text-xs dm-text-muted">{item.unit} · {item.max_stock} available</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm font-semibold dm-text-primary">{cur} {fmt(item.unit_price)}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <button onClick={() => updateCartItem(item.medicine_id, 'quantity', Math.max(0, item.quantity - 1))}
                                  className="w-6 h-6 rounded-lg text-sm font-bold transition-colors flex items-center justify-center"
                                  style={{ background: 'var(--bg-badge-neutral)', color: 'var(--text-secondary)' }}>−</button>
                                <input type="number" min="0" max={item.max_stock}
                                  value={item.quantityInput !== undefined ? item.quantityInput : item.quantity}
                                  onChange={e => updateCartItem(item.medicine_id, 'quantity', e.target.value)}
                                  onBlur={() => setCartItems(prev => prev.map(ci => ci.medicine_id === item.medicine_id ? { ...ci, quantityInput: undefined } : ci))}
                                  className="w-10 input px-1 py-1 text-xs text-center" />
                                <button onClick={() => updateCartItem(item.medicine_id, 'quantity', item.quantity + 1)}
                                  className="w-6 h-6 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg text-sm font-bold transition-colors flex items-center justify-center">+</button>
                              </div>
                            </td>

                            <td className="px-4 py-3 font-bold dm-text-primary">{fmt(lineTotal)}</td>
                            <td className="px-4 py-3">
                              <button onClick={() => removeFromCart(item.medicine_id)}
                                className="w-6 h-6 flex items-center justify-center dm-text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">✕</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Customer */}
            <div className="card p-4">
              <h3 className="text-sm font-semibold dm-text-primary mb-3">👤 Customer Details <span className="dm-text-muted font-normal">(Optional)</span></h3>
              <div className="grid grid-cols-2 gap-3">
                <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer name" className="input" />
                <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Phone number" className="input" />
              </div>
            </div>
          </div>

          {/* Right: Summary & Checkout */}
          <div className="space-y-4">
            {/* Discount */}
            <div className="card p-4">
              <h3 className="text-sm font-semibold dm-text-primary mb-3">🏷️ Discount</h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs dm-text-muted font-medium block mb-1">% Off</label>
                  <input type="number" min="0" max="100" value={discountPercent}
                    onChange={e => { setDiscountPercent(parseFloat(e.target.value) || 0); setDiscountAmount(0); }}
                    className="input" placeholder="0" />
                </div>
                <div>
                  <label className="text-xs dm-text-muted font-medium block mb-1">Flat ({cur})</label>
                  <input type="number" min="0" value={discountAmount}
                    onChange={e => { setDiscountAmount(parseFloat(e.target.value) || 0); setDiscountPercent(0); }}
                    className="input" placeholder="0.00" />
                </div>
              </div>
            </div>

            {/* Totals */}
            <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(135deg, #0f172a, #1e3a5f)' }}>
              <div className="space-y-2.5">
                <div className="flex justify-between text-sm text-slate-300">
                  <span>Subtotal</span><span className="font-medium">{cur} {fmt(subtotal)}</span>
                </div>
                {discAmt > 0 && (
                  <div className="flex justify-between text-sm text-amber-400">
                    <span>Discount</span><span>− {cur} {fmt(discAmt)}</span>
                  </div>
                )}
                {taxRate > 0 && (
                  <div className="flex justify-between text-sm text-blue-300">
                    <span>Tax ({taxRate}%)</span><span>+ {cur} {fmt(taxAmt)}</span>
                  </div>
                )}
                <div className="border-t border-white/10 pt-2.5 flex justify-between font-bold text-2xl text-white">
                  <span>Total</span><span>{cur} {fmt(total)}</span>
                </div>
                {cartItems.length > 0 && (
                  <div className="text-xs text-slate-400 pt-1">{cartItems.reduce((s, i) => s + i.quantity, 0)} items in cart</div>
                )}
              </div>
            </div>

            {/* Payment */}
            <div className="card p-4">
              <h3 className="text-sm font-semibold dm-text-primary mb-3">💳 Payment Method</h3>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {PAYMENT_METHODS.map(m => (
                  <button key={m} onClick={() => setPaymentMethod(m)}
                    className={`py-2.5 rounded-xl text-sm font-semibold capitalize transition-all duration-150 border-2 ${
                      paymentMethod === m
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm'
                        : 'dm-border-card dm-text-muted hover:border-gray-300'
                    }`}>
                    <PayIcon method={m} /><br/>{m}
                  </button>
                ))}
              </div>
              {paymentMethod === 'cash' && (
                <div>
                  <label className="text-xs dm-text-muted font-medium block mb-1">Amount Received ({cur})</label>
                  <input type="number" step="0.01" value={amountPaid}
                    onChange={e => setAmountPaid(e.target.value)} placeholder={fmt(total)} className="input" />
                  {parseFloat(amountPaid) > 0 && (
                    <div className={`mt-2.5 text-sm font-bold rounded-xl p-3 text-center ${change >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                      {change >= 0 ? `Change: ${cur} ${fmt(change)}` : `Short by: ${cur} ${fmt(Math.abs(change))}`}
                    </div>
                  )}
                </div>
              )}
            </div>

            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Notes (optional)" className="input" rows={2} />

            <button onClick={handleCheckoutClick}
              disabled={processing || cartItems.length === 0}
              className="btn-primary w-full py-4 text-base font-bold">
              {processing ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                  Processing...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  ✓ Checkout · {cur} {fmt(total)}
                </span>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* History */
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b dm-border-card" style={{ background: 'var(--bg-table-head)' }}>
            <h2 className="text-lg font-bold dm-text-primary">Sales History</h2>
          </div>
          {loadingSales ? <div className="p-6"><LoadingSpinner /></div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b dm-border-card" style={{ background: 'var(--bg-table-head)' }}>
                    {['Invoice', 'Customer', 'Date & Time', 'Items', 'Total', 'Payment', 'Status', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold dm-text-muted uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sales.map(s => (
                    <tr key={s.id} className="border-b dm-border-card dm-row-hover transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-bold dm-text-primary">{s.invoice_number}</td>
                      <td className="px-4 py-3 dm-text-secondary">{s.customer_name || <span className="dm-text-muted">Walk-in</span>}</td>
                      <td className="px-4 py-3 dm-text-secondary text-xs">{fmtDate(s.sale_date)}</td>
                      <td className="px-4 py-3 dm-text-secondary">
                        {s.items && s.items.length > 0
                          ? <div className="space-y-0.5">{s.items.map((it, idx) => (
                              <div key={idx} className="text-xs">
                                <span className="font-medium dm-text-primary">{it.medicine_name}</span>
                                <span className="dm-text-muted ml-1">×{it.quantity}</span>
                              </div>
                            ))}</div>
                          : <span className="dm-text-muted text-xs">{s.item_count ? s.item_count + ' item(s)' : '—'}</span>
                        }
                      </td>
                      <td className="px-4 py-3 font-bold dm-text-primary">{cur} {fmt(s.total_amount)}</td>
                      <td className="px-4 py-3">
                        <span className={`badge-${s.payment_method === 'cash' ? 'green' : s.payment_method === 'card' ? 'blue' : 'purple'}`}>
                          {s.payment_method}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge-${s.status === 'completed' ? 'green' : 'red'}`}>{s.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openReceipt(s.id)}
                          disabled={loadingReceipt}
                          className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 transition-colors disabled:opacity-50">
                          {loadingReceipt ? '...' : 'Receipt →'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {sales.length === 0 && <tr><td colSpan={8} className="text-center py-16 dm-text-muted">No sales found</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Checkout Confirmation Modal ── */}
      {checkoutConfirm && ReactDOM.createPortal((
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="dm-bg-card rounded-2xl shadow-2xl w-full max-w-md p-6 animate-scaleIn">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold dm-text-primary text-center mb-1">Confirm Checkout</h3>
            <p className="dm-text-secondary text-sm text-center mb-5">Review the order before finalizing the sale.</p>
            <div className="rounded-xl p-4 space-y-2 mb-5 text-sm" style={{ background: 'var(--bg-table-head)' }}>
              <div className="space-y-1.5 pb-2 border-b dm-border-card">
                <div className="text-xs font-semibold dm-text-muted uppercase tracking-wide mb-2">Items</div>
                {cartItems.map(item => (
                  <div key={item.medicine_id} className="flex justify-between items-center">
                    <span className="font-semibold dm-text-primary text-sm">{item.name}</span>
                    <span className="font-bold dm-text-primary text-sm ml-4">× {item.quantity}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between dm-text-secondary">
                <span>Subtotal</span><span className="font-semibold">{cur} {fmt(subtotal)}</span>
              </div>
              {discAmt > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>Discount</span><span className="font-semibold">− {cur} {fmt(discAmt)}</span>
                </div>
              )}
              {taxRate > 0 && (
                <div className="flex justify-between text-blue-600">
                  <span>Tax ({taxRate}%)</span><span className="font-semibold">+ {cur} {fmt(taxAmt)}</span>
                </div>
              )}
              <div className="flex justify-between dm-text-primary font-bold text-lg border-t dm-border-card pt-2 mt-1">
                <span>Total</span><span>{cur} {fmt(total)}</span>
              </div>
              <div className="flex justify-between dm-text-muted text-xs pt-1">
                <span>Payment</span><span className="capitalize font-medium">{paymentMethod}</span>
              </div>
              {customerName && <div className="flex justify-between dm-text-muted text-xs"><span>Customer</span><span>{customerName}</span></div>}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setCheckoutConfirm(false)} className="btn-secondary flex-1 py-3">Back</button>
              <button onClick={handleCheckoutConfirm}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 transition-all shadow-md">
                ✓ Confirm & Record Sale
              </button>
            </div>
          </div>
        </div>
      ), document.body)}

      {/* ── Full Receipt Modal via Portal (escapes overflow:hidden parents) ── */}
      {receiptModal && ReactDOM.createPortal((
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm animate-fadeIn"
          style={{overflowY:'auto', padding:'24px 16px'}}>
          <div style={{display:'flex', justifyContent:'center'}}>
          <div style={{background:'var(--bg-card)', border:'1px solid var(--border-card)', borderRadius:'20px', boxShadow:'0 32px 64px rgba(0,0,0,0.45)', width:'100%', maxWidth:'460px'}}>
            {/* Modal header */}
            <div style={{flexShrink:0, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid var(--border-card)'}}>
              <h3 style={{fontWeight:700, color:'var(--text-primary)', fontSize:'15px'}}>🧾 Tax Invoice / Receipt</h3>
              <button onClick={() => setReceiptModal(null)}
                style={{width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'8px', color:'var(--text-muted)', border:'none', background:'transparent', cursor:'pointer', fontSize:'18px'}}
                onMouseOver={e=>e.target.style.color='#ef4444'} onMouseOut={e=>e.target.style.color='var(--text-muted)'}>✕</button>
            </div>

            {/* Bill content */}
            <div style={{padding:'20px'}}>
              <div id="pharmacy-bill" className="font-mono text-xs">
                {/* Pharmacy Header */}
                <div className="text-center pb-4 mb-4" style={{ borderBottom: '2px dashed #ccc' }}>
                  <div className="bill-header-icon inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-100 mb-2">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5">
                      <rect x="9" y="2" width="6" height="20" rx="3"/>
                      <rect x="2" y="9" width="20" height="6" rx="3"/>
                    </svg>
                  </div>
                  <div className="bill-pharmacy-name font-bold dm-text-primary text-sm tracking-wide uppercase mt-1">
                    {receiptModal.pharmacy?.name || 'PharmaPOS'}
                  </div>
                  {receiptModal.pharmacy?.address && <p className="bill-address dm-text-secondary mt-0.5 text-xs">{receiptModal.pharmacy.address}</p>}
                  {receiptModal.pharmacy?.phone && <p className="bill-address dm-text-secondary text-xs">Tel: {receiptModal.pharmacy.phone}</p>}
                  {receiptModal.pharmacy?.email && <p className="bill-address dm-text-secondary text-xs">{receiptModal.pharmacy.email}</p>}
                  {receiptModal.pharmacy?.license_number && <p className="bill-address dm-text-muted text-xs mt-0.5">License: {receiptModal.pharmacy.license_number}</p>}
                  <div className="tax-invoice-bar mt-2 py-1 bg-gray-800 rounded text-white text-xs font-bold tracking-widest uppercase">TAX INVOICE</div>
                </div>

                {/* Invoice Details */}
                <div className="grid grid-cols-2 gap-1 mb-3 text-xs">
                  <div><span className="dm-text-muted">Invoice No:</span><span className="font-bold dm-text-primary ml-1">{receiptModal.invoice_number}</span></div>
                  <div className="text-right"><span className="dm-text-muted">Date:</span><span className="dm-text-secondary ml-1">{new Date(receiptModal.sale_date).toLocaleDateString()}</span></div>
                  <div><span className="dm-text-muted">Time:</span><span className="dm-text-secondary ml-1">{new Date(receiptModal.sale_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
                  <div className="text-right"><span className="dm-text-muted">Payment:</span><span className="font-semibold dm-text-primary ml-1 capitalize">{receiptModal.payment_method}</span></div>
                </div>

                {receiptModal.customer_name && (
                  <div className="rounded-lg p-2 mb-3 text-xs" style={{ background: 'var(--bg-table-head)' }}>
                    <span className="dm-text-muted">Customer: </span>
                    <span className="font-semibold dm-text-primary">{receiptModal.customer_name}</span>
                    {receiptModal.customer_phone && <span className="dm-text-muted ml-2">· {receiptModal.customer_phone}</span>}
                  </div>
                )}

                {/* Items Table */}
                <div className="items-table border dm-border-card rounded-lg overflow-hidden mb-3">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-800 text-white">
                      <tr>
                        <th className="text-left px-2 py-1.5">#</th>
                        <th className="text-left px-2 py-1.5">Medicine</th>
                        <th className="text-right px-2 py-1.5">Qty</th>
                        <th className="text-right px-2 py-1.5">Rate</th>
                        {receiptModal.items?.some(i => parseFloat(i.discount_percent) > 0) && <th className="text-right px-2 py-1.5">Disc%</th>}
                        <th className="text-right px-2 py-1.5">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receiptModal.items?.map((item, i) => (
                        <tr key={i} className={i % 2 === 0 ? '' : ''} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-table-head)' }}>
                          <td className="px-2 py-1.5 dm-text-muted">{i + 1}</td>
                          <td className="px-2 py-1.5">
                            <div className="font-semibold dm-text-primary">{item.medicine_name}</div>
                            {item.unit && <div className="dm-text-muted text-xs">{item.unit}</div>}
                          </td>
                          <td className="px-2 py-1.5 text-right font-medium dm-text-secondary">{item.quantity}</td>
                          <td className="px-2 py-1.5 text-right dm-text-secondary">{fmt(item.unit_price)}</td>
                          {receiptModal.items?.some(i => parseFloat(i.discount_percent) > 0) && (
                            <td className="px-2 py-1.5 text-right text-amber-600">
                              {parseFloat(item.discount_percent) > 0 ? `${item.discount_percent}%` : '—'}
                            </td>
                          )}
                          <td className="px-2 py-1.5 text-right font-bold dm-text-primary">{fmt(item.total_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="totals-box border dm-border-card rounded-lg p-3 mb-3 space-y-1.5 text-xs" style={{ background: 'var(--bg-table-head)' }}>
                  <div className="flex justify-between dm-text-secondary"><span>Subtotal</span><span className="font-medium">{cur} {fmt(receiptModal.subtotal)}</span></div>
                  {parseFloat(receiptModal.discount_amount) > 0 && (
                    <div className="flex justify-between text-amber-600">
                      <span>Discount{receiptModal.discount_percent > 0 ? ` (${receiptModal.discount_percent}%)` : ''}</span>
                      <span className="font-medium">− {cur} {fmt(receiptModal.discount_amount)}</span>
                    </div>
                  )}
                  {parseFloat(receiptModal.tax_amount) > 0 && (
                    <div className="flex justify-between text-blue-600">
                      <span>Tax</span>
                      <span className="font-medium">+ {cur} {fmt(receiptModal.tax_amount)}</span>
                    </div>
                  )}
                  <div className="bill-total-row flex justify-between dm-text-primary font-bold text-sm border-t dm-border-card pt-2 mt-1">
                    <span>TOTAL AMOUNT</span><span>{cur} {fmt(receiptModal.total_amount)}</span>
                  </div>
                  <div className="flex justify-between dm-text-secondary">
                    <span>Amount Paid ({receiptModal.payment_method})</span><span>{cur} {fmt(receiptModal.amount_paid)}</span>
                  </div>
                  {parseFloat(receiptModal.change_amount) > 0 && (
                    <div className="flex justify-between text-emerald-600 font-semibold">
                      <span>Change Returned</span><span>{cur} {fmt(receiptModal.change_amount)}</span>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="bill-footer text-center border-t dm-border-card pt-3 space-y-1">
                  <p className="font-semibold dm-text-secondary text-xs">
                    {receiptModal.pharmacy?.invoice_footer || '✦ Thank you for your purchase! ✦'}
                  </p>
                  <p className="text-xs dm-text-muted">
                    {receiptModal.pharmacy?.invoice_terms || 'Medicines once sold are not returnable.'}
                  </p>
                  <div className="mt-2 text-xs dm-text-muted">Powered by PharmaPOS · {new Date().toLocaleDateString()}</div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{flexShrink:0, display:'flex', gap:'12px', padding:'16px 20px', borderTop:'1px solid var(--border-card)'}} className="no-print">
              <button onClick={() => setReceiptModal(null)} className="btn-secondary flex-1 text-sm py-2.5">Close</button>
              <button onClick={handlePrint} className="btn-primary flex-1 text-sm py-2.5">🖨️ Print Bill</button>
            </div>
          </div>
          </div>
        </div>
      ), document.body)}
    </div>
  );
} 