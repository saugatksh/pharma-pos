import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Modal, ConfirmDialog, Pagination, LoadingSpinner, EmptyState, SearchInput, Badge, Table } from '../components/UI';
import toast from 'react-hot-toast';

const UNITS = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream', 'Ointment', 'Drop', 'Inhaler', 'Sachet', 'Strip', 'Bottle', 'Vial', 'Ampule', 'Patch', 'Suppository'];

const defaultForm = { name: '', generic_name: '', brand_name: '', category_id: '', unit: 'Tablet', description: '', purchase_price: '', selling_price: '', min_stock_level: 10, is_active: true };

// 50 demo medicines
const DEMO_MEDICINES = [
  { name: 'Paracetamol 500mg', generic_name: 'Paracetamol', brand_name: 'Calpol', category: 'Analgesics', unit: 'Tablet', purchase_price: 2.5, selling_price: 4.0, min_stock_level: 50, description: 'Mild pain reliever and fever reducer' },
  { name: 'Amoxicillin 500mg', generic_name: 'Amoxicillin', brand_name: 'Amoxil', category: 'Antibiotics', unit: 'Capsule', purchase_price: 8.0, selling_price: 12.0, min_stock_level: 30, description: 'Broad-spectrum antibiotic' },
  { name: 'Ibuprofen 400mg', generic_name: 'Ibuprofen', brand_name: 'Brufen', category: 'Analgesics', unit: 'Tablet', purchase_price: 3.5, selling_price: 6.0, min_stock_level: 40, description: 'NSAID for pain and inflammation' },
  { name: 'Metformin 500mg', generic_name: 'Metformin', brand_name: 'Glucophage', category: 'Antidiabetics', unit: 'Tablet', purchase_price: 5.0, selling_price: 8.0, min_stock_level: 50, description: 'First-line diabetes medication' },
  { name: 'Omeprazole 20mg', generic_name: 'Omeprazole', brand_name: 'Prilosec', category: 'Antacids', unit: 'Capsule', purchase_price: 6.0, selling_price: 10.0, min_stock_level: 30, description: 'Proton pump inhibitor' },
  { name: 'Amlodipine 5mg', generic_name: 'Amlodipine', brand_name: 'Norvasc', category: 'Antihypertensives', unit: 'Tablet', purchase_price: 4.0, selling_price: 7.0, min_stock_level: 40, description: 'Calcium channel blocker' },
  { name: 'Atorvastatin 10mg', generic_name: 'Atorvastatin', brand_name: 'Lipitor', category: 'Lipid-lowering', unit: 'Tablet', purchase_price: 7.0, selling_price: 12.0, min_stock_level: 30, description: 'Statin for cholesterol' },
  { name: 'Cetirizine 10mg', generic_name: 'Cetirizine', brand_name: 'Zyrtec', category: 'Antihistamines', unit: 'Tablet', purchase_price: 3.0, selling_price: 5.5, min_stock_level: 25, description: 'Non-sedating antihistamine' },
  { name: 'Azithromycin 250mg', generic_name: 'Azithromycin', brand_name: 'Zithromax', category: 'Antibiotics', unit: 'Tablet', purchase_price: 15.0, selling_price: 22.0, min_stock_level: 20, description: 'Macrolide antibiotic' },
  { name: 'Losartan 50mg', generic_name: 'Losartan', brand_name: 'Cozaar', category: 'Antihypertensives', unit: 'Tablet', purchase_price: 6.5, selling_price: 10.0, min_stock_level: 35, description: 'ARB for hypertension' },
  { name: 'Doxycycline 100mg', generic_name: 'Doxycycline', brand_name: 'Vibramycin', category: 'Antibiotics', unit: 'Capsule', purchase_price: 9.0, selling_price: 14.0, min_stock_level: 20, description: 'Tetracycline antibiotic' },
  { name: 'Ranitidine 150mg', generic_name: 'Ranitidine', brand_name: 'Zantac', category: 'Antacids', unit: 'Tablet', purchase_price: 4.5, selling_price: 7.5, min_stock_level: 30, description: 'H2 blocker for acid reflux' },
  { name: 'Ciprofloxacin 500mg', generic_name: 'Ciprofloxacin', brand_name: 'Cipro', category: 'Antibiotics', unit: 'Tablet', purchase_price: 12.0, selling_price: 18.0, min_stock_level: 25, description: 'Fluoroquinolone antibiotic' },
  { name: 'Diclofenac 50mg', generic_name: 'Diclofenac', brand_name: 'Voltaren', category: 'Analgesics', unit: 'Tablet', purchase_price: 4.0, selling_price: 7.0, min_stock_level: 30, description: 'NSAID for pain and arthritis' },
  { name: 'Pantoprazole 40mg', generic_name: 'Pantoprazole', brand_name: 'Protonix', category: 'Antacids', unit: 'Tablet', purchase_price: 8.0, selling_price: 13.0, min_stock_level: 25, description: 'Proton pump inhibitor' },
  { name: 'Glibenclamide 5mg', generic_name: 'Glibenclamide', brand_name: 'Daonil', category: 'Antidiabetics', unit: 'Tablet', purchase_price: 3.5, selling_price: 6.0, min_stock_level: 40, description: 'Sulfonylurea for diabetes' },
  { name: 'Aspirin 75mg', generic_name: 'Aspirin', brand_name: 'Disprin', category: 'Analgesics', unit: 'Tablet', purchase_price: 1.5, selling_price: 3.0, min_stock_level: 60, description: 'Antiplatelet and analgesic' },
  { name: 'Montelukast 10mg', generic_name: 'Montelukast', brand_name: 'Singulair', category: 'Respiratory', unit: 'Tablet', purchase_price: 10.0, selling_price: 16.0, min_stock_level: 20, description: 'Leukotriene antagonist for asthma' },
  { name: 'Metronidazole 400mg', generic_name: 'Metronidazole', brand_name: 'Flagyl', category: 'Antibiotics', unit: 'Tablet', purchase_price: 5.0, selling_price: 8.5, min_stock_level: 30, description: 'Antiprotozoal and antibiotic' },
  { name: 'Furosemide 40mg', generic_name: 'Furosemide', brand_name: 'Lasix', category: 'Diuretics', unit: 'Tablet', purchase_price: 3.0, selling_price: 5.5, min_stock_level: 35, description: 'Loop diuretic' },
  { name: 'Folic Acid 5mg', generic_name: 'Folic Acid', brand_name: 'Folvite', category: 'Vitamins', unit: 'Tablet', purchase_price: 1.0, selling_price: 2.5, min_stock_level: 50, description: 'Vitamin B9 supplement' },
  { name: 'Vitamin D3 1000IU', generic_name: 'Cholecalciferol', brand_name: 'D-Rise', category: 'Vitamins', unit: 'Capsule', purchase_price: 5.0, selling_price: 9.0, min_stock_level: 40, description: 'Vitamin D3 supplement' },
  { name: 'Calcium + D3', generic_name: 'Calcium Carbonate', brand_name: 'Shelcal', category: 'Vitamins', unit: 'Tablet', purchase_price: 6.0, selling_price: 10.0, min_stock_level: 30, description: 'Calcium and Vitamin D supplement' },
  { name: 'Iron Folic Tablet', generic_name: 'Ferrous Sulfate', brand_name: 'Fersolate', category: 'Vitamins', unit: 'Tablet', purchase_price: 2.0, selling_price: 4.0, min_stock_level: 50, description: 'Iron and folic acid supplement' },
  { name: 'Salbutamol Inhaler', generic_name: 'Salbutamol', brand_name: 'Ventolin', category: 'Respiratory', unit: 'Inhaler', purchase_price: 120.0, selling_price: 180.0, min_stock_level: 10, description: 'Bronchodilator for asthma' },
  { name: 'Betamethasone Cream', generic_name: 'Betamethasone', brand_name: 'Betnovate', category: 'Dermatology', unit: 'Cream', purchase_price: 35.0, selling_price: 55.0, min_stock_level: 15, description: 'Topical corticosteroid' },
  { name: 'Clotrimazole Cream', generic_name: 'Clotrimazole', brand_name: 'Canesten', category: 'Antifungals', unit: 'Cream', purchase_price: 25.0, selling_price: 40.0, min_stock_level: 20, description: 'Antifungal cream' },
  { name: 'Albendazole 400mg', generic_name: 'Albendazole', brand_name: 'Zentel', category: 'Anthelmintics', unit: 'Tablet', purchase_price: 8.0, selling_price: 14.0, min_stock_level: 25, description: 'Broad-spectrum anthelmintic' },
  { name: 'Ondansetron 4mg', generic_name: 'Ondansetron', brand_name: 'Zofran', category: 'Antiemetics', unit: 'Tablet', purchase_price: 10.0, selling_price: 16.0, min_stock_level: 20, description: 'Antiemetic for nausea' },
  { name: 'Tramadol 50mg', generic_name: 'Tramadol', brand_name: 'Ultram', category: 'Analgesics', unit: 'Capsule', purchase_price: 12.0, selling_price: 18.0, min_stock_level: 20, description: 'Opioid analgesic for moderate pain' },
  { name: 'Clarithromycin 500mg', generic_name: 'Clarithromycin', brand_name: 'Biaxin', category: 'Antibiotics', unit: 'Tablet', purchase_price: 18.0, selling_price: 28.0, min_stock_level: 15, description: 'Macrolide antibiotic' },
  { name: 'Enalapril 5mg', generic_name: 'Enalapril', brand_name: 'Vasotec', category: 'Antihypertensives', unit: 'Tablet', purchase_price: 4.5, selling_price: 8.0, min_stock_level: 35, description: 'ACE inhibitor for hypertension' },
  { name: 'Prednisolone 5mg', generic_name: 'Prednisolone', brand_name: 'Deltacortril', category: 'Corticosteroids', unit: 'Tablet', purchase_price: 5.0, selling_price: 9.0, min_stock_level: 25, description: 'Corticosteroid for inflammation' },
  { name: 'Levofloxacin 500mg', generic_name: 'Levofloxacin', brand_name: 'Levaquin', category: 'Antibiotics', unit: 'Tablet', purchase_price: 20.0, selling_price: 30.0, min_stock_level: 15, description: 'Fluoroquinolone antibiotic' },
  { name: 'Clopidogrel 75mg', generic_name: 'Clopidogrel', brand_name: 'Plavix', category: 'Antiplatelet', unit: 'Tablet', purchase_price: 8.0, selling_price: 13.0, min_stock_level: 30, description: 'Antiplatelet for cardiovascular' },
  { name: 'Simvastatin 20mg', generic_name: 'Simvastatin', brand_name: 'Zocor', category: 'Lipid-lowering', unit: 'Tablet', purchase_price: 6.0, selling_price: 10.0, min_stock_level: 30, description: 'Statin for cholesterol management' },
  { name: 'Clonazepam 0.5mg', generic_name: 'Clonazepam', brand_name: 'Klonopin', category: 'Anxiolytics', unit: 'Tablet', purchase_price: 7.0, selling_price: 12.0, min_stock_level: 20, description: 'Benzodiazepine for anxiety' },
  { name: 'Esomeprazole 40mg', generic_name: 'Esomeprazole', brand_name: 'Nexium', category: 'Antacids', unit: 'Capsule', purchase_price: 12.0, selling_price: 19.0, min_stock_level: 25, description: 'PPI for GERD treatment' },
  { name: 'Warfarin 5mg', generic_name: 'Warfarin', brand_name: 'Coumadin', category: 'Anticoagulants', unit: 'Tablet', purchase_price: 5.0, selling_price: 9.0, min_stock_level: 20, description: 'Anticoagulant blood thinner' },
  { name: 'Methyldopa 250mg', generic_name: 'Methyldopa', brand_name: 'Aldomet', category: 'Antihypertensives', unit: 'Tablet', purchase_price: 4.0, selling_price: 7.0, min_stock_level: 30, description: 'Central alpha agonist for BP' },
  { name: 'Domperidone 10mg', generic_name: 'Domperidone', brand_name: 'Motilium', category: 'Antiemetics', unit: 'Tablet', purchase_price: 3.5, selling_price: 6.0, min_stock_level: 30, description: 'Antiemetic and prokinetic' },
  { name: 'ORS Sachet', generic_name: 'Oral Rehydration Salts', brand_name: 'Electral', category: 'Electrolytes', unit: 'Sachet', purchase_price: 8.0, selling_price: 12.0, min_stock_level: 50, description: 'Oral rehydration therapy' },
  { name: 'Lactulose Syrup', generic_name: 'Lactulose', brand_name: 'Duphalac', category: 'Laxatives', unit: 'Syrup', purchase_price: 80.0, selling_price: 120.0, min_stock_level: 10, description: 'Osmotic laxative for constipation' },
  { name: 'Multivitamin Tablet', generic_name: 'Multivitamins', brand_name: 'Supradyn', category: 'Vitamins', unit: 'Tablet', purchase_price: 5.0, selling_price: 9.0, min_stock_level: 40, description: 'Comprehensive multivitamin' },
  { name: 'Chlorphenamine 4mg', generic_name: 'Chlorphenamine', brand_name: 'Piriton', category: 'Antihistamines', unit: 'Tablet', purchase_price: 2.0, selling_price: 4.0, min_stock_level: 30, description: 'Sedating antihistamine for allergies' },
  { name: 'Gentamicin Eye Drop', generic_name: 'Gentamicin', brand_name: 'Garamycin', category: 'Eye/Ear Drops', unit: 'Drop', purchase_price: 40.0, selling_price: 60.0, min_stock_level: 15, description: 'Antibiotic eye drops' },
  { name: 'Normal Saline 0.9%', generic_name: 'Sodium Chloride', brand_name: 'NaCl Saline', category: 'Infusions', unit: 'Bottle', purchase_price: 50.0, selling_price: 80.0, min_stock_level: 20, description: 'Isotonic saline solution' },
  { name: 'Insulin Regular', generic_name: 'Human Insulin', brand_name: 'Actrapid', category: 'Antidiabetics', unit: 'Vial', purchase_price: 200.0, selling_price: 280.0, min_stock_level: 10, description: 'Short-acting insulin' },
  { name: 'Ketoconazole Shampoo', generic_name: 'Ketoconazole', brand_name: 'Nizoral', category: 'Antifungals', unit: 'Bottle', purchase_price: 60.0, selling_price: 90.0, min_stock_level: 10, description: 'Antifungal shampoo for dandruff' },
  { name: 'Diazepam 5mg', generic_name: 'Diazepam', brand_name: 'Valium', category: 'Anxiolytics', unit: 'Tablet', purchase_price: 3.0, selling_price: 6.0, min_stock_level: 20, description: 'Benzodiazepine for anxiety and seizures' },
];

