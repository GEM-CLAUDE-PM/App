import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Zap, ChevronDown, ChevronUp, Search, X,
  Package, FileText, ArrowRightLeft, ClipboardCheck, BarChart2,
  Receipt, Clock, TrendingUp, DollarSign, FileSignature,
  Users, Briefcase, Shield, AlertTriangle, Clipboard,
  CheckSquare, BookOpen, Camera, Layers, FlaskConical, GitBranch,
  Wrench, UserX, CalendarOff, Activity,
  CheckCircle2, ArrowRight,
} from 'lucide-react';

// ─── Định nghĩa 28 nghiệp vụ ────────────────────────────────────────────────
//     Mỗi nghiệp vụ gắn với:
//     - tabId: tab trong ProjectDashboard để navigate tới
//     - subTab: sub-tab bên trong (nếu có)
//     - minLevel: cấp quyền tối thiểu có thể thực hiện
//     - domains: domain bắt buộc ([] = không giới hạn)
//     - group: nhóm hiển thị
//     - actionType: 'create' | 'review' | 'approve'

export interface WorkspaceAction {
  id: string;
  code: string;           // Mã nghiệp vụ (VD: A1)
  label: string;          // Tên hiển thị
  shortLabel: string;     // Rút gọn cho chip
  icon: React.ReactNode;
  group: 'materials' | 'qs' | 'finance' | 'procurement' | 'qaqc' | 'hse' | 'hr';
  groupLabel: string;
  color: string;          // Tailwind color token
  tabId: string;          // navigate target
  subTab?: string;
  minLevel: number;
  domains: string[];      // [] = tất cả levels đều xem được; ['qs'] = chỉ QS
  actionLabel: string;    // Nút CTA chính
}

