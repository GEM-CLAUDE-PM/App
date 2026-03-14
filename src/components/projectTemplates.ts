/**
 * projectTemplates.ts  —  GEM&CLAUDE PM Pro  S6
 * ══════════════════════════════════════════════════════════════════════════
 * 5 Project Template Presets — cấu hình nhanh cho loại dự án phổ biến.
 *
 * Templates:
 *   1. NHÀ Ở DÂN DỤNG        — Căn hộ / nhà phố / biệt thự nhỏ
 *   2. CHUNG CƯ CAO TẦNG      — Apartment complex, 10+ tầng
 *   3. HẠ TẦNG KỸ THUẬT      — Đường, cầu, hệ thống thoát nước
 *   4. CÔNG NGHIỆP / NHÀ XƯỞNG — Factory, warehouse, khu CN
 *   5. DÂN DỤNG THƯƠNG MẠI   — Shophouse, TTTM, văn phòng
 *
 * Mỗi template bao gồm:
 *   • Cấu hình nhóm thành viên (roles + số lượng gợi ý)
 *   • Ngưỡng phê duyệt (thresholds) mặc định
 *   • Workflows được bật/tắt theo đặc thù
 *   • Timeline / milestones gợi ý
 *   • Checklist QA/QC đặc trưng
 *   • Risk profile
 * ══════════════════════════════════════════════════════════════════════════
 */

import type { RoleId } from './permissions';
import type { DocType } from './permissions';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type ProjectTypeId =
  | 'nha_o_dan_dung'
  | 'chung_cu_cao_tang'
  | 'ha_tang_ky_thuat'
  | 'cong_nghiep_nha_xuong'
  | 'dan_dung_thuong_mai'
  | 'cai_tao_noi_that';

export interface RoleSlot {
  roleId:       RoleId;
  count:        number;        // Số người gợi ý cho slot này
  required:     boolean;
  description?: string;
}

export interface ThresholdPreset {
  L3_max:          number;    // CHT / CHPhó duyệt tối đa
  L4_max:          number;    // PM duyệt tối đa
  warehouse_exit:  number;    // Xuất kho tối đa / phiếu
  payment:         number;    // Thanh toán tối đa / lần
  petty_cash:      number;    // Tiền mặt tạp vụ tối đa
}

export interface MilestoneTemplate {
  name:        string;
  offsetDays:  number;        // Từ ngày khởi công
  type:        'start' | 'milestone' | 'finish';
  description: string;
}

export interface QAChecklist {
  category: string;
  items:    string[];
}

export interface RiskItem {
  risk:        string;
  likelihood:  'cao' | 'trung_binh' | 'thap';
  impact:      'cao' | 'trung_binh' | 'thap';
  mitigation:  string;
}

export interface ProjectTemplate {
  id:           ProjectTypeId;
  name:         string;
  shortName:    string;
  icon:         string;
  color:        string;       // Tailwind color name
  description:  string;
  typicalScale: string;       // VD: "500 m² – 5.000 m²"
  typicalBudget:string;       // VD: "3 – 50 tỷ đồng"
  duration:     string;       // VD: "6 – 18 tháng"

  /** Gợi ý cơ cấu nhân sự */
  teamStructure: RoleSlot[];

  /** Ngưỡng phê duyệt mặc định */
  thresholds: ThresholdPreset;

  /** DocTypes được kích hoạt (subset của 28) */
  activeDocTypes: DocType[];

  /** DocTypes được ưu tiên hiển thị trong WorkspaceActionBar */
  priorityDocTypes: DocType[];

  /** Milestones gợi ý */
  milestones: MilestoneTemplate[];

  /** QA/QC checklists đặc trưng */
  qaChecklists: QAChecklist[];

  /** Risk profile */
  risks: RiskItem[];

