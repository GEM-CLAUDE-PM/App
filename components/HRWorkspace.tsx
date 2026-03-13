import { useNotification } from './NotificationEngine';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LayoutDashboard, Folder, TrendingUp, Clock, HardDrive, CheckCircle2, Lock, FileText, Image as ImageIcon, Files, ClipboardList, ExternalLink, BookOpen, UploadCloud, Loader2, Plus, Printer, Users, HardHat, Camera, ShieldAlert, Sun, MessageCircle, Network, HeartPulse, AlertTriangle, Mic, Edit3, Unlock, X, Award, Target, GraduationCap, Briefcase, ChevronRight, ArrowRight, Building2, CheckCircle, CircleDashed, ArrowLeft, ChevronDown, Cloud, Download, Eye, MoreVertical, ChevronLeft, Calendar, ShieldCheck, Trash2, Sparkles, User, Info, ChevronUp, Wrench, Truck, Fuel, Activity, Zap, Settings, AlertCircle, Search, Scan, FileSpreadsheet, Save, Calculator, Copy } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { mockProjects, mockCashFlowData, mockMaterialData, mockLaborData, mockOrgData, COLORS, mockAttendancePayrollData } from '../constants/mockData';
import { OrgNode } from './dashboard/OrgChart';

import { createDocument, submitDocument, getApprovalQueue, type ApprovalDoc } from './approvalEngine';
import { type UserContext, WORKFLOWS, type RoleId } from './permissions';
import ApprovalQueue from './ApprovalQueue';

import type { DashboardProps } from './types';

type HRProps = DashboardProps;

function useLocalCtx(ctxProp?: UserContext, projectIdProp?: string): { ctx: UserContext; projectId: string } {
  const roleId = (localStorage.getItem('gem_user_role') || 'chi_huy_truong') as RoleId;
  const userId = localStorage.getItem('gem_user_id') || `user_${roleId}`;
  const userName = localStorage.getItem('gem_user_name') || roleId;
  const projId = projectIdProp || localStorage.getItem('gem_last_project') || 'proj_default';
  return { ctx: ctxProp || { userId, userName, roleId }, projectId: projId };
}