const ACTIONS: WorkspaceAction[] = [
  // ── NHÓM A — Vật tư / Kho ────────────────────────────────────────────────
  { id:'MATERIAL_REQUEST',       code:'A1', label:'Đề xuất cấp vật tư',       shortLabel:'Đề xuất VT',   icon:<Package size={13}/>,         group:'materials', groupLabel:'Vật tư & Kho', color:'emerald', tabId:'resources', subTab:'dexuat',  minLevel:2, domains:[],           actionLabel:'Lập đề xuất'      },
  { id:'WAREHOUSE_EXIT',         code:'A2', label:'Phiếu xuất kho',            shortLabel:'Xuất kho',     icon:<ArrowRightLeft size={13}/>,  group:'materials', groupLabel:'Vật tư & Kho', color:'emerald', tabId:'resources', subTab:'chungtu', minLevel:1, domains:['warehouse','cross','site'], actionLabel:'Tạo phiếu xuất'   },
  { id:'WAREHOUSE_ENTRY',        code:'A3', label:'Phiếu nhập kho',            shortLabel:'Nhập kho',     icon:<Package size={13}/>,         group:'materials', groupLabel:'Vật tư & Kho', color:'emerald', tabId:'resources', subTab:'chungtu', minLevel:1, domains:['warehouse','cross','site'], actionLabel:'Tạo phiếu nhập'   },
  { id:'STOCK_TAKE',             code:'A4', label:'Kiểm kê kho định kỳ',       shortLabel:'Kiểm kê',      icon:<ClipboardCheck size={13}/>,  group:'materials', groupLabel:'Vật tư & Kho', color:'emerald', tabId:'resources', subTab:'kiemsoat',minLevel:2, domains:['warehouse','cross'], actionLabel:'Tạo phiếu kiểm kê'},

  // ── NHÓM B — QS / Hợp đồng ───────────────────────────────────────────────
  { id:'VARIATION_ORDER',        code:'B1', label:'Variation Order (VO)',       shortLabel:'Variation Order',icon:<GitBranch size={13}/>,     group:'qs',        groupLabel:'QS & Hợp đồng',color:'blue',    tabId:'qs',        subTab:'variation',minLevel:2, domains:['qs','cross'],       actionLabel:'Lập VO'           },
  { id:'ACCEPTANCE_INTERNAL',   code:'B2', label:'BBNT nội bộ',                shortLabel:'NT nội bộ',    icon:<CheckSquare size={13}/>,     group:'qs',        groupLabel:'QS & Hợp đồng',color:'blue',    tabId:'qs',        subTab:'acceptance',minLevel:2, domains:['qs','site','cross'], actionLabel:'Lập biên bản'     },
  { id:'ACCEPTANCE_OWNER',      code:'B3', label:'BBNT với Chủ đầu tư',        shortLabel:'NT với CĐT',   icon:<FileSignature size={13}/>,   group:'qs',        groupLabel:'QS & Hợp đồng',color:'blue',    tabId:'qs',        subTab:'acceptance',minLevel:3, domains:['qs','cross'],       actionLabel:'Lập BBNT CĐT'     },
  { id:'PAYMENT_REQUEST',        code:'B4', label:'Yêu cầu thanh toán',         shortLabel:'YCTT',         icon:<DollarSign size={13}/>,      group:'qs',        groupLabel:'QS & Hợp đồng',color:'blue',    tabId:'qs',        subTab:'payment',  minLevel:2, domains:['qs','cross'],       actionLabel:'Lập YCTT'         },
  { id:'CONTRACT_AMENDMENT',     code:'B5', label:'Phụ lục hợp đồng',           shortLabel:'Phụ lục HĐ',  icon:<FileText size={13}/>,        group:'qs',        groupLabel:'QS & Hợp đồng',color:'blue',    tabId:'contracts', subTab:'amendments',minLevel:3, domains:['qs','cross'],      actionLabel:'Soạn phụ lục'     },
  { id:'SUBCONTRACT_PAYMENT',    code:'B6', label:'Thanh toán thầu phụ',        shortLabel:'TT thầu phụ', icon:<Briefcase size={13}/>,       group:'qs',        groupLabel:'QS & Hợp đồng',color:'blue',    tabId:'qs',        subTab:'subcontractor',minLevel:3,domains:['qs','cross'],      actionLabel:'Lập phiếu TT'     },

  // ── NHÓM C — Tài chính / Kế toán ─────────────────────────────────────────
  { id:'FINANCIAL_VOUCHER',      code:'C1', label:'Chứng từ kế toán',           shortLabel:'Chứng từ KT', icon:<Receipt size={13}/>,         group:'finance',   groupLabel:'Kế toán',       color:'violet',  tabId:'accounting',subTab:'vouchers', minLevel:2, domains:['finance','cross'],   actionLabel:'Tạo chứng từ'     },
  { id:'TIMESHEET',              code:'C2', label:'Bảng công nhân công',        shortLabel:'Bảng công',   icon:<Clock size={13}/>,            group:'finance',   groupLabel:'Kế toán',       color:'violet',  tabId:'manpower',  subTab:'site',  minLevel:2, domains:['site','cross'],      actionLabel:'Nộp bảng công'    },
  { id:'OVERTIME_REQUEST',       code:'C3', label:'Đề xuất tăng ca',            shortLabel:'Tăng ca',     icon:<Activity size={13}/>,         group:'finance',   groupLabel:'Kế toán',       color:'violet',  tabId:'manpower',  subTab:'overtime', minLevel:2, domains:[],                    actionLabel:'Đề xuất tăng ca'  },

  // ── NHÓM D — Procurement & Vendor ────────────────────────────────────────
  { id:'PROCUREMENT',            code:'D1', label:'Đề xuất mua sắm / PO',       shortLabel:'Mua sắm',     icon:<Layers size={13}/>,           group:'procurement',groupLabel:'Mua sắm & NCC', color:'amber',   tabId:'resources', subTab:'chungtu', minLevel:2, domains:[],                    actionLabel:'Lập PO'           },
  { id:'MATERIAL_APPROVAL',      code:'D2', label:'Duyệt mẫu vật liệu',         shortLabel:'Duyệt mẫu VL',icon:<Camera size={13}/>,           group:'procurement',groupLabel:'Mua sắm & NCC', color:'amber',   tabId:'resources', subTab:'kho',     minLevel:2, domains:['site','qaqc','cross'],actionLabel:'Gửi submittal'     },
  { id:'MATERIAL_INCOMING',      code:'D3', label:'Nghiệm thu VL đầu vào',      shortLabel:'NT vật liệu', icon:<TrendingUp size={13}/>,       group:'procurement',groupLabel:'Mua sắm & NCC', color:'amber',   tabId:'resources', subTab:'kho',     minLevel:2, domains:['site','qaqc','warehouse','cross'],actionLabel:'Nghiệm thu VL'},
  { id:'VENDOR_PREQUALIFICATION',code:'D4', label:'Đánh giá & duyệt NCC',       shortLabel:'Đánh giá NCC',icon:<BarChart2 size={13}/>,        group:'procurement',groupLabel:'Mua sắm & NCC', color:'amber',   tabId:'qs',        subTab:'subcontractor',minLevel:2,domains:['qs','cross'],      actionLabel:'Đánh giá NCC'     },
  { id:'VENDOR_EVALUATION',      code:'D5', label:'Đánh giá định kỳ NCC/TP',    shortLabel:'Định kỳ NCC', icon:<BarChart2 size={13}/>,        group:'procurement',groupLabel:'Mua sắm & NCC', color:'amber',   tabId:'qs',        subTab:'subcontractor',minLevel:3,domains:['qs','cross'],      actionLabel:'Đánh giá định kỳ' },

  // ── NHÓM E — Chất lượng QA/QC ────────────────────────────────────────────
  { id:'NCR',                    code:'E1', label:'Non-Conformance Report',      shortLabel:'NCR',          icon:<AlertTriangle size={13}/>,   group:'qaqc',      groupLabel:'QA/QC',          color:'rose',    tabId:'qa-qc',     subTab:'ncr',      minLevel:2, domains:['qaqc','site','cross'], actionLabel:'Lập NCR'          },
  { id:'RFI',                    code:'E2', label:'Request for Information',     shortLabel:'RFI',          icon:<BookOpen size={13}/>,         group:'qaqc',      groupLabel:'QA/QC',          color:'rose',    tabId:'qa-qc',     subTab:'rfi',      minLevel:2, domains:['qaqc','site','cross'], actionLabel:'Lập RFI'          },
  { id:'INSPECTION_REQUEST',     code:'E3', label:'Nghiệm thu công đoạn',       shortLabel:'NT công đoạn', icon:<CheckSquare size={13}/>,     group:'qaqc',      groupLabel:'QA/QC',          color:'rose',    tabId:'qa-qc',     subTab:'inspection',minLevel:2,domains:['qaqc','site','cross'], actionLabel:'Yêu cầu NT'      },
  { id:'ITP_MANAGEMENT',         code:'E4', label:'Inspection & Test Plan',     shortLabel:'ITP',          icon:<Clipboard size={13}/>,       group:'qaqc',      groupLabel:'QA/QC',          color:'rose',    tabId:'qa-qc',     subTab:'itp',      minLevel:2, domains:['qaqc','cross'],       actionLabel:'Quản lý ITP'      },
  { id:'METHOD_STATEMENT',       code:'E5', label:'Biện pháp thi công',         shortLabel:'BPTC',         icon:<Wrench size={13}/>,          group:'qaqc',      groupLabel:'QA/QC',          color:'rose',    tabId:'qa-qc',     subTab:'method',   minLevel:2, domains:['qaqc','site','cross'], actionLabel:'Nộp BPTC'         },
  { id:'DRAWING_REVISION',       code:'E6', label:'Bản vẽ & Revision',          shortLabel:'Bản vẽ Rev',  icon:<Layers size={13}/>,           group:'qaqc',      groupLabel:'QA/QC',          color:'rose',    tabId:'qa-qc',     subTab:'drawings', minLevel:2, domains:['qaqc','site','cross'], actionLabel:'Upload revision'  },
  { id:'QUALITY_AUDIT',          code:'E7', label:'Audit chất lượng nội bộ',    shortLabel:'QA Audit',     icon:<Shield size={13}/>,          group:'qaqc',      groupLabel:'QA/QC',          color:'rose',    tabId:'qa-qc',     subTab:'audit',    minLevel:3, domains:['qaqc','cross'],       actionLabel:'Lập audit'        },
  { id:'TESTING_LAB',            code:'E8', label:'Kết quả thí nghiệm',         shortLabel:'Thí nghiệm',  icon:<FlaskConical size={13}/>,     group:'qaqc',      groupLabel:'QA/QC',          color:'rose',    tabId:'qa-qc',     subTab:'lab',      minLevel:2, domains:['qaqc','site','cross'], actionLabel:'Nhập kết quả'     },

  // ── NHÓM F — HSE ──────────────────────────────────────────────────────────
  { id:'HSE_INCIDENT',           code:'F1', label:'Báo cáo sự cố / Near Miss',  shortLabel:'Báo cáo sự cố',icon:<AlertTriangle size={13}/>,  group:'hse',       groupLabel:'An toàn HSE',    color:'orange',  tabId:'hse',       subTab:undefined,      minLevel:1, domains:[],                    actionLabel:'Báo cáo ngay'     },
  { id:'PERMIT_TO_WORK',         code:'F2', label:'Giấy phép làm việc nguy hiểm',shortLabel:'PTW',         icon:<Wrench size={13}/>,            group:'hse',       groupLabel:'An toàn HSE',    color:'orange',  tabId:'hse',       subTab:undefined,      minLevel:2, domains:['hse','site','cross'], actionLabel:'Xin phép PTW'     },
  { id:'HSE_INSPECTION',         code:'F4', label:'Kiểm tra an toàn định kỳ',   shortLabel:'HSE kiểm tra',icon:<Shield size={13}/>,           group:'hse',       groupLabel:'An toàn HSE',    color:'orange',  tabId:'hse',       subTab:undefined,      minLevel:2, domains:['hse','site','cross'], actionLabel:'Kiểm tra AT'      },
  { id:'CAPA',                   code:'F5', label:'Corrective & Preventive Action',shortLabel:'CAPA',     icon:<CheckCircle2 size={13}/>,    group:'hse',       groupLabel:'An toàn HSE',    color:'orange',  tabId:'hse',       subTab:undefined,      minLevel:2, domains:['hse','qaqc','cross'], actionLabel:'Lập CAPA'         },

  // ── NHÓM G — Nhân sự ──────────────────────────────────────────────────────
  { id:'EMPLOYEE_NEW',           code:'G0', label:'Thêm nhân viên mới',          shortLabel:'Thêm NV',      icon:<Users size={13} className="text-violet-500"/>,   tabId:'resources', group:'hr', groupLabel:'Nhân sự', color:'indigo', subTab:'hr', minLevel:3, domains:['cross'],             actionLabel:'Thêm nhân viên' },
  { id:'LEAVE_REQUEST',          code:'G1', label:'Đề xuất nghỉ phép',          shortLabel:'Xin phép',    icon:<CalendarOff size={13}/>,      group:'hr',        groupLabel:'Nhân sự',        color:'indigo',  tabId:'manpower',  subTab:'leave',    minLevel:1, domains:[],                    actionLabel:'Xin nghỉ phép'   },
  { id:'DISCIPLINE',             code:'G2', label:'Xử lý kỷ luật',              shortLabel:'Kỷ luật',     icon:<UserX size={13}/>,            group:'hr',        groupLabel:'Nhân sự',        color:'indigo',  tabId:'manpower',  subTab:'discipline',minLevel:3, domains:['cross'],             actionLabel:'Lập biên bản KL'  },
];

