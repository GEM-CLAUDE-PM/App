// roles.ts — GEM&CLAUDE PM Pro
// Authority levels, role definitions, tab permissions, action types

/**
 * GEM&CLAUDE PM Pro — Permission Architecture v2.0
 * ──────────────────────────────────────────────────
 * NGUỒN SỰ THẬT DUY NHẤT cho toàn bộ phân quyền.
 * KHÔNG hard-code role check ở bất kỳ component nào.
 *
 * Thay đổi v2.0 (S5 Engine Refactor):
 *   ✅ StepActionType: 'create'|'review'|'approve'|'r_a'|'sign'|'upload'|'notify'
 *   ✅ REVIEW = bước chuyên môn, LUÔN thực hiện, KHÔNG phụ thuộc hạn mức
 *   ✅ APPROVE = ký duyệt tài chính, phụ thuộc hạn mức, cần PIN
 *   ✅ R_A = vừa review vừa approve (giá trị ≤ hạn mức cấp đó)
 *   ✅ 28 workflow / 7 nhóm theo WorkflowDesign v2.2
 */

// ─────────────────────────────────────────────────
// TẦNG 1 — AUTHORITY LEVELS
// ─────────────────────────────────────────────────

export type AuthorityLevel = 1 | 2 | 3 | 4 | 5;

export const AUTHORITY_LEVEL: Record<string, AuthorityLevel> = {
  admin:5, giam_doc:5,
  ke_toan_truong:4, pm:4,
  chi_huy_truong:3, chi_huy_pho:3, truong_qs:3, truong_qaqc:3, truong_hse:3,
  qs_site:2, qaqc_site:2, ks_giam_sat:2, hse_site:2, ke_toan_site:2, ke_toan_kho:2,
  thu_kho:1, thu_ky_site:1, thu_ky_ho:1,
};

export type Domain =
  | 'finance' | 'qs' | 'qaqc' | 'hse' | 'site' | 'warehouse' | 'admin' | 'cross';

export const ROLE_DOMAIN: Record<string, Domain[]> = {
  admin:             ['cross','admin'],
  giam_doc:          ['cross'],
  ke_toan_truong:    ['finance','cross'],
  pm:                ['cross'],
  chi_huy_truong:    ['site','cross'],
  chi_huy_pho:       ['site','cross'],
  truong_qs:         ['qs','cross'],
  truong_qaqc:       ['qaqc','cross'],
  truong_hse:        ['hse','cross'],
  qs_site:           ['qs'],
  qaqc_site:         ['qaqc'],
  ks_giam_sat:       ['site','qaqc'],
  hse_site:          ['hse'],
  ke_toan_site:      ['finance'],
  ke_toan_kho:       ['finance','warehouse'],
  thu_kho:           ['warehouse'],
  thu_ky_site:       ['admin'],
  thu_ky_ho:         ['admin'],
};

export type RoleId = keyof typeof AUTHORITY_LEVEL;

export interface RoleDefinition {
  id: RoleId; label: string; group: 'ho'|'mob'|'site';
  level: AuthorityLevel; domains: Domain[]; color: string;
}

export const ROLES: Record<RoleId, RoleDefinition> = {
  admin:           {id:'admin',           label:'Admin',             group:'ho',   level:5, domains:ROLE_DOMAIN['admin'],           color:'#6366f1'},
  giam_doc:        {id:'giam_doc',        label:'Giám đốc',          group:'ho',   level:5, domains:ROLE_DOMAIN['giam_doc'],        color:'#7c3aed'},
  ke_toan_truong:  {id:'ke_toan_truong',  label:'Kế toán trưởng',    group:'ho',   level:4, domains:ROLE_DOMAIN['ke_toan_truong'],  color:'#0891b2'},
  pm:              {id:'pm',              label:'Project Manager',   group:'mob',  level:4, domains:ROLE_DOMAIN['pm'],              color:'#1a8a7a'},
  chi_huy_truong:  {id:'chi_huy_truong',  label:'Chỉ huy trưởng',   group:'site', level:3, domains:ROLE_DOMAIN['chi_huy_truong'],  color:'#b45309'},
  chi_huy_pho:     {id:'chi_huy_pho',     label:'Chỉ huy phó',      group:'site', level:3, domains:ROLE_DOMAIN['chi_huy_pho'],     color:'#b45309'},
  truong_qs:       {id:'truong_qs',       label:'Trưởng QS',         group:'mob',  level:3, domains:ROLE_DOMAIN['truong_qs'],       color:'#0284c7'},
  truong_qaqc:     {id:'truong_qaqc',     label:'Trưởng QA/QC',      group:'mob',  level:3, domains:ROLE_DOMAIN['truong_qaqc'],     color:'#059669'},
  truong_hse:      {id:'truong_hse',      label:'Trưởng HSE',        group:'mob',  level:3, domains:ROLE_DOMAIN['truong_hse'],      color:'#dc2626'},
  qs_site:         {id:'qs_site',         label:'QS site',           group:'site', level:2, domains:ROLE_DOMAIN['qs_site'],         color:'#0284c7'},
  qaqc_site:       {id:'qaqc_site',       label:'QA/QC site',        group:'site', level:2, domains:ROLE_DOMAIN['qaqc_site'],       color:'#059669'},
  ks_giam_sat:     {id:'ks_giam_sat',     label:'KS Giám sát',       group:'site', level:2, domains:ROLE_DOMAIN['ks_giam_sat'],     color:'#7c3aed'},
  hse_site:        {id:'hse_site',        label:'HSE site',          group:'site', level:2, domains:ROLE_DOMAIN['hse_site'],        color:'#dc2626'},
  ke_toan_site:    {id:'ke_toan_site',    label:'Kế toán site',      group:'site', level:2, domains:ROLE_DOMAIN['ke_toan_site'],    color:'#0891b2'},
  ke_toan_kho:     {id:'ke_toan_kho',     label:'Kế toán kho',       group:'site', level:2, domains:ROLE_DOMAIN['ke_toan_kho'],     color:'#0891b2'},
  thu_kho:         {id:'thu_kho',         label:'Thủ kho',           group:'site', level:1, domains:ROLE_DOMAIN['thu_kho'],         color:'#c47a5a'},
  thu_ky_site:     {id:'thu_ky_site',     label:'Thư ký site',       group:'site', level:1, domains:ROLE_DOMAIN['thu_ky_site'],     color:'#64748b'},
  thu_ky_ho:       {id:'thu_ky_ho',       label:'Thư ký HO',         group:'ho',   level:1, domains:ROLE_DOMAIN['thu_ky_ho'],       color:'#64748b'},
};