  /** Ghi chú đặc thù */
  notes: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 1 — NHÀ Ở DÂN DỤNG
// ─────────────────────────────────────────────────────────────────────────────

const NHA_O_DAN_DUNG: ProjectTemplate = {
  id:           'nha_o_dan_dung',
  name:         'Nhà ở dân dụng',
  shortName:    'Dân dụng',
  icon:         '🏠',
  color:        'emerald',
  description:  'Nhà phố, biệt thự, căn hộ riêng lẻ. Quy mô nhỏ, ít tầng, chu kỳ ngắn.',
  typicalScale: '100 – 2.000 m²',
  typicalBudget:'500 triệu – 15 tỷ đồng',
  duration:     '4 – 12 tháng',

  teamStructure: [
    { roleId: 'pm',              count: 1, required: true,  description: 'Quản lý dự án kiêm giám sát' },
    { roleId: 'chi_huy_truong',  count: 1, required: true,  description: 'Chỉ huy thi công' },
    { roleId: 'ks_giam_sat',     count: 1, required: false, description: 'KS kỹ thuật kiêm QA/QC' },
    { roleId: 'thu_kho',         count: 1, required: false, description: 'Thủ kho kiêm thủ quỹ' },
    { roleId: 'ke_toan_site',    count: 1, required: true,  description: 'Kế toán tổng hợp' },
  ],

  thresholds: {
    L3_max:         20_000_000,   // 20 triệu
    L4_max:        200_000_000,   // 200 triệu
    warehouse_exit:  5_000_000,   // 5 triệu / phiếu
    payment:        50_000_000,   // 50 triệu / lần
    petty_cash:      2_000_000,   // 2 triệu tiền mặt
  },

  activeDocTypes: [
    'MATERIAL_REQUEST', 'WAREHOUSE_EXIT', 'WAREHOUSE_ENTRY',
    'FINANCIAL_VOUCHER', 'TIMESHEET', 'OVERTIME_REQUEST',
    'LEAVE_REQUEST', 'HSE_INCIDENT', 'PERMIT_TO_WORK',
    'NCR', 'INSPECTION_REQUEST', 'ITP_MANAGEMENT',
    'PAYMENT_REQUEST', 'ACCEPTANCE_INTERNAL',
  ],

  priorityDocTypes: [
    'MATERIAL_REQUEST', 'WAREHOUSE_EXIT', 'PAYMENT_REQUEST',
    'TIMESHEET', 'NCR',
  ],

  milestones: [
    { name: 'Khởi công',           offsetDays: 0,   type: 'start',     description: 'Lễ khởi công, triển khai mặt bằng' },
    { name: 'Hoàn thành móng',     offsetDays: 45,  type: 'milestone', description: 'Đào móng, đổ bê tông móng xong' },
    { name: 'Hoàn thành thô',      offsetDays: 120, type: 'milestone', description: 'Xây tường, đổ sàn, mái xong' },
    { name: 'Hoàn thiện 50%',      offsetDays: 210, type: 'milestone', description: 'Trát, lát, cơ điện nổi' },
    { name: 'Hoàn công & bàn giao',offsetDays: 330, type: 'finish',    description: 'Nghiệm thu CĐT, bàn giao' },
  ],

  qaChecklists: [
    {
      category: 'Móng & Nền',
      items: [
        'Kiểm tra độ sâu đào móng theo thiết kế',
        'Nghiệm thu cốt thép móng trước khi đổ BT',
        'Kiểm tra mác BT và phiếu thí nghiệm',
        'Kiểm tra chiều dày lớp bê tông bảo vệ',
      ],
    },
    {
      category: 'Kết cấu',
      items: [
        'Kiểm tra ván khuôn trước khi đổ',
        'Nghiệm thu cốt thép dầm sàn',
        'Kiểm tra độ đặc chắc BT sau đổ',
        'Kiểm tra kích thước tiết diện',
      ],
    },
    {
      category: 'Hoàn thiện',
      items: [
        'Kiểm tra độ phẳng tường trát',
        'Kiểm tra chống thấm nhà vệ sinh',
        'Nghiệm thu hệ thống điện chiếu sáng',
        'Kiểm tra nước sinh hoạt & thoát nước',
      ],
    },
  ],

  risks: [
    { risk: 'Thay đổi thiết kế nhiều lần', likelihood: 'cao', impact: 'trung_binh', mitigation: 'Lock bản vẽ trước thi công, BOM phê duyệt trước' },
    { risk: 'Chủ nhà can thiệp trực tiếp', likelihood: 'cao', impact: 'cao',        mitigation: 'Có biên bản xác nhận mỗi thay đổi' },
    { risk: 'Thiếu nhân công tay nghề',    likelihood: 'trung_binh', impact: 'cao', mitigation: 'Ký hợp đồng nhóm thợ trước 2 tuần' },
  ],

  notes: [
    'Chủ đầu tư thường ở gần công trường — cần giao tiếp thường xuyên',
    'Quản lý vật tư chặt chẽ, dễ thất thoát quy mô nhỏ',
    'Ưu tiên đổ BT liên tục, tránh mạch lạnh',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 2 — CHUNG CƯ CAO TẦNG
// ─────────────────────────────────────────────────────────────────────────────

const CHUNG_CU_CAO_TANG: ProjectTemplate = {
  id:           'chung_cu_cao_tang',
  name:         'Chung cư cao tầng',
  shortName:    'Cao tầng',
  icon:         '🏢',
  color:        'blue',
  description:  'Chung cư, apartment complex, cao 10+ tầng. Phức tạp kỹ thuật, nhiều ban.',
  typicalScale: '10.000 – 100.000 m²',
  typicalBudget:'50 – 500 tỷ đồng',
  duration:     '24 – 48 tháng',

  teamStructure: [
    { roleId: 'giam_doc',        count: 1, required: true,  description: 'Giám đốc dự án' },
    { roleId: 'pm',              count: 1, required: true,  description: 'PM điều phối' },
    { roleId: 'chi_huy_truong',  count: 2, required: true,  description: 'CHT theo block / khu' },
    { roleId: 'chi_huy_pho',     count: 3, required: true,  description: 'CHPhó theo ca' },
    { roleId: 'ks_giam_sat',     count: 4, required: true,  description: 'KS chuyên ngành (KT, ĐN, CĐ, cơ điện)' },
    { roleId: 'truong_qs',       count: 1, required: true,  description: 'Trưởng QS' },
    { roleId: 'qs_site',         count: 2, required: true,  description: 'QS đo lường' },
    { roleId: 'truong_qaqc',     count: 1, required: true,  description: 'Trưởng QA/QC' },
    { roleId: 'qaqc_site',       count: 3, required: true,  description: 'QC theo hạng mục' },
    { roleId: 'truong_hse',      count: 1, required: true,  description: 'Trưởng HSE' },
    { roleId: 'hse_site',        count: 2, required: true,  description: 'Nhân viên HSE' },
    { roleId: 'ke_toan_truong',  count: 1, required: true,  description: 'KT trưởng' },
    { roleId: 'ke_toan_site',    count: 2, required: true,  description: 'KT phụ trách thanh toán' },
    { roleId: 'thu_kho',         count: 2, required: true,  description: 'Thủ kho vật liệu / thiết bị' },
  ],

  thresholds: {
    L3_max:        100_000_000,   // 100 triệu
    L4_max:      1_000_000_000,   // 1 tỷ
    warehouse_exit: 50_000_000,   // 50 triệu / phiếu
    payment:       200_000_000,   // 200 triệu / lần
    petty_cash:      5_000_000,   // 5 triệu tiền mặt
  },

  activeDocTypes: [
    'MATERIAL_REQUEST', 'WAREHOUSE_EXIT', 'WAREHOUSE_ENTRY', 'STOCK_TAKE',
    'VARIATION_ORDER', 'ACCEPTANCE_INTERNAL', 'ACCEPTANCE_OWNER',
    'PAYMENT_REQUEST', 'CONTRACT_AMENDMENT', 'SUBCONTRACT_PAYMENT',
    'FINANCIAL_VOUCHER', 'TIMESHEET', 'OVERTIME_REQUEST',
    'PROCUREMENT', 'MATERIAL_APPROVAL', 'MATERIAL_INCOMING',
    'VENDOR_PREQUALIFICATION', 'VENDOR_EVALUATION',
    'NCR', 'RFI', 'INSPECTION_REQUEST', 'ITP_MANAGEMENT',
    'METHOD_STATEMENT', 'DRAWING_REVISION', 'QUALITY_AUDIT', 'TESTING_LAB',
    'HSE_INCIDENT', 'PERMIT_TO_WORK', 'HSE_INSPECTION', 'CAPA',
    'LEAVE_REQUEST', 'DISCIPLINE',
  ],

  priorityDocTypes: [
    'VARIATION_ORDER', 'PAYMENT_REQUEST', 'SUBCONTRACT_PAYMENT',
    'NCR', 'PERMIT_TO_WORK', 'ACCEPTANCE_OWNER', 'MATERIAL_REQUEST',
  ],

  milestones: [
    { name: 'Khởi công',               offsetDays: 0,   type: 'start',     description: 'Triển khai mặt bằng, cọc' },
    { name: 'Xong tầng hầm',            offsetDays: 120, type: 'milestone', description: 'Top down / bottom up xong' },
    { name: 'Hoàn thành tầng 1',        offsetDays: 180, type: 'milestone', description: 'Cột vách tầng 1 xong' },
    { name: 'Đổ mái tầng kỹ thuật',     offsetDays: 600, type: 'milestone', description: 'Kết thúc phần thô' },
    { name: 'Hoàn thiện 50%',           offsetDays: 900, type: 'milestone', description: 'Cơ điện ẩn, trát, lát' },
    { name: 'Nghiệm thu PCCC',          offsetDays:1100, type: 'milestone', description: 'Hoàn thiện hệ thống PCCC' },
    { name: 'Bàn giao đợt 1',           offsetDays:1200, type: 'milestone', description: 'Block A bàn giao' },
    { name: 'Hoàn công toàn bộ',        offsetDays:1400, type: 'finish',    description: 'Nghiệm thu + hoàn công' },
  ],

  qaChecklists: [
    {
      category: 'Cọc & Móng bè',
      items: [
        'Kiểm tra hồ sơ địa chất trước thi công cọc',
        'Nghiệm thu âm PDT từng cọc',
        'Kiểm tra cao độ đầu cọc sau khi cắt',
        'Nghiệm thu cốt thép đài cọc / móng bè',
        'Phiếu thí nghiệm BT móng (mác, mẫu thử)',
      ],
    },
    {
      category: 'Kết cấu tầng điển hình',
      items: [
        'Nghiệm thu cốt thép cột, vách trước đổ',
        'Kiểm tra ván khuôn sàn — độ võng, chống đỡ',
        'Nghiệm thu cốt thép sàn, dầm',
        'Thí nghiệm BT tươi (độ sụt, mẫu lập phương)',
        'Kiểm tra tháo ván khuôn đúng thời gian',
      ],
    },
    {
      category: 'Cơ điện & PCCC',
      items: [
        'Kiểm tra sơ đồ ống ngầm trước lấp bê tông',
        'Nghiệm thu điện trước trát (dây, hộp)',
        'Test áp lực hệ thống nước / chữa cháy',
        'Nghiệm thu hệ thống thang máy',
        'Kiểm tra hệ thống BMS / SCADA',
      ],
    },
  ],

  risks: [
    { risk: 'Biến động giá vật liệu',       likelihood: 'cao',       impact: 'cao',       mitigation: 'Điều khoản trượt giá trong HĐ, mua trước vật liệu chính' },
    { risk: 'Thay đổi thiết kế kết cấu',    likelihood: 'trung_binh',impact: 'cao',       mitigation: 'RFI nhanh, họp kỹ thuật tuần' },
    { risk: 'Thiếu lao động cao điểm',      likelihood: 'cao',       impact: 'cao',       mitigation: 'Hợp đồng thầu phụ sớm, kế hoạch nhân lực 3 tháng' },
    { risk: 'Sự cố cần trục / thiết bị',    likelihood: 'trung_binh',impact: 'cao',       mitigation: 'Bảo dưỡng định kỳ, PERMIT_TO_WORK, dự phòng cần trục' },
    { risk: 'Khiếu nại hàng xóm (tiếng ồn)',likelihood: 'cao',       impact: 'trung_binh',mitigation: 'Thông báo, giới hạn giờ thi công, rào chắn' },
  ],

  notes: [
    'Bắt buộc có PERMIT_TO_WORK cho mọi công việc trên cao > 2m',
    'VARIATION_ORDER phải được PM duyệt trước khi thi công',
    'Báo cáo tiến độ hàng tuần gửi Chủ đầu tư',
    'Kiểm soát thầu phụ chặt qua VENDOR_EVALUATION định kỳ',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 3 — HẠ TẦNG KỸ THUẬT
// ─────────────────────────────────────────────────────────────────────────────

const HA_TANG_KY_THUAT: ProjectTemplate = {
  id:           'ha_tang_ky_thuat',
  name:         'Hạ tầng kỹ thuật',
  shortName:    'Hạ tầng',
  icon:         '🛣️',
  color:        'amber',
  description:  'Đường giao thông, cầu, cống, hệ thống thoát nước, hạ tầng KCN.',
  typicalScale: '1 – 50 km / hạng mục',
  typicalBudget:'10 – 2.000 tỷ đồng',
  duration:     '12 – 60 tháng',

  teamStructure: [
    { roleId: 'giam_doc',        count: 1, required: true,  description: 'Giám đốc dự án' },
    { roleId: 'pm',              count: 2, required: true,  description: 'PM theo gói thầu / đoạn' },
    { roleId: 'chi_huy_truong',  count: 3, required: true,  description: 'CHT theo đoạn / hạng mục' },
    { roleId: 'chi_huy_pho',     count: 4, required: true,  description: 'CHPhó theo ca / công việc' },
    { roleId: 'ks_giam_sat',     count: 5, required: true,  description: 'KS kỹ thuật (nền đất, kết cấu, GTVT)' },
    { roleId: 'truong_qs',       count: 1, required: true,  description: 'Trưởng QS + đo bóc' },
    { roleId: 'qs_site',         count: 3, required: true,  description: 'QS theo đoạn' },
    { roleId: 'qaqc_site',       count: 3, required: true,  description: 'QC vật liệu + thi công' },
    { roleId: 'hse_site',        count: 3, required: true,  description: 'HSE — an toàn giao thông thi công' },
    { roleId: 'ke_toan_site',    count: 2, required: true,  description: 'KT theo gói' },
    { roleId: 'thu_kho',         count: 3, required: true,  description: 'Kho vật liệu + thiết bị' },
  ],

  thresholds: {
    L3_max:        200_000_000,   // 200 triệu
    L4_max:      2_000_000_000,   // 2 tỷ
    warehouse_exit:100_000_000,   // 100 triệu / phiếu (vật liệu hạ tầng khối lớn)
    payment:       500_000_000,   // 500 triệu / lần
    petty_cash:      5_000_000,   // 5 triệu
  },

  activeDocTypes: [
    'MATERIAL_REQUEST', 'WAREHOUSE_EXIT', 'WAREHOUSE_ENTRY', 'STOCK_TAKE',
    'VARIATION_ORDER', 'ACCEPTANCE_INTERNAL', 'ACCEPTANCE_OWNER',
    'PAYMENT_REQUEST', 'CONTRACT_AMENDMENT', 'SUBCONTRACT_PAYMENT',
    'FINANCIAL_VOUCHER', 'TIMESHEET', 'OVERTIME_REQUEST',
    'PROCUREMENT', 'MATERIAL_APPROVAL', 'MATERIAL_INCOMING', 'VENDOR_EVALUATION',
    'NCR', 'RFI', 'INSPECTION_REQUEST', 'ITP_MANAGEMENT',
    'METHOD_STATEMENT', 'TESTING_LAB', 'QUALITY_AUDIT',
    'HSE_INCIDENT', 'PERMIT_TO_WORK', 'HSE_INSPECTION', 'CAPA',
    'LEAVE_REQUEST',
  ],

  priorityDocTypes: [
    'VARIATION_ORDER', 'ACCEPTANCE_INTERNAL', 'TESTING_LAB',
    'METHOD_STATEMENT', 'PERMIT_TO_WORK', 'PAYMENT_REQUEST',
  ],

  milestones: [
    { name: 'Bàn giao mặt bằng',      offsetDays: 0,   type: 'start',     description: 'GPMB toàn tuyến' },
    { name: 'Nền đường K95',           offsetDays: 90,  type: 'milestone', description: 'Đắp nền, lu lèn đạt K95' },
    { name: 'Cống thoát nước xong',    offsetDays: 150, type: 'milestone', description: 'Toàn bộ cống qua đường' },
    { name: 'Mặt đường cấp phối',      offsetDays: 240, type: 'milestone', description: 'Lớp cấp phối đá dăm' },
    { name: 'Thảm BTN lớp dưới',       offsetDays: 300, type: 'milestone', description: 'BTN thô đạt độ chặt' },
    { name: 'Thảm BTN mặt',            offsetDays: 360, type: 'milestone', description: 'Lớp mặt hoàn chỉnh' },
    { name: 'Vỉa hè, chiếu sáng',      offsetDays: 420, type: 'milestone', description: 'Hạ tầng hoàn thiện' },
    { name: 'Nghiệm thu đưa vào SD',   offsetDays: 450, type: 'finish',    description: 'Nghiệm thu Nhà nước' },
  ],

  qaChecklists: [
    {
      category: 'Nền đường',
      items: [
        'Thí nghiệm độ đầm chặt lu lèn (K)',
        'Kiểm tra cao độ thiết kế nền',
        'Thí nghiệm CBR đất nền',
        'Kiểm tra độ phẳng bề mặt nền',
      ],
    },
    {
      category: 'Mặt đường BTN',
      items: [
        'Lấy mẫu BTN tại nhà máy + hiện trường',
        'Kiểm tra nhiệt độ rải BTN',
        'Thí nghiệm độ chặt mẫu khoan (K)',
        'Kiểm tra chiều dày lớp BTN',
        'Đo độ nhám bề mặt IRI',
      ],
    },
    {
      category: 'Cầu & Cống',
      items: [
        'Nghiệm thu cốt thép cống / trụ cầu',
        'Thí nghiệm BT kết cấu (R28)',
        'Kiểm tra khe co giãn, gối cầu',
        'Thử tải tĩnh cầu trước nghiệm thu',
      ],
    },
  ],

  risks: [
    { risk: 'GPMB chậm',                   likelihood: 'cao',       impact: 'cao',       mitigation: 'Theo dõi từng thửa, escalate sớm lên PMU' },
    { risk: 'Mưa lũ ảnh hưởng tiến độ',    likelihood: 'cao',       impact: 'cao',       mitigation: 'Kế hoạch thi công theo mùa, dự phòng nhân lực' },
    { risk: 'Biến động giá nhựa đường',     likelihood: 'trung_binh',impact: 'cao',       mitigation: 'Điều khoản trượt giá BTN trong HĐ' },
    { risk: 'Tai nạn giao thông thi công',  likelihood: 'trung_binh',impact: 'cao',       mitigation: 'Rào chắn, biển báo, HSE on-site 24/7' },
    { risk: 'Thiếu thiết bị rải thảm',      likelihood: 'thap',      impact: 'cao',       mitigation: 'Dự phòng hợp đồng thuê máy chờ' },
  ],

  notes: [
    'Tuyệt đối tuân thủ QCVN về an toàn giao thông thi công',
    'Method Statement cho mỗi hạng mục phải được TVGS phê duyệt',
    'Thí nghiệm vật liệu đầu vào 100% (không miễn trừ)',
    'Biên bản nghiệm thu phải đủ chữ ký TVGS + Chủ đầu tư',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 4 — CÔNG NGHIỆP / NHÀ XƯỞNG
// ─────────────────────────────────────────────────────────────────────────────

const CONG_NGHIEP_NHA_XUONG: ProjectTemplate = {
  id:           'cong_nghiep_nha_xuong',
  name:         'Công nghiệp / Nhà xưởng',
  shortName:    'Công nghiệp',
  icon:         '🏭',
  color:        'slate',
  description:  'Nhà xưởng sản xuất, kho hàng, trung tâm logistics, khu công nghiệp.',
  typicalScale: '2.000 – 50.000 m²',
  typicalBudget:'5 – 200 tỷ đồng',
  duration:     '6 – 24 tháng',

  teamStructure: [
    { roleId: 'pm',              count: 1, required: true,  description: 'PM kiêm GĐ dự án' },
    { roleId: 'chi_huy_truong',  count: 1, required: true,  description: 'CHT kết cấu' },
    { roleId: 'chi_huy_pho',     count: 2, required: true,  description: 'CHPhó cơ điện / hạ tầng' },
    { roleId: 'ks_giam_sat',     count: 3, required: true,  description: 'KS kết cấu thép + cơ điện + nền móng' },
    { roleId: 'qaqc_site',       count: 2, required: true,  description: 'QC thép kết cấu, nền' },
    { roleId: 'hse_site',        count: 2, required: true,  description: 'HSE (xưởng có nhiều rủi ro hàn, sơn)' },
    { roleId: 'ke_toan_site',    count: 1, required: true,  description: 'KT site' },
    { roleId: 'thu_kho',         count: 2, required: true,  description: 'Kho thép, kho vật liệu' },
    { roleId: 'qs_site',         count: 1, required: false, description: 'QS đo bóc' },
  ],

  thresholds: {
    L3_max:         50_000_000,   // 50 triệu
    L4_max:        500_000_000,   // 500 triệu
    warehouse_exit: 30_000_000,   // 30 triệu / phiếu
    payment:       100_000_000,   // 100 triệu / lần
    petty_cash:      3_000_000,   // 3 triệu
  },

  activeDocTypes: [
    'MATERIAL_REQUEST', 'WAREHOUSE_EXIT', 'WAREHOUSE_ENTRY', 'STOCK_TAKE',
    'VARIATION_ORDER', 'ACCEPTANCE_INTERNAL', 'PAYMENT_REQUEST',
    'SUBCONTRACT_PAYMENT', 'FINANCIAL_VOUCHER', 'TIMESHEET',
    'PROCUREMENT', 'MATERIAL_APPROVAL', 'MATERIAL_INCOMING', 'VENDOR_EVALUATION',
    'NCR', 'INSPECTION_REQUEST', 'ITP_MANAGEMENT', 'METHOD_STATEMENT', 'TESTING_LAB',
    'HSE_INCIDENT', 'PERMIT_TO_WORK', 'HSE_INSPECTION', 'CAPA',
    'LEAVE_REQUEST', 'OVERTIME_REQUEST',
  ],

  priorityDocTypes: [
    'MATERIAL_REQUEST', 'PERMIT_TO_WORK', 'ACCEPTANCE_INTERNAL',
    'PAYMENT_REQUEST', 'NCR', 'VENDOR_EVALUATION',
  ],

  milestones: [
    { name: 'Khởi công',                 offsetDays: 0,   type: 'start',     description: 'San lấp, định vị' },
    { name: 'Xong nền móng',             offsetDays: 60,  type: 'milestone', description: 'Cọc khoan nhồi + đài móng' },
    { name: 'Dựng cột thép',             offsetDays: 120, type: 'milestone', description: 'Kết cấu thép chính' },
    { name: 'Mái tôn hoàn thành',        offsetDays: 160, type: 'milestone', description: 'Phần mái kín nước' },
    { name: 'Tường bao, cửa lớn',        offsetDays: 200, type: 'milestone', description: 'Hoàn thiện vỏ ngoài' },
    { name: 'Hệ thống điện + PCCC',      offsetDays: 260, type: 'milestone', description: 'Nghiệm thu hệ thống' },
    { name: 'Sàn epoxy / sàn công nghiệp',offsetDays:300, type: 'milestone', description: 'Hoàn thiện nội thất' },
    { name: 'Bàn giao',                  offsetDays: 330, type: 'finish',    description: 'Nghiệm thu + bàn giao' },
  ],

  qaChecklists: [
    {
      category: 'Nền & Cọc',
      items: [
        'Thí nghiệm tải trọng cọc thử',
        'Kiểm tra cao độ đầu cọc',
        'Nghiệm thu nền sàn (CBR, độ chặt K)',
      ],
    },
    {
      category: 'Kết cấu thép',
      items: [
        'Kiểm tra chứng chỉ xuất xứ thép (Mill Certificate)',
        'Nghiệm thu mối hàn (VT + UT hoặc RT)',
        'Kiểm tra bu lông cường độ cao (lực xiết)',
        'Kiểm tra lớp sơn chống gỉ + bề dày DFT',
        'Kiểm tra độ thẳng đứng cột thép',
      ],
    },
    {
      category: 'Hệ thống MEP',
      items: [
        'Test áp lực đường ống PCCC',
        'Đo kiểm hệ thống điện (cách điện, nối đất)',
        'Test hệ thống quạt thông gió',
      ],
    },
  ],

  risks: [
    { risk: 'Chất lượng thép kết cấu',     likelihood: 'trung_binh',impact: 'cao',       mitigation: 'Kiểm tra Mill Certificate, thử kéo mẫu' },
    { risk: 'Tai nạn hàn trên cao',         likelihood: 'cao',       impact: 'cao',       mitigation: 'PERMIT_TO_WORK bắt buộc, dây an toàn' },
    { risk: 'Chậm giao thiết bị cơ điện',   likelihood: 'trung_binh',impact: 'cao',       mitigation: 'Đặt hàng sớm 12 tuần, theo dõi lead time' },
    { risk: 'Lún lệch nền sàn công nghiệp', likelihood: 'thap',      impact: 'cao',       mitigation: 'Địa chất kỹ, gia tải thử trước đổ sàn' },
  ],

  notes: [
    'PERMIT_TO_WORK bắt buộc cho hàn, làm việc trên cao, điện cao thế',
    'Kiểm tra mill certificate toàn bộ thép trước khi nhập kho',
    'Sàn công nghiệp cần thời gian bảo dưỡng 28 ngày — lập kế hoạch sớm',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 5 — DÂN DỤNG THƯƠNG MẠI
// ─────────────────────────────────────────────────────────────────────────────

const DAN_DUNG_THUONG_MAI: ProjectTemplate = {
  id:           'dan_dung_thuong_mai',
  name:         'Dân dụng thương mại',
  shortName:    'Thương mại',
  icon:         '🏬',
  color:        'violet',
  description:  'Shophouse, trung tâm thương mại, văn phòng, khách sạn.',
  typicalScale: '2.000 – 30.000 m²',
  typicalBudget:'20 – 300 tỷ đồng',
  duration:     '18 – 36 tháng',

  teamStructure: [
    { roleId: 'pm',              count: 1, required: true,  description: 'PM chính' },
    { roleId: 'chi_huy_truong',  count: 1, required: true,  description: 'CHT kết cấu' },
    { roleId: 'chi_huy_pho',     count: 2, required: true,  description: 'CHPhó hoàn thiện / MEP' },
    { roleId: 'ks_giam_sat',     count: 3, required: true,  description: 'KS kết cấu, kiến trúc, MEP' },
    { roleId: 'truong_qs',       count: 1, required: true,  description: 'QS cao cấp (đơn giá thương mại phức tạp)' },
    { roleId: 'qs_site',         count: 2, required: true,  description: 'QS theo gói' },
    { roleId: 'qaqc_site',       count: 2, required: true,  description: 'QC hoàn thiện cao cấp' },
    { roleId: 'hse_site',        count: 1, required: true,  description: 'HSE' },
    { roleId: 'ke_toan_site',    count: 2, required: true,  description: 'KT thanh toán thầu phụ' },
    { roleId: 'thu_kho',         count: 1, required: true,  description: 'Kho vật tư' },
  ],

  thresholds: {
    L3_max:         80_000_000,   // 80 triệu
    L4_max:        800_000_000,   // 800 triệu
    warehouse_exit: 30_000_000,   // 30 triệu / phiếu
    payment:       200_000_000,   // 200 triệu / lần
    petty_cash:      5_000_000,   // 5 triệu
  },

  activeDocTypes: [
    'MATERIAL_REQUEST', 'WAREHOUSE_EXIT', 'WAREHOUSE_ENTRY',
    'VARIATION_ORDER', 'ACCEPTANCE_INTERNAL', 'ACCEPTANCE_OWNER',
    'PAYMENT_REQUEST', 'CONTRACT_AMENDMENT', 'SUBCONTRACT_PAYMENT',
    'FINANCIAL_VOUCHER', 'TIMESHEET', 'OVERTIME_REQUEST',
    'PROCUREMENT', 'MATERIAL_APPROVAL', 'VENDOR_EVALUATION',
    'NCR', 'RFI', 'INSPECTION_REQUEST', 'ITP_MANAGEMENT',
    'METHOD_STATEMENT', 'DRAWING_REVISION', 'QUALITY_AUDIT',
    'HSE_INCIDENT', 'PERMIT_TO_WORK', 'HSE_INSPECTION',
    'LEAVE_REQUEST', 'DISCIPLINE',
  ],

  priorityDocTypes: [
    'VARIATION_ORDER', 'SUBCONTRACT_PAYMENT', 'ACCEPTANCE_OWNER',
    'DRAWING_REVISION', 'NCR', 'PAYMENT_REQUEST',
  ],

  milestones: [
    { name: 'Khởi công',              offsetDays: 0,   type: 'start',     description: 'Mặt bằng + cọc' },
    { name: 'Xong tầng hầm',          offsetDays: 100, type: 'milestone', description: 'Tầng hầm kín nước' },
    { name: 'Hoàn thành kết cấu',     offsetDays: 400, type: 'milestone', description: 'Toàn bộ phần thô' },
    { name: 'Hoàn thiện ngoài',       offsetDays: 600, type: 'milestone', description: 'Mặt đứng, kính curtain wall' },
    { name: 'Hoàn thiện trong',       offsetDays: 800, type: 'milestone', description: 'Nội thất, cơ điện ẩn' },
    { name: 'Nghiệm thu PCCC / PVTM', offsetDays: 950, type: 'milestone', description: 'Đủ điều kiện hoạt động' },
    { name: 'Bàn giao thương mại',    offsetDays:1000, type: 'finish',    description: 'Soft opening' },
  ],

  qaChecklists: [
    {
      category: 'Kết cấu & Chống thấm',
      items: [
        'Nghiệm thu cốt thép sàn, dầm, cột',
        'Thí nghiệm thấm tầng hầm (bơm nước 24h)',
        'Kiểm tra lớp chống thấm mái + sân thượng',
      ],
    },
    {
      category: 'Hoàn thiện cao cấp',
      items: [
        'Kiểm tra độ phẳng sàn laser (±2mm/2m)',
        'Nghiệm thu đá granite, gạch ốp lát (đồng màu, không rỗng)',
        'Kiểm tra cửa kính, curtain wall (test nước, khe hở)',
        'Nghiệm thu thang máy, thang cuốn',
        'Test hệ thống BMS, camera, access control',
      ],
    },
    {
      category: 'MEP & PCCC',
      items: [
        'Test áp lực sprinkler từng vùng',
        'Đo kiểm hệ thống điều hòa (nhiệt độ, lưu lượng)',
        'Nghiệm thu hệ thống điện dự phòng (máy phát)',
        'Test hệ thống âm thanh sơ tán',
      ],
    },
  ],

  risks: [
    { risk: 'Thay đổi nội thất theo Tenant',  likelihood: 'cao',       impact: 'cao',       mitigation: 'Freeze design trước 3 tháng thi công hoàn thiện' },
    { risk: 'Trễ bàn giao mặt bằng cho thuê', likelihood: 'cao',       impact: 'cao',       mitigation: 'Buffer tiến độ 4 tuần, track milestones hàng tuần' },
    { risk: 'Tranh chấp đơn giá thầu phụ',    likelihood: 'trung_binh',impact: 'trung_binh',mitigation: 'BO chi tiết, đơn giá thực tế từ đầu' },
    { risk: 'Lỗi MEP ảnh hưởng vận hành',     likelihood: 'thap',      impact: 'cao',       mitigation: 'Commissioning test đủ 30 ngày trước bàn giao' },
  ],

  notes: [
    'DRAWING_REVISION phải được Kiến trúc sư + TVGS phê duyệt trước thi công',
    'Hoàn thiện cao cấp cần bảo vệ bề mặt sau thi công',
    'Tenant Coordination meeting hàng tuần từ tháng 12 trở đi',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 6 — CẢI TẠO & NỘI THẤT
// ─────────────────────────────────────────────────────────────────────────────

const CAI_TAO_NOI_THAT: ProjectTemplate = {
  id:           'cai_tao_noi_that',
  name:         'Cải tạo & Nội thất',
  shortName:    'Cải tạo',
  icon:         '🔨',
  color:        'rose',
  description:  'Sửa chữa, cải tạo công trình hiện hữu; thiết kế và thi công nội thất văn phòng, căn hộ, thương mại.',
  typicalScale: '20 – 2.000 m²',
  typicalBudget:'100 triệu – 10 tỷ đồng',
  duration:     '1 – 6 tháng',

  teamStructure: [
    { roleId: 'pm',           count: 1, required: true,  description: 'PM kiêm giám sát kỹ thuật' },
    { roleId: 'chi_huy_truong', count: 1, required: true, description: 'Chỉ huy thi công chính' },
    { roleId: 'ks_giam_sat',  count: 1, required: false, description: 'KS giám sát chất lượng hoàn thiện' },
    { roleId: 'ke_toan_site', count: 1, required: true,  description: 'Kế toán theo dõi chi phí' },
    { roleId: 'thu_kho',      count: 1, required: false, description: 'Thủ kho vật tư nội thất' },
  ],

  thresholds: {
    L3_max:          5_000_000,   // 5 triệu
    L4_max:         30_000_000,   // 30 triệu
    warehouse_exit:  1_000_000,   // 1 triệu / phiếu
    payment:        10_000_000,   // 10 triệu / lần
    petty_cash:        500_000,   // 500 nghìn tiền mặt
  },

  activeDocTypes: [
    'MATERIAL_REQUEST', 'WAREHOUSE_EXIT', 'WAREHOUSE_ENTRY',
    'VARIATION_ORDER',
    'ACCEPTANCE_INTERNAL', 'PAYMENT_REQUEST', 'SUBCONTRACT_PAYMENT',
    'FINANCIAL_VOUCHER', 'TIMESHEET', 'OVERTIME_REQUEST',
    'LEAVE_REQUEST',
    'NCR', 'INSPECTION_REQUEST',
    'HSE_INCIDENT', 'PERMIT_TO_WORK',
  ],

  priorityDocTypes: [
    'VARIATION_ORDER', 'PAYMENT_REQUEST', 'MATERIAL_REQUEST',
    'ACCEPTANCE_INTERNAL', 'TIMESHEET',
  ],

  milestones: [
    { name: 'Khảo sát & Ký HĐ',       offsetDays: 0,   type: 'start',     description: 'Khảo sát hiện trạng, ký hợp đồng, chốt thiết kế' },
    { name: 'Nghiệm thu phá dỡ',       offsetDays: 10,  type: 'milestone', description: 'Phá dỡ phần cũ, xử lý hạ tầng ẩn' },
    { name: 'Xây thô & Cơ điện ẩn',    offsetDays: 30,  type: 'milestone', description: 'Tường mới, ống điện nước ẩn trong tường' },
    { name: 'Hoàn thiện 50%',           offsetDays: 60,  type: 'milestone', description: 'Trát, lát nền, sơn lót' },
    { name: 'Lắp đặt nội thất',         offsetDays: 90,  type: 'milestone', description: 'Tủ, kệ, đèn, thiết bị vệ sinh' },
    { name: 'Nghiệm thu & Bàn giao',   offsetDays: 120, type: 'finish',    description: 'Vệ sinh công trình, bàn giao toàn bộ' },
  ],

  qaChecklists: [
    {
      category: 'Phá dỡ & Khảo sát ẩn',
      items: [
        'Xác định vị trí hộp kỹ thuật, đường ống trước phá dỡ',
        'Kiểm tra kết cấu dầm, sàn không bị ảnh hưởng khi phá dỡ',
        'Ghi nhận hiện trạng nứt, thấm, mục để xử lý triệt để',
        'Biên bản phá dỡ hoàn thành trước khi tiếp tục',
      ],
    },
    {
      category: 'Chống thấm & Hoàn thiện',
      items: [
        'Kiểm tra chống thấm nhà vệ sinh (test nước 24h)',
        'Kiểm tra độ phẳng tường trát (±3mm/2m)',
        'Kiểm tra độ phẳng sàn trước khi lát (±3mm/2m)',
        'Kiểm tra màu sơn khớp mẫu được duyệt',
        'Kiểm tra đường chỉ ốp lát thẳng, đều, khớp pattern',
      ],
    },
    {
      category: 'Nội thất & Cơ điện',
      items: [
        'Kiểm tra kích thước tủ, kệ khớp bản vẽ shop drawing',
        'Kiểm tra mối nối vật liệu không hở, không cong vênh',
        'Test điện chiếu sáng toàn bộ công tắc, ổ cắm',
        'Test vòi nước, xả bồn không rò rỉ',
        'Kiểm tra thiết bị điện tử (điều hòa, đèn thông minh) trước bàn giao',
      ],
    },
  ],

  risks: [
    { risk: 'Phát sinh hạng mục ẩn (hạ tầng cũ hỏng)', likelihood: 'cao',       impact: 'cao',       mitigation: 'Khảo sát kỹ trước HĐ, điều khoản VARIATION_ORDER phát sinh trong 3 ngày' },
    { risk: 'Chủ nhà thay đổi thiết kế giữa chừng',     likelihood: 'cao',       impact: 'trung_binh',mitigation: 'Freeze design sau khi ký biên bản xác nhận từng giai đoạn' },
    { risk: 'Thi công trong không gian đang sử dụng',    likelihood: 'trung_binh',impact: 'trung_binh',mitigation: 'Lịch thi công theo giờ, rào chắn bụi, PERMIT_TO_WORK' },
    { risk: 'Thầu phụ nội thất giao hàng trễ',          likelihood: 'trung_binh',impact: 'cao',       mitigation: 'Đặt hàng trước 4 tuần, penalt clause trong HĐ thầu phụ' },
    { risk: 'Màu vật liệu không khớp mẫu đã duyệt',     likelihood: 'thap',      impact: 'trung_binh',mitigation: 'Lấy mẫu duyệt trước, giữ mẫu làm chuẩn đối chiếu' },
  ],

  notes: [
    'VARIATION_ORDER là nghiệp vụ quan trọng nhất — cần xử lý trong 24h kể từ khi phát sinh',
    'Chụp ảnh hiện trạng toàn bộ trước khi phá dỡ làm bằng chứng',
    'Thi công trong giờ hành chính nếu CĐT vẫn sử dụng không gian',
    'Bảo vệ bề mặt hoàn thiện cao cấp sau thi công (gỗ, đá, kính)',
  ],
};
// ─────────────────────────────────────────────────────────────────────────────
// REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

export const PROJECT_TEMPLATES: Record<ProjectTypeId, ProjectTemplate> = {
  nha_o_dan_dung:       NHA_O_DAN_DUNG,
  chung_cu_cao_tang:    CHUNG_CU_CAO_TANG,
  ha_tang_ky_thuat:     HA_TANG_KY_THUAT,
  cong_nghiep_nha_xuong:CONG_NGHIEP_NHA_XUONG,
  dan_dung_thuong_mai:  DAN_DUNG_THUONG_MAI,
  cai_tao_noi_that:     CAI_TAO_NOI_THAT,
};

export const TEMPLATE_LIST = Object.values(PROJECT_TEMPLATES);

// ─────────────────────────────────────────────────────────────────────────────
// APPLY TEMPLATE — áp vào 1 project mới tạo
// ─────────────────────────────────────────────────────────────────────────────

export interface ApplyTemplateResult {
  thresholds:       ProjectTemplate['thresholds'];
  activeDocTypes:   DocType[];
  milestones:       MilestoneTemplate[];
  qaChecklists:     QAChecklist[];
  suggestedRoles:   RoleSlot[];
  risks:            RiskItem[];
  notes:            string[];
}

export function applyTemplate(
  templateId: ProjectTypeId,
  startDate?: Date,
): ApplyTemplateResult {
  const tpl = PROJECT_TEMPLATES[templateId];

  // Tính ngày milestone từ startDate
  const base = startDate || new Date();
  const milestones = tpl.milestones.map(m => ({
    ...m,
    date: new Date(base.getTime() + m.offsetDays * 86400000)
      .toLocaleDateString('vi-VN'),
  }));

  return {
    thresholds:     tpl.thresholds,
    activeDocTypes: tpl.activeDocTypes,
    milestones,
    qaChecklists:   tpl.qaChecklists,
    suggestedRoles: tpl.teamStructure,
    risks:          tpl.risks,
    notes:          tpl.notes,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSIST — lưu template choice vào project
// ─────────────────────────────────────────────────────────────────────────────

export function saveProjectTemplate(projectId: string, templateId: ProjectTypeId): void {
  localStorage.setItem(`gem_project_template_${projectId}`, templateId);
}

export function getProjectTemplate(projectId: string): ProjectTypeId | null {
  return localStorage.getItem(`gem_project_template_${projectId}`) as ProjectTypeId | null;
}