// ─── Permission helper ────────────────────────────────────────────────────────
function canAccess(action: WorkspaceAction, userLevel: number, userDomains: string[]): boolean {
  if (userLevel < (action.minLevel ?? 1)) return false;
  if (!action.domains || action.domains.length === 0) return true;
  return action.domains.some(d => userDomains.includes(d));
}

// ─── Role config ──────────────────────────────────────────────────────────────
const ROLE_CFG: Record<string, { level: number; domains: string[]; label: string; homeTab: string; color: string }> = {
  // L5
  giam_doc:        { level:5, domains:['cross','admin'],          label:'Giám đốc CT',      homeTab:'overview',   color:'#7c3aed' },
  // L4
  pm:              { level:4, domains:['cross','finance','qs'],   label:'Project Manager',  homeTab:'overview',   color:'#0891b2' },
  ke_toan_truong:  { level:4, domains:['finance','cross'],        label:'Kế toán trưởng',   homeTab:'accounting', color:'#059669' },
  // L3 HO
  truong_qs:       { level:3, domains:['qs','cross'],             label:'Trưởng QS',        homeTab:'boq',        color:'#0284c7' },
  truong_qaqc:     { level:3, domains:['qaqc','cross'],           label:'Trưởng QA/QC',     homeTab:'qa-qc',      color:'#059669' },
  truong_hse:      { level:3, domains:['hse','cross'],            label:'Trưởng HSE',       homeTab:'hse',        color:'#dc2626' },
  hr_truong:       { level:3, domains:['hr','cross'],             label:'Trưởng nhân sự',   homeTab:'hr',         color:'#7c3aed' },
  // L3 Site
  chi_huy_truong:  { level:3, domains:['site','cross'],           label:'Chỉ huy trưởng',  homeTab:'progress',   color:'#2563eb' },
  chi_huy_pho:     { level:3, domains:['site','cross'],           label:'Chỉ huy phó',     homeTab:'progress',   color:'#2563eb' },
  // L2
  qs_site:         { level:2, domains:['qs'],                     label:'QS site',          homeTab:'qs',         color:'#7c3aed' },
  qaqc_site:       { level:2, domains:['qaqc'],                   label:'QA/QC site',       homeTab:'qa-qc',      color:'#059669' },
  ks_giam_sat:     { level:2, domains:['site','qaqc'],            label:'KS Giám sát',      homeTab:'giam-sat',   color:'#16a34a' },
  hse_site:        { level:2, domains:['hse'],                    label:'HSE site',         homeTab:'hse',        color:'#dc2626' },
  ke_toan_site:    { level:2, domains:['finance'],                label:'Kế toán site',     homeTab:'accounting', color:'#059669' },
  ke_toan_kho:     { level:2, domains:['finance','warehouse'],    label:'Kế toán kho',      homeTab:'resources',  color:'#0891b2' },
  hr_site:         { level:2, domains:['hr','site'],              label:'Nhân sự site',     homeTab:'hr',         color:'#7c3aed' },
  // L1
  thu_kho:         { level:1, domains:['warehouse'],              label:'Thủ kho',          homeTab:'resources',  color:'#d97706' },
  thu_ky_site:     { level:1, domains:['admin'],                  label:'Thư ký site',      homeTab:'office',     color:'#64748b' },
  operator:        { level:1, domains:['site'],                   label:'Vận hành thiết bị',homeTab:'equipment',  color:'#64748b' },
  ntp_site:        { level:1, domains:['site'],                   label:'NTP nội bộ',       homeTab:'progress',   color:'#ea580c' },
  to_doi:          { level:1, domains:['site'],                   label:'Tổ đội thi công',  homeTab:'progress',   color:'#ea580c' },
  ky_thuat_vien:   { level:1, domains:['site','qaqc'],            label:'Kỹ thuật viên',    homeTab:'qa-qc',      color:'#64748b' },
  // Legacy aliases
  ke_toan:         { level:2, domains:['finance','cross'],        label:'Kế toán site',     homeTab:'accounting', color:'#059669' },
  giam_sat:        { level:2, domains:['site','qaqc'],            label:'KS Giám sát',      homeTab:'giam-sat',   color:'#16a34a' },
  admin:           { level:5, domains:['cross','admin'],          label:'Giám đốc CT',      homeTab:'overview',   color:'#7c3aed' },
  thu_ky_ho:       { level:1, domains:['admin'],                  label:'Thư ký HO',        homeTab:'office',     color:'#64748b' },
};

