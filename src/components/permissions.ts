// permissions.ts — GEM&CLAUDE PM Pro
// Scope, UserContext, permission functions
// Re-exports roles.ts + workflows.ts để backward compatible

export * from './roles';
export * from './workflows';

// ── Local imports for use within this file ───────────────────────────────────
import {
  AUTHORITY_LEVEL, ROLE_DOMAIN, ROLES, TAB_PERMISSIONS,
  DEFAULT_THRESHOLDS, DENIED_BEHAVIOR,
  type AuthorityLevel, type RoleId, type Domain,
  type DeniedBehavior, type ActionType, type DocType, type ApprovalStep,
  type ApprovalThresholds, type WorkflowDefinition,
} from './roles';
import { WORKFLOWS } from './workflows';

export type ProjectScope = 'all' | 'assigned' | 'single';

export const ROLE_PROJECT_SCOPE: Record<string, ProjectScope> = {
  // L5 — full portfolio
  admin:          'all',
  giam_doc:       'all',
  // L4 — full portfolio
  ke_toan_truong: 'all',
  pm:             'all',
  // L3 — assigned projects (có thể nhiều nhưng phải được gán)
  chi_huy_truong: 'assigned',
  chi_huy_pho:    'assigned',
  truong_qs:      'assigned',
  truong_qaqc:    'assigned',
  truong_hse:     'assigned',
  // L2 — single project only
  qs_site:        'single',
  qaqc_site:      'single',
  ks_giam_sat:    'single',
  hse_site:       'single',
  ke_toan_site:   'single',
  ke_toan_kho:    'single',
  // L1 — single project only
  thu_kho:        'single',
  thu_ky_site:    'single',
  thu_ky_ho:      'single',
};

export interface UserContext {
  userId:   string;
  userName?: string;
  roleId:   RoleId;
  /** projectId của context hiện tại (project đang xem) */
  projectId?: string;
  /**
   * allowedProjectIds — danh sách projectId user được phép truy cập.
   *  • undefined / null  → dùng ROLE_PROJECT_SCOPE để suy ra
   *  • []                → scope = 'all' (không giới hạn, dùng cho L4+)
   *  • ['p1','p2',...]   → chỉ được xem các project này
   */
  allowedProjectIds?: string[] | null;
  grantedExtras?: {
    extraDomains?:    Domain[];
    tempLevelBoost?:  AuthorityLevel;
    reason?:          string;
    expiresAt?:       string;
  };
}

// ─────────────────────────────────────────────────
// PROJECT SCOPE HELPERS
// ─────────────────────────────────────────────────

/** Lấy scope policy của role */
export function getRoleProjectScope(roleId: RoleId): ProjectScope {
  return ROLE_PROJECT_SCOPE[roleId] || 'single';
}

/**
 * canAccessProject — kiểm tra user có được xem projectId không.
 *
 *  L4+: luôn true
 *  L3:  true nếu projectId nằm trong allowedProjectIds (hoặc chưa set → mặc định true trong dev)
 *  L1-L2: true chỉ khi projectId === ctx.projectId (gán đúng 1 project)
 */
export function canAccessProject(ctx: UserContext, projectId: string): boolean {
  const scope = getRoleProjectScope(ctx.roleId as RoleId);

  // L4+ — không giới hạn
  if (scope === 'all') return true;

  // null → unscoped L4+ (phòng hờ)
  if (ctx.allowedProjectIds === null || ctx.allowedProjectIds === undefined) return true;

  // [] → chưa được gán project nào → không có quyền
  if (ctx.allowedProjectIds.length === 0) return false;

  return ctx.allowedProjectIds.includes(projectId);
}

/**
 * filterProjectsByScope — lọc danh sách project theo quyền của user.
 * Dùng để filter portfolio list trước khi render.
 */
