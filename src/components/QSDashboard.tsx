import { useNotification } from './NotificationEngine';
import ModalForm, { FormRow, FormGrid, FormSection, FormFileUpload, inputCls, selectCls, BtnCancel, BtnSubmit } from './ModalForm';
import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { genAI, GEM_MODEL, GEM_MODEL_QUALITY } from './gemini';
import {
  createDocument, processApproval, submitDocument,
  verifyPin, seedApprovalDocs, canApproveDoc,
} from './approvalEngine';
import type { SeedVoucherInput, ApprovalDoc } from './approvalEngine';
import { usePrint } from './PrintService';
import { DEFAULT_THRESHOLDS, WORKFLOWS, ROLES, canActOnStep } from './permissions';
import type { UserContext } from './permissions';
import { db, useRealtimeSync } from "./db";
import { useAuth } from "./AuthProvider";
import {
  BarChart2, TrendingUp, TrendingDown, FileText, Plus, Upload,
  Sparkles, Loader2, AlertTriangle, CheckCircle2, X, ChevronDown,
  ChevronRight, Edit3, Trash2, Save, Eye, Printer, Download,
  ArrowLeft, Search, Filter, RefreshCw, Info, Send, Copy,
  DollarSign, Package, ClipboardCheck, Activity, Target,
  AlertCircle, Check, ChevronUp, Layers, Calendar, User,
  Building2, Hash, Calculator, Zap, Clock, MoreVertical,
  ArrowUpRight, ArrowDownRight, Minus, Lock,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
// ── Extracted modules ──────────────────────────────────────────────────────────
import VariationOrdersTab from './QSVariationTab';
import SubcontractorTab   from './QSSubcontractorTab';
import {
  type BOQItem, type AcceptanceLot, type PaymentRequest, type QSProps,
  type SubContractor, type SubPayment, type PayMechanism,
  INIT_BOQ, INIT_ACCEPTANCE, INIT_PAYMENTS, S_CURVE_DATA,
  PAYMENT_STATUS, ACCEPT_STATUS, CHAPTERS, CHAPTER_NAMES, CHAPTER_COLORS,
  fmt, fmtB, pct, calcBOQValue, calcDoneValue,
} from './QSTypes';

;

// ── System prompt Nàng GEM chuẩn SI V2.0 ─────────────────────────────────────
const GEM_QS_SYSTEM = `Bạn là GEM — chuyên gia QS (Quantity Surveyor) của hệ thống Construction ERP. 
Giọng điệu: nữ miền Nam, thân thiện, chuyên nghiệp. Xưng "em", gọi "Anh/Chị", dùng: dạ / nha / ạ / nghen.
Câu ngắn, rõ ràng. Liệt kê bằng số (1, 2, 3...). Có con số cụ thể. Thực tế ngành xây dựng Việt Nam.
Khi tạo tài liệu chính thức: KHÔNG xưng em/anh, dùng ngôi thứ ba, cấu trúc chuẩn CHXHCN Việt Nam.`;
// ══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — SMALL UI COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 5 — MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function QSDashboard({ projectId, projectName, contractValue = 45_800_000_000, currentRole = 'qs_site' }: QSProps) {
  const { ok: notifOk, info: notifInfo } = useNotification();

  // ── RBAC context ────────────────────────────────────────────────────────────
  const ROLE_MAP: Record<string,string> = {
    giam_doc:'giam_doc', pm:'pm', chi_huy_truong:'chi_huy_truong',
    chi_huy_pho:'chi_huy_pho', qs_site:'qs_site', ke_toan:'ke_toan_site',
    giam_sat:'ks_giam_sat', thu_kho:'thu_kho', ke_toan_kho:'ke_toan_kho',
  };
  const LEVEL_MAP: Record<string,number> = {
    giam_doc:5, pm:4, ke_toan_truong:4,
    truong_qs:3, truong_qaqc:3, truong_hse:3, hr_truong:3,
    chi_huy_truong:3, chi_huy_pho:3,
    qs_site:2, qaqc_site:2, ks_giam_sat:2, hse_site:2,
    ke_toan_site:2, ke_toan_kho:2, hr_site:2,
    thu_kho:1, thu_ky_site:1, operator:1,
    // legacy
    ke_toan:2, giam_sat:2,
  };
  const qsRoleId  = ROLE_MAP[currentRole] || 'qs_site';
  const qsLevel   = LEVEL_MAP[currentRole] ?? 2;
  const qsCtx: UserContext = { userId: `user_${currentRole}`, roleId: qsRoleId as any };

  const [activeTab, setActiveTab] = useState<"overview"|"boq"|"tracking"|"acceptance"|"payment"|"subcontractor"|"evm"|"variation">(() => {
    const saved = sessionStorage.getItem('gem_action_subtab');
    const validTabs = ['boq','tracking','acceptance','payment','subcontractor','evm','variation'];
    if (saved && validTabs.includes(saved)) { sessionStorage.removeItem('gem_action_subtab'); return saved as any; }
    return "overview";
  });

  const { printComponent, printQSPayment } = usePrint();

  // ── Approval Engine state ───────────────────────────────────────────────────
  // Callback for VariationOrdersTab to update VO status after PIN approval
  const onVOApprovedRef = React.useRef<((voucherId:string) => void) | null>(null);

  // Helper: trigger approval — bypass PIN for REVIEW steps, open modal for APPROVE
  // NOTE: khai báo TRƯỚC approveQSDoc để tránh TDZ. Dùng processApproval trực tiếp cho REVIEW.
  const triggerApproval = useCallback((
    docId: string,
    voucherId: string,
    type: 'VO' | 'ACCEPTANCE' | 'PAYMENT',
    onApproved: (fullyApproved: boolean) => void,
  ) => {
    try {
      const allDocs: ApprovalDoc[] = JSON.parse(localStorage.getItem(`gem_approvals_${projectId}`) || '[]');
      const doc = allDocs.find(d => d.id === docId);
      if (!doc) return;
      const workflow = WORKFLOWS[doc.docType as keyof typeof WORKFLOWS];
      const currStep = workflow?.steps.find((s: any) => s.stepId === doc.currentStepId);
      const isReview = currStep?.actionType === 'review';

      if (isReview) {
        // REVIEW step: inline processApproval để không phụ thuộc approveQSDoc (tránh TDZ)
        const result = processApproval({ projectId, docId, action: 'REVIEW', ctx: qsCtx });
        if (result.ok) {
          const fa = result.data.status === 'APPROVED' || result.data.status === 'COMPLETED';
          onApproved(fa);
        }
      } else {
        // APPROVE / R_A step: mở modal PIN
        setPinModal({ docId, voucherId, type });
        pendingApprovalCallbackRef.current = onApproved;
      }
    } catch {}
  }, [projectId, qsCtx]);

  // Ref to store callback after PIN confirmed
  const pendingApprovalCallbackRef = React.useRef<((fa: boolean) => void) | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [pinModal, setPinModal]       = useState<{docId:string; voucherId:string; type:'VO'|'ACCEPTANCE'|'PAYMENT'} | null>(null);
  const [pinValue, setPinValue]       = useState('');
  const [pinError, setPinError]       = useState('');
  const [approvalMsg, setApprovalMsg] = useState('');

  // Helper: find engine doc for a qs item
  const findEngineDoc = useCallback((itemId: string): ApprovalDoc | null => {
    try {
      const all = JSON.parse(localStorage.getItem(`gem_approvals_${projectId}`) || '[]');
      return all.find((d: any) => d.data?.qsItemId === itemId) || null;
    } catch { return null; }
  }, [projectId]);

  // Helper: create+submit a QS doc
  const submitQSDoc = useCallback((
    itemId: string, docType: any, title: string, amount: number, extra: any,
    creatorCtx: UserContext,
  ): string | null => {
    const existing = findEngineDoc(itemId);
    if (existing && existing.status !== 'DRAFT' && existing.status !== 'RETURNED') return existing.id;
    const created = createDocument({
      projectId, docType, ctx: creatorCtx,
      title, amount,
      thresholds: { ...DEFAULT_THRESHOLDS, projectId } as any,
      data: { qsItemId: itemId, ...extra },
    });
    if (!created.ok) { console.error('QS createDocument:', (created as any).error); return null; }
    const submitted = submitDocument(projectId, created.data.id, creatorCtx);
    if (!submitted.ok) { console.error('QS submitDocument:', (submitted as any).error); return null; }
    return submitted.data.id;
  }, [projectId, findEngineDoc]);

  // Helper: approve (or review) a QS doc — v2.0 actionType-aware
  const approveQSDoc = useCallback((docId: string, pin?: string): {
    ok: boolean; fullyApproved: boolean; status?: string; error?: string;
  } => {
    // Xác định step hiện tại để biết cần REVIEW hay APPROVE
    try {
      const allDocs: ApprovalDoc[] = JSON.parse(localStorage.getItem(`gem_approvals_${projectId}`) || '[]');
      const doc = allDocs.find(d => d.id === docId);
      if (!doc) return { ok: false, fullyApproved: false, error: 'Không tìm thấy chứng từ' };

      const workflow = WORKFLOWS[doc.docType as keyof typeof WORKFLOWS];
      const currStep = workflow?.steps.find((s: any) => s.stepId === doc.currentStepId);
      const isReview  = currStep?.actionType === 'review';

      const result = processApproval({
        projectId, docId,
        action: isReview ? 'REVIEW' : 'APPROVE',
        ctx: qsCtx,
        pin: isReview ? undefined : pin,
      });
      if (!result.ok) {
        setPinError((result as any).error || 'Lỗi duyệt');
        return { ok: false, fullyApproved: false, error: (result as any).error };
      }
      const fullyApproved = result.data.status === 'APPROVED' || result.data.status === 'COMPLETED';
      if (fullyApproved) {
        setApprovalMsg('✅ Phê duyệt hoàn tất');
      } else {
        setApprovalMsg(`✅ ${isReview ? 'Đã xem xét' : 'Đã duyệt bước này'} — đang chờ cấp cao hơn`);
      }
      setTimeout(() => setApprovalMsg(''), 3500);
      return { ok: true, fullyApproved, status: result.data.status };
    } catch (e) {
      const err = String(e);
      setPinError(err);
      return { ok: false, fullyApproved: false, error: err };
    }
  }, [projectId, qsCtx]);

  const [boqItems, setBoqItems]         = useState<BOQItem[]>(INIT_BOQ);
  const [acceptanceLots, setAcceptanceLots] = useState<AcceptanceLot[]>(INIT_ACCEPTANCE);
  const [payments, setPayments]         = useState<PaymentRequest[]>(INIT_PAYMENTS);
  const [dbLoaded, setDbLoaded]         = useState(false);

  // ── Load from db on mount ─────────────────────────────────────────────────
  useEffect(() => {
    if (!projectId) return;
    setDbLoaded(false);
    Promise.all([
      db.get<BOQItem[]>('qs_items', projectId, INIT_BOQ),
      db.get<AcceptanceLot[]>('qs_acceptance', projectId, INIT_ACCEPTANCE),
      db.get<PaymentRequest[]>('qs_payments', projectId, INIT_PAYMENTS),
    ]).then(([items, lots, pays]) => {
      setBoqItems(items);
      setAcceptanceLots(lots);
      setPayments(pays);
      setDbLoaded(true);
    });
  }, [projectId]);

  // ── Persist to db on change ───────────────────────────────────────────────
  useEffect(() => { if (dbLoaded && projectId) db.set('qs_items',      projectId, boqItems);      }, [boqItems,      projectId]);
  useEffect(() => { if (dbLoaded && projectId) db.set('qs_acceptance', projectId, acceptanceLots); }, [acceptanceLots, projectId]);
  useEffect(() => { if (dbLoaded && projectId) db.set('qs_payments',   projectId, payments);       }, [payments,       projectId]);

  // ── Realtime sync ──────────────────────────────────────────────────────────
  useRealtimeSync(projectId, ['qs_items', 'qs_acceptance', 'qs_payments'], async () => {
    const [items, lots, pays] = await Promise.all([
      db.get<BOQItem[]>('qs_items', projectId, INIT_BOQ),
      db.get<AcceptanceLot[]>('qs_acceptance', projectId, INIT_ACCEPTANCE),
      db.get<PaymentRequest[]>('qs_payments', projectId, INIT_PAYMENTS),
    ]);
    setBoqItems(items);
    setAcceptanceLots(lots);
    setPayments(pays);
  });

  // BOQ state
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set(CHAPTERS));
  const [editingId, setEditingId]       = useState<string|null>(null);
  const [editRow, setEditRow]           = useState<Partial<BOQItem>>({});
  const [boqSearch, setBoqSearch]       = useState("");
  const [isAiParsing, setIsAiParsing]   = useState(false);
  const [showAddRow, setShowAddRow]     = useState(false);
  const [newRow, setNewRow]             = useState<Partial<BOQItem>>({ chapter:"C2", unit:"m³" });

  // Acceptance state
  const [showNewLot, setShowNewLot]     = useState(false);
  const [newLotItems, setNewLotItems]   = useState<{boq_id:string;qty:number}[]>([]);
  const [newLotNote, setNewLotNote]     = useState("");

  // Payment state
  const [showNewPayment, setShowNewPayment] = useState(false);

  // gem:open-action — WorkspaceActionBar trigger
  useEffect(() => {
    const handler = (e: Event) => {
      const { actionId } = (e as CustomEvent).detail;
      if (actionId === 'PAYMENT_REQUEST')    { setActiveTab('payment');    setShowNewPayment(true); }
      if (actionId === 'VARIATION_ORDER')    { setActiveTab('variation');  }
      if (actionId === 'ACCEPTANCE_INTERNAL'){ setActiveTab('acceptance'); setShowNewLot(true); }
    };
    window.addEventListener('gem:open-action', handler);
    return () => window.removeEventListener('gem:open-action', handler);
  }, []);
  const [selectedLotIds, setSelectedLotIds] = useState<string[]>([]);
  const [payPeriod, setPayPeriod]       = useState("");
  const [payNote, setPayNote]           = useState("");
  const [expandedPayId, setExpandedPayId]   = useState<string|null>(null);
  const [expandedLotId, setExpandedLotId]   = useState<string|null>(null);
  const [advanceDeduct, setAdvanceDeduct] = useState("0");

  // ── Subcontractor state ──────────────────────────────────────────────────
  const [subs, setSubs]               = useState<SubContractor[]>([]);
  const [subPayments, setSubPayments] = useState<SubPayment[]>([]);

  // ── GEM AI chat state ─────────────────────────────────────────────────────
  const [aiPrompt, setAiPrompt]       = useState('');
  const [aiResponse, setAiResponse]   = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // ── Subcontractor form state ───────────────────────────────────────────────
  const [newSub, setNewSub]                   = useState<Partial<SubContractor>>({ type:'subcontractor', pay_mechanism:'progress', retention_pct:5 });
  const [selectedSub, setSelectedSub]         = useState<SubContractor|null>(null);
  const [showNewSubPay, setShowNewSubPay]     = useState(false);
  const [newSubPaySubId, setNewSubPaySubId]   = useState('');
  const [newSubPayMech, setNewSubPayMech]     = useState<PayMechanism>('progress');
  const [newSubPayPct, setNewSubPayPct]       = useState(0);
  const [newSubPayNote, setNewSubPayNote]     = useState('');
  const [newSubPayPeriod, setNewSubPayPeriod] = useState('');
  const [newSubPayAdvance, setNewSubPayAdvance] = useState(0);
  const [newSubPayLumpItems, setNewSubPayLumpItems] = useState<{name:string;value:number}[]>([{name:'',value:0}]);
  const [newSubPayManrows, setNewSubPayManrows]     = useState<{description:string;qty:number;unit:string;unit_price:number}[]>([{description:'',qty:0,unit:'Công',unit_price:0}]);
  const [newSubPayUnitrows, setNewSubPayUnitrows]   = useState<{boq_ref:string;qty:number;unit:string;unit_price:number}[]>([{boq_ref:'',qty:0,unit:'m³',unit_price:0}]);

  // BOQ computed
  const nonChapter = useMemo(() => boqItems.filter(i => !i.isChapter), [boqItems]);
  const totalContract = useMemo(() => nonChapter.reduce((s, i) => s + i.qty_contract * i.unit_price, 0), [nonChapter]);
  const totalDone     = useMemo(() => nonChapter.reduce((s, i) => s + i.qty_done * i.unit_price, 0), [nonChapter]);
  const totalPlan     = useMemo(() => nonChapter.reduce((s, i) => s + i.qty_plan_current * i.unit_price, 0), [nonChapter]);
  const totalPaid     = useMemo(() => payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.net_payable, 0), [payments]);
  const totalApproved = useMemo(() => payments.filter(p => ['paid','approved'].includes(p.status)).reduce((s, p) => s + p.net_payable, 0), [payments]);

  const alerts = useMemo(() =>
    nonChapter.filter(i => {
      const doneP = pct(i.qty_done, i.qty_contract);
      const planP = pct(i.qty_plan_current, i.qty_contract);
      return doneP > 100 || (planP > 0 && Math.abs(doneP - planP) > 15);
    }),
  [nonChapter]);

  // EVM metrics
  const BAC = totalContract;
  const PV  = totalPlan;
  const EV  = totalDone;
  const AC  = totalDone * 1.137; // giả lập chi phí thực tế 13.7% cao hơn giá trị
  const SPI = EV / (PV || 1);
  const CPI = EV / (AC || 1);
  const EAC = BAC / CPI;
  const VAC = BAC - EAC;
  const ETC = EAC - AC;

  // ── Handlers ────────────────────────────────────────────────────────────────
  const toggleChapter = (ch: string) => {
    setExpandedChapters(prev => {
      const next = new Set(prev);
      next.has(ch) ? next.delete(ch) : next.add(ch);
      return next;
    });
  };

  const startEdit = (item: BOQItem) => { setEditingId(item.id); setEditRow({ ...item }); };
  const cancelEdit = () => { setEditingId(null); setEditRow({}); };
  const saveEdit = () => {
    setBoqItems(prev => prev.map(i => i.id === editingId ? { ...i, ...editRow } : i));
    cancelEdit();
  };

  const deleteItem = (id: string) => {
    setBoqItems(prev => prev.filter(i => i.id !== id));
        notifOk('Đã xóa hạng mục.');
  };

  const addNewRow = () => {
    if (!newRow.name || !newRow.code) { notifInfo('Vui lòng nhập mã và tên hạng mục!'); return; }
    const item: BOQItem = {
      id: `custom-${Date.now()}`,
      code: newRow.code || "",
      chapter: newRow.chapter || "C2",
      name: newRow.name || "",
      unit: newRow.unit || "m³",
      qty_contract: Number(newRow.qty_contract) || 0,
      unit_price: Number(newRow.unit_price) || 0,
      qty_done: 0,
      qty_plan_current: 0,
      note: newRow.note,
    };
    setBoqItems(prev => [...prev, item]);
    setNewRow({ chapter:"C2", unit:"m³" });
    setShowAddRow(false);
  };

  const simulateAiParse = async () => {
    setIsAiParsing(true);
    await new Promise(r => setTimeout(r, 2800));
    setIsAiParsing(false);
    notifOk('GEM đã đọc bản vẽ và nhận diện được 34 hạng mục BOQ!\n\nChức năng xuất dữ liệu vào bảng sẽ khả dụng sau khi tích hợp Supabase Storage. Hiện tại anh có thể nhập tay hoặc upload Excel.');
  };

  const saveNewLot = () => {
    if (!newLotItems.length) { notifInfo('Chưa có hạng mục nào!'); return; }
    const lot: AcceptanceLot = {
      id: `a${Date.now()}`,
      lot_no: `NT-${String(acceptanceLots.length + 1).padStart(3,"0")}`,
      date: new Date().toLocaleDateString("vi-VN"),
      status: "draft",
      submitted_by: "Phạm Văn D",
      note: newLotNote,
      total_value: 0,
      items: newLotItems,
    };
    setAcceptanceLots(prev => [...prev, lot]);
    setNewLotItems([]); setNewLotNote(""); setShowNewLot(false);
  };

  const saveNewPayment = () => {
    if (!selectedLotIds.length) { notifInfo('Chọn ít nhất 1 đợt nghiệm thu!'); return; }
    const pay: PaymentRequest = {
      id: `p${Date.now()}`,
      request_no: `TT-${String(payments.length + 1).padStart(3,"0")}`,
      date: new Date().toLocaleDateString("vi-VN"),
      period: payPeriod,
      lot_ids: selectedLotIds,
      subtotal:0, vat:0, total:0,
      advance_deduct: Number(advanceDeduct.replace(/\D/g,"")) || 0,
      net_payable:0,
      status: "draft",
      note: payNote,
    };
    setPayments(prev => [...prev, pay]);
    setSelectedLotIds([]); setPayPeriod(""); setPayNote(""); setAdvanceDeduct("0");
    setShowNewPayment(false);
  };

  const askGem = async () => {
    if (!aiPrompt.trim() || isAiLoading) return;
    const q = aiPrompt; setAiPrompt(""); setIsAiLoading(true);
    const ctx = `Dự án: ${projectName} | Giá trị HĐ: ${fmtB(contractValue)} | BOQ tổng: ${fmtB(totalContract)} | Thực hiện: ${fmtB(totalDone)} (${pct(totalDone,totalContract)}%) | Kế hoạch: ${pct(totalPlan,totalContract)}% | Đã thanh toán CĐT: ${fmtB(totalPaid)} | Đã TT NTP: ${fmtB(subStats.totalPaid)} | SPI: ${SPI.toFixed(2)} | CPI: ${CPI.toFixed(2)} | EAC: ${fmtB(EAC)} | VAC: ${fmtB(VAC)} | Cảnh báo: ${alerts.length} hạng mục${matSupplierSummary ? ' | ' + matSupplierSummary : ''}`;
    try {
      const model = genAI.getGenerativeModel({
        model: GEM_MODEL,
        systemInstruction: GEM_QS_SYSTEM + `\nContext dự án: ${ctx}`,
      });
      const result = await model.generateContent(q);
      setAiResponse(result.response.text() || "Dạ em xin lỗi, có lỗi kết nối ạ!");
    } catch {
      setAiResponse("Em bị mất kết nối tạm thời. Anh thử lại nghen!");
    }
    setIsAiLoading(false);
  };

  // ── Filtered BOQ for display ────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    if (!boqSearch) return boqItems;
    const q = boqSearch.toLowerCase();
    return boqItems.filter(i => i.isChapter || i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q));
  }, [boqItems, boqSearch]);

  // ── Subcontractor computed ───────────────────────────────────────────────
  const enrichedSubs = useMemo(() => subs.map(sub => {
    const pays = subPayments.filter(p => p.sub_id === sub.id);
    const totalPaid    = pays.filter(p=>p.status==="paid").reduce((s,p)=>s+p.net_payable,0);
    const totalApproved= pays.filter(p=>["paid","approved"].includes(p.status)).reduce((s,p)=>s+p.subtotal,0);
    const totalRetention = pays.filter(p=>["paid","approved"].includes(p.status)).reduce((s,p)=>s+p.retention_amt,0);
    const pctPaid      = pct(totalPaid, sub.contract_value);
    const remaining    = sub.contract_value - totalApproved;
    const isOverBudget = totalApproved > sub.contract_value * 1.001;
    return { ...sub, totalPaid, totalApproved, totalRetention, pctPaid, remaining, isOverBudget, pays };
  }), [subs, subPayments]);

  const subStats = useMemo(()=>({
    totalContractValue: enrichedSubs.reduce((s,x)=>s+x.contract_value,0),
    totalPaid:          enrichedSubs.reduce((s,x)=>s+x.totalPaid,0),
    totalRetention:     enrichedSubs.reduce((s,x)=>s+x.totalRetention,0),
    overBudgetCount:    enrichedSubs.filter(x=>x.isOverBudget).length,
    pendingCount:       subPayments.filter(p=>p.status==="submitted").length,
  }),[enrichedSubs, subPayments]);

  // ── enrichedLots: acceptanceLots với total_value tính lại từ boqItems ──────────
  const enrichedLots = useMemo(() =>
    acceptanceLots.map(lot => ({
      ...lot,
      total_value: lot.items.reduce((s, li) => {
        const item = boqItems.find(b => b.id === li.boq_id);
        return s + (item ? li.qty * item.unit_price : 0);
      }, 0),
    })),
  [acceptanceLots, boqItems]);

  // ── chapterStats: tổng hợp tiến độ theo từng chương ─────────────────────────
  const chapterStats = useMemo(() =>
    CHAPTERS.map(ch => {
      const items = nonChapter.filter(i => i.chapter === ch);
      const contract = items.reduce((s, i) => s + i.qty_contract * i.unit_price, 0);
      const done     = items.reduce((s, i) => s + i.qty_done    * i.unit_price, 0);
      const plan     = items.reduce((s, i) => s + i.qty_plan_current * i.unit_price, 0);
      return {
        ch,
        name:    CHAPTER_NAMES[ch] ?? ch,
        contract,
        pctDone: pct(done, contract),
        pctPlan: pct(plan, contract),
      };
    }),
  [nonChapter]);

  // ── enrichedPayments: payments với lots enriched ───────────────────────────
  const enrichedPayments = useMemo(() =>
    payments.map(pay => ({
      ...pay,
      lots: acceptanceLots.filter(l => pay.lot_ids.includes(l.id)),
    })),
  [payments, acceptanceLots]);

  // ── matSupplierSummary: context string cho AI ────────────────────────────────
  const matSupplierSummary = '';   // placeholder — wire từ MaterialsDashboard nếu cần

  const saveNewSubPayment = () => {
    const sub = subs.find(s=>s.id===newSubPaySubId);
    if (!sub) { notifInfo('Chọn đối tác!'); return; }
    let subtotal = 0;
    if (newSubPayMech==="progress")  subtotal = sub.contract_value * newSubPayPct / 100;
    if (newSubPayMech==="lump_sum")  subtotal = newSubPayLumpItems.reduce((s,r)=>s+r.value,0);
    if (newSubPayMech==="manhour")   subtotal = newSubPayManrows.reduce((s,r)=>s+r.qty*r.unit_price,0);
    if (newSubPayMech==="unit_rate") subtotal = newSubPayUnitrows.reduce((s,r)=>s+r.qty*r.unit_price,0);
    const retention_amt = subtotal * sub.retention_pct / 100;
    const net_payable   = subtotal - retention_amt - newSubPayAdvance;
    const pay: SubPayment = {
      id:`sp${Date.now()}`, sub_id:newSubPaySubId,
      pay_no:`TT-${sub.code}-${String(subPayments.filter(p=>p.sub_id===newSubPaySubId).length+1).padStart(2,"0")}`,
      date: new Date().toLocaleDateString("vi-VN"),
      period: newSubPayPeriod, mechanism: newSubPayMech,
      ...(newSubPayMech==="progress"   && { progress_pct:newSubPayPct }),
      ...(newSubPayMech==="lump_sum"   && { lump_items:newSubPayLumpItems }),
      ...(newSubPayMech==="manhour"    && { manhour_rows:newSubPayManrows }),
      ...(newSubPayMech==="unit_rate"  && { unit_rows:newSubPayUnitrows }),
      subtotal, retention_amt, advance_deduct:newSubPayAdvance, net_payable,
      status:"draft", note:newSubPayNote,
    };
    setSubPayments(prev=>[...prev, pay]);
    setShowNewSubPay(false);
    setNewSubPayPct(0); setNewSubPayNote(""); setNewSubPayPeriod("");
    setNewSubPayManrows([{description:"",qty:0,unit:"Công",unit_price:0}]);
    setNewSubPayUnitrows([{boq_ref:"",qty:0,unit:"m³",unit_price:0}]);
    setNewSubPayLumpItems([{name:"",value:0}]);
    setNewSubPayAdvance(0); setNewSubPaySubId("");
  };

  const saveNewSub = () => {
    if (!newSub.name||!newSub.code) { notifInfo('Vui lòng nhập mã và tên đối tác!'); return; }
    const s: SubContractor = {
      id:`s${Date.now()}`, code:newSub.code||"", name:newSub.name||"",
      type:newSub.type||"subcontractor", scope:newSub.scope||"",
      contract_value:Number(newSub.contract_value)||0,
      contract_no:newSub.contract_no||"", start_date:newSub.start_date||"",
      end_date:newSub.end_date||"", pay_mechanism:newSub.pay_mechanism||"progress",
      retention_pct:Number(newSub.retention_pct)||5,
      advance_paid:Number(newSub.advance_paid)||0,
      contact:newSub.contact||"", bank_account:newSub.bank_account,
    };
    setSubs(prev=>[...prev, s]);
    setNewSub({type:"subcontractor",pay_mechanism:"progress",retention_pct:5});
    setShowNewSubPay(false);
  };

  // ── Tab config ──────────────────────────────────────────────────────────────
  const tabs = [
    { id:"overview",      label:"Tổng quan",        icon:<BarChart2 size={15}/>      },
    { id:"boq",           label:"BOQ",               icon:<Layers size={15}/>         },
    { id:"tracking",      label:"Theo dõi KL",       icon:<Activity size={15}/>       },
    { id:"acceptance",    label:"Nghiệm thu",         icon:<ClipboardCheck size={15}/> },
    { id:"payment",       label:"TT với CĐT",        icon:<DollarSign size={15}/>     },
    { id:"subcontractor", label:"TT Nhà thầu phụ",   icon:<Building2 size={15}/>      },
    { id:"evm",           label:"EVM",               icon:<TrendingUp size={15}/>     },
    { id:"variation",     label:"Variation Orders",  icon:<AlertTriangle size={15}/>  },
  ];

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-5 pb-20">

      {/* ── HEADER ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Calculator size={20} className="text-blue-600"/>
              Quản lý Khối lượng & Thanh toán (QS)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{projectName} · Giá trị HĐ: <span className="font-bold text-slate-600">{fmtB(contractValue)}</span></p>
          </div>
          {/* Quick AI bar */}
          <div className="flex gap-2 items-center">
            <div className="flex gap-1.5 bg-slate-100 rounded-xl p-1.5 border border-slate-200 focus-within:border-blue-400 transition-all">
              <input value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&askGem()}
                placeholder="Hỏi Nàng GEM về QS..." className="bg-transparent border-none outline-none text-sm px-2 w-52 text-slate-700"/>
              <button onClick={askGem} disabled={isAiLoading}
                className="bg-blue-600 text-white p-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {isAiLoading?<Loader2 size={14} className="animate-spin"/>:<Sparkles size={14}/>}
              </button>
            </div>
          </div>
        </div>

        {/* AI response strip */}
        {aiResponse && (
          <div className="px-5 py-3 bg-blue-50 border-b border-blue-100 flex items-start gap-3">
            <Sparkles size={15} className="text-blue-600 shrink-0 mt-0.5"/>
            <p className="text-sm text-blue-900 flex-1 leading-relaxed">{aiResponse}</p>
            <button onClick={()=>setAiResponse("")} className="text-blue-400 hover:text-blue-600 shrink-0"><X size={14}/></button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex overflow-x-auto gap-0.5 px-3 pt-2">
          {tabs.map(tab => (
            <button key={tab.id} onClick={()=>setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold whitespace-nowrap rounded-t-xl border-b-2 transition-all ${activeTab===tab.id?"border-blue-600 text-blue-700 bg-blue-50/60":"border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}>
              {tab.icon}{tab.label}
              {tab.id==="tracking"&&alerts.length>0&&<span className="bg-rose-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">{alerts.length}</span>}
              {tab.id==="subcontractor"&&subStats.pendingCount>0&&<span className="bg-orange-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">{subStats.pendingCount}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════ TAB: OVERVIEW ══════════════════════════════════ */}
      {activeTab==="overview" && (
        <div className="space-y-5 animate-in fade-in duration-300">

          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Giá trị BOQ HĐ" value={fmtB(totalContract)} sub={`${nonChapter.length} hạng mục`} icon={<Layers size={18}/>} color="slate"/>
            <KpiCard label="Đã thực hiện" value={fmtB(totalDone)} sub={`${pct(totalDone,totalContract)}% giá trị HĐ`} icon={<CheckCircle2 size={18}/>} color="emerald" trend="up"/>
            <KpiCard label="Đã thanh toán" value={fmtB(totalPaid)} sub={`${pct(totalPaid,totalContract)}% giá trị HĐ`} icon={<DollarSign size={18}/>} color="blue"/>
            <KpiCard label="Cảnh báo lệch KL" value={String(alerts.length)} sub="hạng mục cần xem xét" icon={<AlertTriangle size={18}/>} color={alerts.length>0?"rose":"slate"} trend={alerts.length>0?"down":"flat"}/>
          </div>

          {/* S-Curve quick + chapter breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* S-curve mini */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2"><TrendingUp size={16} className="text-blue-600"/>Đường cong S — Tiến độ giá trị</h3>
                <button onClick={()=>setActiveTab("evm")} className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1">EVM chi tiết <ChevronRight size={12}/></button>
              </div>
              <ResponsiveContainer width="100%" height={200} minWidth={0}>
                <AreaChart data={S_CURVE_DATA} margin={{top:5,right:10,left:-10,bottom:0}}>
                  <defs>
                    <linearGradient id="gPV" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gEV" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis dataKey="month" tick={{fontSize:10}} tickLine={false} axisLine={false}/>
                  <YAxis tick={{fontSize:10}} tickLine={false} axisLine={false} unit="%"/>
                  <Tooltip formatter={(v:any)=>[`${v}%`,""]} contentStyle={{borderRadius:"12px",border:"1px solid #e2e8f0",fontSize:11}}/>
                  <Area type="monotone" dataKey="pv" name="Kế hoạch (PV)" stroke="#3b82f6" strokeWidth={2} fill="url(#gPV)" connectNulls={false}/>
                  <Area type="monotone" dataKey="ev" name="Thực hiện (EV)" stroke="#10b981" strokeWidth={2.5} fill="url(#gEV)" connectNulls={false}/>
                  <Area type="monotone" dataKey="ac" name="Chi phí thực (AC)" stroke="#f59e0b" strokeWidth={1.5} fill="none" strokeDasharray="4 2" connectNulls={false}/>
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize:11}}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Chapter % */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Package size={16} className="text-blue-600"/>Theo chương</h3>
              <div className="space-y-4">
                {chapterStats.map(cs => (
                  <div key={cs.ch}>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-semibold text-slate-700">{cs.name}</span>
                      <span className="text-xs text-slate-400">{fmtB(cs.contract)}</span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden relative">
                      {/* plan bar */}
                      <div className="absolute top-0 left-0 h-full bg-slate-200 rounded-full transition-all" style={{width:`${Math.min(cs.pctPlan,100)}%`}}/>
                      {/* done bar */}
                      <div className={`absolute top-0 left-0 h-full rounded-full transition-all bg-${CHAPTER_COLORS[cs.ch]}-500`} style={{width:`${Math.min(cs.pctDone,100)}%`}}/>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className={`text-[10px] font-bold text-${CHAPTER_COLORS[cs.ch]}-600`}>Đạt: {cs.pctDone}%</span>
                      <span className="text-[10px] text-slate-400">KH: {cs.pctPlan}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="bg-white rounded-2xl border border-rose-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-rose-50 border-b border-rose-100 flex items-center gap-2">
                <AlertTriangle size={16} className="text-rose-500"/>
                <h3 className="font-bold text-rose-800">{alerts.length} hạng mục cần chú ý</h3>
                <span className="text-xs text-rose-500">— lệch &gt;15% hoặc vượt khối lượng</span>
              </div>
              <div className="divide-y divide-slate-100">
                {alerts.map(item => {
                  const dP = pct(item.qty_done, item.qty_contract);
                  const plP = pct(item.qty_plan_current, item.qty_contract);
                  const isOver = dP > 100;
                  return (
                    <div key={item.id} className="px-5 py-3 flex items-center gap-4">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${isOver?"bg-rose-100 text-rose-700":"bg-amber-100 text-amber-700"}`}>
                        {isOver?"Vượt KL":"Lệch"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{item.code} — {item.name}</p>
                        <p className="text-[10px] text-slate-400">Đạt {dP}% · KH {plP}% · Chênh {Math.abs(dP-plP)}%</p>
                      </div>
                      <button onClick={()=>setActiveTab("boq")} className="text-xs text-blue-600 font-medium hover:underline whitespace-nowrap">Xem BOQ</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Payment summary */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><DollarSign size={16} className="text-blue-600"/>Tình hình thanh toán</h3>
              <button onClick={()=>setActiveTab("payment")} className="text-xs text-blue-600 font-medium hover:underline">Chi tiết</button>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              {[
                {label:"Giá trị HĐ",value:fmtB(totalContract),cls:"text-slate-800"},
                {label:"Đã được duyệt TT",value:fmtB(totalApproved),cls:"text-amber-700"},
                {label:"Đã nhận tiền",value:fmtB(totalPaid),cls:"text-emerald-700"},
              ].map(s=>(
                <div key={s.label} className="text-center">
                  <div className={`text-xl font-bold ${s.cls}`}>{s.value}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden relative">
              <div className="absolute h-full bg-amber-200 rounded-full" style={{width:`${pct(totalApproved,totalContract)}%`}}/>
              <div className="absolute h-full bg-emerald-500 rounded-full" style={{width:`${pct(totalPaid,totalContract)}%`}}/>
            </div>
            <div className="flex justify-between mt-1.5 text-[10px] text-slate-400">
              <span>0%</span>
              <span>Đã thanh toán {pct(totalPaid,totalContract)}%</span>
              <span>100%</span>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ TAB: BOQ ════════════════════════════════════════ */}
      {activeTab==="boq" && (
        <div className="space-y-4 animate-in fade-in duration-300">
          {/* Toolbar */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input value={boqSearch} onChange={e=>setBoqSearch(e.target.value)}
                placeholder="Tìm theo mã hoặc tên hạng mục..."
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"/>
            </div>
            <div className="flex gap-2 flex-wrap">
              <label className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-medium cursor-pointer transition-all ${isAiParsing?"bg-blue-50 border-blue-200 text-blue-600":"bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"}`}>
                {isAiParsing?<><Loader2 size={14} className="animate-spin"/>AI đang bóc tách...</>:<><Sparkles size={14} className="text-blue-600"/>AI bóc tách từ bản vẽ</>}
                <input ref={fileRef} type="file" className="hidden" accept=".pdf,.dwg,.xlsx" onChange={simulateAiParse} disabled={isAiParsing}/>
              </label>
              <button onClick={()=>setShowAddRow(true)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 shadow-sm">
                <Plus size={14}/> Thêm hạng mục
              </button>
            </div>
          </div>

          {/* Add row — ModalForm */}
          <ModalForm
            open={showAddRow}
            onClose={() => setShowAddRow(false)}
            title="Thêm hạng mục QS"
            subtitle="Bổ sung hạng mục vào bảng khối lượng QS"
            icon={<Plus size={18}/>}
            color="blue"
            width="md"
            footer={<>
              <BtnCancel onClick={() => setShowAddRow(false)}/>
              <BtnSubmit label="Thêm vào BOQ" onClick={addNewRow}/>
            </>}
          >
            <FormGrid cols={2}>
              <div className="col-span-2">
                <FormRow label="Chương">
                  <select value={newRow.chapter} onChange={e=>setNewRow({...newRow,chapter:e.target.value})} className={selectCls}>
                    {CHAPTERS.map(c=><option key={c} value={c}>{c} — {CHAPTER_NAMES[c]}</option>)}
                  </select>
                </FormRow>
              </div>
              <FormRow label="Mã hạng mục *"><input value={newRow.code||""} onChange={e=>setNewRow({...newRow,code:e.target.value})} placeholder="VD: C2.8" className={inputCls}/></FormRow>
              <div className="col-span-2">
                <FormRow label="Tên hạng mục *"><input value={newRow.name||""} onChange={e=>setNewRow({...newRow,name:e.target.value})} placeholder="Tên công việc..." className={inputCls}/></FormRow>
              </div>
              <FormRow label="Đơn vị"><input value={newRow.unit||""} onChange={e=>setNewRow({...newRow,unit:e.target.value})} placeholder="m³, m², tấn..." className={inputCls}/></FormRow>
              <FormRow label="KL hợp đồng"><input type="number" value={newRow.qty_contract||""} onChange={e=>setNewRow({...newRow,qty_contract:Number(e.target.value)})} placeholder="0" className={inputCls}/></FormRow>
              <FormRow label="Đơn giá (VNĐ)"><input type="number" value={newRow.unit_price||""} onChange={e=>setNewRow({...newRow,unit_price:Number(e.target.value)})} placeholder="0" className={inputCls}/></FormRow>
              <FormRow label="Ghi chú"><input value={newRow.note||""} onChange={e=>setNewRow({...newRow,note:e.target.value})} placeholder="Ghi chú thêm..." className={inputCls}/></FormRow>
            </FormGrid>
          </ModalForm>

          {/* BOQ table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {["Mã","Tên hạng mục","ĐV","KL HĐ","Đơn giá","Giá trị HĐ","KL Thực","% Đạt","Giá trị TH",""].map(h=>(
                      <th key={h} className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CHAPTERS.map(ch => {
                    const chItems = filteredItems.filter(i => i.chapter===ch);
                    if (!chItems.length) return null;
                    const header = chItems.find(i=>i.isChapter);
                    const children = chItems.filter(i=>!i.isChapter);
                    const chContract = children.reduce((s,i)=>s+calcBOQValue(i),0);
                    const chDone     = children.reduce((s,i)=>s+calcDoneValue(i),0);
                    return (
                      <React.Fragment key={ch}>
                        {/* Chapter header row */}
                        <tr className="bg-slate-50/80 cursor-pointer hover:bg-slate-100 transition-colors" onClick={()=>toggleChapter(ch)}>
                          <td className="px-3 py-3" colSpan={2}>
                            <div className="flex items-center gap-2">
                              {expandedChapters.has(ch)?<ChevronDown size={15} className="text-slate-400"/>:<ChevronRight size={15} className="text-slate-400"/>}
                              <span className={`w-2.5 h-2.5 rounded-full bg-${CHAPTER_COLORS[ch]}-500`}/>
                              <span className="font-bold text-slate-700 text-sm">{header?.name || ch}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-[10px] text-slate-400">{children.length} HM</td>
                          <td colSpan={2}/>
                          <td className="px-3 py-3 font-bold text-slate-700 text-xs whitespace-nowrap">{fmtB(chContract)}</td>
                          <td colSpan={2}/>
                          <td className="px-3 py-3 font-bold text-emerald-600 text-xs whitespace-nowrap">{fmtB(chDone)}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1.5">
                              <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div className={`h-full bg-${CHAPTER_COLORS[ch]}-500 rounded-full`} style={{width:`${Math.min(pct(chDone,chContract),100)}%`}}/>
                              </div>
                              <span className={`text-[10px] font-bold text-${CHAPTER_COLORS[ch]}-600`}>{pct(chDone,chContract)}%</span>
                            </div>
                          </td>
                        </tr>
                        {/* Children rows */}
                        {expandedChapters.has(ch) && children.map(item => {
                          const isEditing = editingId === item.id;
                          const doneP = pct(item.qty_done, item.qty_contract);
                          const isAlert = doneP > 100 || (item.qty_plan_current > 0 && Math.abs(doneP - pct(item.qty_plan_current, item.qty_contract)) > 15);
                          return (
                            <tr key={item.id} className={`border-b border-slate-50 transition-colors group ${isAlert?"bg-rose-50/40 hover:bg-rose-50":"hover:bg-slate-50/60"}`}>
                              <td className="px-3 py-2.5 pl-8">
                                <span className="font-mono text-[11px] text-slate-500">{isEditing?<input value={editRow.code||""} onChange={e=>setEditRow({...editRow,code:e.target.value})} className="w-16 border rounded px-1 text-xs"/>:item.code}</span>
                              </td>
                              <td className="px-3 py-2.5 max-w-[280px]">
                                {isEditing
                                  ? <input value={editRow.name||""} onChange={e=>setEditRow({...editRow,name:e.target.value})} className="w-full border rounded px-1 py-0.5 text-sm"/>
                                  : <span className={`text-sm ${isAlert?"font-medium text-rose-800":"text-slate-800"}`}>{item.name}</span>
                                }
                              </td>
                              <td className="px-3 py-2.5 text-xs text-slate-500">{isEditing?<input value={editRow.unit||""} onChange={e=>setEditRow({...editRow,unit:e.target.value})} className="w-10 border rounded px-1 text-xs"/>:item.unit}</td>
                              <td className="px-3 py-2.5 text-right text-xs font-medium text-slate-700">
                                {isEditing?<input type="number" value={editRow.qty_contract||0} onChange={e=>setEditRow({...editRow,qty_contract:Number(e.target.value)})} className="w-20 border rounded px-1 text-xs text-right"/>:fmt(item.qty_contract)}
                              </td>
                              <td className="px-3 py-2.5 text-right text-xs text-slate-500">
                                {isEditing?<input type="number" value={editRow.unit_price||0} onChange={e=>setEditRow({...editRow,unit_price:Number(e.target.value)})} className="w-24 border rounded px-1 text-xs text-right"/>:fmt(item.unit_price)}
                              </td>
                              <td className="px-3 py-2.5 text-right text-xs font-semibold text-slate-700 whitespace-nowrap">{fmtB(calcBOQValue(item))}</td>
                              <td className="px-3 py-2.5 text-right text-xs font-medium">
                                {isEditing?<input type="number" value={editRow.qty_done||0} onChange={e=>setEditRow({...editRow,qty_done:Number(e.target.value)})} className="w-20 border rounded px-1 text-xs text-right"/>:<span className={doneP>100?"text-rose-600 font-bold":doneP>0?"text-emerald-600":"text-slate-400"}>{fmt(item.qty_done)}</span>}
                              </td>
                              <td className="px-3 py-2.5 min-w-[100px]">
                                <ProgressBar value={item.qty_done} max={item.qty_contract}/>
                              </td>
                              <td className="px-3 py-2.5 text-right text-xs font-semibold text-emerald-600 whitespace-nowrap">{fmtB(calcDoneValue(item))}</td>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {isEditing?(
                                    <>
                                      <button onClick={saveEdit} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check size={13}/></button>
                                      <button onClick={cancelEdit} className="p-1 text-slate-400 hover:bg-slate-100 rounded"><X size={13}/></button>
                                    </>
                                  ):(
                                    <>
                                      <button onClick={()=>startEdit(item)} className="p-1 text-blue-500 hover:bg-blue-50 rounded" title="Sửa"><Edit3 size={13}/></button>
                                      <button onClick={()=>deleteItem(item.id)} className="p-1 text-rose-400 hover:bg-rose-50 rounded" title="Xóa"><Trash2 size={13}/></button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                  {/* Grand total */}
                  <tr className="bg-slate-800 text-white">
                    <td colSpan={2} className="px-3 py-3"><span className="font-bold text-sm">TỔNG CỘNG</span></td>
                    <td className="px-3 py-3 text-xs text-slate-300">{nonChapter.length} HM</td>
                    <td colSpan={2}/>
                    <td className="px-3 py-3 font-bold text-right text-sm whitespace-nowrap">{fmtB(totalContract)}</td>
                    <td colSpan={2}/>
                    <td className="px-3 py-3 font-bold text-right text-sm text-emerald-400 whitespace-nowrap">{fmtB(totalDone)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-white/20 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-400 rounded-full" style={{width:`${pct(totalDone,totalContract)}%`}}/>
                        </div>
                        <span className="text-xs font-bold text-emerald-400">{pct(totalDone,totalContract)}%</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ TAB: TRACKING ═══════════════════════════════════ */}
      {activeTab==="tracking" && (
        <div className="space-y-5 animate-in fade-in duration-300">

          {/* Quick prompts for AI */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap gap-2">
            {["Hạng mục nào đang chậm nhất?","Dự báo hoàn thành cả dự án?","Đề xuất tăng tốc chương nào?"].map(q=>(
              <button key={q} onClick={()=>{setAiPrompt(q);askGem();}}
                className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-xl text-xs font-medium hover:bg-blue-100 transition-all flex items-center gap-1.5">
                <Sparkles size={11}/>{q}
              </button>
            ))}
          </div>

          {/* Chapter breakdown bars */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {chapterStats.map(cs=>(
              <div key={cs.ch} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full bg-${CHAPTER_COLORS[cs.ch]}-500`}/>
                    <h4 className="font-bold text-slate-800">{cs.name}</h4>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">{fmtB(cs.contract)}</span>
                </div>

                {/* KH vs TT */}
                <div className="space-y-2 mb-4">
                  <div>
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1"><span>KẾ HOẠCH</span><span>{cs.pctPlan}%</span></div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-300 rounded-full" style={{width:`${Math.min(cs.pctPlan,100)}%`}}/>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] font-bold mb-1">
                      <span className={`text-${CHAPTER_COLORS[cs.ch]}-600`}>THỰC HIỆN</span>
                      <span className={cs.pctDone<cs.pctPlan-10?"text-rose-600":`text-${CHAPTER_COLORS[cs.ch]}-600`}>{cs.pctDone}%</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full bg-${CHAPTER_COLORS[cs.ch]}-500`} style={{width:`${Math.min(cs.pctDone,100)}%`}}/>
                    </div>
                  </div>
                </div>

                {/* Delta badge */}
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${cs.pctDone>=cs.pctPlan?"bg-emerald-50 text-emerald-700":"bg-rose-50 text-rose-700"}`}>
                  {cs.pctDone>=cs.pctPlan?<><Check size={11}/>Đúng/Vượt tiến độ</>:<><AlertTriangle size={11}/>Chậm {Math.abs(cs.pctDone-cs.pctPlan)}%</>}
                </div>
              </div>
            ))}
          </div>

          {/* Detail alert table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Chi tiết theo dõi từng hạng mục</h3>
              <span className="text-xs text-slate-400">{nonChapter.length} hạng mục</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {["Mã","Tên hạng mục","ĐV","KL HĐ","KL KH","KL TH","% KH","% TH","Lệch","Trạng thái"].map(h=>(
                      <th key={h} className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {nonChapter.map(item=>{
                    const thP = pct(item.qty_done, item.qty_contract);
                    const khP = pct(item.qty_plan_current, item.qty_contract);
                    const delta = thP - khP;
                    const statusCls = item.qty_done===0?"text-slate-400":thP>100?"text-rose-600 font-bold":delta<-15?"text-amber-600":delta>=0?"text-emerald-600":"text-slate-600";
                    const statusLabel = item.qty_done===0?"Chưa làm":thP>100?"Vượt KL":delta<-15?"Chậm tiến độ":delta>=0?"Đúng/Vượt KH":"Hơi chậm";
                    return (
                      <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${thP>100?"bg-rose-50/30":delta<-15?"bg-amber-50/30":""}`}>
                        <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500">{item.code}</td>
                        <td className="px-3 py-2.5 text-sm text-slate-800 max-w-[220px] truncate">{item.name}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-400">{item.unit}</td>
                        <td className="px-3 py-2.5 text-right text-xs text-slate-600">{fmt(item.qty_contract)}</td>
                        <td className="px-3 py-2.5 text-right text-xs text-slate-500">{fmt(item.qty_plan_current)}</td>
                        <td className="px-3 py-2.5 text-right text-xs font-medium text-slate-700">{fmt(item.qty_done)}</td>
                        <td className="px-3 py-2.5 text-right text-xs text-slate-500">{khP}%</td>
                        <td className="px-3 py-2.5 text-right text-xs font-bold text-emerald-600">{thP}%</td>
                        <td className="px-3 py-2.5 text-right text-xs font-bold">
                          <span className={delta>=0?"text-emerald-600":delta>-10?"text-amber-600":"text-rose-600"}>
                            {delta>=0?"+":""}{delta}%
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`text-[10px] font-bold ${statusCls}`}>{statusLabel}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ TAB: ACCEPTANCE ════════════════════════════════ */}
      {activeTab==="acceptance" && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex justify-between items-center">
            <div className="flex gap-2 text-xs">
              {[
                {label:"Tổng đợt NT",v:enrichedLots.length,cls:"bg-slate-100 text-slate-700"},
                {label:"Đã duyệt",v:enrichedLots.filter(l=>l.status==="approved").length,cls:"bg-emerald-100 text-emerald-700"},
                {label:"Chờ duyệt",v:enrichedLots.filter(l=>l.status==="submitted").length,cls:"bg-blue-100 text-blue-700"},
              ].map(s=>(
                <div key={s.label} className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 ${s.cls}`}>
                  {s.v} {s.label}
                </div>
              ))}
            </div>
            <button onClick={()=>setShowNewLot(true)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 shadow-sm">
              <Plus size={14}/> Lập biên bản NT mới
            </button>
          </div>

          {/* New lot form */}
          {showNewLot && (
            <div className="bg-white rounded-2xl border border-blue-200 shadow-md p-5 space-y-4">
              <h4 className="font-bold text-slate-800 flex items-center gap-2"><ClipboardCheck size={16} className="text-blue-600"/>Lập biên bản nghiệm thu khối lượng mới</h4>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Ghi chú / Mô tả đợt nghiệm thu</label>
                <textarea value={newLotNote} onChange={e=>setNewLotNote(e.target.value)} rows={2}
                  placeholder="VD: Nghiệm thu cột, dầm sàn tầng 5..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 resize-none"/>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Chọn hạng mục & khối lượng nghiệm thu</label>
                  <button onClick={()=>{
                    const items = nonChapter.filter(i=>i.qty_done>0).map(i=>({boq_id:i.id,qty:i.qty_done-i.qty_done*0.9}));
                    setNewLotItems(items.slice(0,5));
                  }} className="text-[10px] bg-blue-50 text-blue-600 font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 hover:bg-blue-100">
                    <Sparkles size={9}/>AI gợi ý hạng mục
                  </button>
                </div>
                <div className="max-h-52 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2">
                  {nonChapter.filter(i=>i.qty_contract>0).map(item=>{
                    const existing = newLotItems.find(l=>l.boq_id===item.id);
                    return (
                      <div key={item.id} className={`flex items-center gap-3 p-2.5 rounded-xl transition-colors ${existing?"bg-blue-50 border border-blue-100":"hover:bg-slate-50"}`}>
                        <input type="checkbox" checked={!!existing} onChange={e=>{
                          if(e.target.checked) setNewLotItems(prev=>[...prev,{boq_id:item.id,qty:0}]);
                          else setNewLotItems(prev=>prev.filter(l=>l.boq_id!==item.id));
                        }} className="accent-blue-600"/>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-700 truncate">{item.code} — {item.name}</p>
                          <p className="text-[10px] text-slate-400">HĐ: {fmt(item.qty_contract)} {item.unit} · Đã NT: {fmt(item.qty_done)} {item.unit}</p>
                        </div>
                        {existing && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <input type="number" value={existing.qty}
                              onChange={e=>setNewLotItems(prev=>prev.map(l=>l.boq_id===item.id?{...l,qty:Number(e.target.value)}:l))}
                              className="w-20 border border-blue-200 rounded-lg px-2 py-1 text-xs text-right focus:outline-none"/>
                            <span className="text-[10px] text-slate-400">{item.unit}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {newLotItems.length>0 && (
                  <p className="text-xs text-blue-600 font-medium mt-2 flex items-center gap-1">
                    <Check size={11}/> Đã chọn {newLotItems.length} hạng mục
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={saveNewLot} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 shadow-md shadow-blue-100">
                  <Save size={14} className="inline mr-1.5"/>Lưu biên bản NT
                </button>
                <button onClick={()=>{setShowNewLot(false);setNewLotItems([]);setNewLotNote("");}} className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm hover:bg-slate-50">Hủy</button>
              </div>
            </div>
          )}

          {/* Lot list */}
          <div className="space-y-3">
            {enrichedLots.map(lot=>(
              <div key={lot.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-all">
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-xl shrink-0 ${lot.status==="approved"?"bg-emerald-50":lot.status==="submitted"?"bg-blue-50":"bg-slate-100"}`}>
                      <ClipboardCheck size={18} className={lot.status==="approved"?"text-emerald-600":lot.status==="submitted"?"text-blue-600":"text-slate-400"}/>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800">{lot.lot_no}</span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${ACCEPT_STATUS[lot.status].cls}`}>{ACCEPT_STATUS[lot.status].label}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{lot.note}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                        <Calendar size={9}/>{lot.date}
                        <User size={9}/>{lot.submitted_by}
                        {lot.approved_by&&<><Check size={9} className="text-emerald-500"/>Duyệt: {lot.approved_by}</>}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold text-slate-800">{fmtB(lot.total_value)}</div>
                    <div className="text-[10px] text-slate-400">{lot.items.length} hạng mục</div>
                    <div className="flex gap-1 mt-1.5 justify-end">
                      {lot.status==="draft" && (
                        <button onClick={() => {
                          const creator: UserContext = { userId: `user_qs_site`, roleId: 'qs_site' as any };
                          const docId = submitQSDoc(
                            lot.id, 'ACCEPTANCE', `BBNT — ${lot.lot_no}`,
                            lot.total_value, { lot }, creator,
                          );
                          if (docId) setAcceptanceLots(prev => prev.map(l => l.id===lot.id ? {...l,status:'submitted'} : l));
                        }} className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-lg hover:bg-blue-100">
                          Gửi duyệt
                        </button>
                      )}
                      {lot.status==="submitted" && (() => {
                        const doc = findEngineDoc(lot.id);
                        const approvable = doc && canApproveDoc(doc, qsCtx);
                        return qsLevel >= 3 && approvable ? (
                          <button onClick={() => {
                            if (doc) triggerApproval(doc.id, lot.id, 'ACCEPTANCE', (fa) => {
                              if (fa) setAcceptanceLots(p => p.map(l => l.id===lot.id ? {...l, status:'approved', approved_by: currentRole} : l));
                            });
                          }} className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-lg hover:bg-emerald-100">
                            Phê duyệt
                          </button>
                        ) : qsLevel >= 3 ? (
                          <span className="text-[9px] text-rose-600 px-2 py-1 bg-rose-50 rounded-lg">↑ Cần PM/GĐ</span>
                        ) : (
                          <span className="text-[9px] text-amber-600 px-2 py-1 bg-amber-50 rounded-lg">⏳ Chờ duyệt</span>
                        );
                      })()}
                      <button onClick={() => setExpandedLotId(prev => prev === lot.id ? null : lot.id)}
                        className="px-2 py-1 bg-slate-50 text-slate-600 text-[10px] font-bold rounded-lg hover:bg-slate-100 flex items-center gap-1">
                        {expandedLotId === lot.id ? <ChevronUp size={10}/> : <ChevronDown size={10}/>}
                        {expandedLotId === lot.id ? 'Thu gọn' : 'Xem chi tiết'}
                      </button>
                      <button className="px-2 py-1 bg-slate-50 text-slate-500 text-[10px] font-bold rounded-lg hover:bg-slate-100 flex items-center gap-1"><Printer size={10}/>In BB</button>
                    </div>
                  </div>
                </div>
                {/* Items mini table — collapsible */}
                {expandedLotId === lot.id && <div className="border-t border-slate-100 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-slate-50">{["Mã","Hạng mục","KL NT","ĐV","Đơn giá","Giá trị"].map(h=><th key={h} className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase text-left">{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-slate-50">
                      {lot.items.map(li=>{
                        const bi = nonChapter.find(b=>b.id===li.boq_id);
                        if(!bi) return null;
                        return (
                          <tr key={li.boq_id} className="hover:bg-slate-50">
                            <td className="px-3 py-1.5 font-mono text-slate-500">{bi.code}</td>
                            <td className="px-3 py-1.5 text-slate-700">{bi.name}</td>
                            <td className="px-3 py-1.5 text-right font-medium">{fmt(li.qty)}</td>
                            <td className="px-3 py-1.5 text-slate-400">{bi.unit}</td>
                            <td className="px-3 py-1.5 text-right text-slate-500">{fmt(bi.unit_price)}</td>
                            <td className="px-3 py-1.5 text-right font-semibold text-emerald-600">{fmtB(li.qty*bi.unit_price)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot><tr className="bg-slate-50"><td colSpan={5} className="px-3 py-2 font-bold text-slate-700 text-right">CỘNG</td><td className="px-3 py-2 font-bold text-emerald-700 text-right">{fmtB(lot.total_value)}</td></tr></tfoot>
                  </table>
                </div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════ TAB: PAYMENT ════════════════════════════════════ */}
      {activeTab==="payment" && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {label:"Đề nghị TT",v:payments.length,cls:"bg-slate-100 text-slate-700"},
              {label:"Đã thanh toán",v:payments.filter(p=>p.status==="paid").length,cls:"bg-emerald-100 text-emerald-700"},
              {label:"Đã duyệt chờ TT",v:payments.filter(p=>p.status==="approved").length,cls:"bg-amber-100 text-amber-700"},
              {label:"Nháp",v:payments.filter(p=>p.status==="draft").length,cls:"bg-slate-100 text-slate-600"},
            ].map(s=>(
              <div key={s.label} className={`px-4 py-3 rounded-2xl flex items-center justify-between ${s.cls} border`} style={{borderColor:"transparent"}}>
                <span className="text-xs font-semibold">{s.label}</span>
                <span className="text-2xl font-bold">{s.v}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500">Tổng đã thu: <span className="font-bold text-emerald-700">{fmtB(totalPaid)}</span> · Còn phải thu: <span className="font-bold text-amber-700">{fmtB(totalContract - totalPaid)}</span></p>
            <button onClick={()=>setShowNewPayment(true)} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 shadow-sm">
              <Plus size={14}/> Lập đề nghị thanh toán
            </button>
          </div>

          {/* Payment list */}
          <div className="space-y-3">
            {enrichedPayments.map(pay=>(
              <div key={pay.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden hover:shadow-md transition-all ${pay.status==="paid"?"border-emerald-200":pay.status==="approved"?"border-amber-200":pay.status==="submitted"?"border-blue-200":"border-slate-200"}`}>
                <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className={`p-2.5 rounded-xl shrink-0 ${pay.status==="paid"?"bg-emerald-50":pay.status==="approved"?"bg-amber-50":pay.status==="submitted"?"bg-blue-50":"bg-slate-100"}`}>
                      <DollarSign size={18} className={pay.status==="paid"?"text-emerald-600":pay.status==="approved"?"text-amber-600":pay.status==="submitted"?"text-blue-600":"text-slate-400"}/>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800">{pay.request_no}</span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${PAYMENT_STATUS[pay.status].cls}`}>{PAYMENT_STATUS[pay.status].label}</span>
                        <span className="text-xs text-slate-400">{pay.period}</span>
                      </div>
                      {pay.note&&<p className="text-xs text-slate-500 mt-0.5">{pay.note}</p>}
                      <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-2"><Calendar size={9}/>{pay.date} · {pay.lot_ids.length} đợt NT kèm theo</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4 shrink-0 text-center">
                    {[
                      {l:"Giá trị NT",v:fmtB(pay.subtotal),c:"text-slate-700"},
                      {l:"VAT 8%",v:fmtB(pay.vat),c:"text-slate-500"},
                      {l:"Khấu trừ TU",v:`-${fmtB(pay.advance_deduct)}`,c:"text-rose-600"},
                      {l:"Thực nhận",v:fmtB(pay.net_payable),c:"text-emerald-700 font-bold"},
                    ].map(s=>(
                      <div key={s.l}>
                        <div className={`text-sm font-semibold ${s.c}`}>{s.v}</div>
                        <div className="text-[9px] text-slate-400 mt-0.5">{s.l}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action row */}
                <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex gap-2">
                    {pay.status==="draft" && (
                      <button onClick={() => {
                        const creator: UserContext = { userId: `user_qs_site`, roleId: 'qs_site' as any };
                        const docId = submitQSDoc(
                          pay.id, 'PAYMENT_REQUEST', `Yêu cầu TT — ${pay.request_no} (${pay.period})`,
                          pay.net_payable, { pay }, creator,
                        );
                        if (docId) setPayments(prev => prev.map(p => p.id===pay.id ? {...p,status:'submitted'} : p));
                      }} className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-lg hover:bg-blue-100">
                        Gửi CĐT/TVGS
                      </button>
                    )}
                    {pay.status==="submitted" && (() => {
                      const doc = findEngineDoc(pay.id);
                      const approvable = doc && canApproveDoc(doc, qsCtx);
                      return qsLevel >= 3 && approvable ? (
                        <button onClick={() => {
                          if (doc) triggerApproval(doc.id, pay.id, 'PAYMENT', (fa) => {
                            if (fa) setPayments(p => p.map(x => x.id===pay.id ? {...x, status:'approved'} : x));
                          });
                        }} className="px-3 py-1 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-lg hover:bg-amber-100">
                          Phê duyệt
                        </button>
                      ) : qsLevel >= 3 ? (
                        <span className="text-[9px] text-rose-600 px-2 py-1 bg-rose-50 rounded-lg">↑ Cần PM/GĐ</span>
                      ) : (
                        <span className="text-[9px] text-amber-600 px-2 py-1 bg-amber-50 rounded-lg">⏳ Chờ duyệt</span>
                      );
                    })()}
                    {pay.status==="approved" && (
                      <button onClick={() => setPayments(prev=>prev.map(p=>p.id===pay.id?{...p,status:'paid'}:p))}
                        className="px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-lg hover:bg-emerald-100">
                        Xác nhận đã TT
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setExpandedPayId(prev => prev === pay.id ? null : pay.id)}
                      className="flex items-center gap-1 px-3 py-1 text-slate-500 text-[10px] font-bold hover:bg-slate-100 rounded-lg border border-slate-200">
                      {expandedPayId === pay.id ? <ChevronUp size={10}/> : <ChevronDown size={10}/>}
                      {expandedPayId === pay.id ? 'Thu gọn' : 'Xem chi tiết'}
                    </button>
                    <button onClick={() => printQSPayment({
                      payment: {
                        id: pay.id,
                        title: pay.title,
                        period: pay.period || '',
                        contract_value: pay.contract_value || 0,
                        completed_pct: pay.completed_pct || 0,
                        prev_claimed: pay.prev_claimed || 0,
                        this_claim: pay.amount || 0,
                        retention_pct: pay.retention_pct || 5,
                        net_payable: pay.net_payable || (pay.amount || 0) * 0.95,
                        notes: pay.note || '',
                      },
                      projectName: projectName || 'Dự án',
                      contractorName: pay.contractor || '',
                    })} className="flex items-center gap-1 px-3 py-1 text-teal-600 text-[10px] font-bold hover:bg-teal-50 rounded-lg border border-teal-200"><Printer size={10}/>In hồ sơ TT</button>
                    <button className="flex items-center gap-1 px-3 py-1 text-slate-500 text-[10px] font-bold hover:bg-slate-200 rounded-lg"><Download size={10}/>Xuất Excel</button>
                  </div>
                </div>

                {/* Detail panel */}
                {expandedPayId === pay.id && (
                  <div className="px-5 pb-5 pt-2 border-t border-slate-100 bg-slate-50/50 space-y-4 animate-in fade-in duration-200">
                    {/* Status timeline */}
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400 mb-3">Trạng thái hồ sơ</p>
                      <div className="flex items-center gap-0">
                        {(['draft','submitted','approved','paid'] as const).map((st, idx) => {
                          const statusOrder = {draft:0, submitted:1, approved:2, paid:3};
                          const currentIdx = statusOrder[pay.status];
                          const done = idx <= currentIdx;
                          const labels = {draft:'Nháp', submitted:'Đã gửi', approved:'Đã duyệt', paid:'Đã TT'};
                          const colors = {draft:'slate', submitted:'blue', approved:'amber', paid:'emerald'};
                          const c = colors[st];
                          return (
                            <React.Fragment key={st}>
                              <div className="flex flex-col items-center">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${done ? `bg-${c}-500 border-${c}-500 text-white` : 'bg-white border-slate-200 text-slate-300'}`}>
                                  {done ? <Check size={12}/> : idx+1}
                                </div>
                                <span className={`text-[9px] mt-1 font-semibold ${done ? `text-${c}-600` : 'text-slate-300'}`}>{labels[st]}</span>
                              </div>
                              {idx < 3 && <div className={`flex-1 h-0.5 mb-4 ${idx < currentIdx ? 'bg-emerald-400' : 'bg-slate-200'}`}/>}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>

                    {/* Payment breakdown */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        {l:'Giá trị NT', v: fmtB(pay.subtotal), c:'text-slate-700'},
                        {l:'VAT 8%', v: fmtB(pay.vat), c:'text-slate-500'},
                        {l:'Khấu trừ TU', v: `-${fmtB(pay.advance_deduct)}`, c:'text-rose-600'},
                        {l:'Thực nhận', v: fmtB(pay.net_payable), c:'text-emerald-700 font-bold text-lg'},
                      ].map(r => (
                        <div key={r.l} className="bg-white rounded-xl border border-slate-200 p-3 text-center">
                          <div className={`text-base font-bold ${r.c}`}>{r.v}</div>
                          <div className="text-[9px] text-slate-400 mt-0.5 uppercase font-semibold">{r.l}</div>
                        </div>
                      ))}
                    </div>

                    {/* Attached lots */}
                    {pay.lots && pay.lots.length > 0 && (
                      <div>
                        <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Biên bản nghiệm thu kèm theo ({pay.lots.length})</p>
                        <div className="space-y-2">
                          {pay.lots.map(lot => (
                            <div key={lot.id} className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 flex justify-between items-center">
                              <div>
                                <span className="text-sm font-semibold text-slate-700">{lot.lot_no}</span>
                                {lot.note && <span className="text-xs text-slate-400 ml-2">— {lot.note}</span>}
                                <p className="text-[10px] text-slate-400 mt-0.5">{lot.date}</p>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-bold text-emerald-700">{fmtB(lot.total_value)}</div>
                                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${ACCEPT_STATUS[lot.status]?.cls || 'bg-slate-100 text-slate-500'}`}>
                                  {ACCEPT_STATUS[lot.status]?.label || lot.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {pay.note && (
                      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-xs text-blue-700">
                        <span className="font-bold">Ghi chú: </span>{pay.note}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════ TAB: EVM ═════════════════════════════════════════ */}
      {activeTab==="evm" && (
        <div className="space-y-5 animate-in fade-in duration-300">

          {/* EVM KPI */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              {label:"BAC",desc:"Ngân sách hoàn thành",value:fmtB(BAC),cls:"bg-slate-800 text-white"},
              {label:"PV",desc:"Giá trị kế hoạch",value:fmtB(PV),cls:"bg-blue-600 text-white"},
              {label:"EV",desc:"Giá trị đạt được",value:fmtB(EV),cls:"bg-emerald-600 text-white"},
              {label:"AC",desc:"Chi phí thực tế",value:fmtB(AC),cls:"bg-amber-500 text-white"},
              {label:"SPI",desc:"Chỉ số tiến độ",value:SPI.toFixed(2),cls:SPI>=1?"bg-emerald-100 text-emerald-800":"bg-rose-100 text-rose-800"},
              {label:"CPI",desc:"Chỉ số chi phí",value:CPI.toFixed(2),cls:CPI>=1?"bg-emerald-100 text-emerald-800":"bg-rose-100 text-rose-800"},
            ].map(k=>(
              <div key={k.label} className={`rounded-2xl p-4 ${k.cls} border border-transparent`}>
                <div className="text-2xl font-bold">{k.value}</div>
                <div className="text-[10px] font-black uppercase opacity-80 mt-0.5">{k.label}</div>
                <div className="text-[9px] opacity-60 mt-0.5">{k.desc}</div>
              </div>
            ))}
          </div>

          {/* EVM gauges */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* SPI/CPI interpretation */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h3 className="font-bold text-slate-800 mb-5 flex items-center gap-2"><Target size={16} className="text-blue-600"/>Phân tích chỉ số</h3>
              <div className="space-y-4">
                {[
                  { label:"SPI (Tiến độ)", value:SPI, good:"≥ 1.0 = Đúng/Vượt tiến độ", bad:"< 1.0 = Chậm tiến độ" },
                  { label:"CPI (Chi phí)", value:CPI, good:"≥ 1.0 = Chi phí hiệu quả", bad:"< 1.0 = Chi phí vượt" },
                ].map(ind=>{
                  const isGood = ind.value >= 1.0;
                  const pctVal = Math.min(Math.max(ind.value, 0), 2) * 50;
                  return (
                    <div key={ind.label}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-semibold text-slate-700">{ind.label}</span>
                        <div className={`flex items-center gap-1.5 text-sm font-bold px-3 py-1 rounded-xl ${isGood?"bg-emerald-50 text-emerald-700":"bg-rose-50 text-rose-700"}`}>
                          {isGood?<TrendingUp size={13}/>:<TrendingDown size={13}/>}
                          {ind.value.toFixed(2)}
                        </div>
                      </div>
                      <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden">
                        {/* center line at 50% */}
                        <div className="absolute top-0 left-1/2 h-full w-0.5 bg-slate-300 z-10"/>
                        <div className={`absolute top-0 left-0 h-full rounded-full transition-all duration-700 ${isGood?"bg-emerald-500":"bg-rose-500"}`}
                          style={{width:`${pctVal}%`}}/>
                      </div>
                      <div className="flex justify-between text-[9px] text-slate-400 mt-1">
                        <span>0 — Rất xấu</span><span>1.0 — Đạt chuẩn</span><span>2.0</span>
                      </div>
                      <p className={`text-[10px] mt-1 font-medium ${isGood?"text-emerald-600":"text-rose-500"}`}>{isGood?ind.good:ind.bad}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Forecast */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h3 className="font-bold text-slate-800 mb-5 flex items-center gap-2"><Calculator size={16} className="text-blue-600"/>Dự báo hoàn thành</h3>
              <div className="space-y-3">
                {[
                  {label:"BAC — Ngân sách ban đầu",value:fmtB(BAC),note:"Giá trị hợp đồng",icon:<Layers size={14}/>,cls:"text-slate-700"},
                  {label:"EAC — Dự báo tổng chi phí",value:fmtB(EAC),note:`= BAC / CPI = BAC / ${CPI.toFixed(2)}`,icon:<TrendingUp size={14}/>,cls:EAC>BAC*1.05?"text-rose-700":EAC>BAC?"text-amber-700":"text-emerald-700"},
                  {label:"ETC — Chi phí còn lại",value:fmtB(ETC),note:"Cần chi thêm để hoàn thành",icon:<Clock size={14}/>,cls:"text-blue-700"},
                  {label:"VAC — Chênh lệch dự báo",value:`${VAC>=0?"+":""}${fmtB(VAC)}`,note:VAC>=0?"Dự kiến tiết kiệm được":"Dự kiến vượt ngân sách",icon:VAC>=0?<TrendingUp size={14}/>:<TrendingDown size={14}/>,cls:VAC>=0?"text-emerald-700":"text-rose-700"},
                ].map(row=>(
                  <div key={row.label} className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className="text-slate-400 shrink-0">{row.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700">{row.label}</p>
                      <p className="text-[10px] text-slate-400">{row.note}</p>
                    </div>
                    <div className={`text-base font-bold ${row.cls} text-right shrink-0`}>{row.value}</div>
                  </div>
                ))}
              </div>
              <div className={`mt-4 p-3 rounded-xl border text-xs font-medium flex items-start gap-2 ${VAC>=0?"bg-emerald-50 border-emerald-100 text-emerald-800":"bg-rose-50 border-rose-100 text-rose-800"}`}>
                <Info size={13} className="shrink-0 mt-0.5"/>
                {VAC>=0
                  ? `GEM dự báo dự án hoàn thành trong ngân sách, tiết kiệm khoảng ${fmtB(VAC)}. CPI = ${CPI.toFixed(2)} cho thấy hiệu quả chi phí tốt.`
                  : `⚠️ Cảnh báo: Dự án có nguy cơ vượt ngân sách ~${fmtB(Math.abs(VAC))}. CPI = ${CPI.toFixed(2)} < 1.0 — Anh cần rà soát lại đơn giá và phương án thi công.`
                }
              </div>
            </div>
          </div>

          {/* Full S-curve */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><TrendingUp size={16} className="text-blue-600"/>Đường cong S — PV / EV / AC (%)</h3>
              <div className="flex gap-3 text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-blue-500 inline-block rounded"/>Kế hoạch (PV)</span>
                <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-emerald-500 inline-block rounded"/>Thực hiện (EV)</span>
                <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-amber-400 inline-block rounded" style={{borderStyle:"dashed"}}/>Chi phí (AC)</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280} minWidth={0}>
              <AreaChart data={S_CURVE_DATA} margin={{top:5,right:20,left:-5,bottom:0}}>
                <defs>
                  <linearGradient id="gPV2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.12}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gEV2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.12}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="month" tick={{fontSize:11}} tickLine={false} axisLine={false}/>
                <YAxis tick={{fontSize:11}} tickLine={false} axisLine={false} unit="%" domain={[0,105]}/>
                <Tooltip
                  formatter={(v:any,name:string)=>[v!=null?`${v}%`:"—",name]}
                  contentStyle={{borderRadius:"12px",border:"1px solid #e2e8f0",fontSize:12,boxShadow:"0 4px 20px rgba(0,0,0,0.08)"}}
                />
                <ReferenceLine x="T3/26" stroke="#6b7280" strokeDasharray="4 3" label={{value:"Hôm nay",position:"insideTopRight",fontSize:10,fill:"#6b7280"}}/>
                <Area type="monotone" dataKey="pv" name="Kế hoạch (PV)" stroke="#3b82f6" strokeWidth={2.5} fill="url(#gPV2)" connectNulls={false}/>
                <Area type="monotone" dataKey="ev" name="Thực hiện (EV)" stroke="#10b981" strokeWidth={2.5} fill="url(#gEV2)" connectNulls={false}/>
                <Area type="monotone" dataKey="ac" name="Chi phí (AC)" stroke="#f59e0b" strokeWidth={2} fill="none" strokeDasharray="5 3" connectNulls={false}/>
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              {[
                {l:"Schedule Variance (SV)",v:`${EV-PV>=0?"+":""}${fmtB(EV-PV)}`,c:EV-PV>=0?"text-emerald-600":"text-rose-600"},
                {l:"Cost Variance (CV)",v:`${EV-AC>=0?"+":""}${fmtB(EV-AC)}`,c:EV-AC>=0?"text-emerald-600":"text-rose-600"},
                {l:"% Hoàn thành",v:`${pct(EV,BAC)}%`,c:"text-blue-600"},
              ].map(s=>(
                <div key={s.l} className="bg-slate-50 rounded-xl p-3">
                  <div className={`text-lg font-bold ${s.c}`}>{s.v}</div>
                  <div className="text-[10px] text-slate-400">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ TAB: SUBCONTRACTOR ════════════════════════════ */}
      {activeTab==="subcontractor" && (
        <SubcontractorTab projectId={projectId} boqItems={boqItems} acceptanceLots={acceptanceLots} payments={payments} />
      )}
      {activeTab==="variation" && (
        <VariationOrdersTab
          fmtB={fmtB} fmt={fmt}
          projectId={projectId}
          qsCtx={qsCtx}
          qsLevel={qsLevel}
          submitQSDoc={submitQSDoc}
          findEngineDoc={findEngineDoc}
          triggerApproval={triggerApproval}
          onVOApprovedRef={onVOApprovedRef}
        />
      )}

      {/* ── PIN Modal — QS Approve (APPROVE / R_A steps only) ── */}
      {pinModal && (() => {
        const modalVoucher = pinModal;
        const handleConfirm = () => {
          if (pinValue.length < 4) return;
          const res = approveQSDoc(modalVoucher.docId, pinValue);
          if (res.ok) {
            pendingApprovalCallbackRef.current?.(res.fullyApproved);
            pendingApprovalCallbackRef.current = null;
            setTimeout(() => { setPinModal(null); setPinValue(''); }, 1400);
          }
        };
        return (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs mx-4 overflow-hidden">
              <div className="bg-slate-900 px-5 py-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                  <Lock size={14} className="text-white"/>
                </div>
                <div>
                  <p className="text-white font-bold text-sm">Xác thực PIN</p>
                  <p className="text-slate-400 text-[10px]">
                    {modalVoucher.type === 'VO' ? 'Phê duyệt Variation Order'
                      : modalVoucher.type === 'ACCEPTANCE' ? 'Phê duyệt Biên bản nghiệm thu'
                      : 'Phê duyệt Yêu cầu thanh toán'}
                  </p>
                </div>
              </div>
              <div className="p-5 space-y-4">
                {approvalMsg && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs text-emerald-700 font-semibold">
                    {approvalMsg}
                  </div>
                )}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nhập PIN (4-6 số)</label>
                  <input
                    type="password" inputMode="numeric" maxLength={6}
                    value={pinValue}
                    onChange={e => { setPinValue(e.target.value); setPinError(''); }}
                    onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); }}
                    autoFocus
                    className="w-full mt-1 text-center text-2xl font-mono tracking-[0.5em] border-2 border-slate-200 focus:border-blue-400 rounded-xl px-3 py-3 focus:outline-none"
                    placeholder="••••"
                  />
                  {pinError && <p className="text-xs text-rose-600 mt-1.5 font-semibold">{pinError}</p>}
                </div>
              </div>
              <div className="px-5 pb-5 flex gap-2">
                <button onClick={() => { setPinModal(null); setPinValue(''); setPinError(''); pendingApprovalCallbackRef.current = null; }}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl">
                  Hủy
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={pinValue.length < 4}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl">
                  Xác nhận duyệt
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      {printComponent}

      {/* ── MODALS — DESIGN_SYSTEM: always at end of component ── */}

      {/* ── MODALS — end of component per DESIGN_SYSTEM ── */}

      {/* New payment form */}
      <ModalForm
        open={showNewPayment}
        onClose={() => { setShowNewPayment(false); setSelectedLotIds([]); }}
        title="Đề nghị Thanh toán (YCTT)"
        subtitle="Lập yêu cầu thanh toán kèm biên bản nghiệm thu đã duyệt"
        icon={<DollarSign size={18}/>}
        color="blue"
        width="lg"
        footer={<>
          <BtnCancel onClick={() => { setShowNewPayment(false); setSelectedLotIds([]); }} />
          <BtnSubmit label="Lưu đề nghị TT" color="blue" onClick={saveNewPayment} />
        </>}
      >
        <FormSection title="Hồ sơ đính kèm">
          <FormFileUpload files={[]} onChange={() => {}} accept=".pdf,.docx,.xlsx,.jpg" maxFiles={5} label="Hồ sơ đề nghị thanh toán"/>
        </FormSection>
        <FormSection title="Thông tin chung">
          <FormGrid cols={2}>
            <FormRow label="Người lập YCTT" required><input className={inputCls} placeholder="Họ tên người lập" /></FormRow>
            <FormRow label="Chức vụ"><input className={inputCls} placeholder="VD: QS site, Kế toán" /></FormRow>
            <FormRow label="Tài khoản nhận"><input className={inputCls} placeholder="Số tài khoản ngân hàng" /></FormRow>
            <FormRow label="Ngân hàng"><input className={inputCls} placeholder="Tên ngân hàng" /></FormRow>
          </FormGrid>
        </FormSection>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Kỳ thanh toán</label>
              <input value={payPeriod} onChange={e=>setPayPeriod(e.target.value)} placeholder="VD: Tháng 03/2026"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500"/>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Khấu trừ tạm ứng (VNĐ)</label>
              <input value={advanceDeduct} onChange={e=>setAdvanceDeduct(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500"/>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Kèm theo biên bản nghiệm thu (đã duyệt)</label>
            <div className="space-y-2 max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-2">
              {enrichedLots.filter(l=>l.status==="approved").map(lot=>{
                const selected = selectedLotIds.includes(lot.id);
                return (
                  <label key={lot.id} className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${selected?"bg-emerald-50 border border-emerald-100":"hover:bg-slate-50"}`}>
                    <input type="checkbox" checked={selected} onChange={e=>{
                      if(e.target.checked) setSelectedLotIds(prev=>[...prev,lot.id]);
                      else setSelectedLotIds(prev=>prev.filter(id=>id!==lot.id));
                    }} className="accent-emerald-600"/>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-700">{lot.lot_no} — {lot.note}</p>
                      <p className="text-[10px] text-slate-400">{lot.date} · {fmtB(lot.total_value)}</p>
                    </div>
                    <span className="font-bold text-emerald-600 text-sm">{fmtB(lot.total_value)}</span>
                  </label>
                );
              })}
              {enrichedLots.filter(l=>l.status==="approved").length===0&&<p className="text-xs text-slate-400 text-center py-4">Chưa có biên bản nghiệm thu nào được duyệt</p>}
            </div>
          </div>
          {selectedLotIds.length > 0 && (
            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
              {(()=>{
                const sub = selectedLotIds.reduce((s,lid)=>{const l=enrichedLots.find(x=>x.id===lid);return s+(l?.total_value||0);},0);
                const vat = sub*0.08; const total = sub+vat;
                const net = total - (Number(advanceDeduct.replace(/\D/g,""))||0);
                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                    {[{l:"Giá trị NT",v:fmtB(sub)},{l:"VAT 8%",v:fmtB(vat)},{l:"Cộng",v:fmtB(total)},{l:"Thực nhận",v:fmtB(net),bold:true}].map(r=>(
                      <div key={r.l}><div className={`text-base font-bold ${r.bold?"text-emerald-700":"text-slate-800"}`}>{r.v}</div><div className="text-[10px] text-slate-400">{r.l}</div></div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Ghi chú</label>
            <textarea value={payNote} onChange={e=>setPayNote(e.target.value)} rows={2} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 resize-none" placeholder="Ghi chú đề nghị thanh toán..."/>
          </div>
      </ModalForm>

    </div>
  );
}
