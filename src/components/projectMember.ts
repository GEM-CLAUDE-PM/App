/**
 * projectMember.ts  —  GEM&CLAUDE PM Pro
 * ══════════════════════════════════════════════════════════════════════════
 * ProjectMember Model v1.0
 *
 * Vấn đề cần giải quyết:
 *   1. 1 người có thể đảm nhiệm nhiều vai trò trên cùng 1 dự án
 *      (ví dụ: QS site kiêm Kế toán kho)
 *   2. Khi thực hiện nghiệp vụ, cần "active role" rõ ràng (không merge lẫn lộn)
 *   3. Fallback chain: nếu role cao nhất không thể act (vượt thẩm quyền),
 *      tự động nhắc chuyển sang role phù hợp
 *   4. Dev mode: chọn giả lập user/role → persist localStorage
 *
 * Data model:
 *   ProjectMember {
 *     userId, userName, projectId,
 *     roles: RoleId[]          — tất cả roles được gán
 *     activeRoleId: RoleId     — role đang hoạt động
 *     grantedExtras?: {...}    — boost tạm thời
 *   }
 *
 * Persisted in localStorage:
 *   gem_members_{projectId}  →  ProjectMember[]
 *   gem_active_member        →  { userId, activeRoleId }
 * ══════════════════════════════════════════════════════════════════════════
 */

import {
  type RoleId, type Domain, type AuthorityLevel,
  ROLES, AUTHORITY_LEVEL, ROLE_DOMAIN,
  type UserContext, getRoleProjectScope,
} from './permissions';
import { applyDelegationsToCtx } from './delegation';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface ProjectMember {
  userId:       string;
  userName:     string;
  email?:       string;
  projectId:    string;
  /** Danh sách tất cả role được gán cho member này trên project */
  roles:        RoleId[];
  /** Role đang active để thực hiện nghiệp vụ */
  activeRoleId: RoleId;
  /** Extra permissions tạm thời (delegation, cover, etc.) */
  grantedExtras?: {
    extraDomains?:    Domain[];
    tempLevelBoost?:  AuthorityLevel;
    reason?:          string;
    expiresAt?:       string; // ISO date
  };
  /** Metadata */
  joinedAt:  string;
  updatedAt: string;
}

/** Snapshot nhẹ lưu vào gem_active_member */
interface ActiveMemberSnap {
  userId:       string;
  activeRoleId: RoleId;
}

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const MEMBER_KEY = (projectId: string) => `gem_members_${projectId}`;
const ACTIVE_KEY = 'gem_active_member';

export function loadMembers(projectId: string): ProjectMember[] {
  try {
    return JSON.parse(localStorage.getItem(MEMBER_KEY(projectId)) || '[]');
  } catch { return []; }
}

export function saveMembers(projectId: string, members: ProjectMember[]): void {
  localStorage.setItem(MEMBER_KEY(projectId), JSON.stringify(members));
}

export function getActiveMemberSnap(): ActiveMemberSnap | null {
  try {
    return JSON.parse(localStorage.getItem(ACTIVE_KEY) || 'null');
  } catch { return null; }
}

export function setActiveMemberSnap(snap: ActiveMemberSnap): void {
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(snap));
  // Backward-compat: cũng update gem_user_role cho các component cũ đọc trực tiếp
  localStorage.setItem('gem_user_role', snap.activeRoleId);
}

// ─────────────────────────────────────────────────────────────────────────────
// SEED DATA — mock members cho dev mode
// ─────────────────────────────────────────────────────────────────────────────