export function filterProjectsByScope(
  ctx:      UserContext,
  projects: Array<{ id: string }>,
): Array<{ id: string }> {
  const scope = getRoleProjectScope(ctx.roleId as RoleId);

  // L4+ — không giới hạn
  if (scope === 'all') return projects;

  // null → L4+ unscoped (phòng hờ)
  if (ctx.allowedProjectIds === null || ctx.allowedProjectIds === undefined) return projects;

  // [] → chưa được gán → không thấy gì
  // [...] → chỉ thấy project trong danh sách
  return projects.filter(p => (ctx.allowedProjectIds as string[]).includes(p.id));
}

export function getEffectiveLevel(ctx: UserContext): AuthorityLevel {
  const base  = AUTHORITY_LEVEL[ctx.roleId] || 1;
  const boost = ctx.grantedExtras?.tempLevelBoost;
  if (boost && boost <= 4) return Math.max(base, boost) as AuthorityLevel;
  return base;
}

export function getEffectiveDomains(ctx: UserContext): Domain[] {
  const base  = ROLE_DOMAIN[ctx.roleId] || [];
  const extra = ctx.grantedExtras?.extraDomains || [];
  return [...new Set([...base, ...extra])];
}

// ─────────────────────────────────────────────────
// TAB ACCESS
// ─────────────────────────────────────────────────

export function getTabAccess(ctx: UserContext, tabId: string): 'full'|'readonly'|'hidden' {
  const tabPerm = TAB_PERMISSIONS.find(t => t.id === tabId);
  if (!tabPerm) return 'hidden';
  const level   = getEffectiveLevel(ctx);
  const domains = getEffectiveDomains(ctx);
  if (level < tabPerm.minLevel) return 'hidden';
  const hasDomain = domains.some(d => tabPerm.domains.includes(d));
  if (hasDomain) {
    if (tabPerm.readOnlyDomains) {
      const isReadOnly = domains.every(d =>
        tabPerm.readOnlyDomains!.includes(d) || !tabPerm.domains.includes(d)
      );
      if (isReadOnly && !domains.includes('cross')) return 'readonly';
    }
    return 'full';
  }
  if (level >= tabPerm.crossDomainLevel) return 'readonly';
  return 'hidden';
}

export function getUserTabs(ctx: UserContext): Array<{id:string; access:'full'|'readonly'}> {
  return TAB_PERMISSIONS
    .map(t => ({id:t.id, access:getTabAccess(ctx, t.id)}))
    .filter(t => t.access !== 'hidden') as Array<{id:string; access:'full'|'readonly'}>;
}

// ─────────────────────────────────────────────────
// ACTION PERMISSION
// ─────────────────────────────────────────────────

function fmtVND(n: number): string {
  if (n >= 1_000_000_000) return `${(n/1_000_000_000).toFixed(1)} tỷ`;
  if (n >= 1_000_000)     return `${(n/1_000_000).toFixed(0)} triệu`;
  return n.toLocaleString('vi-VN') + 'đ';
}

