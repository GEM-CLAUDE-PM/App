/**
 * GEM&CLAUDE PM Pro — Approval Engine v2.0
 * ─────────────────────────────────────────
 * S5 Engine Refactor:
 *   ✅ Tích hợp actionType từ permissions v2.0
 *   ✅ REVIEW step: không check hạn mức, không cần PIN, luôn thực hiện
 *   ✅ APPROVE / R_A step: check hạn mức, cần PIN
 *   ✅ skipIfBelow / skipIfAbove: engine tự advance qua step bị skip
 *   ✅ Auto-advance notify step
 *   ✅ generateDocNumber: đầy đủ 28 docType
 *   ✅ getApprovalQueue: dùng WORKFLOWS thay vì hardcode domain map
 *   ✅ canApproveDoc: dùng canActOnStep từ permissions
 */

import {
  DocType, WORKFLOWS, ApprovalStep, ApprovalThresholds, DEFAULT_THRESHOLDS,
  UserContext, getEffectiveLevel, getEffectiveDomains,
  getNextActionableStep, canActOnStep, ROLES,
} from './permissions';

// ─────────────────────────────────────────────────
// FORMAT HELPER
// ─────────────────────────────────────────────────

function fmtVND(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} tỷ`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(0)} triệu`;
  return n.toLocaleString('vi-VN') + 'đ';
}

// ─────────────────────────────────────────────────
// DOCUMENT STATUS
// ─────────────────────────────────────────────────

export type DocStatus =
  | 'DRAFT'             // Đang soạn
  | 'SUBMITTED'         // Đã nộp, chờ duyệt
  | 'IN_REVIEW'         // Đang xem xét (có review step pending)
  | 'APPROVED'          // Đã duyệt nội bộ đủ cấp
  | 'PENDING_EXTERNAL'  // Chờ ký bên ngoài
  | 'EXTERNALLY_SIGNED' // Đã có chữ ký bên ngoài
  | 'COMPLETED'         // Hoàn tất
  | 'REJECTED'          // Bị từ chối
  | 'RETURNED'          // Trả về để sửa
  | 'CANCELLED';        // Hủy

export type ApprovalAction = 'APPROVE' | 'REVIEW' | 'REJECT' | 'RETURN' | 'CANCEL';

// ─────────────────────────────────────────────────
// AUDIT LOG
// ─────────────────────────────────────────────────

export interface AuditEntry {
  id:          string;
  docId:       string;
  action:      ApprovalAction | 'CREATE' | 'SUBMIT' | 'EDIT' | 'UPLOAD_SIGNED' | 'VIEW' | 'AUTO_ADVANCE';
  stepId:      string;
  stepLabel:   string;
  userId:      string;
  userName:    string;
  userRole:    string;
  timestamp:   string;
  comment?:    string;
  pinVerified: boolean;
  metadata?:   Record<string, any>;
}

// ─────────────────────────────────────────────────
// DOCUMENT MODEL
// ─────────────────────────────────────────────────

export interface ApprovalDoc {
  id:            string;
  projectId:     string;
  docType:       DocType;
  docNumber:     string;
  title:         string;
  status:        DocStatus;
  currentStepId: string;
  amount?:       number;
  createdBy:     string;
  createdByName: string;
  createdAt:     string;
  updatedAt:     string;
  data:          Record<string, any>;
  auditLog:      AuditEntry[];
  signedFileUrl?: string;
  pdfUrl?:        string;
  thresholds?:    ApprovalThresholds;
}

// ─────────────────────────────────────────────────
// DB LAYER (localStorage → swap Supabase S8)
// ─────────────────────────────────────────────────

const DB_KEY = (projectId: string) => `gem_approvals_${projectId}`;

function loadDocs(projectId: string): ApprovalDoc[] {
  try { return JSON.parse(localStorage.getItem(DB_KEY(projectId)) || '[]'); }
  catch { return []; }
}

function saveDocs(projectId: string, docs: ApprovalDoc[]): void {
  try { localStorage.setItem(DB_KEY(projectId), JSON.stringify(docs)); }
  catch (e) { console.error('ApprovalEngine: saveDocs failed', e); }
}