// ─── MOCK_MEMBERS — đủ 24 roles, mỗi user 1 role chính ───────────────────────
// Seed members cho local project data (db.ts localStorage)
export const MOCK_MEMBERS: Omit<ProjectMember, 'projectId' | 'joinedAt' | 'updatedAt'>[] = [
  // L5
  { userId:'u1',  userName:'Trần Văn Bình',       email:'gdda@villaphat.vn',       roles:['giam_doc'],       activeRoleId:'giam_doc'       },
  // L4
  { userId:'u2',  userName:'Nguyễn Thành Nam',    email:'pm@villaphat.vn',         roles:['pm'],             activeRoleId:'pm'             },
  { userId:'u3',  userName:'Nguyễn Thu Hà',       email:'ketoan@villaphat.vn',     roles:['ke_toan_truong'], activeRoleId:'ke_toan_truong' },
  // L3 HO
  { userId:'u4',  userName:'Lê Minh Tuấn',        email:'truongqs@villaphat.vn',   roles:['truong_qs'],      activeRoleId:'truong_qs'      },
  { userId:'u5',  userName:'Phạm Thị Thảo',       email:'truongqaqc@villaphat.vn', roles:['truong_qaqc'],    activeRoleId:'truong_qaqc'    },
  { userId:'u6',  userName:'Lê Văn Hải',          email:'trunghse@villaphat.vn',   roles:['truong_hse'],     activeRoleId:'truong_hse'     },
  { userId:'u6b', userName:'Nguyễn Thị Lan',      email:'hrnv@villaphat.vn',       roles:['hr_truong'],      activeRoleId:'hr_truong'      },
  // L3 Site
  { userId:'u7',  userName:'Nguyễn Văn Anh',      email:'cht@villaphat.vn',        roles:['chi_huy_truong'], activeRoleId:'chi_huy_truong' },
  { userId:'u8',  userName:'Trần Hữu Lộc',        email:'chp@villaphat.vn',        roles:['chi_huy_pho'],    activeRoleId:'chi_huy_pho'    },
  // L2
  { userId:'u9',  userName:'Hoàng Việt Hùng',     email:'gsat@villaphat.vn',       roles:['ks_giam_sat'],    activeRoleId:'ks_giam_sat'    },
  { userId:'u9b', userName:'Phạm Quang Minh',     email:'qs01@villaphat.vn',       roles:['qs_site'],        activeRoleId:'qs_site'        },
  { userId:'u9c', userName:'Trần Thị Bích',       email:'qaqc01@villaphat.vn',     roles:['qaqc_site'],      activeRoleId:'qaqc_site'      },
  { userId:'u9d', userName:'Ngô Thanh Sơn',       email:'hse01@villaphat.vn',      roles:['hse_site'],       activeRoleId:'hse_site'       },
  { userId:'u9e', userName:'Lê Thị Mai',          email:'ktsite@villaphat.vn',     roles:['ke_toan_site'],   activeRoleId:'ke_toan_site'   },
  { userId:'u9f', userName:'Đinh Văn Khoa',       email:'ktkho@villaphat.vn',      roles:['ke_toan_kho'],    activeRoleId:'ke_toan_kho'    },
  { userId:'u9g', userName:'Nguyễn Thị Hoa',      email:'hrsite@villaphat.vn',     roles:['hr_site'],        activeRoleId:'hr_site'        },
  // L1
  { userId:'u10', userName:'Trần Quốc Tuấn',      email:'thukho@villaphat.vn',     roles:['thu_kho'],        activeRoleId:'thu_kho'        },
  { userId:'u11', userName:'Nguyễn Phương Linh',  email:'thuky@villaphat.vn',      roles:['thu_ky_site'],    activeRoleId:'thu_ky_site'    },
  { userId:'u12', userName:'Lê Văn Toàn',         email:'op01@villaphat.vn',       roles:['operator'],       activeRoleId:'operator'       },
  { userId:'u13', userName:'Phạm Văn Đức',        email:'todoi@villaphat.vn',      roles:['to_doi'],         activeRoleId:'to_doi'         },
  { userId:'u14', userName:'Trịnh Công Sơn',      email:'ktvien@villaphat.vn',     roles:['ky_thuat_vien'],  activeRoleId:'ky_thuat_vien'  },
];

/** Seed members cho project nếu chưa có */
export function seedMembersIfEmpty(projectId: string): ProjectMember[] {
  const existing = loadMembers(projectId);
  if (existing.length > 0) {
    // Đảm bảo gem_member_projects đã được gán (có thể chưa nếu seed từ session cũ)
    _ensureMemberProjectsAssigned(projectId, existing);
    return existing;
  }

  const now = new Date().toISOString();
  const members: ProjectMember[] = MOCK_MEMBERS.map(m => ({
    ...m,
    projectId,
    joinedAt:  now,
    updatedAt: now,
  }));
  saveMembers(projectId, members);
  // Gán ngay sau khi seed
  _ensureMemberProjectsAssigned(projectId, members);
  return members;
}