// ─────────────────────────────────────────────────
// STEP ACTION TYPE — TRÁI TIM CỦA v2.0
// ─────────────────────────────────────────────────

/**
 * 'create'  — Tạo hồ sơ. Chưa có giá trị pháp lý.
 * 'review'  — Xác nhận chuyên môn → chuyển tiếp.
 *             LUÔN thực hiện. KHÔNG phụ thuộc hạn mức. KHÔNG cần PIN.
 * 'approve' — Ký duyệt tài chính. PHỤ THUỘC hạn mức. Cần PIN.
 * 'r_a'     — Review + Approve khi giá trị ≤ hạn mức cấp đó.
 * 'sign'    — Ký ngoài app (CĐT, TVGS, NTP, đối tác).
 * 'upload'  — Upload văn bản đã ký.
 * 'notify'  — Hệ thống tự động gửi thông báo.
 */
export type StepActionType = 'create'|'review'|'approve'|'r_a'|'sign'|'upload'|'notify';

// ─────────────────────────────────────────────────
// UI ACTION TYPES
// ─────────────────────────────────────────────────

export type DeniedBehavior = 'hidden'|'disabled'|'readonly';

export type ActionType =
  | 'VIEW_TAB' | 'VIEW_RECORD' | 'VIEW_FINANCE_AMOUNT'
  | 'CREATE' | 'EDIT_OWN' | 'EDIT_OTHER' | 'SUBMIT'
  | 'APPROVE_L2' | 'APPROVE_L3' | 'APPROVE_L4' | 'APPROVE_L5'
  | 'DELETE' | 'EXPORT_PDF' | 'CONFIG_THRESHOLDS' | 'MANAGE_USERS';

export const DENIED_BEHAVIOR: Record<ActionType, DeniedBehavior> = {
  VIEW_TAB:'hidden', VIEW_RECORD:'hidden', VIEW_FINANCE_AMOUNT:'hidden',
  CREATE:'hidden', EDIT_OWN:'disabled', EDIT_OTHER:'hidden', SUBMIT:'disabled',
  APPROVE_L2:'disabled', APPROVE_L3:'disabled', APPROVE_L4:'disabled', APPROVE_L5:'disabled',
  DELETE:'hidden', EXPORT_PDF:'disabled', CONFIG_THRESHOLDS:'hidden', MANAGE_USERS:'hidden',
};

// ─────────────────────────────────────────────────
// TAB PERMISSIONS
// ─────────────────────────────────────────────────

export interface TabPermission {
  id: string; domains: Domain[]; minLevel: AuthorityLevel;
  crossDomainLevel: AuthorityLevel; readOnlyDomains?: Domain[];
}