// ─────────────────────────────────────────────────
// DOC NUMBER GENERATOR — đầy đủ 28+ docType
// ─────────────────────────────────────────────────

const DOC_PREFIX: Partial<Record<DocType, string>> = {
  MATERIAL_REQUEST:       'DXVT',
  WAREHOUSE_EXIT:         'PX',
  WAREHOUSE_ENTRY:        'PN',
  STOCK_TAKE:             'KK',
  VARIATION_ORDER:        'VO',
  ACCEPTANCE_INTERNAL:    'BBNT-NB',
  ACCEPTANCE_OWNER:       'BBNT-CDT',
  PAYMENT_REQUEST:        'YCTT',
  CONTRACT_AMENDMENT:     'PLHD',
  SUBCONTRACT_PAYMENT:    'TTPT',
  FINANCIAL_VOUCHER:      'CT',
  TIMESHEET:              'BC',
  OVERTIME_REQUEST:       'DXTC',
  PROCUREMENT:            'PO',
  MATERIAL_APPROVAL:      'DTVL',
  MATERIAL_INCOMING:      'NTVL',
  VENDOR_PREQUALIFICATION:'DGNCC',
  VENDOR_EVALUATION:      'DKDNNCC',
  NCR:                    'NCR',
  RFI:                    'RFI',
  INSPECTION_REQUEST:     'IR',
  ITP_MANAGEMENT:         'ITP',
  METHOD_STATEMENT:       'BPTC',
  DRAWING_REVISION:       'REV',
  QUALITY_AUDIT:          'AUDIT',
  TESTING_LAB:            'TN',
  HSE_INCIDENT:           'HSE',
  PERMIT_TO_WORK:         'PTW',
  TOOLBOX_MEETING:        'TBM',
  HSE_INSPECTION:         'HSEI',
  CAPA:                   'CAPA',
  LEAVE_REQUEST:          'DXNP',
  DISCIPLINE:             'KLLD',
  ACCEPTANCE:             'BBNT',
  PROCUREMENT_LEGACY:     'DXMS',
};

