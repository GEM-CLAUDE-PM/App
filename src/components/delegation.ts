/**
 * delegation.ts  —  GEM&CLAUDE PM Pro  S6
 * ══════════════════════════════════════════════════════════════════════════
 * Delegation Engine — Ủy quyền tạm thời
 *
 * Use cases:
 *   • CHT đi công tác → ủy quyền CHPhó ký thay WAREHOUSE_EXIT
 *   • PM nghỉ phép → ủy quyền GĐ xử lý PAYMENT_REQUEST trong 3 ngày
 *   • Thủ kho bệnh → ủy quyền GS tạm thời quản lý kho
 *
 * Model:
 *   Delegation {
 *     id, projectId,
 *     fromUserId, fromRoleId,       — người ủy quyền
 *     toUserId,   toRoleId,         — người nhận ủy quyền
 *     docTypes?,                    — giới hạn loại chứng từ (null = tất cả)
 *     levelGrant,                   — level được cấp tạm
 *     domainGrant,                  — domain được cấp tạm
 *     reason,
 *     startAt, endAt,               — thời hạn
 *     status: 'active'|'expired'|'revoked'
 *   }
 *
 * Persisted: localStorage `gem_delegations_{projectId}`
 * ══════════════════════════════════════════════════════════════════════════
 */

import {
  type RoleId, type Domain, type AuthorityLevel,
  ROLES, AUTHORITY_LEVEL, ROLE_DOMAIN,
  type UserContext,
} from './permissions';
import { type DocType } from './permissions';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type DelegationStatus = 'active' | 'expired' | 'revoked';

export interface Delegation {
  id:          string;
  projectId:   string;

  fromUserId:  string;
  fromUserName:string;
  fromRoleId:  RoleId;

  toUserId:    string;
  toUserName:  string;
  toRoleId:    RoleId;

  /** Nếu null → ủy quyền toàn bộ docTypes trong domain */
  docTypes?:   DocType[];

  /** Level tạm được cấp cho toUser (thường = level của fromUser) */
  levelGrant:  AuthorityLevel;

  /** Domain tạm được cấp cho toUser */
  domainGrant: Domain[];

  reason:      string;
  note?:       string;

  startAt:     string;   // ISO
  endAt:       string;   // ISO

  status:      DelegationStatus;
  createdAt:   string;
  revokedAt?:  string;
  revokedBy?:  string;
}

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE
// ─────────────────────────────────────────────────────────────────────────────

const KEY = (projectId: string) => `gem_delegations_${projectId}`;

export function loadDelegations(projectId: string): Delegation[] {
  try { return JSON.parse(localStorage.getItem(KEY(projectId)) || '[]'); }
  catch { return []; }
}