// ─── Color map ────────────────────────────────────────────────────────────────
const COLOR: Record<string, { bg: string; text: string; border: string; chip: string }> = {
  emerald: { bg:'bg-emerald-500', text:'text-emerald-700', border:'border-emerald-200', chip:'bg-emerald-100 text-emerald-700' },
  blue:    { bg:'bg-blue-500',    text:'text-blue-700',    border:'border-blue-200',    chip:'bg-blue-100 text-blue-700'       },
  violet:  { bg:'bg-violet-500',  text:'text-violet-700',  border:'border-violet-200',  chip:'bg-violet-100 text-violet-700'   },
  amber:   { bg:'bg-amber-500',   text:'text-amber-700',   border:'border-amber-200',   chip:'bg-amber-100 text-amber-700'     },
  rose:    { bg:'bg-rose-500',    text:'text-rose-700',    border:'border-rose-200',    chip:'bg-rose-100 text-rose-700'       },
  orange:  { bg:'bg-orange-500',  text:'text-orange-700',  border:'border-orange-200',  chip:'bg-orange-100 text-orange-700'   },
  indigo:  { bg:'bg-indigo-500',  text:'text-indigo-700',  border:'border-indigo-200',  chip:'bg-indigo-100 text-indigo-700'   },
};

interface WorkspaceActionBarProps {
  currentRole: string;
  onNavigate: (tabId: string, subTab?: string) => void;
  pendingCount?: number;
  projectName?: string;
  forceOpen?: boolean;          // Taskbar trigger mở từ ngoài
  onOpenChange?: (open: boolean) => void; // notify parent
}

