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
  const [showUserPick,  setShowUserPick]  = useState(false);

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

  const handleUserSwitch = (member: ProjectMember) => {
    setActiveMemberSnap({ userId: member.userId, activeRoleId: member.activeRoleId });
    setActiveMember(member);
    setShowUserPick(false);
    setShowDropdown(false);
    onChange(member);
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
              onUserSwitch={handleUserSwitch}
              showUserPick={showUserPick}
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
        onUserSwitch={handleUserSwitch}
        showUserPick={showUserPick}
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
  onUserSwitch:   (m: ProjectMember) => void;
  showUserPick:   boolean;
  setShowUserPick: (v: boolean) => void;
}

function MemberSwitcherPanel({
  members, activeMember, onRoleSwitch, onUserSwitch, showUserPick, setShowUserPick,
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
  );
}
