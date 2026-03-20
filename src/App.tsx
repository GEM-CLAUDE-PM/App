import { genAI, GEM_MODEL } from "./components/gemini";
import React, { useState, useRef, useEffect } from "react";
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  Menu,
  X,
  Users,
  Sparkles,
  Bell,
  AlertTriangle,
  ShieldAlert,
  Clock,
  ClipboardCheck,
  FileText,
  Printer,
  CheckCircle,
  Plus,
  ShieldCheck,
  UploadCloud,
  ClipboardList,
  Loader2,
  Shield,
  Activity,
} from "lucide-react";
import ChatAssistant from "./components/ChatAssistant";
import ProjectDashboard from "./components/ProjectDashboard";
import Contacts from "./components/Contacts";
import CalendarSchedule from "./components/CalendarSchedule";
import Dashboard from "./components/Dashboard";
import QaQcDashboard from "./components/QaQcDashboard";
import { AuthProvider, UserMenu, useAuth } from "./components/AuthProvider";
import { NotificationProvider, useNotification } from "./components/NotificationEngine";
import AdminPanel from "./components/AdminPanel";
import InternalAdminDashboard from "./components/InternalAdminDashboard";
import SubconPortal from "./components/SubconPortal";
import ClientPortal from "./components/ClientPortal";
import BillingPage from "./components/BillingPage";
import OnboardingFlow from "./components/OnboardingFlow";
import { saveProjectConfig, loadProjectConfig } from "./components/ProjectConfigPanel";
import SplashScreen from "./components/SplashScreen";
import { PWAManager } from "./components/PWABanner";
import TrialBanner from "./components/TrialBanner";
import { usePushNotification } from "./components/usePushNotification";
import { useOfflineQueue, OfflineQueuePanel } from "./components/useOfflineQueue";
// Note: QaQcDashboard giờ được dùng bên trong ProjectDashboard — import giữ lại để tránh lỗi nếu có chỗ khác tham chiếu
import { Taskbar, UserMenuBar } from "./components/dashboard/Taskbar";
import { useTaskbar } from "./hooks/useTaskbar";
import WorkspaceActionBar from "./components/WorkspaceActionBar";
// FIX: Sửa lại import thư viện chuẩn
import Markdown from "react-markdown";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: "urgent" | "warning" | "info";
  targetTab: string;
  targetSubTab?: string;
  targetManpowerTab?: string;
  targetProjectId?: string;
  timestamp: Date;
  read: boolean;
}

