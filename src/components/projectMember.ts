/**
 * projectMember.ts  —  GEM&CLAUDE PM Pro
 * Real Supabase users only. No MOCK_MEMBERS, no seedMembersIfEmpty.
 * Source of truth = authRoleId + authUserId từ AuthProvider.
 */

import {
  type RoleId, type Domain, type AuthorityLevel,
  ROLES, AUTHORITY_LEVEL, ROLE_DOMAIN,
  type UserContext, getRoleProjectScope,
} from './permissions';
import { applyDelegationsToCtx } from './delegation';

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface ProjectMember {
  userId:       string;
  userName:     string;
  email?:       string;
  projectId:    string;
  roles:        RoleId[];
  activeRoleId: RoleId;
  grantedExtras?: {
    extraDomains?:    Domain[];
    tempLevelBoost?:  AuthorityLevel;
    reason?:          string;
    expiresAt?:       string;
  };
  joinedAt:  string;
  updatedAt: string;
}

export interface ActiveMemberSnap {
  userId:       string;
  activeRoleId: RoleId;
}

// ─── LOCALSTORAGE HELPERS ─────────────────────────────────────────────────────

const memberKey  = (pid: string) => `gem_members_${pid}`;
const ACTIVE_KEY = 'gem_active_member';

export function loadMembers(projectId: string): ProjectMember[] {
  try { return JSON.parse(localStorage.getItem(memberKey(projectId)) || '[]'); }
  catch { return []; }
}

export function saveMembers(projectId: string, members: ProjectMember[]): void {
  localStorage.setItem(memberKey(projectId), JSON.stringify(members));
}

export function getActiveMemberSnap(): ActiveMemberSnap | null {
  try { return JSON.parse(localStorage.getItem(ACTIVE_KEY) || 'null'); }
  catch { return null; }
}

export function setActiveMemberSnap(snap: ActiveMemberSnap): void {
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(snap));
  localStorage.setItem('gem_user_role', snap.activeRoleId);
}

// ─── CTX BUILDERS ─────────────────────────────────────────────────────────────

export function buildCtxFromMember(member: ProjectMember): UserContext {
  const scope = getRoleProjectScope(member.activeRoleId as RoleId);
  let allowedProjectIds: string[] | null;
  if (scope === 'all') {
    allowedProjectIds = null;
  } else if (scope === 'assigned') {
    const stored = localStorage.getItem(`gem_member_projects_${member.userId}`);
    const list: string[] = stored ? JSON.parse(stored) : [member.projectId];
    if (!list.includes(member.projectId)) list.push(member.projectId);
    allowedProjectIds = list;
  } else {
    allowedProjectIds = [member.projectId];
  }
  const baseCtx: UserContext = {
    userId: member.userId, userName: member.userName,
    roleId: member.activeRoleId, projectId: member.projectId,
    allowedProjectIds, grantedExtras: member.grantedExtras,
  };
  return member.projectId ? applyDelegationsToCtx(member.projectId, baseCtx) : baseCtx;
}

export function buildMergedCtx(member: ProjectMember): UserContext {
  const maxLevel = member.roles.reduce((max, r) =>
    Math.max(max, AUTHORITY_LEVEL[r] || 1), 1) as AuthorityLevel;
  const allDomains = new Set<Domain>();
  member.roles.forEach(r => (ROLE_DOMAIN[r] || []).forEach(d => allDomains.add(d)));
  const primaryRoleId = member.roles.reduce((best, r) =>
    (AUTHORITY_LEVEL[r] || 1) >= (AUTHORITY_LEVEL[best] || 1) ? r : best, member.activeRoleId);
  return {
    userId: member.userId, userName: member.userName,
    roleId: primaryRoleId, projectId: member.projectId,
    grantedExtras: {
      ...member.grantedExtras,
      extraDomains: [...allDomains],
      tempLevelBoost: maxLevel,
    },
  };
}

// ─── MEMBER OPERATIONS ────────────────────────────────────────────────────────

export function getMember(projectId: string, userId: string): ProjectMember | undefined {
  return loadMembers(projectId).find(m => m.userId === userId);
}

export function upsertMember(projectId: string, member: ProjectMember): void {
  const members = loadMembers(projectId);
  const idx = members.findIndex(m => m.userId === member.userId);
  if (idx >= 0) members[idx] = member; else members.push(member);
  saveMembers(projectId, members);
}

export function addRoleToMember(projectId: string, userId: string, roleId: RoleId): void {
  const members = loadMembers(projectId);
  const m = members.find(m => m.userId === userId);
  if (!m || m.roles.includes(roleId)) return;
  m.roles = [...m.roles, roleId];
  m.updatedAt = new Date().toISOString();
  saveMembers(projectId, members);
}

