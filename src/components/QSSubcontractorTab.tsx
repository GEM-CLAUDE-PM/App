// QSSubcontractorTab.tsx — GEM&CLAUDE PM Pro
// Subcontractor management tab — tách từ QSDashboard.tsx

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNotification } from './NotificationEngine';
import ModalForm, { FormRow, FormGrid, inputCls, selectCls, BtnCancel, BtnSubmit } from './ModalForm';
import { db } from "./db";
import {
  BarChart2, TrendingUp, TrendingDown, FileText, Plus, X,
  ChevronDown, ChevronRight, ChevronUp, Edit3, Trash2, Save, Eye, Activity,
  DollarSign, Building2, Hash, Calculator, Clock, Check,
  CheckCircle2, AlertTriangle, AlertCircle, Search, Filter,
  Download, Send, Info, ArrowUpRight, ArrowDownRight, Minus,
  Calendar, User, Printer, Sparkles, Loader2, RefreshCw
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import {
  type BOQItem, type AcceptanceLot, type PaymentRequest,
  type SubContractor, type SubPayment, type SubType,
  type PayMechanism, type SubPayStatus,
  INIT_SUBS, INIT_SUB_PAYMENTS,
  SUB_TYPE_CFG, MECH_CFG, SUB_PAY_STATUS,
  CHAPTERS, CHAPTER_NAMES, calcBOQValue, calcDoneValue,
  fmt, fmtB, pct
} from "./QSTypes";
import { seedApprovalDocs } from "./approvalEngine";
import type { SeedVoucherInput } from "./approvalEngine";

// ── Local KpiCard (mirror of QSDashboard) ────────────────────────────────────
const KpiCard = ({ label, value, sub, icon, color = "emerald", trend }: {
  label: string; value: string; sub: string; icon: React.ReactNode;
  color?: string; trend?: "up"|"down"|"flat"; key?: string;
}) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-3">
    <div className="flex items-center justify-between">
      <div className={`p-2.5 rounded-xl bg-${color}-50 text-${color}-600`}>{icon}</div>
      {trend && (
        <span className={`flex items-center gap-0.5 text-xs font-bold ${trend==="up"?"text-emerald-600":trend==="down"?"text-rose-500":"text-slate-400"}`}>
          {trend==="up"?<ArrowUpRight size={14}/>:trend==="down"?<ArrowDownRight size={14}/>:<Minus size={14}/>}
        </span>
      )}
    </div>
    <div>
      <div className="text-2xl font-bold text-slate-800 leading-tight">{value}</div>
      <div className="text-xs font-semibold text-slate-500 mt-0.5">{label}</div>
      <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>
    </div>
  </div>
);

