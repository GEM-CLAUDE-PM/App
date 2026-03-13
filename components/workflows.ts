// workflows.ts — GEM&CLAUDE PM Pro
// 28 workflow definitions — tách từ permissions.ts

import type { RoleId, DocType, StepActionType, ApprovalStep, WorkflowDefinition, ApprovalThresholds } from './roles';

export const WORKFLOWS: Partial<Record<DocType, WorkflowDefinition>> = {

  // ── A. VẬT TƯ / KHO ─────────────────────────────────

  MATERIAL_REQUEST: {
    docType:'MATERIAL_REQUEST', label:'Đề xuất cấp vật tư', icon:'📝',
    group:'A', groupLabel:'Vật tư / Kho', category:'internal',
    createdBy:{minLevel:2, domains:['site','qs','qaqc','hse','warehouse']},
    pdfExportAfterStep:'approve_ch',
    steps:[
      {stepId:'create',     label:'KS / KT thi công lập đề xuất',      actionType:'create',  minLevel:2, requiredDomain:['site','qs','qaqc','hse','warehouse']},
      {stepId:'review_ch',  label:'CH Phó xem xét nhu cầu & kế hoạch', actionType:'review',  minLevel:3, requiredDomain:['site','cross']},
      {stepId:'approve_ch', label:'CH Phó duyệt cấp vật tư',           actionType:'r_a',     minLevel:3, requiredDomain:['site','cross'], pinRequired:true, thresholdKey:'L3_max', skipIfAbove:'L3_max'},
      {stepId:'approve_l4', label:'PM duyệt (lô lớn ngoài kế hoạch)',  actionType:'approve', minLevel:4, pinRequired:true, skipIfBelow:'L3_max'},
    ],
  },

  WAREHOUSE_EXIT: {
    docType:'WAREHOUSE_EXIT', label:'Phiếu xuất kho', icon:'📤',
    group:'A', groupLabel:'Vật tư / Kho', category:'internal',
    createdBy:{minLevel:1, domains:['warehouse']}, pdfExportAfterStep:'approve_ch',
    prerequisite:'MATERIAL_REQUEST',
    steps:[
      {stepId:'create',     label:'Thủ kho lập phiếu (từ MR approved)', actionType:'create', minLevel:1, requiredDomain:['warehouse']},
      {stepId:'approve_ch', label:'CH Phó xem xét & duyệt xuất',        actionType:'r_a',    minLevel:3, requiredDomain:['site','cross'], pinRequired:true, thresholdKey:'L3_max', skipIfAbove:'L3_max'},
      {stepId:'approve_l4', label:'PM duyệt (lô lớn bất thường)',       actionType:'approve',minLevel:4, pinRequired:true, skipIfBelow:'L3_max'},
      {stepId:'ledger',     label:'KT ghi sổ xuất kho (TK621/TK152)',   actionType:'review', minLevel:2, requiredDomain:['finance','warehouse']},
    ],
  },

  WAREHOUSE_ENTRY: {
    docType:'WAREHOUSE_ENTRY', label:'Phiếu nhập kho', icon:'📥',
    group:'A', groupLabel:'Vật tư / Kho', category:'internal',
    createdBy:{minLevel:1, domains:['warehouse']}, pdfExportAfterStep:'approve_ch',
    steps:[
      {stepId:'create',     label:'Thủ kho lập phiếu nhập',             actionType:'create', minLevel:1, requiredDomain:['warehouse']},
      {stepId:'approve_ch', label:'CH Phó xem xét & duyệt nhập',        actionType:'r_a',    minLevel:3, requiredDomain:['site','cross'], pinRequired:true, thresholdKey:'L3_max', skipIfAbove:'L3_max'},
      {stepId:'approve_l4', label:'PM duyệt',                           actionType:'approve',minLevel:4, pinRequired:true, skipIfBelow:'L3_max'},
      {stepId:'ledger',     label:'KT ghi sổ nhập kho (TK152/TK331)',   actionType:'review', minLevel:2, requiredDomain:['finance','warehouse']},
    ],
  },

  STOCK_TAKE: {
    docType:'STOCK_TAKE', label:'Kiểm kê kho định kỳ', icon:'📊',
    group:'A', groupLabel:'Vật tư / Kho', category:'internal',
    createdBy:{minLevel:1, domains:['warehouse']}, pdfExportAfterStep:'approve',
    steps:[
      {stepId:'create',  label:'Thủ kho lập phiếu kiểm kê',       actionType:'create', minLevel:1, requiredDomain:['warehouse']},
      {stepId:'verify',  label:'KT xác nhận số liệu sổ sách',      actionType:'review', minLevel:2, requiredDomain:['finance','warehouse']},
      {stepId:'approve', label:'CH Phó duyệt & ký',                actionType:'r_a',    minLevel:3, requiredDomain:['site','cross'], pinRequired:true},
      {stepId:'post',    label:'Hệ thống điều chỉnh số tồn kho',   actionType:'notify', autoAdvance:true},
    ],
  },

  // ── B. QS / HỢP ĐỒNG ─────────────────────────────────

  VARIATION_ORDER: {
    docType:'VARIATION_ORDER', label:'Variation Order', icon:'📋',
    group:'B', groupLabel:'QS / Hợp đồng', category:'project',
    createdBy:{minLevel:2, domains:['qs']}, pdfExportAfterStep:'approve_ch',
    steps:[
      {stepId:'create',       label:'QS lập VO',                              actionType:'create', minLevel:2, requiredDomain:['qs']},
      {stepId:'review_ch',    label:'CH Phó xem xét chuyên môn',              actionType:'r_a',    minLevel:3, requiredDomain:['site','cross'], pinRequired:true, thresholdKey:'L3_max', skipIfAbove:'L3_max'},
      {stepId:'approve_l4',   label:'PM ký nội bộ',                           actionType:'approve',minLevel:4, pinRequired:true, thresholdKey:'L4_max', skipIfAbove:'L4_max', skipIfBelow:'L3_max'},
      {stepId:'approve_l5',   label:'GĐ ký',                                  actionType:'approve',minLevel:5, pinRequired:true, skipIfBelow:'L4_max'},
      {stepId:'external_sign',label:'CĐT ký xác nhận',                        actionType:'sign',   externalSign:true},
      {stepId:'upload',       label:'Upload bản đã ký 2 bên',                 actionType:'upload', minLevel:2},
    ],
  },

  ACCEPTANCE_INTERNAL: {
    docType:'ACCEPTANCE_INTERNAL', label:'BBNT Nội bộ', icon:'✅',
    group:'B', groupLabel:'QS / Hợp đồng', category:'internal',
    createdBy:{minLevel:2, domains:['site','qaqc']}, pdfExportAfterStep:'sign_ch',
    steps:[
      {stepId:'create',    label:'KS Giám sát lập BBNT',         actionType:'create', minLevel:2, requiredDomain:['site','qaqc']},
      {stepId:'review_qs', label:'QS xem xét & xác nhận KL',     actionType:'review', minLevel:2, requiredDomain:['qs','cross']},
      {stepId:'sign_ch',   label:'CH Trưởng ký duyệt',           actionType:'approve',minLevel:3, requiredDomain:['site','cross'], pinRequired:true},
    ],
  },

  ACCEPTANCE_OWNER: {
    docType:'ACCEPTANCE_OWNER', label:'BBNT với Chủ đầu tư', icon:'🤝',
    group:'B', groupLabel:'QS / Hợp đồng', category:'project',
    createdBy:{minLevel:2, domains:['site','qaqc']}, pdfExportAfterStep:'sign_ch',
    steps:[
      {stepId:'create',   label:'KS Giám sát lập BBNT',             actionType:'create', minLevel:2, requiredDomain:['site','qaqc']},
      {stepId:'review_qs',label:'QS xem xét & xác nhận KL',         actionType:'review', minLevel:2, requiredDomain:['qs','cross']},
      {stepId:'sign_ch',  label:'CH Trưởng ký (phía nhà thầu)',     actionType:'approve',minLevel:3, requiredDomain:['site','cross'], pinRequired:true},
      {stepId:'ext_sign', label:'CĐT / TVGS ký xác nhận',           actionType:'sign',   externalSign:true},
      {stepId:'upload',   label:'Upload bản đã ký 2 bên',           actionType:'upload', minLevel:2},
    ],
  },

  PAYMENT_REQUEST: {
    docType:'PAYMENT_REQUEST', label:'Yêu cầu Thanh toán (YCTT)', icon:'💰',
    group:'B', groupLabel:'QS / Hợp đồng', category:'project',
    createdBy:{minLevel:2, domains:['qs','finance']}, pdfExportAfterStep:'approve_l3',
    prerequisite:'ACCEPTANCE_OWNER',
    steps:[
      {stepId:'create',     label:'QS lập YCTT (từ BBNT approved)',  actionType:'create', minLevel:2, requiredDomain:['qs','finance']},
      // REVIEW bắt buộc — CH Phó LUÔN xác nhận KL/kỹ thuật, KHÔNG skip dù giá trị nào
      {stepId:'review_l3',  label:'CH Phó xem xét chuyên môn',       actionType:'review', minLevel:3, requiredDomain:['site','cross']},
      {stepId:'approve_l3', label:'CH Phó ký duyệt',                 actionType:'approve',minLevel:3, requiredDomain:['site','cross'], pinRequired:true, thresholdKey:'L3_max', skipIfAbove:'L3_max'},
      {stepId:'approve_l4', label:'PM ký duyệt',                     actionType:'approve',minLevel:4, pinRequired:true, thresholdKey:'L4_max', skipIfAbove:'L4_max', skipIfBelow:'L3_max'},
      {stepId:'approve_l5', label:'GĐ ký',                           actionType:'approve',minLevel:5, pinRequired:true, skipIfBelow:'L4_max'},
    ],
  },

  CONTRACT_AMENDMENT: {
    docType:'CONTRACT_AMENDMENT', label:'Phụ lục Hợp đồng', icon:'📝',
    group:'B', groupLabel:'QS / Hợp đồng', category:'project',
    createdBy:{minLevel:3, domains:['qs','cross']}, pdfExportAfterStep:'approve_l5',
    steps:[
      {stepId:'create',       label:'QS/PM soạn phụ lục',             actionType:'create', minLevel:3, requiredDomain:['qs','cross']},
      {stepId:'review_l4',    label:'PM xem xét nội dung',            actionType:'review', minLevel:4},
      {stepId:'approve_l4',   label:'PM ký nội bộ',                   actionType:'approve',minLevel:4, pinRequired:true},
      {stepId:'approve_l5',   label:'GĐ ký',                          actionType:'approve',minLevel:5, pinRequired:true},
      {stepId:'external_sign',label:'Đối tác ký xác nhận',            actionType:'sign',   externalSign:true},
      {stepId:'upload',       label:'Upload bản ký 2 bên',            actionType:'upload', minLevel:2},
    ],
  },

  SUBCONTRACT_PAYMENT: {
    docType:'SUBCONTRACT_PAYMENT', label:'Thanh toán Thầu phụ', icon:'🏗️',
    group:'B', groupLabel:'QS / Hợp đồng', category:'project',
    createdBy:{minLevel:2, domains:['qs']}, pdfExportAfterStep:'approve_l3',
    steps:[
      {stepId:'create',     label:'QS lập đề nghị TT thầu phụ',     actionType:'create', minLevel:2, requiredDomain:['qs']},
      {stepId:'review_l3',  label:'CH Phó xem xét KL thầu phụ',     actionType:'review', minLevel:3, requiredDomain:['site','cross']},
      {stepId:'approve_l3', label:'CH Phó duyệt',                   actionType:'approve',minLevel:3, requiredDomain:['site','cross'], pinRequired:true, thresholdKey:'L3_max', skipIfAbove:'L3_max'},
      {stepId:'approve_l4', label:'PM ký',                          actionType:'approve',minLevel:4, pinRequired:true, thresholdKey:'L4_max', skipIfAbove:'L4_max', skipIfBelow:'L3_max'},
      {stepId:'approve_l5', label:'GĐ ký',                          actionType:'approve',minLevel:5, pinRequired:true, skipIfBelow:'L4_max'},
    ],
  },

  // ── C. TÀI CHÍNH ─────────────────────────────────────

  FINANCIAL_VOUCHER: {
    docType:'FINANCIAL_VOUCHER', label:'Chứng từ Kế toán', icon:'📒',
    group:'C', groupLabel:'Tài chính / Kế toán', category:'internal',
    createdBy:{minLevel:2, domains:['finance']}, pdfExportAfterStep:'approve_l4',
    steps:[
      {stepId:'create',     label:'KT Site lập chứng từ',             actionType:'create', minLevel:2, requiredDomain:['finance']},
      {stepId:'review_l4',  label:'KT Trưởng xem xét',               actionType:'review', minLevel:4, requiredDomain:['finance','cross']},
      {stepId:'approve_l4', label:'KT Trưởng ký',                    actionType:'r_a',    minLevel:4, requiredDomain:['finance','cross'], pinRequired:true, thresholdKey:'L4_max', skipIfAbove:'L4_max'},
      {stepId:'approve_l5', label:'GĐ ký',                           actionType:'approve',minLevel:5, pinRequired:true, skipIfBelow:'L4_max'},
    ],
  },

  TIMESHEET: {
    docType:'TIMESHEET', label:'Bảng công', icon:'🕐',
    group:'C', groupLabel:'Tài chính / Kế toán', category:'internal',
    createdBy:{minLevel:2, domains:['site','admin']}, pdfExportAfterStep:'approve_l3',
    steps:[
      {stepId:'create',     label:'Site Admin / KS lập bảng công',   actionType:'create', minLevel:2, requiredDomain:['site','admin']},
      {stepId:'review_l3',  label:'CH Phó xem xét',                  actionType:'review', minLevel:3, requiredDomain:['site','cross']},
      {stepId:'approve_l3', label:'CH Phó ký duyệt',                 actionType:'r_a',    minLevel:3, requiredDomain:['site','cross'], pinRequired:true},
    ],
  },

  OVERTIME_REQUEST: {
    docType:'OVERTIME_REQUEST', label:'Đề xuất Tăng ca', icon:'⏰',
    group:'C', groupLabel:'Tài chính / Kế toán', category:'internal',
    createdBy:{minLevel:2, domains:['site','admin']}, pdfExportAfterStep:'approve_l3',
    steps:[
      {stepId:'create',     label:'Đội trưởng / KS lập đề xuất',     actionType:'create', minLevel:2, requiredDomain:['site','admin']},
      {stepId:'review_l3',  label:'CH Phó xem xét kế hoạch',         actionType:'review', minLevel:3, requiredDomain:['site','cross']},
      {stepId:'approve_l3', label:'CH Phó / Trưởng duyệt',           actionType:'r_a',    minLevel:3, requiredDomain:['site','cross'], pinRequired:true},
    ],
  },

  // ── D. PROCUREMENT & VENDOR ───────────────────────────

  PROCUREMENT: {
    docType:'PROCUREMENT', label:'Đề xuất Mua sắm / PO', icon:'🛒',
    group:'D', groupLabel:'Procurement & Vendor', category:'internal',
    createdBy:{minLevel:2, domains:['site','qs','qaqc','hse','warehouse','finance']},
    pdfExportAfterStep:'approve_l3',
    steps:[
      {stepId:'create',     label:'Nhân viên / KS lập đề xuất MS',   actionType:'create', minLevel:2},
      {stepId:'review_l3',  label:'CH Phó xem xét spec kỹ thuật',    actionType:'review', minLevel:3, requiredDomain:['site','cross']},
      {stepId:'approve_l3', label:'CH Phó duyệt',                   actionType:'approve',minLevel:3, requiredDomain:['site','cross'], pinRequired:true, thresholdKey:'L3_max', skipIfAbove:'L3_max'},
      {stepId:'approve_l4', label:'PM ký ngân sách',                 actionType:'approve',minLevel:4, pinRequired:true, thresholdKey:'L4_max', skipIfAbove:'L4_max', skipIfBelow:'L3_max'},
      {stepId:'approve_l5', label:'GĐ ký',                           actionType:'approve',minLevel:5, pinRequired:true, skipIfBelow:'L4_max'},
    ],
  },

  MATERIAL_APPROVAL: {
    docType:'MATERIAL_APPROVAL', label:'Duyệt mẫu vật liệu (Submittal)', icon:'🔬',
    group:'D', groupLabel:'Procurement & Vendor', category:'project',
    createdBy:{minLevel:2, domains:['site','qs']}, pdfExportAfterStep:'approve_ch',
    steps:[
      {stepId:'create',     label:'KS / QS lập hồ sơ đệ trình mẫu VL',   actionType:'create', minLevel:2, requiredDomain:['site','qs']},
      {stepId:'review_qs',  label:'QS kiểm tra tính hợp lệ hồ sơ',        actionType:'review', minLevel:2, requiredDomain:['qs','cross']},
      {stepId:'review_qa',  label:'QA/QC kiểm tra kỹ thuật & tiêu chuẩn', actionType:'review', minLevel:3, requiredDomain:['qaqc','cross']},
      {stepId:'approve_ch', label:'CH Trưởng ký duyệt nội bộ',            actionType:'approve',minLevel:3, requiredDomain:['site','cross'], pinRequired:true},
      {stepId:'ext_sign',   label:'CĐT / TVGS duyệt chính thức',          actionType:'sign',   externalSign:true},
      {stepId:'upload',     label:'Upload biên bản duyệt mẫu',            actionType:'upload', minLevel:2},
    ],
  },

  MATERIAL_INCOMING: {
    docType:'MATERIAL_INCOMING', label:'Nghiệm thu vật liệu đầu vào', icon:'🧪',
    group:'D', groupLabel:'Procurement & Vendor', category:'internal',
    createdBy:{minLevel:1, domains:['warehouse','site']}, pdfExportAfterStep:'approve_ch',
    steps:[
      {stepId:'create',     label:'Thủ kho / KS lập yêu cầu kiểm tra lô',   actionType:'create', minLevel:1, requiredDomain:['warehouse','site']},
      {stepId:'inspect_ks', label:'KS Giám sát kiểm tra số lượng/quy cách', actionType:'review', minLevel:2, requiredDomain:['site','qaqc','cross']},
      {stepId:'inspect_qa', label:'QA/QC kiểm tra chất lượng (VL kết cấu)', actionType:'review', minLevel:2, requiredDomain:['qaqc','cross']},
      {stepId:'approve_ch', label:'CH Phó xác nhận đủ điều kiện nhập kho',  actionType:'r_a',    minLevel:3, requiredDomain:['site','cross'], pinRequired:true},
      {stepId:'create_pn',  label:'Tạo Phiếu nhập kho',                     actionType:'notify', autoAdvance:true},
    ],
  },

  VENDOR_PREQUALIFICATION: {
    docType:'VENDOR_PREQUALIFICATION', label:'Đánh giá & Duyệt NCC / Thầu phụ', icon:'🏢',
    group:'D', groupLabel:'Procurement & Vendor', category:'internal',
    createdBy:{minLevel:2, domains:['qs']}, pdfExportAfterStep:'approve_pm',
    steps:[
      {stepId:'create',     label:'QS lập hồ sơ đánh giá NCC/TP',           actionType:'create', minLevel:2, requiredDomain:['qs']},
      {stepId:'review_qs',  label:'QS đánh giá thương mại & kinh nghiệm',   actionType:'review', minLevel:2, requiredDomain:['qs','cross']},
      {stepId:'review_qa',  label:'QA/QC đánh giá năng lực kỹ thuật',       actionType:'review', minLevel:3, requiredDomain:['qaqc','cross']},
      {stepId:'approve_ch', label:'CH Trưởng duyệt (NCC thông thường)',     actionType:'approve',minLevel:3, requiredDomain:['site','cross'], pinRequired:true, thresholdKey:'L3_max', skipIfAbove:'L3_max'},
      {stepId:'approve_pm', label:'PM duyệt (TP / NCC giá trị lớn)',        actionType:'approve',minLevel:4, pinRequired:true, thresholdKey:'L4_max', skipIfAbove:'L4_max', skipIfBelow:'L3_max'},
      {stepId:'approve_l5', label:'GĐ duyệt (TP chiến lược)',               actionType:'approve',minLevel:5, pinRequired:true, skipIfBelow:'L4_max'},
      {stepId:'notify',     label:'Thông báo kết quả cho NCC/TP',           actionType:'notify', autoAdvance:true},
    ],
  },

  VENDOR_EVALUATION: {
    docType:'VENDOR_EVALUATION', label:'Đánh giá định kỳ NCC / Thầu phụ', icon:'⭐',
    group:'D', groupLabel:'Procurement & Vendor', category:'internal',
    createdBy:{minLevel:2, domains:['qs']}, pdfExportAfterStep:'approve_pm',
    steps:[
      {stepId:'create',     label:'QS + QA/QC lập phiếu đánh giá',     actionType:'create', minLevel:2, requiredDomain:['qs','qaqc']},
      {stepId:'review_qa',  label:'QA/QC cho điểm kỹ thuật / tiến độ', actionType:'review', minLevel:3, requiredDomain:['qaqc','cross']},
      {stepId:'approve_pm', label:'PM phê duyệt kết quả',              actionType:'r_a',    minLevel:4, pinRequired:true},
      {stepId:'update',     label:'Cập nhật danh sách NCC/TP hệ thống',actionType:'notify', autoAdvance:true},
    ],
  },

  // ── E. CHẤT LƯỢNG QA/QC ──────────────────────────────

  NCR: {
    docType:'NCR', label:'Non-Conformance Report (NCR)', icon:'⚠️',
    group:'E', groupLabel:'Chất lượng QA/QC', category:'project',
    createdBy:{minLevel:2, domains:['qaqc','site']}, pdfExportAfterStep:'close_ncr',
    steps:[
      {stepId:'create',   label:'QA/QC phát hành NCR',                   actionType:'create', minLevel:2, requiredDomain:['qaqc','site']},
      {stepId:'issue',    label:'Gửi bên chịu trách nhiệm',              actionType:'notify', autoAdvance:true},
      {stepId:'respond',  label:'Bên liên quan phản hồi & xử lý',        actionType:'sign',   externalSign:true},
      {stepId:'verify',   label:'QA/QC xác nhận đã xử lý thực tế',       actionType:'review', minLevel:2, requiredDomain:['qaqc','cross']},
      {stepId:'close_ncr',label:'Trưởng QA/QC đóng NCR',                 actionType:'r_a',    minLevel:3, requiredDomain:['qaqc','cross'], pinRequired:true},
    ],
  },

  RFI: {
    docType:'RFI', label:'Request for Information (RFI)', icon:'❓',
    group:'E', groupLabel:'Chất lượng QA/QC', category:'project',
    createdBy:{minLevel:2, domains:['site','qaqc']}, pdfExportAfterStep:'close',
    steps:[
      {stepId:'create',   label:'KS Giám sát lập RFI',              actionType:'create', minLevel:2, requiredDomain:['site','qaqc']},
      {stepId:'review_ch',label:'CH Phó xem xét trước khi gửi',     actionType:'review', minLevel:3, requiredDomain:['site','cross']},
      {stepId:'send',     label:'Gửi CĐT / TVGS (kèm deadline)',    actionType:'notify', autoAdvance:true},
      {stepId:'respond',  label:'CĐT / TVGS phản hồi',              actionType:'sign',   externalSign:true},
      {stepId:'close',    label:'KS Giám sát đóng RFI',             actionType:'r_a',    minLevel:2, requiredDomain:['site','qaqc','cross']},
    ],
  },

  INSPECTION_REQUEST: {
    docType:'INSPECTION_REQUEST', label:'Inspection Request — Nghiệm thu công đoạn', icon:'🔍',
    group:'E', groupLabel:'Chất lượng QA/QC', category:'project',
    createdBy:{minLevel:2, domains:['site','qs']}, pdfExportAfterStep:'approve',
    steps:[
      {stepId:'create',  label:'KS / QS lập yêu cầu kiểm tra',           actionType:'create', minLevel:2, requiredDomain:['site','qs']},
      {stepId:'inspect', label:'QA/QC kiểm tra thực tế tại hiện trường', actionType:'review', minLevel:2, requiredDomain:['qaqc','cross']},
      {stepId:'approve', label:'Trưởng QA/QC xác nhận PASS',             actionType:'r_a',    minLevel:3, requiredDomain:['qaqc','cross'], pinRequired:true},
      {stepId:'ext_sign',label:'TVGS xác nhận (nếu CĐT yêu cầu)',        actionType:'sign',   externalSign:true},
      {stepId:'notify',  label:'Thông báo KS được thi công tiếp',        actionType:'notify', autoAdvance:true},
    ],
  },

  ITP_MANAGEMENT: {
    docType:'ITP_MANAGEMENT', label:'Inspection & Test Plan (ITP)', icon:'📋',
    group:'E', groupLabel:'Chất lượng QA/QC', category:'project',
    createdBy:{minLevel:3, domains:['qaqc']}, pdfExportAfterStep:'approve_pm',
    steps:[
      {stepId:'create',    label:'QA/QC lập ITP theo scope công việc', actionType:'create', minLevel:3, requiredDomain:['qaqc']},
      {stepId:'review_ch', label:'CH Trưởng review kỹ thuật',          actionType:'review', minLevel:3, requiredDomain:['site','cross']},
      {stepId:'approve_pm',label:'PM duyệt nội bộ',                    actionType:'approve',minLevel:4, pinRequired:true},
      {stepId:'ext_sign',  label:'CĐT / TVGS duyệt ITP',              actionType:'sign',   externalSign:true},
      {stepId:'upload',    label:'Upload ITP đã duyệt',               actionType:'upload', minLevel:2},
    ],
  },

  METHOD_STATEMENT: {
    docType:'METHOD_STATEMENT', label:'Biện pháp Thi công', icon:'📖',
    group:'E', groupLabel:'Chất lượng QA/QC', category:'project',
    createdBy:{minLevel:3, domains:['site','qaqc']}, pdfExportAfterStep:'approve_pm',
    steps:[
      {stepId:'create',     label:'KS / CH Phó lập biện pháp TC',          actionType:'create', minLevel:3, requiredDomain:['site']},
      {stepId:'review_qa',  label:'QA/QC review chất lượng & tiêu chuẩn',  actionType:'review', minLevel:3, requiredDomain:['qaqc','cross']},
      {stepId:'review_hse', label:'HSE review an toàn',                    actionType:'review', minLevel:3, requiredDomain:['hse','cross']},
      {stepId:'approve_ch', label:'CH Trưởng ký nội bộ',                   actionType:'approve',minLevel:3, requiredDomain:['site','cross'], pinRequired:true},
      {stepId:'approve_pm', label:'PM duyệt',                              actionType:'approve',minLevel:4, pinRequired:true},
      {stepId:'ext_sign',   label:'CĐT / TVGS duyệt',                      actionType:'sign',   externalSign:true},
      {stepId:'upload',     label:'Upload bản đã duyệt',                   actionType:'upload', minLevel:2},
    ],
  },

  DRAWING_REVISION: {
    docType:'DRAWING_REVISION', label:'Quản lý Bản vẽ & Revision', icon:'📐',
    group:'E', groupLabel:'Chất lượng QA/QC', category:'internal',
    createdBy:{minLevel:2, domains:['site','qaqc']}, pdfExportAfterStep:'approve_ch',
    steps:[
      {stepId:'create',    label:'KS / Drafter upload bản vẽ mới',      actionType:'create', minLevel:2, requiredDomain:['site','qaqc']},
      {stepId:'review_qa', label:'QA/QC kiểm tra số revision, scope',   actionType:'review', minLevel:2, requiredDomain:['qaqc','cross']},
      {stepId:'approve_ch',label:'CH Trưởng xác nhận phát hành',        actionType:'r_a',    minLevel:3, requiredDomain:['site','cross'], pinRequired:true},
      {stepId:'notify',    label:'Thông báo tất cả KS trên công trường',actionType:'notify', autoAdvance:true},
    ],
  },

  QUALITY_AUDIT: {
    docType:'QUALITY_AUDIT', label:'Audit Chất lượng Nội bộ', icon:'🔎',
    group:'E', groupLabel:'Chất lượng QA/QC', category:'internal',
    createdBy:{minLevel:3, domains:['qaqc']}, pdfExportAfterStep:'approve_pm',
    steps:[
      {stepId:'create',    label:'Trưởng QA/QC lập kế hoạch audit',      actionType:'create', minLevel:3, requiredDomain:['qaqc']},
      {stepId:'conduct',   label:'QA/QC thực hiện audit',                actionType:'review', minLevel:3, requiredDomain:['qaqc','cross']},
      {stepId:'report',    label:'Lập báo cáo audit (auto NCR nếu có)',  actionType:'create', minLevel:3, requiredDomain:['qaqc']},
      {stepId:'approve_pm',label:'PM ghi nhận báo cáo',                  actionType:'review', minLevel:4},
    ],
  },

  TESTING_LAB: {
    docType:'TESTING_LAB', label:'Kết quả Thí nghiệm / Kiểm định', icon:'🧫',
    group:'E', groupLabel:'Chất lượng QA/QC', category:'internal',
    createdBy:{minLevel:2, domains:['qaqc','site']}, pdfExportAfterStep:'approve_ch',
    steps:[
      {stepId:'create',    label:'QA/QC / KS lập yêu cầu lấy mẫu TN',  actionType:'create', minLevel:2, requiredDomain:['qaqc','site']},
      {stepId:'sample',    label:'Lấy mẫu tại công trường',             actionType:'create', minLevel:1},
      {stepId:'lab_result',label:'Nhận kết quả từ phòng thí nghiệm',    actionType:'upload', minLevel:2, requiredDomain:['qaqc','site']},
      {stepId:'verify_qa', label:'QA/QC xem xét kết quả (TCVN)',        actionType:'review', minLevel:2, requiredDomain:['qaqc','cross']},
      {stepId:'approve_ch',label:'Trưởng QA/QC xác nhận PASS/FAIL',     actionType:'r_a',    minLevel:3, requiredDomain:['qaqc','cross'], pinRequired:true},
    ],
  },

  // ── F. AN TOÀN HSE ────────────────────────────────────

  HSE_INCIDENT: {
    docType:'HSE_INCIDENT', label:'Báo cáo Sự cố / Near Miss', icon:'🚨',
    group:'F', groupLabel:'An toàn HSE', category:'internal',
    createdBy:{minLevel:1, domains:['hse','site']}, pdfExportAfterStep:'close',
    steps:[
      {stepId:'create',   label:'Nhân viên / Trưởng HSE lập báo cáo',  actionType:'create', minLevel:1, requiredDomain:['hse','site']},
      {stepId:'review_l3',label:'Trưởng HSE điều tra & xác nhận',      actionType:'review', minLevel:3, requiredDomain:['hse','cross']},
      {stepId:'record_l4',label:'PM ghi nhận',                         actionType:'review', minLevel:4},
      {stepId:'close',    label:'Trưởng HSE đóng sự cố (sau CAPA)',    actionType:'r_a',    minLevel:3, requiredDomain:['hse','cross'], pinRequired:true},
    ],
  },

  PERMIT_TO_WORK: {
    docType:'PERMIT_TO_WORK', label:'Giấy phép Làm việc Nguy hiểm (PTW)', icon:'🔐',
    group:'F', groupLabel:'An toàn HSE', category:'internal',
    createdBy:{minLevel:2, domains:['site','hse']}, pdfExportAfterStep:'approve',
    steps:[
      {stepId:'create',    label:'KS / Đốc công lập PTW',               actionType:'create', minLevel:2, requiredDomain:['site','hse']},
      {stepId:'review_hse',label:'Trưởng HSE kiểm tra điều kiện ATLD',  actionType:'review', minLevel:3, requiredDomain:['hse','cross']},
      {stepId:'approve',   label:'CH Phó / Trưởng cấp phép',            actionType:'r_a',    minLevel:3, requiredDomain:['site','cross'], pinRequired:true},
      {stepId:'close',     label:'Trưởng HSE đóng PTW (sau khi xong)',  actionType:'r_a',    minLevel:3, requiredDomain:['hse','cross'], pinRequired:true},
    ],
  },

  TOOLBOX_MEETING: {
    docType:'TOOLBOX_MEETING', label:'Họp an toàn đầu ca (Toolbox Meeting)', icon:'🦺',
    group:'F', groupLabel:'An toàn HSE', category:'internal',
    createdBy:{minLevel:2, domains:['hse','site']}, pdfExportAfterStep:'sign_ch',
    steps:[
      {stepId:'create', label:'Trưởng HSE / KS lập biên bản', actionType:'create', minLevel:2, requiredDomain:['hse','site']},
      {stepId:'sign_ch',label:'CH Phó ký xác nhận',           actionType:'r_a',    minLevel:3, requiredDomain:['site','cross'], pinRequired:true},
    ],
  },

  HSE_INSPECTION: {
    docType:'HSE_INSPECTION', label:'Kiểm tra An toàn định kỳ', icon:'👁️',
    group:'F', groupLabel:'An toàn HSE', category:'internal',
    createdBy:{minLevel:3, domains:['hse']}, pdfExportAfterStep:'close',
    steps:[
      {stepId:'create',   label:'Trưởng HSE lập biên bản kiểm tra', actionType:'create', minLevel:3, requiredDomain:['hse']},
      {stepId:'review_ch',label:'CH Phó / Trưởng xem xét kết quả', actionType:'review', minLevel:3, requiredDomain:['site','cross']},
      {stepId:'record_pm',label:'PM ghi nhận',                     actionType:'review', minLevel:4},
      {stepId:'close',    label:'Trưởng HSE đóng sau khi CAPA',    actionType:'r_a',    minLevel:3, requiredDomain:['hse','cross'], pinRequired:true},
    ],
  },

  CAPA: {
    docType:'CAPA', label:'Corrective & Preventive Action (CAPA)', icon:'🔄',
    group:'F', groupLabel:'An toàn HSE', category:'internal',
    createdBy:{minLevel:3, domains:['qaqc','hse']}, pdfExportAfterStep:'close',
    steps:[
      {stepId:'create',   label:'QA/QC hoặc HSE lập CAPA',               actionType:'create', minLevel:3, requiredDomain:['qaqc','hse']},
      {stepId:'assign',   label:'CH Trưởng giao nhiệm vụ xử lý',         actionType:'review', minLevel:3, requiredDomain:['site','cross']},
      {stepId:'implement',label:'Bên xử lý thực hiện hành động',         actionType:'create', minLevel:1},
      {stepId:'verify',   label:'QA/QC hoặc HSE xác nhận đã xử lý',      actionType:'review', minLevel:3, requiredDomain:['qaqc','hse','cross']},
      {stepId:'close',    label:'PM đóng CAPA',                          actionType:'r_a',    minLevel:4, pinRequired:true},
    ],
  },

  // ── G. NHÂN SỰ ───────────────────────────────────────

  LEAVE_REQUEST: {
    docType:'LEAVE_REQUEST', label:'Đề xuất nghỉ phép', icon:'🏖️',
    group:'G', groupLabel:'Nhân sự', category:'internal',
    createdBy:{minLevel:1, domains:['site','warehouse','admin','finance','qs','qaqc','hse']},
    pdfExportAfterStep:'approve',
    steps:[
      {stepId:'create', label:'Nhân viên lập đơn nghỉ phép', actionType:'create', minLevel:1},
      {stepId:'approve',label:'CH Phó / Trưởng duyệt',       actionType:'r_a',   minLevel:3, requiredDomain:['site','cross'], pinRequired:true},
    ],
  },

  DISCIPLINE: {
    docType:'DISCIPLINE', label:'Xử lý kỷ luật', icon:'📌',
    group:'G', groupLabel:'Nhân sự', category:'internal',
    createdBy:{minLevel:3, domains:['site','admin','cross']}, pdfExportAfterStep:'approve_l4',
    steps:[
      {stepId:'create',    label:'HR / CH Phó lập hồ sơ xử lý', actionType:'create', minLevel:3, requiredDomain:['site','admin','cross']},
      {stepId:'review_l4', label:'PM xem xét',                  actionType:'review', minLevel:4},
      {stepId:'approve_l4',label:'PM quyết định hình thức',      actionType:'r_a',    minLevel:4, pinRequired:true},
      {stepId:'notify',    label:'Thông báo cho đương sự',      actionType:'notify', autoAdvance:true},
    ],
  },

  // ── LEGACY ───────────────────────────────────────────

  ACCEPTANCE: {
    docType:'ACCEPTANCE', label:'BBNT (Legacy)', icon:'✅',
    group:'B', groupLabel:'QS / Hợp đồng', category:'project',
    createdBy:{minLevel:2, domains:['site']}, pdfExportAfterStep:'sign_ch',
    steps:[
      {stepId:'create',        label:'KS Giám sát lập BBNT',    actionType:'create', minLevel:2, requiredDomain:['site']},
      {stepId:'review_qs',     label:'QS xác nhận KL',          actionType:'review', minLevel:2, requiredDomain:['qs','cross']},
      {stepId:'sign_ch',       label:'CH Trưởng ký',            actionType:'approve',minLevel:3, requiredDomain:['site','cross'], pinRequired:true},
      {stepId:'external_sign', label:'CĐT / TVGS ký',           actionType:'sign',   externalSign:true},
      {stepId:'upload_signed', label:'Upload bản đã ký',        actionType:'upload', minLevel:1},
    ],
  },

  PROCUREMENT_LEGACY: {
    docType:'PROCUREMENT_LEGACY', label:'Đề xuất Mua sắm (Legacy)', icon:'🛒',
    group:'D', groupLabel:'Procurement & Vendor', category:'internal',
    createdBy:{minLevel:2, domains:['site','warehouse','qs','qaqc','hse']},
    pdfExportAfterStep:'approve_l4',
    steps:[
      {stepId:'create',      label:'Nhân viên lập đề xuất',          actionType:'create', minLevel:2},
      {stepId:'approve_dept',label:'Trưởng bộ phận duyệt',           actionType:'r_a',    minLevel:3, requiredDomain:['cross'], pinRequired:true, thresholdKey:'L3_max', skipIfAbove:'L3_max'},
      {stepId:'approve_l4',  label:'PM phê duyệt & ngân sách',       actionType:'approve',minLevel:4, pinRequired:true, skipIfBelow:'L3_max'},
      {stepId:'approve_l5',  label:'GĐ ký',                          actionType:'approve',minLevel:5, pinRequired:true},
    ],
  },
};

// ─────────────────────────────────────────────────
// USER CONTEXT
// ─────────────────────────────────────────────────

// ─────────────────────────────────────────────────
// PROJECT SCOPE — giới hạn phạm vi công trình
// ─────────────────────────────────────────────────

/**
 * ProjectScope — quy tắc xem công trình theo cấp bậc:
 *
 *  'all'      — L4+ (GĐ, PM, KT trưởng): thấy mọi dự án trong portfolio
 *  'assigned' — L3  (CHT, CHPhó, Trưởng QS/QC/HSE): chỉ thấy dự án được gán.
 *               Có thể support nhiều dự án nhưng phải được gán rõ ràng.
 *  'single'   — L1-L2 (site ops): bị gán cố định vào 1 dự án duy nhất.
 *               Tuyệt đối không được xem dự án khác.
 */
