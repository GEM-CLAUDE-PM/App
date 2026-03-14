import React, { useState, useRef, useEffect } from "react";
import { UserMenu } from "../AuthProvider";
import { QueueBadge } from "../useOfflineQueue";
import {
  LayoutDashboard,
  FolderKanban,
  CalendarDays,
  Users,
  FileText,
  ClipboardList,
  ClipboardCheck,
  Sparkles,
  UploadCloud,
  UserPlus,
  ShieldCheck,
  Printer,
  Plus,
  Package,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  CalendarPlus,
  UserPlus2,
  Banknote,
  Building2,
  ListChecks,
  ShieldAlert,
  TrendingUp,
  Wrench,
  ArrowRight,
  BarChart3,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface TaskbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  generateWeeklyReport: () => void;
  setRecordType: (type: string) => void;
  setShowRecordForm: (show: boolean) => void;
  analyzeMaterialsWithGem: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  setShowProfileForm: (show: boolean) => void;
  setShowHseForm: (show: boolean) => void;
  setShowGemChat: (show: boolean) => void;
  // New callbacks — navigate to sub-tab inside ProjectDashboard
  onNavigateProject?: (tab: string) => void;
  pendingCount?: number;
  isSyncing?: boolean;
  onOpenQueuePanel?: () => void;
  // Legacy drag props — kept for compatibility but unused
  taskbarRef?: React.RefObject<HTMLDivElement | null>;
  taskbarPosition?: { x: number; y: number };
  isTaskbarExpanded?: boolean;
  setIsTaskbarExpanded?: (v: boolean) => void;
  handleTaskbarMouseDown?: (e: React.MouseEvent) => void;
  handleTaskbarTouchStart?: (e: React.TouchEvent) => void;
}

// ── Nav items ─────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: "dashboard", icon: LayoutDashboard, label: "Tổng quan", color: "emerald" },
  { id: "tasks", icon: FolderKanban, label: "Dự án", color: "blue" },
  { id: "calendar", icon: CalendarDays, label: "Lịch trình", color: "violet" },
  { id: "contacts", icon: Users, label: "Đối tác", color: "amber" },
];

// ── Action groups ─────────────────────────────────────────────────────────────
const ACTION_GROUPS = [
  {
    label: "Lịch & Liên hệ",
    color: "violet",
    items: [
      { icon: CalendarPlus, label: "+ Sự kiện lịch", key: "add-event" },
      { icon: UserPlus2, label: "+ Liên hệ mới", key: "add-contact" },
    ],
  },
  {
    label: "QA/QC",
    color: "teal",
    items: [
      { icon: ListChecks, label: "+ Checklist mới", key: "add-checklist" },
      { icon: ShieldAlert, label: "+ NCR mới", key: "add-ncr" },
    ],
  },
  {
    label: "QS & Thanh toán",
    color: "indigo",
    items: [
      { icon: Building2, label: "+ Nhà thầu phụ", key: "add-sub" },
      { icon: Banknote, label: "+ Thanh toán NTP", key: "add-payment" },
    ],
  },
  {
    label: "Báo cáo & Hồ sơ",
    color: "blue",
    items: [
      { icon: FileText, label: "Báo cáo tuần", key: "weekly" },
      { icon: ClipboardList, label: "Biên bản NT", key: "record" },
      { icon: ClipboardCheck, label: "Nhật ký CT", key: "diary" },
    ],
  },
  {
    label: "GEM & Vật tư",
    color: "emerald",
    items: [
      { icon: Sparkles, label: "Phân tích GEM", key: "gem" },
      { icon: UploadCloud, label: "Tải hóa đơn", key: "upload" },
      { icon: Package, label: "Phiếu vật tư", key: "material" },
    ],
  },
  {
    label: "Nhân lực & HSE",
    color: "orange",
    items: [
      { icon: UserPlus, label: "Hồ sơ nhân sự", key: "profile" },
      { icon: ShieldCheck, label: "Hồ sơ ATLD", key: "hse" },
      { icon: AlertTriangle, label: "Vi phạm HSE", key: "hse-vio" },
    ],
  },
  {
    label: "Điều hướng nhanh",
    color: "slate",
    items: [
      { icon: TrendingUp, label: "→ Tiến độ", key: "nav-progress" },
      { icon: ListChecks, label: "→ QA/QC", key: "nav-qaqc" },
      { icon: BarChart3, label: "→ QS", key: "nav-qs" },
      { icon: Wrench, label: "→ Thiết bị", key: "nav-equipment" },
      { icon: Printer, label: "In ấn", key: "print" },
    ],
  },
];