function generateDocNumber(projectId: string, docType: DocType): string {
  const prefix = DOC_PREFIX[docType] || 'DOC';
  const docs   = loadDocs(projectId).filter(d => d.docType === docType);
  const seq    = String(docs.length + 1).padStart(3, '0');
  const date   = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefix}-${date}-${seq}`;
}

// ─────────────────────────────────────────────────
// PIN VERIFICATION
// ─────────────────────────────────────────────────

const PIN_STORE_KEY = 'gem_user_pins';
const pinAttemptMap = new Map<string, { attempts: number; lockedUntil?: number }>();

export function verifyPin(userId: string, pin: string): {
  success: boolean; locked?: boolean; remainingAttempts?: number; lockMinutes?: number;
} {
  const MAX_ATTEMPTS  = 3;
  const LOCK_DURATION = 15 * 60 * 1000;

  const tracker = pinAttemptMap.get(userId) || { attempts: 0 };

  if (tracker.lockedUntil && Date.now() < tracker.lockedUntil) {
    return { success: false, locked: true, lockMinutes: Math.ceil((tracker.lockedUntil - Date.now()) / 60000) };
  }

  const storedPins: Record<string, string> = JSON.parse(localStorage.getItem(PIN_STORE_KEY) || '{}');
  const userPin = storedPins[userId] || (import.meta as any).env?.VITE_CONTRACT_PIN || '1234';

  if (pin !== userPin) {
    tracker.attempts += 1;
    if (tracker.attempts >= MAX_ATTEMPTS) {
      tracker.lockedUntil = Date.now() + LOCK_DURATION;
      tracker.attempts    = 0;
    }
    pinAttemptMap.set(userId, tracker);
    return { success: false, remainingAttempts: MAX_ATTEMPTS - tracker.attempts };
  }

  pinAttemptMap.delete(userId);
  return { success: true };
}

export function setUserPin(userId: string, newPin: string): void {
  const pins = JSON.parse(localStorage.getItem(PIN_STORE_KEY) || '{}');
  pins[userId] = newPin;
  localStorage.setItem(PIN_STORE_KEY, JSON.stringify(pins));
}

// ─────────────────────────────────────────────────
// ENGINE TYPES
// ─────────────────────────────────────────────────

export interface CreateDocInput {
  projectId:   string;
  docType:     DocType;
  title:       string;
  data:        Record<string, any>;
  amount?:     number;
  ctx:         UserContext;
  thresholds?: ApprovalThresholds;
}

export interface ProcessInput {
  projectId: string;
  docId:     string;
  action:    ApprovalAction;
  ctx:       UserContext;
  pin?:      string;
  comment?:  string;
}

export type EngineResult<T = void> =
  | { ok: true;  data: T }
  | { ok: false; error: string };

// ─────────────────────────────────────────────────
// STEP NAVIGATION HELPERS
// ─────────────────────────────────────────────────

/**
 * Lấy step hiện tại của doc
 */
function getCurrentStep(doc: ApprovalDoc): ApprovalStep | undefined {
  return WORKFLOWS[doc.docType]?.steps.find(s => s.stepId === doc.currentStepId);
}

/**
 * Tìm step tiếp theo thực sự cần thực hiện.
 * Tự động nhảy qua:
 *   - step bị skip theo threshold (skipIfBelow / skipIfAbove)
 *   - step notify / autoAdvance
 *   - step externalSign (chuyển sang PENDING_EXTERNAL)
 *
 * Returns null nếu không còn step nào → doc COMPLETED
 */
function findNextStep(
  doc: ApprovalDoc,
  fromStepId: string,
): { step: ApprovalStep; skippedTo: boolean } | null {
  const workflow = WORKFLOWS[doc.docType];
  if (!workflow) return null;
  const steps  = workflow.steps;
  const fromIdx = steps.findIndex(s => s.stepId === fromStepId);
  if (fromIdx < 0) return null;

  const thresh = (doc.thresholds ?? DEFAULT_THRESHOLDS) as any;

  for (let i = fromIdx + 1; i < steps.length; i++) {
    const step = steps[i];

    // Auto-advance / notify → không dừng ở đây, tiếp tục
    if (step.autoAdvance) continue;

    // External sign → dừng tại đây, status = PENDING_EXTERNAL
    if (step.externalSign) return { step, skippedTo: i > fromIdx + 1 };

    // Check skipIfBelow: step này chỉ khi amount > threshold
    if (step.skipIfBelow && doc.amount !== undefined) {
      const tv: number = thresh[step.skipIfBelow]
        ?? (DEFAULT_THRESHOLDS as any)[step.skipIfBelow] ?? 0;
      if (doc.amount <= tv) continue; // skip, tìm tiếp
    }

    // Check skipIfAbove: step này chỉ khi amount <= threshold
    if (step.skipIfAbove && doc.amount !== undefined) {
      const tv: number = thresh[step.skipIfAbove]
        ?? (DEFAULT_THRESHOLDS as any)[step.skipIfAbove] ?? Number.MAX_SAFE_INTEGER;
      if (doc.amount > tv) continue; // skip, tìm tiếp
    }

    return { step, skippedTo: i > fromIdx + 1 };
  }

  return null; // không còn step nào
}

/**
 * Tính status mới sau khi advance step
 */
function resolveNextStatus(doc: ApprovalDoc, nextStep: ApprovalStep | null): DocStatus {
  if (!nextStep) return 'COMPLETED';
  if (nextStep.externalSign) return 'PENDING_EXTERNAL';
  if (nextStep.autoAdvance)  return 'APPROVED';

  // Có next step bình thường
  const isLastStep = (() => {
    const workflow = WORKFLOWS[doc.docType];
    if (!workflow) return false;
    const steps = workflow.steps;
    const idx   = steps.findIndex(s => s.stepId === nextStep.stepId);
    // Check xem từ idx về cuối còn step thực nào không
    for (let i = idx + 1; i < steps.length; i++) {
      const s = steps[i];
      if (!s.autoAdvance && !s.externalSign) return false;
    }
    return true;
  })();

  if (nextStep.actionType === 'review') return 'IN_REVIEW';
  return isLastStep ? 'APPROVED' : 'IN_REVIEW';
}

// ─────────────────────────────────────────────────
// CORE ENGINE FUNCTIONS
// ─────────────────────────────────────────────────

/**
 * Tạo document mới ở trạng thái DRAFT
 */
export function createDocument(input: CreateDocInput): EngineResult<ApprovalDoc> {
  const workflow = WORKFLOWS[input.docType];
  if (!workflow) return { ok: false, error: 'Loại chứng từ không hợp lệ' };

  const level = getEffectiveLevel(input.ctx);
  if (level < workflow.createdBy.minLevel)
    return { ok: false, error: `Cần level ${workflow.createdBy.minLevel} trở lên để tạo loại chứng từ này` };

  const now = new Date().toISOString();
  const doc: ApprovalDoc = {
    id:            `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    projectId:     input.projectId,
    docType:       input.docType,
    docNumber:     generateDocNumber(input.projectId, input.docType),
    title:         input.title,
    status:        'DRAFT',
    currentStepId: workflow.steps[0].stepId,
    amount:        input.amount,
    createdBy:     input.ctx.userId,
    createdByName: ROLES[input.ctx.roleId]?.label || input.ctx.userId,
    createdAt:     now,
    updatedAt:     now,
    data:          input.data,
    auditLog:      [],
    thresholds:    input.thresholds,
  };

  doc.auditLog.push({
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, docId: doc.id,
    action: 'CREATE', stepId: doc.currentStepId,
    stepLabel: workflow.steps[0].label,
    userId: input.ctx.userId, userName: doc.createdByName,
    userRole: ROLES[input.ctx.roleId]?.label || '', timestamp: now, pinVerified: false,
  });

  const docs = loadDocs(input.projectId);
  docs.unshift(doc);
  saveDocs(input.projectId, docs);
  return { ok: true, data: doc };
}