export function removeRoleFromMember(projectId: string, userId: string, roleId: RoleId): boolean {
  const members = loadMembers(projectId);
  const m = members.find(m => m.userId === userId);
  if (!m || m.roles.length <= 1) return false;
  m.roles = m.roles.filter(r => r !== roleId);
  if (m.activeRoleId === roleId) m.activeRoleId = m.roles[0];
  m.updatedAt = new Date().toISOString();
  saveMembers(projectId, members);
  return true;
}

export function switchActiveRole(projectId: string, userId: string, roleId: RoleId): boolean {
  const members = loadMembers(projectId);
  const m = members.find(m => m.userId === userId);
  if (!m || !m.roles.includes(roleId)) return false;
  m.activeRoleId = roleId;
  m.updatedAt = new Date().toISOString();
  saveMembers(projectId, members);
  setActiveMemberSnap({ userId, activeRoleId: roleId });
  return true;
}

export function findFallbackRole(member: ProjectMember, requiredLevel: AuthorityLevel): RoleId | null {
  const capable = member.roles.filter(r => (AUTHORITY_LEVEL[r] || 1) >= requiredLevel);
  if (!capable.length) return null;
  return capable.reduce((best, r) =>
    (AUTHORITY_LEVEL[r] || 1) <= (AUTHORITY_LEVEL[best] || 1) ? r : best);
}

export function suggestRoleSwitch(member: ProjectMember, requiredLevel: AuthorityLevel):
  { canDo: boolean; suggestedRole: RoleId | null; message: string } {
  if ((AUTHORITY_LEVEL[member.activeRoleId] || 1) >= requiredLevel)
    return { canDo: true, suggestedRole: null, message: '' };
  const fallback = findFallbackRole(member, requiredLevel);
  if (fallback) return {
    canDo: false, suggestedRole: fallback,
    message: `Chuyển sang vai trò "${ROLES[fallback]?.label}" để thực hiện thao tác này.`,
  };
  return { canDo: false, suggestedRole: null, message: 'Bạn không có đủ quyền.' };
}

// ─── GET CURRENT MEMBER ───────────────────────────────────────────────────────
/**
 * getCurrentMember — source of truth = authRoleId + authUserId từ AuthProvider.
 * Không dùng MOCK_MEMBERS. Không dùng stale snap từ session cũ.
 */
export function getCurrentMember(
  projectId:   string,
  authRoleId?: string,
  authUserId?: string,
): ProjectMember {
  const resolvedRole = (authRoleId || localStorage.getItem('gem_user_role') || 'chi_huy_truong') as RoleId;

  if (authUserId) {
    // Tìm trong cache
    const cached = loadMembers(projectId).find(m => m.userId === authUserId);
    if (cached) {
      // Sync role từ AuthProvider (source of truth)
      if (!cached.roles.includes(resolvedRole)) cached.roles = [resolvedRole];
      cached.activeRoleId = resolvedRole;
      return cached;
    }
    // Chưa có cache → tạo mới từ Supabase profile
    const userName = (() => {
      try { return JSON.parse(localStorage.getItem('gem_auth_user') || '{}').full_name || ROLES[resolvedRole]?.label || resolvedRole; }
      catch { return ROLES[resolvedRole]?.label || resolvedRole; }
    })();
    const newMember: ProjectMember = {
      userId: authUserId, userName, projectId,
      roles: [resolvedRole], activeRoleId: resolvedRole,
      joinedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    upsertMember(projectId, newMember);
    return newMember;
  }

  // Fallback edge case (không có authUserId)
  return {
    userId: `user_${resolvedRole}`, userName: ROLES[resolvedRole]?.label || resolvedRole,
    projectId, roles: [resolvedRole], activeRoleId: resolvedRole,
    joinedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

export function getCurrentCtx(
  projectId:   string,
  authRoleId?: string,
  authUserId?: string,
): UserContext {
  return buildCtxFromMember(getCurrentMember(projectId, authRoleId, authUserId));
}

// ─── PROJECT ASSIGNMENT CACHE ─────────────────────────────────────────────────

export function assignMemberToProject(userId: string, projectId: string, _roleId: RoleId): boolean {
  try {
    const key = `gem_member_projects_${userId}`;
    const list: string[] = JSON.parse(localStorage.getItem(key) || '[]');
    if (!list.includes(projectId)) { list.push(projectId); localStorage.setItem(key, JSON.stringify(list)); }
    return true;
  } catch { return false; }
}

export function getMemberAssignedProjects(userId: string, fallbackProjectId: string): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(`gem_member_projects_${userId}`) || '[]') as string[];
    return list.length > 0 ? list : [fallbackProjectId];
  } catch { return [fallbackProjectId]; }
}