export function canPerformAction(
  ctx: UserContext, action: ActionType,
  opts?: {docOwnerId?: string; amount?: number; thresholds?: ApprovalThresholds},
): {allowed: boolean; behavior: DeniedBehavior; reason?: string} {
  const level   = getEffectiveLevel(ctx);
  const domains = getEffectiveDomains(ctx);
  const denied  = (r?: string) => ({allowed:false, behavior:DENIED_BEHAVIOR[action], reason:r});

  switch (action) {
    case 'VIEW_FINANCE_AMOUNT':
      if (domains.includes('finance') || level >= 4) return {allowed:true, behavior:'hidden'};
      return denied('Chỉ Kế toán và cấp quản lý mới xem được số tiền thực');
    case 'CREATE': return {allowed:true, behavior:'hidden'};
    case 'EDIT_OWN':
      if (opts?.docOwnerId === ctx.userId) return {allowed:true, behavior:'hidden'};
      return denied('Chỉ người tạo mới được sửa');
    case 'EDIT_OTHER':
      if (level >= 3) return {allowed:true, behavior:'hidden'};
      return denied('Cần quyền Chỉ huy phó trở lên');
    case 'APPROVE_L3': {
      if (level < 3) return denied('Cần quyền Chỉ huy phó trở lên');
      const t = opts?.thresholds?.L3_max ?? DEFAULT_THRESHOLDS.L3_max;
      if (opts?.amount !== undefined && opts.amount > t) return denied(`Vượt ngưỡng ${fmtVND(t)} — cần PM`);
      return {allowed:true, behavior:'hidden'};
    }
    case 'APPROVE_L4': {
      if (level < 4) return denied('Cần quyền PM hoặc Kế toán trưởng');
      const t = opts?.thresholds?.L4_max ?? DEFAULT_THRESHOLDS.L4_max;
      if (opts?.amount !== undefined && opts.amount > t) return denied(`Vượt ngưỡng ${fmtVND(t)} — cần GĐ`);
      return {allowed:true, behavior:'hidden'};
    }
    case 'APPROVE_L5':
      if (level < 5) return denied('Cần quyền Giám đốc');
      return {allowed:true, behavior:'hidden'};
    case 'DELETE':
      if (level < 3) return denied('Cần quyền Chỉ huy phó trở lên');
      return {allowed:true, behavior:'hidden'};
    case 'CONFIG_THRESHOLDS':
      if (level < 4) return denied('Chỉ PM hoặc Admin');
      return {allowed:true, behavior:'hidden'};
    case 'MANAGE_USERS':
      if (level < 4) return denied('Chỉ Admin HO hoặc PM');
      return {allowed:true, behavior:'hidden'};
    default: return {allowed:true, behavior:'hidden'};
  }
}

// ─────────────────────────────────────────────────
// WORKFLOW STEP ENGINE v2.0
// ─────────────────────────────────────────────────

/**
 * Kiểm tra user có thể thực hiện 1 step cụ thể không.
 *
 * NGUYÊN TẮC:
 *   review   → KHÔNG check amount, chỉ check level + domain
 *   approve  → check level + domain + amount vs threshold
 *   r_a      → như approve (có threshold)
 *   create / upload / sign / notify → check level + domain
 */
export function canActOnStep(
  ctx: UserContext, step: ApprovalStep,
  amount?: number, thresholds?: ApprovalThresholds,
): {canAct: boolean; reason?: string} {
  const level   = getEffectiveLevel(ctx);
  const domains = getEffectiveDomains(ctx);

  if (step.externalSign) return {canAct:false, reason:'Ký bên ngoài app'};
  if (step.autoAdvance)  return {canAct:false, reason:'Tự động'};

  if (step.minLevel && level < step.minLevel)
    return {canAct:false, reason:`Cần level ${step.minLevel} trở lên`};

  if (step.requiredRole && !step.requiredRole.includes(ctx.roleId))
    return {canAct:false, reason:'Không đúng chức danh yêu cầu'};

  if (step.requiredDomain) {
    if (!domains.some(d => step.requiredDomain!.includes(d)))
      return {canAct:false, reason:`Cần domain: ${step.requiredDomain.join(' hoặc ')}`};
  }

  // REVIEW → không check amount
  if (step.actionType === 'review') return {canAct:true};

  // APPROVE / R_A → check threshold
  if (step.actionType === 'approve' || step.actionType === 'r_a') {
    if (amount !== undefined && step.thresholdKey) {
      const thresh = (thresholds ?? DEFAULT_THRESHOLDS) as any;
      const tv: number = thresh[step.thresholdKey]
        ?? (DEFAULT_THRESHOLDS as any)[step.thresholdKey]
        ?? Number.MAX_SAFE_INTEGER;

      if (step.skipIfAbove && amount > tv)
        return {canAct:false, reason:`Vượt ngưỡng ${fmtVND(tv)} — leo thang cấp trên`};
      if (step.skipIfBelow && amount <= tv)
        return {canAct:false, reason:`Trong hạn mức — cấp dưới đã duyệt`};
    }
    return {canAct:true};
  }

  return {canAct:true};
}