/**
 * Submit document (DRAFT / RETURNED → SUBMITTED)
 */
export function submitDocument(
  projectId: string, docId: string, ctx: UserContext, comment?: string,
): EngineResult<ApprovalDoc> {
  const docs = loadDocs(projectId);
  const doc  = docs.find(d => d.id === docId);
  if (!doc) return { ok: false, error: 'Không tìm thấy chứng từ' };
  if (doc.createdBy !== ctx.userId) return { ok: false, error: 'Chỉ người tạo mới được submit' };
  if (doc.status !== 'DRAFT' && doc.status !== 'RETURNED')
    return { ok: false, error: `Không thể submit chứng từ ở trạng thái ${doc.status}` };

  const workflow = WORKFLOWS[doc.docType]!;
  const now = new Date().toISOString();
  doc.status    = 'SUBMITTED';
  doc.updatedAt = now;
  doc.auditLog.push({
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, docId: doc.id, action: 'SUBMIT',
    stepId: doc.currentStepId,
    stepLabel: workflow.steps.find(s => s.stepId === doc.currentStepId)?.label || doc.currentStepId,
    userId: ctx.userId, userName: ROLES[ctx.roleId]?.label || ctx.userId,
    userRole: ROLES[ctx.roleId]?.label || '', timestamp: now, comment, pinVerified: false,
  });

  saveDocs(projectId, docs);
  return { ok: true, data: doc };
}

/**
 * Xử lý APPROVE / REVIEW / REJECT / RETURN / CANCEL
 *
 * v2.0 Engine — REVIEW vs APPROVE:
 *   REVIEW step → không cần PIN, không check hạn mức → advance
 *   APPROVE / R_A step → cần PIN (nếu pinRequired), check hạn mức → advance
 */
