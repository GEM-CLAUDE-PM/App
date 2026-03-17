import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import ReactDOM from 'react-dom';
import { db } from './db';
import { getSupabase } from './supabase';
import { useNotification } from './NotificationEngine';
import { LayoutDashboard, Folder, TrendingUp, Clock, HardDrive, CheckCircle2, Lock, FileText, Image as ImageIcon, Files, ClipboardList, ExternalLink, BookOpen, UploadCloud, Loader2, Plus, Printer, Users, HardHat, Camera, ShieldAlert, Sun, MessageCircle, Network, HeartPulse, AlertTriangle, Mic, Edit3, Unlock, X, Award, Target, GraduationCap, Briefcase, ChevronRight, ArrowRight, Building2, CheckCircle, CircleDashed, ArrowLeft, ChevronDown, Cloud, Download, Eye, MoreVertical, ChevronLeft, Calendar, ShieldCheck, Trash2, Sparkles, User, Info, ChevronUp, Wrench, Truck, Fuel, Activity, Zap, Settings, AlertCircle, Search, Scan, FileSpreadsheet, Save, Calculator, Copy, Bell, Package, ShoppingCart } from 'lucide-react';
import { OnboardingTutorial } from './OnboardingTutorial';
import QaQcDashboard from './QaQcDashboard';
import QSDashboard from './QSDashboard';
import Markdown from 'react-markdown';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { mockCashFlowData, seedProjectTemplates } from '../constants/mockData';

// ── Sub-dashboard components ──────────────────────────────────────────────────
import ManpowerDashboard  from './ManpowerDashboard';
import HRWorkspace        from './HRWorkspace';
import BOQDashboard        from './BOQDashboard';
import ProcurementDashboard from './ProcurementDashboard';
import ContractDashboard  from './ContractDashboard';
import GiamSatDashboard   from './GiamSatDashboard';
import ReportsDashboard   from './ReportsDashboard';
import ProgressDashboard  from './ProgressDashboard';
import MaterialsDashboard from './MaterialsDashboard';
import EquipmentDashboard from './EquipmentDashboard';
import RecordsDashboard   from './RecordsDashboard';
import OfficeDashboard    from './OfficeDashboard';
import StorageDashboard   from './StorageDashboard';
import HSEWorkspace       from './HSEWorkspace';
import { useAuth }         from './AuthProvider';
import NotificationEngine from './NotificationEngine';
import GemAIDashboard    from './GemAIDashboard';
import RiskDashboard     from './RiskDashboard';
import AccountingDashboard from './AccountingDashboard';
import ApprovalQueue from './ApprovalQueue';
import MemberSwitcher from './MemberSwitcher';
import DelegationManager from './DelegationManager';
import ProjectSetupWizard, { type NewProjectData } from './ProjectSetupWizard';
import ProjectConfigPanel from './ProjectConfigPanel';
import { getProjectTemplate, PROJECT_TEMPLATES } from './projectTemplates';
import {
  usePermissions, createLegacyContext, LEGACY_ROLE_MAP,
  filterProjectsByScope, getRoleProjectScope,
  AUTHORITY_LEVEL, ROLES,
  type RoleId, type Domain, type UserContext,
} from './permissions';
import { getPendingCount } from './approvalEngine';
import {
  getCurrentMember, buildCtxFromMember, switchActiveRole, setActiveMemberSnap,
  seedMembersIfEmpty, loadMembers, saveMembers, type ProjectMember,
  autoAssignMemberOnSeed,
} from './projectMember';



interface ProjectDashboardProps {
  initialTab?: string;
  initialManpowerTab?: string;
  initialSubTab?: string;
  navKey?: number;
  initialProjectId?: string | null; // project được navigate tới
  projects: any[];
  setProjects: React.Dispatch<React.SetStateAction<any[]>>;
  selectedProjectId: string | null;
  setSelectedProjectId: React.Dispatch<React.SetStateAction<string | null>>;
  generateWeeklyReport: () => Promise<void>;
  setShowRecordForm: React.Dispatch<React.SetStateAction<boolean>>;
  setRecordType: React.Dispatch<React.SetStateAction<string>>;
  setShowProfileForm: React.Dispatch<React.SetStateAction<boolean>>;
  setShowHseForm: React.Dispatch<React.SetStateAction<boolean>>;
  isGeneratingReport: boolean;
  generatedReport: string | null;
  showRecordForm: boolean;
  recordType: string;
  recordData: any;
  setRecordData: React.Dispatch<React.SetStateAction<any>>;
  isGeneratingRecord: boolean;
  generateGemRecord: () => Promise<void>;
  showProfileForm: boolean;
  showHseForm: boolean;
  onBackToList?: () => void;
  onPushNotification?: (notif: any) => void;
  onRequestNewProject?: () => void;
  onNavigateApp?: (tab: string) => void;
}

