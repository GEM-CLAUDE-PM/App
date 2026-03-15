import { useNotification } from './NotificationEngine';
import React, { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, Folder, TrendingUp, Clock, HardDrive, CheckCircle2, Lock, FileText, Image as ImageIcon, Files, ClipboardList, ExternalLink, BookOpen, UploadCloud, Loader2, Plus, Printer, Users, HardHat, Camera, ShieldAlert, Sun, MessageCircle, Network, HeartPulse, AlertTriangle, Mic, Edit3, Unlock, X, Award, Target, GraduationCap, Briefcase, ChevronRight, ArrowRight, Building2, CheckCircle, CircleDashed, ArrowLeft, ChevronDown, Cloud, Download, Eye, MoreVertical, ChevronLeft, Calendar, ShieldCheck, Trash2, Sparkles, User, Info, ChevronUp, Wrench, Truck, Fuel, Activity, Zap, Settings, AlertCircle, Search, Scan, FileSpreadsheet, Save, Calculator, Copy, Package } from 'lucide-react';
import { genAI, GEM_MODEL, GEM_MODEL_QUALITY } from './gemini';
import { createDocument, submitDocument, getApprovalQueue, type ApprovalDoc } from './approvalEngine';
import { WORKFLOWS, type UserContext } from './permissions';
import { getCurrentCtx } from './projectMember';
import ApprovalQueue from './ApprovalQueue';

import type { DashboardProps } from './types';

type Props = DashboardProps & {
  currentRole:      string;
  canSeeFullValues: boolean;
  contractUnlocked: boolean;
  writeAuditLog:    (action: string, detail: string) => void;
  onManualLock:     () => void;
  SESSION_KEY:      string;
};