const CSV_HEADERS = ['name', 'generic_name', 'brand_name', 'category', 'unit', 'purchase_price', 'selling_price', 'min_stock_level', 'description'];

function downloadDemoCSV() {
  const rows = [CSV_HEADERS.join(',')];
  DEMO_MEDICINES.forEach(m => {
    rows.push(CSV_HEADERS.map(h => {
      const v = m[h] ?? '';
      return typeof v === 'string' && (v.includes(',') || v.includes('"'))
        ? `"${v.replace(/"/g, '""')}"`
        : v;
    }).join(','));
  });
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'demo_medicines.csv'; a.click();
  URL.revokeObjectURL(url);
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const values = [];
    let cur = ''; let inQ = false;
    for (const ch of lines[i]) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { values.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    values.push(cur.trim());
    if (values.length < 2) continue;
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = values[idx] ?? ''; });
    results.push(obj);
  }
  return results;
}

export default function MedicinesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [medicines, setMedicines] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [deleteId, setDeleteId] = useState(null);
  const [saving, setSaving] = useState(false);

  // CSV states
  const [csvUploading, setCsvUploading] = useState(false);
  const [showCsvPreview, setShowCsvPreview] = useState(false);
  const [csvPreviewData, setCsvPreviewData] = useState([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvProgress, setCsvProgress] = useState({ done: 0, total: 0, errors: [] });
  const csvInputRef = useRef(null);

  const fetchMedicines = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (search) params.set('search', search);
      if (categoryFilter) params.set('category_id', categoryFilter);
      const { data } = await api.get(`/medicines?${params}`);
      setMedicines(data.data);
      setPagination(data.pagination);
    } catch { toast.error('Failed to load medicines'); }
    finally { setLoading(false); }
  }, [page, search, categoryFilter]);

  useEffect(() => { fetchMedicines(); }, [fetchMedicines]);
  useEffect(() => { api.get('/medicines/categories').then(r => setCategories(r.data.data)).catch(() => {}); }, []);
  useEffect(() => { setPage(1); }, [search, categoryFilter]);

  const openCreate = () => { setEditing(null); setForm(defaultForm); setShowModal(true); };
  const openEdit = (m) => { setEditing(m); setForm({ ...m, category_id: m.category_id || '' }); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.selling_price) return toast.error('Name and selling price are required');
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/medicines/${editing.id}`, form);
        toast.success('Medicine updated');
      } else {
        await api.post('/medicines', form);
        toast.success('Medicine added');
      }
      setShowModal(false);
      fetchMedicines();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/medicines/${deleteId}`);
      toast.success('Medicine deleted');
      setDeleteId(null);
      fetchMedicines();
    } catch { toast.error('Failed to delete'); }
  };

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) return toast.error('Please upload a .csv file');
    setCsvUploading(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = parseCSV(evt.target.result);
        if (parsed.length === 0) { toast.error('No valid rows found in CSV'); setCsvUploading(false); return; }
        setCsvPreviewData(parsed);
        setShowCsvPreview(true);
      } catch {
        toast.error('Failed to parse CSV');
      }
      setCsvUploading(false);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportCSV = async () => {
    setCsvImporting(true);
    setCsvProgress({ done: 0, total: csvPreviewData.length, errors: [] });
    const errors = [];
    for (let i = 0; i < csvPreviewData.length; i++) {
      const row = csvPreviewData[i];
      try {
        await api.post('/medicines', {
          name: row.name,
          generic_name: row.generic_name || '',
          brand_name: row.brand_name || '',
          unit: row.unit || 'Tablet',
          purchase_price: parseFloat(row.purchase_price) || 0,
          selling_price: parseFloat(row.selling_price) || 0,
          min_stock_level: parseInt(row.min_stock_level) || 10,
          description: row.description || '',
          is_active: true,
        });
      } catch (err) {
        errors.push(`Row ${i + 1} (${row.name}): ${err.response?.data?.message || 'Failed'}`);
      }
      setCsvProgress({ done: i + 1, total: csvPreviewData.length, errors });
    }
    setCsvImporting(false);
    if (errors.length === 0) {
      toast.success(`✅ Imported ${csvPreviewData.length} medicines successfully!`);
    } else {
      toast.error(`Imported with ${errors.length} error(s). Check preview.`);
    }
    setShowCsvPreview(false);
    fetchMedicines();
  };

  const stockColor = (stock, min) => {
    if (stock === 0) return 'red';
    if (stock <= min) return 'yellow';
    return 'green';
  };

  const columns = [
    { label: 'Medicine', key: 'name', render: m => (
      <div>
        <div className="font-medium dm-text-primary">{m.name}</div>
        <div className="text-xs dm-text-muted">{m.generic_name || '—'} · {m.brand_name || '—'}</div>
      </div>
    )},
    { label: 'Category', render: m => <span className="text-sm dm-text-secondary">{m.category_name || '—'}</span> },
    { label: 'Unit', render: m => <span className="text-sm dm-text-secondary">{m.unit}</span> },
    { label: 'Purchase Price', render: m => <span className="text-sm font-mono dm-text-secondary">{parseFloat(m.purchase_price).toFixed(2)}</span> },
    { label: 'Selling Price', render: m => <span className="text-sm font-mono font-semibold text-emerald-600">{parseFloat(m.selling_price).toFixed(2)}</span> },
    { label: 'Stock', render: m => (
      <Badge type={stockColor(m.current_stock, m.min_stock_level)}>
        {m.current_stock} {m.unit}
      </Badge>
    )},
    { label: 'Status', render: m => <Badge type={m.is_active ? 'green' : 'gray'}>{m.is_active ? 'Active' : 'Inactive'}</Badge> },
    ...(isAdmin ? [{ label: 'Actions', render: m => (
      <div className="flex gap-2">
        <button onClick={() => openEdit(m)} className="text-blue-500 hover:text-blue-700 text-sm font-medium">Edit</button>
        <button onClick={() => setDeleteId(m.id)} className="text-red-500 hover:text-red-700 text-sm font-medium">Delete</button>
      </div>
    )}] : []),
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold dm-text-primary">Medicines</h1>
          <p className="text-sm dm-text-muted mt-0.5">Manage your pharmacy medicine catalogue</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* CSV buttons */}

          {isAdmin && (
            <>
              <button onClick={downloadDemoCSV}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border dm-border-card dm-text-secondary dm-bg-card hover:border-emerald-400 hover:text-emerald-600 text-sm font-medium transition-all shadow-sm">
                ⬇️ Download Demo CSV
              </button>
              <button onClick={() => csvInputRef.current?.click()}
                disabled={csvUploading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-all shadow-sm disabled:opacity-50">
                ⬆️ {csvUploading ? 'Reading...' : 'Upload CSV'}
              </button>
              <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} />
              <button onClick={openCreate} className="btn-primary">+ Add Medicine</button>
            </>
          )}
        </div>
      </div>

      {/* CSV info banner */}
      <div className="card p-4 border-l-4 border-emerald-500">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <div className="text-sm font-semibold dm-text-primary">Bulk Import via CSV</div>
            <div className="text-xs dm-text-muted mt-0.5">
              Download the demo CSV with 50 sample medicines → edit/add your own → upload to import all at once.
              Columns: <code className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 px-1 rounded text-xs">name, generic_name, brand_name, category, unit, purchase_price, selling_price, min_stock_level, description</code>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <SearchInput value={search} onChange={setSearch} placeholder="Search by name, generic, brand..." />
          </div>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="input w-full sm:w-48">
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? <LoadingSpinner /> : medicines.length === 0 ? (
          <EmptyState icon="💊" title="No medicines found"
            subtitle={search ? 'Try a different search term' : 'Add medicines or import via CSV to get started'}
            action={isAdmin && (
              <div className="flex gap-2 justify-center">

                <button onClick={openCreate} className="btn-primary text-sm">+ Add Medicine</button>
              </div>
            )}
          />
        ) : (
          <>
            <Table columns={columns} data={medicines} loading={false} />
            <div className="px-6 pb-4">
              <Pagination pagination={pagination} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Medicine' : 'Add Medicine'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium dm-text-primary mb-1">Medicine Name *</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input" placeholder="e.g. Paracetamol 500mg" required />
            </div>
            <div>
              <label className="block text-sm font-medium dm-text-primary mb-1">Generic Name</label>
              <input value={form.generic_name || ''} onChange={e => setForm({...form, generic_name: e.target.value})} className="input" placeholder="e.g. Paracetamol" />
            </div>
            <div>
              <label className="block text-sm font-medium dm-text-primary mb-1">Brand Name</label>
              <input value={form.brand_name || ''} onChange={e => setForm({...form, brand_name: e.target.value})} className="input" placeholder="e.g. Calpol" />
            </div>
            <div>
              <label className="block text-sm font-medium dm-text-primary mb-1">Category</label>
              <select value={form.category_id || ''} onChange={e => setForm({...form, category_id: e.target.value})} className="input">
                <option value="">Select Category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium dm-text-primary mb-1">Unit *</label>
              <select value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} className="input" required>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium dm-text-primary mb-1">Purchase Price *</label>
              <input type="number" step="0.01" min="0" value={form.purchase_price} onChange={e => setForm({...form, purchase_price: e.target.value})} className="input" required />
            </div>
            <div>
              <label className="block text-sm font-medium dm-text-primary mb-1">Selling Price *</label>
              <input type="number" step="0.01" min="0" value={form.selling_price} onChange={e => setForm({...form, selling_price: e.target.value})} className="input" required />
            </div>
            <div>
              <label className="block text-sm font-medium dm-text-primary mb-1">Min Stock Level</label>
              <input type="number" min="0" value={form.min_stock_level} onChange={e => setForm({...form, min_stock_level: e.target.value})} className="input" />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})} className="rounded w-4 h-4" />
              <label htmlFor="is_active" className="text-sm font-medium dm-text-primary">Active</label>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium dm-text-primary mb-1">Description</label>
              <textarea value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} className="input" rows={2} />
            </div>
          </div>
          <div className="flex gap-3 pt-2 justify-end">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : editing ? 'Update' : 'Add Medicine'}</button>
          </div>
        </form>
      </Modal>

      {/* CSV Preview Modal */}
      <Modal open={showCsvPreview} onClose={() => !csvImporting && setShowCsvPreview(false)} title={`CSV Preview — ${csvPreviewData.length} medicines`} size="lg">
        <div className="space-y-4">
          {csvImporting ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4" />
              <div className="text-lg font-bold dm-text-primary">{csvProgress.done} / {csvProgress.total}</div>
              <div className="dm-text-muted text-sm mt-1">Importing medicines…</div>
              <div className="w-full mt-3 rounded-full h-2 dm-bg-card border dm-border-card overflow-hidden">
                <div className="h-2 bg-emerald-500 rounded-full transition-all" style={{ width: `${(csvProgress.done / csvProgress.total) * 100}%` }} />
              </div>
              {csvProgress.errors.length > 0 && (
                <div className="mt-3 text-xs text-red-500">{csvProgress.errors.slice(-3).join(', ')}</div>
              )}
            </div>
          ) : (
            <>
              <div className="text-sm dm-text-muted">Review the medicines to be imported. Rows with errors will be skipped.</div>
              <div className="overflow-auto max-h-64 border dm-border-card rounded-xl">
                <table className="w-full text-xs">
                  <thead style={{ background: 'var(--bg-table-head)' }}>
                    <tr>{['#', 'Name', 'Generic', 'Unit', 'Buy Price', 'Sell Price'].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-xs font-semibold dm-text-muted">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y dm-border-card">
                    {csvPreviewData.slice(0, 20).map((row, i) => (
                      <tr key={i} className={`dm-row-hover ${!row.name || !row.selling_price ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
                        <td className="px-3 py-1.5 dm-text-muted">{i + 1}</td>
                        <td className="px-3 py-1.5 font-medium dm-text-primary">{row.name || <span className="text-red-500">MISSING</span>}</td>
                        <td className="px-3 py-1.5 dm-text-secondary">{row.generic_name || '—'}</td>
                        <td className="px-3 py-1.5 dm-text-secondary">{row.unit || 'Tablet'}</td>
                        <td className="px-3 py-1.5 dm-text-secondary">{row.purchase_price}</td>
                        <td className="px-3 py-1.5 text-emerald-600 font-semibold">{row.selling_price || <span className="text-red-500">MISSING</span>}</td>
                      </tr>
                    ))}
                    {csvPreviewData.length > 20 && (
                      <tr><td colSpan={6} className="px-3 py-2 text-center dm-text-muted">… and {csvPreviewData.length - 20} more rows</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowCsvPreview(false)} className="btn-secondary">Cancel</button>
                <button onClick={handleImportCSV} className="btn-primary">
                  ✅ Import {csvPreviewData.length} Medicines
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="Delete Medicine" message="Are you sure you want to delete this medicine? This action cannot be undone."
        confirmText="Delete" type="danger"
      />
    </div>
  );
}