export function processApproval(input: ProcessInput): EngineResult<ApprovalDoc> {
  const docs = loadDocs(input.projectId);
  const doc  = docs.find(d => d.id === input.docId);
  if (!doc) return { ok: false, error: 'Không tìm thấy chứng từ' };

  const workflow = WORKFLOWS[doc.docType];
  if (!workflow) return { ok: false, error: 'Workflow không hợp lệ' };

  const now      = new Date().toISOString();
  const currStep = getCurrentStep(doc);

  // ── APPROVE hoặc REVIEW ───────────────────────────────────────────────
  if (input.action === 'APPROVE' || input.action === 'REVIEW') {

    // 1. Kiểm tra quyền (dùng canActOnStep từ permissions v2.0)
    if (!currStep) return { ok: false, error: 'Bước hiện tại không hợp lệ' };

    const { canAct, reason } = canActOnStep(input.ctx, currStep, doc.amount, doc.thresholds);
    if (!canAct) return { ok: false, error: reason || 'Không có quyền thực hiện bước này' };

    // 2. REVIEW step: không cần PIN
    //    APPROVE / R_A step: cần PIN nếu pinRequired
    const needPin = currStep.pinRequired
      && (currStep.actionType === 'approve' || currStep.actionType === 'r_a');

    if (needPin) {
      if (!input.pin) return { ok: false, error: 'Bước này yêu cầu xác thực PIN' };
      const pinResult = verifyPin(input.ctx.userId, input.pin);
      if (!pinResult.success) {
        if (pinResult.locked) return { ok: false, error: `Tài khoản bị khóa ${pinResult.lockMinutes} phút` };
        return { ok: false, error: `PIN không đúng — còn ${pinResult.remainingAttempts} lần thử` };
      }
    }

    // 3. Tìm step tiếp theo (tự skip notify, skip bởi threshold)
    const nextInfo = findNextStep(doc, doc.currentStepId);
    const nextStep = nextInfo?.step ?? null;

    // 4. Advance
    const auditAction = currStep.actionType === 'review' ? 'REVIEW' : 'APPROVE';

    doc.auditLog.push({
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, docId: doc.id,
      action: auditAction, stepId: doc.currentStepId, stepLabel: currStep.label,
      userId: input.ctx.userId, userName: ROLES[input.ctx.roleId]?.label || input.ctx.userId,
      userRole: ROLES[input.ctx.roleId]?.label || '', timestamp: now,
      comment: input.comment, pinVerified: needPin && !!input.pin,
    });

    if (nextStep) {
      doc.currentStepId = nextStep.stepId;
      doc.status        = resolveNextStatus(doc, nextStep);
    } else {
      doc.status = 'COMPLETED';
    }

  // ── REJECT ────────────────────────────────────────────────────────────
  } else if (input.action === 'REJECT') {
    if (!currStep) return { ok: false, error: 'Bước hiện tại không hợp lệ' };
    const level = getEffectiveLevel(input.ctx);
    if (level < 3) return { ok: false, error: 'Cần quyền Chỉ huy phó trở lên để từ chối' };

    doc.status    = 'REJECTED';
    doc.auditLog.push({
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, docId: doc.id, action: 'REJECT',
      stepId: doc.currentStepId, stepLabel: currStep?.label || doc.currentStepId,
      userId: input.ctx.userId, userName: ROLES[input.ctx.roleId]?.label || input.ctx.userId,
      userRole: ROLES[input.ctx.roleId]?.label || '', timestamp: now,
      comment: input.comment, pinVerified: false,
    });

  // ── RETURN ────────────────────────────────────────────────────────────
  } else if (input.action === 'RETURN') {
    const level = getEffectiveLevel(input.ctx);
    if (level < 3) return { ok: false, error: 'Cần quyền Chỉ huy phó trở lên để trả về' };

    const firstStep = workflow.steps[0];
    doc.status        = 'RETURNED';
    doc.currentStepId = firstStep.stepId;
    doc.auditLog.push({
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, docId: doc.id, action: 'RETURN',
      stepId: firstStep.stepId, stepLabel: firstStep.label,
      userId: input.ctx.userId, userName: ROLES[input.ctx.roleId]?.label || input.ctx.userId,
      userRole: ROLES[input.ctx.roleId]?.label || '', timestamp: now,
      comment: input.comment, pinVerified: false,
    });

  // ── CANCEL ────────────────────────────────────────────────────────────
  } else if (input.action === 'CANCEL') {
    const level = getEffectiveLevel(input.ctx);
    if (level < 3) return { ok: false, error: 'Cần quyền Chỉ huy phó trở lên để hủy' };

    doc.status = 'CANCELLED';
    doc.auditLog.push({
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, docId: doc.id, action: 'CANCEL',
      stepId: doc.currentStepId, stepLabel: currStep?.label || doc.currentStepId,
      userId: input.ctx.userId, userName: ROLES[input.ctx.roleId]?.label || input.ctx.userId,
      userRole: ROLES[input.ctx.roleId]?.label || '', timestamp: now,
      comment: input.comment, pinVerified: false,
    });
  }

  doc.updatedAt = now;
  saveDocs(input.projectId, docs);
  return { ok: true, data: doc };
}

