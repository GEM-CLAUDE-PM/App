import { db, useRealtimeSync } from "./db";
import BIMViewer from "./BIMViewer";
import CameraCapture from "./CameraCapture";
import VoiceCapture from "./VoiceCapture";
import { useNotification } from './NotificationEngine';
import ModalForm, { FormRow, FormGrid, FormSection, inputCls, selectCls, inputCls, FormSection, FormFileUpload, BtnCancel, BtnSubmit } from './ModalForm';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { genAI, GEM_MODEL, GEM_MODEL_QUALITY } from './gemini';
import {
  Box, ClipboardList, MessageCircle, Files, LayoutDashboard,
  AlertTriangle, AlertCircle, ChevronRight, Plus, Search,
  X, Printer, Sparkles, Loader2, Eye, CheckCircle2, Calendar,
  ChevronDown, RefreshCw,
} from 'lucide-react';

// ── Types — khai báo NGOÀI component ─────────────────────────────────────────
type LogStatus  = 'draft' | 'signed' | 'rejected';
type RFIStatus  = 'draft' | 'sent' | 'processing' | 'answered' | 'closed';

interface SupervisionLog {
  id: string; date: string; inspector: string; area: string;
  weather: string; temp: string; workers_count: number;
  items: { work: string; standard: string; result: 'pass' | 'fail' | 'note'; observation: string }[];
  conclusion: string; next_plan: string; status: LogStatus; gemSuggestion?: string;
}
interface RFIItem {
  id: string; code: string; title: string; description: string;
  drawing_ref: string; submitted_by: string; assigned_to: string;
  submitted_date: string; due_date: string; answered_date: string;
  status: RFIStatus; priority: 'low' | 'medium' | 'high' | 'urgent';
  response: string; linked_ncr: string;
}
interface DrawingRevision {
  id: string; drawing_code: string; title: string; discipline: string;
  revisions: { rev: string; date: string; description: string; issued_by: string; superseded: boolean }[];
  current_rev: string; format: string; scale: string;
}
import {
  createDocument, submitDocument, getApprovalQueue, type ApprovalDoc,
} from './approvalEngine';
import { usePrint, type SupervisionLogPrintData } from './PrintService';
import { WORKFLOWS, type UserContext } from './permissions';
import { getCurrentCtx } from './projectMember';
import ApprovalQueue from './ApprovalQueue';

import type { DashboardProps } from './types';

type Props = DashboardProps;

// ── Config maps — khai báo NGOÀI component ───────────────────────────────────
const RFI_STATUS_CFG: Record<RFIStatus, { label: string; color: string; bg: string; step: number }> = {
  draft:      { label: 'Nháp',        color: 'text-slate-600',  bg: 'bg-slate-100',  step: 0 },
  sent:       { label: 'Đã gửi',      color: 'text-blue-700',   bg: 'bg-blue-100',   step: 1 },
  processing: { label: 'Đang xử lý',  color: 'text-amber-700',  bg: 'bg-amber-100',  step: 2 },
  answered:   { label: 'Đã trả lời',  color: 'text-teal-700',   bg: 'bg-teal-100',   step: 3 },
  closed:     { label: 'Đã đóng',     color: 'text-slate-500',  bg: 'bg-slate-100',  step: 4 },
};
const PRIORITY_CFG: Record<string, { label: string; color: string; bg: string }> = {
  low:    { label: 'Thấp',       color: 'text-slate-600',  bg: 'bg-slate-100'  },
  medium: { label: 'Trung bình', color: 'text-blue-700',   bg: 'bg-blue-100'   },
  high:   { label: 'Cao',        color: 'text-amber-700',  bg: 'bg-amber-100'  },
  urgent: { label: 'Khẩn cấp',  color: 'text-rose-700',   bg: 'bg-rose-100'   },
};
const RESULT_CFG = {
  pass: { label: 'Đạt',       color: 'text-emerald-700', bg: 'bg-emerald-100', icon: '✓' },
  fail: { label: 'Không đạt', color: 'text-rose-700',    bg: 'bg-rose-100',    icon: '✗' },
  note: { label: 'Cần lưu ý', color: 'text-amber-700',   bg: 'bg-amber-100',   icon: '⚠' },
};
const discColor = (d: string) =>
  d === 'Kết cấu' ? 'bg-slate-800 text-white' :
  d === 'Kiến trúc' ? 'bg-blue-600 text-white' :
  d === 'MEP' ? 'bg-teal-600 text-white' : 'bg-violet-600 text-white';

// ── Seed data — khai báo NGOÀI component ─────────────────────────────────────
const SEED_LOGS: SupervisionLog[] = [
  {
    id: 'gl1', date: '06/03/2026', inspector: 'Phạm Minh Quân',
    area: 'Tầng 3 — Dầm sàn trục A-D', weather: 'Nắng', temp: '32°C', workers_count: 24,
    items: [
      { work: 'Cốt thép dầm trục A-B', standard: 'TCVN 9115:2012 — khoảng cách ≤200mm', result: 'pass', observation: 'Đúng thiết kế, hàn nối tốt' },
      { work: 'Cốt thép sàn tầng 3', standard: 'TCVN 9115:2012', result: 'fail', observation: 'Phát hiện 2 vị trí thiếu cốt thép đai — đánh dấu sơn đỏ' },
      { work: 'Coffrage (ván khuôn)', standard: 'TCVN 9050:2014 — độ vênh ≤3mm/1m', result: 'pass', observation: 'Ổn định, không vênh vặt' },
    ],
    conclusion: 'Đạt yêu cầu ở hầu hết hạng mục. Cần khắc phục cốt thép đai tại 2 điểm trước khi đổ BT.',
    next_plan: 'Kiểm tra lại sau khi NTP bổ sung cốt thép đai. Nghiệm thu đổ BT ngày 08/03.',
    status: 'signed',
  },
  {
    id: 'gl2', date: '05/03/2026', inspector: 'Phạm Minh Quân',
    area: 'Khu vực MEP — Tầng hầm', weather: 'Mưa nhẹ', temp: '28°C', workers_count: 12,
    items: [
      { work: 'Đường ống cấp nước DN100', standard: 'TCVN 6534:2016', result: 'pass', observation: 'Lắp đặt đúng cao độ, khớp nối tốt' },
      { work: 'Hộp kỹ thuật điện tầng hầm', standard: 'IEC 60364', result: 'note', observation: 'Cần bổ sung nhãn định danh cáp' },
    ],
    conclusion: 'Hệ thống MEP tầng hầm tiến độ đạt 70%. Cần theo dõi nhãn cáp điện.',
    next_plan: 'Yêu cầu NTP Minh Khoa bổ sung nhãn định danh trong 2 ngày.',
    status: 'signed',
  },
  {
    id: 'gl3', date: '07/03/2026', inspector: 'Phạm Minh Quân',
    area: 'Mặt tiền — Công tác hoàn thiện', weather: 'Nắng', temp: '33°C', workers_count: 18,
    items: [
      { work: 'Trát tường ngoài', standard: 'TCVN 9377:2012 — độ phẳng ≤3mm/2m', result: 'pass', observation: 'Bề mặt phẳng, không nứt' },
    ],
    conclusion: 'Đang kiểm tra — chưa ký.',
    next_plan: 'Hoàn thiện nhật ký sau khi kết thúc ca chiều.',
    status: 'draft',
  },
];

const SEED_RFI: RFIItem[] = [
  {
    id: 'r1', code: 'RFI-2026-001', title: 'Làm rõ chi tiết kết nối dầm-cột trục C3',
    description: 'Bản vẽ kết cấu SK-102 Rev.B không thể hiện rõ chi tiết thép neo tại nút khung trục C3. Cần xác nhận loại thép neo, chiều dài móc, và khoảng cách hàn.',
    drawing_ref: 'SK-102 Rev.B', submitted_by: 'Phạm Minh Quân', assigned_to: 'TVGS Alpha Engineering',
    submitted_date: '01/03/2026', due_date: '08/03/2026', answered_date: '06/03/2026',
    status: 'answered', priority: 'high',
    response: 'Thép neo D16 dài 300mm, hàn 4 mặt, khoảng cách 150mm. Xem bản vẽ SK-102-D Rev.A.',
    linked_ncr: '',
  },
  {
    id: 'r2', code: 'RFI-2026-002', title: 'Xác nhận cao độ hoàn thiện sàn tầng 3 khu vực ướt',
    description: 'Bản vẽ kiến trúc A-202 Rev.C ghi cao độ sàn WC là -0.020m nhưng bản vẽ MEP M-305 lại ghi -0.015m. Đề nghị CĐT/TVGS xác nhận cao độ đúng.',
    drawing_ref: 'A-202 Rev.C; M-305', submitted_by: 'Phạm Minh Quân', assigned_to: 'TVGS Alpha Engineering',
    submitted_date: '04/03/2026', due_date: '11/03/2026', answered_date: '',
    status: 'processing', priority: 'urgent',
    response: '', linked_ncr: '',
  },
  {
    id: 'r3', code: 'RFI-2026-003', title: 'Phương án xử lý nứt bê tông cột C5 tầng 2',
    description: 'Phát hiện vết nứt ngang tại cột C5 tầng 2. Chiều rộng vết nứt 0.15mm. Đề nghị tư vấn kết cấu xem xét và có hướng dẫn xử lý.',
    drawing_ref: 'SK-105', submitted_by: 'Phạm Minh Quân', assigned_to: 'TK Kết cấu',
    submitted_date: '28/02/2026', due_date: '07/03/2026', answered_date: '05/03/2026',
    status: 'closed', priority: 'high',
    response: 'Vết nứt trong giới hạn cho phép TCVN 5574:2018. Tiêm keo epoxy và theo dõi 30 ngày.',
    linked_ncr: 'NCR-2026-003',
  },
  {
    id: 'r4', code: 'RFI-2026-004', title: 'Loại sơn chống thấm mái phù hợp với TCVN',
    description: 'Nhà thầu đề xuất sử dụng sơn chống thấm Polyglass thay vì Sika do vấn đề cung ứng. Đề nghị TVGS chấp thuận vật tư thay thế.',
    drawing_ref: 'A-501 Rev.A', submitted_by: 'CHT Nguyễn Văn Anh', assigned_to: 'TVGS Alpha Engineering',
    submitted_date: '06/03/2026', due_date: '10/03/2026', answered_date: '',
    status: 'sent', priority: 'medium',
    response: '', linked_ncr: '',
  },
];