/** Internal: đảm bảo mỗi member có gem_member_projects_{userId} đúng */
function _ensureMemberProjectsAssigned(projectId: string, members: ProjectMember[]): void {
  for (const m of members) {
    const scope = getRoleProjectScope(m.activeRoleId as RoleId);
    if (scope === 'all') continue; // L4+ không cần
    const key    = `gem_member_projects_${m.userId}`;
    const stored = localStorage.getItem(key);
    const list: string[] = stored ? JSON.parse(stored) : [];
    if (!list.includes(projectId)) {
      list.push(projectId);
      localStorage.setItem(key, JSON.stringify(list));
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CTX BUILDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * buildCtxFromMember — tạo UserContext từ member + activeRoleId
 *
 * Nếu member có nhiều role, chỉ dùng activeRoleId cho level/domain.
 * grantedExtras được giữ nguyên (delegation, cover, etc.)
 */
export function buildCtxFromMember(member: ProjectMember): UserContext {
  const scope = getRoleProjectScope(member.activeRoleId as RoleId);

  // allowedProjectIds:
  //   L4+ → null (không giới hạn, filterProjectsByScope sẽ trả về tất cả)
  //   L3  → danh sách project được gán (lấy từ tất cả member records của userId này)
  //   L1-L2 → chỉ đúng projectId này
  let allowedProjectIds: string[] | null;
  if (scope === 'all') {
    allowedProjectIds = null; // không giới hạn
  } else if (scope === 'assigned') {
    // L3: tổng hợp tất cả projectId user này được gán từ mọi project
    // (trong dev mode, đọc từ gem_member_projects_{userId})
    const stored = localStorage.getItem(`gem_member_projects_${member.userId}`);
    const assignedProjects: string[] = stored ? JSON.parse(stored) : [member.projectId];
    // Đảm bảo projectId hiện tại luôn có
    if (!assignedProjects.includes(member.projectId)) assignedProjects.push(member.projectId);
    allowedProjectIds = assignedProjects;
  } else {
    // L1-L2: single project only
    allowedProjectIds = [member.projectId];
  }

  const baseCtx: UserContext = {
    userId:            member.userId,
    userName:          member.userName,
    roleId:            member.activeRoleId,
    projectId:         member.projectId,
    allowedProjectIds,
    grantedExtras:     member.grantedExtras,
  };

  // G4 fix: apply active delegations → boost level/domain nếu user đang nhận ủy quyền
  // Chỉ apply khi có projectId (portfolio view không có projectId cụ thể)
  return member.projectId
    ? applyDelegationsToCtx(member.projectId, baseCtx)
    : baseCtx;
}

/**
 * buildMergedCtx — tạo UserContext hợp nhất TẤT CẢ roles của member
 *
 * Dùng cho màn hình tổng quan — user thấy tất cả doc thuộc phạm vi
 * của mọi role họ có. KHÔNG dùng cho approval (dễ nhầm lẫn thẩm quyền).
 */
export function buildMergedCtx(member: ProjectMember): UserContext {
  // Level = max của tất cả roles
  const maxLevel = member.roles.reduce((max, r) => {
    return Math.max(max, AUTHORITY_LEVEL[r] || 1);
  }, 1) as AuthorityLevel;

  // Domains = union của tất cả roles
  const allDomains = new Set<Domain>();
  member.roles.forEach(r => (ROLE_DOMAIN[r] || []).forEach(d => allDomains.add(d)));

  // Role chính = highest level
  const primaryRoleId = member.roles.reduce((best, r) => {
    return (AUTHORITY_LEVEL[r] || 1) >= (AUTHORITY_LEVEL[best] || 1) ? r : best;
  }, member.activeRoleId);

  return {
    userId:    member.userId,
    userName:  member.userName,
    roleId:    primaryRoleId,
    projectId: member.projectId,
    grantedExtras: {
      ...member.grantedExtras,
      extraDomains:   [...allDomains],
      tempLevelBoost: maxLevel,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MEMBER OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

export function getMember(projectId: string, userId: string): ProjectMember | undefined {
  return loadMembers(projectId).find(m => m.userId === userId);
}

export function upsertMember(projectId: string, member: ProjectMember): void {
  const members = loadMembers(projectId);
  const idx = members.findIndex(m => m.userId === member.userId);
  const updated = { ...member, updatedAt: new Date().toISOString() };
  if (idx >= 0) members[idx] = updated;
  else members.push(updated);
  saveMembers(projectId, members);
}

/** Gán thêm role cho member (nếu chưa có) */
export function addRoleToMember(projectId: string, userId: string, roleId: RoleId): void {
  const members = loadMembers(projectId);
  const m = members.find(m => m.userId === userId);
  if (!m) return;
  if (!m.roles.includes(roleId)) {
    m.roles = [...m.roles, roleId];
    m.updatedAt = new Date().toISOString();
    saveMembers(projectId, members);
  }
}

/** Bỏ role khỏi member (không được bỏ role duy nhất) */
export function removeRoleFromMember(projectId: string, userId: string, roleId: RoleId): boolean {
  const members = loadMembers(projectId);
  const m = members.find(m => m.userId === userId);
  if (!m || m.roles.length <= 1) return false; // không cho bỏ role cuối
  m.roles = m.roles.filter(r => r !== roleId);
  if (m.activeRoleId === roleId) m.activeRoleId = m.roles[0]; // fallback to first role
  m.updatedAt = new Date().toISOString();
  saveMembers(projectId, members);
  return true;
}

/** Đổi activeRole của member */
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

// ─────────────────────────────────────────────────────────────────────────────
// FALLBACK CHAIN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * findFallbackRole — nếu member không thể thực hiện action với activeRole,
 * tìm role khác trong roles[] của họ có thể làm được.
 *
 * Ưu tiên role có level cao nhất mà vẫn có domain phù hợp.
 *
 * @param member     Member hiện tại
 * @param needLevel  Mức level tối thiểu cần thiết
 * @param needDomain Domain cần có (nếu có)
 * @returns RoleId phù hợp hoặc null nếu không có
 */
export function findFallbackRole(
  member:      ProjectMember,
  needLevel:   number,
  needDomain?: Domain,
): RoleId | null {
  const candidates = member.roles
    .filter(r => r !== member.activeRoleId)
    .filter(r => (AUTHORITY_LEVEL[r] || 1) >= needLevel)
    .filter(r => !needDomain || (ROLE_DOMAIN[r] || []).includes(needDomain) || (ROLE_DOMAIN[r] || []).includes('cross'))
    .sort((a, b) => (AUTHORITY_LEVEL[b] || 1) - (AUTHORITY_LEVEL[a] || 1)); // highest first

  return candidates[0] || null;
}

/**
 * suggestRoleSwitch — trả về hint text để hiện cho user
 * khi họ không đủ quyền với active role hiện tại
 */
export function suggestRoleSwitch(
  member:      ProjectMember,
  needLevel:   number,
  needDomain?: Domain,
): { canSwitch: boolean; targetRole?: RoleId; message: string } {
  const fallback = findFallbackRole(member, needLevel, needDomain);
  if (!fallback) {
    return {
      canSwitch: false,
      message:   `Bạn không có đủ thẩm quyền (cần level ${needLevel}${needDomain ? ` + domain ${needDomain}` : ''}).`,
    };
  }
  const roleLabel = ROLES[fallback]?.label || fallback;
  return {
    canSwitch:  true,
    targetRole: fallback,
    message:    `Chuyển sang vai trò "${roleLabel}" để thực hiện thao tác này?`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CURRENT USER RESOLUTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getCurrentMember — đọc member đang active từ localStorage
 *
 * Thứ tự ưu tiên:
 *   1. gem_active_member snap → tìm trong gem_members_{projectId}
 *   2. gem_user_role (backward-compat) → tìm member có activeRoleId đó
 *   3. Fallback: tạo anonymous member từ gem_user_role
 */
export function getCurrentMember(projectId: string, authRoleId?: string): ProjectMember {
  const members = seedMembersIfEmpty(projectId);
  const snap    = getActiveMemberSnap();

  if (snap) {
    const m = members.find(m => m.userId === snap.userId);
    if (m) {
      // Sync activeRoleId từ snap (có thể đã đổi)
      if (m.roles.includes(snap.activeRoleId)) m.activeRoleId = snap.activeRoleId;
      return m;
    }
  }

  // Fallback: match by gem_user_role
  // authRoleId (AuthProvider source of truth) takes priority over stale localStorage
  const resolvedRole = (authRoleId || localStorage.getItem('gem_user_role') || 'chi_huy_truong') as RoleId;
  const byRole = members.find(m => m.activeRoleId === resolvedRole || m.roles.includes(resolvedRole));
  if (byRole) {
    if (byRole.roles.includes(resolvedRole)) byRole.activeRoleId = resolvedRole;
    return byRole;
  }

  // Ultimate fallback: anonymous member
  return {
    userId:       `user_${resolvedRole}`,
    userName:     ROLES[resolvedRole]?.label || resolvedRole,
    projectId,
    roles:        [resolvedRole],
    activeRoleId: resolvedRole,
    joinedAt:     new Date().toISOString(),
    updatedAt:    new Date().toISOString(),
  };
}

/** getCurrentCtx — shorthand: member → UserContext */
export function getCurrentCtx(projectId: string): UserContext {
  return buildCtxFromMember(getCurrentMember(projectId));
}

// ─────────────────────────────────────────────────────────────────────────────
// L3 MULTI-PROJECT ASSIGNMENT
// ─────────────────────────────────────────────────────────────────────────────

const MEMBER_PROJECTS_KEY = (userId: string) => `gem_member_projects_${userId}`;

/**
 * assignMemberToProject — gán L3 user vào thêm 1 project.
 * L4+ không cần gán (scope = all). L1-L2 chỉ được 1 project.
 */
export function assignMemberToProject(userId: string, projectId: string, roleId: RoleId): boolean {
  const scope = getRoleProjectScope(roleId);
  if (scope === 'all') return true;   // L4+ — không cần gán
  if (scope === 'single') return false; // L1-L2 — không cho assign thêm

  // L3 — append to list
  const stored = localStorage.getItem(MEMBER_PROJECTS_KEY(userId));
  const list: string[] = stored ? JSON.parse(stored) : [];
  if (!list.includes(projectId)) {
    list.push(projectId);
    localStorage.setItem(MEMBER_PROJECTS_KEY(userId), JSON.stringify(list));
  }
  return true;
}

/** Lấy danh sách projectId mà L3 user được gán */
export function getMemberAssignedProjects(userId: string, fallbackProjectId: string): string[] {
  const stored = localStorage.getItem(MEMBER_PROJECTS_KEY(userId));
  if (!stored) return [fallbackProjectId];
  const list = JSON.parse(stored) as string[];
  if (!list.includes(fallbackProjectId)) list.push(fallbackProjectId);
  return list;
}

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL SCOPE CTX — dùng khi chưa chọn project cụ thể
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getCurrentScopeCtx — tạo UserContext với scope đúng cho portfolio filter.
 *
 * Khác getCurrentCtx(projectId): hàm này dùng được khi chưa có projectId
 * (tức là user đang xem danh sách tất cả projects).
 *
 * Logic:
 *   - Đọc activeRoleId từ gem_active_member hoặc gem_user_role
 *   - Với L1-L2: chỉ cho thấy project được gán trong gem_member_projects_{userId}
 *   - Với L3:    thấy tất cả project trong gem_member_projects_{userId}
 *   - Với L4+:   allowedProjectIds = null → thấy tất cả
 */
export function getCurrentScopeCtx(): UserContext {
  const snap     = getActiveMemberSnap();
  const roleId   = (snap?.activeRoleId ||
    localStorage.getItem('gem_user_role') ||
    'chi_huy_truong') as RoleId;
  const userId   = snap?.userId || `user_${roleId}`;
  const userName = ROLES[roleId]?.label || roleId;
  const scope    = getRoleProjectScope(roleId);

  let allowedProjectIds: string[] | null;
  if (scope === 'all') {
    allowedProjectIds = null;
  } else {
    // Đọc tất cả projects user được gán (không cần fallback vì đang ở portfolio view)
    const stored = localStorage.getItem(`gem_member_projects_${userId}`);
    allowedProjectIds = stored ? JSON.parse(stored) : [];
  }

  return {
    userId,
    userName,
    roleId,
    allowedProjectIds,
  };
}

/**
 * autoAssignMemberOnSeed — khi seed project members, tự gán userId vào
 * gem_member_projects_{userId} để scope filter hoạt động đúng.
 * Gọi sau seedMembersIfEmpty().
 */
export function autoAssignMemberOnSeed(projectId: string): void {
  const members = loadMembers(projectId);
  for (const m of members) {
    const scope = getRoleProjectScope(m.activeRoleId as RoleId);
    // L4+ không cần gán (scope all)
    if (scope === 'all') continue;
    // L1-L2-L3: gán projectId vào danh sách của user
    const key   = `gem_member_projects_${m.userId}`;
    const stored = localStorage.getItem(key);
    const list: string[] = stored ? JSON.parse(stored) : [];
    if (!list.includes(projectId)) {
      list.push(projectId);
      localStorage.setItem(key, JSON.stringify(list));
    }
  }
}