/**
 * Upload file đã ký bên ngoài
 */
export function uploadExternalSignature(
  projectId: string, docId: string, ctx: UserContext, fileUrl: string,
): EngineResult<ApprovalDoc> {
  const docs = loadDocs(projectId);
  const doc  = docs.find(d => d.id === docId);
  if (!doc) return { ok: false, error: 'Không tìm thấy chứng từ' };
  if (doc.status !== 'PENDING_EXTERNAL')
    return { ok: false, error: 'Chứng từ chưa ở trạng thái chờ ký bên ngoài' };

  const now = new Date().toISOString();
  doc.signedFileUrl = fileUrl;

  // Tìm step tiếp theo sau external sign
  const nextInfo = findNextStep(doc, doc.currentStepId);
  if (nextInfo) {
    doc.currentStepId = nextInfo.step.stepId;
    doc.status        = resolveNextStatus(doc, nextInfo.step);
  } else {
    doc.status = 'COMPLETED';
  }

  doc.updatedAt = now;
  doc.auditLog.push({
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, docId: doc.id, action: 'UPLOAD_SIGNED',
    stepId: doc.currentStepId, stepLabel: 'Upload bản đã ký',
    userId: ctx.userId, userName: ROLES[ctx.roleId]?.label || ctx.userId,
    userRole: ROLES[ctx.roleId]?.label || '', timestamp: now,
    pinVerified: false, metadata: { fileUrl },
  });

  saveDocs(projectId, docs);
  return { ok: true, data: doc };
}

// ─────────────────────────────────────────────────
// QUERY HELPERS
// ─────────────────────────────────────────────────

/**
 * Kiểm tra doc có thể được duyệt bởi ctx không.
 * v2.0: dùng canActOnStep thay vì hardcode level/domain check.
 */
export function canApproveDoc(doc: ApprovalDoc, ctx: UserContext): boolean {
  const workflow = WORKFLOWS[doc.docType];
  if (!workflow) return false;

  const currStep = workflow.steps.find(s => s.stepId === doc.currentStepId);
  if (!currStep) return false;
  if (currStep.externalSign || currStep.autoAdvance) return false;

  const { canAct } = canActOnStep(ctx, currStep, doc.amount, doc.thresholds);
  return canAct;
}

/**
 * Lấy approval queue — docs đang pending và ctx có quyền thực hiện step hiện tại
 */
export function getApprovalQueue(projectId: string, ctx: UserContext): ApprovalDoc[] {
  const docs    = loadDocs(projectId);
  const level   = getEffectiveLevel(ctx);
  const domains = getEffectiveDomains(ctx);

  return docs.filter(doc => {
    // Chỉ lấy docs đang pending
    if (!['SUBMITTED','IN_REVIEW','PENDING_EXTERNAL'].includes(doc.status)) return false;

    const workflow = WORKFLOWS[doc.docType];
    if (!workflow) return false;

    // L1 (thủ kho): chỉ thấy doc trong domain kho
    if (level <= 1) {
      const inDomain = domains.some(d => d === 'warehouse' || d === 'cross');
      if (!inDomain) return false;
    }

    // Kiểm tra có thể act trên step hiện tại không (bao gồm REVIEW)
    return canApproveDoc(doc, ctx);
  });
}