const SEED_DRAWINGS: DrawingRevision[] = [
  {
    id: 'd1', drawing_code: 'SK-101', title: 'Mặt bằng kết cấu tầng 1',
    discipline: 'Kết cấu', current_rev: 'C', format: 'A1', scale: '1:100',
    revisions: [
      { rev: 'A', date: '01/01/2026', description: 'Phát hành lần đầu', issued_by: 'TK Kết cấu', superseded: true },
      { rev: 'B', date: '15/01/2026', description: 'Cập nhật vị trí cột C5, thêm dầm bo D2', issued_by: 'TK Kết cấu', superseded: true },
      { rev: 'C', date: '10/02/2026', description: 'Điều chỉnh thép dầm trục A theo RFI-2026-001', issued_by: 'TK Kết cấu', superseded: false },
    ],
  },
  {
    id: 'd2', drawing_code: 'A-202', title: 'Mặt bằng hoàn thiện tầng 2-4',
    discipline: 'Kiến trúc', current_rev: 'C', format: 'A1', scale: '1:100',
    revisions: [
      { rev: 'A', date: '01/01/2026', description: 'Phát hành lần đầu', issued_by: 'TK Kiến trúc', superseded: true },
      { rev: 'B', date: '20/01/2026', description: 'Thêm phòng kỹ thuật tầng 3', issued_by: 'TK Kiến trúc', superseded: true },
      { rev: 'C', date: '05/02/2026', description: 'Cập nhật cao độ sàn WC (chờ xác nhận RFI-2026-002)', issued_by: 'TK Kiến trúc', superseded: false },
    ],
  },
  {
    id: 'd3', drawing_code: 'M-305', title: 'Sơ đồ hệ thống cấp thoát nước tầng 3',
    discipline: 'MEP', current_rev: 'A', format: 'A1', scale: '1:50',
    revisions: [
      { rev: 'A', date: '15/01/2026', description: 'Phát hành lần đầu', issued_by: 'TK MEP', superseded: false },
    ],
  },
];