function safeLS(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function AppInner() {
  const { ok: notifOk, err: notifErr, warn: notifWarn, info: notifInfo } = useNotification();
  const { user } = useAuth();

  // ── Portal routing — NTP users get SubconPortal, CĐT get ClientPortal ───
  if (user?.job_role === 'ntp') return <SubconPortal />;
  if (user?.job_role === 'chu_dau_tu') return <ClientPortal />;

  const isAdmin = user?.tier === "admin" || user?.job_role === "giam_doc";
  // S19: Push notification subscription
  const { subscribed: pushSubscribed, subscribe: subscribePush } = usePushNotification(user?.id);

  // S24: Optimistic lock conflict toast
  useEffect(() => {
    const handler = (e: Event) => {
      const { collection } = (e as CustomEvent).detail;
      notifWarn(`Dữ liệu "${collection}" đã được cập nhật từ thiết bị khác — đã tải lại phiên bản mới nhất.`);
    };
    window.addEventListener('gem:data-conflict', handler);
    return () => window.removeEventListener('gem:data-conflict', handler);
  }, []);
  useEffect(() => {
    // Auto-subscribe khi user đã login và chưa subscribe
    if (user?.id && !pushSubscribed && Notification.permission === "default") {
      // Delay 5s — không popup ngay khi vừa login
      const t = setTimeout(() => subscribePush(), 5000);
      return () => clearTimeout(t);
    }
  }, [user?.id, pushSubscribed]);
  // Superadmin: GEM&CLAUDE internal team (email domain hoặc localStorage flag)
  const isSuperAdmin = user?.email?.endsWith("@gemclaudepm.com") ||
    localStorage.getItem("gem_superadmin") === "1";
  const isFirstLogin = user && !localStorage.getItem(`gem_onboarded_${user.id}`);
  const [showOnboarding, setShowOnboarding] = React.useState(false);
  // Trigger onboarding sau khi auth load xong — tránh user=null lúc khởi tạo
  React.useEffect(() => {
    if (user && !localStorage.getItem(`gem_onboarded_${user.id}`)) {
      setShowOnboarding(true);
    }
  }, [user?.id]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    localStorage.getItem('gem_sidebar_collapsed') === 'true'
  );
  const toggleSidebar = () => setSidebarCollapsed(v => {
    localStorage.setItem('gem_sidebar_collapsed', String(!v));
    return !v;
  });
  const [activeTab, setActiveTab] = useState("dashboard");
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [showGemBubble, setShowGemBubble] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [projectDashboardState, setProjectDashboardState] = useState<{
    projectId?: string | null;
    tab?: string;
    manpowerTab?: string;
    subTab?: string;
    navKey?: number;
  }>({});

  const [projects, setProjects] = useState<any[]>([]);

  // Load projects từ Supabase — chờ user auth xong mới query
  useEffect(() => {
    // Không load nếu user chưa có (AuthProvider đang loading)
    if (!user?.id) return;
    const loadProjects = async () => {
      const { getSupabase } = await import('./components/supabase');
      const client = getSupabase();
      if (!client) return;
      const { data, error } = await client
        .from('projects')
        .select('id,name,type,status,progress,budget,address,start_date,end_date,template_id,spi,ncr,hse,ntp_pending')
        .order('created_at', { ascending: true });
      if (error) {
        console.warn('[App] loadProjects error:', error.message);
        return;
      }
      if (data && data.length > 0) {
        setProjects(data.map((p: any) => ({
          id:          p.id,
          name:        p.name,
          type:        p.type,
          status:      p.status,
          progress:    p.progress,
          budget:      p.budget,
          address:     p.address,
          startDate:   p.start_date,
          endDate:     p.end_date,
          templateId:  p.template_id,
          spi:         p.spi,
          ncr:         p.ncr,
          hse:         p.hse,
          ntp_pending: p.ntp_pending,
          update:      'Cập nhật từ DB',
        })));
      }
    };
    loadProjects();
  }, [user?.id]); // re-run khi user login/logout

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() => {
    // Restore last project on mount
    return localStorage.getItem("gem_last_project") || null;
  });
  const selectedProject = projects.find((p) => p.id === selectedProjectId) || null;

  // Taskbar States & Modals
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [recordType, setRecordType] = useState("Báo cáo ngày");
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [showHseForm, setShowHseForm] = useState(false);
  const [showWeeklyReportModal, setShowWeeklyReportModal] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<string | null>(null);
  const [recordData, setRecordData] = useState<any>(null);
  const [isGeneratingRecord, setIsGeneratingRecord] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = typeof window !== "undefined" ? window.innerWidth < 768 : false;
  const { taskbarRef, taskbarPosition, isTaskbarExpanded, setIsTaskbarExpanded, handleTaskbarMouseDown, handleTaskbarTouchStart } =
    useTaskbar(isMobile);

  // ── Offline Queue ──────────────────────────────────────────────────────────
  const { pendingCount, isSyncing, syncNow } = useOfflineQueue();
  const [showQueuePanel, setShowQueuePanel] = useState(false);

  // ── Current role — sync với ProjectDashboard qua localStorage ─────────────
  // appCurrentRole — từ AuthProvider, không đọc localStorage
  const { roleId: _authRoleId } = useAuth();
  const [appCurrentRole, setAppCurrentRole] = useState<string>(() =>
    _authRoleId || localStorage.getItem("gem_user_role") || "chi_huy_truong"
  );
  // Sync appCurrentRole khi authRoleId thay đổi (login/logout)
  useEffect(() => {
    if (_authRoleId) setAppCurrentRole(_authRoleId);
  }, [_authRoleId]);

  // Listen to storage changes (khi ProjectDashboard dev switcher thay role)
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === "gem_user_role" && e.newValue) setAppCurrentRole(e.newValue);
    };
    window.addEventListener("storage", handler);
    const poll = setInterval(() => {
      const r = localStorage.getItem("gem_user_role");
      if (r && r !== appCurrentRole) setAppCurrentRole(r);
    }, 2000);
    return () => {
      window.removeEventListener("storage", handler);
      clearInterval(poll);
    };
  }, [appCurrentRole]);

  // ── Global conflict handler ───────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const { collection } = (e as CustomEvent).detail ?? {};
      notifWarn(`Dữ liệu "${collection}" đã được cập nhật từ thiết bị khác. Vui lòng tải lại trang để lấy dữ liệu mới nhất.`);
    };
    window.addEventListener('gem:db-conflict', handler);
    return () => window.removeEventListener('gem:db-conflict', handler);
  }, [notifWarn]);

  // ── Auto-home: mở App → vào thẳng tab phù hợp với role ──────────────────
  const HOME_TAB_MAP: Record<string, string> = {
    giam_doc: "overview", // GĐ xem tổng quan portfolio
    pm: "overview", // PM xem tổng quan
    ke_toan: "accounting", // KT vào thẳng Kế toán
    chi_huy_truong: "progress", // CHT vào Tiến độ
    chi_huy_pho: "progress", // CHP vào Tiến độ
    giam_sat: "giam-sat", // KS GS vào tab Giám sát
    thu_kho: "resources", // Thủ kho vào Vật tư
    qs_site: "qs", // QS vào QS Dashboard
  };
  // Chạy 1 lần khi mount — navigate vào homeTab của role
  const hasAutoNavigated = useRef(false);
  useEffect(() => {
    if (hasAutoNavigated.current) return;
    hasAutoNavigated.current = true;
    const role = localStorage.getItem("gem_user_role") || "chi_huy_truong";
    const homeTab = HOME_TAB_MAP[role] || "overview";
    // Nếu đã có project được chọn → vào thẳng ProjectDashboard với homeTab
    const lastProject = localStorage.getItem("gem_last_project");
    if (lastProject) {
      navigateTo(lastProject, homeTab);
    }
    // Nếu không có project → ở lại dashboard (chọn project trước)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Khởi tạo AI (Fix: Sử dụng biến môi trường Vite và SDK chuẩn)
  const generateWeeklyReport = async () => {
    setIsGeneratingReport(true);
    setShowWeeklyReportModal(true);
    setGeneratedReport(null);
    try {
      // FIX: Cập nhật cú pháp gọi Gemini 1.5 Flash (nhanh và chính xác hơn)
      const model = genAI.getGenerativeModel({ model: GEM_MODEL });
      const proj = selectedProject || projects[0];
      const prompt = `Bạn là GEM, một trợ lý quản lý dự án xây dựng siêu việt. 
      Hãy tạo một "Báo cáo tổng kết dự án hàng tuần" chuyên nghiệp cho dự án "${proj.name}".
      Dữ liệu hiện tại của dự án:
      - Tiến độ: ${proj.progress}% (${proj.status})
      - Tài chính (Dòng tiền): (load từ db.ts collection cash_flow)
      - Tài nguyên (Vật tư): Quản lý nội bộ qua MaterialsDashboard (kho, chứng từ, kiểm soát).
      - Nhân lực (Lao động): (load từ db.ts collection manpower)
      - Thiết bị: Tổng số 24, đang hoạt động 18 (75% công suất), 4 đang bảo dưỡng, 2 rảnh rỗi.
      Yêu cầu báo cáo bao gồm các phần: Tổng quan, Tiến độ, Tài nguyên, Nhân lực, Thiết bị, Rủi rỏ & Đề xuất.`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      setGeneratedReport(responseText || "Không thể tạo báo cáo lúc này.");
    } catch (error) {
      console.error("Error generating report:", error);
      notifErr("Dạ có lỗi khi em đang tổng hợp báo cáo rồi anh ơi.");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // ── Navigation ─────────────────────────────────────────────────────────────
  // Tất cả state được set trong 1 object duy nhất → không race condition
  const navigateTo = (projectId: string | null, tab: string, manpowerTab?: string, subTab?: string) => {
    if (projectId) localStorage.setItem("gem_last_project", projectId);
    setProjectDashboardState({
      projectId,
      tab,
      manpowerTab,
      subTab,
      navKey: Date.now(),
    });
    setActiveTab("tasks");
    setIsMobileMenuOpen(false);
    window.scrollTo(0, 0);
  };

  const handleNavigate = (tabId: string, projectId?: string, subTab?: string) => {
    if (tabId === "tasks") {
      navigateTo(projectId ?? selectedProjectId, subTab || "overview");
    } else {
      setActiveTab(tabId);
      setIsMobileMenuOpen(false);
      window.scrollTo(0, 0);
    }
  };

  // ── WorkspaceActionBar navigate: ProjectDashboard tabs ──────────────────
  // tabId từ ActionBar maps trực tiếp vào ProjectDashboard sub-tabs
  const WORKSPACE_TAB_MAPPING: Record<string, string> = {
    resources: "resources",
    qs: "qs",
    accounting: "accounting",
    manpower: "manpower",
    "qa-qc": "qa-qc",
    contracts: "contracts",
    progress: "progress",
    "giam-sat": "giam-sat",
    "approval-queue": "approval-queue",
    overview: "overview",
  };
  const handleWorkspaceNavigate = (tabId: string, subTab?: string) => {
    const projectTab = WORKSPACE_TAB_MAPPING[tabId] || tabId;
    navigateTo(selectedProjectId, projectTab, undefined, subTab);
  };

  const handleNavigateProject = (subTab: string, projectId?: string) => {
    navigateTo(projectId ?? selectedProjectId, subTab);
  };

  const handleBackToList = () => {
    setSelectedProjectId(null);
    setProjectDashboardState({});
  };

  const generateGemRecord = async () => {
    setIsGeneratingRecord(true);
    try {
      const model = genAI.getGenerativeModel({ model: GEM_MODEL });
      const prompt = `Tạo nội dung cho "${recordType}" dự án ${(selectedProject || projects[0]).name}`;
      const result = await model.generateContent(prompt);
      setRecordData(result.response.text() || "Không thể tạo hồ sơ lúc này.");
    } catch (error) {
      console.error("Error generating record:", error);
      notifErr("Lỗi khi soạn hồ sơ.");
    } finally {
      setIsGeneratingRecord(false);
    }
  };

  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: "1",
      title: "Cảnh báo HSE khẩn cấp",
      message: "GEM phát hiện vi phạm an toàn tại Zone 2: Công nhân không đội mũ bảo hiểm.",
      type: "urgent",
      targetTab: "tasks",
      targetSubTab: "hse",
      targetProjectId: "p3",
      timestamp: new Date(),
      read: false,
    },
    {
      id: "2",
      title: "Cảnh báo Tiến độ",
      message: "Dự án Alpha có nguy cơ chậm tiến độ 3 ngày do thiếu hụt vật tư thép.",
      type: "warning",
      targetTab: "tasks",
      targetSubTab: "progress",
      targetProjectId: "p1",
      timestamp: new Date(Date.now() - 3600000 * 2),
      read: false,
    },
    {
      id: "3",
      title: "Bảo dưỡng thiết bị",
      message: "Máy lu rung Sakai (EQ004) sắp đến hạn bảo dưỡng định kỳ.",
      type: "info",
      targetTab: "tasks",
      targetSubTab: "equipment",
      targetProjectId: "p1",
      timestamp: new Date(Date.now() - 3600000 * 24),
      read: true,
    },
  ]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleNotificationClick = (notification: Notification) => {
    setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)));
    if (notification.targetTab === "tasks") {
      setProjectDashboardState({
        projectId: (notification as any).targetProjectId ?? selectedProjectId,
        tab: notification.targetSubTab || "overview",
        manpowerTab: notification.targetManpowerTab,
        navKey: Date.now(),
      });
    }
    setActiveTab(notification.targetTab);
    setShowNotifications(false);
  };

  const navItems = [
    { id: "dashboard", label: "Tổng quan", icon: LayoutDashboard },
    { id: "tasks", label: "Dự án & Công việc", icon: CheckSquare },
    { id: "calendar", label: "Lịch trình", icon: Calendar },
    { id: "contacts", label: "Đối tác liên hệ", icon: Users },
    ...(isAdmin ? [{ id: "admin", label: "Quản lý User", icon: Shield }] : []),
    ...(isSuperAdmin ? [{ id: "internal_admin", label: "Internal Admin", icon: Activity }] : []),
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {user && <TrialBanner user={user} onUpgrade={() => setActiveTab('billing')} />}
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900 print:bg-white">
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-slate-200 p-2 flex justify-between items-center sticky top-0 z-20 print:hidden">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0 bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center">
            <img src="/icon/icon_app_64.png" alt="GEM" className="w-7 h-7 object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>
          <div className="leading-tight">
            <p className="text-[11px] font-black text-slate-800 tracking-tight leading-none">GEM & CLAUDE</p>
            <p className="text-[9px] font-bold leading-none mt-0.5" style={{ color: "#1a8a7a" }}>PM Pro</p>
            {(user?.tenant_name || safeLS('gem_company_name')) && (
              <p className="text-[9px] font-semibold leading-none mt-0.5 text-slate-500 truncate max-w-[120px]">
                {user?.tenant_name || safeLS('gem_company_name')}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Bell mobile — với dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-1.5 text-slate-600 relative"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 bg-rose-500 text-white text-[9px] font-bold w-3.5 h-3.5 flex items-center justify-center rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>
            {showNotifications && (
              <div className="fixed left-2 right-2 top-14 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 max-h-[70vh] overflow-y-auto">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center sticky top-0">
                  <h3 className="font-bold text-slate-800 text-sm">Thông báo khẩn</h3>
                  <button
                    onClick={() => setNotifications(notifications.map((n) => ({ ...n, read: true })))}
                    className="text-xs text-emerald-600 font-medium"
                  >Đánh dấu đã đọc</button>
                </div>
                <div className="divide-y divide-slate-50">
                  {notifications.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-8">Không có thông báo mới</p>
                  ) : notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => { handleNotificationClick(n); setShowNotifications(false); }}
                      className={`w-full p-3 text-left hover:bg-slate-50 transition-colors flex gap-3 items-start ${!n.read ? "bg-emerald-50/30" : ""}`}
                    >
                      <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${n.type === "warning" ? "bg-amber-400" : n.type === "urgent" ? "bg-rose-500" : "bg-emerald-400"}`} />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{new Date(n.timestamp).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <UserMenu onNavigate={setActiveTab} />
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-1.5 text-slate-600">
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar — ẩn khi đang trong ProjectDashboard (tasks) để tối đa chiều ngang */}
      <nav
        className={[
          'bg-white border-r border-slate-200 md:h-screen md:sticky top-[60px] md:top-0 z-10 print:hidden transition-all duration-200',
          isMobileMenuOpen ? 'fixed inset-y-0 left-0 w-[min(280px,85vw)] h-full shadow-2xl z-40' : 'hidden',
          sidebarCollapsed ? 'md:block md:w-14' : 'md:block md:w-60',
        ].join(' ')}
      >
        {/* Toggle collapse button */}
        <div className="hidden md:flex items-center justify-end px-2 pt-2 pb-1">
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            title={sidebarCollapsed ? 'Mở sidebar' : 'Thu sidebar'}
          >
            {sidebarCollapsed
              ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".4"/></svg>
              : <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 3l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".4"/></svg>
            }
          </button>
        </div>
        {/* Logo block — expanded: full, collapsed: icon only */}
        <div className="hidden md:block border-b border-slate-100">
          {sidebarCollapsed ? (
            /* Collapsed: chỉ icon căn giữa */
            <div className="flex items-center justify-center py-3">
              <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center">
                <img src="/icon/icon_app_64.png" alt="GEM" className="w-8 h-8 object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              </div>
            </div>
          ) : (
            /* Expanded: logo + text + slogan */
            <div className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 shadow-sm bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center">
                  <img src="/icon/icon_app_64.png" alt="" className="w-10 h-10 object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
                <div className="min-w-0 overflow-hidden">
                  <h1 className="text-sm font-black text-slate-800 leading-tight tracking-tight whitespace-nowrap">GEM & CLAUDE</h1>
                  <p className="text-[10px] font-bold mt-0.5 whitespace-nowrap" style={{ color: "#1a8a7a" }}>PM Pro</p>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-3 font-medium leading-relaxed">
                Quản lý dự án chuyên nghiệp<br/>Kiểm soát QA/QC/QS & Dòng tiền
              </p>
              {(user?.tenant_name || safeLS('gem_company_name')) && (
                <div className="mt-2 px-2 py-1 bg-teal-50 rounded-lg border border-teal-100">
                  <p className="text-[10px] font-bold text-teal-700 truncate">
                    🏢 {user?.tenant_name || safeLS('gem_company_name')}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        <div className={`space-y-1 ${sidebarCollapsed ? "p-1.5" : "p-2 md:p-4 md:space-y-2"}`}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-colors text-sm whitespace-nowrap ${
                  isActive ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-slate-600 hover:bg-slate-50'
                } ${sidebarCollapsed ? 'md:justify-center md:px-2' : ''}`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <Icon size={16} className={`shrink-0 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span className={sidebarCollapsed ? 'md:hidden' : ''}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 p-2 md:p-4 overflow-y-auto min-w-0 flex flex-col">
          {/* ── TOPBAR: WorkspaceActionBar + Bell + User — sticky trong scroll container ── */}
          <header className="sticky top-0 z-20 mb-3 md:mb-4 shrink-0">
            {/* Desktop topbar */}
            <div className="hidden md:flex items-center gap-3 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-2xl px-4 py-2.5 shadow-sm mb-4">
              {/* Title */}
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold text-slate-800 truncate">
                  {navItems.find((i) => i.id === activeTab)?.label}
                  {activeTab === "tasks" && selectedProject && (
                    <span className="text-slate-400 font-normal ml-2 text-xs">/ {selectedProject.name}</span>
                  )}
                </h2>
              </div>

              {/* WorkspaceActionBar — trung tâm */}
              <WorkspaceActionBar
                currentRole={appCurrentRole}
                onNavigate={handleWorkspaceNavigate}
                pendingCount={pendingCount}
                forceOpen={workspaceOpen}
                onOpenChange={setWorkspaceOpen}
                projectName={selectedProject?.name}
              />

              {/* Separator */}
              <div className="w-px h-5 bg-slate-200" />

              {/* Bell */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className={`p-2 rounded-xl transition-all relative ${showNotifications ? "bg-emerald-100 text-emerald-700" : "text-slate-500 hover:bg-slate-100"}`}
                >
                  <Bell size={16} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-rose-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full border-2 border-white">
                      {unreadCount}
                    </span>
                  )}
                </button>
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800 text-sm">Thông báo khẩn</h3>
                      <button
                        onClick={() => setNotifications(notifications.map((n) => ({ ...n, read: true })))}
                        className="text-xs text-emerald-600 font-medium hover:text-emerald-700"
                      >
                        Đánh dấu đã đọc
                      </button>
                    </div>
                    <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-50">
                      {notifications.length > 0 ? (
                        notifications.map((notification) => (
                          <button
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification)}
                            className={`w-full p-3 text-left hover:bg-slate-50 transition-colors flex gap-3 items-start ${!notification.read ? "bg-emerald-50/30" : ""}`}
                          >
                            <div
                              className={`p-1.5 rounded-lg shrink-0 ${
                                notification.type === "urgent"
                                  ? "bg-rose-100 text-rose-600"
                                  : notification.type === "warning"
                                    ? "bg-orange-100 text-orange-600"
                                    : "bg-blue-100 text-blue-600"
                              }`}
                            >
                              {notification.type === "urgent" ? (
                                <ShieldAlert size={14} />
                              ) : notification.type === "warning" ? (
                                <AlertTriangle size={14} />
                              ) : (
                                <Clock size={14} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start mb-0.5">
                                <h4 className={`text-xs font-bold truncate ${!notification.read ? "text-slate-900" : "text-slate-600"}`}>
                                  {notification.title}
                                </h4>
                                {!notification.read && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0 mt-1" />}
                              </div>
                              <p className="text-[10px] text-slate-500 line-clamp-2">{notification.message}</p>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="p-6 text-center">
                          <p className="text-xs text-slate-400">Không có thông báo</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* UserMenu */}
              <UserMenu onNavigate={setActiveTab} />
            </div>

            {/* Mobile: WorkspaceActionBar strip */}
            <div className="md:hidden flex items-center gap-2 py-1.5">
              <WorkspaceActionBar currentRole={appCurrentRole} onNavigate={handleWorkspaceNavigate} pendingCount={pendingCount} forceOpen={workspaceOpen} onOpenChange={setWorkspaceOpen} />

            </div>
          </header>

          {/* Content Area — flex-1 để header sticky ở trên */}
          <div className="flex-1 min-h-0">
          {activeTab === "dashboard" ? (
            <Dashboard onNavigate={handleNavigate} projects={projects} />
          ) : activeTab === "tasks" ? (
            <ProjectDashboard
              key={projectDashboardState.navKey}
              initialTab={projectDashboardState.tab}
              initialManpowerTab={projectDashboardState.manpowerTab}
              initialSubTab={projectDashboardState.subTab}
              navKey={projectDashboardState.navKey}
              initialProjectId={projectDashboardState.projectId ?? selectedProjectId}
              projects={projects}
              setProjects={setProjects}
              selectedProjectId={selectedProjectId}
              setSelectedProjectId={setSelectedProjectId}
              generateWeeklyReport={generateWeeklyReport}
              setShowRecordForm={setShowRecordForm}
              setRecordType={setRecordType}
              setShowProfileForm={setShowProfileForm}
              setShowHseForm={setShowHseForm}
              isGeneratingReport={isGeneratingReport}
              generatedReport={generatedReport}
              showRecordForm={showRecordForm}
              recordType={recordType}
              recordData={recordData}
              setRecordData={setRecordData}
              isGeneratingRecord={isGeneratingRecord}
              generateGemRecord={generateGemRecord}
              showProfileForm={showProfileForm}
              showHseForm={showHseForm}
              onBackToList={handleBackToList}
              onNavigateApp={setActiveTab}
              onPushNotification={(notif: any) =>
                setNotifications((prev: any) => (prev.some((n: any) => n.id === notif.id) ? prev : [notif, ...prev]))
              }
            />
          ) : activeTab === "contacts" ? (
            <Contacts projects={projects} />
          ) : activeTab === "calendar" ? (
            <CalendarSchedule projects={projects} />
          ) : activeTab === "billing" ? (
            <BillingPage onClose={() => setActiveTab("dashboard")} />
          ) : activeTab === "internal_admin" && isSuperAdmin ? (
            <InternalAdminDashboard />
          ) : activeTab === "admin" && isAdmin ? (
            <AdminPanel currentUserId={user?.id ?? ""} projects={projects} />
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-10 min-h-[400px] flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                {React.createElement(navItems.find((i) => i.id === activeTab)?.icon || LayoutDashboard, {
                  size: 32,
                  className: "text-emerald-500",
                })}
              </div>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">Khu vực {navItems.find((i) => i.id === activeTab)?.label}</h3>
              <p className="text-slate-500 max-w-md">Chúng ta sẽ xây dựng các tính năng chi tiết cho phần này trong các bước tiếp theo.</p>
            </div>
          )}
          </div>{/* end content area */}
      </main>

      {/* Floating Nàng GEM Bubble */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end print:hidden">
        {showGemBubble && (
          <>
            {/* Mobile overlay */}
            <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40 lg:hidden" onClick={() => setShowGemBubble(false)} />
            {/* Chat window */}
            <div
              className="fixed bottom-0 left-0 right-0 top-0 lg:bottom-24 lg:right-6 lg:top-auto lg:left-auto
              bg-white lg:rounded-2xl shadow-2xl border border-slate-200
              lg:w-[min(calc(100vw-340px),860px)] lg:h-[calc(100vh-130px)]
              flex flex-col overflow-hidden z-50 animate-in slide-in-from-bottom-4 duration-200"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-emerald-100 border border-emerald-200 rounded-xl flex items-center justify-center">
                    <Sparkles size={16} className="text-emerald-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-800 text-sm leading-none">Nàng GEM</h3>
                      <span className="text-[9px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full">
                        siêu việt
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                      Trợ lý AI quản lý xây dựng
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowGemBubble(false)}
                  className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <ChatAssistant projects={projects} />
              </div>
            </div>
          </>
        )}

        {/* FAB button */}
        <button
          onClick={() => setShowGemBubble(!showGemBubble)}
          className="w-14 h-14 bg-emerald-600 hover:bg-emerald-700 rounded-2xl shadow-lg
            flex items-center justify-center text-white transition-all hover:scale-105
            active:scale-95 relative border-2 border-white z-50 mt-4"
        >
          {showGemBubble ? <X size={22} /> : <Sparkles size={22} />}
          {!showGemBubble && (
            <span
              className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-bold
              w-5 h-5 flex items-center justify-center rounded-full border-2 border-white"
            >
              3
            </span>
          )}
        </button>
      </div>

      {/* Modals */}
      {showWeeklyReportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[10000] flex items-center justify-center p-4 md:p-8 animate-in fade-in">
          <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600 text-white rounded-2xl">
                  <FileText size={24} />
                </div>
                <h3 className="text-xl font-bold text-slate-800">Báo cáo tổng kết dự án hàng tuần</h3>
              </div>
              <button onClick={() => setShowWeeklyReportModal(false)} className="p-2.5 text-slate-400 hover:text-slate-600 transition-all">
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-slate-50/30">
              {isGeneratingReport ? (
                <div className="h-full flex flex-col items-center justify-center py-20 space-y-6">
                  <div className="w-20 h-20 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                  <h4 className="text-xl font-bold text-slate-800">Nàng GEM đang tổng hợp dữ liệu...</h4>
                </div>
              ) : (
                <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm prose prose-slate max-w-none">
                  <Markdown>{generatedReport || ""}</Markdown>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showRecordForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[10000] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                  <FileText size={20} />
                </div>
                <h3 className="text-lg font-bold text-slate-800">Tạo / Tải lên Báo cáo & Biên bản</h3>
              </div>
              <button onClick={() => setShowRecordForm(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <div className="flex flex-1 overflow-hidden">
              <div className="w-1/2 border-r border-slate-200 flex flex-col bg-white p-6 overflow-y-auto">
                <label className="block text-sm font-medium text-slate-700 mb-2">Loại Báo cáo / Biên bản</label>
                <select
                  value={recordType}
                  onChange={(e) => setRecordType(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 mb-6 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="Báo cáo ngày">Báo cáo ngày</option>
                  <option value="Biên bản nghiệm thu">Biên bản nghiệm thu công việc</option>
                  <option value="Báo cáo an toàn">Báo cáo an toàn LĐ (HSE)</option>
                </select>
                <button
                  onClick={generateGemRecord}
                  disabled={isGeneratingRecord}
                  className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 mb-6"
                >
                  {isGeneratingRecord ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
                  GEM tự động soạn thảo
                </button>
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-sm prose-sm overflow-auto">
                  <Markdown>{recordData || "Chưa có dữ liệu soạn thảo."}</Markdown>
                </div>
              </div>
              <div className="w-1/2 bg-slate-100 p-6 flex flex-col items-center justify-center text-center">
                <UploadCloud size={32} className="text-slate-400 mb-4" />
                <h4 className="font-bold text-slate-800 mb-2">Tải lên tài liệu mẫu</h4>
                <p className="text-sm text-slate-500 mb-6">Kéo thả hoặc chọn file để Nàng GEM học theo mẫu của anh.</p>
                <button className="px-6 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50">
                  Chọn file
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Taskbar */}
      <Taskbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        generateWeeklyReport={generateWeeklyReport}
        setRecordType={setRecordType}
        setShowRecordForm={setShowRecordForm}
        fileInputRef={fileInputRef}
        setShowProfileForm={setShowProfileForm}
        setShowHseForm={setShowHseForm}
        setShowGemChat={setShowGemBubble}
        onNavigateProject={handleNavigateProject}
        pendingCount={pendingCount}
        isSyncing={isSyncing}
        onOpenQueuePanel={() => setShowQueuePanel(true)}
        analyzeMaterialsWithGem={() => {}}
        onOpenWorkspace={() => setWorkspaceOpen(true)}
        onNavigateApp={setActiveTab}
      />

      {/* Offline Queue Panel */}
      {showQueuePanel && (
        <div className="fixed inset-0 bg-black/50 z-[9990] flex items-center justify-center p-4" onClick={() => setShowQueuePanel(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
            <OfflineQueuePanel onClose={() => setShowQueuePanel(false)} />
          </div>
        </div>
      )}

      {/* PWA Manager */}
      <PWAManager
        onNavigate={(tab) => {
          if (tab) setActiveTab(tab);
        }}
      />

      {/* Hidden File Input */}
      <input type="file" ref={fileInputRef} className="hidden" onChange={() => notifInfo("Đã nhận file!")} />
      {/* Dev Testing Checklist — tự ẩn khi PROD */}

      {/* Onboarding — trigger lần đầu login */}
      {showOnboarding && user && (
        <OnboardingFlow
          onComplete={({ company, project, members }) => {
            localStorage.setItem(`gem_onboarded_${user.id}`, '1');
            if (company.name) localStorage.setItem('gem_company_name', company.name);
            // Pre-fill ProjectConfigPanel với data từ onboarding
            const newProjectId = projects[projects.length - 1]?.id;
            if (newProjectId && (company.name || project.name)) {
              const cfg = loadProjectConfig(newProjectId);
              saveProjectConfig({
                ...cfg,
                projectId: newProjectId,
                projectFullName: project.name || cfg.projectFullName,
                projectAddress: project.location || cfg.projectAddress,
                contractorName: company.name || cfg.contractorName,
                contractorAddress: company.address || cfg.contractorAddress,
                contractorPhone: company.phone || cfg.contractorPhone,
                contractorMST: company.tax_code || cfg.contractorMST,
                ownerName: project.client_name || cfg.ownerName,
              });
            }
            setShowOnboarding(false);
            setActiveTab('tasks');
            notifOk(`🎉 Chào mừng ${company.name || 'anh'} đến với GEM & CLAUDE PM Pro!`);
          }}
          onSkip={() => {
            localStorage.setItem(`gem_onboarded_${user.id}`, '1');
            setShowOnboarding(false);
          }}
        />
      )}
    </div>
    </div>
  );
}

// ─── AuthProvider wrapper ────────────────────────────────────────────────────
export default function App() {
  // Show splash một lần duy nhất mỗi session (không lặp lại khi F5)
  const [showSplash, setShowSplash] = React.useState(() => {
    return !sessionStorage.getItem("gem_splash_done");
  });

  const handleSplashComplete = React.useCallback(() => {
    sessionStorage.setItem("gem_splash_done", "1");
    setShowSplash(false);
  }, []);

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} duration={3500} />;
  }


  return (
    <NotificationProvider>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </NotificationProvider>
  );
}
