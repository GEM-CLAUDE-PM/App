import { useNotification } from './NotificationEngine';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { LayoutDashboard, Folder, TrendingUp, Clock, HardDrive, CheckCircle2, Lock, FileText, Image as ImageIcon, Files, ClipboardList, ExternalLink, BookOpen, UploadCloud, Loader2, Plus, Printer, Users, HardHat, Camera, ShieldAlert, Sun, MessageCircle, Network, HeartPulse, AlertTriangle, Mic, Edit3, Unlock, X, Award, Target, GraduationCap, Briefcase, ChevronRight, ArrowRight, Building2, CheckCircle, CircleDashed, ArrowLeft, ChevronDown, Cloud, Download, Eye, MoreVertical, ChevronLeft, Calendar, ShieldCheck, Trash2, Sparkles, User, Info, ChevronUp, Wrench, Truck, Fuel, Activity, Zap, Settings, AlertCircle, Search, Scan, FileSpreadsheet, Save, Calculator, Copy, Send } from 'lucide-react';
import { createDocument, submitDocument, getApprovalQueue, type ApprovalDoc } from './approvalEngine';
import { type UserContext, WORKFLOWS, type RoleId } from './permissions';
import ApprovalQueue from './ApprovalQueue';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { mockProjects, mockCashFlowData, mockMaterialData, mockLaborData, mockOrgData, COLORS, mockAttendancePayrollData } from '../constants/mockData';
import { OrgNode } from './dashboard/OrgChart';
import { genAI, GEM_MODEL, GEM_MODEL_QUALITY } from './gemini';

import type { DashboardProps } from './types';
import { db } from './db';

type HSEProps = DashboardProps;

/** Build ctx từ localStorage nếu không có prop — useMemo để stable reference, tránh infinite loop */
function useLocalCtx(ctxProp?: UserContext, projectIdProp?: string): { ctx: UserContext; projectId: string } {
  const roleId = (localStorage.getItem('gem_user_role') || 'chi_huy_truong') as RoleId;
  const userId = localStorage.getItem('gem_user_id') || `user_${roleId}`;
  const userName = localStorage.getItem('gem_user_name') || roleId;
  const projId = projectIdProp || localStorage.getItem('gem_last_project') || 'proj_default';
  // useMemo giữ stable object reference — không tạo object mới mỗi render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ctx = useMemo<UserContext>(
    () => ctxProp ?? { userId, userName, roleId },
    [ctxProp, userId, userName, roleId],
  );
  return { ctx, projectId: projId };
}

