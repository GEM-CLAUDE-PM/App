// ProcurementDashboard.tsx — GEM&CLAUDE PM Pro · S12
// Mua sắm: RFQ → 3 báo giá → PO approval → auto-update Materials
// Workflow: Công trình/Cung ứng → CHT → PM → (GĐ nếu vượt ngưỡng)

import ModalForm, { FormRow, FormGrid, FormSection, inputCls, selectCls, BtnCancel, BtnSubmit } from './ModalForm';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShoppingCart, Plus, Search, FileText, CheckCircle2, X,
  ChevronDown, ChevronRight, AlertTriangle, Clock, DollarSign,
  Send, Eye, Trash2, Save, Package, Loader2, Building2,
  Star, Filter, Download, ArrowRight, Lock,
} from 'lucide-react';
import { useNotification } from './NotificationEngine';
import { db } from './db';
import { getCurrentMember, buildCtxFromMember } from './projectMember';
import { createDocument, submitDocument } from './approvalEngine';
import type { DashboardProps } from './types';
import {
  type RFQ, type Quote, type PurchaseOrder, type Supplier,
  type RFQStatus, type POStatus, type ProcurementCat,
  INIT_RFQS, INIT_SUPPLIERS, INIT_POS,
  PROCUREMENT_CAT, RFQ_STATUS, PO_STATUS,
  DEFAULT_GD_THRESHOLD, fmt, fmtB,
} from './QSTypes';

type ViewMode = 'rfq' | 'po' | 'suppliers';