export default function ProjectDashboard({
  initialTab, initialManpowerTab, initialSubTab, navKey, initialProjectId, projects, setProjects, selectedProjectId, setSelectedProjectId,
  generateWeeklyReport, setShowRecordForm, setRecordType,
  setShowProfileForm, setShowHseForm, isGeneratingReport, generatedReport,
  showRecordForm, recordType, recordData, setRecordData, isGeneratingRecord, generateGemRecord,
  showProfileForm, showHseForm, onBackToList, onPushNotification, onRequestNewProject, onNavigateApp
}: ProjectDashboardProps) {
  const { ok: notifOk, info: notifInfo } = useNotification();
  const [activeTab, setActiveTab] = useState(initialTab || 'overview');
  const [dailyLogNotes, setDailyLogNotes] = useState<Record<string, string>>({});
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  // ── Auth & Permissions ───────────────────────────────────────────────────
  const { perm, user, roleId: authRoleId, allowedProjectIds } = useAuth();

  // Gate component — renders lock screen for unauthorised tabs
  const AccessDenied = ({ label }: { label: string }) => (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center mb-5 shadow-inner">
        <Lock size={34} className="text-rose-400" />
      </div>
      <p className="text-xl font-bold text-slate-700 mb-2">Không có quyền truy cập</p>
      <p className="text-sm text-slate-400 max-w-xs leading-relaxed">
        Tab <strong>{label}</strong> yêu cầu quyền cao hơn.<br/>
        Vui lòng liên hệ Giám đốc DA để được cấp quyền.
      </p>
      <div className="mt-4 px-4 py-2 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-600 font-semibold">
        Tài khoản hiện tại: {user?.full_name} — {user?.job_role}
      </div>
    </div>
  );

  const [isConnectedOneDrive, setIsConnectedOneDrive] = useState(true);
  const [isConnectedGoogleDrive, setIsConnectedGoogleDrive] = useState(true);
  const [cloudSource, setCloudSource] = useState<'onedrive' | 'gdrive'>('onedrive');

  // ── Contract Security ────────────────────────────────────────────────────
  // Role system — trước Supabase dùng localStorage role selector
  // Sau Supabase: đọc từ JWT claims
  type UserRole = 'giam_doc' | 'ke_toan' | 'chi_huy_truong' | 'giam_sat'
    | 'pm' | 'chi_huy_pho' | 'thu_kho' | 'qs_site';
  const ROLE_LABELS: Record<UserRole, string> = {
    giam_doc:       'Giám đốc DA',          // L5 — full access
    ke_toan:        'Kế toán site',          // L2 — domain: finance
    chi_huy_truong: 'Chỉ huy trưởng',       // L3 — site + cross
    giam_sat:       'KS Giám sát',           // L2 — site + qaqc
    pm:             'Project Manager',       // L4 — cross domain
    chi_huy_pho:    'Chỉ huy phó',          // L3 — site + cross
    thu_kho:        'Thủ kho',              // L1 — warehouse only
    qs_site:        'QS site',              // L2 — qs domain
  };
  const CONTRACT_PIN = (import.meta as any).env?.VITE_CONTRACT_PIN || '1234';
  const SESSION_KEY  = 'gem_contract_session';
  const AUDIT_KEY    = `gem_db__contract_audit__${selectedProjectId || 'default'}`;
  const SESSION_TTL  = 15 * 60 * 1000; // 15 phút

  // Sync role từ auth user.job_role — pass-through vì job_role = roleId chuẩn v3
  // Legacy aliases cho các role cũ
  const JOB_TO_ROLE: Record<string, string> = {
    // Pass-through — 24 roles v3 (job_role = roleId)
    giam_doc:'giam_doc', pm:'pm', ke_toan_truong:'ke_toan_truong',
    truong_qs:'truong_qs', truong_qaqc:'truong_qaqc', truong_hse:'truong_hse', hr_truong:'hr_truong',
    chi_huy_truong:'chi_huy_truong', chi_huy_pho:'chi_huy_pho',
    qs_site:'qs_site', qaqc_site:'qaqc_site', ks_giam_sat:'ks_giam_sat',
    hse_site:'hse_site', ke_toan_site:'ke_toan_site', ke_toan_kho:'ke_toan_kho', hr_site:'hr_site',
    thu_kho:'thu_kho', thu_ky_site:'thu_ky_site', operator:'operator',
    ntp_site:'ntp_site', to_doi:'to_doi', ky_thuat_vien:'ky_thuat_vien',
    // Legacy aliases
    ke_toan:'ke_toan_site', giam_sat:'ks_giam_sat',
    tvgs:'ks_giam_sat', qs:'qs_site', qa_qc:'qaqc_site',
    hse:'hse_site', hr:'hr_site', thu_ky:'thu_ky_site',
  };

  // currentRole — lấy trực tiếp từ AuthProvider (đã resolve đúng)
  // Dev mode: có thể override qua Dev Switcher
  const _authRole = (authRoleId || user?.job_role || 'operator') as UserRole;
  const [currentRole, setCurrentRole] = useState<UserRole>(() => _authRole as UserRole);

  // Sync role khi auth user thay đổi
  useEffect(() => {
    if (_authRole && _authRole !== 'operator') {
      setCurrentRole(_authRole);
      localStorage.setItem('gem_user_role', _authRole);
    }
    if (!user) {
      localStorage.removeItem('gem_user_role');
      localStorage.removeItem('gem_active_member');
    }
  }, [user?.id, authRoleId]);
  const [contractUnlocked, setContractUnlocked] = useState<boolean>(() => {
    try {
      const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      return s && Date.now() - s.ts < SESSION_TTL;
    } catch { return false; }
  });
  const [pinInput, setPinInput]     = useState('');
  const [pinError, setPinError]     = useState('');
  const [pinAttempts, setPinAttempts] = useState(0);
  const [pinLockUntil, setPinLockUntil] = useState(0);
  const [showPinDialog, setShowPinDialog] = useState(false);
  // ── Approval Thresholds — configurable per project (L4+) ────────────────
  const THRESHOLD_KEY = (pid: string) => `gem_db__project_config__${pid}`;
  const [thresholds, setThresholds] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(THRESHOLD_KEY(selectedProjectId || 'default')) || 'null');
      return saved || { L3_max: 50_000_000, L4_max: 500_000_000, warehouse_exit: 50_000_000, payment: 50_000_000 };
    } catch { return { L3_max: 50_000_000, L4_max: 500_000_000, warehouse_exit: 50_000_000, payment: 50_000_000 }; }
  });
  const [showThresholdPanel, setShowThresholdPanel] = useState(false);
  const saveThresholds = (t: typeof thresholds) => {
    setThresholds(t);
    localStorage.setItem(THRESHOLD_KEY(selectedProjectId || 'default'), JSON.stringify(t));
  };

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    // Default: mở dựa trên role — set lại khi role thay đổi
    return { 'thi-cong': true, 'nhan-su': false, 'tai-chinh': false, 'hanh-chinh': false };
  });

  // Sync openGroups defaults when role changes
  useEffect(() => {
    const legacyToNew2: Record<string, string> = {
      giam_doc:'giam_doc', ke_toan:'ke_toan_site',
      chi_huy_truong:'chi_huy_truong', giam_sat:'ks_giam_sat',
      admin:'giam_doc', thu_ky_ho:'thu_ky_site',
    };
    const domMap: Record<string, string[]> = {
      giam_doc:['cross','admin'], pm:['cross','finance','qs','site'],
      ke_toan_truong:['finance','cross'], ke_toan_site:['finance'],
      ke_toan_kho:['finance','warehouse'],
      truong_qs:['qs','cross'], truong_qaqc:['qaqc','cross'],
      truong_hse:['hse','cross'], hr_truong:['hr','cross'],
      chi_huy_truong:['site','cross'], chi_huy_pho:['site','cross'],
      ks_giam_sat:['site','qaqc'], qaqc_site:['qaqc'], qs_site:['qs'],
      hse_site:['hse'], hr_site:['hr','site'],
      thu_kho:['warehouse'], thu_ky_site:['admin'],
      operator:['site'], ntp_site:['site'], to_doi:['site'],
      ky_thuat_vien:['site','qaqc'],
    };
    const lvlMap: Record<string, number> = {
      giam_doc:5, pm:4, ke_toan_truong:4,
      truong_qs:3, truong_qaqc:3, truong_hse:3, hr_truong:3,
      chi_huy_truong:3, chi_huy_pho:3,
      qs_site:2, qaqc_site:2, ks_giam_sat:2, hse_site:2,
      ke_toan_site:2, ke_toan_kho:2, hr_site:2,
      thu_kho:1, thu_ky_site:1, operator:1,
      ntp_site:1, to_doi:1, ky_thuat_vien:1,
    };
    const rid = legacyToNew2[currentRole] || currentRole;
    const d = domMap[rid] || [];
    const l = lvlMap[rid] || 1;
    setOpenGroups({
      'thi-cong':  d.includes('site') || d.includes('qaqc') || l >= 3,
      'nhan-su':   l >= 3,
      'tai-chinh': d.includes('finance') || d.includes('qs') || l >= 4,
      'hanh-chinh':l >= 4,
    });
  }, [currentRole]);

  // Role-based access control
  const canSeeContractTab  = true; // Controlled by getAccess() in sidebar
  // canSeeFullValues — dùng authRoleId từ AuthProvider (đã resolve đúng)
  const canSeeFullValues = (() => {
    const lvlMap: Record<string,number> = {
      giam_doc:5, pm:4, ke_toan_truong:4,
      truong_qs:3, truong_qaqc:3, truong_hse:3, hr_truong:3,
      chi_huy_truong:3, chi_huy_pho:3,
      qs_site:2, qaqc_site:2, ks_giam_sat:2, hse_site:2,
      ke_toan_site:2, ke_toan_kho:2, hr_site:2,
      thu_kho:1, thu_ky_site:1, operator:1,
    };
    const domMap: Record<string,string[]> = {
      giam_doc:['cross','admin'], pm:['cross','finance','qs','site'],
      ke_toan_truong:['finance','cross'], truong_qs:['qs','cross'],
      chi_huy_truong:['site','cross'], chi_huy_pho:['site','cross'],
      ke_toan_site:['finance'], ke_toan_kho:['finance','warehouse'], qs_site:['qs'],
    };
    const role = authRoleId || currentRole;
    const lvl = lvlMap[role] ?? 1;
    const dom = domMap[role] ?? [];
    return lvl >= 4 || dom.includes('cross') || dom.includes('finance');
  })();

  // Audit log helpers
  const writeAuditLog = React.useCallback((action: string, detail: string) => {
    try {
      const logs = JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]');
      logs.unshift({
        ts: new Date().toISOString(),
        role: ROLE_LABELS[currentRole],
        action, detail,
      });
      localStorage.setItem(AUDIT_KEY, JSON.stringify(logs.slice(0, 100)));
    } catch {}
  }, [currentRole]);

  const unlockContract = () => {
    const now = Date.now();
    if (now < pinLockUntil) return;
    if (pinInput === CONTRACT_PIN) {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ ts: now, role: currentRole }));
      setContractUnlocked(true);
      setPinInput(''); setPinError(''); setPinAttempts(0);
      setShowPinDialog(false);
      writeAuditLog('UNLOCK', 'Mở khoá tab Hợp đồng thành công');
    } else {
      const next = pinAttempts + 1;
      setPinAttempts(next);
      setPinInput('');
      if (next >= 3) {
        const lockUntil = now + 5 * 60 * 1000;
        setPinLockUntil(lockUntil);
        setPinError('Sai 3 lần — khoá 5 phút');
        writeAuditLog('LOCK', 'Nhập PIN sai 3 lần — bị khoá');
      } else {
        setPinError(`Sai PIN. Còn ${3 - next} lần thử.`);
      }
    }
  };
  
  // States cho phần AI trích xuất dữ liệu
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States cho phần AI phân tích bản vẽ
  const [isAnalyzingDrawing, setIsAnalyzingDrawing] = useState(false);
  const [analyzedDrawing, setAnalyzedDrawing] = useState<any>(null);
  const drawingInputRef = useRef<HTMLInputElement>(null);

  // State cho Nhật ký công trình
  const [showDailyLogQA, setShowDailyLogQA] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date('2026-02-28T00:00:00'));

  const formatDateToYYYYMMDD = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  // State cho Sub-tabs trong Nhân lực
  const [manpowerTab, setManpowerTab] = useState(initialManpowerTab || 'site');
  const [isOrgExpanded, setIsOrgExpanded] = useState(false);
  const [personnelCategory, setPersonnelCategory] = useState<'management' | 'worker'>('management');
  const [timePeriod, setTimePeriod] = useState<'month' | '1week' | '2week'>('month');
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [salaryType, setSalaryType] = useState<'month' | 'day'>('month');
  const [payrollFormula, setPayrollFormula] = useState('((Lương CB / 26) * Ngày công) + (Tăng ca * (Lương CB / 26 / 8) * Hệ số) + Phụ cấp + Thưởng - Thuế');
  const [otCoefficient, setOtCoefficient] = useState(1.5);
  
  // State cho Sơ đồ tổ chức
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [isOrgUnlocked, setIsOrgUnlocked] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [showGemChat, setShowGemChat] = useState(false);

  const [showProfileGemChat, setShowProfileGemChat] = useState(false);
  const [showHseGemChat, setShowHseGemChat] = useState(false);
  const [showRecordGemChat, setShowRecordGemChat] = useState(false);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ── Effective project — dùng local state để tránh stale derived value ───────
  const [localProjectId, setLocalProjectId] = useState<string | null>(
    initialProjectId ?? selectedProjectId ?? null
  );
  const selectedProject = projects.find(p => p.id === localProjectId) || null;

  // Seed members cho project hiện tại khi chọn
  useEffect(() => {
    if (localProjectId) seedMembersIfEmpty(localProjectId);
  }, [localProjectId]);

  // Seed members cho TẤT CẢ projects khi portfolio view mount lần đầu
  // → đảm bảo gem_member_projects_* có data trước khi scope filter chạy
  useEffect(() => {
    projects.forEach((p: any) => seedMembersIfEmpty(p.id));
    seedProjectTemplates(); // G2 fix: seed templateId vào localStorage cho mỗi mock project
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // chỉ chạy 1 lần khi mount

  const [expandedCategories, setExpandedCategories] = useState({
    inProgress: true,
    potential: true,
    completed: false
  });

  const [showTutorial, setShowTutorial]           = useState(false);
  const [showSetupWizard, setShowSetupWizard]       = useState(false);
  // Permission overrides — { tab_id: 'full'|'readonly'|'hidden' } cho user hiện tại trong DA này
  const [permOverrides, setPermOverrides] = useState<Record<string, 'full'|'readonly'|'hidden'>>({});

  // Load permission overrides từ Supabase
  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !localProjectId) { setPermOverrides({}); return; }
    sb.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      sb.from('project_member_overrides')
        .select('tab_id, access_level')
        .eq('project_id', localProjectId)
        .eq('user_id', data.user.id)
        .then(({ data: rows }) => {
          if (rows) {
            const map: Record<string, 'full'|'readonly'|'hidden'> = {};
            rows.forEach((r: any) => { map[r.tab_id] = r.access_level; });
            setPermOverrides(map);
          }
        });
    });
  }, [localProjectId]);
  const [showDelegation, setShowDelegation]         = useState(false);
  const [showMaterialDetails, setShowMaterialDetails] = useState(false);
  const [materialFilter, setMaterialFilter] = useState<'all' | 'low' | 'sufficient' | 'excess'>('all');
  const [docSearchTerm, setDocSearchTerm] = useState('');
  const [docCategory, setDocCategory] = useState('Tất cả');
  const [materialSort, setMaterialSort] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

  // ── Collapsible section state (always declared) ────────────────────────────
  const [potentialOpen, setPotentialOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [showDetailMenu, setShowDetailMenu] = useState(false);

  const changeProjectType = useCallback((id: string, newType: string) => {
    setProjects(prev => prev.map(p => p.id === id ? {...p, type: newType} : p));
  }, [setProjects]);

  const handleDeleteProject = useCallback((id: string) => {
    if (!window.confirm('Xóa dự án này?')) return;
    setProjects(prev => prev.filter(p => p.id !== id));
    if (selectedProjectId === id) setSelectedProjectId(null);
  }, [setProjects, selectedProjectId, setSelectedProjectId]);
  // ── Project List state (always declared — Rules of Hooks) ─────────────────
  const [listSearch, setListSearch]  = useState('');
  const [listFilter, setListFilter]  = useState<'all'|'in_progress'|'potential'|'completed'>('all');
  const [listSort,   setListSort]    = useState<'name'|'progress'|'spi'|'budget'>('progress');
  const [sortAsc,    setSortAsc]     = useState(false);

  const filteredAndSortedMaterials = useMemo(() => {
    let result: any[] = [];

    // Filter
    if (materialFilter !== 'all') {
      result = result.filter(item => {
        const ratio = item.tonKho / item.threshold;
        if (materialFilter === 'low') return ratio < 1;
        if (materialFilter === 'sufficient') return ratio >= 1 && ratio <= 2;
        if (materialFilter === 'excess') return ratio > 2;
        return true;
      });
    }

    // Sort
    result.sort((a, b) => {
      let valA = a[materialSort.key as keyof typeof a];
      let valB = b[materialSort.key as keyof typeof b];

      // Handle numeric strings like "15,000,000"
      if (typeof valA === 'string' && valA.includes(',')) {
        valA = parseFloat(valA.replace(/,/g, ''));
        valB = parseFloat((valB as string).replace(/,/g, ''));
      }

      if (valA < valB) return materialSort.direction === 'asc' ? -1 : 1;
      if (valA > valB) return materialSort.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [materialFilter, materialSort]);

  const [expandedNodes, setExpandedNodes] = useState<string[]>(['1', '2', '3', '4', '6']);

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => 
      prev.includes(nodeId) ? prev.filter(id => id !== nodeId) : [...prev, nodeId]
    );
  };

  const toggleCategory = (category: keyof typeof expandedCategories) => {
    setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  // ── Navigation — navKey thay đổi mỗi lần navigate → apply đồng thời ────────
  const prevNavKey = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!navKey || navKey === prevNavKey.current) return;
    prevNavKey.current = navKey;
    // Cập nhật project
    if (initialProjectId) {
      setLocalProjectId(initialProjectId);
      setSelectedProjectId(initialProjectId);
    }
    // Cập nhật tab
    setActiveTab(initialTab || 'overview');
    if (initialManpowerTab) setManpowerTab(initialManpowerTab);
    if (initialSubTab) sessionStorage.setItem('gem_action_subtab', initialSubTab);
  }, [navKey]); // eslint-disable-line

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.origin.endsWith('.run.app') && !event.origin.includes('localhost')) return;
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        if (event.data?.provider === 'google') {
          setIsConnectedGoogleDrive(true);
          setCloudSource('gdrive');
        } else {
          setIsConnectedOneDrive(true);
          setCloudSource('onedrive');
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleConnectOneDrive = () => {
    notifInfo('Dạ em đang kết nối với OneDrive của anh nhé!');
    setIsConnectedOneDrive(true);
  };

  const handleConnectGoogleDrive = () => {
    notifInfo('Dạ em đang kết nối với Google Drive của anh nhé!');
    setIsConnectedGoogleDrive(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Mô phỏng quá trình AI đọc file
    setIsExtracting(true);
    setExtractedData(null);

    setTimeout(() => {
      setIsExtracting(false);
      // Giả lập kết quả AI bóc tách được từ hình ảnh/PDF hóa đơn
      setExtractedData({
        fileName: file.name,
        type: 'Hóa đơn vật tư',
        supplier: 'Công ty Thép Hòa Phát',
        date: '27/02/2026',
        items: [
          { name: 'Thép cuộn CB240', quantity: 20, unit: 'Tấn', price: 15000000, total: 300000000 },
          { name: 'Thép thanh vằn CB300', quantity: 30, unit: 'Tấn', price: 15500000, total: 465000000 }
        ],
        totalAmount: 765000000
      });
    }, 2500);
  };

  const handleSaveExtractedData = () => {
    notifOk('Dạ em đã lưu số liệu này vào cơ sở dữ liệu và cập nhật lên biểu đồ rồi nghen anh!');
    setExtractedData(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrawingUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzingDrawing(true);
    setAnalyzedDrawing(null);

    setTimeout(() => {
      setIsAnalyzingDrawing(false);
      setAnalyzedDrawing({
        fileName: file.name,
        title: 'Bản vẽ kết cấu móng trục A-B',
        category: 'Kết cấu',
        scale: '1:50',
        date: '28/02/2026',
        materials: [
          { name: 'Bê tông lót móng', spec: 'Mác 100', quantity: '15 m3' },
          { name: 'Bê tông móng', spec: 'Mác 250', quantity: '45 m3' },
          { name: 'Thép móng', spec: 'CB300-V', quantity: '2.5 Tấn' },
          { name: 'Ván khuôn', spec: 'Gỗ phủ phim', quantity: '120 m2' }
        ],
        notes: [
          'Cần đầm kỹ lớp cát đệm trước khi đổ bê tông lót.',
          'Thép chờ cột phải đảm bảo chiều dài neo tối thiểu 40d.',
          'Kiểm tra cao độ đáy móng trước khi thi công.'
        ]
      });
    }, 3000);
  };

  const handleSaveDrawingData = () => {
    notifOk('Dạ em đã lưu thông tin bóc tách từ bản vẽ vào hệ thống rồi anh nhé!');
    setAnalyzedDrawing(null);
    if (drawingInputRef.current) drawingInputRef.current.value = '';
  };

  // ── Tab content router ────────────────────────────────────────────────────
  const renderContent = () => {
    // ── Permission context cho renderContent ──────────────────────────────
    const _lvlMap: Record<string, number> = {
      giam_doc:5, pm:4, ke_toan_truong:4,
      truong_qs:3, truong_qaqc:3, truong_hse:3, hr_truong:3,
      chi_huy_truong:3, chi_huy_pho:3,
      qs_site:2, qaqc_site:2, ks_giam_sat:2, hse_site:2,
      ke_toan_site:2, ke_toan_kho:2, hr_site:2,
      thu_kho:1, thu_ky_site:1, operator:1, ntp_site:1, to_doi:1, ky_thuat_vien:1,
    };
    const _domainMap: Record<string, string[]> = {
      giam_doc:['cross','admin'], pm:['cross','finance','qs','site'],
      ke_toan_truong:['finance','cross'], truong_qs:['qs','cross'],
      truong_qaqc:['qaqc','cross'], truong_hse:['hse','cross'],
      hr_truong:['hr','cross'],
      chi_huy_truong:['site','cross'], chi_huy_pho:['site','cross'],
      qs_site:['qs'], qaqc_site:['qaqc'], ks_giam_sat:['site','qaqc'],
      hse_site:['hse'], ke_toan_site:['finance'], ke_toan_kho:['finance','warehouse'],
      hr_site:['hr','site'],
      thu_kho:['warehouse'], thu_ky_site:['admin'], operator:['site'],
      ntp_site:['site'], to_doi:['site'], ky_thuat_vien:['site','qaqc'],
    };
    const _legacyToNew: Record<string, string> = {
      giam_doc:'giam_doc', ke_toan:'ke_toan_site', ke_toan_truong:'ke_toan_truong',
      chi_huy_truong:'chi_huy_truong', giam_sat:'ks_giam_sat',
      pm:'pm', chi_huy_pho:'chi_huy_pho', thu_kho:'thu_kho', qs_site:'qs_site',
      // Legacy fallbacks
      admin:'giam_doc', thu_ky_ho:'thu_ky_site',
      // New roles pass-through
      truong_qs:'truong_qs', truong_qaqc:'truong_qaqc', truong_hse:'truong_hse',
      hr_truong:'hr_truong', qaqc_site:'qaqc_site', ks_giam_sat:'ks_giam_sat',
      hse_site:'hse_site', ke_toan_kho:'ke_toan_kho', hr_site:'hr_site',
      thu_ky_site:'thu_ky_site', operator:'operator',
      ntp_site:'ntp_site', to_doi:'to_doi', ky_thuat_vien:'ky_thuat_vien',
    };
    const _roleKey = _legacyToNew[currentRole] || currentRole;
    const uLevel   = _lvlMap[_roleKey] ?? 1;
    const uDomains = _domainMap[_roleKey] ?? [];
    // maskSensitive = true → che đơn giá, giá trị HĐ trong BOQ/Contract
    const maskSensitive = uLevel < 4 && !uDomains.includes('cross');

    if (activeTab === 'overview') {
      const p = selectedProject;
      if (!p) return null;

      const alerts: { level: 'red'|'yellow'|'green'; msg: string }[] = [];
      if (p.spi != null && p.spi < 0.85) alerts.push({ level:'red',    msg:`SPI ${p.spi.toFixed(2)} — Tiến độ chậm nghiêm trọng, cần họp khẩn` });
      else if (p.spi != null && p.spi < 0.95) alerts.push({ level:'yellow', msg:`SPI ${p.spi.toFixed(2)} — Tiến độ hơi chậm, cần theo dõi chặt` });
      if (p.ncr > 3) alerts.push({ level:'red',    msg:`${p.ncr} NCR tồn đọng chưa đóng — rủi ro chất lượng cao` });
      else if (p.ncr > 0) alerts.push({ level:'yellow', msg:`${p.ncr} NCR chưa đóng — cần xử lý trong tuần` });
      if (p.hse > 0) alerts.push({ level:'yellow', msg:`${p.hse} vi phạm HSE — kiểm tra biện pháp khắc phục` });
      if (p.ntp_pending > 2) alerts.push({ level:'yellow', msg:`${p.ntp_pending} hồ sơ NTP chờ thanh toán — kiểm tra dòng tiền` });
      if (alerts.length === 0) alerts.push({ level:'green', msg:'Tất cả chỉ số ổn định — tiếp tục duy trì!' });

      const ganttItems = [
        { name:'Cột & Dầm T1-2', done:30, color:'bg-blue-500' },
        { name:'Sàn T1-2',        done:15, color:'bg-amber-500' },
        { name:'Hệ thống M&E',    done:10, color:'bg-violet-500' },
        { name:'Xây tường bao',   done:5,  color:'bg-orange-400' },
      ];
      const todos = [
        { type:'urgent', text:'Họp giao ban tuần — 8:00 AM' },
        { type:'task',   text:'Ký nghiệm thu cốt thép M3-M5' },
        { type:'task',   text:'Kiểm tra tiến độ sàn tầng 2' },
        { type:'warn',   text:'Xử lý NCR #004 — hạn hôm nay' },
      ];
      const activities = [
        { time:'Hôm nay 09:15', text:'GEM phát hiện vi phạm HSE Zone 2', tag:'hse' },
        { time:'Hôm qua 16:30', text:'Nghiệm thu cốt thép móng M1-M5 — Đạt', tag:'qaqc' },
        { time:'Hôm qua 14:00', text:'Nhà thầu phụ A gửi hồ sơ thanh toán đợt 2', tag:'qs' },
        { time:'2 ngày trước',  text:'Cập nhật tiến độ tháng 3/2026 — SPI 0.94', tag:'progress' },
      ];
      const tagColor: Record<string, string> = {
        hse:'bg-orange-100 text-orange-700', qaqc:'bg-emerald-100 text-emerald-700',
        qs:'bg-violet-100 text-violet-700',  progress:'bg-blue-100 text-blue-700',
      };

      return (
        <div className="space-y-5 animate-in fade-in duration-300">

          {/* ── Cảnh báo tự động ─────────────────────────────────────────── */}
          <div className="space-y-2">
            {alerts.map((a, i) => (
              <div key={i} className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${
                a.level === 'red'    ? 'bg-rose-50 border-rose-200 text-rose-800' :
                a.level === 'yellow' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                                       'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}>
                {a.level === 'red'    ? <AlertTriangle size={15} className="shrink-0 mt-0.5 text-rose-500"/> :
                 a.level === 'yellow' ? <AlertCircle   size={15} className="shrink-0 mt-0.5 text-amber-500"/> :
                                        <CheckCircle2  size={15} className="shrink-0 mt-0.5 text-emerald-500"/>}
                {a.msg}
              </div>
            ))}
          </div>

          {/* ── KPI strip ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { label:'SPI',       val: p.spi != null ? p.spi.toFixed(2) : '—',
                color: p.spi == null ? 'slate' : p.spi >= 0.95 ? 'emerald' : p.spi >= 0.85 ? 'amber' : 'rose' },
              { label:'CPI',       val:'0.96',  color:'emerald' },
              { label:'Tiến độ',   val:`${p.progress||0}%`, color: p.progress >= 70 ? 'emerald' : p.progress >= 30 ? 'blue' : 'slate' },
              { label:'NCR tồn',   val: String(p.ncr||0),   color: p.ncr > 3 ? 'rose' : p.ncr > 0 ? 'amber' : 'emerald' },
              { label:'Vi phạm HSE', val: String(p.hse||0), color: p.hse > 1 ? 'rose' : p.hse > 0 ? 'amber' : 'emerald' },
              { label:'NTP chờ',   val: String(p.ntp_pending||0), color: p.ntp_pending > 2 ? 'amber' : 'slate' },
            ].map(k => (
              <div key={k.label} className={`bg-white border rounded-2xl p-3 text-center border-slate-200`}>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1">{k.label}</p>
                <p className={`text-xl font-bold ${
                  k.color === 'emerald' ? 'text-emerald-600' : k.color === 'amber' ? 'text-amber-600' :
                  k.color === 'rose'    ? 'text-rose-600'    : k.color === 'blue'  ? 'text-blue-600'  : 'text-slate-600'
                }`}>{k.val}</p>
              </div>
            ))}
          </div>

          {/* ── GEM Briefing ─────────────────────────────────────────────── */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={15} className="text-emerald-600"/>
              <span className="text-sm font-bold text-emerald-800">GEM Briefing — {p.name}</span>
              <span className="text-[10px] text-emerald-500 ml-auto">Tự động phân tích</span>
            </div>
            <p className="text-sm text-emerald-800 leading-relaxed">
              Dạ, dự án <strong>{p.name}</strong> đang ở {p.progress||0}% tiến độ tổng thể.
              {p.spi != null && p.spi < 0.95 && ` SPI ${p.spi.toFixed(2)} cho thấy tiến độ đang chậm hơn kế hoạch — cần tăng cường nhân lực hạng mục trọng điểm.`}
              {p.ncr > 0 && ` Còn ${p.ncr} NCR chưa đóng, Anh/Chị cần ưu tiên xử lý trong tuần này.`}
              {p.spi != null && p.spi >= 0.95 && p.ncr === 0 && ' Các chỉ số đang ổn định, tiếp tục duy trì nhịp độ thi công hiện tại nghen!'}
            </p>
            <button onClick={() => setActiveTab('progress')}
              className="mt-3 text-xs font-semibold text-emerald-700 hover:underline flex items-center gap-1">
              Xem chi tiết tiến độ <ChevronRight size={11}/>
            </button>
          </div>

          {/* ── Mini Gantt + Mini Cashflow ────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Mini Gantt 30 ngày */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-slate-800">Tiến độ 30 ngày tới</p>
                <button onClick={() => setActiveTab('progress')}
                  className="text-[10px] text-emerald-600 hover:underline font-semibold">Xem Gantt đầy đủ →</button>
              </div>
              <div className="space-y-2.5">
                {ganttItems.map(item => (
                  <div key={item.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 font-medium truncate max-w-[60%]">{item.name}</span>
                      <span className="text-slate-400">{item.done}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${item.color}`} style={{ width:`${item.done}%` }}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mini Cashflow */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-slate-800">Dòng tiền 6 tháng</p>
                <button onClick={() => setActiveTab('resources')}
                  className="text-[10px] text-emerald-600 hover:underline font-semibold">Xem chi tiết →</button>
              </div>
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={mockCashFlowData} barSize={10} margin={{ top:2,right:2,bottom:0,left:-30 }}>
                  <XAxis dataKey="month" tick={{ fontSize:9, fill:'#94a3b8' }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize:9, fill:'#94a3b8' }} axisLine={false} tickLine={false}/>
                  <Bar dataKey="thu" fill="#10b981" radius={[3,3,0,0]} name="Thu"/>
                  <Bar dataKey="chi" fill="#f59e0b" radius={[3,3,0,0]} name="Chi"/>
                  <Tooltip
                    formatter={(v:any, n:any) => [`${v} Tr`, n === 'thu' ? 'Thu' : 'Chi']}
                    contentStyle={{ fontSize:11, borderRadius:8, border:'1px solid #e2e8f0' }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Việc hôm nay + Hoạt động gần đây ─────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Việc cần làm hôm nay */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Calendar size={14} className="text-emerald-500"/> Việc cần làm hôm nay
              </p>
              <div className="space-y-2">
                {todos.map((t, i) => (
                  <div key={i} className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-sm ${
                    t.type === 'urgent' ? 'bg-rose-50 border border-rose-100' :
                    t.type === 'warn'   ? 'bg-amber-50 border border-amber-100' :
                    'bg-slate-50 border border-slate-100'
                  }`}>
                    <span className={`mt-0.5 shrink-0 ${
                      t.type === 'urgent' ? 'text-rose-500' :
                      t.type === 'warn'   ? 'text-amber-500' : 'text-emerald-500'
                    }`}>
                      {t.type === 'urgent' ? <AlertTriangle size={13}/> :
                       t.type === 'warn'   ? <AlertCircle size={13}/> : <CheckCircle2 size={13}/>}
                    </span>
                    <span className="text-slate-700 leading-snug">{t.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Hoạt động gần đây */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Activity size={14} className="text-blue-500"/> Hoạt động gần đây
              </p>
              <div className="space-y-2.5">
                {activities.map((a, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 mt-0.5 ${tagColor[a.tag]}`}>
                      {a.tag.toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-700 leading-snug">{a.text}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{a.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Quick nav to other tabs ───────────────────────────────────── */}
          <div className="flex flex-wrap gap-2">
            {[
              { id:'progress', label:'→ Tiến độ & Gantt',    color:'blue'   },
              { id:'manpower', label:'→ Nhân lực',            color:'violet' },
              { id:'qa-qc',    label:'→ QA/QC & NCR',        color:'emerald'},
              { id:'qs',       label:'→ QS & Thanh toán',    color:'indigo' },
              { id:'records',  label:'→ Hồ sơ tài liệu',    color:'amber'  },
            ].map(nav => (
              <button key={nav.id} onClick={() => setActiveTab(nav.id)}
                className={`text-xs font-semibold px-3 py-2 rounded-xl border transition-colors ${
                  nav.color === 'blue'    ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' :
                  nav.color === 'violet'  ? 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100' :
                  nav.color === 'emerald' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' :
                  nav.color === 'indigo'  ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100' :
                                            'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                }`}>
                {nav.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (activeTab === 'contracts') {
      if (!perm.canViewContracts) return <AccessDenied label="Hợp đồng" />;
      return (
        <ContractDashboard
          project={selectedProject}
          currentRole={currentRole}
          canSeeFullValues={canSeeFullValues}
          maskSensitive={maskSensitive}
          contractUnlocked={contractUnlocked}
          SESSION_KEY={SESSION_KEY}
          writeAuditLog={writeAuditLog}
          onManualLock={() => {
            localStorage.removeItem(SESSION_KEY);
            setContractUnlocked(false);
            writeAuditLog('LOCK_MANUAL', 'Khoá phiên hợp đồng thủ công');
            setActiveTab('overview');
          }}
          onNavigate={(tabId) => setActiveTab(tabId as any)}
        />
      );
    }

    if (activeTab === 'progress') {
      return <ProgressDashboard project={selectedProject} />;
    }

    if (activeTab === 'resources') {
      return (
        <MaterialsDashboard
          project={selectedProject}
          currentRole={currentRole}
          onAlert={(alerts) => {
            alerts.forEach(a => {
              onPushNotification?.({
                id: a.id,
                type: a.level === 'urgent' ? 'urgent' : 'warning',
                title: a.title,
                message: a.msg || a.title,
                timestamp: new Date(),
                read: false,
                targetTab: 'tasks',
                targetSubTab: 'resources',
                targetProjectId: selectedProject?.id,
              });
            });
          }}
        />
      );
    }

    if (activeTab === 'manpower') {
      if (!perm.atLeast('manager')) return <AccessDenied label="Nhân lực" />;
      return (
        <ManpowerDashboard
          project={selectedProject}
          initialTab={initialManpowerTab}
        />
      );
    }

    if (activeTab === 'hr') {
      return (
        <HRWorkspace
          project={selectedProject}
          projectId={localProjectId || selectedProjectId || ''}
        />
      );
    }

    if (activeTab === 'hse') {
      // HSE accessible to all roles (viewer level = all authenticated users)
      return (
        <HSEWorkspace
          project={selectedProject}
        />
      );
    }

    if (activeTab === 'equipment') {
      const eqAccess = (() => {
        const legMap: Record<string,string> = {
          giam_doc:'giam_doc', ke_toan:'ke_toan_site', chi_huy_truong:'chi_huy_truong',
          giam_sat:'ks_giam_sat', pm:'pm', chi_huy_pho:'chi_huy_pho',
          thu_kho:'thu_kho', qs_site:'qs_site',
        };
        const role = legMap[currentRole] || 'ks_giam_sat';
        const lvl  = { giam_doc:5, pm:4, chi_huy_truong:3, chi_huy_pho:3, ke_toan_site:2, ks_giam_sat:2, qs_site:2, thu_kho:1 } as any;
        const domains = { giam_doc:['cross'], pm:['cross'], chi_huy_truong:['site','cross'], chi_huy_pho:['site','cross'], ks_giam_sat:['site'], ke_toan_site:['finance'], thu_kho:['warehouse'], qs_site:['qs'] } as any;
        const d = domains[role] || [];
        return (d.includes('site') || d.includes('cross')) ? 'full' : 'readonly';
      })();
      return <EquipmentDashboard project={selectedProject} readOnly={eqAccess === 'readonly'} />;
    }

    if (activeTab === 'records') {
      if (!perm.atLeast('manager')) return <AccessDenied label="Hồ sơ" />;
      return (
        <RecordsDashboard
          project={selectedProject}
          isConnectedOneDrive={isConnectedOneDrive}
          isConnectedGoogleDrive={isConnectedGoogleDrive}
        />
      );
    }

    if (activeTab === 'giam-sat') {
      return <GiamSatDashboard project={selectedProject} />;
    }

    if (activeTab === 'reports') {
      if (!perm.atLeast('manager')) return <AccessDenied label="Báo cáo" />;
      return (
        <ReportsDashboard
          project={selectedProject}
          generateWeeklyReport={generateWeeklyReport}
          isGeneratingReport={isGeneratingReport}
          generatedReport={generatedReport}
          isConnectedOneDrive={isConnectedOneDrive}
          isConnectedGoogleDrive={isConnectedGoogleDrive}
        />
      );
    }

    if (activeTab === 'cloud') {
      if (!perm.atLeast('manager')) return <AccessDenied label="Cloud Storage" />;
      return <StorageDashboard project={selectedProject} />;
    }

    if (activeTab === 'qa-qc') {
      return (
        <QaQcDashboard
          project={selectedProject}
          setShowRecordForm={setShowRecordForm}
          setRecordType={setRecordType}
          showRecordForm={showRecordForm}
          recordType={recordType}
          recordData={recordData}
          setRecordData={setRecordData}
          isGeneratingRecord={isGeneratingRecord}
          generateGemRecord={generateGemRecord}
        />
      );
    }

    if (activeTab === 'office') {
      if (!perm.atLeast('manager')) return <AccessDenied label="Văn phòng" />;
      return <OfficeDashboard project={selectedProject} />;
    }

    if (activeTab === 'notifs') {
      if (!perm.atLeast('manager')) return <AccessDenied label="Thông báo" />;
      return <NotificationEngine project={selectedProject} />;
    }

    if (activeTab === 'approval-queue') {
      const member      = getCurrentMember(localProjectId, authRoleId || undefined);
      const approvalCtx = buildCtxFromMember(member);
      return (
        <div className="flex flex-col h-full">
          {/* Sub-tab bar */}
          <div className="flex items-center gap-1 px-4 pt-3 pb-0 bg-white border-b border-slate-100 shrink-0">
            {[
              { id: 'queue',      label: 'Hàng duyệt',  icon: '📋' },
              { id: 'delegation', label: 'Ủy quyền',    icon: '🔑' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setShowDelegation(t.id === 'delegation')}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
                  (t.id === 'delegation') === showDelegation
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {showDelegation ? (
              <DelegationManager
                projectId={localProjectId}
                projectName={selectedProject?.name || 'Dự án'}
                ctx={approvalCtx}
              />
            ) : (
              <ApprovalQueue
                projectId={localProjectId}
                projectName={selectedProject?.name || 'Dự án'}
                ctx={approvalCtx}
              />
            )}
          </div>
        </div>
      );
    }

    if (activeTab === 'accounting') {
      if (!perm.canViewAccounting) return <AccessDenied label="Kế toán" />;
      return <AccountingDashboard project={selectedProject} projectId={localProjectId || ''} />;
    }

    if (activeTab === 'boq') {
      return (
        <BOQDashboard project={selectedProject} maskSensitive={maskSensitive} />
      );
    }

    if (activeTab === 'procurement') {
      return (
        <ProcurementDashboard project={selectedProject} />
      );
    }

    if (activeTab === 'qs') {
      if (!perm.canViewQS) return <AccessDenied label="QS & Thanh toán" />;
      return <QSDashboard projectId={localProjectId || ''} projectName={selectedProject?.name || 'Dự án'} contractValue={selectedProject?.contractValue} currentRole={currentRole} />;
    }

    if (activeTab === 'gem-ai') {
      if (!perm.atLeast('manager')) return <AccessDenied label="GEM Phân tích AI" />;
      return (
        <div className="py-2">
          <GemAIDashboard projectName={selectedProject?.name || 'Dự án'} projectId={localProjectId || undefined} />
        </div>
      );
    }

    if (activeTab === 'settings') {
      if (uLevel < 3) return <AccessDenied label="Cài đặt dự án" />;
      return (
        <div className="py-2">
          <ProjectConfigPanel
            projectId={localProjectId || 'default'}
            projectName={selectedProject?.name || 'Dự án'}
          />
        </div>
      );
    }

    if (activeTab === 'risk') {
      return (
        <RiskDashboard
          project={selectedProject}
          projectId={localProjectId || ''}
        />
      );
    }

    return null;
  };

  // ── Project List View (when no project selected) ─────────────────────────
  if (!localProjectId) {
    const filterLabel: Record<string, string> = {
      all: 'Tất cả', in_progress: 'Đang chạy', potential: 'Tiềm năng', completed: 'Hoàn thành'
    };
    // Project scope — dùng allowedProjectIds từ AuthProvider (source of truth)
    // allowedProjectIds=null → L4+ thấy tất cả; array → L1-L3 chỉ thấy DA được gán
    const allProjects: any[] = allowedProjectIds === null
      ? (projects as any[])
      : (projects as any[]).filter((p: any) => allowedProjectIds!.includes(p.id));
    // scopeCtx — dùng authRoleId từ useAuth() (source of truth), KHÔNG đọc localStorage
    const _scopeRoleId = (authRoleId || 'chi_huy_truong') as RoleId;
    const scopeCtx: UserContext = {
      userId: user?.id || `user_${_scopeRoleId}`,
      roleId: _scopeRoleId,
      allowedProjectIds: allowedProjectIds ?? undefined,
    };

    const inProgressProjects = allProjects.filter(p => p.type === 'in_progress');
    const potentialProjects   = allProjects.filter(p => p.type === 'potential');
    const completedProjects   = allProjects.filter(p => p.type === 'completed');

    const filteredProjects = allProjects
      .filter(p => {
        const matchType = listFilter === 'all' || p.type === listFilter;
        const q = listSearch.toLowerCase();
        const matchQ = !q || p.name.toLowerCase().includes(q) || (p.address||'').toLowerCase().includes(q);
        return matchType && matchQ;
      })
      .sort((a, b) => {
        let va = 0, vb = 0;
        if (listSort === 'progress') { va = a.progress||0; vb = b.progress||0; }
        if (listSort === 'spi')      { va = a.spi||0;      vb = b.spi||0; }
        if (listSort === 'budget')   { va = parseFloat((a.budget||'0').replace(/[^\d.]/g,'')); vb = parseFloat((b.budget||'0').replace(/[^\d.]/g,'')); }
        if (listSort === 'name')     return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
        return sortAsc ? va - vb : vb - va;
      });

    const totalBudget = inProgressProjects.reduce((s, p) => s + parseFloat((p.budget||'0').replace(/[^\d.]/g,'')), 0);
    const avgSpi      = inProgressProjects.filter(p => p.spi).reduce((s,p,_,a) => s + p.spi/a.length, 0);
    const totalNcr    = inProgressProjects.reduce((s,p) => s + (p.ncr||0), 0);
    const totalHse    = inProgressProjects.reduce((s,p) => s + (p.hse||0), 0);
    const alertCount  = inProgressProjects.filter(p => p.spi < 0.85 || p.ncr > 3 || p.hse > 0).length;

    function progressBarColor(pct: number) {
      if (pct >= 80) return 'bg-emerald-500';
      if (pct >= 40) return 'bg-blue-500';
      return 'bg-amber-500';
    }
    function statusDot(project: any) {
      if (project.spi < 0.85 || project.hse > 1 || project.ncr > 3)
        return <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-pulse"/>;
      if (project.spi < 0.95 || project.ncr > 0)
        return <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"/>;
      return <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"/>;
    }

    const ProjectCard = ({ project }: { project: any; key?: React.Key }) => {
      const [showMenu, setShowMenu] = React.useState(false);
      const isActive = project.type === 'in_progress';
      return (
        <div onClick={() => { setSelectedProjectId(project.id); setLocalProjectId(project.id); setActiveTab('overview'); }}
          className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-md hover:border-emerald-200 transition-all cursor-pointer group relative">
          <div className={`h-1 w-full ${project.type === 'in_progress' ? progressBarColor(project.progress||0) : project.type === 'potential' ? 'bg-amber-400' : 'bg-slate-300'}`}/>
          <div className="p-4">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                {statusDot(project)}
                <h4 className="font-bold text-slate-800 group-hover:text-emerald-700 transition-colors leading-tight truncate text-sm">{project.name}</h4>
              </div>
              <div className="relative shrink-0">
                <button onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100">
                  <MoreVertical size={14}/>
                </button>
                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={e => { e.stopPropagation(); setShowMenu(false); }}/>
                    <div className="absolute right-0 top-8 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-20 animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 border-b border-slate-100">Chuyển danh mục</div>
                      {project.type !== 'potential'   && <button onClick={e => { e.stopPropagation(); changeProjectType(project.id,'potential');  setShowMenu(false); }} className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-700 flex items-center gap-2"><Target size={13} className="text-amber-500"/> Tiềm năng</button>}
                      {project.type !== 'in_progress' && <button onClick={e => { e.stopPropagation(); changeProjectType(project.id,'in_progress'); setShowMenu(false); }} className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"><CircleDashed size={13} className="text-blue-500"/> Đang thực hiện</button>}
                      {project.type !== 'completed'   && <button onClick={e => { e.stopPropagation(); changeProjectType(project.id,'completed');   setShowMenu(false); }} className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2"><CheckCircle size={13} className="text-emerald-500"/> Hoàn thành</button>}
                      <div className="border-t border-slate-100 mt-1 pt-1">
                        <button onClick={e => { e.stopPropagation(); handleDeleteProject(project.id); setShowMenu(false); }} className="w-full text-left px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-2"><Trash2 size={13}/> Xoá dự án</button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 mb-3 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">{project.budget}</span>
              {project.startDate && <span>· {project.startDate}</span>}
              {project.endDate   && <span>→ {project.endDate}</span>}
            </div>
            {isActive && (
              <div className="mb-3">
                <div className="flex justify-between text-[10px] font-semibold mb-1">
                  <span className="text-slate-500">Tiến độ</span>
                  <span className={progressBarColor(project.progress||0).replace('bg-','text-')}>{project.progress||0}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${progressBarColor(project.progress||0)}`} style={{ width: `${project.progress||0}%` }}/>
                </div>
              </div>
            )}
            {isActive && (
              <div className="flex flex-wrap gap-1.5">
                {project.spi != null && (
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border ${project.spi >= 0.95 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : project.spi >= 0.85 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                    SPI {project.spi.toFixed(2)}{project.spi < 0.85 && <AlertTriangle size={9}/>}
                  </span>
                )}
                {project.ncr > 0 && <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border bg-rose-50 text-rose-700 border-rose-200">NCR {project.ncr}</span>}
                {project.hse > 0 && <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border bg-orange-50 text-orange-700 border-orange-200">HSE {project.hse}</span>}
                {project.ntp_pending > 0 && <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border bg-violet-50 text-violet-700 border-violet-200">NTP {project.ntp_pending} chờ</span>}
                {project.spi >= 0.95 && project.ncr === 0 && project.hse === 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border bg-emerald-50 text-emerald-700 border-emerald-200"><CheckCircle2 size={9}/> Đúng tiến độ</span>
                )}
              </div>
            )}
            {project.type === 'potential' && <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-1"><Target size={11} className="text-amber-500"/><span>Dự kiến khởi công: {project.startDate || 'Chưa xác định'}</span></div>}
            {project.type === 'completed' && <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-semibold mt-1"><CheckCircle2 size={11}/> Hoàn thành · {project.endDate}</div>}
          </div>
          <div className="px-4 pb-3">
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>Cập nhật: {project.update}</span>
              <span className="text-emerald-600 font-semibold group-hover:underline flex items-center gap-0.5">Mở dashboard <ChevronRight size={10}/></span>
            </div>
          </div>
        </div>
      );
    };

    // Scope info for banner
    const scopeLevel = (AUTHORITY_LEVEL as Record<string,number>)[scopeCtx.roleId] || 1;
    const scopeType  = scopeLevel >= 4 ? 'all'
      : scopeLevel === 3 ? 'assigned'
      : 'single';

    return (
      <>{/* list-view-root */}
      <div className="space-y-6">

        {/* ── Scope restriction banner (L3 trở xuống) ── */}
        {scopeType !== 'all' && (
          <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-xs ${
            scopeType === 'single'
              ? 'bg-blue-50 border-blue-200 text-blue-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
              scopeType === 'single' ? 'bg-blue-100' : 'bg-amber-100'
            }`}>
              {scopeType === 'single' ? '🔒' : '🏗️'}
            </div>
            <div className="flex-1">
              <p className="font-bold">
                {scopeType === 'single'
                  ? 'Bạn chỉ có quyền truy cập công trình được phân công'
                  : 'Bạn có thể xem các công trình bạn được phân công'}
              </p>
              <p className="opacity-70 mt-0.5">
                {scopeType === 'single'
                  ? `Vai trò ${(ROLES as any)[scopeCtx.roleId]?.label || scopeCtx.roleId} (Level ${scopeLevel}) — liên hệ PM hoặc Giám đốc để được cấp quyền công trình khác.`
                  : `Vai trò ${(ROLES as any)[scopeCtx.roleId]?.label || scopeCtx.roleId} (Level ${scopeLevel}) — hiển thị ${allProjects.length} / ${projects.length} công trình.`}
              </p>
            </div>
            <span className={`text-xs font-black px-2 py-1 rounded-lg ${
              scopeType === 'single' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
            }`}>
              L{scopeLevel}
            </span>
          </div>
        )}

        {/* Portfolio KPI */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Đang thi công',  value: inProgressProjects.length, unit: 'dự án', color: 'emerald', icon: <Building2 size={16}/> },
            { label: 'Tổng ngân sách', value: `${totalBudget} Tỷ`,       unit: '',       color: 'blue',    icon: <TrendingUp size={16}/> },
            { label: 'SPI trung bình', value: avgSpi.toFixed(2),          unit: '',       color: avgSpi >= 0.95 ? 'emerald' : avgSpi >= 0.85 ? 'amber' : 'rose', icon: <Activity size={16}/> },
            { label: 'Cảnh báo',       value: alertCount,                 unit: 'dự án', color: alertCount > 0 ? 'rose' : 'slate', icon: <AlertTriangle size={16}/> },
          ].map(k => (
            <div key={k.label} className={`bg-white border rounded-2xl p-4 flex items-center gap-3 ${k.color === 'rose' && alertCount > 0 ? 'border-rose-200 bg-rose-50/50' : 'border-slate-200'}`}>
              <div className={`p-2 rounded-xl ${k.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' : k.color === 'blue' ? 'bg-blue-50 text-blue-600' : k.color === 'amber' ? 'bg-amber-50 text-amber-600' : k.color === 'rose' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>{k.icon}</div>
              <div>
                <p className="text-xs text-slate-500 leading-none mb-1">{k.label}</p>
                <p className="text-lg font-bold text-slate-800 leading-none">{k.value} <span className="text-xs font-normal text-slate-400">{k.unit}</span></p>
              </div>
            </div>
          ))}
        </div>

        {/* Scope restriction banner — hiển thị khi L1-L3 bị giới hạn */}
        {scopeCtx && getRoleProjectScope(scopeCtx.roleId as any) !== 'all' && (
          <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-xs font-semibold ${
            getRoleProjectScope(scopeCtx.roleId as any) === 'single'
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            <span className="shrink-0">
              {getRoleProjectScope(scopeCtx.roleId as any) === 'single' ? '🔒' : '📋'}
            </span>
            <span>
              {getRoleProjectScope(scopeCtx.roleId as any) === 'single'
                ? `Vai trò "${scopeCtx.roleId}" chỉ được xem dự án được gán (1 công trình). Hiển thị ${allProjects.length} / ${projects.length} dự án.`
                : `Vai trò "${scopeCtx.roleId}" chỉ thấy dự án được gán. Hiển thị ${allProjects.length} / ${projects.length} dự án.`
              }
            </span>
          </div>
        )}

        {/* Search + Filter + Sort + Add */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[160px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input value={listSearch} onChange={e => setListSearch(e.target.value)} placeholder="Tìm dự án..."
              className="w-full pl-8 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white transition-all"/>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {(['all','in_progress','potential','completed'] as const).map(f => (
              <button key={f} onClick={() => setListFilter(f)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${listFilter === f ? f === 'all' ? 'bg-slate-800 text-white' : f === 'in_progress' ? 'bg-blue-600 text-white' : f === 'potential' ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {filterLabel[f]} <span className="ml-1 opacity-70 text-[10px]">{f === 'all' ? allProjects.length : f === 'in_progress' ? inProgressProjects.length : f === 'potential' ? potentialProjects.length : completedProjects.length}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <select value={listSort} onChange={e => setListSort(e.target.value as any)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-slate-700">
              <option value="progress">Sắp xếp: Tiến độ</option>
              <option value="spi">Sắp xếp: SPI</option>
              <option value="budget">Sắp xếp: Ngân sách</option>
              <option value="name">Sắp xếp: Tên</option>
            </select>
            <button onClick={() => setSortAsc(v => !v)} className="p-2 bg-slate-100 rounded-xl text-slate-600 hover:bg-slate-200 transition-colors text-xs font-bold">{sortAsc ? '↑' : '↓'}</button>
          </div>
          <button onClick={() => onRequestNewProject ? onRequestNewProject() : setShowSetupWizard(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm shrink-0">
            <Plus size={13}/> Dự án mới
          </button>
        </div>

        {/* Project grid */}
        {filteredProjects.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <Building2 size={40} className="text-slate-200 mx-auto mb-3"/>
            <p className="text-slate-500 font-medium">Không tìm thấy dự án nào</p>
          </div>
        ) : (
          <>
            {filteredProjects.filter(p => p.type === 'in_progress').length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CircleDashed size={15} className="text-blue-500"/>
                  <h3 className="text-sm font-bold text-slate-700">Đang thực hiện</h3>
                  <span className="text-xs text-slate-400">({filteredProjects.filter(p => p.type === 'in_progress').length})</span>
                  {totalNcr > 0 && <span className="text-[10px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">{totalNcr} NCR tổng</span>}
                  {totalHse > 0 && <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">{totalHse} vi phạm HSE</span>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                  {filteredProjects.filter(p => p.type === 'in_progress').map(p => <ProjectCard key={p.id} project={p} />)}
                </div>
              </div>
            )}
            {filteredProjects.filter(p => p.type === 'potential').length > 0 && (
              <div className="bg-slate-50/60 border border-slate-200 rounded-2xl overflow-hidden">
                <button onClick={() => setPotentialOpen(v => !v)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-2"><Target size={15} className="text-amber-500"/><span className="text-sm font-bold text-slate-700">Tiềm năng</span><span className="text-xs text-slate-400">({filteredProjects.filter(p => p.type === 'potential').length})</span></div>
                  <ChevronDown size={15} className={`text-slate-400 transition-transform ${potentialOpen ? 'rotate-180' : ''}`}/>
                </button>
                {potentialOpen && <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">{filteredProjects.filter(p => p.type === 'potential').map(p => <ProjectCard key={p.id} project={p}/>)}</div>}
              </div>
            )}
            {filteredProjects.filter(p => p.type === 'completed').length > 0 && (
              <div className="bg-slate-50/60 border border-slate-200 rounded-2xl overflow-hidden">
                <button onClick={() => setCompletedOpen(v => !v)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-2"><CheckCircle size={15} className="text-emerald-500"/><span className="text-sm font-bold text-slate-700">Đã hoàn thành</span><span className="text-xs text-slate-400">({filteredProjects.filter(p => p.type === 'completed').length})</span></div>
                  <ChevronDown size={15} className={`text-slate-400 transition-transform ${completedOpen ? 'rotate-180' : ''}`}/>
                </button>
                {completedOpen && <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">{filteredProjects.filter(p => p.type === 'completed').map(p => <ProjectCard key={p.id} project={p}/>)}</div>}
              </div>
            )}
          </>
        )}
      </div>

      {/* Wizard portal — thoát khỏi overflow-y-auto của <main> */}
      {showSetupWizard && ReactDOM.createPortal(
        <ProjectSetupWizard
          onCancel={() => setShowSetupWizard(false)}
          onConfirm={(newProject: NewProjectData) => {
            setProjects((prev: any[]) => [...prev, newProject]);
            setSelectedProjectId(newProject.id);
            setLocalProjectId(newProject.id);
            setActiveTab('overview');
            setShowSetupWizard(false);
            setTimeout(() => autoAssignMemberOnSeed(newProject.id), 100);
          }}
        />,
        document.body
      )}
      </>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-3 md:p-4 animate-in fade-in duration-200">

      {/* ── PIN Dialog Overlay ──────────────────────────────────────────── */}
      {showPinDialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowPinDialog(false); }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 animate-in zoom-in-95 duration-200">
            {/* Icon */}
            <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Lock size={28} className="text-white"/>
            </div>
            <h2 className="text-xl font-bold text-slate-800 text-center mb-1">Khu vực bảo mật</h2>
            <p className="text-sm text-slate-500 text-center mb-6 leading-relaxed">
              Tab Hợp đồng chứa thông tin tài chính và pháp lý nhạy cảm.<br/>
              Nhập mã PIN để tiếp tục.
            </p>

            {/* PIN dots display */}
            <div className="flex justify-center gap-3 mb-5">
              {[0,1,2,3].map(i => (
                <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                  pinInput.length > i
                    ? 'bg-slate-800 border-slate-800 scale-110'
                    : 'bg-transparent border-slate-300'
                }`}/>
              ))}
            </div>

            {/* Numpad */}
            {Date.now() < pinLockUntil ? (
              <div className="text-center py-4 text-rose-600 font-semibold text-sm">
                🔒 Khoá 5 phút do nhập sai nhiều lần
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((k, i) => (
                  <button key={i}
                    disabled={!k && k !== 0}
                    onClick={() => {
                      if (k === '⌫') { setPinInput(p => p.slice(0,-1)); setPinError(''); }
                      else if (k !== '' && pinInput.length < 4) {
                        const next = pinInput + String(k);
                        setPinInput(next);
                        setPinError('');
                        if (next.length === 4) {
                          // Auto-submit after 4 digits
                          setTimeout(() => {
                            const now = Date.now();
                            if (next === CONTRACT_PIN) {
                              localStorage.setItem(SESSION_KEY, JSON.stringify({ ts: now, role: currentRole }));
                              setContractUnlocked(true);
                              setPinInput(''); setPinError(''); setPinAttempts(0);
                              setShowPinDialog(false);
                              writeAuditLog('UNLOCK', 'Mở khoá tab Hợp đồng thành công');
                            } else {
                              const na = pinAttempts + 1;
                              setPinAttempts(na);
                              setPinInput('');
                              if (na >= 3) {
                                setPinLockUntil(now + 5*60*1000);
                                setPinError('Sai 3 lần — khoá 5 phút');
                                writeAuditLog('LOCK','Nhập PIN sai 3 lần — bị khoá');
                              } else {
                                setPinError(`Sai PIN. Còn ${3-na} lần thử.`);
                              }
                            }
                          }, 150);
                        }
                      }
                    }}
                    className={`h-14 rounded-2xl text-lg font-semibold transition-all active:scale-95 ${
                      k === '' ? 'pointer-events-none' :
                      k === '⌫' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' :
                      'bg-slate-50 text-slate-800 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300'
                    }`}>
                    {k}
                  </button>
                ))}
              </div>
            )}

            {pinError && (
              <p className="text-xs text-rose-600 text-center font-semibold mb-3">{pinError}</p>
            )}

            <p className="text-[10px] text-slate-400 text-center">
              Phiên làm việc: 15 phút · Quên PIN liên hệ quản trị hệ thống
            </p>

            <button onClick={() => setShowPinDialog(false)}
              className="mt-4 w-full py-2.5 text-sm text-slate-500 hover:text-slate-700 transition-colors font-medium">
              Huỷ bỏ
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-2 md:mb-3">
        {/* Top bar: back + mini app nav */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => { setSelectedProjectId(null); setLocalProjectId(null); onBackToList?.(); }}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-emerald-600 transition-colors"
          >
            <ArrowLeft size={13} /> Danh sách
          </button>

        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 md:gap-3">
            <h2 className="text-lg md:text-xl lg:text-2xl font-bold text-slate-800 truncate max-w-[160px] sm:max-w-[240px] md:max-w-none">{selectedProject?.name}</h2>
            <span className={`px-2 py-0.5 md:px-2.5 md:py-1 rounded-full text-[10px] md:text-xs font-medium whitespace-nowrap ${
              selectedProject?.type === 'potential' ? 'bg-orange-100 text-orange-700' :
              selectedProject?.type === 'in_progress' ? 'bg-emerald-100 text-emerald-700' :
              'bg-emerald-100 text-emerald-700'
            }`}>
              {selectedProject?.status}
            </span>
            {/* Template badge */}
            {localProjectId && (() => {
              const tplId = getProjectTemplate(localProjectId);
              const tpl   = tplId ? PROJECT_TEMPLATES[tplId] : null;
              return tpl ? (
                <span className="hidden md:flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                  {tpl.icon} {tpl.shortName}
                </span>
              ) : null;
            })()}
          </div>
          {/* Project menu — safe delete via ⋯ */}
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSetupWizard(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm">
              <Plus size={14}/> Dự án mới
            </button>
            <div className="relative">
              <button onClick={() => setShowDetailMenu(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600
                  hover:bg-slate-100 rounded-xl transition-colors border border-slate-200">
              <MoreVertical size={15}/> Tuỳ chọn
            </button>
            {showDetailMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowDetailMenu(false)}/>
                    <div className="absolute right-0 top-10 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-20 animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 border-b border-slate-100">Chuyển trạng thái</div>
                      {selectedProject?.type !== 'potential'   && <button onClick={() => { changeProjectType(selectedProject!.id,'potential');  setShowDetailMenu(false); }} className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-700 flex items-center gap-2"><Target size={13} className="text-amber-500"/> Tiềm năng</button>}
                      {selectedProject?.type !== 'in_progress' && <button onClick={() => { changeProjectType(selectedProject!.id,'in_progress'); setShowDetailMenu(false); }} className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"><CircleDashed size={13} className="text-blue-500"/> Đang thực hiện</button>}
                      {selectedProject?.type !== 'completed'   && <button onClick={() => { changeProjectType(selectedProject!.id,'completed');   setShowDetailMenu(false); }} className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2"><CheckCircle size={13} className="text-emerald-500"/> Hoàn thành</button>}
                      <div className="border-t border-slate-100 mt-1 pt-1">
                        <button onClick={() => { selectedProject && handleDeleteProject(selectedProject.id); setShowDetailMenu(false); }}
                          className="w-full text-left px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-2">
                          <Trash2 size={13}/> Xoá dự án
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        {selectedProject?.address && (
          <div className="flex items-center gap-1.5 text-[10px] md:text-sm text-slate-500 mb-2">
            <span className="font-medium shrink-0">Địa chỉ:</span>
            <a 
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedProject.address)}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-emerald-600 hover:text-emerald-800 hover:underline truncate"
            >
              {selectedProject.address}
            </a>
          </div>
        )}
        <p className="text-[10px] md:text-sm text-slate-500">Quản lý tiến độ, vật tư, nhân lực và dòng tiền dự án.</p>
      </div>

      {/* ── Dev Login Switcher — chỉ hiện khi VITE_USE_SUPABASE=false ── */}
      {(import.meta as any).env?.VITE_USE_SUPABASE !== 'true' && (() => {
        const DEV_USERS = [
          { roleId:'giam_doc',       name:'Trần Văn Bình',      email:'gdda@villaphat.vn',       lvl:5, color:'#7c3aed' },
          { roleId:'pm',             name:'Nguyễn Thành Nam',   email:'pm@villaphat.vn',         lvl:4, color:'#1a8a7a' },
          { roleId:'ke_toan_truong', name:'Nguyễn Thu Hà',      email:'ketoan@villaphat.vn',     lvl:4, color:'#0891b2' },
          { roleId:'truong_qs',      name:'Lê Minh Tuấn',       email:'truongqs@villaphat.vn',   lvl:3, color:'#0284c7' },
          { roleId:'truong_qaqc',    name:'Phạm Thị Thảo',      email:'truongqaqc@villaphat.vn', lvl:3, color:'#059669' },
          { roleId:'truong_hse',     name:'Lê Văn Hải',         email:'trunghse@villaphat.vn',   lvl:3, color:'#dc2626' },
          { roleId:'chi_huy_truong', name:'Nguyễn Văn Anh',     email:'cht@villaphat.vn',        lvl:3, color:'#b45309' },
          { roleId:'chi_huy_pho',    name:'Trần Hữu Lộc',       email:'chp@villaphat.vn',        lvl:3, color:'#b45309' },
          { roleId:'ks_giam_sat',    name:'Hoàng Việt Hùng',    email:'gsat@villaphat.vn',       lvl:2, color:'#7c3aed' },
          { roleId:'qs_site',        name:'Phạm Quang Minh',    email:'qs01@villaphat.vn',       lvl:2, color:'#0284c7' },
          { roleId:'qaqc_site',      name:'Trần Thị Bích',      email:'qaqc01@villaphat.vn',     lvl:2, color:'#059669' },
          { roleId:'hse_site',       name:'Ngô Thanh Sơn',      email:'hse01@villaphat.vn',      lvl:2, color:'#dc2626' },
          { roleId:'ke_toan_site',   name:'Lê Thị Mai',         email:'ktsite@villaphat.vn',     lvl:2, color:'#0891b2' },
          { roleId:'ke_toan_kho',    name:'Đinh Văn Khoa',      email:'ktkho@villaphat.vn',      lvl:2, color:'#0891b2' },
          { roleId:'thu_kho',        name:'Trần Quốc Tuấn',     email:'thukho@villaphat.vn',     lvl:1, color:'#c47a5a' },
          { roleId:'thu_ky_site',    name:'Nguyễn Phương Linh', email:'thuky@villaphat.vn',      lvl:1, color:'#64748b' },
          { roleId:'operator',       name:'Lê Văn Toàn',        email:'op01@villaphat.vn',       lvl:1, color:'#64748b' },
          { roleId:'to_doi',         name:'Phạm Văn Đức',       email:'todoi@villaphat.vn',      lvl:1, color:'#ea580c' },
        ];
        const activeUser = DEV_USERS.find(u => u.roleId === currentRole) || DEV_USERS[0];
        const [showDevPicker, setShowDevPicker] = React.useState(false);
        const lvlColor: Record<number,string> = { 5:'bg-violet-600', 4:'bg-teal-600', 3:'bg-amber-600', 2:'bg-blue-500', 1:'bg-slate-500' };
        return (
          <div className="mb-3 print:hidden">
            <div className="flex items-center gap-2">
              {/* Current user badge */}
              <button
                onClick={() => setShowDevPicker(v => !v)}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-medium transition-colors"
              >
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${lvlColor[activeUser.lvl]} text-white`}>L{activeUser.lvl}</span>
                <span>{activeUser.name}</span>
                <span className="text-slate-400 text-[10px]">— {(ROLES as any)[activeUser.roleId]?.label || activeUser.roleId}</span>
                <ChevronDown size={12} className={`text-slate-400 transition-transform ${showDevPicker ? 'rotate-180' : ''}`}/>
              </button>
              <span className="text-[10px] text-slate-400 bg-amber-50 border border-amber-200 text-amber-700 px-2 py-1 rounded-lg font-medium">DEV MODE</span>
              {(['giam_doc','pm'].includes(currentRole)) && (
                <button onClick={() => setShowThresholdPanel(v => !v)}
                  className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors">
                  ⚙ Ngưỡng
                </button>
              )}
              {contractUnlocked && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1.5 rounded-lg">
                  <Unlock size={9}/> HĐ mở
                </span>
              )}
            </div>
            {/* User picker dropdown */}
            {showDevPicker && (
              <div className="mt-2 bg-slate-900 rounded-2xl p-3 shadow-2xl border border-slate-700">
                <p className="text-[10px] text-slate-400 font-medium mb-2 uppercase tracking-wide">Đăng nhập thử với role</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {DEV_USERS.map(u => (
                    <button key={u.roleId}
                      onClick={() => {
                        // Set role chính
                        setCurrentRole(u.roleId as UserRole);
                        localStorage.setItem('gem_user_role', u.roleId);
                        localStorage.setItem('gem_user_role', u.roleId);
                        localStorage.removeItem(SESSION_KEY);
                        setContractUnlocked(false);
                        setShowDevPicker(false);
                        setActiveTab('overview');
                        // Cập nhật member.roles trong DA để union logic đúng
                        if (localProjectId) {
                          const members = loadMembers(localProjectId);
                          const matchIdx = members.findIndex(m => m.activeRoleId === u.roleId || m.roles.includes(u.roleId));
                          if (matchIdx >= 0) {
                            members[matchIdx] = { ...members[matchIdx], activeRoleId: u.roleId };
                            saveMembers(localProjectId, members);
                            localStorage.setItem(`gem_current_member_${localProjectId}`, JSON.stringify(members[matchIdx]));
                          }
                        }
                      }}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-colors ${
                        u.roleId === currentRole
                          ? 'bg-white/15 ring-1 ring-white/30'
                          : 'hover:bg-white/10'
                      }`}
                    >
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${lvlColor[u.lvl]} text-white`}>L{u.lvl}</span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-white truncate">{u.name}</p>
                        <p className="text-[9px] text-slate-400 truncate">{(ROLES as any)[u.roleId]?.label || u.roleId}</p>
                      </div>
                      {u.roleId === currentRole && <span className="ml-auto text-emerald-400 text-[10px] shrink-0">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Threshold Config Panel (L4+) ── */}
      {showThresholdPanel && ['giam_doc','pm'].includes(currentRole) && (
        <div className="mb-4 bg-white border border-emerald-200 rounded-2xl p-4 shadow-sm print:hidden">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-slate-700">⚙️ Cấu hình ngưỡng phê duyệt</p>
            <button onClick={() => setShowThresholdPanel(false)} className="text-slate-400 hover:text-slate-600">
              <X size={14}/>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {([
              { key:'L3_max',          label:'CH Phó duyệt tối đa',   hint:'Trên mức này cần PM' },
              { key:'L4_max',          label:'PM duyệt tối đa',       hint:'Trên mức này cần GĐ' },
              { key:'warehouse_exit',  label:'Ngưỡng phiếu xuất kho', hint:'Phiếu PN/PX' },
              { key:'payment',         label:'Ngưỡng thanh toán',     hint:'YCTT & CT kế toán' },
            ] as {key:string;label:string;hint:string}[]).map(({ key, label, hint }) => (
              <div key={key} className="bg-slate-50 rounded-xl p-3">
                <p className="text-[10px] font-bold text-slate-500 mb-1">{label}</p>
                <p className="text-[9px] text-slate-400 mb-2">{hint}</p>
                <div className="flex items-center gap-1">
                  <input
                    type="number" step="5000000" min="5000000"
                    value={(thresholds as any)[key]}
                    onChange={e => saveThresholds({ ...thresholds, [key]: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  />
                  <span className="text-[9px] text-slate-400 shrink-0">đ</span>
                </div>
                <p className="text-[9px] text-emerald-600 font-semibold mt-1">
                  = {((thresholds as any)[key]/1_000_000).toFixed(0)} triệu
                </p>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-slate-400 mt-3 text-center">
            Cấu hình này áp dụng cho dự án hiện tại · Chỉ PM và Giám đốc mới thay đổi được
          </p>
        </div>
      )}

      {/* ── Responsive Hybrid Layout: Desktop = Master-Detail, Mobile = FAB ── */}
      <div className="md:flex md:gap-2 md:items-start">

        {/* Mobile overlay backdrop */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-30 md:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* Sidebar — Desktop: 240px sticky | Mobile: slide-in drawer */}
        <div className={[
          'print:hidden shrink-0',
          // Desktop
          'md:w-[200px] md:sticky md:top-2 md:block md:max-h-[calc(100vh-16px)] md:overflow-y-auto md:overscroll-contain',
          // Mobile: hidden by default, shown as fixed drawer when open
          mobileSidebarOpen
            ? 'fixed inset-y-0 left-0 w-[min(280px,85vw)] bg-white z-40 shadow-2xl overflow-y-auto p-4 md:relative md:inset-auto md:shadow-none md:p-0'
            : 'hidden md:block',
        ].join(' ')}>

      {/* ── Progressive Disclosure Sidebar Nav ── */}
      {(() => {
        // Map legacy role → new permission context
        // Map đầy đủ 24 roles — không fallback mặc định
        const legacyToNew: Record<string, string> = {
          // Legacy strings
          giam_doc: 'giam_doc',    pm: 'pm',
          ke_toan: 'ke_toan_site', ke_toan_truong: 'ke_toan_truong',
          giam_sat: 'ks_giam_sat', chi_huy_truong: 'chi_huy_truong',
          chi_huy_pho: 'chi_huy_pho',
          // Legacy admin → giam_doc (superuser)
          admin: 'giam_doc',
          // Legacy thu_ky_ho → thu_ky_site
          thu_ky_ho: 'thu_ky_site',
          // New role IDs — pass-through
          truong_qs: 'truong_qs', truong_qaqc: 'truong_qaqc',
          truong_hse: 'truong_hse', hr_truong: 'hr_truong',
          qs_site: 'qs_site', qaqc_site: 'qaqc_site',
          ks_giam_sat: 'ks_giam_sat', hse_site: 'hse_site',
          ke_toan_site: 'ke_toan_site', ke_toan_kho: 'ke_toan_kho',
          hr_site: 'hr_site', thu_kho: 'thu_kho',
          thu_ky_site: 'thu_ky_site', operator: 'operator',
          ntp_site: 'ntp_site', to_doi: 'to_doi',
          ky_thuat_vien: 'ky_thuat_vien',
        };
        // Fallback về operator (L1 site) thay vì ks_giam_sat (L2)
        // ─── Domain map v2 — đầy đủ 24 roles (khai báo trước union logic) ──────
        const domainMap: Record<string, string[]> = {
          giam_doc:        ['cross', 'admin'],
          pm:              ['cross', 'finance', 'qs', 'site'],
          ke_toan_truong:  ['finance', 'cross'],
          truong_qs:       ['qs', 'cross'],
          truong_qaqc:     ['qaqc', 'cross'],
          truong_hse:      ['hse', 'cross'],
          hr_truong:       ['hr', 'cross'],
          chi_huy_truong:  ['site', 'cross'],
          chi_huy_pho:     ['site', 'cross'],
          qs_site:         ['qs'],
          qaqc_site:       ['qaqc'],
          ks_giam_sat:     ['site', 'qaqc'],
          hse_site:        ['hse'],
          ke_toan_site:    ['finance'],
          ke_toan_kho:     ['finance', 'warehouse'],
          hr_site:         ['hr', 'site'],
          thu_kho:         ['warehouse'],
          thu_ky_site:     ['admin'],
          operator:        ['site'],
          ntp_site:        ['site'],
          to_doi:          ['site'],
          ky_thuat_vien:   ['site', 'qaqc'],
        };
        const levelMap: Record<string, number> = {
          giam_doc:5, pm:4, ke_toan_truong:4,
          truong_qs:3, truong_qaqc:3, truong_hse:3, hr_truong:3,
          chi_huy_truong:3, chi_huy_pho:3,
          qs_site:2, qaqc_site:2, ks_giam_sat:2, hse_site:2,
          ke_toan_site:2, ke_toan_kho:2, hr_site:2,
          thu_kho:1, thu_ky_site:1, operator:1,
          ntp_site:1, to_doi:1, ky_thuat_vien:1,
        };

        // ── Union roles: user được làm gì = union của TẤT CẢ roles trong DA ──
        // Không phải "đóng vai" — 1 user có thể kiêm nhiều roles
        const _member = localProjectId ? getCurrentMember(localProjectId, authRoleId || undefined) : null;
        const activeRoleId = (legacyToNew[currentRole] || 'operator') as RoleId;
        const permCtx = _member ? buildCtxFromMember(_member) : { userId: `user_${currentRole}`, roleId: activeRoleId };

        // Tính union domains và max level từ tất cả roles của member
        const allMemberRoles: string[] = _member?.roles?.length
          ? _member.roles
          : [activeRoleId]; // fallback: chỉ role hiện tại

        // Union domains — user thấy tab của TẤT CẢ roles mình có
        const uDomainsSet = new Set<string>();
        let uLevel = 1;
        allMemberRoles.forEach(r => {
          const lvl = levelMap[r] ?? 1;
          if (lvl > uLevel) uLevel = lvl;
          (domainMap[r] ?? []).forEach(d => uDomainsSet.add(d));
        });
        const uDomains = Array.from(uDomainsSet);
        const roleId = activeRoleId; // activeRoleId dùng cho workflow context (ai ký/duyệt)

        // Tab definitions with group info
        type TabDef = {
          id: string; label: string; icon: React.ReactNode;
          group: 'core' | 'thi-cong' | 'nhan-su' | 'tai-chinh' | 'hanh-chinh';
          badge?: number;
        };

        const pendingCount = getPendingCount(localProjectId, permCtx);

        const allTabs: TabDef[] = [
          // CORE — Tổng quan trước, Phê duyệt lên thứ 2 (hay dùng nhất), rồi Thông báo, GEM AI
          { id:'overview',       label:'Tổng quan',        icon:<LayoutDashboard size={14}/>, group:'core' },
          { id:'approval-queue', label:'Phê duyệt',        icon:<CheckCircle2 size={14}/>,    group:'core', badge: pendingCount },
          { id:'notifs',         label:'Thông báo',        icon:<Bell size={14}/>,            group:'core' },
          { id:'gem-ai',         label:'GEM AI',           icon:<Sparkles size={14}/>,        group:'core' },
          // THI CÔNG — theo luồng: Tiến độ → Vật tư (đầu vào) → Thiết bị → Giám sát → QA/QC (đầu ra)
          { id:'progress',   label:'Tiến độ',          icon:<Clock size={14}/>,           group:'thi-cong' },
          { id:'resources',  label:'Vật tư & Kho',     icon:<Package size={14}/>,         group:'thi-cong' },
          { id:'equipment',  label:'Thiết bị',         icon:<Truck size={14}/>,           group:'thi-cong' },
          { id:'giam-sat',   label:'KS Giám sát',      icon:<Eye size={14}/>,             group:'thi-cong' },
          { id:'qa-qc',      label:'QA/QC',            icon:<ShieldCheck size={14}/>,     group:'thi-cong' },
          // NHÂN SỰ & AN TOÀN — Nhân lực → HSE (gắn liền) → Nhân sự HR (back-office)
          { id:'manpower',   label:'Nhân lực',         icon:<Users size={14}/>,           group:'nhan-su' },
          { id:'hse',        label:'An toàn HSE',      icon:<ShieldCheck size={14}/>,     group:'nhan-su' },
          { id:'hr',         label:'Nhân sự & HR',     icon:<Briefcase size={14}/>,       group:'nhan-su' },
          // TÀI CHÍNH — theo luồng: BOQ → Hợp đồng → Mua sắm → QS → Kế toán
          { id:'boq',        label:'BOQ & Dự toán',    icon:<FileSpreadsheet size={14}/>,  group:'tai-chinh' },
          { id:'contracts',  label:'Hợp đồng',         icon:<Lock size={14}/>,            group:'tai-chinh' },
          { id:'procurement', label:'Mua sắm',         icon:<ShoppingCart size={14}/>,    group:'tai-chinh' },
          { id:'qs',         label:'QS & Thanh toán',  icon:<Calculator size={14}/>,      group:'tai-chinh' },
          { id:'accounting', label:'Kế toán',          icon:<Calculator size={14}/>,      group:'tai-chinh' },
          // HÀNH CHÍNH — Rủi ro (toàn dự án) → Văn phòng → Hồ sơ → Báo cáo → Cloud → Cài đặt (cuối)
          { id:'risk',       label:'Rủi ro',           icon:<AlertTriangle size={14}/>,   group:'hanh-chinh' },
          { id:'office',     label:'Văn phòng',        icon:<Building2 size={14}/>,       group:'hanh-chinh' },
          { id:'records',    label:'Hồ sơ',            icon:<Files size={14}/>,           group:'hanh-chinh' },
          { id:'reports',    label:'Báo cáo',          icon:<ClipboardList size={14}/>,   group:'hanh-chinh' },
          { id:'cloud',      label:'Cloud Storage',    icon:<Cloud size={14}/>,           group:'hanh-chinh' },
          { id:'settings',   label:'Cài đặt dự án',    icon:<Settings size={14}/>,        group:'hanh-chinh' },
        ];

        // Permission check per tab
        const tabAccessMap: Record<string, 'full'|'readonly'|'hidden'> = {};

        const isCross  = uDomains.includes('cross');
        const isFinance = uDomains.includes('finance');
        const isQS      = uDomains.includes('qs');
        const isQAQC    = uDomains.includes('qaqc');
        const isHSE     = uDomains.includes('hse');
        const isSite    = uDomains.includes('site');
        const isWH      = uDomains.includes('warehouse');
        const isHR      = uDomains.includes('hr');

        // ─── getAccess v2 ─────────────────────────────────────────────────────
        // 'full'     = tạo/sửa/xóa
        // 'readonly' = xem — có thể bị mask trường nhạy cảm (xử lý trong component)
        // 'hidden'   = ẩn tab hoàn toàn
        const getAccess = (tabId: string): 'full'|'readonly'|'hidden' => {

          // CORE — luôn mở
          if (tabId === 'overview' || tabId === 'notifs') return 'full';

          // GEM AI — mở tất cả roles (core value, hỗ trợ nhập liệu từ L1)
          if (tabId === 'gem-ai') return 'full';

          // Phê duyệt
          if (tabId === 'approval-queue') return uLevel >= 2 ? 'full' : 'hidden';

          // Cài đặt dự án
          if (tabId === 'settings') return uLevel >= 3 ? 'full' : 'hidden';

          // Cloud storage
          if (tabId === 'cloud') return uLevel >= 3 ? 'full' : 'hidden';

          // ── THI CÔNG ─────────────────────────────────────────────────────────
          if (tabId === 'progress') {
            if (isCross || isSite) return 'full';
            return uLevel >= 2 ? 'readonly' : 'hidden'; // L2 mọi domain đều xem được
          }
          if (tabId === 'equipment') {
            if (isCross || isSite) return 'full';
            if (isWH) return 'readonly';                // thủ kho xem thiết bị
            return uLevel >= 2 ? 'readonly' : 'hidden';
          }
          if (tabId === 'resources') {
            if (isWH) return 'full';                    // thủ kho: full
            if (isCross || isSite || uLevel >= 3) return 'full';
            return 'readonly';                          // L2 khác: lập đề xuất vật tư
          }
          if (tabId === 'giam-sat') {
            if (isSite || isQAQC) return 'full';
            if (isQS && uLevel >= 2) return 'readonly'; // qs_site xem giám sát
            if (uLevel >= 3) return 'readonly';
            return 'hidden';
          }
          if (tabId === 'qa-qc') {
            if (isQAQC || isSite) return 'full';
            if (isQS && uLevel >= 2) return 'readonly'; // qs_site xem QA/QC
            if (uLevel >= 3) return 'readonly';
            return 'hidden';
          }

          // ── NHÂN SỰ ──────────────────────────────────────────────────────────
          if (tabId === 'manpower') {
            if (isCross || isSite) return 'full';
            if (isHSE || isQAQC) return 'readonly';     // xem để kiểm tra chứng chỉ
            return uLevel >= 3 ? 'full' : 'hidden';
          }
          if (tabId === 'hse') {
            if (isHSE || isSite || isCross) return 'full';
            return uLevel >= 2 ? 'readonly' : 'hidden';
          }
          if (tabId === 'hr') {
            if (isHR || isCross) return 'full';
            if (isHSE && uLevel >= 3) return 'readonly'; // Trưởng HSE xem chứng chỉ
            return uLevel >= 4 ? 'full' : 'hidden';
          }

          // ── TÀI CHÍNH ────────────────────────────────────────────────────────
          if (tabId === 'boq') {
            if (isQS || isCross) return 'full';
            // L2: xem nhưng mask đơn giá (component tự xử lý dựa theo uLevel)
            if (isQAQC || isSite || uLevel >= 2) return 'readonly';
            return 'hidden';
          }
          if (tabId === 'contracts') {
            if (isCross || uLevel >= 4) return 'full';
            if (isSite && uLevel >= 3) return 'full';   // CHT ký hợp đồng NTP
            // L2-L3 domain liên quan: xem nhưng mask giá trị
            if (isQS || isSite || isQAQC) return 'readonly';
            return 'hidden';
          }
          if (tabId === 'procurement') {
            if (isCross || isSite || isQS || isFinance) return uLevel >= 3 ? 'full' : 'readonly';
            if (uLevel >= 2) return 'readonly';
            return 'hidden';
          }
          if (tabId === 'qs') {
            if (isQS) return 'full';
            if (isCross || uLevel >= 3) return 'readonly';
            return 'hidden';
          }
          if (tabId === 'accounting') {
            if (isFinance) return 'full';
            if (isCross || uLevel >= 4) return 'full';
            if (isSite && uLevel >= 3) return 'readonly'; // CHT xem dòng tiền công trường
            if (isQS && uLevel >= 2) return 'readonly';   // QS site xem đối chiếu
            return 'hidden';
          }

          // ── HÀNH CHÍNH ───────────────────────────────────────────────────────
          if (tabId === 'risk') return uLevel >= 3 ? 'full' : 'hidden';
          if (tabId === 'office') {
            if (uDomains.includes('admin') || isCross) return 'full';
            return uLevel >= 3 ? 'full' : 'hidden';
          }
          if (tabId === 'records') return uLevel >= 2 ? 'full' : 'hidden';

          // Báo cáo — L2 xem trong domain, L3+ xem tất cả
          if (tabId === 'reports') {
            if (uLevel >= 3) return 'full';
            if (uLevel >= 2) return 'readonly'; // filter theo domain trong component
            return 'hidden';
          }

          return 'full';
        };

        allTabs.forEach(t => { tabAccessMap[t.id] = getAccess(t.id); });

        // Apply project-level overrides — chỉ nâng quyền, không hạ
        const levelRank = { hidden: 0, readonly: 1, full: 2 } as const;
        Object.entries(permOverrides).forEach(([tabId, overrideLevel]) => {
          const current = tabAccessMap[tabId] || 'hidden';
          if (levelRank[overrideLevel] > levelRank[current]) {
            tabAccessMap[tabId] = overrideLevel;
          }
        });

        // Groups config
        type GroupDef = { id: string; label: string; icon: React.ReactNode; color: string; };
        const groups: GroupDef[] = [
          { id:'thi-cong',  label:'Thi công',           icon:<HardHat size={12}/>,    color:'blue'   },
          { id:'nhan-su',   label:'Nhân sự & An toàn',  icon:<Users size={12}/>,      color:'violet' },
          { id:'tai-chinh', label:'Tài chính & Hợp đồng',icon:<Calculator size={12}/>,color:'emerald'},
          { id:'hanh-chinh',label:'Hành chính',         icon:<Files size={12}/>,      color:'slate'  },
        ];

        const groupColor: Record<string, string> = {
          blue:'text-blue-600 bg-blue-50 border-blue-200',
          violet:'text-violet-600 bg-violet-50 border-violet-200',
          emerald:'text-emerald-600 bg-emerald-50 border-emerald-200',
          slate:'text-slate-600 bg-slate-50 border-slate-200',
        };

        // Smart shortcuts per role
        const shortcuts: { label: string; tabId: string; color: string; count?: number }[] = [];
        if (uLevel >= 3) shortcuts.push({
          label: '⚡ Hàng chờ duyệt',
          tabId: 'approval-queue',
          color: 'rose',
          count: pendingCount,
        });
        if (uDomains.includes('finance')) shortcuts.push({ label:'📋 Chứng từ chờ ghi sổ', tabId:'accounting', color:'blue' });
        if (uDomains.includes('warehouse') && !uDomains.includes('cross')) shortcuts.push({
          label: '📦 Phiếu xuất chờ duyệt',
          tabId: 'approval-queue',
          color: 'amber',
          count: pendingCount,
        });
        if (uDomains.includes('qaqc') || uDomains.includes('site')) shortcuts.push({ label:'🔍 NCR đang mở', tabId:'qa-qc', color:'emerald' });

        // openGroups state is at component level (Rules of Hooks)
        // Smart defaults are applied when role changes via useEffect

        const coreTabs  = allTabs.filter(t => t.group === 'core' && tabAccessMap[t.id] !== 'hidden');

        const TabButton = ({ tab, compact = false }: { tab: TabDef; compact?: boolean; key?: React.Key }) => {
          const access = tabAccessMap[tab.id];
          if (access === 'hidden') return null;
          const isActive = activeTab === tab.id;
          const isReadOnly = access === 'readonly';
          const isContract = tab.id === 'contracts';

          const handleClick = () => {
            if (isContract) {
              try {
                const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
                const valid = s && Date.now() - s.ts < SESSION_TTL;
                if (valid) { setContractUnlocked(true); setActiveTab('contracts'); writeAuditLog('VIEW','Xem tab Hợp đồng'); }
                else { setContractUnlocked(false); setShowPinDialog(true); }
              } catch { setShowPinDialog(true); }
            } else {
              setActiveTab(tab.id);
            }
          };

          return (
            <button
              key={tab.id}
              onClick={handleClick}
              title={isReadOnly ? 'Chỉ xem — không chỉnh sửa được' : ''}
              className={`group w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                isActive
                  ? isContract
                    ? 'bg-slate-800 text-white border-slate-700 shadow-sm'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm'
                  : 'text-slate-600 border-transparent hover:bg-slate-50 hover:border-slate-200 hover:text-slate-800'
              }`}>
              <span className={isActive && !isContract ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-600'}>
                {tab.icon}
              </span>
              <span className="flex-1 text-left truncate">{tab.label}</span>
              {tab.badge != null && tab.badge > 0 && (
                <span className="ml-auto bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {tab.badge}
                </span>
              )}
              {isReadOnly && !isActive && (
                <Eye size={10} className="ml-auto text-slate-300 shrink-0"/>
              )}
              {isContract && !isActive && (
                <span className={`w-1.5 h-1.5 rounded-full ml-auto shrink-0 ${contractUnlocked ? 'bg-emerald-500' : 'bg-slate-400'}`}/>
              )}
            </button>
          );
        };

        return (
          <div className="print:hidden">{/* sidebar inner */}
            {/* ── CORE TABS ── */}
            <div className="flex flex-wrap gap-1.5 mb-3 border-b border-slate-100 pb-3">
              {coreTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    activeTab === tab.id
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm'
                      : 'text-slate-600 border-transparent hover:bg-slate-50 hover:border-slate-200'
                  }`}>
                  <span className={activeTab === tab.id ? 'text-emerald-600' : 'text-slate-400'}>
                    {tab.icon}
                  </span>
                  {tab.label}
                  {tab.badge != null && tab.badge > 0 && (
                    <span className="bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── SMART SHORTCUTS ── */}
            {shortcuts.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {shortcuts.map(sc => (
                  <button
                    key={sc.label}
                    onClick={() => setActiveTab(sc.tabId)}
                    className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                      sc.color === 'rose'    ? 'text-rose-600 bg-rose-50 border-rose-200 hover:bg-rose-100' :
                      sc.color === 'blue'   ? 'text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100' :
                      sc.color === 'amber'  ? 'text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100' :
                                              'text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                    }`}>
                    <span className="flex items-center gap-1.5">
                      {sc.label}
                      {(sc as any).count > 0 && (
                        <span className="bg-rose-500 text-white text-[9px] font-black px-1 py-0.5 rounded-full min-w-[14px] text-center leading-none">
                          {(sc as any).count}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* ── COLLAPSIBLE GROUPS ── */}
            <div className="space-y-1">
              {groups.map(grp => {
                const grpTabs = allTabs.filter(t => t.group === grp.id && tabAccessMap[t.id] !== 'hidden');
                if (grpTabs.length === 0) return null;
                const isOpen = openGroups[grp.id] ?? false;
                const hasActive = grpTabs.some(t => t.id === activeTab);
                const clr = groupColor[grp.color] || groupColor.slate;

                return (
                  <div key={grp.id} className={`rounded-xl border overflow-hidden transition-all ${hasActive ? 'border-emerald-200' : 'border-slate-150'}`}>
                    <button
                      onClick={() => setOpenGroups(prev => ({ ...prev, [grp.id]: !prev[grp.id] }))}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] font-semibold transition-all ${
                        hasActive
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                      }`}>
                      <span className={`p-1 rounded-md border ${clr}`}>{grp.icon}</span>
                      <span className="flex-1 text-left">{grp.label}</span>
                      <span className="text-[9px] text-slate-400 mr-1">{grpTabs.length}</span>
                      {isOpen
                        ? <ChevronUp size={12} className="text-slate-400"/>
                        : <ChevronDown size={12} className="text-slate-400"/>
                      }
                    </button>
                    {isOpen && (
                      <div className="px-2 pb-2 pt-1 bg-white space-y-0.5">
                        {grpTabs.map(tab => <TabButton key={tab.id} tab={tab}/>)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

        </div>{/* end sidebar */}

        {/* Main content area */}
        <div className="flex-1 min-w-0">
          {/* Mobile FAB nav button */}
          <div className="md:hidden mb-4 print:hidden">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 shadow-sm hover:shadow-md transition-all w-full"
            >
              <LayoutDashboard size={16} className="text-emerald-600"/>
              <span className="flex-1 text-left text-slate-600">
                {(() => {
                  const tabLabels: Record<string, string> = {
                    overview:'Tổng quan', progress:'Tiến độ', resources:'Vật tư',
                    hse:'An toàn HSE', contracts:'Hợp đồng', boq:'BOQ', qs:'QS',
                    manpower:'Nhân lực', hr:'Nhân sự', equipment:'Thiết bị',
                    'qa-qc':'QA/QC', accounting:'Kế toán', 'giam-sat':'Giám sát',
                    records:'Hồ sơ', reports:'Báo cáo', office:'Văn phòng',
                    risk:'Rủi ro', procurement:'Mua sắm',
                  };
                  return tabLabels[activeTab] || activeTab;
                })()}
              </span>
              <ChevronDown size={14} className="text-slate-400"/>
            </button>
          </div>

          {/* Main Tab Content */}
          <div className="min-h-[400px]">
            {renderContent()}
          </div>
        </div>{/* end main content */}

      </div>{/* end responsive flex wrapper */}

      {showTutorial && (
        <OnboardingTutorial 
          onClose={() => setShowTutorial(false)} 
          onComplete={(projectName, storagePath, projectType) => {
            if (selectedProjectId) {
              setProjects(prev => prev.map(p => 
                p.id === selectedProjectId 
                  ? { ...p, name: projectName, storagePath, type: projectType } 
                  : p
              ));
              notifOk(`Đã tạo thành công thư mục dự án "${projectName}" tại đường dẫn: ${storagePath}`);
            }
          }}
        />
      )}

      {/* Wizard portal — render thẳng vào document.body, thoát khỏi mọi overflow/stacking context */}
      {showSetupWizard && ReactDOM.createPortal(
        <ProjectSetupWizard
          onCancel={() => setShowSetupWizard(false)}
          onConfirm={(newProject: NewProjectData) => {
            setProjects((prev: any[]) => [...prev, newProject]);
            setSelectedProjectId(newProject.id);
            setLocalProjectId(newProject.id);
            setActiveTab('overview');
            setShowSetupWizard(false);
            setTimeout(() => autoAssignMemberOnSeed(newProject.id), 100);
          }}
        />,
        document.body
      )}

    </div>
  );
}