// ── Helper — khai báo NGOÀI component ────────────────────────────────────────
const daysUntilDue = (due: string): number | null => {
  if (!due) return null;
  const d = due.split('/').reverse().join('-');
  return Math.round((new Date(d).getTime() - Date.now()) / 86400000);
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function GiamSatDashboard({ project }: Props) {
  const pid = project?.id ?? 'p1';
  const projectName = project?.name ?? 'Dự án';
  // useMemo giữ stable object reference — tránh infinite loop trong useCallback/useEffect
  const ctx: UserContext = useMemo(() => getCurrentCtx(pid), [pid]);

  const { printComponent, printSupervisionLog } = usePrint();

  // ── ALL useState at top — Rules of Hooks ────────────────────────────────────
  const { ok: notifOk, err: notifErr, warn: notifWarn, info: notifInfo } = useNotification();
  const [gsTab, setGsTab] = useState<'dashboard' | 'logs' | 'rfi' | 'drawings' | 'bim'>(() => {
    const saved = sessionStorage.getItem('gem_action_subtab');
    const valid = ['logs','rfi','drawings','bim'];
    if (saved && valid.includes(saved)) { sessionStorage.removeItem('gem_action_subtab'); return saved as any; }
    return 'dashboard';
  });
  const [logs, setLogs]                   = useState<SupervisionLog[]>(SEED_LOGS);
  const [rfis, setRfis]                   = useState<RFIItem[]>(SEED_RFI);
  const [drawings, setDrawings]           = useState<DrawingRevision[]>(SEED_DRAWINGS);
  const [selectedLog, setSelectedLog]     = useState<SupervisionLog | null>(null);
  const [selectedRFI, setSelectedRFI]     = useState<RFIItem | null>(null);
  const [showLogForm, setShowLogForm]     = useState(false);
  const [showLogCamera, setShowLogCamera] = useState(false);
  const [logPhotos, setLogPhotos]         = useState<{dataUrl:string; geoTag?:any}[]>([]);
  const [showRFIForm, setShowRFIForm]     = useState(false);
  const [rfiSearch, setRfiSearch]         = useState('');
  const [rfiStatusFilter, setRfiStatusFilter] = useState<'all' | RFIStatus>('all');
  const [gemGSLoading, setGemGSLoading]   = useState(false);
  const [gemGSText, setGemGSText]         = useState('');
  const [showNewRevForm, setShowNewRevForm]       = useState(false);
  const [showNewDrawingForm, setShowNewDrawingForm] = useState(false);
  const [newRevDrawingId, setNewRevDrawingId]     = useState('');
  const [newRevCode, setNewRevCode]               = useState('');
  const [newRevDesc, setNewRevDesc]               = useState('');
  const [newRevIssuer, setNewRevIssuer]           = useState('');
  const [newDrawingCode, setNewDrawingCode]       = useState('');
  const [newDrawingTitle, setNewDrawingTitle]     = useState('');
  const [newDrawingDisc, setNewDrawingDisc]       = useState('Kết cấu');
  const [expandedLogId, setExpandedLogId]   = useState<string | null>(null);
  const [expandedRfiId, setExpandedRfiId]   = useState<string | null>(null);
  const [rfiForm, setRfiForm]             = useState<Partial<RFIItem>>({
    status: 'draft', priority: 'medium',
    submitted_date: new Date().toLocaleDateString('vi-VN'),
    submitted_by: 'Phạm Minh Quân',
  });
  const [approvalPending, setApprovalPending] = useState(0);
  const [showApprovalPanel, setShowApprovalPanel] = useState(false);
  const [gsApprovalQueue, setGsApprovalQueue] = useState<ApprovalDoc[]>([]);

  const [logForm, setLogForm]             = useState<Partial<SupervisionLog>>({
    status: 'draft', weather: 'Nắng', workers_count: 0,
    date: new Date().toLocaleDateString('vi-VN'),
    inspector: 'Phạm Minh Quân',
    items: [{ work: '', standard: '', result: 'pass', observation: '' }],
  });

  // ── useEffect SAU tất cả useState ──────────────────────────────────────────
  const dbLoaded = useRef(false);

  useEffect(() => {
    dbLoaded.current = false;
    (async () => {
      try {
        const [l, r, d] = await Promise.all([
          db.get<SupervisionLog[]>  ('gs_logs',      pid, []),
          db.get<RFIItem[]>         ('gs_rfi',        pid, []),
          db.get<DrawingRevision[]> ('gs_drawings',   pid, []),
        ]);
        setLogs(l.length     ? l : SEED_LOGS);
        setRfis(r.length     ? r : SEED_RFI);
        setDrawings(d.length ? d : SEED_DRAWINGS);
      } catch { /* fallback to seed */ }
      finally { dbLoaded.current = true; }
    })();
  }, [pid]);

  // ── Realtime sync ──────────────────────────────────────────────────────────
  useRealtimeSync(pid, ['gs_logs', 'gs_rfi', 'gs_drawings'], async () => {
    const [l, r, d] = await Promise.all([
      db.get<SupervisionLog[]>  ('gs_logs',      pid, []),
      db.get<RFIItem[]>         ('gs_rfi',        pid, []),
      db.get<DrawingRevision[]> ('gs_drawings',   pid, []),
    ]);
    if (l.length) setLogs(l);
    if (r.length) setRfis(r);
    if (d.length) setDrawings(d);
  });

  // ── Approval wiring ─────────────────────────────────────────────────────────
  const refreshGsQueue = React.useCallback(() => {
    const q = getApprovalQueue(pid, ctx);
    setGsApprovalQueue(q);
    setApprovalPending(q.length);
  }, [pid, ctx]);

  useEffect(() => { refreshGsQueue(); }, [refreshGsQueue]);

  type GsDocType = 'RFI' | 'INSPECTION_REQUEST' | 'DRAWING_REVISION' | 'METHOD_STATEMENT';

  const triggerGsDoc = React.useCallback((
    title: string,
    docType: GsDocType,
    data: Record<string, unknown> = {},
  ) => {
    if (!WORKFLOWS[docType]) return;
    const cr = createDocument({ projectId: pid, docType, ctx, title, data });
    if (!cr.ok) { notifErr(`❌ ${(cr as any).error}`); return; }
    const sr = submitDocument(pid, cr.data!.id, ctx);
    if (sr.ok) {
      refreshGsQueue();
      const el = document.createElement('div');
      el.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] bg-teal-700 text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-2xl';
      el.textContent = '✅ ' + docType + ' "' + title + '" đã nộp duyệt';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 3500);
    } else {
      notifErr(`❌ ${(sr as any).error}`);
    }
  }, [pid, ctx, refreshGsQueue]);
  // ── /Approval wiring ─────────────────────────────────────────────────────────

  // ── Save helper ─────────────────────────────────────────────────────────────
  const saveGS = (collection: string, data: unknown[]) => {
    db.set(collection, pid, data);
  };

  // ── Computed ─────────────────────────────────────────────────────────────────
  const openRFIs    = rfis.filter(r => r.status !== 'closed').length;
  const overdueRFIs = rfis.filter(r => {
    if (r.status === 'closed' || r.status === 'answered') return false;
    const dl = daysUntilDue(r.due_date);
    return dl !== null && dl < 0;
  }).length;
  const urgentRFIs  = rfis.filter(r => r.priority === 'urgent' && r.status !== 'closed').length;
  const draftLogs   = logs.filter(l => l.status === 'draft').length;
  const filteredRFIs = rfis.filter(r =>
    (rfiStatusFilter === 'all' || r.status === rfiStatusFilter) &&
    (!rfiSearch || r.title.toLowerCase().includes(rfiSearch.toLowerCase())
      || r.code.toLowerCase().includes(rfiSearch.toLowerCase())
      || r.description.toLowerCase().includes(rfiSearch.toLowerCase()))
  );

  // ── GEM Analysis ────────────────────────────────────────────────────────────
  const generateGSAnalysis = async () => {
    setGemGSLoading(true); setGemGSText('');
    try {
      const model = genAI.getGenerativeModel({
        model: GEM_MODEL,
        generationConfig: { temperature: 0.25 },
        systemInstruction: 'Bạn là Nàng GEM Siêu Việt — chuyên gia tư vấn giám sát xây dựng. Xưng "em", gọi "Anh/Chị". Phân tích kỹ thuật sắc bén, thực tế.',
      });
      const result = await model.generateContent(
        `Phân tích tình hình giám sát thi công dự án ${projectName}:\n\nNhật ký giám sát: ${logs.length} nhật ký (${draftLogs} chưa ký)\nRFI đang mở: ${openRFIs} (${overdueRFIs} quá hạn, ${urgentRFIs} khẩn cấp)\nBản vẽ đang quản lý: ${drawings.length} bản vẽ\n\nRFI nổi bật:\n${rfis.filter(r => r.status !== 'closed').map(r => `[${r.priority.toUpperCase()}] ${r.code}: ${r.title} — ${RFI_STATUS_CFG[r.status].label}, hạn ${r.due_date}`).join('\n')}\n\nNhật ký mới nhất (${logs[0]?.date}):\nKhu vực: ${logs[0]?.area}\nKết quả: ${logs[0]?.items.map(i => `${i.work}: ${RESULT_CFG[i.result].label}`).join(', ')}\nKết luận: ${logs[0]?.conclusion}\n\nHãy viết:\n1. Đánh giá tổng quan tình hình giám sát\n2. Vấn đề kỹ thuật cần ưu tiên giải quyết\n3. RFI nào cần thúc đẩy ngay\n4. Khuyến nghị cho KS Giám sát tuần tới\nBằng tiếng Việt, chuyên nghiệp.`
      );
      setGemGSText(result.response.text());
    } catch {
      setGemGSText('Dạ em chưa kết nối được GEM, Anh/Chị thử lại sau nhé.');
    } finally {
      setGemGSLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Eye size={20} className="text-teal-600" /> KS Giám sát — {projectName}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">Nhật ký giám sát · RFI Tracker · Quản lý bản vẽ revision</p>
        </div>
      </div>

      {/* Sub-tab bar */}
      <div className="flex gap-1.5 flex-wrap bg-white border border-slate-200 rounded-2xl p-2">
        {([
          { id: 'dashboard', label: 'Tổng quan',        icon: <LayoutDashboard size={13} />, color: 'teal'  },
          { id: 'logs',      label: 'Nhật ký Giám sát', icon: <ClipboardList size={13} />,   color: 'slate' },
          { id: 'rfi',       label: 'RFI Tracker',      icon: <MessageCircle size={13} />,   color: 'amber' },
          { id: 'drawings',  label: 'Bản vẽ & Revision',icon: <Files size={13} />,           color: 'blue'  },
          { id: 'bim',       label: 'BIM 3D Viewer',     icon: <Box size={13} />,             color: 'violet'},
        ] as { id: string; label: string; icon: React.ReactNode; color: string }[]).map(t => (
          <button key={t.id} onClick={() => setGsTab(t.id as any)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              gsTab === t.id
                ? t.color === 'teal'  ? 'bg-teal-600 text-white shadow-sm'
                : t.color === 'amber' ? 'bg-amber-500 text-white shadow-sm'
                : t.color === 'blue'  ? 'bg-blue-600 text-white shadow-sm'
                                      : 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}>
            {t.icon}{t.label}
            {t.id === 'rfi'  && openRFIs > 0  && <span className="bg-white/30 text-[9px] font-bold px-1.5 rounded-full">{openRFIs}</span>}
            {t.id === 'rfi'  && approvalPending > 0 && <span className="bg-rose-500 text-white text-[9px] font-bold px-1.5 rounded-full">⏳{approvalPending}</span>}
            {t.id === 'logs' && draftLogs > 0 && <span className="bg-white/30 text-[9px] font-bold px-1.5 rounded-full">{draftLogs}</span>}
          </button>
        ))}
        {/* Approval badge button */}
        <button onClick={() => setShowApprovalPanel(true)}
          className="relative ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100 transition-all">
          <ClipboardList size={13}/> Hàng duyệt GS
          {gsApprovalQueue.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
              {gsApprovalQueue.length}
            </span>
          )}
        </button>
      </div>

      {/* ── DASHBOARD ─────────────────────────────────────────────────────── */}
      {gsTab === 'dashboard' && (
        <div className="space-y-4">
          {/* KPI strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'RFI đang mở',       val: String(openRFIs),        unit: 'RFI',     icon: <MessageCircle size={18} />, color: 'amber', alert: openRFIs > 0 },
              { label: 'RFI quá hạn',       val: String(overdueRFIs),     unit: 'RFI',     icon: <AlertTriangle size={18} />, color: 'rose',  alert: overdueRFIs > 0 },
              { label: 'Nhật ký chưa ký',   val: String(draftLogs),       unit: 'nhật ký', icon: <ClipboardList size={18} />, color: 'slate', alert: draftLogs > 0 },
              { label: 'Bản vẽ quản lý',    val: String(drawings.length), unit: 'bản vẽ',  icon: <Files size={18} />,         color: 'blue',  alert: false },
            ].map(k => (
              <div key={k.label} className={`bg-white border rounded-2xl p-4 flex items-center gap-3 ${
                k.alert ? k.color === 'rose' ? 'border-rose-200 bg-rose-50/40' : k.color === 'amber' ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200' : 'border-slate-200'
              }`}>
                <div className={`p-2.5 rounded-xl shrink-0 ${
                  k.color === 'amber' ? 'bg-amber-100 text-amber-600' :
                  k.color === 'rose'  ? 'bg-rose-100 text-rose-600' :
                  k.color === 'blue'  ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'
                }`}>{k.icon}</div>
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold leading-none mb-0.5">{k.label}</p>
                  <p className="text-xl font-bold text-slate-800 leading-none">{k.val} <span className="text-xs font-normal text-slate-400">{k.unit}</span></p>
                </div>
              </div>
            ))}
          </div>

          {/* Alert banners */}
          {(overdueRFIs > 0 || urgentRFIs > 0) && (
            <div className="space-y-2">
              {overdueRFIs > 0 && (
                <div onClick={() => setGsTab('rfi')} className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-800 cursor-pointer hover:bg-rose-100 transition-colors">
                  <AlertTriangle size={14} className="text-rose-500 shrink-0" />
                  <span><strong>{overdueRFIs} RFI quá hạn</strong> chưa được trả lời — cần thúc đẩy ngay</span>
                  <ChevronRight size={14} className="ml-auto text-rose-400" />
                </div>
              )}
              {urgentRFIs > 0 && (
                <div onClick={() => setGsTab('rfi')} className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 cursor-pointer hover:bg-amber-100 transition-colors">
                  <AlertCircle size={14} className="text-amber-500 shrink-0" />
                  <span><strong>{urgentRFIs} RFI khẩn cấp</strong> đang chờ xử lý — ảnh hưởng tiến độ</span>
                  <ChevronRight size={14} className="ml-auto text-amber-400" />
                </div>
              )}
            </div>
          )}

          {/* Nhật ký gần đây — expand inline */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><ClipboardList size={12} className="text-teal-500" /> Nhật ký giám sát gần đây</p>
              <button onClick={() => setGsTab('logs')} className="text-[10px] text-emerald-600 font-semibold hover:underline">Xem tất cả →</button>
            </div>
            <div className="divide-y divide-slate-100">
              {logs.slice(0, 3).map(log => {
                const fails = log.items.filter(i => i.result === 'fail').length;
                const isExpanded = expandedLogId === log.id;
                return (
                  <div key={log.id}>
                    {/* Header row — click to expand */}
                    <div onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                      className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50 cursor-pointer transition-colors">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${log.status === 'signed' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs font-semibold text-slate-800">{log.area}</p>
                          {fails > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded-full">{fails} không đạt</span>}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">{log.date} · {log.inspector} · {log.workers_count} CN · {log.weather} {log.temp}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${log.status === 'signed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {log.status === 'signed' ? 'Đã ký' : 'Nháp'}
                        </span>
                        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="px-4 pb-4 bg-slate-50/60 border-t border-slate-100 animate-in fade-in duration-200">
                        {/* Items table */}
                        <div className="mt-3 space-y-1.5">
                          {log.items.map((item, idx) => (
                            <div key={idx} className={`flex items-start gap-2.5 px-3 py-2 rounded-xl text-xs ${
                              item.result === 'fail' ? 'bg-rose-50 border border-rose-100' :
                              item.result === 'note' ? 'bg-amber-50 border border-amber-100' :
                              'bg-white border border-slate-100'
                            }`}>
                              <span className={`mt-0.5 shrink-0 font-black text-[10px] ${
                                item.result === 'fail' ? 'text-rose-600' :
                                item.result === 'note' ? 'text-amber-600' : 'text-emerald-600'
                              }`}>{item.result === 'fail' ? '✗' : item.result === 'note' ? '!' : '✓'}</span>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-slate-800">{item.work}</p>
                                <p className="text-[10px] text-slate-500 mt-0.5">{item.observation}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* Conclusion + next plan */}
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-wide mb-1">Kết luận</p>
                            <p className="text-xs text-slate-700 leading-relaxed">{log.conclusion}</p>
                          </div>
                          <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
                            <p className="text-[9px] font-black text-blue-400 uppercase tracking-wide mb-1">Kế hoạch tiếp theo</p>
                            <p className="text-xs text-blue-800 leading-relaxed">{log.next_plan}</p>
                          </div>
                        </div>
                        {/* Quick actions */}
                        <div className="flex gap-2 mt-3">
                          {log.status === 'draft' && (
                            <button onClick={(e) => { e.stopPropagation(); setSelectedLog(log); setGsTab('logs'); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-[10px] font-bold hover:bg-teal-700">
                              <ClipboardList size={11}/> Ký nhật ký
                            </button>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); setSelectedLog(log); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold hover:bg-slate-200">
                            <Eye size={11}/> Xem đầy đủ
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* RFI đang xử lý — expand inline */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><MessageCircle size={12} className="text-amber-500" /> RFI đang xử lý</p>
              <button onClick={() => setGsTab('rfi')} className="text-[10px] text-emerald-600 font-semibold hover:underline">Xem tất cả →</button>
            </div>
            <div className="divide-y divide-slate-100">
              {rfis.filter(r => r.status !== 'closed').slice(0, 5).map(rfi => {
                const dl = daysUntilDue(rfi.due_date);
                const overdue = dl !== null && dl < 0;
                const isExpanded = expandedRfiId === rfi.id;
                return (
                  <div key={rfi.id}>
                    {/* Header row */}
                    <div onClick={() => setExpandedRfiId(isExpanded ? null : rfi.id)}
                      className={`px-4 py-3 flex items-center gap-2.5 hover:bg-slate-50 cursor-pointer transition-colors ${overdue ? 'bg-rose-50/30' : ''}`}>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${PRIORITY_CFG[rfi.priority].bg} ${PRIORITY_CFG[rfi.priority].color}`}>
                        {PRIORITY_CFG[rfi.priority].label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] font-mono text-slate-400 shrink-0">{rfi.code}</p>
                          {overdue && dl !== null && <span className="text-[9px] font-bold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded-full">Quá {Math.abs(dl)}ngày</span>}
                        </div>
                        <p className="text-xs font-semibold text-slate-800 line-clamp-1">{rfi.title}</p>
                        <p className="text-[10px] text-slate-400">→ {rfi.assigned_to}{dl !== null && !overdue ? ` · Còn ${dl} ngày` : ''}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${RFI_STATUS_CFG[rfi.status].bg} ${RFI_STATUS_CFG[rfi.status].color}`}>
                          {RFI_STATUS_CFG[rfi.status].label}
                        </span>
                        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="px-4 pb-4 bg-slate-50/60 border-t border-slate-100 animate-in fade-in duration-200 space-y-2.5">
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-wide mb-1">Nội dung yêu cầu</p>
                            <p className="text-xs text-slate-700 leading-relaxed">{rfi.description}</p>
                          </div>
                          {rfi.response ? (
                            <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5">
                              <p className="text-[9px] font-black text-emerald-500 uppercase tracking-wide mb-1">Phản hồi</p>
                              <p className="text-xs text-emerald-800 leading-relaxed">{rfi.response}</p>
                            </div>
                          ) : (
                            <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 flex items-center justify-center">
                              <p className="text-xs text-amber-600 font-semibold text-center">⏳ Chưa có phản hồi</p>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          {rfi.drawing_ref && <span className="flex items-center gap-1"><Files size={9}/> {rfi.drawing_ref}</span>}
                          {rfi.linked_ncr && <span className="flex items-center gap-1 text-rose-500"><AlertTriangle size={9}/> Liên kết {rfi.linked_ncr}</span>}
                          <span className="flex items-center gap-1"><Calendar size={9}/> Hạn: {rfi.due_date}</span>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={(e) => { e.stopPropagation(); setSelectedRFI(rfi); setGsTab('rfi'); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-[10px] font-bold hover:bg-amber-700">
                            <MessageCircle size={11}/> Phản hồi RFI
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setSelectedRFI(rfi); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold hover:bg-slate-200">
                            <Eye size={11}/> Chi tiết
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* GEM analysis */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><Sparkles size={12} className="text-teal-500" /> GEM Phân tích Giám sát</p>
              <button onClick={generateGSAnalysis} disabled={gemGSLoading}
                className="flex items-center gap-1 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-[10px] font-bold hover:bg-teal-700 disabled:opacity-50 transition-colors">
                {gemGSLoading ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                {gemGSLoading ? 'Đang phân tích...' : 'Phân tích'}
              </button>
            </div>
            {gemGSText ? (
              <div className="text-xs text-slate-700 leading-relaxed bg-teal-50 rounded-xl p-3 max-h-52 overflow-y-auto whitespace-pre-wrap">{gemGSText}</div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-6 bg-slate-50 rounded-xl">GEM tổng hợp tình hình kỹ thuật, RFI tồn đọng và khuyến nghị tuần tới</p>
            )}
          </div>
        </div>
      )}

      {/* ── SUPERVISION LOGS ──────────────────────────────────────────────── */}
      {gsTab === 'logs' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Tổng nhật ký',        val: logs.length,                                                           cls: 'bg-teal-100 text-teal-700'    },
              { label: 'Đã ký',               val: logs.filter(l => l.status === 'signed').length,                       cls: 'bg-emerald-100 text-emerald-700' },
              { label: 'Chưa ký (nháp)',       val: draftLogs,                                                            cls: 'bg-amber-100 text-amber-700'  },
              { label: 'HM không đạt',         val: logs.reduce((s, l) => s + l.items.filter(i => i.result === 'fail').length, 0), cls: 'bg-rose-100 text-rose-700' },
            ].map((k, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black ${k.cls}`}>{k.val}</div>
                <span className="text-xs text-slate-600 font-medium">{k.label}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-bold text-slate-700">{logs.length} nhật ký giám sát</p>
              <p className="text-xs text-slate-500">{logs.filter(l => l.status === 'signed').length} đã ký · {draftLogs} nháp</p>
            </div>
            <div className="flex gap-2">
              <button onClick={async () => {
                setGemGSLoading(true); setGemGSText('');
                try {
                  const model = genAI.getGenerativeModel({
                    model: GEM_MODEL,
                    generationConfig: { temperature: 0.25 },
                    systemInstruction: 'Bạn là Nàng GEM Siêu Việt — KS giám sát xây dựng chuyên nghiệp. Soạn nhật ký giám sát theo mẫu chuẩn TVGS Việt Nam. Văn phong trang trọng, rõ ràng.',
                  });
                  const today = new Date().toLocaleDateString('vi-VN');
                  const r = await model.generateContent(`Soạn nhật ký giám sát thi công ngày ${today} cho dự án ${projectName}. Khu vực: tầng 3 block A. Thời tiết: nắng 32°C. Số công nhân: 20. Hạng mục: đổ bê tông sàn, lắp đặt MEP. Tạo nội dung nhật ký đầy đủ gồm: kết quả kiểm tra từng hạng mục, tiêu chuẩn áp dụng, nhận xét, kết luận và kế hoạch ngày hôm sau. Theo mẫu TVGS chuẩn.`);
                  setGemGSText(r.response.text());
                } catch { setGemGSText('❌ Không kết nối được GEM.'); }
                setGemGSLoading(false);
              }} disabled={gemGSLoading}
                className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-bold hover:opacity-90 disabled:opacity-50">
                {gemGSLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} GEM soạn nhật ký
              </button>
              <button onClick={() => setShowLogForm(v => !v)}
                className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-colors">
                <Plus size={13} /> Tạo nhật ký
              </button>
            </div>
          </div>

          {gemGSText && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-bold text-blue-800 text-sm flex items-center gap-2"><Sparkles size={14} className="text-blue-600" />Nàng GEM soạn thảo nhật ký</p>
                <div className="flex gap-2">
                  <button onClick={() => setShowLogForm(true)} className="px-3 py-1 bg-teal-600 text-white text-xs font-bold rounded-lg">Dùng làm nháp</button>
                  <button onClick={() => setGemGSText('')} className="p-1 hover:bg-blue-100 rounded-lg"><X size={13} className="text-blue-500" /></button>
                </div>
              </div>
              <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{gemGSText}</p>
            </div>
          )}


          <div className="space-y-2">
            {logs.map(log => {
              const fails = log.items.filter(i => i.result === 'fail').length;
              const notes = log.items.filter(i => i.result === 'note').length;
              return (
                <div key={log.id} onClick={() => setSelectedLog(log)}
                  className="bg-white border border-slate-200 rounded-2xl p-4 hover:shadow-md hover:border-teal-200 transition-all cursor-pointer group">
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${log.status === 'signed' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-700 group-hover:text-teal-700 transition-colors">{log.area}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{log.date} · {log.inspector} · {log.weather} {log.temp} · {log.workers_count} CN · {log.items.length} hạng mục</p>
                      <div className="flex gap-2 mt-1.5">
                        <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg">{log.items.filter(i => i.result === 'pass').length} đạt</span>
                        {fails > 0 && <span className="text-[10px] font-semibold bg-rose-50 text-rose-700 px-2 py-0.5 rounded-lg">{fails} không đạt</span>}
                        {notes > 0 && <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-lg">{notes} lưu ý</span>}
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${log.status === 'signed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {log.status === 'signed' ? '✓ Đã ký' : '✏ Nháp'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── RFI TRACKER ───────────────────────────────────────────────────── */}
      {gsTab === 'rfi' && (
        <div className="space-y-4">
          {/* SLA bar */}
          {(() => {
            const total = rfis.length;
            const closed = rfis.filter(r => r.status === 'closed').length;
            const answered = rfis.filter(r => r.status === 'answered').length;
            const overdueCnt = rfis.filter(r => { if (r.status === 'closed' || r.status === 'answered') return false; const dl = daysUntilDue(r.due_date); return dl !== null && dl < 0; }).length;
            const pct = total > 0 ? Math.round((closed + answered) / total * 100) : 0;
            return (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-bold text-slate-700">Tỷ lệ giải quyết RFI</span>
                    <span className="font-black text-teal-600">{pct}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex gap-3 mt-1.5 text-[10px] text-slate-500">
                    <span className="text-teal-600 font-semibold">{closed + answered} đã xử lý</span>
                    <span className="text-amber-600 font-semibold">{total - closed - answered} đang mở</span>
                    {overdueCnt > 0 && <span className="text-rose-600 font-bold animate-pulse">⚠ {overdueCnt} quá hạn</span>}
                  </div>
                </div>
                <div className="text-center shrink-0">
                  <div className="text-2xl font-black text-slate-800">{total}</div>
                  <div className="text-[10px] text-slate-400">Tổng RFI</div>
                </div>
              </div>
            );
          })()}

          <div className="flex flex-wrap gap-2 items-center">
            {(['all', 'sent', 'processing', 'answered', 'closed'] as const).map(s => (
              <button key={s} onClick={() => setRfiStatusFilter(s as any)}
                className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-colors ${rfiStatusFilter === s ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {s === 'all' ? 'Tất cả' : RFI_STATUS_CFG[s].label}
                <span className="ml-1 opacity-70">({s === 'all' ? rfis.length : rfis.filter(r => r.status === s).length})</span>
              </button>
            ))}
            <div className="relative flex-1 min-w-[140px]">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={rfiSearch} onChange={e => setRfiSearch(e.target.value)} placeholder="Tìm RFI..."
                className="w-full pl-7 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
            </div>
            <button onClick={() => setShowRFIForm(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shrink-0">
              <Plus size={13} /> Tạo RFI
            </button>
          </div>

          {/* RFI detail modal */}
          {selectedRFI && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setSelectedRFI(null)}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-start rounded-t-2xl">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-400">{selectedRFI.code}</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${PRIORITY_CFG[selectedRFI.priority].bg} ${PRIORITY_CFG[selectedRFI.priority].color}`}>{PRIORITY_CFG[selectedRFI.priority].label}</span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-800 mt-1 leading-snug">{selectedRFI.title}</h3>
                  </div>
                  <button onClick={() => setSelectedRFI(null)}><X size={16} className="text-slate-400" /></button>
                </div>
                <div className="p-6 space-y-4">
                  {/* Lifecycle steps */}
                  <div className="flex items-center gap-0">
                    {(['draft', 'sent', 'processing', 'answered', 'closed'] as RFIStatus[]).map((s, i, arr) => {
                      const cur = RFI_STATUS_CFG[selectedRFI.status].step;
                      const active = i <= cur;
                      return (
                        <React.Fragment key={s}>
                          <div className="flex flex-col items-center">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ${active ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-400'}`}>{i + 1}</div>
                            <p className={`text-[8px] font-semibold mt-0.5 ${active ? 'text-teal-600' : 'text-slate-400'}`}>{RFI_STATUS_CFG[s].label}</p>
                          </div>
                          {i < arr.length - 1 && <div className={`flex-1 h-0.5 mx-1 mb-3 ${i < cur ? 'bg-teal-500' : 'bg-slate-200'}`} />}
                        </React.Fragment>
                      );
                    })}
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Nội dung yêu cầu</p>
                    <p className="text-xs text-slate-700 leading-relaxed">{selectedRFI.description}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      ['Bản vẽ liên quan', selectedRFI.drawing_ref || '—'],
                      ['Gửi bởi', selectedRFI.submitted_by],
                      ['Gửi tới', selectedRFI.assigned_to],
                      ['Ngày gửi', selectedRFI.submitted_date],
                      ['Hạn trả lời', selectedRFI.due_date],
                      ['NCR liên kết', selectedRFI.linked_ncr || '—'],
                    ].map(([k, v]) => (
                      <div key={k} className="bg-slate-50 rounded-xl p-2.5">
                        <p className="text-[10px] text-slate-400">{k}</p>
                        <p className="text-xs font-semibold text-slate-700 mt-0.5">{v}</p>
                      </div>
                    ))}
                  </div>
                  {selectedRFI.response && (
                    <div className="bg-teal-50 border border-teal-200 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-teal-600 uppercase tracking-wide mb-1">✅ Phản hồi từ {selectedRFI.assigned_to}</p>
                      <p className="text-xs text-teal-800 leading-relaxed">{selectedRFI.response}</p>
                      {selectedRFI.answered_date && <p className="text-[9px] text-teal-500 mt-1">Ngày trả lời: {selectedRFI.answered_date}</p>}
                    </div>
                  )}
                  {gemGSText && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-blue-700 mb-1.5 flex items-center gap-1"><Sparkles size={11} />Nàng GEM phân tích RFI</p>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{gemGSText}</p>
                      <button onClick={() => setGemGSText('')} className="mt-2 text-[10px] text-blue-500 hover:text-blue-700 flex items-center gap-1"><X size={9} />Đóng</button>
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-100">
                    <button onClick={async () => {
                      setGemGSLoading(true); setGemGSText('');
                      try {
                        const model = genAI.getGenerativeModel({
                          model: GEM_MODEL,
                          generationConfig: { temperature: 0.25 },
                          systemInstruction: 'Bạn là Nàng GEM Siêu Việt — tư vấn giám sát xây dựng. Xưng em, gọi Anh/Chị.',
                        });
                        const r = await model.generateContent(`Phân tích RFI: ${selectedRFI.code} — ${selectedRFI.title}\nMô tả: ${selectedRFI.description}\nBản vẽ: ${selectedRFI.drawing_ref}\nTrạng thái: ${RFI_STATUS_CFG[selectedRFI.status].label}\n${selectedRFI.response ? 'Phản hồi: ' + selectedRFI.response : ''}\nHãy: (1) đánh giá tính rõ ràng của RFI, (2) gợi ý phản hồi nếu chưa có, (3) tiêu chuẩn TCVN liên quan, (4) rủi ro khi chậm xử lý.`);
                        setGemGSText(r.response.text());
                      } catch { setGemGSText('❌ Không kết nối được GEM.'); }
                      setGemGSLoading(false);
                    }} disabled={gemGSLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-bold hover:opacity-90 disabled:opacity-50 w-full justify-center mb-2">
                      {gemGSLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} GEM Phân tích RFI này
                    </button>
                  </div>
                  {selectedRFI.status !== 'closed' && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                      {selectedRFI.status === 'sent' && (
                        <button onClick={() => { const updated = rfis.map(r => r.id === selectedRFI.id ? { ...r, status: 'processing' as RFIStatus } : r); setRfis(updated); saveGS('gs_rfi', updated); setSelectedRFI({ ...selectedRFI, status: 'processing' }); }}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold">→ Đang xử lý</button>
                      )}
                      {(selectedRFI.status === 'processing' || selectedRFI.status === 'sent') && (
                        <button onClick={() => { const today = new Date().toLocaleDateString('vi-VN'); const updated = rfis.map(r => r.id === selectedRFI.id ? { ...r, status: 'answered' as RFIStatus, answered_date: today } : r); setRfis(updated); saveGS('gs_rfi', updated); setSelectedRFI({ ...selectedRFI, status: 'answered', answered_date: today }); }}
                          className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold">✓ Đã trả lời</button>
                      )}
                      {selectedRFI.status === 'answered' && (
                        <button onClick={() => { const updated = rfis.map(r => r.id === selectedRFI.id ? { ...r, status: 'closed' as RFIStatus } : r); setRfis(updated); saveGS('gs_rfi', updated); setSelectedRFI({ ...selectedRFI, status: 'closed' }); }}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold">Đóng RFI</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {filteredRFIs.map(rfi => {
              const dl = daysUntilDue(rfi.due_date);
              const overdue = dl !== null && dl < 0 && rfi.status !== 'closed';
              return (
                <div key={rfi.id} onClick={() => setSelectedRFI(rfi)}
                  className={`bg-white border rounded-2xl p-4 hover:shadow-md transition-all cursor-pointer group ${overdue ? 'border-rose-200 bg-rose-50/20' : rfi.priority === 'urgent' && rfi.status !== 'closed' ? 'border-amber-200' : 'border-slate-200'}`}>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[10px] font-mono text-slate-400 font-bold">{rfi.code}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg ${PRIORITY_CFG[rfi.priority].bg} ${PRIORITY_CFG[rfi.priority].color}`}>{PRIORITY_CFG[rfi.priority].label}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg ${RFI_STATUS_CFG[rfi.status].bg} ${RFI_STATUS_CFG[rfi.status].color}`}>{RFI_STATUS_CFG[rfi.status].label}</span>
                        {rfi.linked_ncr && <span className="text-[9px] bg-violet-100 text-violet-700 font-bold px-2 py-0.5 rounded-lg">{rfi.linked_ncr}</span>}
                      </div>
                      <p className="text-sm font-bold text-slate-700 group-hover:text-amber-700 transition-colors line-clamp-1">{rfi.title}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{rfi.description}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Bản vẽ: {rfi.drawing_ref || '—'} · → {rfi.assigned_to} · Hạn: {rfi.due_date}</p>
                    </div>
                    {dl !== null && rfi.status !== 'closed' && (
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold ${overdue ? 'text-rose-600' : dl <= 3 ? 'text-amber-600' : 'text-slate-400'}`}>
                          {overdue ? `Quá ${Math.abs(dl)}ngày` : dl === 0 ? 'Hôm nay' : `Còn ${dl}ngày`}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── DRAWINGS ──────────────────────────────────────────────────────── */}
      {gsTab === 'drawings' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-3">
            <div>
              <p className="text-sm font-bold text-slate-700">{drawings.length} bản vẽ đang quản lý</p>
              <p className="text-xs text-slate-500">Theo dõi revision, phát hiện lỗi thời, liên kết RFI</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowNewRevForm(v => !v)}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold">
                <Plus size={13} /> Thêm Revision
              </button>
              <button onClick={() => setShowNewDrawingForm(v => !v)}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-bold">
                <Plus size={13} /> Bản vẽ mới
              </button>
            </div>
          </div>



          <div className="space-y-3">
            {drawings.map(d => {
              const hasOpenRFI = rfis.some(r => r.drawing_ref.includes(d.drawing_code) && r.status !== 'closed');
              return (
                <div key={d.id} className={`bg-white border rounded-2xl overflow-hidden ${hasOpenRFI ? 'border-amber-200' : 'border-slate-200'}`}>
                  <div className="px-4 py-3 flex items-center justify-between bg-slate-50 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${discColor(d.discipline)}`}>{d.discipline}</span>
                      <div>
                        <p className="text-xs font-bold text-slate-800">{d.drawing_code} — {d.title}</p>
                        <p className="text-[10px] text-slate-400">{d.format} · Tỷ lệ {d.scale}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasOpenRFI && <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">⚠ Có RFI mở</span>}
                      <span className="text-xs font-bold bg-teal-100 text-teal-700 px-2.5 py-1 rounded-lg">Rev.{d.current_rev}</span>
                    </div>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {[...d.revisions].reverse().map(rev => (
                      <div key={rev.rev} className={`px-4 py-2.5 flex items-center gap-3 ${rev.superseded ? 'opacity-50' : ''}`}>
                        <span className={`text-[10px] font-bold w-8 h-6 rounded flex items-center justify-center shrink-0 ${!rev.superseded ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                          Rev.{rev.rev}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-700">{rev.description}</p>
                          <p className="text-[10px] text-slate-400">{rev.date} · {rev.issued_by}</p>
                        </div>
                        {!rev.superseded
                          ? <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full shrink-0">Hiện hành</span>
                          : <span className="text-[9px] text-slate-400 shrink-0">Lỗi thời</span>
                        }
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {drawings.some(d => d.revisions.length > 1) && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-bold text-amber-800 flex items-center gap-1.5"><AlertTriangle size={13} />Cảnh báo bản vẽ lỗi thời — Nhắc nhở NTP</p>
              {drawings.filter(d => d.revisions.length > 1).map(d => (
                <div key={d.id} className="flex items-center justify-between bg-white rounded-xl px-3 py-2.5 border border-amber-100">
                  <div>
                    <p className="text-xs font-bold text-slate-800">{d.drawing_code} — Rev.{d.current_rev} (hiện hành)</p>
                    <p className="text-[10px] text-amber-700">{d.revisions.filter(r => r.superseded).length} revision cũ: Rev.{d.revisions.filter(r => r.superseded).map(r => r.rev).join(', Rev.')}</p>
                  </div>
                  <button onClick={() => notifOk(`Đã gửi thông báo: Bản vẽ ${d.drawing_code} cập nhật Rev.${d.current_rev}. Thu hồi revision cũ.`)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-[10px] font-bold hover:bg-amber-600 shrink-0 ml-2">
                    <AlertTriangle size={10} /> Thông báo NTP
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* ── APPROVAL QUEUE DRAWER ── */}
      {showApprovalPanel && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setShowApprovalPanel(false)}/>
          <div className="w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-hidden">
            <ApprovalQueue
              projectId={pid}
              projectName={projectName}
              ctx={ctx}
              onClose={() => { setShowApprovalPanel(false); refreshGsQueue(); }}
            />
          </div>
        </div>
      )}
      {/* Print overlay */}
      {printComponent}

      {/* Log detail modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setSelectedLog(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-start rounded-t-2xl">
              <div>
                <p className="text-xs text-slate-400 font-mono">Nhật ký giám sát · {selectedLog.date}</p>
                <h3 className="text-base font-bold text-slate-800 mt-0.5">{selectedLog.area}</h3>
                <p className="text-xs text-slate-500">{selectedLog.inspector} · {selectedLog.weather} {selectedLog.temp} · {selectedLog.workers_count} công nhân</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${selectedLog.status === 'signed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {selectedLog.status === 'signed' ? '✓ Đã ký' : '✏ Nháp'}
                </span>
                <button onClick={() => setSelectedLog(null)}><X size={16} className="text-slate-400" /></button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Kết quả kiểm tra</p>
                <div className="space-y-2">
                  {selectedLog.items.map((item, i) => (
                    <div key={i} className={`rounded-xl p-3 border ${item.result === 'pass' ? 'bg-emerald-50 border-emerald-200' : item.result === 'fail' ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}>
                      <div className="flex items-start gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0 ${RESULT_CFG[item.result].bg} ${RESULT_CFG[item.result].color}`}>
                          {RESULT_CFG[item.result].icon} {RESULT_CFG[item.result].label}
                        </span>
                        <div>
                          <p className="text-xs font-semibold text-slate-700">{item.work}</p>
                          {item.standard && <p className="text-[10px] text-slate-500 italic">TC: {item.standard}</p>}
                          {item.observation && <p className="text-[10px] text-slate-600 mt-0.5">{item.observation}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Kết luận</p>
                <p className="text-xs text-slate-700">{selectedLog.conclusion}</p>
              </div>
              {selectedLog.next_plan && (
                <div className="bg-teal-50 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-teal-600 uppercase tracking-wide mb-1">Kế hoạch tiếp theo</p>
                  <p className="text-xs text-teal-800">{selectedLog.next_plan}</p>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                {selectedLog.status === 'draft' && (
                  <button onClick={() => {
                    const updated = logs.map(l => l.id === selectedLog.id ? { ...l, status: 'signed' as LogStatus } : l);
                    setLogs(updated); saveGS('gs_logs', updated);
                    setSelectedLog({ ...selectedLog, status: 'signed' });
                  }} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-colors">
                    ✓ Ký xác nhận nhật ký
                  </button>
                )}
                <button onClick={() => selectedLog && printSupervisionLog({
                    log: selectedLog,
                    projectName: project?.name || 'Dự án',
                    logNo: `NKGS-${selectedLog.date?.replace(/\//g,'')}`
                  })} className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold ml-auto transition-colors">
                  <Printer size={12} /> Xuất PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODALS — end of component per DESIGN_SYSTEM ── */}

      <ModalForm
        open={showNewRevForm}
        onClose={() => setShowNewRevForm(false)}
        title="Thêm Revision bản vẽ"
        subtitle="Cập nhật phiên bản mới nhất"
        icon={<RefreshCw size={18}/>}
        color="teal"
        width="md"
        footer={<>
          <BtnCancel onClick={() => setShowNewRevForm(false)}/>
          <BtnSubmit label="Lưu Revision" onClick={() => {
            if (!newRevDrawingId) { notifErr('Vui lòng chọn bản vẽ!'); return; }
            if (!newRevCode?.trim()) { notifErr('Vui lòng nhập ký hiệu revision!'); return; }
            const today = new Date().toLocaleDateString('vi-VN');
            const updated = drawings.map(d => {
              if (d.id !== newRevDrawingId) return d;
              return { ...d, current_rev: newRevCode, revisions: [...d.revisions.map(r => ({ ...r, superseded: true })), { rev: newRevCode, date: today, description: newRevDesc || 'Cập nhật', issued_by: newRevIssuer || 'TK', superseded: false }] };
            });
            setDrawings(updated); saveGS('gs_drawings', updated);
            setShowNewRevForm(false); setNewRevCode(''); setNewRevDesc(''); setNewRevIssuer(''); setNewRevDrawingId('');
            notifOk('Đã thêm revision mới!');
          }}/>
        </>}
      >
        <FormGrid cols={2}>
          <div className="col-span-2"><FormRow label="Bản vẽ *">
            <select className={selectCls} value={newRevDrawingId} onChange={e => setNewRevDrawingId(e.target.value)}>
              <option value="">-- Chọn bản vẽ --</option>
              {drawings.map(d => <option key={d.id} value={d.id}>{d.drawing_code} — {d.title}</option>)}
            </select>
          </FormRow></div>
          <FormRow label="Ký hiệu Rev *"><input className={inputCls} placeholder="VD: D" value={newRevCode} onChange={e => setNewRevCode(e.target.value)}/></FormRow>
          <FormRow label="Người phát hành"><input className={inputCls} placeholder="VD: TK Hùng" value={newRevIssuer} onChange={e => setNewRevIssuer(e.target.value)}/></FormRow>
          <div className="col-span-2"><FormRow label="Mô tả thay đổi"><input className={inputCls} placeholder="Mô tả nội dung thay đổi..." value={newRevDesc} onChange={e => setNewRevDesc(e.target.value)}/></FormRow></div>
        </FormGrid>
      </ModalForm>

      <ModalForm open={showLogForm} onClose={() => setShowLogForm(false)}
      title="Tạo Nhật ký Giám sát"
      subtitle="Ghi nhận kết quả giám sát ca hôm nay"
      icon={<ClipboardList size={18}/>} color="teal" width="lg"
      footer={<>
        <BtnCancel onClick={() => setShowLogForm(false)}/>
        <button onClick={() => {
          if (!logForm.area) { notifErr('Vui lòng nhập khu vực!'); return; }
          const newLog: SupervisionLog = {
            id: `gl${Date.now()}`, date: logForm.date || new Date().toLocaleDateString('vi-VN'),
            inspector: logForm.inspector || '', area: logForm.area!,
            weather: logForm.weather || 'Nắng', temp: String(logForm.temp || 32),
            workers_count: logForm.workers_count || 0, items: logForm.items || [],
            conclusion: logForm.conclusion || '', next_plan: logForm.next_plan || '',
            status: 'draft', gemSuggestion: '',
          };
          const updated = [newLog, ...logs]; setLogs(updated); saveGS('gs_logs', updated);
          setShowLogForm(false); setLogForm({ status: 'draft', weather: 'Nắng', workers_count: 0, date: new Date().toLocaleDateString('vi-VN') }); setLogPhotos([]);
          notifOk('Đã lưu nhật ký (nháp)!');
        }} className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-200 text-slate-700 hover:bg-slate-300">
          Lưu nháp
        </button>
        <button onClick={() => {
          if (!logForm.area) { notifErr('Vui lòng nhập khu vực!'); return; }
          const newLog: SupervisionLog = {
            id: `gl${Date.now()}`, date: logForm.date || new Date().toLocaleDateString('vi-VN'),
            inspector: logForm.inspector || '', area: logForm.area!,
            weather: logForm.weather || 'Nắng', temp: String(logForm.temp || 32),
            workers_count: logForm.workers_count || 0, items: logForm.items || [],
            conclusion: logForm.conclusion || '', next_plan: logForm.next_plan || '',
            status: 'signed', gemSuggestion: '',
          };
          const updated = [newLog, ...logs]; setLogs(updated); saveGS('gs_logs', updated);
          setShowLogForm(false); setLogForm({ status: 'draft', weather: 'Nắng', workers_count: 0, date: new Date().toLocaleDateString('vi-VN') }); setLogPhotos([]);
          notifOk('Đã lưu & ký nhật ký!');
        }} className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-800 text-white hover:bg-slate-900">
          Lưu & Ký
        </button>
      </>}
      >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      <input placeholder="Ngày" value={logForm.date || ''} onChange={e => setLogForm(f => ({ ...f, date: e.target.value }))}
      className="text-xs border border-teal-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400" />
      <input placeholder="KS Giám sát" value={logForm.inspector || ''} onChange={e => setLogForm(f => ({ ...f, inspector: e.target.value }))}
      className="text-xs border border-teal-200 rounded-xl px-3 py-2 bg-white focus:outline-none" />
      <input placeholder="Khu vực kiểm tra" value={logForm.area || ''} onChange={e => setLogForm(f => ({ ...f, area: e.target.value }))}
      className="text-xs border border-teal-200 rounded-xl px-3 py-2 bg-white col-span-2 focus:outline-none" />
      </div>
      <div className="grid grid-cols-3 gap-2">
      <select value={logForm.weather} onChange={e => setLogForm(f => ({ ...f, weather: e.target.value }))}
      className="text-xs border border-teal-200 rounded-xl px-3 py-2 bg-white focus:outline-none">
      {['Nắng', 'Mưa', 'Mưa to', 'Âm u', 'Nắng nóng'].map(w => <option key={w}>{w}</option>)}
      </select>
      <input placeholder="Nhiệt độ (VD: 32°C)" value={logForm.temp || ''} onChange={e => setLogForm(f => ({ ...f, temp: e.target.value }))}
      className="text-xs border border-teal-200 rounded-xl px-3 py-2 bg-white focus:outline-none" />
      <input type="number" placeholder="Số công nhân" value={logForm.workers_count || ''} onChange={e => setLogForm(f => ({ ...f, workers_count: Number(e.target.value) }))}
      className="text-xs border border-teal-200 rounded-xl px-3 py-2 bg-white focus:outline-none" />
      </div>
      <div className="space-y-2">
      <p className="text-[10px] font-bold text-teal-700 uppercase tracking-wide">Hạng mục kiểm tra</p>
      {(logForm.items || []).map((item, i) => (
      <div key={i} className="grid grid-cols-1 md:grid-cols-4 gap-2 bg-white rounded-xl p-2 border border-teal-100">
      <input placeholder="Công tác kiểm tra" value={item.work} onChange={e => { const items = [...(logForm.items || [])]; items[i] = { ...items[i], work: e.target.value }; setLogForm(f => ({ ...f, items })); }}
      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none col-span-1" />
      <input placeholder="Tiêu chuẩn áp dụng" value={item.standard} onChange={e => { const items = [...(logForm.items || [])]; items[i] = { ...items[i], standard: e.target.value }; setLogForm(f => ({ ...f, items })); }}
      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none" />
      <select value={item.result} onChange={e => { const items = [...(logForm.items || [])]; items[i] = { ...items[i], result: e.target.value as any }; setLogForm(f => ({ ...f, items })); }}
      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none">
      <option value="pass">✓ Đạt</option>
      <option value="fail">✗ Không đạt</option>
      <option value="note">⚠ Cần lưu ý</option>
      </select>
      <input placeholder="Nhận xét" value={item.observation} onChange={e => { const items = [...(logForm.items || [])]; items[i] = { ...items[i], observation: e.target.value }; setLogForm(f => ({ ...f, items })); }}
      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none" />
      </div>
      ))}
      <button onClick={() => setLogForm(f => ({ ...f, items: [...(f.items || []), { work: '', standard: '', result: 'pass', observation: '' }] }))}
      className="text-[10px] font-semibold text-teal-600 hover:underline flex items-center gap-1">
      <Plus size={10} /> Thêm hạng mục
      </button>
      </div>
      <textarea placeholder="Kết luận tổng thể..." value={logForm.conclusion || ''} onChange={e => setLogForm(f => ({ ...f, conclusion: e.target.value }))} rows={2}
      className="w-full text-xs border border-teal-200 rounded-xl px-3 py-2 bg-white focus:outline-none resize-none" />
      <textarea placeholder="Kế hoạch kiểm tra tiếp theo..." value={logForm.next_plan || ''} onChange={e => setLogForm(f => ({ ...f, next_plan: e.target.value }))} rows={1}
      className="w-full text-xs border border-teal-200 rounded-xl px-3 py-2 bg-white focus:outline-none resize-none" />
      {/* S25: Camera + photo preview */}
      <div className="mt-3 space-y-2">
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={() => setShowLogCamera(true)}
            className="flex items-center gap-1.5 text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded-xl px-3 py-2 hover:bg-teal-100 transition-colors">
            <Camera size={13}/> Chụp ảnh hiện trường ({logPhotos.length})
          </button>
        </div>
        {logPhotos.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {logPhotos.map((p, i) => (
              <div key={i} className="relative group">
                <img src={p.dataUrl} className="w-16 h-16 object-cover rounded-lg border border-slate-200" alt={`Ảnh ${i+1}`}/>
                {p.geoTag && <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] text-center rounded-b-lg py-0.5">GPS✓</div>}
                <button onClick={() => setLogPhotos(prev => prev.filter((_,j) => j !== i))}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-[9px] flex items-center justify-center opacity-0 group-hover:opacity-100">
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      </ModalForm>

      {showLogCamera && (
        <CameraCapture
          projectId={pid}
          category="drawings"
          uploadedBy={logForm.inspector ?? "ks_giam_sat"}
          description={`Nhật ký giám sát — ${logForm.area ?? ""}`}
          onCapture={({dataUrl, geoTag}) => {
            setLogPhotos(prev => [...prev, {dataUrl, geoTag}]);
            setShowLogCamera(false);
          }}
          onClose={() => setShowLogCamera(false)}
        />
      )}

      <ModalForm open={showRFIForm} onClose={() => setShowRFIForm(false)}
      title="Tạo RFI mới"
      subtitle="Yêu cầu làm rõ thông tin / bản vẽ"
      icon={<MessageCircle size={18}/>} color="amber" width="md"
      footer={<>

      <FormSection title="Ho so dinh kem">
        <FormFileUpload files={[]} onChange={()=>{}} accept=".pdf,.docx,.dwg,.jpg" maxFiles={3} label="Ho so RFI / Ban ve lien quan"/>
      </FormSection>
            <BtnCancel onClick={() => setShowRFIForm(false)}/>
      <BtnSubmit label="Gửi RFI" color="blue" onClick={() => {
      if (!rfiForm.title?.trim()) { notifErr('Vui lòng nhập tiêu đề RFI!'); return; }
      const code = `RFI-2026-${String(rfis.length + 1).padStart(3, '0')}`;
      const newR: RFIItem = {
      id: `r${Date.now()}`, code, title: rfiForm.title!,
      description: rfiForm.description || '', drawing_ref: rfiForm.drawing_ref || '',
      submitted_by: rfiForm.submitted_by || '', assigned_to: rfiForm.assigned_to || '',
      submitted_date: rfiForm.submitted_date || new Date().toLocaleDateString('vi-VN'),
      due_date: rfiForm.due_date || '', answered_date: '', status: 'sent',
      priority: rfiForm.priority || 'medium', response: '', linked_ncr: '',
      };
      const updated = [newR, ...rfis]; setRfis(updated); saveGS('gs_rfi', updated);
      setShowRFIForm(false); setRfiForm({ status: 'draft', priority: 'medium', submitted_date: new Date().toLocaleDateString('vi-VN') });
      notifOk('Đã gửi RFI!');
      }}/>
      </>}
      >
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
      <input placeholder="Tiêu đề RFI *" value={rfiForm.title || ''} onChange={e => setRfiForm(f => ({ ...f, title: e.target.value }))}
      className="text-xs border border-amber-200 rounded-xl px-3 py-2 bg-white col-span-2 focus:outline-none focus:ring-2 focus:ring-amber-400" />
      <select value={rfiForm.priority} onChange={e => setRfiForm(f => ({ ...f, priority: e.target.value as any }))}
      className="text-xs border border-amber-200 rounded-xl px-3 py-2 bg-white focus:outline-none">
      <option value="low">Thấp</option><option value="medium">Trung bình</option>
      <option value="high">Cao</option><option value="urgent">Khẩn cấp</option>
      </select>
      </div>
      <textarea placeholder="Mô tả chi tiết yêu cầu làm rõ..." value={rfiForm.description || ''} onChange={e => setRfiForm(f => ({ ...f, description: e.target.value }))} rows={3}
      className="w-full text-xs border border-amber-200 rounded-xl px-3 py-2 bg-white focus:outline-none resize-none" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      <input placeholder="Bản vẽ liên quan" value={rfiForm.drawing_ref || ''} onChange={e => setRfiForm(f => ({ ...f, drawing_ref: e.target.value }))}
      className="text-xs border border-amber-200 rounded-xl px-3 py-2 bg-white focus:outline-none" />
      <input placeholder="Gửi tới" value={rfiForm.assigned_to || ''} onChange={e => setRfiForm(f => ({ ...f, assigned_to: e.target.value }))}
      className="text-xs border border-amber-200 rounded-xl px-3 py-2 bg-white focus:outline-none" />
      <input placeholder="Ngày gửi" value={rfiForm.submitted_date || ''} onChange={e => setRfiForm(f => ({ ...f, submitted_date: e.target.value }))}
      className="text-xs border border-amber-200 rounded-xl px-3 py-2 bg-white focus:outline-none" />
      <input placeholder="Hạn trả lời" value={rfiForm.due_date || ''} onChange={e => setRfiForm(f => ({ ...f, due_date: e.target.value }))}
      className="text-xs border border-amber-200 rounded-xl px-3 py-2 bg-white focus:outline-none" />
      </div>
      </ModalForm>

      <ModalForm
      open={showNewDrawingForm}
      onClose={() => setShowNewDrawingForm(false)}
      title="Thêm bản vẽ mới"
      icon={<Files size={18}/>}
      color="blue" width="md"
      footer={<><BtnCancel onClick={() => setShowNewDrawingForm(false)}/><BtnSubmit label="Lưu bản vẽ" color="blue" onClick={() => { notifOk('Đã thêm bản vẽ!'); setShowNewDrawingForm(false); }}/></>}
      >
      <div className="grid grid-cols-2 gap-2">
      <input placeholder="Mã bản vẽ (VD: SK-201)" value={newDrawingCode} onChange={e => setNewDrawingCode(e.target.value)}
      className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none" />
      <select value={newDrawingDisc} onChange={e => setNewDrawingDisc(e.target.value)}
      className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none">
      {['Kết cấu', 'Kiến trúc', 'MEP', 'Hạ tầng', 'Tổng thể'].map(d => <option key={d}>{d}</option>)}
      </select>
      <input placeholder="Tên bản vẽ" value={newDrawingTitle} onChange={e => setNewDrawingTitle(e.target.value)}
      className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none col-span-2" />
      </div>
      </ModalForm>


    </div>
  );

}