// ── Helpers ────────────────────────────────────────────────────────────────────
function calcQuoteTotal(items: Quote['items'], vatPct: number): number {
  const sub = items.reduce((s, i) => s + i.total, 0);
  return Math.round(sub * (1 + vatPct / 100));
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function ProcurementDashboard({ project }: DashboardProps) {
  const pid         = project?.id   || 'default';
  const projectName = project?.name || 'Dự án';
  const { ok: notifOk, err: notifErr, warn: notifWarn } = useNotification();

  // ── State ──────────────────────────────────────────────────────────────────
  const [view, setView]             = useState<ViewMode>('rfq');
  const [rfqs, setRfqs]             = useState<RFQ[]>(INIT_RFQS);
  const [quotes, setQuotes]         = useState<Quote[]>([]);
  const [pos, setPOs]               = useState<PurchaseOrder[]>(INIT_POS);
  const [suppliers, setSuppliers]   = useState<Supplier[]>(INIT_SUPPLIERS);
  const [gdThreshold, setGdThreshold] = useState(DEFAULT_GD_THRESHOLD);

  // UI state
  const [selectedRFQ, setSelectedRFQ]   = useState<RFQ | null>(null);
  const [selectedPO, setSelectedPO]     = useState<PurchaseOrder | null>(null);
  const [showRFQForm, setShowRFQForm]   = useState(false);
  const [showQuoteForm, setShowQuoteForm] = useState<string | null>(null); // rfq_id
  const [showPOForm, setShowPOForm]     = useState<string | null>(null);   // quote_id
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [searchQ, setSearchQ]           = useState('');
  const [filterCat, setFilterCat]       = useState<ProcurementCat | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Form state
  const [rfqForm, setRfqForm]         = useState<Partial<RFQ>>({ category: 'vat_lieu', items: [{ description: '', unit: '', qty: 0 }] });
  const [quoteForm, setQuoteForm]     = useState<Partial<Quote>>({ items: [], vat_pct: 10, supplier_id: '', supplier_name: '' });
  const [supplierForm, setSupplierForm] = useState<Partial<Supplier>>({ category: ['vat_lieu'], rating: 3 });

  // ── Load from db ───────────────────────────────────────────────────────────
  const [dbLoaded, setDbLoaded] = useState(false);
  useEffect(() => {
    setDbLoaded(false);
    (async () => {
      const [r, q, p, s, threshold] = await Promise.all([
        db.get<RFQ[]>('procurement_rfqs', pid, INIT_RFQS.map(rfq => ({ ...rfq, project_id: pid }))),
        db.get<Quote[]>('procurement_quotes', pid, []),
        db.get<PurchaseOrder[]>('procurement_pos', pid, INIT_POS),
        db.get<Supplier[]>('procurement_suppliers', pid, INIT_SUPPLIERS),
        db.get<number>('procurement_gd_threshold', pid, DEFAULT_GD_THRESHOLD),
      ]);
      setRfqs(r); setQuotes(q); setPOs(p); setSuppliers(s); setGdThreshold(threshold);
      setDbLoaded(true);
    })();
  }, [pid]);

  // ── Persist ────────────────────────────────────────────────────────────────
  useEffect(() => { if (dbLoaded) db.set('procurement_rfqs', pid, rfqs); }, [rfqs, pid]);
  useEffect(() => { if (dbLoaded) db.set('procurement_quotes', pid, quotes); }, [quotes, pid]);
  useEffect(() => { if (dbLoaded) db.set('procurement_pos', pid, pos); }, [pos, pid]);
  useEffect(() => { if (dbLoaded) db.set('procurement_suppliers', pid, suppliers); }, [suppliers, pid]);

  // ── Computed ───────────────────────────────────────────────────────────────
  const currentMember = getCurrentMember(pid);
  const currentCtx    = buildCtxFromMember(currentMember);

  const filteredRFQs = useMemo(() => rfqs.filter(r => {
    const q = searchQ.toLowerCase();
    const matchSearch = !q || r.title.toLowerCase().includes(q) || r.rfq_no.toLowerCase().includes(q);
    const matchCat    = filterCat === 'all' || r.category === filterCat;
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    return matchSearch && matchCat && matchStatus;
  }), [rfqs, searchQ, filterCat, filterStatus]);

  const filteredPOs = useMemo(() => pos.filter(p => {
    const q = searchQ.toLowerCase();
    const matchSearch = !q || p.po_no.toLowerCase().includes(q) || p.supplier_name.toLowerCase().includes(q);
    const matchStatus = filterStatus === 'all' || p.status === filterStatus;
    return matchSearch && matchStatus;
  }), [pos, searchQ, filterStatus]);

  // KPI
  const totalPOValue   = useMemo(() => pos.filter(p => p.status === 'approved' || p.status === 'completed').reduce((s, p) => s + p.total, 0), [pos]);
  const pendingRFQs    = rfqs.filter(r => r.status === 'submitted').length;
  const pendingPOs     = pos.filter(p => p.status === 'pending_pm' || p.status === 'pending_gd').length;

  // ── Create RFQ ─────────────────────────────────────────────────────────────
  const createRFQ = useCallback(() => {
    if (!rfqForm.title || !rfqForm.items?.length) { notifWarn('Điền đầy đủ thông tin!'); return; }
    const rfq: RFQ = {
      id:           `rfq_${Date.now()}`,
      rfq_no:       `RFQ-${new Date().getFullYear()}-${String(rfqs.length + 1).padStart(3, '0')}`,
      project_id:   pid,
      title:        rfqForm.title!,
      category:     rfqForm.category || 'vat_lieu',
      items:        rfqForm.items!,
      requested_by: currentMember.userName,
      status:       'draft',
      deadline:     rfqForm.deadline || '',
      notes:        rfqForm.notes,
      created_at:   new Date().toLocaleDateString('vi-VN'),
    };
    setRfqs(prev => [rfq, ...prev]);
    setRfqForm({ category: 'vat_lieu', items: [{ description: '', unit: '', qty: 0 }] });
    setShowRFQForm(false);
    notifOk(`Tạo ${rfq.rfq_no} thành công!`);
  }, [rfqForm, rfqs.length, pid, currentMember]);

  // ── Submit RFQ for approval ─────────────────────────────────────────────────
  const submitRFQ = useCallback((rfqId: string) => {
    setRfqs(prev => prev.map(r => r.id === rfqId ? { ...r, status: 'submitted' as RFQStatus } : r));
    notifOk('Đã gửi RFQ chờ duyệt!');
  }, []);

  const approveRFQ = useCallback((rfqId: string) => {
    setRfqs(prev => prev.map(r => r.id === rfqId ? { ...r, status: 'approved' as RFQStatus, approved_by: currentMember.userName } : r));
    notifOk('Đã duyệt RFQ!');
  }, [currentMember]);

  // ── Add quote ──────────────────────────────────────────────────────────────
  const addQuote = useCallback((rfqId: string) => {
    if (!quoteForm.supplier_id || !quoteForm.items?.length) { notifWarn('Chọn nhà cung cấp và nhập báo giá!'); return; }
    const sup = suppliers.find(s => s.id === quoteForm.supplier_id);
    const items = quoteForm.items!.map(i => ({ ...i, total: i.qty * i.unit_price }));
    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const vatPct   = quoteForm.vat_pct || 10;
    const total    = Math.round(subtotal * (1 + vatPct / 100));

    const quote: Quote = {
      id:           `quote_${Date.now()}`,
      rfq_id:       rfqId,
      supplier_id:  quoteForm.supplier_id!,
      supplier_name: sup?.name || quoteForm.supplier_name || '',
      items, subtotal, vat_pct: vatPct, total,
      validity:     quoteForm.validity || '30 ngày',
      delivery:     quoteForm.delivery || '14 ngày',
      status:       'received',
      received_at:  new Date().toLocaleDateString('vi-VN'),
      notes:        quoteForm.notes,
    };
    setQuotes(prev => [...prev, quote]);
    setQuoteForm({ items: [], vat_pct: 10, supplier_id: '', supplier_name: '' });
    setShowQuoteForm(null);
    notifOk('Đã thêm báo giá!');
  }, [quoteForm, suppliers]);

  // ── Select quote & create PO ───────────────────────────────────────────────
  const selectQuote = useCallback((quoteId: string) => {
    setQuotes(prev => prev.map(q => ({ ...q, status: q.id === quoteId ? 'selected' : (q.status === 'selected' ? 'received' : q.status) as Quote['status'] })));
  }, []);

  const createPO = useCallback((quote: Quote, rfq: RFQ) => {
    const needGD = quote.total >= gdThreshold;
    const po: PurchaseOrder = {
      id:            `po_${Date.now()}`,
      po_no:         `PO-${new Date().getFullYear()}-${String(pos.length + 1).padStart(3, '0')}`,
      rfq_id:        rfq.id,
      quote_id:      quote.id,
      project_id:    pid,
      supplier_id:   quote.supplier_id,
      supplier_name: quote.supplier_name,
      items:         quote.items,
      subtotal:      quote.subtotal,
      vat_pct:       quote.vat_pct,
      total:         quote.total,
      delivery_date: quote.delivery,
      delivery_addr: '',
      payment_terms: 'Thanh toán 30 ngày sau khi giao hàng',
      status:        'pending_pm',
      gd_threshold:  gdThreshold,
      created_at:    new Date().toLocaleDateString('vi-VN'),
      mat_voucher_created: false,
    };
    setPOs(prev => [po, ...prev]);
    setShowPOForm(null);

    // Tạo document trong approvalEngine
    createDocument({
      projectId: pid,
      docType: 'FINANCIAL_VOUCHER',
      title: `${po.po_no} — ${po.supplier_name} — ${fmtB(po.total)}`,
      data: { po_id: po.id, po_no: po.po_no, supplier: po.supplier_name, total: po.total },
      amount: po.total,
      ctx: currentCtx,
    });

    notifOk(`Tạo ${po.po_no} — ${needGD ? 'Cần GĐ duyệt (vượt ngưỡng)' : 'Chờ PM duyệt'}!`);
  }, [pos.length, pid, gdThreshold, currentCtx]);

  // ── Approve/Reject PO ──────────────────────────────────────────────────────
  const approvePO = useCallback(async (poId: string, byGD = false) => {
    setPOs(prev => prev.map(p => {
      if (p.id !== poId) return p;
      const nextStatus: POStatus = byGD ? 'approved' : (p.total >= gdThreshold ? 'pending_gd' : 'approved');
      return { ...p, status: nextStatus, ...(byGD ? { approved_by_gd: currentMember.userName } : { approved_by_pm: currentMember.userName }) };
    }));

    // Auto-create Materials voucher khi PO approved
    const po = pos.find(p => p.id === poId);
    if (po && !po.mat_voucher_created) {
      const matVouchers = await db.get<any[]>('mat_vouchers', pid, []);
      const newVoucher = {
        id:        `pov_${Date.now()}`,
        code:      `PN-${po.po_no}`,
        type:      'PN',
        ngay:      new Date().toLocaleDateString('vi-VN'),
        nhaCungCap: po.supplier_name,
        soPhieu:   po.po_no,
        items:     po.items.map(i => ({ tenVatTu: i.description, donVi: i.unit, soLuong: i.qty, donGia: i.unit_price, thanhTien: i.total })),
        totalAmount: po.subtotal,
        status:    'approved',
        source:    'procurement',
        po_id:     po.id,
      };
      await db.set('mat_vouchers', pid, [...matVouchers, newVoucher]);
      setPOs(prev => prev.map(p => p.id === poId ? { ...p, mat_voucher_created: true } : p));
      notifOk('PO đã duyệt — Phiếu nhập kho tạo tự động!');
    } else {
      notifOk('PO đã duyệt!');
    }
  }, [pos, pid, gdThreshold, currentMember]);

  const rejectPO = useCallback((poId: string) => {
    setPOs(prev => prev.map(p => p.id === poId ? { ...p, status: 'rejected' } : p));
    notifWarn('Đã từ chối PO!');
  }, []);

  // ── Add supplier ───────────────────────────────────────────────────────────
  const addSupplier = useCallback(() => {
    if (!supplierForm.name) { notifWarn('Nhập tên nhà cung cấp!'); return; }
    const sup: Supplier = {
      id:       `sup_${Date.now()}`,
      name:     supplierForm.name!,
      tax_code: supplierForm.tax_code || '',
      phone:    supplierForm.phone || '',
      email:    supplierForm.email || '',
      address:  supplierForm.address || '',
      category: supplierForm.category || ['vat_lieu'],
      rating:   supplierForm.rating || 3,
      notes:    supplierForm.notes,
    };
    setSuppliers(prev => [...prev, sup]);
    setSupplierForm({ category: ['vat_lieu'], rating: 3 });
    setShowSupplierForm(false);
    notifOk('Đã thêm nhà cung cấp!');
  }, [supplierForm]);

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-4">

      {/* ── Header KPI ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <ShoppingCart size={20} className="text-teal-600"/>
              Mua sắm & Đấu thầu — {projectName}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              RFQ → Báo giá → PO → Auto-update Vật tư · Ngưỡng GĐ: {fmtB(gdThreshold)}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Tổng RFQ',         value: rfqs.length,          cls: 'text-slate-700' },
            { label: 'RFQ chờ duyệt',    value: pendingRFQs,          cls: 'text-amber-700' },
            { label: 'PO chờ duyệt',     value: pendingPOs,           cls: 'text-orange-700'},
            { label: 'Tổng PO đã duyệt', value: fmtB(totalPOValue),  cls: 'text-emerald-700'},
          ].map((k, i) => (
            <div key={i} className="bg-slate-50 rounded-xl p-3">
              <div className={`text-xl font-bold ${k.cls}`}>{k.value}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── View tabs ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl">
          {([['rfq', '📋 RFQ & Báo giá'], ['po', '📦 Purchase Orders'], ['suppliers', '🏢 Nhà cung cấp']] as [ViewMode, string][]).map(([v, l]) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all
                ${view === v ? 'bg-white shadow-sm text-teal-700' : 'text-slate-500 hover:text-slate-700'}`}>
              {l}
              {v === 'rfq' && pendingRFQs > 0 && <span className="ml-1.5 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{pendingRFQs}</span>}
              {v === 'po' && pendingPOs > 0 && <span className="ml-1.5 bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{pendingPOs}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* VIEW: RFQ & QUOTES                                                    */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {view === 'rfq' && (
        <div className="space-y-3">
          {/* Toolbar */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                placeholder="Tìm RFQ..."
                className="pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white w-40 focus:outline-none focus:ring-2 focus:ring-teal-200"/>
            </div>
            <select value={filterCat} onChange={e => setFilterCat(e.target.value as any)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700">
              <option value="all">Tất cả danh mục</option>
              {Object.entries(PROCUREMENT_CAT).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700">
              <option value="all">Tất cả trạng thái</option>
              {Object.entries(RFQ_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <button onClick={() => setShowRFQForm(true)}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-bold hover:bg-teal-700">
              <Plus size={12}/> Tạo RFQ
            </button>
          </div>

          {/* RFQ List */}
          <div className="space-y-3">
            {filteredRFQs.map(rfq => {
              const rfqQuotes = quotes.filter(q => q.rfq_id === rfq.id);
              const isExpanded = selectedRFQ?.id === rfq.id;

              return (
                <div key={rfq.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  {/* RFQ header */}
                  <div className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedRFQ(isExpanded ? null : rfq)}>
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{PROCUREMENT_CAT[rfq.category]?.icon}</span>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{rfq.title}</p>
                        <p className="text-[10px] text-slate-400">{rfq.rfq_no} · {rfq.created_at} · Yêu cầu: {rfq.requested_by}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-slate-400">{rfqQuotes.length} báo giá</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${RFQ_STATUS[rfq.status].cls}`}>
                        {RFQ_STATUS[rfq.status].label}
                      </span>
                      {/* Actions */}
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        {rfq.status === 'draft' && (
                          <button onClick={() => submitRFQ(rfq.id)}
                            className="flex items-center gap-1 px-2 py-1 bg-amber-500 text-white rounded-lg text-[10px] font-bold hover:bg-amber-600">
                            <Send size={9}/> Gửi duyệt
                          </button>
                        )}
                        {rfq.status === 'submitted' && (
                          <button onClick={() => approveRFQ(rfq.id)}
                            className="flex items-center gap-1 px-2 py-1 bg-emerald-500 text-white rounded-lg text-[10px] font-bold hover:bg-emerald-600">
                            <CheckCircle2 size={9}/> Duyệt
                          </button>
                        )}
                        {rfq.status === 'approved' && (
                          <button onClick={() => setShowQuoteForm(rfq.id)}
                            className="flex items-center gap-1 px-2 py-1 bg-indigo-500 text-white rounded-lg text-[10px] font-bold hover:bg-indigo-600">
                            <Plus size={9}/> Thêm BG
                          </button>
                        )}
                      </div>
                      {isExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                    </div>
                  </div>

                  {/* Quote form */}
                  {showQuoteForm === rfq.id && (
                    <div className="px-4 py-4 bg-indigo-50 border-t border-indigo-100">
                      <h4 className="font-bold text-indigo-800 text-xs mb-3">Nhập báo giá từ nhà cung cấp</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                        <select value={quoteForm.supplier_id} onChange={e => {
                          const sup = suppliers.find(s => s.id === e.target.value);
                          setQuoteForm(p => ({...p, supplier_id: e.target.value, supplier_name: sup?.name || ''}));
                        }} className="col-span-2 border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white">
                          <option value="">-- Chọn nhà cung cấp --</option>
                          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <input type="number" placeholder="VAT %" value={quoteForm.vat_pct || 10} onChange={e => setQuoteForm(p => ({...p, vat_pct: +e.target.value}))}
                          className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"/>
                        <input placeholder="Hiệu lực báo giá" value={quoteForm.validity || ''} onChange={e => setQuoteForm(p => ({...p, validity: e.target.value}))}
                          className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"/>
                      </div>

                      {/* Quote items — auto-fill from RFQ */}
                      <div className="space-y-1.5 mb-3">
                        {rfq.items.map((rfqItem, idx) => {
                          const qItem = quoteForm.items?.[idx] || { description: rfqItem.description, unit: rfqItem.unit, qty: rfqItem.qty, unit_price: 0, total: 0 };
                          return (
                            <div key={idx} className="flex gap-2 items-center">
                              <span className="text-xs text-slate-600 flex-1">{rfqItem.description} ({rfqItem.qty} {rfqItem.unit})</span>
                              <input type="number" placeholder="Đơn giá" value={qItem.unit_price || ''}
                                onChange={e => {
                                  const price = +e.target.value;
                                  const newItems = [...(quoteForm.items || rfq.items.map(i => ({ description: i.description, unit: i.unit, qty: i.qty, unit_price: 0, total: 0 })))];
                                  newItems[idx] = { ...newItems[idx], unit_price: price, total: price * rfqItem.qty };
                                  setQuoteForm(p => ({...p, items: newItems}));
                                }}
                                className="w-28 text-right border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none"/>
                              <span className="text-xs text-indigo-700 font-semibold w-24 text-right">
                                {fmt(qItem.unit_price * rfqItem.qty)}đ
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex gap-2">
                        <button onClick={() => addQuote(rfq.id)}
                          className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 flex items-center gap-1">
                          <Save size={11}/> Lưu báo giá
                        </button>
                        <button onClick={() => setShowQuoteForm(null)}
                          className="px-3 py-1.5 bg-slate-200 text-slate-600 rounded-lg text-xs font-bold">Huỷ</button>
                      </div>
                    </div>
                  )}

                  {/* Quotes list */}
                  {isExpanded && rfqQuotes.length > 0 && (
                    <div className="border-t border-slate-100">
                      <div className="px-4 py-2 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                        Báo giá nhận được ({rfqQuotes.length}/3)
                      </div>
                      {rfqQuotes.map(quote => (
                        <div key={quote.id} className={`flex items-center gap-3 px-4 py-3 border-b border-slate-100 hover:bg-slate-50 ${quote.status === 'selected' ? 'bg-emerald-50' : ''}`}>
                          <div className="flex-1">
                            <p className="font-semibold text-slate-800 text-xs">{quote.supplier_name}</p>
                            <p className="text-[10px] text-slate-400">Nhận: {quote.received_at} · Hiệu lực: {quote.validity} · Giao hàng: {quote.delivery}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-indigo-700 text-sm">{fmtB(quote.total)}</p>
                            <p className="text-[10px] text-slate-400">VAT {quote.vat_pct}%</p>
                          </div>
                          <div className="flex gap-1.5">
                            {quote.status !== 'selected' ? (
                              <button onClick={() => selectQuote(quote.id)}
                                className="px-2 py-1 bg-emerald-500 text-white rounded-lg text-[10px] font-bold hover:bg-emerald-600">
                                Chọn
                              </button>
                            ) : (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-lg">
                                <CheckCircle2 size={10}/> Đã chọn
                              </span>
                            )}
                            {quote.status === 'selected' && (
                              <button onClick={() => createPO(quote, rfq)}
                                className="px-2 py-1 bg-teal-600 text-white rounded-lg text-[10px] font-bold hover:bg-teal-700 flex items-center gap-1">
                                <ArrowRight size={9}/> Tạo PO
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredRFQs.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <ShoppingCart size={40} className="text-slate-200 mx-auto mb-3"/>
                <p className="text-slate-400 text-sm">Chưa có RFQ. Nhấn "Tạo RFQ" để bắt đầu.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* VIEW: PURCHASE ORDERS                                                 */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {view === 'po' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                placeholder="Tìm PO..."
                className="pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white w-40 focus:outline-none focus:ring-2 focus:ring-teal-200"/>
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700">
              <option value="all">Tất cả trạng thái</option>
              {Object.entries(PO_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            {filteredPOs.map(po => (
              <div key={po.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 cursor-pointer"
                  onClick={() => setSelectedPO(selectedPO?.id === po.id ? null : po)}>
                  <div className="flex items-center gap-3">
                    <Package size={16} className="text-teal-600 shrink-0"/>
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{po.po_no} — {po.supplier_name}</p>
                      <p className="text-[10px] text-slate-400">
                        Tạo: {po.created_at} · Giao: {po.delivery_date}
                        {po.total >= gdThreshold && <span className="ml-1.5 text-orange-600 font-bold">⚠️ Vượt ngưỡng GĐ</span>}
                        {po.mat_voucher_created && <span className="ml-1.5 text-emerald-600 font-bold">✅ PN tự động</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-indigo-700">{fmtB(po.total)}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PO_STATUS[po.status].cls}`}>
                      {PO_STATUS[po.status].label}
                    </span>
                    {/* Approve actions */}
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      {(po.status === 'pending_pm' || po.status === 'pending_gd') && (
                        <>
                          <button onClick={() => approvePO(po.id, po.status === 'pending_gd')}
                            className="flex items-center gap-1 px-2 py-1 bg-emerald-500 text-white rounded-lg text-[10px] font-bold hover:bg-emerald-600">
                            <CheckCircle2 size={9}/> Duyệt
                          </button>
                          <button onClick={() => rejectPO(po.id)}
                            className="flex items-center gap-1 px-2 py-1 bg-red-500 text-white rounded-lg text-[10px] font-bold hover:bg-red-600">
                            <X size={9}/> Từ chối
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* PO Detail */}
                {selectedPO?.id === po.id && (
                  <div className="border-t border-slate-100 px-4 py-3">
                    <table className="w-full text-xs mb-3">
                      <thead className="bg-slate-50">
                        <tr>
                          {['Hàng hoá/DV', 'ĐVT', 'SL', 'Đơn giá', 'Thành tiền'].map((h, i) => (
                            <th key={i} className="px-2 py-1.5 text-left text-[10px] font-bold text-slate-500">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {po.items.map((item, i) => (
                          <tr key={i} className="border-b border-slate-100">
                            <td className="px-2 py-1.5">{item.description}</td>
                            <td className="px-2 py-1.5 text-slate-500">{item.unit}</td>
                            <td className="px-2 py-1.5 text-right">{fmt(item.qty)}</td>
                            <td className="px-2 py-1.5 text-right">{fmt(item.unit_price)}</td>
                            <td className="px-2 py-1.5 text-right font-semibold">{fmt(item.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t-2 border-slate-200">
                        <tr>
                          <td colSpan={4} className="px-2 py-1.5 font-bold text-right">Tạm tính:</td>
                          <td className="px-2 py-1.5 text-right font-bold">{fmt(po.subtotal)}</td>
                        </tr>
                        <tr>
                          <td colSpan={4} className="px-2 py-1.5 text-right text-slate-500">VAT {po.vat_pct}%:</td>
                          <td className="px-2 py-1.5 text-right text-slate-500">{fmt(po.total - po.subtotal)}</td>
                        </tr>
                        <tr>
                          <td colSpan={4} className="px-2 py-1.5 font-bold text-right text-indigo-700">TỔNG CỘNG:</td>
                          <td className="px-2 py-1.5 text-right font-bold text-indigo-700 text-sm">{fmtB(po.total)}</td>
                        </tr>
                      </tfoot>
                    </table>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                      <div><span className="font-semibold">Điều khoản TT:</span> {po.payment_terms}</div>
                      <div><span className="font-semibold">PM duyệt:</span> {po.approved_by_pm || '—'}</div>
                      <div><span className="font-semibold">GĐ duyệt:</span> {po.approved_by_gd || (po.total >= gdThreshold ? '⏳ Chờ' : 'Không cần')}</div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {filteredPOs.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <Package size={40} className="text-slate-200 mx-auto mb-3"/>
                <p className="text-slate-400 text-sm">Chưa có PO. Tạo từ báo giá được chọn trong tab RFQ.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* VIEW: SUPPLIERS                                                        */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {view === 'suppliers' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                placeholder="Tìm nhà cung cấp..."
                className="pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white w-44 focus:outline-none focus:ring-2 focus:ring-teal-200"/>
            </div>
            <span className="text-xs text-slate-400">{suppliers.length} nhà cung cấp</span>
            <button onClick={() => setShowSupplierForm(true)}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-bold hover:bg-teal-700">
              <Plus size={12}/> Thêm NCC
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {suppliers
              .filter(s => !searchQ || s.name.toLowerCase().includes(searchQ.toLowerCase()))
              .map(sup => (
                <div key={sup.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{sup.name}</p>
                      <p className="text-[10px] text-slate-400">MST: {sup.tax_code || '—'}</p>
                    </div>
                    <div className="text-amber-400 text-sm">
                      {'★'.repeat(sup.rating)}{'☆'.repeat(5 - sup.rating)}
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-slate-600">
                    {sup.phone && <p>📞 {sup.phone}</p>}
                    {sup.email && <p>📧 {sup.email}</p>}
                    {sup.address && <p>📍 {sup.address}</p>}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {sup.category.map(c => (
                      <span key={c} className="text-[9px] bg-teal-50 text-teal-700 font-semibold px-1.5 py-0.5 rounded">
                        {PROCUREMENT_CAT[c]?.icon} {PROCUREMENT_CAT[c]?.label}
                      </span>
                    ))}
                  </div>
                  {sup.notes && <p className="text-[10px] text-slate-400 mt-2 italic">{sup.notes}</p>}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── MODALS — DESIGN_SYSTEM: always at end of component ── */}

      {/* ── MODALS — end of component per DESIGN_SYSTEM ── */}

      {/* RFQ Create Form */}
      <ModalForm open={showRFQForm} onClose={() => setShowRFQForm(false)}
        title="Yêu cầu Mua sắm (RFQ)"
        subtitle="Tạo RFQ — gửi nhà cung cấp báo giá"
        icon={<ShoppingCart size={18}/>} color="teal" width="lg"
        footer={<><BtnCancel onClick={() => setShowRFQForm(false)}/><BtnSubmit label="Lưu RFQ" color="blue" onClick={createRFQ}/></>}
      >
        <FormSection title="Thông tin chung">
          <FormGrid cols={2}>
            <FormRow label="Người yêu cầu" required><input className={inputCls} placeholder="Họ tên người lập RFQ" /></FormRow>
            <FormRow label="Mức độ khẩn cấp"><select className={selectCls}><option>Bình thường</option><option>Khẩn cấp</option><option>Rất khẩn</option></select></FormRow>
          </FormGrid>
        </FormSection>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <input placeholder="Tiêu đề RFQ *" value={rfqForm.title || ''} onChange={e => setRfqForm(p => ({...p, title: e.target.value}))}
              className="col-span-2 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-200"/>
            <select value={rfqForm.category} onChange={e => setRfqForm(p => ({...p, category: e.target.value as ProcurementCat}))}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white">
              {Object.entries(PROCUREMENT_CAT).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
            </select>
            <input type="date" value={rfqForm.deadline || ''} onChange={e => setRfqForm(p => ({...p, deadline: e.target.value}))}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"/>
          </div>

          {/* Items */}
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-teal-700 uppercase tracking-wide">Hạng mục cần mua</p>
            {rfqForm.items?.map((item, idx) => (
              <div key={idx} className="flex gap-2">
                <input placeholder="Tên hàng hoá/dịch vụ *" value={item.description}
                  onChange={e => setRfqForm(p => ({ ...p, items: p.items!.map((it, i) => i === idx ? {...it, description: e.target.value} : it) }))}
                  className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"/>
                <input placeholder="ĐVT" value={item.unit}
                  onChange={e => setRfqForm(p => ({ ...p, items: p.items!.map((it, i) => i === idx ? {...it, unit: e.target.value} : it) }))}
                  className="w-16 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"/>
                <input type="number" placeholder="SL" value={item.qty || ''}
                  onChange={e => setRfqForm(p => ({ ...p, items: p.items!.map((it, i) => i === idx ? {...it, qty: +e.target.value} : it) }))}
                  className="w-16 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"/>
                <button onClick={() => setRfqForm(p => ({ ...p, items: p.items!.filter((_, i) => i !== idx) }))}
                  className="p-1.5 hover:bg-red-100 rounded text-red-500"><X size={12}/></button>
              </div>
            ))}
            <button onClick={() => setRfqForm(p => ({ ...p, items: [...(p.items || []), { description: '', unit: '', qty: 0 }] }))}
              className="text-xs text-teal-600 hover:underline flex items-center gap-1">
              <Plus size={11}/> Thêm hạng mục
            </button>
          </div>

          <input placeholder="Ghi chú" value={rfqForm.notes || ''} onChange={e => setRfqForm(p => ({...p, notes: e.target.value}))}
            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"/>

      </ModalForm>

      {/* Add supplier form */}
      <ModalForm open={showSupplierForm} onClose={() => setShowSupplierForm(false)}
        title="Thêm Nhà cung cấp"
        subtitle="Đăng ký NCC mới vào danh sách"
        icon={<Building2 size={18}/>} color="teal" width="md"
        footer={<><BtnCancel onClick={() => setShowSupplierForm(false)}/><BtnSubmit label="Lưu NCC" color="blue" onClick={addSupplier}/></>}
      >
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <input placeholder="Tên công ty *" value={supplierForm.name || ''} onChange={e => setSupplierForm(p => ({...p, name: e.target.value}))}
              className="col-span-2 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"/>
            <input placeholder="Mã số thuế" value={supplierForm.tax_code || ''} onChange={e => setSupplierForm(p => ({...p, tax_code: e.target.value}))}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"/>
            <input placeholder="Điện thoại" value={supplierForm.phone || ''} onChange={e => setSupplierForm(p => ({...p, phone: e.target.value}))}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"/>
            <input placeholder="Email" value={supplierForm.email || ''} onChange={e => setSupplierForm(p => ({...p, email: e.target.value}))}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"/>
            <input placeholder="Địa chỉ" value={supplierForm.address || ''} onChange={e => setSupplierForm(p => ({...p, address: e.target.value}))}
              className="col-span-2 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"/>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Đánh giá:</span>
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setSupplierForm(p => ({...p, rating: n}))}
                  className={`text-lg ${n <= (supplierForm.rating || 3) ? 'text-amber-400' : 'text-slate-200'}`}>★</button>
              ))}
            </div>
          </div>
      </ModalForm>

    </div>

  );
}