/**
 * Lấy docs mình tạo
 */
export function getMyDocs(projectId: string, ctx: UserContext): ApprovalDoc[] {
  return loadDocs(projectId).filter(d => d.createdBy === ctx.userId);
}

/**
 * Lấy toàn bộ docs — L3+ thấy hết
 */
export function getAllDocs(projectId: string, ctx: UserContext): ApprovalDoc[] {
  if (getEffectiveLevel(ctx) < 3) return getMyDocs(projectId, ctx);
  return loadDocs(projectId);
}

/**
 * Lấy docs theo loại
 */
export function getDocsByType(
  projectId: string, docType: DocType, status?: DocStatus,
): ApprovalDoc[] {
  return loadDocs(projectId).filter(d =>
    d.docType === docType && (!status || d.status === status)
  );
}

/**
 * Đếm pending cần duyệt — dùng cho badge
 */
export function getPendingCount(projectId: string, ctx: UserContext): number {
  return getApprovalQueue(projectId, ctx).length;
}

// ─────────────────────────────────────────────────
// STATUS DISPLAY
// ─────────────────────────────────────────────────

export const STATUS_CONFIG: Record<DocStatus, {
  label: string; color: string; bgColor: string; icon: string;
}> = {
  DRAFT:             { label:'Bản nháp',           color:'#64748b', bgColor:'#f1f5f9', icon:'📝' },
  SUBMITTED:         { label:'Chờ duyệt',           color:'#d97706', bgColor:'#fef3c7', icon:'⏳' },
  IN_REVIEW:         { label:'Đang xem xét',        color:'#2563eb', bgColor:'#dbeafe', icon:'👁️' },
  APPROVED:          { label:'Đã duyệt',            color:'#059669', bgColor:'#d1fae5', icon:'✅' },
  PENDING_EXTERNAL:  { label:'Chờ ký bên ngoài',    color:'#7c3aed', bgColor:'#ede9fe', icon:'🖊️' },
  EXTERNALLY_SIGNED: { label:'Đã có chữ ký ngoài',  color:'#0891b2', bgColor:'#cffafe', icon:'📋' },
  COMPLETED:         { label:'Hoàn tất',            color:'#1a8a7a', bgColor:'#ccfbf1', icon:'🏁' },
  REJECTED:          { label:'Từ chối',             color:'#dc2626', bgColor:'#fee2e2', icon:'❌' },
  RETURNED:          { label:'Trả về sửa',          color:'#ea580c', bgColor:'#ffedd5', icon:'↩️' },
  CANCELLED:         { label:'Đã hủy',              color:'#9ca3af', bgColor:'#f9fafb', icon:'🚫' },
};

export function getStatusConfig(status: DocStatus) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT;
}

export function getCurrentStepLabel(doc: ApprovalDoc): string {
  const workflow = WORKFLOWS[doc.docType];
  const step     = workflow?.steps.find(s => s.stepId === doc.currentStepId);
  return step?.label || doc.currentStepId;
}

export function getWorkflowProgress(doc: ApprovalDoc): number {
  const workflow = WORKFLOWS[doc.docType];
  if (!workflow) return 0;
  const currIdx = workflow.steps.findIndex(s => s.stepId === doc.currentStepId);
  if (currIdx < 0) return 0;
  return Math.round(((currIdx + 1) / workflow.steps.length) * 100);
}

/**
 * Trả về mô tả bước tiếp theo cần làm — dùng trong UI
 */
export function getNextActionHint(doc: ApprovalDoc, ctx: UserContext): string | null {
  const workflow = WORKFLOWS[doc.docType];
  if (!workflow) return null;
  const currStep = workflow.steps.find(s => s.stepId === doc.currentStepId);
  if (!currStep) return null;

  const { canAct } = canActOnStep(ctx, currStep, doc.amount, doc.thresholds);
  if (!canAct) return null;

  if (currStep.actionType === 'review') return `Review: ${currStep.label}`;
  if (currStep.actionType === 'approve') return `Duyệt: ${currStep.label}`;
  if (currStep.actionType === 'r_a') return `Review & Duyệt: ${currStep.label}`;
  return currStep.label;
}