export default function ContractDashboard({ project: selectedProject, currentRole, canSeeFullValues, contractUnlocked, writeAuditLog, onManualLock, SESSION_KEY }: Props) {
  const ROLE_LABELS: Record<string,string> = { giam_doc:'Giám đốc DA', ke_toan:'Kế toán', chi_huy_truong:'Chỉ huy trưởng', giam_sat:'Giám sát QA/QC' };
  const pid         = selectedProject?.id ?? 'p1';
  const projectName = selectedProject?.name ?? 'Dự án';
  const ctx         = getCurrentCtx(pid);
  const { ok: notifOk, err: notifErr, warn: notifWarn, info: notifInfo } = useNotification();
  const [approvalPending, setApprovalPending] = React.useState(() =>
    getApprovalQueue(pid, ctx).length
  );
  const [showApprovalPanel, setShowApprovalPanel] = React.useState(false);
  const [printContract, setPrintContract] = React.useState<any>(null);
  const [contractApprovalQueue, setContractApprovalQueue] = React.useState<ApprovalDoc[]>(() => getApprovalQueue(pid, ctx));

  const refreshContractQueue = React.useCallback(() => {
    const q = getApprovalQueue(pid, ctx);
    setContractApprovalQueue(q);
    setApprovalPending(q.length);
  }, [pid]);

  const submitForApproval = (docType: 'CONTRACT_AMENDMENT' | 'SUBCONTRACT_PAYMENT', title: string, amount: number, ref: string) => {
    const cr = createDocument({ projectId: pid, docType, ctx, title, amount, data: { ref } });
    if (!cr.ok) { alert('❌ ' + (cr as any).error); return; }
    submitDocument(pid, cr.data!.id, ctx);
    refreshContractQueue();
    const el = document.createElement('div');
    el.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] bg-slate-800 text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-2xl';
    el.textContent = '✅ ' + docType + ' "' + title + '" đã nộp duyệt';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  };
  const AUDIT_KEY = 'gem_contract_audit';
  const SESSION_TTL = 15 * 60 * 1000;
  const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);
  React.useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h); return () => window.removeEventListener('resize', h);
  }, []);

  return (
    <>
    {!contractUnlocked
      ? (
          <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-300">
            <div className="w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center mb-6 shadow-lg">
              <Lock size={36} className="text-white"/>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Khu vực bảo mật</h2>
            <p className="text-sm text-slate-500 text-center max-w-xs leading-relaxed mb-8">
              Tab Hợp đồng chứa thông tin tài chính và pháp lý nhạy cảm của dự án. Xác thực để tiếp tục.
            </p>
            <button onClick={() => setShowPinDialog(true)}
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-semibold transition-all shadow-lg hover:shadow-xl active:scale-95">
              <Lock size={16}/> Nhập mã PIN để mở
            </button>
            <p className="text-[10px] text-slate-400 mt-4">Phiên làm việc: 15 phút · Vai trò: {ROLE_LABELS[currentRole]}</p>
          </div>
        )
      : (() => {

      // ── Audit log: ghi lại lần xem này ───────────────────────────────────
      // (chỉ ghi 1 lần mỗi lần render tab, dùng useEffect-style hack)
      const _auditOnce = React.useRef(false);
      if (!_auditOnce.current) {
        _auditOnce.current = true;
        // Defer để tránh setState-in-render
        setTimeout(() => writeAuditLog('VIEW', `Xem danh sách Hợp đồng — vai trò: ${ROLE_LABELS[currentRole]}`), 0);
      }

      // ── Types ──────────────────────────────────────────────────────────────
      type ContractType = 'main'|'subcontractor'|'supplier'|'equipment'|'consultant';
      type ContractStatus = 'active'|'draft'|'suspended'|'completed'|'disputed';
      interface Guarantee { type:'performance'|'advance'|'warranty'; value:number; expiry:string; }
      interface PaymentSchedule { milestone:string; pct:number; amount:number; status:'paid'|'pending'|'overdue'; date:string; }
      interface Contract {
        id:string; type:ContractType; code:string; name:string; party:string; party_type:string;
        value:number; signed_date:string; start_date:string; end_date:string;
        payment_terms:string; paid_amount:number; retention_pct:number;
        guarantees:Guarantee[]; payment_schedule:PaymentSchedule[];
        linked_module:string; linked_id?:string;
        status:ContractStatus; progress?:number;
        gem_risk?:string; docs:string[];
      }

      // ── Mock contracts ─────────────────────────────────────────────────────
      const MOCK_CONTRACTS:Contract[] = [
        {
          id:'c1', type:'main', code:'HĐ-2026-001', name:'Hợp đồng Tổng thầu EPC',
          party:'CĐT Nguyễn Văn An', party_type:'Chủ đầu tư',
          value:120000, signed_date:'01/01/2026', start_date:'01/01/2026', end_date:'31/12/2026',
          payment_terms:'Theo tiến độ: 30% khởi công, 40% khi đạt 50% KL, 30% nghiệm thu',
          paid_amount:42000, retention_pct:5, progress:35,
          guarantees:[
            { type:'performance', value:6000, expiry:'31/01/2027' },
            { type:'advance',     value:3600, expiry:'30/06/2026' },
          ],
          payment_schedule:[
            { milestone:'Tạm ứng khởi công (30%)', pct:30, amount:36000, status:'paid',    date:'05/01/2026' },
            { milestone:'Đợt 1 — hoàn thành móng', pct:20, amount:24000, status:'paid',    date:'15/02/2026' },
            { milestone:'Đợt 2 — thân nhà 50%',    pct:20, amount:24000, status:'pending', date:'30/04/2026' },
            { milestone:'Đợt 3 — hoàn thiện',      pct:20, amount:24000, status:'pending', date:'30/09/2026' },
            { milestone:'Nghiệm thu bàn giao (5%+ bảo lưu)', pct:10, amount:12000, status:'pending', date:'31/12/2026' },
          ],
          linked_module:'qs', status:'active',
          gem_risk:'Bảo lãnh tạm ứng hết hạn 30/06/2026 — cần gia hạn hoặc hoàn ứng trước thời điểm này.',
          docs:['HĐ-2026-001.pdf','PL01-Đơn giá.pdf','BL-Thực hiện.pdf'],
        },
        {
          id:'c2', type:'subcontractor', code:'HĐ-NTP-001', name:'HĐ NTP Sắt thép & Ván khuôn',
          party:'Công ty Phúc Thành', party_type:'Nhà thầu phụ',
          value:8500, signed_date:'10/01/2026', start_date:'15/01/2026', end_date:'30/09/2026',
          payment_terms:'Khoán gọn theo hạng mục — nghiệm thu khối lượng từng đợt',
          paid_amount:3200, retention_pct:5, progress:38,
          guarantees:[{ type:'performance', value:850, expiry:'30/10/2026' }],
          payment_schedule:[
            { milestone:'Tạm ứng (20%)',        pct:20, amount:1700, status:'paid',    date:'20/01/2026' },
            { milestone:'Đợt 1 — móng hoàn thành', pct:30, amount:2550, status:'paid', date:'28/02/2026' },
            { milestone:'Đợt 2 — thân nhà T1-3',   pct:30, amount:2550, status:'pending', date:'30/05/2026' },
            { milestone:'Hoàn công + bảo lưu',      pct:20, amount:1700, status:'pending', date:'30/09/2026' },
          ],
          linked_module:'qs', linked_id:'sub-pt', status:'active',
          gem_risk:'Tiến độ NTP chậm ~2 tuần so với lịch. Cần xác nhận nhân lực tổ sắt tuần tới.',
          docs:['HĐ-NTP-001.pdf','BB-Khởi công.pdf'],
        },
        {
          id:'c3', type:'subcontractor', code:'HĐ-NTP-002', name:'HĐ NTP Hệ thống M&E',
          party:'Công ty Điện Lạnh Minh Khoa', party_type:'Nhà thầu phụ',
          value:6200, signed_date:'05/02/2026', start_date:'01/03/2026', end_date:'30/11/2026',
          payment_terms:'Theo tiến độ thực tế — nghiệm thu từng hạng mục',
          paid_amount:620, retention_pct:5, progress:10,
          guarantees:[{ type:'performance', value:620, expiry:'31/12/2026' }],
          payment_schedule:[
            { milestone:'Tạm ứng (10%)',    pct:10, amount:620,  status:'paid',    date:'05/03/2026' },
            { milestone:'Đợt 1 — Hạ tầng', pct:40, amount:2480, status:'pending', date:'30/06/2026' },
            { milestone:'Đợt 2 — Hoàn thiện', pct:40, amount:2480, status:'pending', date:'30/10/2026' },
            { milestone:'Bảo hành + bảo lưu', pct:10, amount:620, status:'pending', date:'30/11/2026' },
          ],
          linked_module:'qs', linked_id:'sub-mk', status:'active',
          docs:['HĐ-NTP-002.pdf'],
        },
        {
          id:'c4', type:'supplier', code:'HĐ-CC-001', name:'HĐ Cung cấp Thép Xây dựng',
          party:'Công ty Thép Hòa Phát', party_type:'Nhà cung cấp',
          value:4200, signed_date:'15/01/2026', start_date:'20/01/2026', end_date:'30/06/2026',
          payment_terms:'Thanh toán 30 ngày sau giao hàng, chiết khấu 2% nếu thanh toán trong 10 ngày',
          paid_amount:2800, retention_pct:0, progress:67,
          guarantees:[],
          payment_schedule:[
            { milestone:'Đợt 1 — 50 tấn thép cuộn',   pct:33, amount:1386, status:'paid',    date:'25/01/2026' },
            { milestone:'Đợt 2 — 80 tấn thép vằn',    pct:40, amount:1680, status:'paid',    date:'20/02/2026' },
            { milestone:'Đợt 3 — 30 tấn thép hình',   pct:27, amount:1134, status:'pending', date:'15/04/2026' },
          ],
          linked_module:'resources', status:'active',
          docs:['HĐ-CC-001.pdf','PL-Đơn giá-thép.xlsx'],
        },
        {
          id:'c5', type:'equipment', code:'HĐ-TB-001', name:'HĐ Thuê Cẩu tháp Liebherr 180EC',
          party:'Công ty Cho thuê TB Thiên Long', party_type:'Nhà cung cấp',
          value:1800, signed_date:'01/01/2026', start_date:'05/01/2026', end_date:'31/08/2026',
          payment_terms:'180 Triệu/tháng — thanh toán trước ngày 5 mỗi tháng',
          paid_amount:540, retention_pct:0, progress:30,
          guarantees:[],
          payment_schedule:[
            { milestone:'T1/2026', pct:17, amount:180, status:'paid',    date:'05/01/2026' },
            { milestone:'T2/2026', pct:17, amount:180, status:'paid',    date:'05/02/2026' },
            { milestone:'T3/2026', pct:17, amount:180, status:'paid',    date:'05/03/2026' },
            { milestone:'T4/2026', pct:17, amount:180, status:'pending', date:'05/04/2026' },
            { milestone:'T5-8/2026', pct:33, amount:720, status:'pending', date:'05/08/2026' },
          ],
          linked_module:'equipment', status:'active',
          gem_risk:'HĐ hết hạn 31/08 — cần xác nhận có gia hạn không trước 31/07 để tránh gián đoạn thi công.',
          docs:['HĐ-TB-001.pdf'],
        },
        {
          id:'c6', type:'consultant', code:'HĐ-TVGS-001', name:'HĐ Tư vấn Giám sát',
          party:'Công ty TVXD Alpha', party_type:'Tư vấn',
          value:480, signed_date:'01/01/2026', start_date:'01/01/2026', end_date:'31/01/2027',
          payment_terms:'40 Triệu/tháng — thanh toán cuối tháng',
          paid_amount:120, retention_pct:10, progress:25,
          guarantees:[],
          payment_schedule:[
            { milestone:'Q1/2026 (3 tháng)', pct:25, amount:120, status:'paid',    date:'31/03/2026' },
            { milestone:'Q2/2026 (3 tháng)', pct:25, amount:120, status:'pending', date:'30/06/2026' },
            { milestone:'Q3/2026 (3 tháng)', pct:25, amount:120, status:'pending', date:'30/09/2026' },
            { milestone:'Q4/2026 + bảo lưu', pct:25, amount:120, status:'pending', date:'31/01/2027' },
          ],
          linked_module:'qa-qc', status:'active',
          docs:['HĐ-TVGS-001.pdf'],
        },
      ];

      // ── Local state ────────────────────────────────────────────────────────
      const [contracts, setContracts] = React.useState<Contract[]>(MOCK_CONTRACTS);
      const [filterType, setFilterType] = React.useState<ContractType|'all'>('all');
      const [filterStatus, setFilterStatus] = React.useState<ContractStatus|'all'>('all');
      const [searchQ, setSearchQ] = React.useState('');
      const [selectedContract, setSelectedContract] = React.useState<Contract|null>(null);
      const [detailTab, setDetailTab] = React.useState<'overview'|'payments'|'guarantees'|'docs'>('overview');
      const [showAddForm, setShowAddForm] = React.useState(false);
      const [gemAnalyzing, setGemAnalyzing] = React.useState(false);
      const [gemResult, setGemResult] = React.useState('');

      // ── Computed ──────────────────────────────────────────────────────────
      const filtered = contracts.filter(c => {
        const matchType   = filterType   === 'all' || c.type   === filterType;
        const matchStatus = filterStatus === 'all' || c.status === filterStatus;
        const matchQ = !searchQ || c.name.toLowerCase().includes(searchQ.toLowerCase())
          || c.party.toLowerCase().includes(searchQ.toLowerCase())
          || c.code.toLowerCase().includes(searchQ.toLowerCase());
        return matchType && matchStatus && matchQ;
      });

      const totalValue    = contracts.reduce((s,c) => s + c.value, 0);
      const totalPaid     = contracts.reduce((s,c) => s + c.paid_amount, 0);
      const alertContracts = contracts.filter(c => c.gem_risk).length;
      const expiringGuarantees = contracts.flatMap(c => c.guarantees).filter(g => {
        const d = g.expiry.split('/').reverse().join('-');
        const diff = (new Date(d).getTime() - Date.now()) / 86400000;
        return diff > 0 && diff <= 45;
      }).length;

      // ── Helpers ──────────────────────────────────────────────────────────
      const typeConfig:Record<ContractType,{label:string;color:string;bg:string;icon:React.ReactNode}> = {
        main:          { label:'Tổng thầu',   color:'text-blue-700',   bg:'bg-blue-50 border-blue-200',    icon:<Building2 size={14}/> },
        subcontractor: { label:'Nhà thầu phụ', color:'text-violet-700', bg:'bg-violet-50 border-violet-200', icon:<HardHat size={14}/> },
        supplier:      { label:'Cung cấp',     color:'text-amber-700',  bg:'bg-amber-50 border-amber-200',   icon:<Package size={14}/> },
        equipment:     { label:'Thuê TB',      color:'text-teal-700',   bg:'bg-teal-50 border-teal-200',     icon:<Truck size={14}/> },
        consultant:    { label:'Tư vấn',       color:'text-emerald-700',bg:'bg-emerald-50 border-emerald-200',icon:<Briefcase size={14}/> },
      };
      const statusConfig:Record<ContractStatus,{label:string;dot:string}> = {
        active:    { label:'Hiệu lực',    dot:'bg-emerald-500' },
        draft:     { label:'Dự thảo',     dot:'bg-slate-400'   },
        suspended: { label:'Tạm dừng',    dot:'bg-amber-500'   },
        completed: { label:'Hoàn thành',  dot:'bg-blue-500'    },
        disputed:  { label:'Tranh chấp',  dot:'bg-rose-500'    },
      };
      const fmt = (n:number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));
      // Field masking — CHT chỉ thấy % không thấy số tiền tuyệt đối
      const maskVal = (n:number, unit='Tr VNĐ') =>
        canSeeFullValues ? `${fmt(n)} ${unit}` : <span className="flex items-center gap-1 text-slate-400 font-normal"><Lock size={10}/> Ẩn theo quyền</span>;
      const maskNum = (n:number) =>
        canSeeFullValues ? fmt(n) : '***';

      // Audit log viewer state
      const [showAuditLog, setShowAuditLog] = React.useState(false);
      const auditLogs: {ts:string;role:string;action:string;detail:string}[] = (() => {
        try { return JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]'); } catch { return []; }
      })();
      const payStatusConfig = {
        paid:    { label:'Đã thanh toán', cls:'bg-emerald-100 text-emerald-700' },
        pending: { label:'Chờ thanh toán', cls:'bg-slate-100 text-slate-600' },
        overdue: { label:'Quá hạn',       cls:'bg-rose-100 text-rose-700' },
      };
      const guaranteeLabel = { performance:'Bảo lãnh thực hiện', advance:'Bảo lãnh tạm ứng', warranty:'Bảo lãnh bảo hành' };

      const handleGemAnalyze = async () => {
        if (!selectedContract) return;
        setGemAnalyzing(true); setGemResult('');
        try {
          const model = genAI.getGenerativeModel({ model: GEM_MODEL,
            systemInstruction:`Bạn là Nàng GEM Siêu Việt — chuyên gia pháp lý hợp đồng xây dựng. Xưng "em", gọi "Anh/Chị". Giọng nữ miền Nam, thân thiện, chuyên nghiệp.` });
          const r = await model.generateContent(
            `Phân tích rủi ro hợp đồng sau:\nTên: ${selectedContract.name}\nGiá trị: ${fmt(selectedContract.value)} Triệu VNĐ\nBên ký: ${selectedContract.party}\nĐiều kiện TT: ${selectedContract.payment_terms}\nTiến độ thanh toán: đã thanh toán ${fmt(selectedContract.paid_amount)}/${fmt(selectedContract.value)} triệu (${Math.round(selectedContract.paid_amount/selectedContract.value*100)}%)\nBảo lãnh: ${selectedContract.guarantees.map(g=>`${guaranteeLabel[g.type]} ${fmt(g.value)}tr hết hạn ${g.expiry}`).join(', ') || 'Không có'}\nHãy phân tích: (1) Rủi ro pháp lý, (2) Rủi ro dòng tiền, (3) Kiến nghị cụ thể. Ngắn gọn, thực tế.`
          );
          setGemResult(r.response.text());
        } catch { setGemResult('Dạ em chưa kết nối được với GEM lúc này, Anh/Chị thử lại sau nhé.'); }
        finally { setGemAnalyzing(false); }
      };

      // ── Contract Detail Panel ──────────────────────────────────────────────
      if (selectedContract) {
        const c = selectedContract;
        const paidPct = Math.round(c.paid_amount / c.value * 100);
        return (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Back + header */}
            <div className="flex items-start justify-between gap-3">
              <button onClick={() => { setSelectedContract(null); setGemResult(''); }}
                className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-emerald-600 transition-colors">
                <ArrowLeft size={14}/> Danh sách hợp đồng
              </button>
              <div className="flex gap-2">
                <button onClick={() => selectedContract && setPrintContract(selectedContract)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                  <Printer size={12}/> In hợp đồng
                </button>
                <button onClick={() => setActiveTab(c.linked_module as any)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-colors">
                  <ArrowRight size={12}/> Mở {c.linked_module === 'qs' ? 'QS & Thanh toán' : c.linked_module === 'equipment' ? 'Thiết bị' : c.linked_module === 'resources' ? 'Tài nguyên' : 'module liên kết'}
                </button>
              </div>
            </div>

            {/* Title card */}
            <div className={`rounded-2xl border p-5 ${typeConfig[c.type].bg}`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${typeConfig[c.type].bg} ${typeConfig[c.type].color} flex items-center gap-1`}>
                      {typeConfig[c.type].icon}{typeConfig[c.type].label}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">{c.code}</span>
                    <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusConfig[c.status].dot}`}/>
                      {statusConfig[c.status].label}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">{c.name}</h3>
                  <p className="text-sm text-slate-600 mt-0.5">{c.party} · <span className="text-slate-400">{c.party_type}</span></p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-bold text-slate-800 flex items-center gap-1 justify-end">
                    {canSeeFullValues ? <>{fmt(c.value)} <span className="text-sm font-normal text-slate-400">Tr VNĐ</span></> : <span className="flex items-center gap-1 text-base text-slate-400"><Lock size={14}/> Ẩn theo quyền</span>}
                  </p>
                  <p className="text-xs text-slate-500">{c.start_date} → {c.end_date}</p>
                </div>
              </div>
              {/* Payment progress */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1.5">
                  <span className="text-slate-600">Đã thanh toán: {canSeeFullValues ? `${fmt(c.paid_amount)} Tr` : '***'} ({paidPct}%)</span>
                  <span className="text-slate-400">Còn lại: {canSeeFullValues ? `${fmt(c.value - c.paid_amount)} Tr` : '***'}</span>
                </div>
                <div className="h-2 bg-white/60 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{width:`${paidPct}%`}}/>
                </div>
              </div>
            </div>

            {/* GEM Risk alert */}
            {c.gem_risk && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5"/>
                <span>{c.gem_risk}</span>
              </div>
            )}

            {/* Detail sub-tabs */}
            <div className="flex gap-1.5 border-b border-slate-200 pb-2">
              {(['overview','payments','guarantees','docs'] as const).map(t => (
                <button key={t} onClick={() => setDetailTab(t)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    detailTab === t ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'
                  }`}>
                  {t === 'overview' ? 'Tổng quan' : t === 'payments' ? 'Lịch thanh toán' : t === 'guarantees' ? 'Bảo lãnh' : 'Tài liệu'}
                </button>
              ))}
            </div>

            {/* Sub-tab content */}
            {detailTab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Thông tin hợp đồng</p>
                  {[
                    ['Mã hợp đồng', c.code],
                    ['Ký kết ngày', c.signed_date],
                    ['Hiệu lực từ', `${c.start_date} → ${c.end_date}`],
                    ['Bảo lưu', `${c.retention_pct}% giá trị`],
                    ['Điều kiện TT', c.payment_terms],
                  ].map(([k,v]) => (
                    <div key={k} className="flex gap-3">
                      <span className="text-xs text-slate-400 w-28 shrink-0 pt-0.5">{k}</span>
                      <span className="text-xs text-slate-700 font-medium leading-snug">{v}</span>
                    </div>
                  ))}
                </div>
                {/* GEM AI Analysis */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles size={12} className="text-emerald-500"/> GEM Phân tích rủi ro
                    </p>
                    <button onClick={handleGemAnalyze} disabled={gemAnalyzing}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50">
                      {gemAnalyzing ? <Loader2 size={10} className="animate-spin"/> : <Zap size={10}/>}
                      {gemAnalyzing ? 'Đang phân tích...' : 'Phân tích ngay'}
                    </button>
                  </div>
                  {gemResult ? (
                    <div className="text-xs text-slate-700 leading-relaxed bg-emerald-50 rounded-xl p-3 max-h-48 overflow-y-auto">
                      {gemResult}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 text-center py-6 bg-slate-50 rounded-xl">
                      Nhấn "Phân tích ngay" để GEM đánh giá rủi ro pháp lý và dòng tiền hợp đồng này
                    </div>
                  )}
                </div>
              </div>
            )}

            {detailTab === 'payments' && (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Đợt thanh toán</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">Tỷ lệ</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">Giá trị (Tr VNĐ)</th>
                      <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">Ngày</th>
                      <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {c.payment_schedule.map((p, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-slate-700 font-medium text-xs">{p.milestone}</td>
                        <td className="px-4 py-3 text-right text-xs text-slate-500">{p.pct}%</td>
                        <td className="px-4 py-3 text-right text-xs font-bold text-slate-800">{fmt(p.amount)}</td>
                        <td className="px-4 py-3 text-center text-xs text-slate-500">{p.date}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${payStatusConfig[p.status].cls}`}>
                            {payStatusConfig[p.status].label}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                    <tr>
                      <td className="px-4 py-3 text-xs font-bold text-slate-700">Tổng cộng</td>
                      <td className="px-4 py-3 text-right text-xs font-bold text-slate-700">100%</td>
                      <td className="px-4 py-3 text-right text-xs font-bold text-slate-800">{fmt(c.value)}</td>
                      <td colSpan={2} className="px-4 py-3 text-center text-xs text-slate-500">
                        Đã TT: <span className="font-bold text-emerald-600">{fmt(c.paid_amount)}</span> · Còn: <span className="font-bold text-amber-600">{fmt(c.value-c.paid_amount)}</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {detailTab === 'guarantees' && (
              <div className="space-y-3">
                {c.guarantees.length === 0 ? (
                  <div className="text-center py-10 bg-white border border-slate-200 rounded-2xl text-slate-400 text-sm">Hợp đồng này không có bảo lãnh</div>
                ) : c.guarantees.map((g, i) => {
                  const dArr = g.expiry.split('/').reverse().join('-');
                  const daysLeft = Math.round((new Date(dArr).getTime() - Date.now()) / 86400000);
                  const urgent = daysLeft <= 30;
                  return (
                    <div key={i} className={`bg-white border rounded-2xl p-4 flex items-center gap-4 ${urgent ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200'}`}>
                      <div className={`p-2.5 rounded-xl ${urgent ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
                        <ShieldCheck size={18}/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800">{guaranteeLabel[g.type]}</p>
                        <p className="text-xs text-slate-500 mt-0.5">Giá trị: <span className="font-semibold text-slate-700">{fmt(g.value)} Tr VNĐ</span> · Hết hạn: {g.expiry}</p>
                      </div>
                      <div className={`text-right shrink-0 ${urgent ? 'text-rose-600' : 'text-slate-500'}`}>
                        <p className="text-sm font-bold">{daysLeft} ngày</p>
                        <p className="text-[10px]">{urgent ? '⚠️ Cần gia hạn' : 'còn lại'}</p>
                      </div>
                    </div>
                  );
                })}
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
                  <strong>Lưu ý:</strong> Bảo lãnh hết hạn mà chưa được gia hạn hoặc giải tỏa có thể gây rủi ro pháp lý cho dự án. GEM sẽ cảnh báo trước 45 ngày.
                </div>
              </div>
            )}

            {detailTab === 'docs' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tài liệu đính kèm</p>
                  <button className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:underline">
                    <UploadCloud size={12}/> Tải lên
                  </button>
                </div>
                <div className="space-y-2">
                  {c.docs.map((doc, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition-colors group">
                      <FileText size={14} className="text-slate-400 shrink-0"/>
                      <span className="text-sm text-slate-700 flex-1 font-medium">{doc}</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1 hover:text-emerald-600"><Eye size={13}/></button>
                        <button className="p-1 hover:text-blue-600"><Download size={13}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      }

      // ── Contract List View ─────────────────────────────────────────────────
        return (
        <div className="space-y-5 animate-in fade-in duration-300">

          {/* KPI strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label:'Tổng giá trị HĐ',  val: canSeeFullValues ? `${fmt(totalValue)} Tr` : '*** Tr', icon:<FileText size={16}/>,    color:'blue'    },
              { label:'Đã thanh toán',     val: canSeeFullValues ? `${fmt(totalPaid)} Tr`  : '*** Tr', icon:<CheckCircle2 size={16}/>, color:'emerald' },
              { label:'Cảnh báo rủi ro',   val:String(alertContracts),  icon:<AlertTriangle size={16}/>,color: alertContracts > 0 ? 'rose' : 'slate' },
              { label:'Bảo lãnh sắp hết',  val:String(expiringGuarantees), icon:<ShieldCheck size={16}/>, color: expiringGuarantees > 0 ? 'amber' : 'slate' },
            ].map(k => (
              <div key={k.label} className={`bg-white border rounded-2xl p-4 flex items-center gap-3 ${
                k.color === 'rose' && alertContracts > 0 ? 'border-rose-200 bg-rose-50/40' :
                k.color === 'amber' && expiringGuarantees > 0 ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200'
              }`}>
                <div className={`p-2 rounded-xl shrink-0 ${
                  k.color === 'blue'    ? 'bg-blue-50 text-blue-600' :
                  k.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
                  k.color === 'rose'    ? 'bg-rose-50 text-rose-600' :
                  k.color === 'amber'   ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'
                }`}>{k.icon}</div>
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold leading-none mb-1">{k.label}</p>
                  <p className="text-base font-bold text-slate-800 leading-none">{k.val}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Search + filters + add */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-wrap gap-2 items-center">
            {/* Approval badge */}
            <button onClick={() => setShowApprovalPanel(true)}
              className="relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 transition-all ml-auto">
              <ClipboardList size={13}/> Hàng duyệt HĐ
              {contractApprovalQueue.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                  {contractApprovalQueue.length}
                </span>
              )}
            </button>
            <div className="relative flex-1 min-w-[140px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                placeholder="Tìm hợp đồng, bên ký..."
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white transition-all"/>
            </div>
            <select value={filterType} onChange={e => setFilterType(e.target.value as any)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 focus:outline-none text-slate-700">
              <option value="all">Tất cả loại</option>
              <option value="main">Tổng thầu</option>
              <option value="subcontractor">Nhà thầu phụ</option>
              <option value="supplier">Cung cấp</option>
              <option value="equipment">Thuê TB</option>
              <option value="consultant">Tư vấn</option>
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 focus:outline-none text-slate-700">
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Hiệu lực</option>
              <option value="draft">Dự thảo</option>
              <option value="completed">Hoàn thành</option>
              <option value="disputed">Tranh chấp</option>
            </select>
            {canSeeFullValues && (
              <div className="flex items-center gap-2">
                <button onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors shrink-0">
                  <Plus size={13}/> Thêm hợp đồng
                </button>
                <button onClick={() => {
                  submitForApproval('CONTRACT_AMENDMENT',
                    `Phụ lục hợp đồng mới — ${projectName}`, 0,
                    `CA-${new Date().getFullYear()}-${String(filtered.length + 1).padStart(3,'0')}`
                  );
                  notifOk('Yêu cầu phụ lục hợp đồng đã gửi duyệt!');
                }} className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-semibold transition-colors shrink-0">
                  Gửi duyệt phụ lục {approvalPending > 0 && <span className="bg-white/30 px-1 rounded-full">{approvalPending}</span>}
                </button>
              </div>
            )}
            {/* Audit log button */}
            <button onClick={() => setShowAuditLog(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold transition-colors shrink-0">
              <Eye size={13}/> Audit log
            </button>
            {/* Lock session */}
            <button onClick={() => {
              localStorage.removeItem(SESSION_KEY);
              onManualLock();
              writeAuditLog('LOCK_MANUAL','Khoá phiên hợp đồng thủ công');
              setActiveTab('overview');
            }} className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-semibold transition-colors shrink-0">
              <Lock size={13}/> Khoá lại
            </button>
          </div>

          {/* Audit log panel */}
          {showAuditLog && (
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <Eye size={12} className="text-emerald-400"/> Nhật ký truy cập Hợp đồng
                  <span className="text-slate-500 font-normal">({auditLogs.length} bản ghi)</span>
                </p>
                <button onClick={() => {
                  if (confirm('Xoá toàn bộ audit log?')) {
                    localStorage.removeItem(AUDIT_KEY);
                    setShowAuditLog(false);
                  }
                }} className="text-[10px] text-slate-500 hover:text-rose-400 transition-colors">Xoá log</button>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto font-mono">
                {auditLogs.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">Chưa có bản ghi nào</p>
                ) : auditLogs.map((log, i) => (
                  <div key={i} className="flex items-start gap-3 text-[10px] py-1 border-b border-slate-800">
                    <span className="text-slate-500 shrink-0">{new Date(log.ts).toLocaleString('vi-VN')}</span>
                    <span className={`shrink-0 font-bold ${
                      log.action === 'UNLOCK'       ? 'text-emerald-400' :
                      log.action === 'LOCK'         ? 'text-rose-400'    :
                      log.action === 'LOCK_MANUAL'  ? 'text-orange-400'  :
                      log.action === 'VIEW'         ? 'text-blue-400'    :
                                                      'text-slate-400'
                    }`}>[{log.action}]</span>
                    <span className="text-amber-400 shrink-0">{log.role}</span>
                    <span className="text-slate-400">{log.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Role-limited notice */}
          {!canSeeFullValues && (
            <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
              <Lock size={13} className="text-amber-500 shrink-0"/>
              <span>Vai trò <strong>{ROLE_LABELS[currentRole]}</strong> chỉ xem được % thanh toán và trạng thái. Giá trị tài chính được ẩn theo phân quyền.</span>
            </div>
          )}

          {/* Contract cards */}
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="text-center py-12 bg-white border border-slate-200 rounded-2xl text-slate-400">
                Không tìm thấy hợp đồng nào
              </div>
            ) : filtered.map(c => {
              const paidPct = Math.round(c.paid_amount / c.value * 100);
              const cfg = typeConfig[c.type];
              return (
                <div key={c.id}
                  onClick={() => { setSelectedContract(c); setDetailTab('overview'); setGemResult(''); }}
                  className="bg-white border border-slate-200 rounded-2xl p-4 hover:shadow-md hover:border-emerald-200 transition-all cursor-pointer group">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`p-2 rounded-xl border shrink-0 ${cfg.bg}`}>
                        <span className={cfg.color}>{cfg.icon}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{c.code}</span>
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                            <span className={`w-1.5 h-1.5 rounded-full ${statusConfig[c.status].dot}`}/>
                            {statusConfig[c.status].label}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-slate-800 group-hover:text-emerald-700 transition-colors truncate">{c.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{c.party} · {c.start_date} → {c.end_date}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-bold text-slate-800 flex items-center gap-1 justify-end">
                        {canSeeFullValues
                          ? <>{fmt(c.value)} <span className="text-xs font-normal text-slate-400">Tr</span></>
                          : <span className="flex items-center gap-1 text-sm text-slate-400"><Lock size={11}/> ***</span>
                        }
                      </p>
                      <p className="text-[10px] text-slate-400">{paidPct}% đã TT</p>
                    </div>
                  </div>

                  {/* Payment progress */}
                  <div className="mb-3">
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{width:`${paidPct}%`}}/>
                    </div>
                  </div>

                  {/* Bottom row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex gap-1.5 flex-wrap">
                      {c.guarantees.length > 0 && (
                        <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                          <ShieldCheck size={9}/> {c.guarantees.length} bảo lãnh
                        </span>
                      )}
                      {c.gem_risk && (
                        <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                          <AlertTriangle size={9}/> GEM cảnh báo
                        </span>
                      )}
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg flex items-center gap-1 ${
                        c.linked_module === 'qs' ? 'bg-violet-50 text-violet-700 border border-violet-200' :
                        c.linked_module === 'equipment' ? 'bg-teal-50 text-teal-700 border border-teal-200' :
                        'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        → {c.linked_module === 'qs' ? 'QS' : c.linked_module === 'equipment' ? 'Thiết bị' : c.linked_module === 'resources' ? 'Vật tư' : c.linked_module}
                      </span>
                    </div>
                    <span className="text-[10px] text-emerald-600 font-semibold group-hover:underline flex items-center gap-0.5">
                      Xem chi tiết <ChevronRight size={10}/>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {/* ── APPROVAL QUEUE DRAWER ── */}
          {showApprovalPanel && (
            <div className="fixed inset-0 z-50 flex justify-end">
              <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setShowApprovalPanel(false)}/>
              <div className="w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-hidden">
                <ApprovalQueue
                  projectId={pid}
                  projectName={projectName}
                  ctx={ctx}
                  onClose={() => { setShowApprovalPanel(false); refreshContractQueue(); }}
                />
              </div>
            </div>
          )}
        </div>
        );
      })()}

      {printContract && <ContractPrint
        data={{
          contract: printContract,
          projectName: selectedProject?.name || 'Dự án',
        }}
        onClose={() => setPrintContract(null)}
      />}
    </>
  );
}