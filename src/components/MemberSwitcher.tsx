/**
 * MemberSwitcher.tsx  —  GEM&CLAUDE PM Pro
 * ══════════════════════════════════════════════════════════════════════
 * Component thay thế role switcher đơn giản trong ProjectDashboard.
 *
 * Features:
 *   • Avatar + tên user + email
 *   • Chip cho từng role được gán → click để switch activeRole
 *   • Badge cảnh báo nếu role hiện tại không đủ quyền cho thao tác cụ thể
 *   • Hiển thị "level badge" và domain tags
 * ══════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  User, ChevronDown, ChevronUp, Shield, AlertTriangle,
  CheckCircle2, Users, Zap, RotateCcw,
} from 'lucide-react';
import {
  ROLES, type RoleId,
  AUTHORITY_LEVEL, getRoleProjectScope,
  type UserContext,
} from './permissions';
import {
  type ProjectMember,
  loadMembers, getCurrentMember,
  switchActiveRole, setActiveMemberSnap,
  buildCtxFromMember,
} from './projectMember';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const LEVEL_COLOR: Record<number, { bg: string; text: string; label: string }> = {
  1: { bg: 'bg-slate-100',   text: 'text-slate-600',   label: 'L1' },
  2: { bg: 'bg-blue-100',    text: 'text-blue-700',    label: 'L2' },
  3: { bg: 'bg-amber-100',   text: 'text-amber-700',   label: 'L3' },
  4: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'L4' },
  5: { bg: 'bg-violet-100',  text: 'text-violet-700',  label: 'L5' },
};

function initials(name: string): string {
  return name.split(' ').slice(-2).map(w => w[0]?.toUpperCase() || '').join('');
}

function avatarColor(userId: string): string {
  const colors = [
    'bg-emerald-500', 'bg-blue-500', 'bg-violet-500',
    'bg-amber-500',   'bg-rose-500', 'bg-teal-500',
    'bg-indigo-500',  'bg-orange-500',
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// ─────────────────────────────────────────────────────────────────────────────
// ROLE CHIP
// ─────────────────────────────────────────────────────────────────────────────

function RoleChip({
  roleId, isActive, onClick,
}: { roleId: RoleId; isActive: boolean; onClick: () => void }) {
  const role  = ROLES[roleId];
  const level = AUTHORITY_LEVEL[roleId] || 1;
  const lc    = LEVEL_COLOR[level] || LEVEL_COLOR[1];

  return (
    <button
      onClick={onClick}
      title={isActive ? 'Đang active' : `Chuyển sang "${role?.label}"`}
      className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border-2 transition-all group ${
        isActive
          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:bg-slate-50'
      }`}
    >
      {/* Level badge */}
      <span className={`text-[9px] font-black px-1 rounded ${
        isActive ? 'bg-white/20 text-white' : `${lc.bg} ${lc.text}`
      }`}>
        {lc.label}
      </span>
      {role?.label || roleId}
      {isActive && (
        <CheckCircle2 size={10} className="text-emerald-400 shrink-0"/>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface MemberSwitcherProps {
  projectId:    string;
  /** Callback khi member/role đổi — caller cần rebuild ctx */
  onChange:     (member: ProjectMember) => void;
  /** Compact mode — chỉ hiện tên + dropdown toggle */
  compact?:     boolean;
  className?:   string;
}

export default function MemberSwitcher({
  projectId, onChange, compact = false, className = '',
}: MemberSwitcherProps) {
  const [members,       setMembers]       = useState<ProjectMember[]>([]);
  const [activeMember,  setActiveMember]  = useState<ProjectMember | null>(null);
  const [showDropdown,  setShowDropdown]  = useState(false);

  // ── Load ─────────────────────────────────────────────────────────────────
  const reload = useCallback(() => {
    const all = loadMembers(projectId);
    setMembers(all);
    const current = getCurrentMember(projectId);
    setActiveMember(current);
  }, [projectId]);

  useEffect(() => { reload(); }, [reload]);

  // ── Switch active role ───────────────────────────────────────────────────
  const handleRoleSwitch = (roleId: RoleId) => {
    if (!activeMember) return;
    if (switchActiveRole(projectId, activeMember.userId, roleId)) {
      const updated = { ...activeMember, activeRoleId: roleId };
      setActiveMember(updated);
      onChange(updated);
    }
  };

  if (!activeMember) return null;

  const level      = AUTHORITY_LEVEL[activeMember.activeRoleId] || 1;
  const lc         = LEVEL_COLOR[level] || LEVEL_COLOR[1];
  const roleLabel  = ROLES[activeMember.activeRoleId]?.label || activeMember.activeRoleId;
  const multiRole  = activeMember.roles.length > 1;

  // ── COMPACT mode ─────────────────────────────────────────────────────────
  if (compact) {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={() => setShowDropdown(v => !v)}
          className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 hover:bg-slate-50 transition-all shadow-sm"
        >
          {/* Avatar */}
          <div className={`w-6 h-6 rounded-full ${avatarColor(activeMember.userId)} flex items-center justify-center text-white text-[9px] font-black shrink-0`}>
            {initials(activeMember.userName)}
          </div>
          <div className="text-left min-w-0">
            <p className="text-xs font-bold text-slate-800 truncate max-w-[90px]">{activeMember.userName.split(' ').slice(-1)[0]}</p>
            <p className={`text-[9px] font-bold ${lc.text}`}>{lc.label} · {roleLabel}</p>
          </div>
          {multiRole && (
            <span className="text-[9px] bg-amber-100 text-amber-700 font-black px-1 rounded shrink-0">
              {activeMember.roles.length}
            </span>
          )}
          {showDropdown ? <ChevronUp size={12} className="text-slate-400"/> : <ChevronDown size={12} className="text-slate-400"/>}
        </button>

        {showDropdown && (
          <div className="absolute top-full mt-1 right-0 z-50 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
            <MemberSwitcherPanel
              members={members}
              activeMember={activeMember}
              onRoleSwitch={handleRoleSwitch}
              setShowUserPick={setShowUserPick}
            />
          </div>
        )}
      </div>
    );
  }

  // ── FULL mode (inline, used in ProjectDashboard role switcher area) ───────
  return (
    <div className={`bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 print:hidden ${className}`}>
      <MemberSwitcherPanel
        members={members}
        activeMember={activeMember}
        onRoleSwitch={handleRoleSwitch}
        setShowUserPick={setShowUserPick}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PANEL (shared between compact dropdown and full mode)
// ─────────────────────────────────────────────────────────────────────────────

interface PanelProps {
  members:        ProjectMember[];
  activeMember:   ProjectMember;
  onRoleSwitch:   (r: RoleId) => void;
  setShowUserPick: (v: boolean) => void;
}

function MemberSwitcherPanel({
  members, activeMember, onRoleSwitch,
}: PanelProps) {
  const level     = AUTHORITY_LEVEL[activeMember.activeRoleId] || 1;
  const lc        = LEVEL_COLOR[level] || LEVEL_COLOR[1];
  const roleLabel = ROLES[activeMember.activeRoleId]?.label || activeMember.activeRoleId;
  const multiRole = activeMember.roles.length > 1;

  return (
    <div className="p-3 space-y-3">

      {/* ── User identity ── */}
      <div className="flex items-center gap-2.5">
        <div className={`w-9 h-9 rounded-xl ${avatarColor(activeMember.userId)} flex items-center justify-center text-white text-sm font-black shrink-0`}>
          {initials(activeMember.userName)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800 truncate">{activeMember.userName}</p>
          {activeMember.email && (
            <p className="text-[10px] text-slate-400 truncate">{activeMember.email}</p>
          )}
        </div>
      </div>


      {/* ── Current active role ── */}
      <div>
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
          <Shield size={9}/> Vai trò đang hoạt động
        </p>
        <div className={`flex items-center gap-2 px-2.5 py-2 rounded-xl ${lc.bg} border border-current/10`}>
          <span className={`text-[10px] font-black ${lc.text}`}>{lc.label}</span>
          <span className={`text-xs font-bold ${lc.text}`}>{roleLabel}</span>
          {activeMember.grantedExtras?.tempLevelBoost && (
            <span className="ml-auto text-[9px] bg-amber-200 text-amber-800 font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
              <Zap size={8}/> Boost
            </span>
          )}
        </div>
      </div>

      {/* ── Multi-role switcher ── */}
      {multiRole && (
        <div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <RotateCcw size={9}/> Chuyển vai trò
          </p>
          <div className="flex flex-wrap gap-1.5">
            {activeMember.roles.map(r => (
              <RoleChip
                key={r}
                roleId={r}
                isActive={r === activeMember.activeRoleId}
                onClick={() => r !== activeMember.activeRoleId && onRoleSwitch(r)}
              />
            ))}
          </div>
          <p className="text-[9px] text-slate-400 mt-1.5 leading-relaxed">
            Click chip để đổi vai trò. Mỗi vai trò có thẩm quyền riêng.
          </p>
        </div>
      )}

      {/* ── Project scope indicator ── */}
      {(() => {
        const scope = getRoleProjectScope(activeMember.activeRoleId as RoleId);
        if (scope === 'all') return null;
        return (
          <div className={`flex items-start gap-2 rounded-xl px-2.5 py-2 border ${
            scope === 'single'
              ? 'bg-amber-50 border-amber-200'
              : 'bg-blue-50 border-blue-200'
          }`}>
            <span className="text-sm shrink-0">{scope === 'single' ? '🔒' : '📋'}</span>
            <div>
              <p className={`text-[10px] font-bold ${scope === 'single' ? 'text-amber-700' : 'text-blue-700'}`}>
                {scope === 'single' ? 'Giới hạn 1 công trình' : 'Giới hạn công trình được gán'}
              </p>
              <p className={`text-[9px] leading-relaxed ${scope === 'single' ? 'text-amber-600' : 'text-blue-600'}`}>
                {scope === 'single'
                  ? 'Vai trò này chỉ được thao tác trong 1 công trình duy nhất.'
                  : 'Vai trò L3 chỉ thấy công trình được gán. Có thể support nhiều CT.'}
              </p>
            </div>
          </div>
        );
      })()}

      {/* ── Granted extras indicator ── */}
      {activeMember.grantedExtras?.reason && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-2">
          <AlertTriangle size={11} className="text-amber-500 shrink-0 mt-0.5"/>
          <div>
            <p className="text-[10px] font-bold text-amber-700">Quyền được ủy quyền</p>
            <p className="text-[9px] text-amber-600 leading-relaxed">{activeMember.grantedExtras.reason}</p>
            {activeMember.grantedExtras.expiresAt && (
              <p className="text-[9px] text-amber-500 mt-0.5">
                Hết hạn: {new Date(activeMember.grantedExtras.expiresAt).toLocaleDateString('vi-VN')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Dev hint */}
      <p className="text-[9px] text-slate-300 text-center">
        ⓘ Sau Supabase Auth, user & role sẽ tự động gán khi đăng nhập
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FALLBACK HINT BANNER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * FallbackHintBanner — hiển thị khi user không đủ quyền với activeRole
 * nhưng có role khác có thể thực hiện được.
 */
interface FallbackHintBannerProps {
  message:     string;
  canSwitch:   boolean;
  targetRole?: RoleId;
  onSwitch?:   () => void;
  onDismiss?:  () => void;
}

export function FallbackHintBanner({
  message, canSwitch, targetRole, onSwitch, onDismiss,
}: FallbackHintBannerProps) {
  const targetLabel = targetRole ? ROLES[targetRole]?.label : undefined;

  return (
    <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-200">
      <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5"/>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-amber-800 leading-snug">{message}</p>
        {canSwitch && targetLabel && (
          <p className="text-[10px] text-amber-700 mt-0.5">
            Chuyển sang <strong>"{targetLabel}"</strong> để tiếp tục.
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {canSwitch && onSwitch && (
          <button
            onClick={onSwitch}
            className="text-[10px] font-bold bg-amber-600 text-white px-2.5 py-1 rounded-lg hover:bg-amber-700 transition-colors"
          >
            Chuyển
          </button>
        )}
        {onDismiss && (
          <button onClick={onDismiss} className="text-amber-400 hover:text-amber-600 transition-colors ml-1">
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