// ─────────────────────────────────────────────────
// SEED HELPER — idempotent, từ legacy vouchers
// ─────────────────────────────────────────────────

export interface SeedVoucherInput {
  voucherId:    string;
  voucherCode:  string;
  docType:      DocType;
  title:        string;
  amount:       number;
  voucherData:  any;
  legacyStatus: 'approved'|'pending'|'draft'|'rejected';
}

export function seedApprovalDocs(projectId: string, vouchers: SeedVoucherInput[]): void {
  const existing     = loadDocs(projectId);
  const existingVIds = new Set(existing.map(d => d.data?.voucherId).filter(Boolean));
  const thuKhoCtx: UserContext    = { userId:'user_thu_kho',    roleId:'thu_kho' };
  const chiHuyPhoCtx: UserContext = { userId:'user_chi_huy_pho', roleId:'chi_huy_pho' };
  const now      = new Date().toISOString();
  const newDocs: ApprovalDoc[] = [];

  for (const v of vouchers) {
    if (existingVIds.has(v.voucherId)) continue;
    if (v.legacyStatus === 'draft') continue;
    const workflow = WORKFLOWS[v.docType];
    if (!workflow) continue;

    const docId = `seed_${v.voucherId}_${projectId}`;
    const thresholds = { ...DEFAULT_THRESHOLDS } as any;
    const firstStep  = workflow.steps[0];
    const lastStep   = workflow.steps[workflow.steps.length - 1];

    const base: Omit<ApprovalDoc,'status'|'currentStepId'|'auditLog'> = {
      id: docId, projectId, docType: v.docType,
      docNumber: v.voucherCode, title: v.title,
      amount: v.amount,
      createdBy: thuKhoCtx.userId, createdByName: 'Thủ kho',
      createdAt: now, updatedAt: now,
      data: { voucherId: v.voucherId, voucher: v.voucherData },
      thresholds,
    };

    const makeLog = (action: string, userId: string, userName: string, stepId: string, stepLabel: string, pin = false): AuditEntry => ({
      id: `log_seed_${action}_${v.voucherId}`, docId, action: action as any,
      stepId, stepLabel, userId, userName, userRole: userName, timestamp: now, pinVerified: pin,
    });

    if (v.legacyStatus === 'approved') {
      newDocs.push({
        ...base, status:'COMPLETED', currentStepId: lastStep.stepId,
        auditLog:[
          makeLog('CREATE', thuKhoCtx.userId, 'Thủ kho', firstStep.stepId, firstStep.label),
          makeLog('APPROVE', chiHuyPhoCtx.userId, 'Chỉ huy phó', lastStep.stepId, lastStep.label, true),
        ],
      });
    } else if (v.legacyStatus === 'pending') {
      newDocs.push({
        ...base, status:'SUBMITTED', currentStepId: firstStep.stepId,
        auditLog:[
          makeLog('CREATE', thuKhoCtx.userId, 'Thủ kho', firstStep.stepId, firstStep.label),
          makeLog('SUBMIT', thuKhoCtx.userId, 'Thủ kho', firstStep.stepId, firstStep.label),
        ],
      });
    } else if (v.legacyStatus === 'rejected') {
      newDocs.push({
        ...base, status:'REJECTED', currentStepId: firstStep.stepId,
        auditLog:[
          makeLog('CREATE', thuKhoCtx.userId, 'Thủ kho', firstStep.stepId, firstStep.label),
          makeLog('REJECT', chiHuyPhoCtx.userId, 'Chỉ huy phó', firstStep.stepId, firstStep.label),
        ],
      });
    }
  }

  if (newDocs.length > 0) saveDocs(projectId, [...newDocs, ...existing]);
}