/**
 * Lấy step tiếp theo user có thể thực hiện trong workflow.
 * Dùng trong ApprovalQueue và engine.
 */
export function getNextActionableStep(
  ctx: UserContext, docType: DocType, currentStepId: string,
  amount?: number, thresholds?: ApprovalThresholds,
): ApprovalStep | null {
  const workflow = WORKFLOWS[docType];
  if (!workflow) return null;
  const steps = workflow.steps;
  const currentIdx = steps.findIndex(s => s.stepId === currentStepId);
  if (currentIdx < 0) return null;

  for (let i = currentIdx + 1; i < steps.length; i++) {
    const step = steps[i];
    if (step.externalSign || step.autoAdvance) continue;
    const {canAct} = canActOnStep(ctx, step, amount, thresholds);
    if (canAct) return step;
    // Nếu step là APPROVE bị skip (skipIfBelow) → tiếp tục tìm step kế
    if ((step.actionType === 'approve' || step.actionType === 'r_a')
        && step.skipIfBelow && amount !== undefined) {
      const thresh = (thresholds ?? DEFAULT_THRESHOLDS) as any;
      const tv: number = thresh[step.skipIfBelow] ?? (DEFAULT_THRESHOLDS as any)[step.skipIfBelow] ?? 0;
      if (amount <= tv) continue;
    }
    break;
  }
  return null;
}

// Backward compat alias
export const getAvailableApprovalSteps = getNextActionableStep;

// ─────────────────────────────────────────────────
// REACT HOOK
// ─────────────────────────────────────────────────

export function usePermissions(ctx: UserContext) {
  const level   = getEffectiveLevel(ctx);
  const domains = getEffectiveDomains(ctx);
  const role    = ROLES[ctx.roleId];
  return {
    ctx, level, domains, role,
    canSeeTab:    (tabId: string) => getTabAccess(ctx, tabId) !== 'hidden',
    tabAccess:    (tabId: string) => getTabAccess(ctx, tabId),
    visibleTabs:  () => getUserTabs(ctx),
    can:          (action: ActionType, opts?: Parameters<typeof canPerformAction>[2]) =>
                    canPerformAction(ctx, action, opts),
    isLeadership: level >= 3, isSenior: level >= 4, isAdmin: level >= 5,
    hasDomain:    (d: Domain) => domains.includes(d),
    canApproveL3: (amount?: number, t?: ApprovalThresholds) =>
                    canPerformAction(ctx, 'APPROVE_L3', {amount, thresholds:t}).allowed,
    canApproveL4: (amount?: number, t?: ApprovalThresholds) =>
                    canPerformAction(ctx, 'APPROVE_L4', {amount, thresholds:t}).allowed,
    canViewFinance:    domains.includes('finance') || level >= 4,
    canViewContracts:  level >= 3,
    canViewQS:         domains.includes('qs') || level >= 3,
    canViewAccounting: domains.includes('finance') || level >= 4,
    atLeast: (oldLevel: 'manager'|'admin') => {
      if (oldLevel === 'admin')   return level >= 5;
      if (oldLevel === 'manager') return level >= 3;
      return false;
    },
  };
}
export type PermissionHelper = ReturnType<typeof usePermissions>;

// ─────────────────────────────────────────────────
// LEGACY COMPAT
// ─────────────────────────────────────────────────

export const LEGACY_ROLE_MAP: Record<string, RoleId> = {
  'giam_doc':'giam_doc', 'ke_toan':'ke_toan_site',
  'chi_huy_truong':'chi_huy_truong', 'giam_sat':'ks_giam_sat',
  'manager':'pm', 'admin':'admin',
};

export function createLegacyContext(legacyRole: string, userId = 'current_user'): UserContext {
  const roleId = (LEGACY_ROLE_MAP[legacyRole] || 'ks_giam_sat') as RoleId;
  return {userId, roleId};
}