export default function HRWorkspace({ project: selectedProject, projectId: projectIdProp, ctx: ctxProp }: HRProps) {
  const { ctx, projectId } = useLocalCtx(ctxProp, projectIdProp);
            // ══ HR / NHÂN SỰ WORKSPACE ═══════════════════════════════════════
            const HR_KEYS = {
    EMPLOYEES:   'gem_hr_employees',
    CONTRACTS:   'gem_hr_contracts',
    LEAVES:      'gem_hr_leaves',
    EVALUATIONS: 'gem_hr_evaluations',
  };

  type EmpStatus = 'active'|'probation'|'maternity'|'resigned'|'terminated';
  type ContractType = 'xac_dinh'|'khong_xac_dinh'|'thu_viec'|'cong_nhat';
  type LeaveType = 'annual'|'sick'|'personal'|'unpaid'|'maternity';
  type EvalScore = 1|2|3|4|5;

  interface Employee {
    id:string; full_name:string; position:string; department:string;
    cccd:string; phone:string; email:string; address:string;
    dob:string; join_date:string; status:EmpStatus;
    bhxh:string; bhyt:string; avatar_initial:string;
    salary_base:number; allowance:number;
  }
  interface LaborContract {
    id:string; emp_id:string; type:ContractType; code:string;
    signed_date:string; start_date:string; end_date:string;
    salary:number; allowance:number; notes:string;
    status:'active'|'expired'|'draft';
  }
  interface LeaveRequest {
    id:string; emp_id:string; type:LeaveType;
    from_date:string; to_date:string; days:number;
    reason:string; status:'pending'|'approved'|'rejected';
    approver:string;
  }
  interface Evaluation {
    id:string; emp_id:string; period:string;
    scores:{ attitude:EvalScore; skill:EvalScore; result:EvalScore; teamwork:EvalScore; initiative:EvalScore };
    total:number; comment:string; evaluator:string;
  }

  // ── Seed data ─────────────────────────────────────────────────
  const SEED_EMPS:Employee[] = [
    { id:'e1', full_name:'Nguyễn Văn Anh', position:'Chỉ huy trưởng', department:'Ban Chỉ huy',
      cccd:'079087001234', phone:'0901234567', email:'nvanh@villapat.vn', address:'Q.7, TP.HCM',
      dob:'15/05/1982', join_date:'01/01/2026', status:'active',
      bhxh:'7901234567890', bhyt:'HCM-0012345', avatar_initial:'VA',
      salary_base:25000, allowance:5000 },
    { id:'e2', full_name:'Trần Thị Bích', position:'Kế toán dự án', department:'Tài chính',
      cccd:'079092005678', phone:'0912345678', email:'ttbich@villapat.vn', address:'Q.Bình Thạnh, TP.HCM',
      dob:'22/08/1992', join_date:'01/01/2026', status:'active',
      bhxh:'7902345678901', bhyt:'HCM-0023456', avatar_initial:'TB',
      salary_base:18000, allowance:2000 },
    { id:'e3', full_name:'Lê Thanh Tùng', position:'Kỹ sư HSE', department:'An toàn',
      cccd:'079095007890', phone:'0923456789', email:'lttung@villapat.vn', address:'Q.Tân Bình, TP.HCM',
      dob:'10/11/1995', join_date:'15/01/2026', status:'active',
      bhxh:'7903456789012', bhyt:'HCM-0034567', avatar_initial:'LT',
      salary_base:16000, allowance:3000 },
    { id:'e4', full_name:'Phạm Minh Quân', position:'Kỹ sư Giám sát', department:'Kỹ thuật',
      cccd:'079090009012', phone:'0934567890', email:'pmquan@villapat.vn', address:'Q.12, TP.HCM',
      dob:'03/03/1990', join_date:'01/01/2026', status:'active',
      bhxh:'7904567890123', bhyt:'HCM-0045678', avatar_initial:'MQ',
      salary_base:17000, allowance:2500 },
    { id:'e5', full_name:'Hoàng Thị Mai', position:'Thư ký dự án', department:'Hành chính',
      cccd:'079098001234', phone:'0945678901', email:'htmai@villapat.vn', address:'Q.3, TP.HCM',
      dob:'17/06/1998', join_date:'01/02/2026', status:'probation',
      bhxh:'', bhyt:'', avatar_initial:'HM',
      salary_base:10000, allowance:1000 },
  ];
  const SEED_CONTRACTS:LaborContract[] = [
    { id:'lc1', emp_id:'e1', type:'khong_xac_dinh', code:'HĐLĐ-2026-001',
      signed_date:'01/01/2026', start_date:'01/01/2026', end_date:'',
      salary:25000, allowance:5000, notes:'Hợp đồng lao động không xác định thời hạn', status:'active' },
    { id:'lc2', emp_id:'e2', type:'xac_dinh', code:'HĐLĐ-2026-002',
      signed_date:'01/01/2026', start_date:'01/01/2026', end_date:'31/12/2026',
      salary:18000, allowance:2000, notes:'Hợp đồng 1 năm theo dự án', status:'active' },
    { id:'lc3', emp_id:'e3', type:'xac_dinh', code:'HĐLĐ-2026-003',
      signed_date:'15/01/2026', start_date:'15/01/2026', end_date:'14/07/2026',
      salary:16000, allowance:3000, notes:'Hợp đồng 6 tháng, xem xét gia hạn', status:'active' },
    { id:'lc4', emp_id:'e4', type:'xac_dinh', code:'HĐLĐ-2026-004',
      signed_date:'01/01/2026', start_date:'01/01/2026', end_date:'31/12/2026',
      salary:17000, allowance:2500, notes:'', status:'active' },
    { id:'lc5', emp_id:'e5', type:'thu_viec', code:'HĐTV-2026-005',
      signed_date:'01/02/2026', start_date:'01/02/2026', end_date:'30/04/2026',
      salary:10000, allowance:1000, notes:'Thử việc 3 tháng', status:'active' },
  ];
  const SEED_LEAVES:LeaveRequest[] = [
    { id:'lv1', emp_id:'e1', type:'annual', from_date:'10/03/2026', to_date:'12/03/2026',
      days:3, reason:'Nghỉ phép năm', status:'approved', approver:'Ban Giám đốc' },
    { id:'lv2', emp_id:'e3', type:'sick', from_date:'05/03/2026', to_date:'06/03/2026',
      days:2, reason:'Ốm sốt', status:'approved', approver:'CHT' },
    { id:'lv3', emp_id:'e5', type:'personal', from_date:'15/03/2026', to_date:'15/03/2026',
      days:1, reason:'Việc gia đình', status:'pending', approver:'' },
  ];
  const SEED_EVALS:Evaluation[] = [
    { id:'ev1', emp_id:'e1', period:'Q1/2026',
      scores:{ attitude:5, skill:5, result:4, teamwork:5, initiative:4 },
      total:4.6, comment:'Chỉ huy trưởng có kinh nghiệm, lãnh đạo tốt. Cần cải thiện báo cáo tiến độ đúng hạn hơn.', evaluator:'GĐ Nguyễn Tuấn Anh' },
    { id:'ev2', emp_id:'e2', period:'Q1/2026',
      scores:{ attitude:5, skill:4, result:5, teamwork:4, initiative:3 },
      total:4.2, comment:'Kế toán chính xác, đáng tin cậy. Nên chủ động hơn trong việc phát hiện vấn đề.', evaluator:'GĐ Nguyễn Tuấn Anh' },
  ];

  // ── State ─────────────────────────────────────────────────────
  const loadHR = <T,>(key:string, seed:T[]):T[] => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : seed; } catch { return seed; }
  };
  const saveHR = <T,>(key:string, data:T[]) => {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
  };

  // ── Approval wiring ──────────────────────────────────────────────────────
  const [hrApprovalQueue, setHrApprovalQueue] = useState<ApprovalDoc[]>([]);
  const [showApprovalPanel, setShowApprovalPanel] = useState(false);

  const refreshHrQueue = useCallback(() => {
    setHrApprovalQueue(getApprovalQueue(projectId, ctx));
  }, [projectId, ctx]);

  useEffect(() => { refreshHrQueue(); }, [refreshHrQueue]);

  type HrDocType = 'LEAVE_REQUEST' | 'DISCIPLINE';

  const triggerHrDoc = useCallback((
    title: string,
    docType: HrDocType,
    data: Record<string, unknown> = {},
  ) => {
    if (!WORKFLOWS[docType]) return;
    const cr = createDocument({ projectId, docType, ctx, title, data });
    if (!cr.ok) { alert(`❌ ${(cr as any).error}`); return; }
    const sr = submitDocument(projectId, cr.data!.id, ctx);
    if (sr.ok) {
      refreshHrQueue();
      const el = document.createElement('div');
      el.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] bg-blue-700 text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-2xl';
      el.textContent = `✅ ${docType} "${title}" đã nộp duyệt`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 3500);
    } else {
      alert(`❌ ${(sr as any).error}`);
    }
  }, [projectId, ctx, refreshHrQueue]);
  // ── /Approval wiring ──────────────────────────────────────────────────────

  const [hrTab, setHrTab]         = React.useState<'overview'|'employees'|'contracts'|'leaves'|'evaluations'>('overview');
  const [employees, setEmployees]   = React.useState<Employee[]>(() => loadHR(HR_KEYS.EMPLOYEES, SEED_EMPS));
  const [contracts, setContracts]   = React.useState<LaborContract[]>(() => loadHR(HR_KEYS.CONTRACTS, SEED_CONTRACTS));
  const [leaves, setLeaves]         = React.useState<LeaveRequest[]>(() => loadHR(HR_KEYS.LEAVES, SEED_LEAVES));
  const [evaluations, setEvaluations] = React.useState<Evaluation[]>(() => loadHR(HR_KEYS.EVALUATIONS, SEED_EVALS));

  const [selectedEmp, setSelectedEmp] = React.useState<Employee|null>(null);
  const [showEmpForm, setShowEmpForm]   = React.useState(false);
  const [showLeaveForm, setShowLeaveForm] = React.useState(false);
  const [hrSearch, setHrSearch]         = React.useState('');
  const [gemHrLoading, setGemHrLoading] = React.useState(false);
  const [gemHrText, setGemHrText]       = React.useState('');

  const [empForm, setEmpForm] = React.useState<Partial<Employee>>({
    status:'active', join_date: new Date().toLocaleDateString('vi-VN')
  });
  const [leaveForm, setLeaveForm] = React.useState<Partial<LeaveRequest>>({
    type:'annual', status:'pending', days:1,
    from_date: new Date().toLocaleDateString('vi-VN'),
    to_date: new Date().toLocaleDateString('vi-VN'),
  });

  // ── Computed ─────────────────────────────────────────────────
  const activeEmps      = employees.filter(e => e.status === 'active').length;
  const probationEmps   = employees.filter(e => e.status === 'probation').length;
  const pendingLeaves   = leaves.filter(l => l.status === 'pending').length;
  const expiringContracts = contracts.filter(c => {
    if (!c.end_date) return false;
    const d = c.end_date.split('/').reverse().join('-');
    const days = (new Date(d).getTime() - Date.now()) / 86400000;
    return days > 0 && days <= 45;
  }).length;
  const noBhxh = employees.filter(e => e.status === 'active' && !e.bhxh).length;

  const filteredEmps = employees.filter(e =>
    !hrSearch || e.full_name.toLowerCase().includes(hrSearch.toLowerCase())
    || e.position.toLowerCase().includes(hrSearch.toLowerCase())
    || e.department.toLowerCase().includes(hrSearch.toLowerCase())
  );

  const empById = (id:string) => employees.find(e => e.id === id);

  const statusCfg:Record<EmpStatus,{label:string;color:string;bg:string}> = {
    active:     { label:'Đang làm việc', color:'text-emerald-700', bg:'bg-emerald-100' },
    probation:  { label:'Thử việc',      color:'text-amber-700',   bg:'bg-amber-100'   },
    maternity:  { label:'Thai sản',       color:'text-blue-700',    bg:'bg-blue-100'    },
    resigned:   { label:'Đã nghỉ',        color:'text-slate-600',   bg:'bg-slate-100'   },
    terminated: { label:'Chấm dứt HĐ',   color:'text-rose-700',    bg:'bg-rose-100'    },
  };
  const contractTypeCfg:Record<ContractType,string> = {
    xac_dinh:       'Xác định thời hạn',
    khong_xac_dinh: 'Không xác định TH',
    thu_viec:       'Thử việc',
    cong_nhat:      'Công nhật',
  };
  const leaveTypeCfg:Record<LeaveType,{label:string;color:string}> = {
    annual:   { label:'Phép năm',   color:'text-blue-700'    },
    sick:     { label:'Ốm đau',      color:'text-rose-700'    },
    personal: { label:'Việc riêng',  color:'text-amber-700'   },
    unpaid:   { label:'Không lương', color:'text-slate-600'   },
    maternity:{ label:'Thai sản',    color:'text-violet-700'  },
  };
  const fmt = (n:number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));
  const totalPayroll = employees.filter(e=>e.status==='active'||e.status==='probation')
    .reduce((s,e) => s + e.salary_base + e.allowance, 0);

  // Tính daysLeft cho HĐ
  const contractDaysLeft = (end_date:string) => {
    if (!end_date) return null;
    const d = end_date.split('/').reverse().join('-');
    return Math.round((new Date(d).getTime() - Date.now()) / 86400000);
  };

  // Annual leave balance (mock: 12 days/year, 3 months = 3 days used max)
  const leaveBalance = (empId:string) => {
    const used = leaves.filter(l => l.emp_id===empId && l.type==='annual' && l.status==='approved')
      .reduce((s,l) => s+l.days, 0);
    return { total:12, used, remaining: 12-used };
  };

  // Score avg
  const avgScore = (ev:Evaluation) =>
    Object.values(ev.scores).reduce((s,v)=>s+v,0) / Object.keys(ev.scores).length;

  // GEM HR Analysis
  const generateHRAnalysis = async () => {
    setGemHrLoading(true); setGemHrText('');
    try {
      const model = genAI.getGenerativeModel({ model: GEM_MODEL,
        systemInstruction:`Bạn là Nàng GEM Siêu Việt — chuyên gia HR xây dựng. Xưng "em", gọi "Anh/Chị". Giọng nữ miền Nam, thân thiện, chuyên nghiệp.` });
      const expiringList = contracts.filter(c => {
        const dl = contractDaysLeft(c.end_date||'');
        return dl !== null && dl <= 45 && dl > 0;
      }).map(c => {
        const emp = empById(c.emp_id);
        const dl = contractDaysLeft(c.end_date||'');
        return `${emp?.full_name} (${emp?.position}) — HĐ hết hạn ${c.end_date}, còn ${dl} ngày`;
      });
      const r = await model.generateContent(
        `Phân tích tình hình nhân sự dự án ${selectedProject.name}:\n\nTổng nhân sự: ${employees.length} người (${activeEmps} đang làm, ${probationEmps} thử việc)\nQuỹ lương ước tính: ${fmt(totalPayroll)} nghìn đồng/tháng\nHợp đồng sắp hết hạn (45 ngày): ${expiringContracts} HĐ\n${expiringList.length > 0 ? expiringList.join('\\n') : 'Không có'}\nChưa đóng BHXH: ${noBhxh} nhân viên\nĐơn nghỉ phép chờ duyệt: ${pendingLeaves} đơn\n\nNhân viên được đánh giá Q1:\n${evaluations.map(ev => { const emp = empById(ev.emp_id); return `${emp?.full_name}: ${avgScore(ev).toFixed(1)}/5 — ${ev.comment}`; }).join('\\n')}\n\nHãy viết:\n1. Tóm tắt tình hình nhân sự (3-4 câu)\n2. Cảnh báo và việc cần làm ngay\n3. Nhận xét chất lượng nhân sự dựa trên đánh giá\n4. Đề xuất cho tháng tiếp theo\nBằng tiếng Việt, chuyên nghiệp.`
      );
      setGemHrText(r.response.text());
    } catch { setGemHrText('Dạ em chưa kết nối được GEM, Anh/Chị thử lại sau nhé.'); }
    finally { setGemHrLoading(false); }
  };

  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="space-y-4 animate-in fade-in duration-300">

      {/* HR Sub-tab bar */}
      {/* Approval badge */}
      <div className="flex justify-end mb-1">
        <button
          onClick={() => setShowApprovalPanel(true)}
          className="relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-all"
        >
          <ClipboardList size={13}/> Hàng duyệt HR
          {hrApprovalQueue.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
              {hrApprovalQueue.length}
            </span>
          )}
        </button>
      </div>
      <div className="flex gap-1.5 flex-wrap bg-white border border-slate-200 rounded-2xl p-2">
        {([
          { id:'overview',     label:'Tổng quan HR',     icon:<LayoutDashboard size={13}/> },
          { id:'employees',    label:'Danh sách NS',      icon:<Users size={13}/>           },
          { id:'contracts',    label:'Hợp đồng LĐ',      icon:<FileText size={13}/>        },
          { id:'leaves',       label:'Nghỉ phép',         icon:<Calendar size={13}/>        },
          { id:'evaluations',  label:'Đánh giá KPI',      icon:<Target size={13}/>          },
        ] as {id:string;label:string;icon:React.ReactNode}[]).map(t => (
          <button key={t.id} onClick={() => setHrTab(t.id as any)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              hrTab===t.id ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-600 hover:bg-violet-50 hover:text-violet-700'
            }`}>
            {t.icon}{t.label}
            {t.id==='leaves' && pendingLeaves>0 && <span className="bg-white/30 text-[9px] font-bold px-1.5 rounded-full">{pendingLeaves}</span>}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ───────────────────────────────────────────── */}
      {hrTab === 'overview' && (
        <div className="space-y-4">
          {/* KPI strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label:'Tổng nhân sự',       val:String(employees.length),    unit:'người', icon:<Users size={18}/>,       color:'violet' },
              { label:'Quỹ lương/tháng',    val:fmt(totalPayroll),           unit:'K đồng',icon:<Award size={18}/>,        color:'emerald' },
              { label:'HĐ sắp hết hạn',     val:String(expiringContracts),   unit:'HĐ',    icon:<FileText size={18}/>,     color: expiringContracts>0?'amber':'slate' },
              { label:'Chờ duyệt nghỉ phép',val:String(pendingLeaves),       unit:'đơn',   icon:<Calendar size={18}/>,     color: pendingLeaves>0?'rose':'slate' },
            ].map(k => (
              <div key={k.label} className={`bg-white border rounded-2xl p-4 flex items-center gap-3 ${k.color==='amber'&&expiringContracts>0?'border-amber-200 bg-amber-50/40':k.color==='rose'&&pendingLeaves>0?'border-rose-200 bg-rose-50/40':'border-slate-200'}`}>
                <div className={`p-2.5 rounded-xl shrink-0 ${k.color==='violet'?'bg-violet-100 text-violet-600':k.color==='emerald'?'bg-emerald-100 text-emerald-600':k.color==='amber'?'bg-amber-100 text-amber-600':k.color==='rose'?'bg-rose-100 text-rose-600':'bg-slate-100 text-slate-500'}`}>{k.icon}</div>
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold leading-none mb-0.5">{k.label}</p>
                  <p className="text-lg font-bold text-slate-800 leading-none">{k.val} <span className="text-xs font-normal text-slate-400">{k.unit}</span></p>
                </div>
              </div>
            ))}
          </div>

          {/* Alerts */}
          {(expiringContracts>0 || noBhxh>0 || pendingLeaves>0) && (
            <div className="space-y-2">
              {expiringContracts>0 && (
                <div onClick={() => setHrTab('contracts')} className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 cursor-pointer hover:bg-amber-100 transition-colors">
                  <AlertTriangle size={14} className="text-amber-500 shrink-0"/>
                  <span><strong>{expiringContracts} hợp đồng lao động</strong> hết hạn trong 45 ngày — cần gia hạn hoặc chấm dứt</span>
                  <ChevronRight size={14} className="ml-auto text-amber-400"/>
                </div>
              )}
              {noBhxh>0 && (
                <div onClick={() => setHrTab('employees')} className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-800 cursor-pointer hover:bg-rose-100 transition-colors">
                  <AlertCircle size={14} className="text-rose-500 shrink-0"/>
                  <span><strong>{noBhxh} nhân viên</strong> chưa có số BHXH — cần bổ sung hồ sơ đăng ký</span>
                  <ChevronRight size={14} className="ml-auto text-rose-400"/>
                </div>
              )}
              {pendingLeaves>0 && (
                <div onClick={() => setHrTab('leaves')} className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800 cursor-pointer hover:bg-blue-100 transition-colors">
                  <Calendar size={14} className="text-blue-500 shrink-0"/>
                  <span><strong>{pendingLeaves} đơn nghỉ phép</strong> đang chờ duyệt</span>
                  <ChevronRight size={14} className="ml-auto text-blue-400"/>
                </div>
              )}
            </div>
          )}

          {/* 2-col: Nhân sự by dept + GEM */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* By department */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-xs font-bold text-slate-700 mb-3">Cơ cấu nhân sự theo phòng ban</p>
              {Array.from(new Set(employees.map(e=>e.department))).map(dept => {
                const count = employees.filter(e=>e.department===dept).length;
                const pct = Math.round(count/employees.length*100);
                return (
                  <div key={dept} className="mb-2.5">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 font-medium">{dept}</span>
                      <span className="text-slate-400">{count} người</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-500 rounded-full transition-all" style={{width:`${pct}%`}}/>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* GEM HR analysis */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><Sparkles size={12} className="text-violet-500"/> GEM Phân tích Nhân sự</p>
                <button onClick={generateHRAnalysis} disabled={gemHrLoading}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-violet-600 text-white rounded-lg text-[10px] font-bold hover:bg-violet-700 disabled:opacity-50 transition-colors">
                  {gemHrLoading ? <Loader2 size={10} className="animate-spin"/> : <Sparkles size={10}/>}
                  {gemHrLoading ? 'Đang phân tích...' : 'Phân tích'}
                </button>
              </div>
              {gemHrText ? (
                <div className="text-xs text-slate-700 leading-relaxed bg-violet-50 rounded-xl p-3 max-h-52 overflow-y-auto whitespace-pre-wrap">{gemHrText}</div>
              ) : (
                <div className="text-xs text-slate-400 text-center py-8 bg-slate-50 rounded-xl">Nhấn "Phân tích" để GEM đánh giá tình hình nhân sự và cảnh báo rủi ro</div>
              )}
            </div>
          </div>

          {/* Recent eval scores */}
          {evaluations.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-xs font-bold text-slate-700 mb-3">Kết quả đánh giá KPI gần nhất</p>
              <div className="space-y-2">
                {evaluations.map(ev => {
                  const emp = empById(ev.emp_id);
                  const avg = avgScore(ev);
                  const color = avg>=4.5?'emerald':avg>=3.5?'blue':avg>=2.5?'amber':'rose';
                  return (
                    <div key={ev.id} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl">
                      <div className="w-8 h-8 bg-violet-100 text-violet-700 rounded-xl flex items-center justify-center text-xs font-bold shrink-0">{emp?.avatar_initial||'?'}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-700 truncate">{emp?.full_name}</p>
                        <p className="text-[10px] text-slate-400">{ev.period} · {emp?.position}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold ${color==='emerald'?'text-emerald-600':color==='blue'?'text-blue-600':color==='amber'?'text-amber-600':'text-rose-600'}`}>{avg.toFixed(1)}/5</p>
                        <div className="flex gap-0.5 mt-0.5">
                          {[1,2,3,4,5].map(s => <div key={s} className={`w-3 h-1 rounded-sm ${s<=Math.round(avg)?color==='emerald'?'bg-emerald-400':color==='blue'?'bg-blue-400':color==='amber'?'bg-amber-400':'bg-rose-400':'bg-slate-200'}`}/>)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── EMPLOYEES ──────────────────────────────────────────── */}
      {hrTab === 'employees' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input value={hrSearch} onChange={e=>setHrSearch(e.target.value)}
                placeholder="Tìm nhân viên, vị trí, phòng ban..."
                className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 transition-all"/>
            </div>
            <button onClick={() => setShowEmpForm(v=>!v)}
              className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-colors shrink-0">
              <Plus size={13}/> Thêm nhân viên
            </button>
          </div>

          {/* Add form */}
          {showEmpForm && (
            <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
              <p className="text-sm font-bold text-violet-800">👤 Thêm nhân viên mới</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {[
                  { ph:'Họ và tên *', key:'full_name' }, { ph:'Vị trí / Chức danh *', key:'position' },
                  { ph:'Phòng ban', key:'department' }, { ph:'Số CCCD', key:'cccd' },
                  { ph:'Số điện thoại', key:'phone' }, { ph:'Email', key:'email' },
                  { ph:'Ngày sinh (DD/MM/YYYY)', key:'dob' }, { ph:'Ngày vào làm', key:'join_date' },
                  { ph:'Số BHXH', key:'bhxh' },
                ].map(({ph,key}) => (
                  <input key={key} placeholder={ph} value={(empForm as any)[key]||''}
                    onChange={e=>setEmpForm(f=>({...f,[key]:e.target.value}))}
                    className="text-xs border border-violet-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"/>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" placeholder="Lương cơ bản (K đồng)" value={empForm.salary_base||''}
                  onChange={e=>setEmpForm(f=>({...f,salary_base:Number(e.target.value)}))}
                  className="text-xs border border-violet-200 rounded-xl px-3 py-2 bg-white focus:outline-none"/>
                <select value={empForm.status} onChange={e=>setEmpForm(f=>({...f,status:e.target.value as any}))}
                  className="text-xs border border-violet-200 rounded-xl px-3 py-2 bg-white focus:outline-none">
                  <option value="active">Đang làm việc</option>
                  <option value="probation">Thử việc</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowEmpForm(false)} className="px-4 py-2 text-xs text-slate-600 bg-white border border-slate-200 rounded-xl">Huỷ</button>
                <button onClick={() => {
                  if (!empForm.full_name || !empForm.position) return;
                  const init = empForm.full_name.split(' ').slice(-2).map(w=>w[0]).join('').toUpperCase();
                  const newE:Employee = { id:`e${Date.now()}`, full_name:empForm.full_name!, position:empForm.position!,
                    department:empForm.department||'', cccd:empForm.cccd||'', phone:empForm.phone||'',
                    email:empForm.email||'', address:'', dob:empForm.dob||'', join_date:empForm.join_date||'',
                    status:empForm.status||'active', bhxh:empForm.bhxh||'', bhyt:'',
                    avatar_initial:init, salary_base:empForm.salary_base||0, allowance:0 };
                  const updated = [...employees, newE];
                  setEmployees(updated); saveHR(HR_KEYS.EMPLOYEES, updated);
                  setShowEmpForm(false); setEmpForm({ status:'active', join_date: new Date().toLocaleDateString('vi-VN') });
                }} className="px-4 py-2 text-xs bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold">Lưu</button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {filteredEmps.map(emp => {
              const emp_contract = contracts.find(c=>c.emp_id===emp.id&&c.status==='active');
              const dl = emp_contract?.end_date ? contractDaysLeft(emp_contract.end_date) : null;
              const lb = leaveBalance(emp.id);
              return (
                <div key={emp.id} onClick={() => setSelectedEmp(selectedEmp?.id===emp.id?null:emp)}
                  className={`bg-white border rounded-2xl p-4 hover:shadow-md transition-all cursor-pointer group ${selectedEmp?.id===emp.id?'border-violet-300 shadow-md':'border-slate-200'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-violet-100 text-violet-700 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 group-hover:bg-violet-200 transition-colors">
                      {emp.avatar_initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-800">{emp.full_name}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusCfg[emp.status].bg} ${statusCfg[emp.status].color}`}>{statusCfg[emp.status].label}</span>
                      </div>
                      <p className="text-xs text-slate-500">{emp.position} · {emp.department}</p>
                      <p className="text-[10px] text-slate-400">Vào làm: {emp.join_date} · Phép còn: {lb.remaining}/{lb.total} ngày</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-slate-700">{fmt(emp.salary_base+emp.allowance)}K</p>
                      <p className="text-[10px] text-slate-400">tổng thu nhập</p>
                      {dl !== null && dl<=45 && <p className="text-[10px] text-amber-600 font-bold">HĐ còn {dl}ngày</p>}
                    </div>
                  </div>
                  {/* Expanded detail */}
                  {selectedEmp?.id===emp.id && (
                    <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        ['📱 Điện thoại', emp.phone],
                        ['✉️ Email', emp.email],
                        ['🪪 CCCD', emp.cccd],
                        ['🏦 BHXH', emp.bhxh || '⚠️ Chưa có'],
                        ['🎂 Ngày sinh', emp.dob],
                        ['💰 Lương CB', `${fmt(emp.salary_base)}K`],
                        ['➕ Phụ cấp', `${fmt(emp.allowance)}K`],
                        ['📅 Phép năm', `${lb.used} dùng / ${lb.remaining} còn`],
                      ].map(([k,v]) => (
                        <div key={k} className="bg-slate-50 rounded-xl p-2.5">
                          <p className="text-[10px] text-slate-400">{k}</p>
                          <p className={`text-xs font-semibold mt-0.5 ${v.toString().includes('⚠️')?'text-rose-600':'text-slate-700'}`}>{v}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── CONTRACTS ──────────────────────────────────────────── */}
      {hrTab === 'contracts' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-bold text-slate-700">{contracts.length} hợp đồng lao động</p>
              <p className="text-xs text-slate-500">{contracts.filter(c=>c.status==='active').length} hiệu lực · {expiringContracts} sắp hết hạn</p>
            </div>
          </div>
          <div className="space-y-2">
            {contracts.map(c => {
              const emp = empById(c.emp_id);
              const dl = c.end_date ? contractDaysLeft(c.end_date) : null;
              const isExpiring = dl !== null && dl <= 45 && dl > 0;
              const isExpired  = dl !== null && dl <= 0;
              return (
                <div key={c.id} className={`bg-white border rounded-2xl p-4 ${isExpired?'border-rose-200 bg-rose-50/20':isExpiring?'border-amber-200 bg-amber-50/20':'border-slate-200'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 bg-violet-100 text-violet-700 rounded-xl flex items-center justify-center text-xs font-bold shrink-0">{emp?.avatar_initial||'?'}</div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-slate-800">{emp?.full_name}</p>
                          <span className="text-[10px] font-mono text-slate-400">{c.code}</span>
                          <span className="text-[10px] font-bold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-lg">{contractTypeCfg[c.type]}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{emp?.position} · Ký: {c.signed_date}</p>
                        <p className="text-[10px] text-slate-400">
                          {c.start_date} → {c.end_date||'Không xác định'}
                          {dl !== null && <span className={`ml-2 font-bold ${isExpired?'text-rose-600':isExpiring?'text-amber-600':'text-slate-400'}`}>
                            {isExpired ? `Hết hạn ${Math.abs(dl)} ngày trước` : `Còn ${dl} ngày`}
                          </span>}
                        </p>
                        {c.notes && <p className="text-[10px] text-slate-400 italic mt-0.5">{c.notes}</p>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-slate-800">{fmt(c.salary+c.allowance)}K</p>
                      <p className="text-[10px] text-slate-400">Lương + PC</p>
                      {isExpiring && !isExpired && (
                        <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full block mt-1">⚠ Sắp hết hạn</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── LEAVES ─────────────────────────────────────────────── */}
      {hrTab === 'leaves' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm font-bold text-slate-700">{leaves.length} đơn nghỉ phép · {pendingLeaves} chờ duyệt</p>
            <button onClick={() => setShowLeaveForm(v=>!v)}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors">
              <Plus size={13}/> Tạo đơn nghỉ phép
            </button>
          </div>

          {showLeaveForm && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
              <p className="text-sm font-bold text-blue-800">📅 Tạo đơn nghỉ phép</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <select value={leaveForm.emp_id||''} onChange={e=>setLeaveForm(f=>({...f,emp_id:e.target.value}))}
                  className="text-xs border border-blue-200 rounded-xl px-3 py-2 bg-white focus:outline-none">
                  <option value="">-- Chọn nhân viên --</option>
                  {employees.filter(e=>e.status!=='resigned'&&e.status!=='terminated').map(e => (
                    <option key={e.id} value={e.id}>{e.full_name}</option>
                  ))}
                </select>
                <select value={leaveForm.type} onChange={e=>setLeaveForm(f=>({...f,type:e.target.value as any}))}
                  className="text-xs border border-blue-200 rounded-xl px-3 py-2 bg-white focus:outline-none">
                  <option value="annual">Phép năm</option>
                  <option value="sick">Ốm đau</option>
                  <option value="personal">Việc riêng</option>
                  <option value="unpaid">Không lương</option>
                </select>
                <input type="number" min={1} placeholder="Số ngày" value={leaveForm.days||''}
                  onChange={e=>setLeaveForm(f=>({...f,days:Number(e.target.value)}))}
                  className="text-xs border border-blue-200 rounded-xl px-3 py-2 bg-white focus:outline-none"/>
                <input placeholder="Từ ngày (DD/MM/YYYY)" value={leaveForm.from_date||''}
                  onChange={e=>setLeaveForm(f=>({...f,from_date:e.target.value}))}
                  className="text-xs border border-blue-200 rounded-xl px-3 py-2 bg-white focus:outline-none"/>
                <input placeholder="Đến ngày" value={leaveForm.to_date||''}
                  onChange={e=>setLeaveForm(f=>({...f,to_date:e.target.value}))}
                  className="text-xs border border-blue-200 rounded-xl px-3 py-2 bg-white focus:outline-none"/>
                <input placeholder="Lý do" value={leaveForm.reason||''}
                  onChange={e=>setLeaveForm(f=>({...f,reason:e.target.value}))}
                  className="text-xs border border-blue-200 rounded-xl px-3 py-2 bg-white focus:outline-none"/>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowLeaveForm(false)} className="px-4 py-2 text-xs text-slate-600 bg-white border border-slate-200 rounded-xl">Huỷ</button>
                <button onClick={() => {
                  if (!leaveForm.emp_id||!leaveForm.from_date) return;
                  const newL:LeaveRequest = { id:`lv${Date.now()}`, emp_id:leaveForm.emp_id!, type:leaveForm.type||'annual',
                    from_date:leaveForm.from_date!, to_date:leaveForm.to_date||leaveForm.from_date!,
                    days:leaveForm.days||1, reason:leaveForm.reason||'', status:'pending', approver:'' };
                  const updated = [newL, ...leaves];
                  setLeaves(updated); saveHR(HR_KEYS.LEAVES, updated);
                  // Gửi vào hàng duyệt
                  const emp = employees.find(e => e.id === newL.emp_id);
                  triggerHrDoc(
                    `Nghỉ phép: ${emp?.name || newL.emp_id} — ${newL.days} ngày (${newL.from_date})`,
                    'LEAVE_REQUEST',
                    { leave: newL },
                  );
                  setShowLeaveForm(false); setLeaveForm({ type:'annual', status:'pending', days:1, from_date: new Date().toLocaleDateString('vi-VN'), to_date: new Date().toLocaleDateString('vi-VN') });
                }} className="px-4 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold">Gửi đơn & Duyệt</button>
              </div>
            </div>
          )}

          {/* Leave balance strip */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {employees.filter(e=>e.status==='active'||e.status==='probation').map(emp => {
              const lb = leaveBalance(emp.id);
              return (
                <div key={emp.id} className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0">{emp.avatar_initial}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-slate-700 truncate">{emp.full_name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className="h-1 flex-1 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{width:`${Math.round(lb.used/lb.total*100)}%`}}/>
                      </div>
                      <span className="text-[9px] text-slate-500 shrink-0">{lb.remaining}/{lb.total}ngày</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            {leaves.map(l => {
              const emp = empById(l.emp_id);
              return (
                <div key={l.id} className={`bg-white border rounded-2xl p-4 flex items-center gap-3 ${l.status==='pending'?'border-amber-200':'border-slate-200'}`}>
                  <div className="w-9 h-9 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center text-xs font-bold shrink-0">{emp?.avatar_initial||'?'}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-700">{emp?.full_name}</p>
                    <p className="text-xs text-slate-500">{leaveTypeCfg[l.type].label} · {l.days} ngày · {l.from_date}{l.days>1?` → ${l.to_date}`:''}</p>
                    {l.reason && <p className="text-[10px] text-slate-400 italic">{l.reason}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${l.status==='approved'?'bg-emerald-100 text-emerald-700':l.status==='rejected'?'bg-rose-100 text-rose-700':'bg-amber-100 text-amber-700'}`}>
                      {l.status==='approved'?'✓ Đã duyệt':l.status==='rejected'?'✗ Từ chối':'⏳ Chờ duyệt'}
                    </span>
                    {l.status==='pending' && (
                      <div className="flex gap-1">
                        <button onClick={() => {
                          const updated = leaves.map(x=>x.id===l.id?{...x,status:'approved',approver:'CHT'}:x) as LeaveRequest[];
                          setLeaves(updated); saveHR(HR_KEYS.LEAVES, updated);
                        }} className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg hover:bg-emerald-200 transition-colors">Duyệt</button>
                        <button onClick={() => {
                          const updated = leaves.map(x=>x.id===l.id?{...x,status:'rejected'}:x) as LeaveRequest[];
                          setLeaves(updated); saveHR(HR_KEYS.LEAVES, updated);
                        }} className="text-[9px] font-bold bg-rose-100 text-rose-700 px-2 py-1 rounded-lg hover:bg-rose-200 transition-colors">Từ chối</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── EVALUATIONS ────────────────────────────────────────── */}
      {hrTab === 'evaluations' && (
        <div className="space-y-4">
          <p className="text-sm font-bold text-slate-700">Đánh giá KPI nhân viên</p>
          {evaluations.length === 0 ? (
            <div className="text-center py-12 bg-white border border-slate-200 rounded-2xl text-slate-400 text-sm">Chưa có đánh giá nào. Tạo đánh giá cho từng nhân viên.</div>
          ) : (
            <div className="space-y-4">
              {evaluations.map(ev => {
                const emp = empById(ev.emp_id);
                const avg = avgScore(ev);
                const scoreColor = (s:number) => s>=4?'text-emerald-600':s>=3?'text-blue-600':s>=2?'text-amber-600':'text-rose-600';
                const scoreBg   = (s:number) => s>=4?'bg-emerald-100':s>=3?'bg-blue-100':s>=2?'bg-amber-100':'bg-rose-100';
                const criteria = [
                  { key:'attitude',   label:'Thái độ làm việc'   },
                  { key:'skill',      label:'Năng lực chuyên môn' },
                  { key:'result',     label:'Kết quả công việc'   },
                  { key:'teamwork',   label:'Làm việc nhóm'       },
                  { key:'initiative', label:'Sáng kiến / Chủ động'},
                ];
                return (
                  <div key={ev.id} className="bg-white border border-slate-200 rounded-2xl p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-violet-100 text-violet-700 rounded-xl flex items-center justify-center font-bold">{emp?.avatar_initial||'?'}</div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{emp?.full_name}</p>
                          <p className="text-xs text-slate-500">{emp?.position} · {ev.period} · Đánh giá bởi: {ev.evaluator}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-2xl font-bold ${avg>=4?'text-emerald-600':avg>=3?'text-blue-600':avg>=2?'text-amber-600':'text-rose-600'}`}>{avg.toFixed(1)}</p>
                        <p className="text-[10px] text-slate-400">/ 5.0 điểm</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-4">
                      {criteria.map(c => {
                        const s = (ev.scores as any)[c.key] as number;
                        return (
                          <div key={c.key} className={`rounded-xl p-2.5 text-center ${scoreBg(s)}`}>
                            <p className={`text-xl font-bold ${scoreColor(s)}`}>{s}</p>
                            <p className="text-[10px] text-slate-600 leading-tight mt-0.5">{c.label}</p>
                          </div>
                        );
                      })}
                    </div>
                    {ev.comment && (
                      <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 italic">
                        💬 {ev.comment}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 text-xs text-violet-700">
            <strong>Thang điểm:</strong> 1 = Không đạt · 2 = Cần cải thiện · 3 = Đạt yêu cầu · 4 = Tốt · 5 = Xuất sắc
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
              onClose={() => { setShowApprovalPanel(false); refreshHrQueue(); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}