export default function WorkspaceActionBar({
  currentRole,
  onNavigate,
  pendingCount = 0,
  projectName,
  forceOpen,
  onOpenChange,
}: WorkspaceActionBarProps) {
  const [open, setOpen]         = useState(false);
  const [search, setSearch]     = useState('');
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const panelRef  = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const roleCfg   = ROLE_CFG[currentRole] || ROLE_CFG.giam_sat;
  const { level, domains, label: roleLabel, color: roleColor } = roleCfg;

  // Actions filtered by permission
  const permitted = ACTIONS.filter(a => canAccess(a, level, domains));

  // Groups present in permitted
  const groupOrder = ['materials','qs','finance','procurement','qaqc','hse','hr'];
  const groups = groupOrder
    .map(g => ({
      id: g,
      label: permitted.find(a => a.group === g)?.groupLabel || g,
      actions: permitted.filter(a => a.group === g),
      color: permitted.find(a => a.group === g)?.color || 'emerald',
    }))
    .filter(g => g.actions.length > 0);

  // Search filter
  const searchLower = search.toLowerCase();
  const visibleActions = permitted.filter(a =>
    !search ||
    a.label.toLowerCase().includes(searchLower) ||
    a.shortLabel.toLowerCase().includes(searchLower) ||
    a.code.toLowerCase().includes(searchLower) ||
    a.group.toLowerCase().includes(searchLower)
  );
  const groupedVisible = groups.map(g => ({
    ...g,
    actions: visibleActions.filter(a => a.group === g.id &&
      (!activeGroup || activeGroup === g.id)
    ),
  })).filter(g => g.actions.length > 0);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) { setOpen(false); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Focus search when open
  useEffect(() => {
    if (open) { setTimeout(() => searchRef.current?.focus(), 80); }
    else { setSearch(''); }
  }, [open]);

  // forceOpen từ Taskbar trigger
  useEffect(() => {
    if (forceOpen === true) { setOpen(true); }
  }, [forceOpen]);

  // Notify parent khi open thay đổi — trong effect, không trong render/handler
  useEffect(() => {
    onOpenChange?.(open);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(v => !v);
      }
      if (e.key === 'Escape') { setOpen(false); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Actions that open modal directly — không cần navigate
  const MODAL_ACTIONS = new Set([
    'NCR','RFI','INSPECTION_REQUEST','MATERIAL_APPROVAL','ITP_MANAGEMENT','HSE_INCIDENT','PERMIT_TO_WORK',
    'WAREHOUSE_EXIT','WAREHOUSE_ENTRY','MATERIAL_REQUEST','PAYMENT_REQUEST',
    'VARIATION_ORDER','ACCEPTANCE_INTERNAL','OVERTIME_REQUEST',
    'LEAVE_REQUEST','EMPLOYEE_NEW','TIMESHEET','OVERTIME_REQUEST','HSE_INSPECTION','CAPA',
  ]);

  // Navigate and close — fire CustomEvent cho modal actions
  const handleAction = useCallback((action: WorkspaceAction) => {
    setOpen(false);
    setSearch('');
    setActiveGroup(null);

    if (MODAL_ACTIONS.has(action.id)) {
      // Navigate đến đúng tab trước
      onNavigate(action.tabId, action.subTab);
      if (action.subTab) sessionStorage.setItem('gem_action_subtab', action.subTab);
      // Fire event để dashboard con mở modal
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('gem:open-action', { detail: { actionId: action.id, subTab: action.subTab } }));
      }, 300);
    } else {
      // Navigate only
      onNavigate(action.tabId, action.subTab);
      if (action.subTab) sessionStorage.setItem('gem_action_subtab', action.subTab);
    }
  }, [onNavigate, onOpenChange]);

  // Quick home navigation
  const goHome = useCallback(() => {
    onNavigate(roleCfg.homeTab);
  }, [onNavigate, roleCfg.homeTab]);

  return (
    <div className="relative z-50" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* ── TRIGGER BAR ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5">
        {/* Home chip */}
        <button
          onClick={goHome}
          title={`Về trang chính của ${roleLabel}`}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all"
          style={{
            background: roleColor + '18',
            color: roleColor,
            border: `1px solid ${roleColor}30`,
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: roleColor }} />
          <span className="hidden sm:inline truncate max-w-[90px]">{roleLabel}</span>
        </button>

        {/* Main trigger */}
        <button
          ref={triggerRef}
          onClick={() => setOpen(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
            open
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
          }`}
        >
          <Zap size={12} className={open ? 'text-yellow-400' : 'text-slate-400'} />
          <span>Tác nghiệp</span>
          {permitted.length > 0 && (
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
              open ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              {permitted.length}
            </span>
          )}
          <kbd className={`text-[8px] px-1 py-0.5 rounded font-mono ${
            open ? 'bg-white/15 text-white/70' : 'bg-slate-100 text-slate-400'
          }`}>⌘K</kbd>
          {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
      </div>

      {/* ── DROPDOWN PANEL ───────────────────────────────────────────────────── */}
      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-[420px] max-w-[calc(100vw-1rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
          style={{
            animation: 'dropIn 0.15s cubic-bezier(0.16,1,0.3,1)',
            transformOrigin: 'top right',
          }}
        >
          <style>{`
            @keyframes dropIn {
              from { opacity:0; transform:scale(0.95) translateY(-6px); }
              to   { opacity:1; transform:scale(1)    translateY(0);    }
            }
          `}</style>

          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: roleColor + '20' }}>
                  <Zap size={13} style={{ color: roleColor }} />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-800 leading-none">Thanh Tác Nghiệp</p>
                  <p className="text-[9px] text-slate-400 mt-0.5">{permitted.length} nghiệp vụ · {roleLabel}</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)}
                className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors">
                <X size={12} className="text-slate-400" />
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                value={search}
                onChange={e => { setSearch(e.target.value); setActiveGroup(null); }}
                placeholder="Tìm nghiệp vụ, mã... (VD: A1, NCR, phiếu xuất)"
                className="w-full pl-8 pr-3 py-2 text-[11px] bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-300 placeholder:text-slate-300"
              />
            </div>

            {/* Group filter chips */}
            {!search && (
              <div className="flex gap-1 mt-2 flex-wrap">
                <button
                  onClick={() => setActiveGroup(null)}
                  className={`px-2 py-1 rounded-lg text-[9px] font-bold transition-colors ${
                    !activeGroup ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  Tất cả
                </button>
                {groups.map(g => (
                  <button
                    key={g.id}
                    onClick={() => setActiveGroup(activeGroup === g.id ? null : g.id)}
                    className={`px-2 py-1 rounded-lg text-[9px] font-bold transition-colors ${
                      activeGroup === g.id
                        ? `${COLOR[g.color]?.bg || 'bg-slate-500'} text-white`
                        : `${COLOR[g.color]?.chip || 'bg-slate-100 text-slate-600'} hover:opacity-80`
                    }`}
                  >
                    {g.label} <span className="opacity-70">({g.actions.length})</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Action list */}
          <div className="overflow-y-auto max-h-[400px] overscroll-contain">
            {groupedVisible.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-xs text-slate-400">Không tìm thấy nghiệp vụ phù hợp</p>
              </div>
            ) : (
              groupedVisible.map(g => (
                <div key={g.id}>
                  {/* Group header */}
                  <div className={`px-4 py-1.5 flex items-center gap-2 sticky top-0 bg-white border-b border-slate-50`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${COLOR[g.color]?.bg || 'bg-slate-400'}`} />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      {g.label}
                    </span>
                    <span className="text-[9px] text-slate-300 ml-auto">{g.actions.length} nghiệp vụ</span>
                  </div>

                  {/* Actions */}
                  {g.actions.map(action => (
                    <button
                      key={action.id}
                      onClick={() => handleAction(action)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors group border-b border-slate-50 last:border-0"
                    >
                      {/* Code badge */}
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md shrink-0 ${COLOR[action.color]?.chip || 'bg-slate-100 text-slate-600'}`}>
                        {action.code}
                      </span>

                      {/* Icon */}
                      <span className={`shrink-0 ${COLOR[action.color]?.text || 'text-slate-500'}`}>
                        {action.icon}
                      </span>

                      {/* Label */}
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-xs font-semibold text-slate-700 group-hover:text-slate-900 truncate leading-tight">
                          {action.label}
                        </p>
                      </div>

                      {/* CTA */}
                      <span className={`text-[9px] font-bold px-2 py-1 rounded-lg shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ${
                        COLOR[action.color]?.chip || 'bg-slate-100 text-slate-600'
                      }`}>
                        {action.actionLabel} <ArrowRight size={8} />
                      </span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <p className="text-[9px] text-slate-400">
              Click để điều hướng thẳng vào nghiệp vụ
            </p>
            {pendingCount > 0 && (
              <button
                onClick={() => { onNavigate('approval-queue'); setOpen(false); }}
                className="flex items-center gap-1 text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg hover:bg-rose-100"
              >
                <CheckCircle2 size={9} /> {pendingCount} chờ duyệt
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