export const TAB_PERMISSIONS: TabPermission[] = [
  {id:'overview',       domains:['finance','qs','qaqc','hse','site','warehouse','admin','cross'], minLevel:1, crossDomainLevel:1},
  {id:'progress',       domains:['site','qs','qaqc','hse','cross'], minLevel:1, crossDomainLevel:3, readOnlyDomains:['qs','qaqc','hse','warehouse','finance']},
  {id:'contracts',      domains:['cross'], minLevel:3, crossDomainLevel:3},
  {id:'resources',      domains:['warehouse','site','cross'], minLevel:1, crossDomainLevel:3, readOnlyDomains:['site','qaqc','hse','qs']},
  {id:'manpower',       domains:['site','cross'], minLevel:2, crossDomainLevel:3},
  {id:'equipment',      domains:['site','cross'], minLevel:1, crossDomainLevel:3, readOnlyDomains:['qs','qaqc','hse']},
  {id:'records',        domains:['site','qaqc','qs','cross','admin'], minLevel:1, crossDomainLevel:3, readOnlyDomains:['finance','warehouse']},
  {id:'giam-sat',       domains:['site','qaqc','cross'], minLevel:2, crossDomainLevel:3, readOnlyDomains:['hse']},
  {id:'qa-qc',          domains:['qaqc','site','cross'], minLevel:1, crossDomainLevel:3, readOnlyDomains:['site','hse']},
  {id:'qs',             domains:['qs','cross'], minLevel:2, crossDomainLevel:3, readOnlyDomains:['site']},
  {id:'accounting',     domains:['finance','cross'], minLevel:2, crossDomainLevel:4},
  {id:'hse',            domains:['hse','cross'], minLevel:1, crossDomainLevel:3},
  {id:'reports',        domains:['cross'], minLevel:3, crossDomainLevel:3},
  {id:'office',         domains:['admin','cross'], minLevel:1, crossDomainLevel:3, readOnlyDomains:['admin']},
  {id:'notifs',         domains:['finance','qs','qaqc','hse','site','warehouse','admin','cross'], minLevel:1, crossDomainLevel:1},
  {id:'cloud',          domains:['cross'], minLevel:3, crossDomainLevel:3},
  {id:'gem-ai',         domains:['cross'], minLevel:3, crossDomainLevel:3},
  {id:'approval-queue', domains:['finance','qs','qaqc','hse','site','cross'], minLevel:2, crossDomainLevel:2},
];

// ─────────────────────────────────────────────────
// WORKFLOW TYPES
// ─────────────────────────────────────────────────

export type DocType =
  | 'MATERIAL_REQUEST' | 'WAREHOUSE_EXIT' | 'WAREHOUSE_ENTRY' | 'STOCK_TAKE'
  | 'VARIATION_ORDER' | 'ACCEPTANCE_INTERNAL' | 'ACCEPTANCE_OWNER'
  | 'PAYMENT_REQUEST' | 'CONTRACT_AMENDMENT' | 'SUBCONTRACT_PAYMENT'
  | 'FINANCIAL_VOUCHER' | 'TIMESHEET' | 'OVERTIME_REQUEST'
  | 'PROCUREMENT' | 'MATERIAL_APPROVAL' | 'MATERIAL_INCOMING'
  | 'VENDOR_PREQUALIFICATION' | 'VENDOR_EVALUATION'
  | 'NCR' | 'RFI' | 'INSPECTION_REQUEST' | 'ITP_MANAGEMENT'
  | 'METHOD_STATEMENT' | 'DRAWING_REVISION' | 'QUALITY_AUDIT' | 'TESTING_LAB'
  | 'HSE_INCIDENT' | 'PERMIT_TO_WORK' | 'TOOLBOX_MEETING' | 'HSE_INSPECTION' | 'CAPA'
  | 'LEAVE_REQUEST' | 'DISCIPLINE'
  | 'ACCEPTANCE' | 'PROCUREMENT_LEGACY';

export interface ApprovalStep {
  stepId:          string;
  label:           string;
  actionType:      StepActionType;
  requiredRole?:   RoleId[];
  minLevel?:       AuthorityLevel;
  requiredDomain?: Domain[];
  pinRequired?:    boolean;
  thresholdKey?:   string;
  skipIfBelow?:    string;
  skipIfAbove?:    string;
  externalSign?:   boolean;
  autoAdvance?:    boolean;
}

export interface WorkflowDefinition {
  docType:            DocType;
  label:              string;
  icon:               string;
  group:              'A'|'B'|'C'|'D'|'E'|'F'|'G';
  groupLabel:         string;
  category:           'internal'|'project';
  createdBy:          {minLevel: AuthorityLevel; domains: Domain[]};
  steps:              ApprovalStep[];
  pdfExportAfterStep: string;
  prerequisite?:      DocType;
}

// ─────────────────────────────────────────────────
// THRESHOLDS
// ─────────────────────────────────────────────────

export interface ApprovalThresholds {
  projectId: string;
  L3_max: number; L4_max: number; L5_max: number;
  configuredBy: string; configuredAt: string;
}

export const DEFAULT_THRESHOLDS: Omit<ApprovalThresholds,'projectId'|'configuredBy'|'configuredAt'> = {
  L3_max:  50_000_000,
  L4_max:  500_000_000,
  L5_max:  Number.MAX_SAFE_INTEGER,
};

// ─────────────────────────────────────────────────
// 28 WORKFLOW DEFINITIONS
// ─────────────────────────────────────────────────