export default function HSEWorkspace({ project: selectedProject, projectId: projectIdProp, ctx: ctxProp }: HSEProps) {
  const { ctx, projectId } = useLocalCtx(ctxProp, projectIdProp);
            // ── HSE WORKSPACE ĐẦYĐỦ ─────────────────────────────────────────
  // localStorage helpers removed — persistence via db.ts

  // ── Types ──────────────────────────────────────────────────────
  type IncidentLevel = 'near_miss'|'minor'|'medium'|'major'|'fatal';
  type TrainingStatus = 'scheduled'|'ongoing'|'completed'|'overdue';
  type ViolationLevel = 'nhe'|'trung'|'nghiem_trong';
  type InspectionResult = 'pass'|'fail'|'conditional';

  interface Incident {
    id:string; date:string; time:string; location:string;
    description:string; level:IncidentLevel;
    injured?:string; root_cause:string; action:string;
    status:'open'|'investigating'|'closed'; reporter:string;
  }
  interface Training {
    id:string; title:string; type:string;
    scheduled_date:string; duration_hours:number;
    trainer:string; participants:string[]; max_participants:number;
    status:TrainingStatus; pass_count:number; certificate_expiry_months:number;
    notes:string;
  }
  interface Violation {
    id:string; date:string; worker:string; contractor:string;
    description:string; level:ViolationLevel;
    photo_note:string; action:string; fine_amount:number;
    status:'open'|'resolved'; recurrence:boolean;
  }
  interface Inspection {
    id:string; date:string; inspector:string; area:string;
    checklist_items: {item:string; result:InspectionResult; note:string}[];
    overall:InspectionResult; follow_up:string; next_date:string;
  }

  // ── Seed data ──────────────────────────────────────────────────
  const SEED_INCIDENTS:Incident[] = [
    { id:'i1', date:'03/03/2026', time:'08:15', location:'Zone 2 — Tầng 3',
      description:'Công nhân thầu phụ Phúc Thành ngã giàn giáo, trầy xước tay phải',
      level:'minor', injured:'Nguyễn Văn Cường',
      root_cause:'Không đeo dây an toàn khi làm việc trên cao > 2m',
      action:'Sơ cứu tại chỗ, nghỉ 1 ngày, nhắc nhở toàn đội', status:'closed', reporter:'Trần Minh Hải' },
    { id:'i2', date:'15/02/2026', time:'14:30', location:'Kho vật tư — Cổng B',
      description:'Xe nâng suýt va vào công nhân đi bộ do khu vực thiếu vạch phân làn',
      level:'near_miss', root_cause:'Không có vạch phân làn người và xe trong kho',
      action:'Vẽ vạch phân làn, cắm biển cảnh báo, họp an toàn toàn công trường', status:'closed', reporter:'Lê Thanh Tùng' },
    { id:'i3', date:'20/01/2026', time:'10:00', location:'Khu vực đổ bê tông — Trục A',
      description:'Máy bơm bê tông rò rỉ dầu thủy lực ra nền đất',
      level:'medium', root_cause:'Ống thủy lực lão hóa chưa được thay thế đúng hạn',
      action:'Dừng máy, thay ống, thu gom dầu, báo cáo môi trường', status:'closed', reporter:'Trần Minh Hải' },
  ];
  const SEED_TRAININGS:Training[] = [
    { id:'t1', title:'An toàn làm việc trên cao', type:'Bắt buộc',
      scheduled_date:'10/03/2026', duration_hours:8, trainer:'KS Nguyễn Tuấn Anh',
      participants:[], max_participants:30, status:'scheduled', pass_count:0,
      certificate_expiry_months:12, notes:'Bắt buộc với tất cả công nhân làm việc > 2m' },
    { id:'t2', title:'Phòng chống cháy nổ & PCCC', type:'Bắt buộc',
      scheduled_date:'20/02/2026', duration_hours:4, trainer:'Phòng PCCC Quận 7',
      participants:['Nguyễn Văn A','Trần Thị B','Lê Văn C'], max_participants:50,
      status:'completed', pass_count:48, certificate_expiry_months:24, notes:'Đã hoàn thành — 48/50 đạt' },
    { id:'t3', title:'Sử dụng thiết bị bảo hộ cá nhân (PPE)', type:'Định kỳ',
      scheduled_date:'05/01/2026', duration_hours:2, trainer:'HSE Officer nội bộ',
      participants:[], max_participants:100, status:'completed', pass_count:95,
      certificate_expiry_months:6, notes:'95/100 đạt, 5 người cần tái đào tạo' },
    { id:'t4', title:'An toàn điện công trường', type:'Bắt buộc',
      scheduled_date:'01/02/2026', duration_hours:4, trainer:'Điện lực khu vực',
      participants:[], max_participants:20, status:'overdue', pass_count:0,
      certificate_expiry_months:12, notes:'Bị hoãn do thời tiết — cần sắp xếp lại' },
  ];
  const SEED_VIOLATIONS:Violation[] = [
    { id:'v1', date:'04/03/2026', worker:'Trần Văn Bình', contractor:'Phúc Thành',
      description:'Không đội mũ bảo hiểm khi làm việc trong khu vực thi công',
      level:'trung', photo_note:'Có ảnh chụp camera Zone 2', action:'Nhắc nhở lần 1, ký biên bản',
      fine_amount:500, status:'resolved', recurrence:false },
    { id:'v2', date:'02/03/2026', worker:'Lê Minh Quân', contractor:'Phúc Thành',
      description:'Hút thuốc lá trong kho vật tư dễ cháy',
      level:'nghiem_trong', photo_note:'Bảo vệ bắt gặp', action:'Đình chỉ 3 ngày, phạt tiền, báo cáo NTP',
      fine_amount:2000, status:'resolved', recurrence:true },
    { id:'v3', date:'28/02/2026', worker:'Nguyễn Thị Hoa', contractor:'Minh Khoa',
      description:'Không mặc áo phản quang khi làm việc ban đêm',
      level:'nhe', photo_note:'', action:'Nhắc nhở, phát áo phản quang',
      fine_amount:0, status:'resolved', recurrence:false },
    { id:'v4', date:'01/03/2026', worker:'Phan Văn Đức', contractor:'Thiên Long',
      description:'Vận hành cẩu tháp không đúng vùng an toàn',
      level:'nghiem_trong', photo_note:'Camera ghi lại', action:'Đang điều tra, tạm dừng vận hành',
      fine_amount:0, status:'open', recurrence:false },
  ];
  const SEED_INSPECTIONS:Inspection[] = [
    { id:'ins1', date:'05/03/2026', inspector:'Lê Thanh Tùng', area:'Toàn công trường',
      checklist_items:[
        { item:'Biển cảnh báo an toàn đầy đủ', result:'pass', note:'' },
        { item:'Giàn giáo có lan can bảo vệ', result:'pass', note:'' },
        { item:'Khu vực điện có rào chắn', result:'fail', note:'Zone 3 thiếu rào chắn tủ điện' },
        { item:'Lối thoát hiểm thông thoáng', result:'pass', note:'' },
        { item:'Bình chữa cháy đúng vị trí & còn hạn', result:'conditional', note:'2 bình tại kho B sắp hết hạn 31/03' },
        { item:'Công nhân đủ PPE theo vị trí', result:'pass', note:'' },
        { item:'Vệ sinh công trường đạt chuẩn', result:'pass', note:'' },
      ],
      overall:'conditional', follow_up:'Khắc phục tủ điện Zone 3 & gia hạn bình chữa cháy', next_date:'12/03/2026' },
  ];

  // ── Local state ────────────────────────────────────────────────
  // ── Approval wiring ──────────────────────────────────────────────────────
  const [hseApprovalQueue, setHseApprovalQueue] = useState<ApprovalDoc[]>([]);
  const [showApprovalPanel, setShowApprovalPanel] = useState(false);
  const [printHSE, setPrintHSE] = useState<{content:string}|null>(null);

  const refreshHseQueue = useCallback(() => {
    setHseApprovalQueue(getApprovalQueue(projectId, ctx));
  }, [projectId, ctx]);

  useEffect(() => { refreshHseQueue(); }, [refreshHseQueue]);

  type HseDocType = 'HSE_INCIDENT' | 'PERMIT_TO_WORK' | 'HSE_INSPECTION' | 'CAPA';

  const triggerHseDoc = useCallback((
    title: string,
    docType: HseDocType,
    data: Record<string, unknown> = {},
  ) => {
    if (!WORKFLOWS[docType]) return;
    const cr = createDocument({ projectId, docType, ctx, title, data });
    if (!cr.ok) { alert(`❌ ${(cr as any).error}`); return; }
    const sr = submitDocument(projectId, cr.data!.id, ctx);
    if (sr.ok) {
      refreshHseQueue();
      const el = document.createElement('div');
      el.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] bg-orange-700 text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-2xl';
      el.textContent = `✅ ${docType} "${title}" đã nộp duyệt`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 3500);
    } else {
      alert(`❌ ${(sr as any).error}`);
    }
  }, [projectId, ctx, refreshHseQueue]);
  // ── /Approval wiring ──────────────────────────────────────────────────────

  const [hseTab, setHseTab]             = React.useState<'dashboard'|'incidents'|'trainings'|'violations'|'inspections'|'reports'>('dashboard');
  const [trainingView, setTrainingView] = React.useState<'classes'|'certs'>('classes');
  // Worker certificates
  interface WorkerCert {
    id:string; worker_name:string; contractor:string;
    cert_type:string; cert_no:string;
    issued:string; expiry:string; issued_by:string;
  }
  const SEED_CERTS:WorkerCert[] = [
    { id:'wc1', worker_name:'Nguyễn Văn Công', contractor:'Phúc Thành', cert_type:'An toàn lao động Nhóm 3', cert_no:'AT-2024-1023', issued:'15/01/2024', expiry:'15/01/2026', issued_by:'Sở LĐTBXH TP.HCM' },
    { id:'wc2', worker_name:'Trần Thị Bé', contractor:'Minh Khoa', cert_type:'An toàn lao động Nhóm 4', cert_no:'AT-2024-2045', issued:'20/02/2024', expiry:'20/08/2026', issued_by:'Sở LĐTBXH TP.HCM' },
    { id:'wc3', worker_name:'Lê Văn Đạt', contractor:'Thiên Long', cert_type:'Điện công trường', cert_no:'ĐC-2023-0891', issued:'10/01/2023', expiry:'10/01/2025', issued_by:'Cục ATLĐ' },
    { id:'wc4', worker_name:'Phan Văn Đức', contractor:'Phúc Thành', cert_type:'Làm việc trên cao', cert_no:'TC-2025-0312', issued:'05/03/2025', expiry:'05/03/2027', issued_by:'Sở LĐTBXH TP.HCM' },
    { id:'wc5', worker_name:'Hoàng Minh Tuấn', contractor:'Thiên Long', cert_type:'Vận hành máy xây dựng', cert_no:'MX-2024-0567', issued:'12/06/2024', expiry:'28/03/2026', issued_by:'Trường TC Kỹ thuật' },
  ];
  const [workerCerts, setWorkerCerts]   = React.useState<WorkerCert[]>(SEED_CERTS);
  const [showCertForm, setShowCertForm] = React.useState(false);
  const [certForm, setCertForm]         = React.useState<Partial<WorkerCert>>({});
  const [certSearch, setCertSearch]     = React.useState('');
  const [certFilter, setCertFilter]     = React.useState<'all'|'valid'|'expiring'|'expired'>('all');
  const [incidents, setIncidents]     = React.useState<Incident[]>(SEED_INCIDENTS);
  const [trainings, setTrainings]     = React.useState<Training[]>(SEED_TRAININGS);
  const [violations, setViolations]   = React.useState<Violation[]>(SEED_VIOLATIONS);
  const [inspections, setInspections] = React.useState<Inspection[]>(SEED_INSPECTIONS);

  // ── Load from db on mount ──────────────────────────────────────
  React.useEffect(() => {
    const pid = selectedProject?.id || projectId || 'default';
    db.get<Incident[]>('hse_incidents', pid, SEED_INCIDENTS).then(setIncidents);
    db.get<Training[]>('hse_trainings', pid, SEED_TRAININGS).then(setTrainings);
    db.get<Violation[]>('hse_violations', pid, SEED_VIOLATIONS).then(setViolations);
    db.get<Inspection[]>('hse_inspections', pid, SEED_INSPECTIONS).then(setInspections);
    db.get<WorkerCert[]>('hse_worker_certs', pid, SEED_CERTS).then(setWorkerCerts);
  }, [selectedProject?.id, projectId]);

  // Forms
  const [showIncidentForm, setShowIncidentForm] = React.useState(false);
  const [showTrainingForm, setShowTrainingForm] = React.useState(false);
  const [showViolationForm, setShowViolationForm] = React.useState(false);
  const [showInspectionForm, setShowInspectionForm] = React.useState(false);
  const [selectedIncident, setSelectedIncident] = React.useState<Incident|null>(null);
  const [gemReportLoading, setGemReportLoading] = React.useState(false);
  const [gemReport, setGemReport]               = React.useState('');

  // Form state — incidents
  const [incForm, setIncForm] = React.useState<Partial<Incident>>({ level:'minor', status:'open', date: new Date().toLocaleDateString('vi-VN') });
  const [vioForm, setVioForm] = React.useState<Partial<Violation>>({ level:'nhe', status:'open', fine_amount:0, date: new Date().toLocaleDateString('vi-VN') });
  const [traForm, setTraForm] = React.useState<Partial<Training>>({ status:'scheduled', duration_hours:4, max_participants:30, certificate_expiry_months:12 });

  // ── Computed KPIs ─────────────────────────────────────────────
  const today = new Date();
  const thisMonth = today.getMonth();
  const openIncidents = incidents.filter(i => i.status !== 'closed').length;
  const majorIncidents = incidents.filter(i => ['major','fatal'].includes(i.level)).length;
  const daysSafe = (() => {
    const lastMajor = incidents.filter(i => ['minor','medium','major','fatal'].includes(i.level))
      .sort((a,b) => b.date.localeCompare(a.date))[0];
    if (!lastMajor) return 145;
    const d = lastMajor.date.split('/').reverse().join('-');
    return Math.max(0, Math.round((today.getTime() - new Date(d).getTime()) / 86400000));
  })();
  const overdueTrainings = trainings.filter(t => t.status === 'overdue').length;
  const openViolations   = violations.filter(v => v.status === 'open').length;
  const totalFines       = violations.reduce((s,v) => s + (v.fine_amount||0), 0);
  const lastInspection   = inspections[0];
  const failItems        = lastInspection?.checklist_items.filter(c => c.result === 'fail').length || 0;

  // ── Helpers ──────────────────────────────────────────────────
  const incidentLevelCfg:Record<IncidentLevel,{label:string;color:string;bg:string}> = {
    near_miss:  { label:'Suýt xảy ra', color:'text-slate-600',  bg:'bg-slate-100'   },
    minor:      { label:'Nhẹ',          color:'text-amber-700',  bg:'bg-amber-100'   },
    medium:     { label:'Trung bình',   color:'text-orange-700', bg:'bg-orange-100'  },
    major:      { label:'Nghiêm trọng', color:'text-rose-700',   bg:'bg-rose-100'    },
    fatal:      { label:'Tử vong',      color:'text-rose-900',   bg:'bg-rose-200'    },
  };
  const violationLevelCfg:Record<ViolationLevel,{label:string;color:string;bg:string}> = {
    nhe:           { label:'Nhắc nhở',      color:'text-amber-700',  bg:'bg-amber-100'  },
    trung:         { label:'Cảnh cáo',      color:'text-orange-700', bg:'bg-orange-100' },
    nghiem_trong:  { label:'Nghiêm trọng',  color:'text-rose-700',   bg:'bg-rose-100'   },
  };
  const trainingStatusCfg:Record<TrainingStatus,{label:string;color:string;bg:string}> = {
    scheduled: { label:'Sắp diễn ra', color:'text-blue-700',    bg:'bg-blue-100'    },
    ongoing:   { label:'Đang diễn ra', color:'text-emerald-700', bg:'bg-emerald-100' },
    completed: { label:'Hoàn thành',   color:'text-slate-600',   bg:'bg-slate-100'   },
    overdue:   { label:'Quá hạn',      color:'text-rose-700',    bg:'bg-rose-100'    },
  };
  const _pid = selectedProject?.id || projectId || 'default';
  const saveHSE = <T,>(collection:string, data:T[]) => { db.set(collection, _pid, data); };

  // ── GEM HSE Report ─────────────────────────────────────────────
  const generateHSEReport = async () => {
    setGemReportLoading(true); setGemReport('');
    try {
      const model = genAI.getGenerativeModel({ model: GEM_MODEL,
        systemInstruction:`Bạn là Nàng GEM Siêu Việt — chuyên gia HSE xây dựng. Xưng "em", gọi "Anh/Chị". Giọng nữ miền Nam, thân thiện nhưng nghiêm túc về an toàn. Viết báo cáo ngắn gọn, có số liệu cụ thể, có khuyến nghị ưu tiên.` });
      const r = await model.generateContent(
        `Tạo báo cáo tóm tắt HSE tháng cho dự án ${selectedProject.name}:\n\nKPI:\n- Số ngày an toàn liên tục: ${daysSafe} ngày\n- Sự cố/tai nạn: ${incidents.length} vụ (${openIncidents} chưa đóng)\n- Vi phạm: ${violations.length} lượt (${openViolations} chưa xử lý)\n- Huấn luyện quá hạn: ${overdueTrainings} khóa\n- Kiểm tra gần nhất: ${lastInspection?.date} — ${lastInspection?.overall === 'fail' ? 'Không đạt' : lastInspection?.overall === 'pass' ? 'Đạt' : 'Đạt có điều kiện'}\n- Tổng tiền phạt: ${totalFines.toLocaleString('vi-VN')} nghìn đồng\n\nSự cố gần nhất: ${incidents[0]?.description || 'Không có'}\nVi phạm nghiêm trọng: ${violations.filter(v=>v.level==='nghiem_trong').length} vụ\n\nHãy viết:\n1. Tóm tắt tình hình an toàn tháng (3-4 câu)\n2. Điểm nổi bật tích cực\n3. Vấn đề cần cải thiện ngay (ưu tiên)\n4. Khuyến nghị hành động tuần tới\nViết bằng tiếng Việt, chuyên nghiệp, có thể dùng làm báo cáo gửi Ban Giám đốc.`
      );
      setGemReport(r.response.text());
    } catch { setGemReport('Dạ em chưa kết nối được GEM lúc này, Anh/Chị thử lại sau nhé.'); }
    finally { setGemReportLoading(false); }
  };

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════
  return (
    <div className="space-y-4 animate-in fade-in duration-300">

      {/* HSE Sub-tab bar + Approval button */}
      <div className="flex gap-1.5 flex-wrap bg-white border border-slate-200 rounded-2xl p-2 items-center">
        {/* Approval queue badge */}
        <button
          onClick={() => setShowApprovalPanel(true)}
          className="relative ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-all"
        >
          <ClipboardList size={13}/> Hàng duyệt HSE
          {hseApprovalQueue.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
              {hseApprovalQueue.length}
            </span>
          )}
        </button>
      </div>
      <div className="flex gap-1.5 flex-wrap bg-white border border-slate-200 rounded-2xl p-2">
        {([
          { id:'dashboard',   label:'Tổng quan',      icon:<LayoutDashboard size={13}/>,  color:'rose'    },
          { id:'incidents',   label:'Sự cố / TNLĐ',  icon:<AlertTriangle size={13}/>,    color:'rose'    },
          { id:'violations',  label:'Vi phạm',        icon:<ShieldAlert size={13}/>,      color:'orange'  },
          { id:'trainings',   label:'Huấn luyện AT',  icon:<GraduationCap size={13}/>,    color:'blue'    },
          { id:'inspections', label:'Kiểm tra định kỳ',icon:<ClipboardList size={13}/>,   color:'teal'    },
          { id:'reports',     label:'Báo cáo GEM',    icon:<Sparkles size={13}/>,         color:'emerald' },
        ] as {id:string;label:string;icon:React.ReactNode;color:string}[]).map(t => (
          <button key={t.id} onClick={() => setHseTab(t.id as any)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              hseTab === t.id
                ? t.color==='rose'    ? 'bg-rose-600 text-white shadow-sm'
                : t.color==='orange'  ? 'bg-orange-500 text-white shadow-sm'
                : t.color==='blue'    ? 'bg-blue-600 text-white shadow-sm'
                : t.color==='teal'    ? 'bg-teal-600 text-white shadow-sm'
                                      : 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}>
            {t.icon}{t.label}
            {t.id==='incidents'  && openIncidents > 0   && <span className="bg-white/30 text-[9px] font-bold px-1.5 rounded-full">{openIncidents}</span>}
            {t.id==='violations' && openViolations > 0  && <span className="bg-white/30 text-[9px] font-bold px-1.5 rounded-full">{openViolations}</span>}
            {t.id==='trainings'  && overdueTrainings > 0 && <span className="bg-white/30 text-[9px] font-bold px-1.5 rounded-full">{overdueTrainings}</span>}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD ──────────────────────────────────────────── */}
      {hseTab === 'dashboard' && (
        <div className="space-y-4">
          {/* KPI Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label:'Ngày an toàn', val:String(daysSafe), unit:'ngày', icon:<ShieldCheck size={18}/>, color:'emerald', alert: daysSafe < 30 },
              { label:'Sự cố mở', val:String(openIncidents), unit:'vụ', icon:<AlertTriangle size={18}/>, color:'rose', alert: openIncidents > 0 },
              { label:'Vi phạm chờ xử lý', val:String(openViolations), unit:'lượt', icon:<ShieldAlert size={18}/>, color:'orange', alert: openViolations > 0 },
              { label:'Huấn luyện quá hạn', val:String(overdueTrainings), unit:'khóa', icon:<GraduationCap size={18}/>, color:'amber', alert: overdueTrainings > 0 },
            ].map(k => (
              <div key={k.label} className={`bg-white border rounded-2xl p-4 flex items-center gap-3 transition-all ${k.alert ? 'border-rose-200 bg-rose-50/40 shadow-sm' : 'border-slate-200'}`}>
                <div className={`p-2.5 rounded-xl shrink-0 ${
                  k.color==='emerald' ? 'bg-emerald-100 text-emerald-600' :
                  k.color==='rose'    ? 'bg-rose-100 text-rose-600' :
                  k.color==='orange'  ? 'bg-orange-100 text-orange-600' :
                                        'bg-amber-100 text-amber-600'
                }`}>{k.icon}</div>
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold leading-none mb-0.5">{k.label}</p>
                  <p className="text-xl font-bold text-slate-800 leading-none">{k.val} <span className="text-xs font-normal text-slate-400">{k.unit}</span></p>
                </div>
              </div>
            ))}
          </div>

          {/* Alerts row */}
          {(openIncidents > 0 || openViolations > 0 || overdueTrainings > 0 || failItems > 0) && (
            <div className="space-y-2">
              {openIncidents > 0 && (
                <div onClick={() => setHseTab('incidents')} className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-800 cursor-pointer hover:bg-rose-100 transition-colors">
                  <AlertTriangle size={14} className="text-rose-500 shrink-0"/>
                  <span><strong>{openIncidents} sự cố</strong> chưa đóng — cần cập nhật biện pháp khắc phục</span>
                  <ChevronRight size={14} className="ml-auto text-rose-400"/>
                </div>
              )}
              {overdueTrainings > 0 && (
                <div onClick={() => setHseTab('trainings')} className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 cursor-pointer hover:bg-amber-100 transition-colors">
                  <GraduationCap size={14} className="text-amber-500 shrink-0"/>
                  <span><strong>{overdueTrainings} khóa huấn luyện</strong> quá hạn — cần sắp xếp lại lịch</span>
                  <ChevronRight size={14} className="ml-auto text-amber-400"/>
                </div>
              )}
              {failItems > 0 && (
                <div onClick={() => setHseTab('inspections')} className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-800 cursor-pointer hover:bg-orange-100 transition-colors">
                  <ClipboardList size={14} className="text-orange-500 shrink-0"/>
                  <span>Kiểm tra <strong>{lastInspection?.date}</strong> có <strong>{failItems} hạng mục không đạt</strong> — cần khắc phục trước {lastInspection?.next_date}</span>
                  <ChevronRight size={14} className="ml-auto text-orange-400"/>
                </div>
              )}
            </div>
          )}

          {/* 2-col: Sự cố gần nhất + Training upcoming */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><AlertTriangle size={12} className="text-rose-500"/> Sự cố gần đây</p>
                <button onClick={() => setHseTab('incidents')} className="text-[10px] text-emerald-600 font-semibold hover:underline">Xem tất cả</button>
              </div>
              <div className="divide-y divide-slate-100">
                {incidents.slice(0,3).map(inc => (
                  <div key={inc.id} className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setSelectedIncident(inc)}>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0 mt-0.5 ${incidentLevelCfg[inc.level].bg} ${incidentLevelCfg[inc.level].color}`}>
                      {incidentLevelCfg[inc.level].label}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-700 line-clamp-1">{inc.description}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{inc.date} · {inc.location}</p>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${inc.status==='closed'?'bg-slate-100 text-slate-500':inc.status==='investigating'?'bg-amber-100 text-amber-700':'bg-rose-100 text-rose-700'}`}>
                      {inc.status==='closed'?'Đã đóng':inc.status==='investigating'?'Đang xử lý':'Mở'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><GraduationCap size={12} className="text-blue-500"/> Lịch huấn luyện</p>
                <button onClick={() => setHseTab('trainings')} className="text-[10px] text-emerald-600 font-semibold hover:underline">Xem tất cả</button>
              </div>
              <div className="divide-y divide-slate-100">
                {trainings.slice(0,4).map(t => (
                  <div key={t.id} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0 ${trainingStatusCfg[t.status].bg} ${trainingStatusCfg[t.status].color}`}>
                      {trainingStatusCfg[t.status].label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-700 truncate">{t.title}</p>
                      <p className="text-[10px] text-slate-400">{t.scheduled_date} · {t.duration_hours}h · {t.trainer}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Camera AI + vi phạm recent */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-rose-50 to-orange-50 border border-rose-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-rose-600 rounded-xl flex items-center justify-center shrink-0">
                  <Camera size={15} className="text-white"/>
                </div>
                <div>
                  <p className="text-xs font-bold text-rose-800">GEM Camera AI</p>
                  <p className="text-[10px] text-rose-600">Phát hiện vi phạm PPE tự động</p>
                </div>
              </div>
              <div className="bg-white/60 border border-rose-200 border-dashed rounded-xl p-4 text-center">
                <UploadCloud size={20} className="text-rose-400 mx-auto mb-1.5"/>
                <p className="text-xs font-medium text-rose-800">Tải ảnh hiện trường lên</p>
                <p className="text-[10px] text-rose-600 mt-0.5">GEM sẽ phát hiện: thiếu mũ BH, thiếu áo phản quang, vào vùng cấm</p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><ShieldAlert size={12} className="text-orange-500"/> Vi phạm gần đây</p>
                <button onClick={() => setHseTab('violations')} className="text-[10px] text-emerald-600 font-semibold hover:underline">Xem tất cả</button>
              </div>
              <div className="divide-y divide-slate-100">
                {violations.slice(0,3).map(v => (
                  <div key={v.id} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0 ${violationLevelCfg[v.level].bg} ${violationLevelCfg[v.level].color}`}>
                      {violationLevelCfg[v.level].label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-700 truncate">{v.worker} · {v.contractor}</p>
                      <p className="text-[10px] text-slate-400 truncate">{v.description}</p>
                    </div>
                    {v.recurrence && <span className="text-[9px] font-bold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded shrink-0">Tái phạm</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── INCIDENTS ─────────────────────────────────────────── */}
      {hseTab === 'incidents' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm font-bold text-slate-700">{incidents.length} sự cố được ghi nhận</p>
            <button onClick={() => setShowIncidentForm(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors">
              <Plus size={13}/> Ghi nhận sự cố
            </button>
          </div>

          {/* Incident form */}
          {showIncidentForm && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
              <div className="flex justify-between items-center">
                <p className="text-sm font-bold text-rose-800">📋 Ghi nhận sự cố mới</p>
                <button onClick={() => setShowIncidentForm(false)}><X size={14} className="text-slate-400"/></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input placeholder="Ngày (DD/MM/YYYY)" value={incForm.date||''} onChange={e=>setIncForm(f=>({...f,date:e.target.value}))}
                  className="text-xs border border-rose-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-rose-400"/>
                <input placeholder="Giờ (HH:MM)" value={incForm.time||''} onChange={e=>setIncForm(f=>({...f,time:e.target.value}))}
                  className="text-xs border border-rose-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-rose-400"/>
                <input placeholder="Vị trí xảy ra" value={incForm.location||''} onChange={e=>setIncForm(f=>({...f,location:e.target.value}))}
                  className="text-xs border border-rose-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-rose-400"/>
              </div>
              <textarea placeholder="Mô tả chi tiết sự cố..." value={incForm.description||''} onChange={e=>setIncForm(f=>({...f,description:e.target.value}))} rows={2}
                className="w-full text-xs border border-rose-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none"/>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <select value={incForm.level} onChange={e=>setIncForm(f=>({...f,level:e.target.value as any}))}
                  className="text-xs border border-rose-200 rounded-xl px-3 py-2 bg-white focus:outline-none">
                  <option value="near_miss">Suýt xảy ra</option>
                  <option value="minor">Nhẹ</option>
                  <option value="medium">Trung bình</option>
                  <option value="major">Nghiêm trọng</option>
                  <option value="fatal">Tử vong</option>
                </select>
                <input placeholder="Người bị nạn (nếu có)" value={incForm.injured||''} onChange={e=>setIncForm(f=>({...f,injured:e.target.value}))}
                  className="text-xs border border-rose-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-rose-400"/>
                <input placeholder="Người báo cáo" value={incForm.reporter||''} onChange={e=>setIncForm(f=>({...f,reporter:e.target.value}))}
                  className="text-xs border border-rose-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-rose-400"/>
              </div>
              <input placeholder="Nguyên nhân gốc rễ" value={incForm.root_cause||''} onChange={e=>setIncForm(f=>({...f,root_cause:e.target.value}))}
                className="w-full text-xs border border-rose-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-rose-400"/>
              <input placeholder="Biện pháp xử lý / khắc phục" value={incForm.action||''} onChange={e=>setIncForm(f=>({...f,action:e.target.value}))}
                className="w-full text-xs border border-rose-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-rose-400"/>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowIncidentForm(false)} className="px-4 py-2 text-xs text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50">Huỷ</button>
                <button onClick={() => {
                  if (!incForm.description || !incForm.date) return;
                  const newInc:Incident = { id:`i${Date.now()}`, date:incForm.date!, time:incForm.time||'', location:incForm.location||'',
                    description:incForm.description!, level:incForm.level||'minor', injured:incForm.injured,
                    root_cause:incForm.root_cause||'', action:incForm.action||'', status:'open', reporter:incForm.reporter||'' };
                  const updated = [newInc, ...incidents];
                  setIncidents(updated); saveHSE('hse_incidents', updated);
                  // Tự động gửi vào hàng duyệt nếu sự cố nghiêm trọng
                  if (incForm.level === 'serious' || incForm.level === 'fatal') {
                    triggerHseDoc(
                      `Sự cố: ${incForm.description?.slice(0, 60)}`,
                      'HSE_INCIDENT',
                      { incident: newInc },
                    );
                  }
                  setShowIncidentForm(false); setIncForm({ level:'minor', status:'open', date: new Date().toLocaleDateString('vi-VN') });
                }} className="px-4 py-2 text-xs bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-colors">
                  Lưu & Báo cáo sự cố
                </button>
              </div>
            </div>
          )}

          {/* Incident detail modal */}
          {selectedIncident && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setSelectedIncident(null)}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-in zoom-in-95 duration-200" onClick={e=>e.stopPropagation()}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${incidentLevelCfg[selectedIncident.level].bg} ${incidentLevelCfg[selectedIncident.level].color}`}>
                      {incidentLevelCfg[selectedIncident.level].label}
                    </span>
                    <h3 className="text-base font-bold text-slate-800 mt-2 leading-snug">{selectedIncident.description}</h3>
                  </div>
                  <button onClick={() => setSelectedIncident(null)}><X size={16} className="text-slate-400"/></button>
                </div>
                <div className="space-y-2 text-sm">
                  {[
                    ['📅 Thời gian',     `${selectedIncident.date} ${selectedIncident.time}`],
                    ['📍 Vị trí',        selectedIncident.location],
                    ['👤 Người bị nạn',  selectedIncident.injured || 'Không có'],
                    ['🔍 Nguyên nhân',   selectedIncident.root_cause],
                    ['✅ Biện pháp',     selectedIncident.action],
                    ['📋 Người báo cáo', selectedIncident.reporter],
                  ].map(([k,v]) => (
                    <div key={k} className="flex gap-3 py-1.5 border-b border-slate-100">
                      <span className="text-xs text-slate-400 w-32 shrink-0">{k}</span>
                      <span className="text-xs text-slate-700 font-medium">{v}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center mt-4">
                  <select defaultValue={selectedIncident.status} onChange={e => {
                    const updated = incidents.map(i => i.id === selectedIncident.id ? {...i, status:e.target.value as any} : i);
                    setIncidents(updated); saveHSE('hse_incidents', updated);
                    setSelectedIncident({...selectedIncident, status:e.target.value as any});
                  }} className="text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none">
                    <option value="open">Mở</option>
                    <option value="investigating">Đang điều tra</option>
                    <option value="closed">Đã đóng</option>
                  </select>
                  <button onClick={() => setSelectedIncident(null)} className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold">Đóng</button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {incidents.map(inc => (
              <div key={inc.id} onClick={() => setSelectedIncident(inc)}
                className="bg-white border border-slate-200 rounded-2xl p-4 flex items-start gap-3 hover:shadow-md hover:border-rose-200 transition-all cursor-pointer group">
                <span className={`text-[10px] font-bold px-2 py-1 rounded-xl shrink-0 ${incidentLevelCfg[inc.level].bg} ${incidentLevelCfg[inc.level].color}`}>
                  {incidentLevelCfg[inc.level].label}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-700 group-hover:text-rose-700 transition-colors line-clamp-1">{inc.description}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{inc.date} {inc.time} · {inc.location} · Báo cáo: {inc.reporter}</p>
                  {inc.injured && <p className="text-[10px] text-rose-600 font-semibold mt-0.5">⚠ Người bị nạn: {inc.injured}</p>}
                </div>
                <span className={`text-[9px] font-bold px-2 py-1 rounded-full shrink-0 ${
                  inc.status==='closed'?'bg-slate-100 text-slate-500':inc.status==='investigating'?'bg-amber-100 text-amber-700':'bg-rose-100 text-rose-700'
                }`}>{inc.status==='closed'?'Đã đóng':inc.status==='investigating'?'Đang xử lý':'Mở'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── VIOLATIONS ────────────────────────────────────────── */}
      {hseTab === 'violations' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-bold text-slate-700">{violations.length} vi phạm được ghi nhận</p>
              <p className="text-xs text-slate-500">Tổng tiền phạt: <span className="font-bold text-orange-600">{totalFines.toLocaleString('vi-VN')}K đồng</span> · Tái phạm: {violations.filter(v=>v.recurrence).length} người</p>
            </div>
            <button onClick={() => setShowViolationForm(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition-colors">
              <Plus size={13}/> Ghi vi phạm
            </button>
          </div>

          {showViolationForm && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
              <div className="flex justify-between items-center">
                <p className="text-sm font-bold text-orange-800">⚠️ Ghi nhận vi phạm</p>
                <button onClick={() => setShowViolationForm(false)}><X size={14} className="text-slate-400"/></button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <input placeholder="Ngày" value={vioForm.date||''} onChange={e=>setVioForm(f=>({...f,date:e.target.value}))}
                  className="text-xs border border-orange-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"/>
                <input placeholder="Tên công nhân" value={vioForm.worker||''} onChange={e=>setVioForm(f=>({...f,worker:e.target.value}))}
                  className="text-xs border border-orange-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"/>
                <input placeholder="Nhà thầu" value={vioForm.contractor||''} onChange={e=>setVioForm(f=>({...f,contractor:e.target.value}))}
                  className="text-xs border border-orange-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"/>
                <select value={vioForm.level} onChange={e=>setVioForm(f=>({...f,level:e.target.value as any}))}
                  className="text-xs border border-orange-200 rounded-xl px-3 py-2 bg-white focus:outline-none">
                  <option value="nhe">Nhắc nhở</option>
                  <option value="trung">Cảnh cáo</option>
                  <option value="nghiem_trong">Nghiêm trọng</option>
                </select>
              </div>
              <textarea placeholder="Mô tả vi phạm..." value={vioForm.description||''} onChange={e=>setVioForm(f=>({...f,description:e.target.value}))} rows={2}
                className="w-full text-xs border border-orange-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"/>
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Biện pháp xử lý" value={vioForm.action||''} onChange={e=>setVioForm(f=>({...f,action:e.target.value}))}
                  className="text-xs border border-orange-200 rounded-xl px-3 py-2 bg-white focus:outline-none"/>
                <input type="number" placeholder="Tiền phạt (K đồng)" value={vioForm.fine_amount||''} onChange={e=>setVioForm(f=>({...f,fine_amount:Number(e.target.value)}))}
                  className="text-xs border border-orange-200 rounded-xl px-3 py-2 bg-white focus:outline-none"/>
              </div>
              <label className="flex items-center gap-2 text-xs text-orange-700 cursor-pointer">
                <input type="checkbox" checked={vioForm.recurrence||false} onChange={e=>setVioForm(f=>({...f,recurrence:e.target.checked}))} className="rounded"/>
                Đây là vi phạm tái diễn
              </label>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowViolationForm(false)} className="px-4 py-2 text-xs text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50">Huỷ</button>
                <button onClick={() => {
                  if (!vioForm.description || !vioForm.worker) return;
                  const newV:Violation = { id:`v${Date.now()}`, date:vioForm.date!, worker:vioForm.worker!, contractor:vioForm.contractor||'',
                    description:vioForm.description!, level:vioForm.level||'nhe', photo_note:'', action:vioForm.action||'',
                    fine_amount:vioForm.fine_amount||0, status:'open', recurrence:vioForm.recurrence||false };
                  const updated = [newV, ...violations];
                  setViolations(updated); saveHSE('hse_violations', updated);
                  setShowViolationForm(false); setVioForm({ level:'nhe', status:'open', fine_amount:0, date: new Date().toLocaleDateString('vi-VN') });
                }} className="px-4 py-2 text-xs bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold">
                  Lưu vi phạm
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {violations.map(v => (
              <div key={v.id} className={`bg-white border rounded-2xl p-4 flex items-start gap-3 hover:shadow-sm transition-all ${v.status==='open'?'border-orange-200':'border-slate-200'}`}>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-xl shrink-0 ${violationLevelCfg[v.level].bg} ${violationLevelCfg[v.level].color}`}>
                  {violationLevelCfg[v.level].label}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-bold text-slate-700">{v.worker}</p>
                    <span className="text-[10px] text-slate-400">·</span>
                    <p className="text-xs text-slate-500">{v.contractor}</p>
                    {v.recurrence && <span className="text-[9px] font-bold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">🔁 Tái phạm</span>}
                  </div>
                  <p className="text-xs text-slate-600">{v.description}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{v.date} · {v.action}{v.fine_amount > 0 ? ` · Phạt: ${v.fine_amount.toLocaleString('vi-VN')}K` : ''}</p>
                </div>
                <button onClick={() => {
                  const updated = violations.map(x => x.id === v.id ? {...x, status: x.status==='open'?'resolved':'open'} : x) as Violation[];
                  setViolations(updated); saveHSE('hse_violations', updated);
                }} className={`text-[9px] font-bold px-2 py-1 rounded-full shrink-0 cursor-pointer transition-colors ${v.status==='open'?'bg-orange-100 text-orange-700 hover:bg-orange-200':'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                  {v.status==='open'?'Chờ xử lý':'Đã xử lý'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {hseTab === 'trainings' && (
        <div className="space-y-4">
          {/* Toggle: Khóa học vs Chứng chỉ cá nhân */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-700">{trainings.length} khóa huấn luyện</p>
              <p className="text-xs text-slate-500">{trainings.filter(t=>t.status==='completed').length} hoàn thành · {overdueTrainings} quá hạn · {trainings.filter(t=>t.status==='scheduled').length} sắp diễn ra</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-slate-100 rounded-xl p-0.5 border border-slate-200">
                <button
                  onClick={() => setTrainingView('classes')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${trainingView==='classes' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  ?? Khóa học
                </button>
                <button
                  onClick={() => setTrainingView('certs')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${trainingView==='certs' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  ?? Chứng chỉ cá nhân
                </button>
              </div>
              {trainingView === 'classes' && (
                <button onClick={() => setShowTrainingForm(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors">
                  <Plus size={13}/> Thêm khóa học
                </button>
              )}
              {trainingView === 'certs' && (
                <button onClick={() => setShowCertForm(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors">
                  <Plus size={13}/> Thêm chứng chỉ
                </button>
              )}
            </div>
          </div>

          {/* ── VIEW: KHÓA HỌC ── */}
          {trainingView === 'classes' && (
            <div className="space-y-3">
              {showTrainingForm && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-bold text-blue-800">?? Thêm khóa huấn luyện</p>
                    <button onClick={() => setShowTrainingForm(false)}><X size={14} className="text-slate-400"/></button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="Tên khóa học" value={traForm.title||''} onChange={e=>setTraForm(f=>({...f,title:e.target.value}))}
                      className="text-xs border border-blue-200 rounded-xl px-3 py-2 bg-white col-span-2 focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                    <input placeholder="Ngày tổ chức" value={traForm.scheduled_date||''} onChange={e=>setTraForm(f=>({...f,scheduled_date:e.target.value}))}
                      className="text-xs border border-blue-200 rounded-xl px-3 py-2 bg-white focus:outline-none"/>
                    <input placeholder="Giảng viên" value={traForm.trainer||''} onChange={e=>setTraForm(f=>({...f,trainer:e.target.value}))}
                      className="text-xs border border-blue-200 rounded-xl px-3 py-2 bg-white focus:outline-none"/>
                    <input type="number" placeholder="Số giờ" value={traForm.duration_hours||''} onChange={e=>setTraForm(f=>({...f,duration_hours:Number(e.target.value)}))}
                      className="text-xs border border-blue-200 rounded-xl px-3 py-2 bg-white focus:outline-none"/>
                    <input type="number" placeholder="Số người tối đa" value={traForm.max_participants||''} onChange={e=>setTraForm(f=>({...f,max_participants:Number(e.target.value)}))}
                      className="text-xs border border-blue-200 rounded-xl px-3 py-2 bg-white focus:outline-none"/>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowTrainingForm(false)} className="px-4 py-2 text-xs text-slate-600 bg-white border border-slate-200 rounded-xl">Huỷ</button>
                    <button onClick={() => {
                      if (!traForm.title) return;
                      const newT:Training = { id:`t${Date.now()}`, title:traForm.title!, type:'Bắt buộc',
                        scheduled_date:traForm.scheduled_date||'', duration_hours:traForm.duration_hours||4,
                        trainer:traForm.trainer||'', participants:[], max_participants:traForm.max_participants||30,
                        status:'scheduled', pass_count:0, certificate_expiry_months:12, notes:'' };
                      const updated = [...trainings, newT];
                      setTrainings(updated); saveHSE('hse_trainings', updated);
                      setShowTrainingForm(false); setTraForm({ status:'scheduled', duration_hours:4, max_participants:30, certificate_expiry_months:12 });
                    }} className="px-4 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold">Lưu</button>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                {trainings.map(t => {
                  const passPct = t.pass_count && t.max_participants ? Math.round(t.pass_count/t.max_participants*100) : 0;
                  return (
                    <div key={t.id} className={`bg-white border rounded-2xl p-4 hover:shadow-sm transition-all ${t.status==='overdue'?'border-rose-200 bg-rose-50/20':t.status==='scheduled'?'border-blue-200':'border-slate-200'}`}>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${trainingStatusCfg[t.status].bg} ${trainingStatusCfg[t.status].color}`}>
                              {trainingStatusCfg[t.status].label}
                            </span>
                            <span className="text-[10px] text-slate-400">{t.type}</span>
                          </div>
                          <p className="text-sm font-bold text-slate-700">{t.title}</p>
                          <p className="text-[10px] text-slate-400">{t.scheduled_date} · {t.duration_hours}h · {t.trainer} · Tối đa {t.max_participants} người</p>
                        </div>
                        {t.status === 'completed' && (
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-emerald-600">{t.pass_count}/{t.max_participants}</p>
                            <p className="text-[10px] text-slate-400">đạt ({passPct}%)</p>
                          </div>
                        )}
                      </div>
                      {t.status === 'completed' && (
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{width:`${passPct}%`}}/>
                        </div>
                      )}
                      {t.notes && <p className="text-[10px] text-slate-500 mt-2 italic">{t.notes}</p>}
                      {t.status !== 'completed' && (
                        <button onClick={() => {
                          const updated = trainings.map(x => x.id===t.id ? {...x,status:'completed',pass_count:Math.round(x.max_participants*0.95)} : x) as Training[];
                          setTrainings(updated); saveHSE('hse_trainings', updated);
                        }} className="mt-2 text-[10px] font-semibold text-blue-600 hover:underline">
                          → Đánh dấu hoàn thành
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── VIEW: CHỨNG CHỈ CÁ NHÂN ── */}
          {trainingView === 'certs' && (
            <div className="space-y-3">
              {/* Cảnh báo hết hạn */}
              {workerCerts.filter(c => {
                const exp = new Date(c.expiry.split('/').reverse().join('-'));
                const diff = Math.floor((exp.getTime() - Date.now()) / 86400000);
                return diff <= 30 && diff >= 0;
              }).length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2">
                  <AlertTriangle size={14} className="text-amber-600 shrink-0"/>
                  <p className="text-xs text-amber-800 font-medium">
                    {workerCerts.filter(c => {
                      const exp = new Date(c.expiry.split('/').reverse().join('-'));
                      return Math.floor((exp.getTime()-Date.now())/86400000) <= 30;
                    }).length} chứng chỉ sắp hết hạn trong 30 ngày
                  </p>
                </div>
              )}

              {/* Form thêm chứng chỉ */}
              {showCertForm && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-bold text-emerald-800">?? Thêm chứng chỉ cá nhân</p>
                    <button onClick={() => setShowCertForm(false)}><X size={14} className="text-slate-400"/></button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="Họ và tên *" value={certForm.worker_name||''} onChange={e=>setCertForm(f=>({...f,worker_name:e.target.value}))}
                      className="text-xs border border-emerald-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"/>
                    <input placeholder="Tổ đội / Nhà thầu" value={certForm.contractor||''} onChange={e=>setCertForm(f=>({...f,contractor:e.target.value}))}
                      className="text-xs border border-emerald-200 rounded-xl px-3 py-2 bg-white focus:outline-none"/>
                    <select value={certForm.cert_type||''} onChange={e=>setCertForm(f=>({...f,cert_type:e.target.value}))}
                      className="text-xs border border-emerald-200 rounded-xl px-3 py-2 bg-white focus:outline-none">
                      <option value="">Loại chứng chỉ...</option>
                      <option>An toàn lao động Nhóm 1</option>
                      <option>An toàn lao động Nhóm 2</option>
                      <option>An toàn lao động Nhóm 3</option>
                      <option>An toàn lao động Nhóm 4</option>
                      <option>An toàn lao động Nhóm 5</option>
                      <option>Vận hành máy xây dựng</option>
                      <option>Điện công trường</option>
                      <option>Làm việc trên cao</option>
                      <option>PCCC cơ bản</option>
                      <option>Sơ cứu y tế</option>
                    </select>
                    <input placeholder="Số chứng chỉ" value={certForm.cert_no||''} onChange={e=>setCertForm(f=>({...f,cert_no:e.target.value}))}
                      className="text-xs border border-emerald-200 rounded-xl px-3 py-2 bg-white focus:outline-none"/>
                    <input placeholder="Ngày cấp (DD/MM/YYYY)" value={certForm.issued||''} onChange={e=>setCertForm(f=>({...f,issued:e.target.value}))}
                      className="text-xs border border-emerald-200 rounded-xl px-3 py-2 bg-white focus:outline-none"/>
                    <input placeholder="Ngày hết hạn (DD/MM/YYYY)" value={certForm.expiry||''} onChange={e=>setCertForm(f=>({...f,expiry:e.target.value}))}
                      className="text-xs border border-emerald-200 rounded-xl px-3 py-2 bg-white focus:outline-none"/>
                    <input placeholder="Nơi cấp" value={certForm.issued_by||''} onChange={e=>setCertForm(f=>({...f,issued_by:e.target.value}))}
                      className="text-xs border border-emerald-200 rounded-xl px-3 py-2 bg-white col-span-2 focus:outline-none"/>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowCertForm(false)} className="px-4 py-2 text-xs text-slate-600 bg-white border border-slate-200 rounded-xl">Huỷ</button>
                    <button onClick={() => {
                      if (!certForm.worker_name || !certForm.cert_type) return;
                      const newC:WorkerCert = {
                        id: `wc${Date.now()}`,
                        worker_name: certForm.worker_name!,
                        contractor: certForm.contractor||'',
                        cert_type: certForm.cert_type!,
                        cert_no: certForm.cert_no||'',
                        issued: certForm.issued||'',
                        expiry: certForm.expiry||'',
                        issued_by: certForm.issued_by||'',
                      };
                      const updated = [...workerCerts, newC];
                      setWorkerCerts(updated);
                      saveHSE('hse_worker_certs', updated);
                      setShowCertForm(false); setCertForm({});
                    }} className="px-4 py-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold">Lưu</button>
                  </div>
                </div>
              )}

              {/* Bộ lọc */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                  <input value={certSearch} onChange={e=>setCertSearch(e.target.value)}
                    placeholder="Tìm tên, tổ đội, loại chứng chỉ..."
                    className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400"/>
                </div>
                <select value={certFilter} onChange={e=>setCertFilter(e.target.value as any)}
                  className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none">
                  <option value="all">Tất cả</option>
                  <option value="valid">Còn hạn</option>
                  <option value="expiring">Sắp hết hạn (30 ngày)</option>
                  <option value="expired">Đã hết hạn</option>
                </select>
              </div>

              {/* Danh sách chứng chỉ */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">Họ và tên</th>
                      <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">Loại chứng chỉ</th>
                      <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px] hidden md:table-cell">Số CC / Nơi cấp</th>
                      <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">Hết hạn</th>
                      <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">Trạng thái</th>
                      <th className="px-4 py-3 text-[10px]"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {workerCerts
                      .filter(c => {
                        const q = certSearch.toLowerCase();
                        const matchSearch = !q || c.worker_name.toLowerCase().includes(q) || c.contractor.toLowerCase().includes(q) || c.cert_type.toLowerCase().includes(q);
                        const exp = new Date(c.expiry.split('/').reverse().join('-'));
                        const diff = Math.floor((exp.getTime()-Date.now())/86400000);
                        const matchFilter = certFilter==='all' || (certFilter==='valid'&&diff>30) || (certFilter==='expiring'&&diff<=30&&diff>=0) || (certFilter==='expired'&&diff<0);
                        return matchSearch && matchFilter;
                      })
                      .map(c => {
                        const exp = new Date(c.expiry.split('/').reverse().join('-'));
                        const diff = Math.floor((exp.getTime()-Date.now())/86400000);
                        const isExpired = diff < 0;
                        const isExpiring = diff >= 0 && diff <= 30;
                        return (
                          <tr key={c.id} className={`hover:bg-slate-50 transition-colors ${isExpired?'bg-rose-50/30':isExpiring?'bg-amber-50/30':''}`}>
                            <td className="px-4 py-3">
                              <p className="font-bold text-slate-800">{c.worker_name}</p>
                              <p className="text-[10px] text-slate-400">{c.contractor}</p>
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-700">{c.cert_type}</td>
                            <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                              <p>{c.cert_no || '—'}</p>
                              <p className="text-[10px] text-slate-400">{c.issued_by}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className={`font-medium ${isExpired?'text-rose-600':isExpiring?'text-amber-600':'text-slate-700'}`}>{c.expiry}</p>
                              {isExpired && <p className="text-[10px] text-rose-500">Hết hạn {Math.abs(diff)} ngày trước</p>}
                              {isExpiring && <p className="text-[10px] text-amber-500">Còn {diff} ngày</p>}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${isExpired?'bg-rose-100 text-rose-700':isExpiring?'bg-amber-100 text-amber-700':'bg-emerald-100 text-emerald-700'}`}>
                                {isExpired ? 'Hết hạn' : isExpiring ? 'Sắp hết hạn' : 'Còn hạn'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <button onClick={() => {
                                const updated = workerCerts.filter(x=>x.id!==c.id);
                                setWorkerCerts(updated);
                                saveHSE('hse_worker_certs', updated);
                              }} className="text-slate-300 hover:text-rose-500 transition-colors">
                                <X size={14}/>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    {workerCerts.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-xs">Chưa có chứng chỉ nào. Nhấn "Thêm chứng chỉ" để bắt đầu.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── INSPECTIONS ──────────────────────────────────────── */}
      {hseTab === 'inspections' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm font-bold text-slate-700">{inspections.length} đợt kiểm tra</p>
            <button className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-colors">
              <Plus size={13}/> Tạo đợt kiểm tra
            </button>
          </div>
          {inspections.map(ins => (
            <div key={ins.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className={`px-4 py-3 flex items-center justify-between ${ins.overall==='pass'?'bg-emerald-50 border-b border-emerald-200':ins.overall==='fail'?'bg-rose-50 border-b border-rose-200':'bg-amber-50 border-b border-amber-200'}`}>
                <div>
                  <p className="text-sm font-bold text-slate-800">{ins.area} — {ins.date}</p>
                  <p className="text-[10px] text-slate-500">Kiểm tra bởi: {ins.inspector} · Kiểm tra tiếp theo: {ins.next_date}</p>
                </div>
                <span className={`text-xs font-bold px-3 py-1 rounded-xl ${ins.overall==='pass'?'bg-emerald-100 text-emerald-700':ins.overall==='fail'?'bg-rose-100 text-rose-700':'bg-amber-100 text-amber-700'}`}>
                  {ins.overall==='pass'?'✅ Đạt':ins.overall==='fail'?'❌ Không đạt':'⚠️ Đạt có điều kiện'}
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {ins.checklist_items.map((item, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0 ${item.result==='pass'?'bg-emerald-100 text-emerald-700':item.result==='fail'?'bg-rose-100 text-rose-700':'bg-amber-100 text-amber-700'}`}>
                      {item.result==='pass'?'✓ Đạt':item.result==='fail'?'✗ Không đạt':'⚠ Có điều kiện'}
                    </span>
                    <p className="text-xs text-slate-700 flex-1">{item.item}</p>
                    {item.note && <p className="text-[10px] text-slate-400 italic">{item.note}</p>}
                  </div>
                ))}
              </div>
              {ins.follow_up && (
                <div className="px-4 py-3 bg-amber-50 border-t border-amber-200">
                  <p className="text-[10px] text-amber-800"><strong>Hành động khắc phục:</strong> {ins.follow_up}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── REPORTS / GEM ─────────────────────────────────────── */}
      {hseTab === 'reports' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-5 text-white">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <Sparkles size={20}/>
              </div>
              <div>
                <h3 className="text-base font-bold">GEM Báo cáo HSE tự động</h3>
                <p className="text-xs text-emerald-100 mt-0.5">Tổng hợp từ dữ liệu thực tế — sự cố, vi phạm, huấn luyện, kiểm tra</p>
              </div>
            </div>
            <button onClick={generateHSEReport} disabled={gemReportLoading}
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-emerald-700 rounded-xl text-sm font-bold hover:bg-emerald-50 transition-colors disabled:opacity-60">
              {gemReportLoading ? <><Loader2 size={14} className="animate-spin"/> Đang phân tích...</> : <><Sparkles size={14}/> Tạo báo cáo HSE tháng</>}
            </button>
          </div>
          {gemReport && (
            <div className="bg-white border border-emerald-200 rounded-2xl p-5">
              <p className="text-xs font-bold text-emerald-700 mb-3 flex items-center gap-1.5"><Sparkles size={12}/> Báo cáo HSE — Nàng GEM</p>
              <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{gemReport}</div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => navigator.clipboard.writeText(gemReport)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-semibold text-slate-600 transition-colors">
                  <Copy size={12}/> Sao chép
                </button>
                <button onClick={() => setPrintHSE({ content: gemReport })}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-semibold text-slate-600 transition-colors">
                  <Printer size={12}/> In báo cáo
                </button>
              </div>
            </div>
          )}

          {/* Quick stats for report */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label:'LTIFR', val:'0.0', desc:'Lost Time Injury Frequency Rate', color:'emerald' },
              { label:'Tổng sự cố', val:String(incidents.length), desc:'Tổng cộng từ đầu dự án', color:'rose' },
              { label:'Tổng vi phạm', val:String(violations.length), desc:`Tiền phạt: ${totalFines}K đồng`, color:'orange' },
              { label:'Hoàn thành HLuyện', val:`${trainings.filter(t=>t.status==='completed').length}/${trainings.length}`, desc:'Khóa đã hoàn thành', color:'blue' },
              { label:'Tỷ lệ tuân thủ', val:`${Math.round((violations.length===0?100:Math.max(0,100-violations.length*2)))}%`, desc:'Ước tính từ vi phạm', color:'teal' },
              { label:'Ngày an toàn', val:String(daysSafe), desc:'Ngày liên tục không TNLĐ', color:'emerald' },
            ].map(s => (
              <div key={s.label} className="bg-white border border-slate-200 rounded-2xl p-4">
                <p className="text-[10px] text-slate-400 font-semibold">{s.label}</p>
                <p className={`text-2xl font-bold mt-0.5 ${s.color==='emerald'?'text-emerald-600':s.color==='rose'?'text-rose-600':s.color==='orange'?'text-orange-600':s.color==='blue'?'text-blue-600':'text-teal-600'}`}>{s.val}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* ── APPROVAL QUEUE DRAWER ── */}
      {showApprovalPanel && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setShowApprovalPanel(false)}/>
          <div className="w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-hidden">
            <ApprovalQueue
              projectId={projectId}
              projectName={selectedProject?.name || 'Dự án'}
              ctx={ctx}
              onClose={() => { setShowApprovalPanel(false); refreshHseQueue(); }}
            />
          </div>
        </div>
      )}

      {printHSE && <HSEReportPrint
        data={{
          reportContent: printHSE.content || '',
          projectName: selectedProject?.name || 'Dự án',
          projectId,
          preparedBy: 'Cán bộ HSE',
          stats: {
            incidents: incidents.length,
            inspections: inspections.length,
            violations: violations.length,
            trainings: trainings.length,
          }
        }}
        onClose={() => setPrintHSE(null)}
      />}
    </div>
  );
}