const ProgressBar = ({ value, max, color = "emerald", showLabel = true }: {
  value: number; max: number; color?: string; showLabel?: boolean;
}) => {
  const p = pct(value, max);
  const warn = p > 100;
  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between text-[10px] font-bold mb-1">
          <span className={warn ? "text-rose-600" : "text-slate-500"}>{p}%</span>
          {warn && <span className="text-rose-500 flex items-center gap-0.5"><AlertTriangle size={9}/>Vượt KL</span>}
        </div>
      )}
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${warn ? "bg-rose-500" : p >= 90 ? `bg-${color}-500` : p >= 50 ? `bg-${color}-400` : `bg-${color}-300`}`}
          style={{ width: `${Math.min(p, 100)}%` }}
        />
      </div>
    </div>
  );
};

interface SubcontractorTabProps {
  projectId: string;
  boqItems: BOQItem[];
  acceptanceLots: AcceptanceLot[];
  payments: PaymentRequest[];
}

export default function SubcontractorTab({ projectId, boqItems, acceptanceLots, payments }: SubcontractorTabProps) {
  const { err: notifErr, info: notifInfo } = useNotification();
  const [subs, setSubs]                   = useState<SubContractor[]>(INIT_SUBS);
  const [subPayments, setSubPayments]     = useState<SubPayment[]>(INIT_SUB_PAYMENTS);
  const [dbLoaded, setDbLoaded]           = useState(false);
  const [subTab, setSubTab]               = useState<"overview"|"contracts"|"payments">("overview");
  const [selectedSubId, setSelectedSubId] = useState<string|null>(null);
  const [subTypeFilter, setSubTypeFilter] = useState<SubType|"all">("all");
  const [subSearch, setSubSearch]         = useState("");
  const [paySearch, setPaySearch]         = useState("");
  const [payStatusFilter, setPayStatusFilter] = useState<string>("all");
  const [showNewSubPay, setShowNewSubPay] = useState(false);
  const [showNewSub, setShowNewSub]       = useState(false);
  const [newSubPayMech, setNewSubPayMech] = useState<PayMechanism>("progress");
  const [newSubPaySubId, setNewSubPaySubId]   = useState("");
  const [newSubPayPct, setNewSubPayPct]       = useState(0);
  const [newSubPayNote, setNewSubPayNote]     = useState("");
  const [newSubPayPeriod, setNewSubPayPeriod] = useState("");
  const [newSubPayManrows, setNewSubPayManrows] = useState([{description:"",qty:0,unit:"Công",unit_price:0}]);
  const [newSubPayUnitrows, setNewSubPayUnitrows] = useState([{boq_ref:"",qty:0,unit:"m³",unit_price:0}]);
  const [newSubPayLumpItems, setNewSubPayLumpItems] = useState([{name:"",value:0}]);
  const [newSubPayAdvance, setNewSubPayAdvance] = useState(0);
  const [newSub, setNewSub] = useState<Partial<SubContractor>>({type:"subcontractor",pay_mechanism:"progress",retention_pct:5});

  // AI chat
  const [aiPrompt, setAiPrompt]         = useState("");
  const [expandedSubPayId, setExpandedSubPayId] = useState<string|null>(null);
  const [aiResponse, setAiResponse]     = useState("");
  const [isAiLoading, setIsAiLoading]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── db.ts: load khi mount ────────────────────────────────────────────────
  // ── Liên thông MaterialsDashboard: vật tư từ nhà cung cấp ─────────────────
  const [matSupplierSummary, setMatSupplierSummary] = useState<string>('');

  useEffect(() => {
    (async () => {
      const [s, sp, matVouchers] = await Promise.all([
        db.get<typeof subs>('qs_subs',         projectId, []),
        db.get<typeof subPayments>('qs_sub_payments', projectId, []),
        db.get('mat_vouchers',    projectId, []),
      ]);
      if (s.length)  setSubs(s);
      if (sp.length) setSubPayments(sp);
      setDbLoaded(true);

      // Tổng hợp vật tư nhập kho đã duyệt từ MaterialsDashboard
      const mv = matVouchers as any[];
      const pnApproved = mv.filter((v: any) => v.type === 'PN' && v.status === 'approved');
      const totalMatValue = pnApproved.reduce((s: number, v: any) => s + (v.totalValue || 0), 0);
      if (pnApproved.length) {
        setMatSupplierSummary(
          `Vật tư nhập kho (đã duyệt): ${pnApproved.length} phiếu, tổng ${(totalMatValue/1e9).toFixed(2)} tỷ`
        );
      }
    })();
  }, [projectId]);

  // ── Seed approvalEngine từ Acceptance + Payment (VO seed nằm trong VariationOrdersTab) ──
  useEffect(() => {
    if (!projectId) return;
    const seeds: SeedVoucherInput[] = [
      ...acceptanceLots.map(l => ({
        voucherId: l.id, voucherCode: l.lot_no,
        docType: 'ACCEPTANCE' as any,
        title: `BBNT — ${l.lot_no} (${l.date})`,
        amount: l.total_value,
        voucherData: l,
        legacyStatus: (l.status === 'approved' ? 'approved'
          : l.status === 'submitted' ? 'pending' : 'draft') as any,
      })),
      ...payments.map(p => ({
        voucherId: p.id, voucherCode: p.request_no,
        docType: 'PAYMENT_REQUEST' as any,
        title: `Yêu cầu TT — ${p.request_no} (${p.period})`,
        amount: p.net_payable,
        voucherData: p,
        legacyStatus: (p.status === 'approved' || p.status === 'paid'
          ? 'approved' : p.status === 'submitted' ? 'pending' : 'draft') as any,
      })),
    ];
    seedApprovalDocs(projectId, seeds);
  }, [projectId, acceptanceLots.length, payments.length]);

  // ── db.ts: lưu khi data thay đổi ────────────────────────────────────────

  useEffect(() => { if (dbLoaded) db.set('qs_subs',         projectId, subs);        }, [subs]);
  useEffect(() => { if (dbLoaded) db.set('qs_sub_payments', projectId, subPayments); }, [subPayments]);

  // ── Computed ───────────────────────────────────────────────────────────────
  const nonChapter = useMemo(() => boqItems.filter(i => !i.isChapter), [boqItems]);

  const totalContract  = useMemo(() => nonChapter.reduce((s,i) => s + calcBOQValue(i), 0), [nonChapter]);
  const totalDone      = useMemo(() => nonChapter.reduce((s,i) => s + calcDoneValue(i), 0), [nonChapter]);
  const totalPlan      = useMemo(() => nonChapter.reduce((s,i) => s + i.qty_plan_current * i.unit_price, 0), [nonChapter]);

  // Enrich acceptance lot totals
  const enrichedLots = useMemo(() => acceptanceLots.map(lot => {
    const total = lot.items.reduce((s, li) => {
      const item = nonChapter.find(i => i.id === li.boq_id);
      return s + (item ? li.qty * item.unit_price : 0);
    }, 0);
    return { ...lot, total_value: total };
  }), [acceptanceLots, nonChapter]);

  // Enrich payment totals
  const enrichedPayments = useMemo(() => payments.map(pay => {
    const subtotal = pay.lot_ids.reduce((s, lid) => {
      const lot = enrichedLots.find(l => l.id === lid);
      return s + (lot?.total_value || 0);
    }, 0);
    const vat = subtotal * 0.08;
    const total = subtotal + vat;
    const net_payable = total - pay.advance_deduct;
    return { ...pay, subtotal, vat, total, net_payable };
  }), [payments, enrichedLots]);

  const totalPaid = useMemo(() =>
    enrichedPayments.filter(p => p.status === "paid").reduce((s,p) => s + p.net_payable, 0),
  [enrichedPayments]);
  const totalApproved = useMemo(() =>
    enrichedPayments.filter(p => ["approved","paid"].includes(p.status)).reduce((s,p) => s + p.net_payable, 0),
  [enrichedPayments]);

  // Chapter summaries for overview
  const chapterStats = useMemo(() => CHAPTERS.map(ch => {
    const items = nonChapter.filter(i => i.chapter === ch);
    const contract = items.reduce((s,i) => s + calcBOQValue(i), 0);
    const done     = items.reduce((s,i) => s + calcDoneValue(i), 0);
    const plan     = items.reduce((s,i) => s + i.qty_plan_current * i.unit_price, 0);
    return { ch, name: CHAPTER_NAMES[ch], contract, done, plan, pctDone: pct(done, contract), pctPlan: pct(plan, contract) };
  }), [nonChapter]);

  // enrichedSubs: subs với computed payment stats
  const enrichedSubs = useMemo(() => subs.map(sub => {
    const pays = subPayments.filter(p => p.sub_id === sub.id);
    const totalPaidSub   = pays.filter(p => p.status === 'paid').reduce((s,p) => s + p.net_payable, 0);
    const totalApprovedS = pays.filter(p => ['paid','approved'].includes(p.status)).reduce((s,p) => s + p.net_payable, 0);
    const totalRetention = pays.filter(p => ['paid','approved'].includes(p.status)).reduce((s,p) => s + p.retention_amt, 0);
    const pctPaidSub     = pct(totalPaidSub, sub.contract_value);
    const remaining      = sub.contract_value - totalApprovedS;
    const isOverBudget   = totalApprovedS > sub.contract_value * 1.001;
    return { ...sub, totalPaid: totalPaidSub, totalApproved: totalApprovedS, totalRetention, pctPaid: pctPaidSub, remaining, isOverBudget, pays };
  }), [subs, subPayments]);

  // subStats: aggregate stats
  const subStats = useMemo(() => ({
    totalContractValue: enrichedSubs.reduce((s,x) => s + x.contract_value, 0),
    totalPaid:          enrichedSubs.reduce((s,x) => s + x.totalPaid, 0),
    totalRetention:     enrichedSubs.reduce((s,x) => s + x.totalRetention, 0),
    overBudgetCount:    enrichedSubs.filter(x => x.isOverBudget).length,
    pendingCount:       subPayments.filter(p => p.status === 'submitted').length,
  }), [enrichedSubs, subPayments]);


  // ── Handler: Lưu hợp đồng phụ mới ──────────────────────────────────────────
  const saveNewSub = () => {
    if (!newSub.name || !newSub.code) { notifErr('Vui lòng nhập mã và tên đối tác!'); return; }
    const sub: SubContractor = {
      id: `sub${Date.now()}`,
      code: newSub.code || '',
      name: newSub.name || '',
      type: newSub.type || 'subcontractor',
      scope: newSub.scope || '',
      contract_value: newSub.contract_value || 0,
      contract_no: newSub.contract_no || `HD-${Date.now()}`,
      start_date: newSub.start_date || '',
      end_date: newSub.end_date || '',
      pay_mechanism: newSub.pay_mechanism || 'progress',
      retention_pct: newSub.retention_pct ?? 5,
      advance_paid: newSub.advance_paid || 0,
      contact: newSub.contact || '',
      bank_account: newSub.bank_account,
    };
    setSubs(prev => [...prev, sub]);
    setShowNewSub(false);
    setNewSub({ type: 'subcontractor', pay_mechanism: 'progress', retention_pct: 5 });
  };

  // ── Handler: Lưu phiếu thanh toán NTP mới ───────────────────────────────────
  const saveNewSubPayment = () => {
    const sub = subs.find(s => s.id === newSubPaySubId);
    if (!sub) { notifInfo('Chọn đối tác!'); return; }
    let subtotal = 0;
    if (newSubPayMech === 'progress')  subtotal = sub.contract_value * newSubPayPct / 100;
    if (newSubPayMech === 'lump_sum')  subtotal = newSubPayLumpItems.reduce((s,r) => s + r.value, 0);
    if (newSubPayMech === 'manhour')   subtotal = newSubPayManrows.reduce((s,r) => s + r.qty * r.unit_price, 0);
    if (newSubPayMech === 'unit_rate') subtotal = newSubPayUnitrows.reduce((s,r) => s + r.qty * r.unit_price, 0);
    const retention_amt = subtotal * sub.retention_pct / 100;
    const net_payable = subtotal - retention_amt - newSubPayAdvance;
    const pay: SubPayment = {
      id: `sp${Date.now()}`,
      sub_id: newSubPaySubId,
      pay_no: `TT-${sub.code}-${String(subPayments.filter(p => p.sub_id === newSubPaySubId).length + 1).padStart(2,'0')}`,
      date: new Date().toLocaleDateString('vi-VN'),
      period: newSubPayPeriod,
      mechanism: newSubPayMech,
      lump_items: newSubPayMech === 'lump_sum' ? newSubPayLumpItems : undefined,
      progress_pct: newSubPayMech === 'progress' ? newSubPayPct : undefined,
      manhour_rows: newSubPayMech === 'manhour' ? newSubPayManrows : undefined,
      unit_rows: newSubPayMech === 'unit_rate' ? newSubPayUnitrows : undefined,
      subtotal, retention_amt,
      advance_deduct: newSubPayAdvance,
      net_payable,
      status: 'draft',
      note: newSubPayNote,
    };
    setSubPayments(prev => [...prev, pay]);
    setShowNewSubPay(false);
    setNewSubPaySubId('');
    setNewSubPayPct(0);
    setNewSubPayNote('');
    setNewSubPayPeriod('');
    setNewSubPayAdvance(0);
    setNewSubPayLumpItems([{name:'',value:0}]);
    setNewSubPayManrows([{description:'',qty:0,unit:'Công',unit_price:0}]);
    setNewSubPayUnitrows([{boq_ref:'',qty:0,unit:'m³',unit_price:0}]);
  };

  // Alerts: items with >10% variance or >100% done

  return (

        <div className="space-y-5 animate-in fade-in duration-300">

          {/* Sub-tab bar */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-1.5 flex gap-1">
            {([
              {id:"overview",  label:"Tổng quan & Đối chiếu", icon:<BarChart2 size={13}/>},
              {id:"contracts", label:"Danh sách HĐ phụ",      icon:<FileText size={13}/>},
              {id:"payments",  label:"Lịch sử thanh toán",    icon:<DollarSign size={13}/>},
            ] as const).map(st=>(
              <button key={st.id} onClick={()=>setSubTab(st.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${subTab===st.id?"bg-orange-500 text-white shadow-sm":"text-slate-500 hover:bg-slate-50"}`}>
                {st.icon}{st.label}
              </button>
            ))}
          </div>

          {/* ── SUB-TAB: OVERVIEW ── */}
          {subTab==="overview" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  {label:"Tổng giá trị HĐ phụ", value:fmtB(subStats.totalContractValue), sub:`${subs.length} đối tác`, icon:<Building2 size={18}/>, color:"slate"},
                  {label:"Đã thanh toán NTP", value:fmtB(subStats.totalPaid), sub:`${pct(subStats.totalPaid,subStats.totalContractValue)}% giá trị HĐ`, icon:<Check size={18}/>, color:"emerald"},
                  {label:"Giữ lại bảo hành", value:fmtB(subStats.totalRetention), sub:"Tổng retention đang giữ", icon:<AlertCircle size={18}/>, color:"amber"},
                  {label:"Chờ duyệt thanh toán", value:String(subStats.pendingCount), sub:"phiếu đang chờ", icon:<Clock size={18}/>, color:subStats.pendingCount>0?"orange":"slate"},
                ].map(k=>(
                  <KpiCard key={k.label} label={k.label} value={k.value} sub={k.sub} icon={k.icon} color={k.color}/>
                ))}
              </div>

              {/* Đối chiếu CĐT → NTP */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                  <Activity size={16} className="text-orange-500"/>
                  <h3 className="font-bold text-slate-800">Đối chiếu: CĐT đã TT cho mình vs Mình đã TT cho NTP</h3>
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-5 items-center">
                  <div className="text-center p-4 bg-blue-50 rounded-2xl border border-blue-100">
                    <div className="text-2xl font-bold text-blue-700">{fmtB(totalPaid)}</div>
                    <div className="text-xs text-blue-500 font-semibold mt-1">CĐT đã thanh toán cho mình</div>
                    <div className="text-[10px] text-blue-400 mt-0.5">{pct(totalPaid,totalContract)}% giá trị HĐ chính</div>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="text-xs text-slate-400 font-medium">Tỷ lệ chuyển cho NTP</div>
                    <div className={`text-4xl font-black ${pct(subStats.totalPaid,totalPaid||1)>90?"text-rose-600":pct(subStats.totalPaid,totalPaid||1)>70?"text-amber-600":"text-emerald-600"}`}>
                      {pct(subStats.totalPaid,totalPaid||1)}%
                    </div>
                    <div className="text-[10px] text-slate-400 text-center">đã chuyển cho NTP<br/>trên số đã nhận từ CĐT</div>
                    {pct(subStats.totalPaid,totalPaid||1)>85&&(
                      <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 text-[10px] text-amber-700 font-bold flex items-center gap-1">
                        <AlertTriangle size={10}/>Tỷ lệ cao — kiểm tra dòng tiền
                      </div>
                    )}
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-2xl border border-orange-100">
                    <div className="text-2xl font-bold text-orange-700">{fmtB(subStats.totalPaid)}</div>
                    <div className="text-xs text-orange-500 font-semibold mt-1">Đã thanh toán cho NTP</div>
                    <div className="text-[10px] text-orange-400 mt-0.5">Còn giữ: {fmtB(Math.max(totalPaid-subStats.totalPaid,0))}</div>
                  </div>
                </div>
              </div>

              {/* Per-partner summary table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <h3 className="font-bold text-slate-800 shrink-0">Tình hình thanh toán từng đối tác</h3>
                    <div className="relative flex-1 max-w-xs">
                      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                      <input value={subSearch} onChange={e=>setSubSearch(e.target.value)}
                        placeholder="Tìm đối tác..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-orange-400"/>
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {(["all","subcontractor","team","supplier","consultant"] as const).map(t=>(
                      <button key={t} onClick={()=>setSubTypeFilter(t)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${subTypeFilter===t?"bg-orange-500 text-white":"bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                        {t==="all"?"Tất cả":SUB_TYPE_CFG[t].label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>{["Mã","Tên đối tác","Loại","Cơ chế","Giá trị HĐ","Tạm ứng","Đã TT","Giữ lại BH","Còn lại","% TT","Trạng thái"].map(h=>(
                        <th key={h} className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap text-left">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {enrichedSubs
                        .filter(s => subTypeFilter==="all" || s.type===subTypeFilter)
                        .filter(s => !subSearch || s.name.toLowerCase().includes(subSearch.toLowerCase()) || s.code.toLowerCase().includes(subSearch.toLowerCase()) || s.scope.toLowerCase().includes(subSearch.toLowerCase()))
                        .map(sub=>(
                        <tr key={sub.id} className={`hover:bg-slate-50 transition-colors cursor-pointer ${sub.isOverBudget?"bg-rose-50/40":""}`}
                          onClick={()=>{setSelectedSubId(sub.id);setSubTab("payments");}}>
                          <td className="px-3 py-3 font-mono text-[10px] text-slate-400">{sub.code}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <span>{SUB_TYPE_CFG[sub.type].icon}</span>
                              <div>
                                <p className="font-semibold text-slate-800 text-sm">{sub.name}</p>
                                <p className="text-[10px] text-slate-400 truncate max-w-[180px]">{sub.scope}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold bg-${SUB_TYPE_CFG[sub.type].color}-100 text-${SUB_TYPE_CFG[sub.type].color}-700`}>
                              {SUB_TYPE_CFG[sub.type].label}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-[11px] text-slate-500">{MECH_CFG[sub.pay_mechanism].short}</td>
                          <td className="px-3 py-3 text-right font-semibold text-slate-700 whitespace-nowrap">{fmtB(sub.contract_value)}</td>
                          <td className="px-3 py-3 text-right text-xs text-slate-500 whitespace-nowrap">{fmtB(sub.advance_paid)}</td>
                          <td className="px-3 py-3 text-right font-bold text-emerald-700 whitespace-nowrap">{fmtB(sub.totalPaid)}</td>
                          <td className="px-3 py-3 text-right text-xs text-amber-600 whitespace-nowrap">
                            {sub.retention_pct>0?fmtB(sub.totalRetention):<span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-3 py-3 text-right font-medium text-slate-600 whitespace-nowrap">{fmtB(sub.remaining)}</td>
                          <td className="px-3 py-3 min-w-[100px]"><ProgressBar value={sub.totalPaid} max={sub.contract_value}/></td>
                          <td className="px-3 py-3">
                            {sub.isOverBudget
                              ? <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md whitespace-nowrap"><AlertTriangle size={9}/>Vượt HĐ</span>
                              : <span className={`text-[10px] font-bold whitespace-nowrap ${sub.pctPaid>=80?"text-emerald-600":sub.pctPaid>0?"text-blue-600":"text-slate-400"}`}>
                                  {sub.pctPaid===0?"Chưa TT":sub.pctPaid>=100?"Hoàn thành":"Đang TH"}
                                </span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {enrichedSubs.filter(s=>s.isOverBudget).length>0&&(
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
                  <AlertTriangle size={18} className="text-rose-500 shrink-0 mt-0.5"/>
                  <div>
                    <p className="font-bold text-rose-800 text-sm">Cảnh báo vượt giá trị hợp đồng phụ!</p>
                    {enrichedSubs.filter(s=>s.isOverBudget).map(s=>(
                      <p key={s.id} className="text-xs text-rose-700 mt-1">• {s.name}: đã duyệt {fmtB(s.totalApproved)} / HĐ {fmtB(s.contract_value)} (+{fmtB(s.totalApproved-s.contract_value)})</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── SUB-TAB: CONTRACTS ── */}
          {subTab==="contracts" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-slate-500">{subs.length} đối tác · Tổng HĐ phụ: <span className="font-bold text-slate-800">{fmtB(subStats.totalContractValue)}</span></p>
                <button onClick={()=>setShowNewSub(true)} className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 shadow-sm">
                  <Plus size={14}/>Thêm đối tác / HĐ phụ
                </button>
              </div>

              <ModalForm
                open={showNewSub}
                onClose={() => { setShowNewSub(false); setNewSub({ type: "subcontractor", pay_mechanism: "progress", retention_pct: 5 }); }}
                title="Thêm đối tác / HĐ phụ"
                subtitle="Nhà thầu phụ, tổ đội hoặc nhà cung cấp"
                icon={<Building2 size={18}/>}
                color="orange"
                width="lg"
                footer={<>
                  <BtnCancel onClick={() => { setShowNewSub(false); setNewSub({ type: "subcontractor", pay_mechanism: "progress", retention_pct: 5 }); }}/>
                  <BtnSubmit label="Lưu hợp đồng phụ" onClick={saveNewSub}/>
                </>}
              >
                <FormGrid cols={2}>
                  <FormRow label="Mã *"><input value={newSub.code||""} onChange={e=>setNewSub({...newSub,code:e.target.value})} placeholder="NTP-005" className={inputCls}/></FormRow>
                  <FormRow label="Tên đối tác *"><input value={newSub.name||""} onChange={e=>setNewSub({...newSub,name:e.target.value})} placeholder="Công ty TNHH..." className={inputCls}/></FormRow>
                  <FormRow label="Số HĐ"><input value={newSub.contract_no||""} onChange={e=>setNewSub({...newSub,contract_no:e.target.value})} placeholder="HĐP-2026/05" className={inputCls}/></FormRow>
                  <FormRow label="Liên hệ"><input value={newSub.contact||""} onChange={e=>setNewSub({...newSub,contact:e.target.value})} placeholder="Tên — SĐT" className={inputCls}/></FormRow>
                  <div className="col-span-2">
                    <FormRow label="Phạm vi công việc"><input value={newSub.scope||""} onChange={e=>setNewSub({...newSub,scope:e.target.value})} placeholder="Mô tả công việc theo hợp đồng..." className={inputCls}/></FormRow>
                  </div>
                  <FormRow label="Loại đối tác">
                    <select value={newSub.type} onChange={e=>setNewSub({...newSub,type:e.target.value as SubType})} className={selectCls}>
                      {(Object.keys(SUB_TYPE_CFG) as SubType[]).map(t=><option key={t} value={t}>{SUB_TYPE_CFG[t].label}</option>)}
                    </select>
                  </FormRow>
                  <FormRow label="Cơ chế thanh toán">
                    <select value={newSub.pay_mechanism} onChange={e=>setNewSub({...newSub,pay_mechanism:e.target.value as PayMechanism})} className={selectCls}>
                      {(Object.keys(MECH_CFG) as PayMechanism[]).map(m=><option key={m} value={m}>{MECH_CFG[m].label}</option>)}
                    </select>
                  </FormRow>
                  <FormRow label="Giá trị HĐ (VNĐ)"><input type="number" value={newSub.contract_value||""} onChange={e=>setNewSub({...newSub,contract_value:Number(e.target.value)})} placeholder="0" className={inputCls}/></FormRow>
                  <FormRow label="Giữ lại BH (%)"><input type="number" value={newSub.retention_pct||0} onChange={e=>setNewSub({...newSub,retention_pct:Number(e.target.value)})} placeholder="5" className={inputCls}/></FormRow>
                  <FormRow label="Ngày bắt đầu"><input value={newSub.start_date||""} onChange={e=>setNewSub({...newSub,start_date:e.target.value})} placeholder="DD/MM/YYYY" className={inputCls}/></FormRow>
                  <FormRow label="Ngày kết thúc"><input value={newSub.end_date||""} onChange={e=>setNewSub({...newSub,end_date:e.target.value})} placeholder="DD/MM/YYYY" className={inputCls}/></FormRow>
                  <FormRow label="Tạm ứng ban đầu (VNĐ)"><input type="number" value={newSub.advance_paid||0} onChange={e=>setNewSub({...newSub,advance_paid:Number(e.target.value)})} placeholder="0" className={inputCls}/></FormRow>
                  <FormRow label="Tài khoản ngân hàng"><input value={newSub.bank_account||""} onChange={e=>setNewSub({...newSub,bank_account:e.target.value})} placeholder="VCB - 007..." className={inputCls}/></FormRow>
                </FormGrid>
              </ModalForm>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {enrichedSubs
                        .filter(s=>subTypeFilter==="all"||s.type===subTypeFilter)
                        .filter(s=>!subSearch||s.name.toLowerCase().includes(subSearch.toLowerCase())||s.code.toLowerCase().includes(subSearch.toLowerCase()))
                        .map(sub=>(
                  <div key={sub.id} className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all overflow-hidden ${sub.isOverBudget?"border-rose-300":"border-slate-200"}`}>
                    <div className="p-4 border-b border-slate-100">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`text-xl shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-${SUB_TYPE_CFG[sub.type].color}-50`}>{SUB_TYPE_CFG[sub.type].icon}</div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 text-sm truncate">{sub.name}</p>
                            <p className="text-[10px] text-slate-400 truncate">{sub.scope}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold bg-${SUB_TYPE_CFG[sub.type].color}-100 text-${SUB_TYPE_CFG[sub.type].color}-700`}>{SUB_TYPE_CFG[sub.type].label}</span>
                          {sub.isOverBudget&&<span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-700 flex items-center gap-0.5"><AlertTriangle size={8}/>Vượt HĐ</span>}
                        </div>
                      </div>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                        <div><span className="text-slate-400">HĐ: </span><span className="font-medium text-slate-700">{sub.contract_no}</span></div>
                        <div><span className="text-slate-400">Cơ chế: </span><span className="font-medium text-slate-700">{MECH_CFG[sub.pay_mechanism].label}</span></div>
                        <div><span className="text-slate-400">Từ: </span><span className="font-medium">{sub.start_date}</span></div>
                        <div><span className="text-slate-400">Đến: </span><span className="font-medium">{sub.end_date}</span></div>
                        <div><span className="text-slate-400">Giữ BH: </span><span className="font-bold text-amber-600">{sub.retention_pct}%</span></div>
                        <div className="col-span-2 truncate"><span className="text-slate-400">Liên hệ: </span><span className="font-medium text-slate-600 text-[10px]">{sub.contact}</span></div>
                        {sub.bank_account&&<div className="col-span-2 truncate"><span className="text-slate-400">STK: </span><span className="font-mono text-[10px] text-slate-600">{sub.bank_account}</span></div>}
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1"><span className="font-bold text-slate-700">HĐ: {fmtB(sub.contract_value)}</span><span className="text-emerald-600 font-bold">Đã TT: {fmtB(sub.totalPaid)}</span></div>
                        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden relative">
                          <div className="absolute h-full bg-amber-200 rounded-full" style={{width:`${Math.min(pct(sub.totalApproved,sub.contract_value),100)}%`}}/>
                          <div className="absolute h-full bg-emerald-500 rounded-full" style={{width:`${Math.min(sub.pctPaid,100)}%`}}/>
                        </div>
                        <div className="flex justify-between text-[9px] text-slate-400 mt-1">
                          <span>TT {sub.pctPaid}%</span>
                          {sub.retention_pct>0&&<span className="text-amber-500">BH: {fmtB(sub.totalRetention)}</span>}
                          <span>Còn: {fmtB(sub.remaining)}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button onClick={()=>{setSelectedSubId(sub.id);setSubTab("payments");}} className="flex-1 py-1.5 bg-orange-50 text-orange-600 border border-orange-100 rounded-xl text-xs font-bold hover:bg-orange-100">
                          Lịch sử ({sub.pays.length})
                        </button>
                        <button onClick={()=>{setNewSubPaySubId(sub.id);setNewSubPayMech(sub.pay_mechanism);setShowNewSubPay(true);setSubTab("payments");}} className="flex-1 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl text-xs font-bold hover:bg-emerald-100">
                          + Lập phiếu TT
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SUB-TAB: PAYMENTS ── */}
          {subTab==="payments" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex gap-1.5 flex-wrap">
                  <button onClick={()=>setSelectedSubId(null)} className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${!selectedSubId?"bg-orange-500 text-white":"bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>Tất cả</button>
                  {subs.map(s=>(
                    <button key={s.id} onClick={()=>setSelectedSubId(s.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${selectedSubId===s.id?"bg-orange-500 text-white":"bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                      {s.code}
                    </button>
                  ))}
                </div>
                <button onClick={()=>setShowNewSubPay(true)} className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 shadow-sm shrink-0">
                  <Plus size={14}/>Lập phiếu thanh toán
                </button>
              </div>

              <ModalForm
                open={showNewSubPay}
                onClose={() => setShowNewSubPay(false)}
                title="Lập phiếu thanh toán NTP / Tổ đội"
                subtitle="Tạo phiếu thanh toán theo cơ chế hợp đồng"
                icon={<DollarSign size={18}/>}
                color="orange"
                width="xl"
                footer={<>
                  <BtnCancel onClick={() => setShowNewSubPay(false)}/>
                  <BtnSubmit label="Lưu phiếu thanh toán" onClick={saveNewSubPay}/>
                </>}
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Đối tác *</label>
                      <select value={newSubPaySubId} onChange={e=>{const s=subs.find(x=>x.id===e.target.value);setNewSubPaySubId(e.target.value);if(s)setNewSubPayMech(s.pay_mechanism);}}
                        className={selectCls}>
                        <option value="">— Chọn đối tác —</option>
                        {subs.map(s=><option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Cơ chế thanh toán</label>
                      <select value={newSubPayMech} onChange={e=>setNewSubPayMech(e.target.value as PayMechanism)}
                        className={selectCls}>
                        {(Object.keys(MECH_CFG) as PayMechanism[]).map(m=><option key={m} value={m}>{MECH_CFG[m].label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Kỳ / Mô tả đợt</label>
                      <input value={newSubPayPeriod} onChange={e=>setNewSubPayPeriod(e.target.value)} placeholder="VD: Tháng 03/2026 — Đợt 3"
                        className={inputCls}/>
                    </div>
                  </div>

                  {newSubPayMech==="progress"&&(
                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                      <label className="block text-xs font-bold text-slate-600 mb-3">% Tiến độ nghiệm thu kỳ này</label>
                      <div className="flex items-center gap-4">
                        <input type="range" min={0} max={100} value={newSubPayPct} onChange={e=>setNewSubPayPct(Number(e.target.value))} className="flex-1 accent-orange-500"/>
                        <div className="text-3xl font-black text-orange-600 w-20 text-center">{newSubPayPct}%</div>
                      </div>
                      {newSubPaySubId&&<p className="text-xs text-blue-700 mt-2 font-medium">Giá trị: <span className="font-black">{fmtB((subs.find(s=>s.id===newSubPaySubId)?.contract_value||0)*newSubPayPct/100)}</span></p>}
                    </div>
                  )}

                  {newSubPayMech==="lump_sum"&&(
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-slate-600">Hạng mục khoán gọn</label>
                        <button onClick={()=>setNewSubPayLumpItems(p=>[...p,{name:"",value:0}])} className="text-[10px] text-orange-600 font-bold flex items-center gap-0.5 hover:underline"><Plus size={10}/>Thêm</button>
                      </div>
                      {newSubPayLumpItems.map((r,i)=>(
                        <div key={i} className="flex gap-2">
                          <input value={r.name} onChange={e=>setNewSubPayLumpItems(p=>p.map((x,j)=>j===i?{...x,name:e.target.value}:x))} placeholder="Tên hạng mục..." className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400"/>
                          <input type="number" value={r.value||""} onChange={e=>setNewSubPayLumpItems(p=>p.map((x,j)=>j===i?{...x,value:Number(e.target.value)}:x))} placeholder="Giá trị VNĐ" className="w-36 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400"/>
                          <button onClick={()=>setNewSubPayLumpItems(p=>p.filter((_,j)=>j!==i))} className="p-2 text-rose-400 hover:text-rose-600"><X size={14}/></button>
                        </div>
                      ))}
                      <div className="text-right text-sm font-bold text-orange-700">Tổng: {fmtB(newSubPayLumpItems.reduce((s,r)=>s+r.value,0))}</div>
                    </div>
                  )}

                  {newSubPayMech==="manhour"&&(
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-slate-600">Ngày công / Giờ máy</label>
                        <button onClick={()=>setNewSubPayManrows(p=>[...p,{description:"",qty:0,unit:"Công",unit_price:0}])} className="text-[10px] text-orange-600 font-bold flex items-center gap-0.5 hover:underline"><Plus size={10}/>Thêm</button>
                      </div>
                      <div className="overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-50"><tr>{["Mô tả","SL","ĐV","Đơn giá","Thành tiền",""].map(h=><th key={h} className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase text-left">{h}</th>)}</tr></thead>
                          <tbody>{newSubPayManrows.map((r,i)=>(
                            <tr key={i} className="border-t border-slate-100">
                              <td className="px-2 py-1.5"><input value={r.description} onChange={e=>setNewSubPayManrows(p=>p.map((x,j)=>j===i?{...x,description:e.target.value}:x))} placeholder="Thợ nề bậc 4..." className="w-full border border-slate-100 rounded-lg px-2 py-1 text-xs focus:outline-none"/></td>
                              <td className="px-2 py-1.5"><input type="number" value={r.qty||""} onChange={e=>setNewSubPayManrows(p=>p.map((x,j)=>j===i?{...x,qty:Number(e.target.value)}:x))} className="w-14 border border-slate-100 rounded-lg px-2 py-1 text-xs text-right focus:outline-none"/></td>
                              <td className="px-2 py-1.5"><input value={r.unit} onChange={e=>setNewSubPayManrows(p=>p.map((x,j)=>j===i?{...x,unit:e.target.value}:x))} className="w-14 border border-slate-100 rounded-lg px-2 py-1 text-xs focus:outline-none"/></td>
                              <td className="px-2 py-1.5"><input type="number" value={r.unit_price||""} onChange={e=>setNewSubPayManrows(p=>p.map((x,j)=>j===i?{...x,unit_price:Number(e.target.value)}:x))} className="w-24 border border-slate-100 rounded-lg px-2 py-1 text-xs text-right focus:outline-none"/></td>
                              <td className="px-2 py-1.5 text-right font-semibold text-emerald-700 whitespace-nowrap">{fmtB(r.qty*r.unit_price)}</td>
                              <td className="px-2 py-1.5"><button onClick={()=>setNewSubPayManrows(p=>p.filter((_,j)=>j!==i))} className="text-rose-400 hover:text-rose-600"><X size={12}/></button></td>
                            </tr>
                          ))}</tbody>
                          <tfoot><tr className="bg-slate-50 border-t border-slate-100"><td colSpan={4} className="px-3 py-2 font-bold text-xs text-right text-slate-600">CỘNG</td><td className="px-3 py-2 font-bold text-emerald-700 text-right text-xs whitespace-nowrap">{fmtB(newSubPayManrows.reduce((s,r)=>s+r.qty*r.unit_price,0))}</td><td/></tr></tfoot>
                        </table>
                      </div>
                    </div>
                  )}

                  {newSubPayMech==="unit_rate"&&(
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-slate-600">KL thực tế × Đơn giá khoán</label>
                        <button onClick={()=>setNewSubPayUnitrows(p=>[...p,{boq_ref:"",qty:0,unit:"m³",unit_price:0}])} className="text-[10px] text-orange-600 font-bold flex items-center gap-0.5 hover:underline"><Plus size={10}/>Thêm</button>
                      </div>
                      <div className="overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-50"><tr>{["Ref BOQ / Mô tả","KL","ĐV","Đơn giá khoán","Thành tiền",""].map(h=><th key={h} className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase text-left">{h}</th>)}</tr></thead>
                          <tbody>{newSubPayUnitrows.map((r,i)=>(
                            <tr key={i} className="border-t border-slate-100">
                              <td className="px-2 py-1.5"><input value={r.boq_ref} onChange={e=>setNewSubPayUnitrows(p=>p.map((x,j)=>j===i?{...x,boq_ref:e.target.value}:x))} placeholder="C2.1 / Mô tả..." className="w-full border border-slate-100 rounded-lg px-2 py-1 text-xs focus:outline-none"/></td>
                              <td className="px-2 py-1.5"><input type="number" value={r.qty||""} onChange={e=>setNewSubPayUnitrows(p=>p.map((x,j)=>j===i?{...x,qty:Number(e.target.value)}:x))} className="w-14 border border-slate-100 rounded-lg px-2 py-1 text-xs text-right focus:outline-none"/></td>
                              <td className="px-2 py-1.5"><input value={r.unit} onChange={e=>setNewSubPayUnitrows(p=>p.map((x,j)=>j===i?{...x,unit:e.target.value}:x))} className="w-12 border border-slate-100 rounded-lg px-2 py-1 text-xs focus:outline-none"/></td>
                              <td className="px-2 py-1.5"><input type="number" value={r.unit_price||""} onChange={e=>setNewSubPayUnitrows(p=>p.map((x,j)=>j===i?{...x,unit_price:Number(e.target.value)}:x))} className="w-24 border border-slate-100 rounded-lg px-2 py-1 text-xs text-right focus:outline-none"/></td>
                              <td className="px-2 py-1.5 text-right font-semibold text-emerald-700 whitespace-nowrap">{fmtB(r.qty*r.unit_price)}</td>
                              <td className="px-2 py-1.5"><button onClick={()=>setNewSubPayUnitrows(p=>p.filter((_,j)=>j!==i))} className="text-rose-400 hover:text-rose-600"><X size={12}/></button></td>
                            </tr>
                          ))}</tbody>
                          <tfoot><tr className="bg-slate-50 border-t border-slate-100"><td colSpan={4} className="px-3 py-2 font-bold text-xs text-right text-slate-600">CỘNG</td><td className="px-3 py-2 font-bold text-emerald-700 text-right text-xs whitespace-nowrap">{fmtB(newSubPayUnitrows.reduce((s,r)=>s+r.qty*r.unit_price,0))}</td><td/></tr></tfoot>
                        </table>
                      </div>
                    </div>
                  )}

                  {newSubPaySubId&&(()=>{
                    const sub=subs.find(s=>s.id===newSubPaySubId)!;
                    let subtotal=0;
                    if(newSubPayMech==="progress")  subtotal=sub.contract_value*newSubPayPct/100;
                    if(newSubPayMech==="lump_sum")  subtotal=newSubPayLumpItems.reduce((s,r)=>s+r.value,0);
                    if(newSubPayMech==="manhour")   subtotal=newSubPayManrows.reduce((s,r)=>s+r.qty*r.unit_price,0);
                    if(newSubPayMech==="unit_rate") subtotal=newSubPayUnitrows.reduce((s,r)=>s+r.qty*r.unit_price,0);
                    const ret=subtotal*sub.retention_pct/100;
                    const net=subtotal-ret-newSubPayAdvance;
                    const enrichedS=enrichedSubs.find(x=>x.id===newSubPaySubId)!;
                    const isOver=enrichedS&&(enrichedS.totalApproved+subtotal)>sub.contract_value*1.001;
                    return (
                      <div className={`rounded-xl p-4 border ${isOver?"bg-rose-50 border-rose-200":"bg-emerald-50 border-emerald-100"}`}>
                        {isOver&&<p className="text-xs font-bold text-rose-700 flex items-center gap-1.5 mb-3"><AlertTriangle size={13}/>Cảnh báo: Tổng TT sẽ vượt giá trị HĐ phụ {fmtB(sub.contract_value)}!</p>}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center mb-3">
                          {[
                            {l:"Giá trị TT",v:fmtB(subtotal),c:"text-slate-800"},
                            {l:`Giữ lại BH (${sub.retention_pct}%)`,v:ret>0?`-${fmtB(ret)}`:"—",c:"text-amber-600"},
                            {l:"Khấu trừ TU",v:newSubPayAdvance>0?`-${fmtB(newSubPayAdvance)}`:"—",c:"text-rose-600"},
                            {l:"Thực chi",v:fmtB(net),c:"text-emerald-700"},
                          ].map(r=>(
                            <div key={r.l}><div className={`text-base font-bold ${r.c}`}>{r.v}</div><div className="text-[10px] text-slate-400">{r.l}</div></div>
                          ))}
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Khấu trừ tạm ứng (VNĐ)</label>
                          <input type="number" value={newSubPayAdvance} onChange={e=>setNewSubPayAdvance(Number(e.target.value))} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400 bg-white"/>
                        </div>
                      </div>
                    );
                  })()}

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Ghi chú</label>
                    <textarea value={newSubPayNote} onChange={e=>setNewSubPayNote(e.target.value)} rows={2} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400 resize-none"/>
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Ghi chú</label>
                    <input value={newSubPayNote} onChange={e=>setNewSubPayNote(e.target.value)} placeholder="Ghi chú thêm..."
                      className={inputCls}/>
                  </div>
                </div>
              </ModalForm>

              <div className="space-y-3">
                {/* Payment search + status filter */}
                <div className="flex gap-2 mb-3">
                  <div className="relative flex-1">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input value={paySearch} onChange={e=>setPaySearch(e.target.value)}
                      placeholder="Tìm theo mã phiếu, ghi chú..."
                      className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-orange-400"/>
                  </div>
                  <select value={payStatusFilter} onChange={e=>setPayStatusFilter(e.target.value)}
                    className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-orange-400">
                    <option value="all">Tất cả TT</option>
                    <option value="draft">Nháp</option>
                    <option value="submitted">Đã gửi</option>
                    <option value="approved">Đã duyệt</option>
                    <option value="paid">Đã chi</option>
                  </select>
                </div>
                {subPayments
                  .filter(p=>!selectedSubId||p.sub_id===selectedSubId)
                  .filter(p=>payStatusFilter==="all"||p.status===payStatusFilter)
                  .filter(p=>!paySearch||p.pay_no.toLowerCase().includes(paySearch.toLowerCase())||(p.note||"").toLowerCase().includes(paySearch.toLowerCase()))
                  .sort((a,b)=>b.id.localeCompare(a.id))
                  .map(pay=>{
                    const sub=subs.find(s=>s.id===pay.sub_id);
                    if(!sub) return null;
                    return (
                      <div key={pay.id} className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all overflow-hidden ${pay.status==="paid"?"border-emerald-200":pay.status==="approved"?"border-amber-200":pay.status==="submitted"?"border-blue-200":"border-slate-200"}`}>
                        <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className={`p-2.5 rounded-xl shrink-0 text-xl bg-${SUB_TYPE_CFG[sub.type].color}-50`}>{SUB_TYPE_CFG[sub.type].icon}</div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-800">{pay.pay_no}</span>
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${SUB_PAY_STATUS[pay.status].cls}`}>{SUB_PAY_STATUS[pay.status].label}</span>
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold">{MECH_CFG[pay.mechanism].short}</span>
                              </div>
                              <p className="text-xs font-semibold text-slate-700 mt-0.5">{sub.name}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5">{pay.period}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5"><Calendar size={9}/>{pay.date}{pay.note&&<>· {pay.note}</>}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-3 shrink-0 text-center">
                            {[
                              {l:"Giá trị",v:fmtB(pay.subtotal),c:"text-slate-700"},
                              {l:"Giữ lại BH",v:pay.retention_amt>0?`-${fmtB(pay.retention_amt)}`:"—",c:"text-amber-600"},
                              {l:"Khấu trừ TU",v:pay.advance_deduct>0?`-${fmtB(pay.advance_deduct)}`:"—",c:"text-rose-500"},
                              {l:"Thực chi",v:fmtB(pay.net_payable),c:"text-emerald-700 font-bold"},
                            ].map(s=>(
                              <div key={s.l}>
                                <div className={`text-sm font-semibold ${s.c}`}>{s.v}</div>
                                <div className="text-[9px] text-slate-400 mt-0.5">{s.l}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                        {expandedSubPayId === pay.id && (pay.unit_rows||pay.manhour_rows||pay.lump_items) && (
                          <div className="border-t border-slate-100 overflow-x-auto animate-in fade-in duration-200">
                            <table className="w-full text-xs">
                              <tbody className="divide-y divide-slate-50">
                                {pay.unit_rows?.map((r,i)=><tr key={i} className="hover:bg-slate-50"><td className="px-4 py-1.5 text-slate-600">{r.boq_ref}</td><td className="px-4 py-1.5 text-right">{fmt(r.qty)} {r.unit}</td><td className="px-4 py-1.5 text-right text-slate-400">× {fmt(r.unit_price)}</td><td className="px-4 py-1.5 text-right font-semibold text-emerald-600 whitespace-nowrap">{fmtB(r.qty*r.unit_price)}</td></tr>)}
                                {pay.manhour_rows?.map((r,i)=><tr key={i} className="hover:bg-slate-50"><td className="px-4 py-1.5 text-slate-600">{r.description}</td><td className="px-4 py-1.5 text-right">{fmt(r.qty)} {r.unit}</td><td className="px-4 py-1.5 text-right text-slate-400">× {fmt(r.unit_price)}</td><td className="px-4 py-1.5 text-right font-semibold text-emerald-600 whitespace-nowrap">{fmtB(r.qty*r.unit_price)}</td></tr>)}
                                {pay.lump_items?.map((r,i)=><tr key={i} className="hover:bg-slate-50"><td className="px-4 py-1.5 text-slate-600" colSpan={3}>{r.name}</td><td className="px-4 py-1.5 text-right font-semibold text-emerald-600 whitespace-nowrap">{fmtB(r.value)}</td></tr>)}
                              </tbody>
                            </table>
                          </div>
                        )}
                        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                          <div className="flex gap-2">
                            {pay.status==="draft"&&<button onClick={()=>setSubPayments(p=>p.map(x=>x.id===pay.id?{...x,status:"submitted" as SubPayStatus}:x))} className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-lg hover:bg-blue-100">Gửi duyệt</button>}
                            {pay.status==="submitted"&&<button onClick={()=>setSubPayments(p=>p.map(x=>x.id===pay.id?{...x,status:"approved" as SubPayStatus}:x))} className="px-3 py-1 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-lg hover:bg-amber-100">Phê duyệt</button>}
                            {pay.status==="approved"&&<button onClick={()=>setSubPayments(p=>p.map(x=>x.id===pay.id?{...x,status:"paid" as SubPayStatus}:x))} className="px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-lg hover:bg-emerald-100">Xác nhận đã chi</button>}
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => setExpandedSubPayId(prev => prev === pay.id ? null : pay.id)}
                              className="flex items-center gap-1 px-3 py-1 text-slate-600 text-[10px] font-bold hover:bg-slate-100 rounded-lg border border-slate-200">
                              {expandedSubPayId === pay.id ? <ChevronUp size={10}/> : <ChevronDown size={10}/>}
                              {expandedSubPayId === pay.id ? 'Thu gọn' : 'Xem chi tiết'}
                            </button>
                            <button className="flex items-center gap-1 px-3 py-1 text-slate-500 text-[10px] font-bold hover:bg-slate-200 rounded-lg"><Printer size={10}/>In phiếu</button>
                            <button className="flex items-center gap-1 px-3 py-1 text-slate-500 text-[10px] font-bold hover:bg-slate-200 rounded-lg"><Download size={10}/>Excel</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
  );
}