function save(projectId: string, list: Delegation[]): void {
  localStorage.setItem(KEY(projectId), JSON.stringify(list));
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export function isDelegationActive(d: Delegation): boolean {
  if (d.status !== 'active') return false;
  const now = Date.now();
  return now >= new Date(d.startAt).getTime() && now <= new Date(d.endAt).getTime();
}

/** Tự động expire các delegation quá hạn */
export function syncExpiredDelegations(projectId: string): void {
  const list = loadDelegations(projectId);
  let changed = false;
  for (const d of list) {
    if (d.status === 'active' && Date.now() > new Date(d.endAt).getTime()) {
      d.status = 'expired';
      changed = true;
    }
  }
  if (changed) save(projectId, list);
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateDelegationInput {
  projectId:    string;
  fromUserId:   string;
  fromUserName: string;
  fromRoleId:   RoleId;
  toUserId:     string;
  toUserName:   string;
  toRoleId:     RoleId;
  docTypes?:    DocType[];
  reason:       string;
  note?:        string;
  /** Số ngày hiệu lực (default 7) */
  durationDays?: number;
  /** Hoặc chỉ định ngày kết thúc cụ thể */
  endAt?:        string;
}

export function createDelegation(input: CreateDelegationInput): {
  ok: boolean; data?: Delegation; error?: string;
} {
  // Validate
  if (input.fromUserId === input.toUserId) {
    return { ok: false, error: 'Không thể ủy quyền cho chính mình' };
  }
  const fromLevel = AUTHORITY_LEVEL[input.fromRoleId] || 1;
  const toLevel   = AUTHORITY_LEVEL[input.toRoleId] || 1;
  if (fromLevel < 2) {
    return { ok: false, error: 'Level 1 không được phép ủy quyền' };
  }

  // Không cho ủy quyền lên người có level cao hơn (sẽ không có tác dụng)
  // Nhưng cho phép ủy quyền ngang hoặc xuống dưới
  const levelGrant = Math.min(fromLevel, fromLevel) as AuthorityLevel; // cấp level của người ủy quyền
  const domainGrant = ROLE_DOMAIN[input.fromRoleId] || [];

  const now   = new Date();
  const endAt = input.endAt
    ? input.endAt
    : new Date(now.getTime() + (input.durationDays ?? 7) * 86400000).toISOString();

  // Kiểm tra chồng chéo delegation đang active
  const existing = loadDelegations(input.projectId);
  const overlap = existing.find(d =>
    isDelegationActive(d) &&
    d.toUserId === input.toUserId &&
    d.fromRoleId === input.fromRoleId
  );
  if (overlap) {
    return {
      ok: false,
      error: `${input.toUserName} đã đang được ủy quyền vai trò ${ROLES[input.fromRoleId]?.label} (đến ${new Date(overlap.endAt).toLocaleDateString('vi-VN')})`,
    };
  }

  const delegation: Delegation = {
    id:           `del_${Date.now()}`,
    projectId:    input.projectId,
    fromUserId:   input.fromUserId,
    fromUserName: input.fromUserName,
    fromRoleId:   input.fromRoleId,
    toUserId:     input.toUserId,
    toUserName:   input.toUserName,
    toRoleId:     input.toRoleId,
    docTypes:     input.docTypes,
    levelGrant:   levelGrant as AuthorityLevel,
    domainGrant,
    reason:       input.reason,
    note:         input.note,
    startAt:      now.toISOString(),
    endAt,
    status:       'active',
    createdAt:    now.toISOString(),
  };

  existing.push(delegation);
  save(input.projectId, existing);
  return { ok: true, data: delegation };
}

export function revokeDelegation(
  projectId: string, delegationId: string, revokedBy: string,
): boolean {
  const list = loadDelegations(projectId);
  const d = list.find(d => d.id === delegationId);
  if (!d || d.status !== 'active') return false;
  d.status    = 'revoked';
  d.revokedAt = new Date().toISOString();
  d.revokedBy = revokedBy;
  save(projectId, list);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERY
// ─────────────────────────────────────────────────────────────────────────────

/** Lấy tất cả delegation đang active mà userId là người nhận */
export function getActiveDelegationsForUser(
  projectId: string, userId: string,
): Delegation[] {
  syncExpiredDelegations(projectId);
  return loadDelegations(projectId).filter(
    d => isDelegationActive(d) && d.toUserId === userId,
  );
}

/** Lấy tất cả delegation đang active mà userId là người ủy quyền */
export function getDelegationsFromUser(
  projectId: string, userId: string,
): Delegation[] {
  syncExpiredDelegations(projectId);
  return loadDelegations(projectId).filter(
    d => isDelegationActive(d) && d.fromUserId === userId,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CTX ENHANCEMENT — áp delegation vào UserContext
// ─────────────────────────────────────────────────────────────────────────────

/**
 * applyDelegationsToCtx — merge các delegation đang active vào UserContext.
 *
 * Nếu user đang nhận ủy quyền, boost level + domain của họ theo delegation.
 * Nếu user ủy quyền đi, không thay đổi ctx (họ vẫn có quyền gốc).
 *
 * Kết quả: ctx mới với grantedExtras đã merge tất cả active delegations.
 */
export function applyDelegationsToCtx(
  projectId: string,
  ctx: UserContext,
): UserContext {
  const delegations = getActiveDelegationsForUser(projectId, ctx.userId);
  if (delegations.length === 0) return ctx;

  // Merge tất cả delegation: lấy level cao nhất + union domains
  let maxLevel = AUTHORITY_LEVEL[ctx.roleId] || 1;
  const extraDomains = new Set<Domain>(ctx.grantedExtras?.extraDomains || []);
  const reasons: string[] = [];

  for (const d of delegations) {
    maxLevel = Math.max(maxLevel, d.levelGrant) as AuthorityLevel;
    d.domainGrant.forEach(dm => extraDomains.add(dm));
    reasons.push(`[Ủy quyền từ ${d.fromUserName} — ${d.reason}]`);
  }

  return {
    ...ctx,
    grantedExtras: {
      ...ctx.grantedExtras,
      tempLevelBoost: maxLevel as AuthorityLevel,
      extraDomains:   [...extraDomains],
      reason:         reasons.join('; '),
      // Lấy expiresAt gần nhất (delegation hết hạn sớm nhất)
      expiresAt: delegations
        .map(d => d.endAt)
        .sort()[0],
    },
  };
}

/**
 * canActWithDelegation — kiểm tra user có thể act trên 1 docType
 * nhờ delegation không (kể cả delegation theo docType cụ thể).
 */
export function canActWithDelegation(
  projectId: string,
  userId:    string,
  docType:   DocType,
): Delegation | null {
  const delegations = getActiveDelegationsForUser(projectId, userId);
  for (const d of delegations) {
    // Nếu delegation không giới hạn docTypes → có thể act
    if (!d.docTypes || d.docTypes.length === 0) return d;
    // Nếu có giới hạn docTypes → check
    if (d.docTypes.includes(docType)) return d;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

export function getDelegationSummary(projectId: string): {
  active:  Delegation[];
  expired: Delegation[];
  revoked: Delegation[];
  expiringSoon: Delegation[]; // trong 24h tới
} {
  syncExpiredDelegations(projectId);
  const list    = loadDelegations(projectId);
  const now     = Date.now();
  const soon    = now + 24 * 3600 * 1000;

  return {
    active:       list.filter(d => isDelegationActive(d)),
    expired:      list.filter(d => d.status === 'expired'),
    revoked:      list.filter(d => d.status === 'revoked'),
    expiringSoon: list.filter(d =>
      isDelegationActive(d) && new Date(d.endAt).getTime() <= soon
    ),
  };
}