const COLOR_ACTIVE: Record<string, string> = {
  emerald: "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40",
  blue: "bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/40",
  violet: "bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/40",
  amber: "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40",
};

const COLOR_ICON: Record<string, string> = {
  blue: "text-blue-400",
  emerald: "text-emerald-400",
  orange: "text-orange-400",
  violet: "text-violet-400",
  teal: "text-teal-400",
  indigo: "text-indigo-400",
  slate: "text-slate-400",
};

// ── Tooltip ───────────────────────────────────────────────────────────────────
function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative flex flex-col items-center" onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}>
      {children}
      {visible && (
        <div
          className="absolute bottom-full mb-2 px-2.5 py-1 bg-slate-800 text-white text-[11px]
          font-semibold rounded-lg whitespace-nowrap shadow-xl pointer-events-none z-[9999]
          animate-in fade-in-0 zoom-in-95 duration-100"
        >
          {label}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </div>
      )}
    </div>
  );
}

// ── DockButton ────────────────────────────────────────────────────────────────
function DockButton({
  icon: Icon,
  label,
  onClick,
  active,
  colorKey,
  badge,
}: {
  icon: any;
  label: string;
  onClick: () => void;
  active?: boolean;
  colorKey?: string;
  badge?: number;
}) {
  return (
    <Tooltip label={label}>
      <button
        onClick={onClick}
        className={`relative w-10 h-10 rounded-xl flex items-center justify-center
          transition-all duration-150 hover:scale-110 active:scale-95 group
          ${active && colorKey ? COLOR_ACTIVE[colorKey] : "text-slate-400 hover:text-white hover:bg-white/10"}`}
      >
        <Icon size={19} strokeWidth={active ? 2.5 : 2} />
        {badge && badge > 0 ? (
          <span
            className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-bold
              w-4 h-4 flex items-center justify-center rounded-full border border-slate-900/60 leading-none"
          >
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </button>
    </Tooltip>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────
function Divider() {
  return <div className="w-px h-6 bg-slate-700/70 mx-0.5 shrink-0" />;
}

// ── ActionPanel ───────────────────────────────────────────────────────────────
function ActionPanel({ onAction, onClose }: { onAction: (key: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full mb-3 left-0
        bg-slate-900/95 backdrop-blur-xl border border-slate-700/60
        rounded-2xl shadow-2xl p-3 w-[min(88vw,400px)]
        animate-in slide-in-from-bottom-2 fade-in-0 duration-200 z-[9998]
        max-h-[70vh] overflow-y-auto"
    >
      {/* Arrow pointing down-left */}
      <div
        className="absolute bottom-[-7px] left-6
        w-3 h-3 bg-slate-800 border-r border-b border-slate-700/60 rotate-45"
      />

      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 px-1 sticky top-0 bg-slate-900/95 pb-1">
        Hành động nhanh
      </p>

      <div className="space-y-3">
        {ACTION_GROUPS.map((group) => (
          <div key={group.label}>
            {/* Group header */}
            <p className={`text-[9px] font-bold uppercase tracking-wider mb-1.5 px-1 flex items-center gap-1.5 ${COLOR_ICON[group.color]}`}>
              <span
                className={`w-1 h-3 rounded-full opacity-70 ${
                  group.color === "violet"
                    ? "bg-violet-400"
                    : group.color === "teal"
                      ? "bg-teal-400"
                      : group.color === "indigo"
                        ? "bg-indigo-400"
                        : group.color === "blue"
                          ? "bg-blue-400"
                          : group.color === "emerald"
                            ? "bg-emerald-400"
                            : group.color === "orange"
                              ? "bg-orange-400"
                              : "bg-slate-500"
                }`}
              />
              {group.label}
            </p>
            {/* Items — 2 col for nav group, wrap for others */}
            <div className={`flex flex-wrap gap-1.5 ${group.color === "slate" ? "grid grid-cols-3" : ""}`}>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isNav = item.key.startsWith("nav-");
                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      onAction(item.key);
                      onClose();
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border
                      transition-all text-xs font-medium group
                      ${
                        isNav
                          ? "bg-slate-800/60 border-slate-700/40 hover:bg-slate-700/80 hover:border-slate-600"
                          : "bg-slate-800/80 border-slate-700/50 hover:bg-slate-700/80 hover:border-slate-600"
                      }
                      ${COLOR_ICON[group.color]} hover:text-white`}
                  >
                    <Icon size={12} strokeWidth={2} className="shrink-0" />
                    <span className="text-slate-300 group-hover:text-white whitespace-nowrap">{item.label}</span>
                    {isNav && <ArrowRight size={10} className="text-slate-600 group-hover:text-slate-400 ml-0.5" />}
                  </button>
                );
              })}
            </div>
            {/* Separator between groups */}
            <div className="mt-2 border-t border-slate-800/60" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ══ MAIN ══════════════════════════════════════════════════════════════════════
export const Taskbar: React.FC<TaskbarProps> = ({
  activeTab,
  setActiveTab,
  generateWeeklyReport,
  setRecordType,
  setShowRecordForm,
  analyzeMaterialsWithGem,
  fileInputRef,
  setShowProfileForm,
  setShowHseForm,
  setShowGemChat,
  onNavigateProject,
  pendingCount,
  isSyncing,
  onOpenQueuePanel,
}) => {
  const [showActions, setShowActions] = useState(false);
  const [isExpanded, setIsExpanded] = useState(typeof window !== "undefined" ? window.innerWidth >= 768 : true);

  // Auto-collapse on mobile resize
  useEffect(() => {
    function onResize() {
      if (window.innerWidth < 768) setIsExpanded(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function handleAction(key: string) {
    switch (key) {
      // Lịch & Liên hệ
      case "add-event":
        setActiveTab("calendar");
        // CalendarSchedule tự mở modal khi nhận state — navigate + flag
        setTimeout(() => window.dispatchEvent(new CustomEvent("gem:add-event")), 150);
        break;
      case "add-contact":
        setActiveTab("contacts");
        setTimeout(() => window.dispatchEvent(new CustomEvent("gem:add-contact")), 150);
        break;

      // QA/QC
      case "add-checklist":
        setActiveTab("tasks");
        setTimeout(() => onNavigateProject?.("qa-qc"), 150);
        break;
      case "add-ncr":
        setActiveTab("tasks");
        setTimeout(() => onNavigateProject?.("qa-qc"), 150);
        break;

      // QS & Thanh toán
      case "add-sub":
        setActiveTab("tasks");
        setTimeout(() => onNavigateProject?.("qs"), 150);
        break;
      case "add-payment":
        setActiveTab("tasks");
        setTimeout(() => onNavigateProject?.("qs"), 150);
        break;

      // Báo cáo & Hồ sơ
      case "weekly":
        generateWeeklyReport();
        break;
      case "record":
        setRecordType("Biên bản nghiệm thu");
        setShowRecordForm(true);
        break;
      case "diary":
        setRecordType("Nhật ký công trình");
        setShowRecordForm(true);
        break;

      // GEM & Vật tư
      case "gem":
        analyzeMaterialsWithGem();
        break;
      case "upload":
        fileInputRef.current?.click();
        break;
      case "material":
        setRecordType("Phiếu yêu cầu vật tư");
        setShowRecordForm(true);
        break;

      // Nhân lực & HSE
      case "profile":
        setShowProfileForm(true);
        break;
      case "hse":
        setShowHseForm(true);
        break;
      case "hse-vio":
        setRecordType("Biên bản vi phạm HSE");
        setShowRecordForm(true);
        break;

      // Điều hướng nhanh
      case "nav-progress":
        setActiveTab("tasks");
        setTimeout(() => onNavigateProject?.("progress"), 150);
        break;
      case "nav-qaqc":
        setActiveTab("tasks");
        setTimeout(() => onNavigateProject?.("qa-qc"), 150);
        break;
      case "nav-qs":
        setActiveTab("tasks");
        setTimeout(() => onNavigateProject?.("qs"), 150);
        break;
      case "nav-equipment":
        setActiveTab("tasks");
        setTimeout(() => onNavigateProject?.("equipment"), 150);
        break;

      case "print":
        window.print();
        break;
    }
  }

  return (
    <div className="fixed bottom-6 left-6 z-[9000] print:hidden select-none flex flex-col items-start gap-2">
      {/* Action panel popup — opens upward */}
      {showActions && <ActionPanel onAction={handleAction} onClose={() => setShowActions(false)} />}

      {/* Dock — collapsed (mobile: icon only) / expanded (desktop: full) */}
      <div
        className={`flex items-center gap-1 px-2 py-2
        bg-slate-900/90 backdrop-blur-2xl border border-slate-700/50
        rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.04)]
        transition-all duration-300 overflow-hidden
        ${isExpanded ? "w-auto" : "w-[52px]"}`}
      >
        {/* ── Toggle button — app icon when collapsed, chevron when expanded ── */}
        <Tooltip label={isExpanded ? "Thu gọn" : "GEM & CLAUDE PM Pro"}>
          <button
            onClick={() => setIsExpanded((v) => !v)}
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0
              bg-slate-800 hover:bg-slate-700
              transition-all duration-150 active:scale-95 overflow-hidden"
          >
            {isExpanded ? (
              <ChevronDown size={16} strokeWidth={2.5} className="text-slate-400" />
            ) : (
              <img
                src="/icon/icon_app_64.png"
                alt="GEM PM"
                className="w-9 h-9 object-cover rounded-xl"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}
          </button>
        </Tooltip>

        {/* ── Expanded content ── */}
        {isExpanded && (
          <>
            <Divider />

            {/* Nav items */}
            {NAV_ITEMS.map((item) => (
              <DockButton
                key={item.id}
                icon={item.icon}
                label={item.label}
                colorKey={item.color}
                active={activeTab === item.id}
                onClick={() => setActiveTab(item.id)}
              />
            ))}

            <Divider />

            {/* Quick add */}
            <Tooltip label="Hành động nhanh">
              <button
                onClick={() => setShowActions((v) => !v)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all
                  duration-150 hover:scale-110 active:scale-95 shrink-0
                  ${
                    showActions
                      ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40"
                      : "bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30"
                  }`}
              >
                <Plus size={16} strokeWidth={2.5} />
              </button>
            </Tooltip>

            <Divider />

            {/* GEM chat */}
            <DockButton icon={Sparkles} label="Nàng GEM Chat" onClick={() => setShowGemChat(true)} colorKey="emerald" />

            {/* Offline queue badge */}
            {((pendingCount ?? 0) > 0 || isSyncing) && (
              <div className="shrink-0">
                <button onClick={onOpenQueuePanel} className="flex items-center">
                  <QueueBadge count={pendingCount ?? 0} isSyncing={isSyncing ?? false} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Taskbar;

// ─── UserMenuBar — fixed top-right, shown alongside Taskbar ──────────────────
export function UserMenuBar() {
  return (
    <>
      {/* Logo — top left */}
      <div
        className="fixed top-4 left-4 z-[9001] print:hidden flex items-center gap-2.5
        bg-white/80 backdrop-blur-md border border-slate-200/60
        rounded-2xl px-3 py-1.5 shadow-sm"
      >
        <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0 bg-gradient-to-br from-teal-500 to-teal-700">
          <img
            src="/icon/icon_app_64.png"
            alt="GEM"
            width={28}
            height={28}
            style={{ width: 28, height: 28, objectFit: "cover", display: "block" }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
        <div className="leading-tight">
          <p className="text-[11px] font-black text-slate-800 tracking-tight">GEM & CLAUDE</p>
          <p className="text-[9px] text-slate-400 font-semibold tracking-wide">PM Pro</p>
        </div>
      </div>
      {/* User menu — top right */}
      <div className="fixed top-4 right-4 z-[9001] print:hidden">
        <UserMenu />
      </div>
    </>
  );
}
