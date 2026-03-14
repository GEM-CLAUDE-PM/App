// ReportTypes.ts — GEM&CLAUDE PM Pro
// Shared types, interfaces, constants, templates cho ReportsDashboard
// S11: 12 loại báo cáo nhà thầu
// S13: + báo cáo đột xuất/pháp lý
// S14: + báo cáo quyết toán/hoàn công/KPI

import React from 'react';
import {
  Calendar, BarChart2, TrendingUp, HardHat, FileSpreadsheet,
  CheckCircle2, DollarSign, Package, Wrench, PieChart,
  Users, Banknote,
} from 'lucide-react';

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — TYPES & INTERFACES
// ══════════════════════════════════════════════════════════════════════════════

export type ReportType =
  // S11 — định kỳ nhà thầu
  | 'daily'       // Nhật ký công trường
  | 'weekly'      // Báo cáo tiến độ tuần
  | 'monthly'     // Báo cáo tháng GĐ DA
  | 'hse'         // Báo cáo HSE định kỳ
  | 'qs'          // Báo cáo QS – Tài chính
  | 'handover'    // Biên bản nghiệm thu bàn giao
  | 'payment'     // Báo cáo thanh toán
  | 'materials'   // Báo cáo vật tư
  | 'equipment'   // Báo cáo thiết bị
  | 'finance'     // Báo cáo tài chính nội bộ
  | 'manpower'    // Báo cáo nhân lực định kỳ
  | 'payroll'     // Bảng lương tổng hợp
  // S13 — đột xuất/pháp lý (placeholder)
  | 'incident'    // Báo cáo sự cố
  | 'legal'       // Báo cáo pháp lý/công văn
  // S14 — quyết toán/KPI (placeholder)
  | 'final'       // Báo cáo quyết toán
  | 'kpi';        // Báo cáo KPI dự án

export type ReportStatus = 'draft' | 'pending' | 'signed';
export type ReportFormat = 'A4' | 'A3';
export type ReportGroup  = 'daily' | 'weekly' | 'monthly' | 'ondemand' | 'legal';
export type ReportAudience = 'contractor' | 'owner' | 'supervisor' | 'internal';

export interface SavedReport {
  id:         string;
  type:       ReportType;
  title:      string;
  content:    string;
  date:       string;
  createdBy:  string;
  status:     ReportStatus;
  projectId:  string;
  metadata?:  Record<string, string>;
}

export interface ReportTemplate {
  id:        ReportType;
  name:      string;
  badge:     string;
  desc:      string;
  format:    ReportFormat;
  group:     ReportGroup;
  audience:  ReportAudience[];
  frequency: string;
  bg:        string;
  badgeCls:  string;
  iconName:  string;          // tên lucide icon — render trong component
  fields:    string[];
  sprint:    'S11' | 'S13' | 'S14';  // sprint nào build template này
}

export interface ReportLiveData {
  // Nhân lực
  totalWorkers:   number;
  presentToday:   number;
  avgWorkers:     number;   // trung bình tháng
  otHoursMonth:   number;   // tổng OT tháng
  // HSE
  hseIncidents:   number;
  hseViolations:  number;
  hseTrainings:   number;
  ltiFreedays:    number;   // số ngày không tai nạn
  // Vật tư
  matApproved:    number;
  matPending:     number;
  matValue:       number;   // tổng giá trị nhập tháng (tỷ)
  // Thiết bị
  eqTotal:        number;
  eqActive:       number;
  eqMaintenance:  number;
  // QS / Tài chính
  qsTotal:        number;
  qsApproved:     number;
  qsValue:        number;   // tổng giá trị đã duyệt (tỷ)
  receivable:     number;   // phải thu (tỷ)
  payable:        number;   // phải trả (tỷ)
  cashflow:       number;   // dòng tiền thực tế (tỷ)
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — CONSTANTS & CONFIG
// ══════════════════════════════════════════════════════════════════════════════

export const STATUS_META: Record<ReportStatus, { label: string; cls: string }> = {
  signed:  { label: 'Đã ký',     cls: 'bg-emerald-100 text-emerald-700' },
  draft:   { label: 'Bản nháp',  cls: 'bg-slate-100   text-slate-600'   },
  pending: { label: 'Chờ duyệt', cls: 'bg-amber-100   text-amber-700'   },
};

export const GROUP_META: Record<ReportGroup, { label: string; color: string }> = {
  daily:    { label: 'Hàng ngày',   color: 'text-blue-600'   },
  weekly:   { label: 'Hàng tuần',   color: 'text-emerald-600'},
  monthly:  { label: 'Hàng tháng',  color: 'text-violet-600' },
  ondemand: { label: 'Theo đợt',    color: 'text-indigo-600' },
  legal:    { label: 'Pháp lý',     color: 'text-rose-600'   },
};

export const AUDIENCE_META: Record<ReportAudience, { label: string; cls: string }> = {
  contractor: { label: 'Nhà thầu', cls: 'bg-teal-50 text-teal-700'     },
  owner:      { label: 'Chủ đầu tư', cls: 'bg-blue-50 text-blue-700'   },
  supervisor: { label: 'TVGS',     cls: 'bg-amber-50 text-amber-700'   },
  internal:   { label: 'Nội bộ',   cls: 'bg-slate-50 text-slate-600'   },
};

export const GEM_SYS = `Bạn là Nàng GEM Siêu Việt — chuyên gia lập báo cáo xây dựng chuẩn TCXDVN.
Xưng "em", gọi "Anh/Chị". Soạn báo cáo chuyên nghiệp, đầy đủ số liệu, văn phong trang trọng.
Chỉ trả về nội dung báo cáo — không markdown, không code block, không giải thích.`;

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — TEMPLATES (12 loại S11)
// ══════════════════════════════════════════════════════════════════════════════

export const TEMPLATES: ReportTemplate[] = [
  // ── Nhóm HÀNG NGÀY ───────────────────────────────────────────────────────
  {
    id: 'daily', name: 'Nhật ký công trường', badge: 'HÀNG NGÀY', format: 'A4',
    group: 'daily', audience: ['contractor', 'supervisor'], frequency: 'Hàng ngày',
    sprint: 'S11',
    desc: 'Báo cáo ngày — nhân lực, khối lượng, thời tiết, sự cố',
    bg: 'bg-blue-50 border-blue-200', badgeCls: 'bg-blue-100 text-blue-700', iconName: 'Calendar',
    fields: [
      'Ngày báo cáo', 'Thời tiết', 'Nhân lực (tổng)',
      'Hạng mục thi công hôm nay', 'Khối lượng hoàn thành',
      'Thiết bị hoạt động', 'Vật tư nhập/xuất',
      'Sự cố / An toàn', 'Kế hoạch ngày mai',
    ],
  },

  // ── Nhóm HÀNG TUẦN ───────────────────────────────────────────────────────
  {
    id: 'weekly', name: 'Báo cáo tiến độ tuần', badge: 'HÀNG TUẦN', format: 'A3',
    group: 'weekly', audience: ['contractor', 'owner', 'supervisor'], frequency: 'Hàng tuần',
    sprint: 'S11',
    desc: 'Tổng hợp tuần — tiến độ, nhân lực, vật tư, vấn đề tồn đọng',
    bg: 'bg-emerald-50 border-emerald-200', badgeCls: 'bg-emerald-100 text-emerald-700', iconName: 'BarChart2',
    fields: [
      'Tuần số / Kỳ báo cáo', 'Tiến độ tổng thể (%)', 'Tiến độ kế hoạch (%)',
      'Lệch tiến độ', 'Nhân lực trung bình/ngày',
      'Hạng mục hoàn thành trong tuần', 'Vấn đề tồn đọng', 'Kế hoạch tuần tới',
    ],
  },

  // ── Nhóm HÀNG THÁNG ──────────────────────────────────────────────────────
  {
    id: 'monthly', name: 'Báo cáo tháng — GĐ DA', badge: 'HÀNG THÁNG', format: 'A3',
    group: 'monthly', audience: ['contractor', 'owner'], frequency: 'Hàng tháng',
    sprint: 'S11',
    desc: 'Báo cáo tháng cho Ban QLDA — tiến độ, tài chính, HSE, EVM',
    bg: 'bg-violet-50 border-violet-200', badgeCls: 'bg-violet-100 text-violet-700', iconName: 'TrendingUp',
    fields: [
      'Tháng báo cáo', 'Tóm tắt điều hành', 'Tiến độ tổng thể & EVM',
      'Tài chính: giải ngân / dòng tiền', 'HSE: sự cố / vi phạm / huấn luyện',
      'Vật tư: nhập / tồn / thiếu', 'Hợp đồng: thanh toán / VO', 'Rủi ro & kiến nghị',
    ],
  },
  {
    id: 'hse', name: 'Báo cáo HSE định kỳ', badge: 'AN TOÀN', format: 'A4',
    group: 'monthly', audience: ['contractor', 'owner', 'supervisor'], frequency: 'Hàng tháng',
    sprint: 'S11',
    desc: 'Báo cáo An toàn – Sức khoẻ – Môi trường theo mẫu Sở LĐTBXH',
    bg: 'bg-amber-50 border-amber-200', badgeCls: 'bg-amber-100 text-amber-700', iconName: 'HardHat',
    fields: [
      'Kỳ báo cáo', 'Số ngày không tai nạn (LTI)', 'Tai nạn lao động (số vụ / mức độ)',
      'Vi phạm AT (số / phân loại)', 'Huấn luyện: số lượt / nội dung',
      'Kiểm tra môi trường', 'Biện pháp khắc phục',
    ],
  },
  {
    id: 'manpower', name: 'Báo cáo nhân lực định kỳ', badge: 'NHÂN LỰC', format: 'A4',
    group: 'monthly', audience: ['contractor', 'owner'], frequency: 'Hàng tháng',
    sprint: 'S11',
    desc: 'Tổng hợp ngày công, OT, chuyên cần, BHXH — hồ sơ quyết toán',
    bg: 'bg-cyan-50 border-cyan-200', badgeCls: 'bg-cyan-100 text-cyan-700', iconName: 'Users',
    fields: [
      'Tháng báo cáo', 'Tổng nhân lực (cán bộ / công nhân)', 'Tổng ngày công',
      'Giờ OT (ngày thường / cuối tuần / lễ)', 'Tỷ lệ chuyên cần (%)',
      'BHXH/BHYT/BHTN: số người đóng', 'Biến động nhân sự (vào/ra)', 'Ghi chú đặc biệt',
    ],
  },
  {
    id: 'payroll', name: 'Bảng lương tổng hợp', badge: 'BẢNG LƯƠNG', format: 'A3',
    group: 'monthly', audience: ['contractor', 'internal'], frequency: 'Hàng tháng',
    sprint: 'S11',
    desc: 'Bảng lương tháng đầy đủ — lương cơ bản, OT, BHXH, thực nhận',
    bg: 'bg-green-50 border-green-200', badgeCls: 'bg-green-100 text-green-700', iconName: 'Banknote',
    fields: [
      'Tháng / Kỳ lương', 'Tổng quỹ lương cơ bản (triệu)',
      'Tổng phụ cấp (triệu)', 'Tổng OT (triệu)',
      'Tổng BHXH người lao động đóng (triệu)', 'Tổng BHXH công ty đóng (triệu)',
      'Tổng tạm ứng đã trả (triệu)', 'Tổng thực nhận (triệu)',
    ],
  },
  {
    id: 'materials', name: 'Báo cáo vật tư', badge: 'VẬT TƯ', format: 'A4',
    group: 'monthly', audience: ['contractor', 'owner'], frequency: 'Hàng tuần/tháng',
    sprint: 'S11',
    desc: 'Tổng hợp nhập/xuất/tồn kho theo kỳ — phát hiện thiếu hụt sớm',
    bg: 'bg-orange-50 border-orange-200', badgeCls: 'bg-orange-100 text-orange-700', iconName: 'Package',
    fields: [
      'Kỳ báo cáo', 'Tổng nhập kho (số phiếu / giá trị)',
      'Tổng xuất kho (số phiếu / giá trị)', 'Tồn kho cuối kỳ',
      'Vật tư sắp hết / cần đặt thêm', 'Vật tư tồn quá hạn',
      'Nhận xét & kiến nghị',
    ],
  },
  {
    id: 'equipment', name: 'Báo cáo thiết bị', badge: 'THIẾT BỊ', format: 'A4',
    group: 'monthly', audience: ['contractor', 'internal'], frequency: 'Hàng tháng',
    sprint: 'S11',
    desc: 'Tình trạng máy móc, giờ hoạt động, bảo trì, hiệu suất OEE',
    bg: 'bg-slate-50 border-slate-300', badgeCls: 'bg-slate-100 text-slate-700', iconName: 'Wrench',
    fields: [
      'Tháng báo cáo', 'Tổng thiết bị đang quản lý',
      'Thiết bị hoạt động / ngưng / bảo trì', 'Tổng giờ máy hoạt động',
      'OEE trung bình (%)', 'Thiết bị cần bảo trì / sửa chữa',
      'Chi phí bảo trì phát sinh', 'Kiến nghị',
    ],
  },
  {
    id: 'finance', name: 'Báo cáo tài chính nội bộ', badge: 'TÀI CHÍNH', format: 'A3',
    group: 'monthly', audience: ['contractor', 'internal'], frequency: 'Hàng tháng',
    sprint: 'S11',
    desc: 'Chi phí thực tế vs dự toán, dòng tiền nội bộ nhà thầu',
    bg: 'bg-rose-50 border-rose-200', badgeCls: 'bg-rose-100 text-rose-700', iconName: 'PieChart',
    fields: [
      'Tháng báo cáo', 'Doanh thu ghi nhận (tỷ)', 'Chi phí nhân công (tỷ)',
      'Chi phí vật tư (tỷ)', 'Chi phí thiết bị (tỷ)', 'Chi phí chung (tỷ)',
      'Tổng chi phí vs dự toán (%)', 'Dòng tiền ròng (tỷ)', 'Dự báo 3 tháng tới',
    ],
  },

  // ── Nhóm THEO ĐỢT ────────────────────────────────────────────────────────
  {
    id: 'qs', name: 'Báo cáo QS – Tài chính', badge: 'QS / TÀI CHÍNH', format: 'A3',
    group: 'ondemand', audience: ['contractor', 'owner', 'supervisor'], frequency: 'Theo đợt TT',
    sprint: 'S11',
    desc: 'Báo cáo khối lượng, thanh toán, Variation Orders, dòng tiền',
    bg: 'bg-indigo-50 border-indigo-200', badgeCls: 'bg-indigo-100 text-indigo-700', iconName: 'FileSpreadsheet',
    fields: [
      'Kỳ thanh toán', 'Khối lượng nghiệm thu đợt này',
      'Giá trị đề nghị thanh toán', 'Variation Orders phát sinh',
      'Tổng giá trị HĐ điều chỉnh', 'Công nợ còn lại', 'Dự báo dòng tiền 3 tháng tới',
    ],
  },
  {
    id: 'payment', name: 'Đề nghị thanh toán', badge: 'THANH TOÁN', format: 'A4',
    group: 'ondemand', audience: ['contractor', 'owner'], frequency: 'Theo đợt TT',
    sprint: 'S11',
    desc: 'Đề nghị thanh toán gửi CĐT kèm khối lượng nghiệm thu',
    bg: 'bg-teal-50 border-teal-200', badgeCls: 'bg-teal-100 text-teal-700', iconName: 'DollarSign',
    fields: [
      'Số đề nghị TT', 'Kỳ thanh toán', 'Khối lượng nghiệm thu (tỷ)',
      'Giá trị đề nghị (tỷ)', 'Khấu trừ tạm ứng (tỷ)',
      'Giữ lại bảo hành (%)', 'Số tiền thực nhận (tỷ)',
      'Tài khoản nhận tiền', 'Hồ sơ đính kèm',
    ],
  },
  {
    id: 'handover', name: 'Biên bản nghiệm thu bàn giao', badge: 'NGHIỆM THU', format: 'A4',
    group: 'ondemand', audience: ['contractor', 'owner', 'supervisor'], frequency: 'Theo giai đoạn',
    sprint: 'S11',
    desc: 'Biên bản nghiệm thu theo TCVN — đầy đủ chữ ký các bên',
    bg: 'bg-pink-50 border-pink-200', badgeCls: 'bg-pink-100 text-pink-700', iconName: 'CheckCircle2',
    fields: [
      'Hạng mục nghiệm thu', 'Căn cứ pháp lý / TCVN áp dụng',
      'Thành phần tham dự', 'Kết quả kiểm tra',
      'Kết luận (đạt / không đạt)', 'Yêu cầu sửa chữa (nếu có)', 'Chữ ký các bên',
    ],
  },
];

// ── S11 templates only ────────────────────────────────────────────────────────
export const S11_TEMPLATES = TEMPLATES.filter(t => t.sprint === 'S11');

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — HELPER FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

export function fmt(n: number): string {
  return n.toLocaleString('vi-VN');
}

export function fmtB(n: number): string {
  return `${n.toFixed(2)} tỷ`;
}

export function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

/** Build Gemini context string từ live data theo loại báo cáo */
export function buildGemContext(type: ReportType, live: ReportLiveData, projectName: string): string {
  const base = `DỰ ÁN: ${projectName}\nNGÀY: ${new Date().toLocaleDateString('vi-VN')}\n`;
  const mp   = `NHÂN LỰC: ${live.totalWorkers} người (${live.avgWorkers} TB/ngày), có mặt ${live.presentToday}, OT tháng ${live.otHoursMonth}h\n`;
  const hse  = `HSE: ${live.hseIncidents} sự cố, ${live.hseViolations} vi phạm, ${live.hseTrainings} huấn luyện, ${live.ltiFreedays} ngày không TNLĐ\n`;
  const mat  = `VẬT TƯ: ${live.matApproved} phiếu duyệt, ${live.matPending} chờ duyệt, giá trị ${fmtB(live.matValue)}\n`;
  const eq   = `THIẾT BỊ: ${live.eqActive}/${live.eqTotal} hoạt động, ${live.eqMaintenance} đang bảo trì\n`;
  const fin  = `TÀI CHÍNH: QS ${live.qsApproved}/${live.qsTotal} TT duyệt (${fmtB(live.qsValue)}), phải thu ${fmtB(live.receivable)}, phải trả ${fmtB(live.payable)}\n`;

  switch (type) {
    case 'daily':    return base + mp + hse + mat;
    case 'weekly':   return base + mp + hse + mat + eq;
    case 'monthly':  return base + mp + hse + mat + eq + fin;
    case 'hse':      return base + hse;
    case 'manpower': return base + mp;
    case 'payroll':  return base + mp;
    case 'materials':return base + mat;
    case 'equipment':return base + eq;
    case 'finance':  return base + fin;
    case 'qs':       return base + fin;
    case 'payment':  return base + fin;
    case 'handover': return base + mp + hse;
    default:         return base + mp + hse + fin;
  }
}

/** Build Excel workbook data từ live data — dùng cho SheetJS */
export function buildExcelSheets(
  type: ReportType,
  live: ReportLiveData,
  projectName: string,
  gemContent: string,
  formData: Record<string, string>,
): Array<{ name: string; rows: (string | number)[][] }> {
  const date = new Date().toLocaleDateString('vi-VN');
  const header = ['Dự án', 'Ngày', 'Người lập'];
  const headerVals = [projectName, date, formData['Người lập'] || 'GEM&CLAUDE PM'];

  const sheets: Array<{ name: string; rows: (string | number)[][] }> = [];

  // Sheet 1: Thông tin chung
  sheets.push({
    name: 'Thông tin',
    rows: [
      header,
      headerVals,
      [],
      ['Loại báo cáo', TEMPLATES.find(t => t.id === type)?.name || type],
      ['Trạng thái', 'Bản nháp'],
      [],
      ...Object.entries(formData).map(([k, v]) => [k, v]),
    ],
  });

  // Sheet 2: Data thực tế theo loại báo cáo
  if (['daily', 'weekly', 'monthly', 'manpower', 'payroll'].includes(type)) {
    sheets.push({
      name: 'Nhân lực',
      rows: [
        ['Chỉ tiêu', 'Giá trị', 'Đơn vị'],
        ['Tổng nhân lực', live.totalWorkers, 'người'],
        ['Có mặt hôm nay', live.presentToday, 'người'],
        ['Trung bình/ngày (tháng)', live.avgWorkers, 'người'],
        ['Tổng giờ OT tháng', live.otHoursMonth, 'giờ'],
      ],
    });
  }

  if (['hse', 'monthly', 'weekly'].includes(type)) {
    sheets.push({
      name: 'HSE',
      rows: [
        ['Chỉ tiêu', 'Giá trị', 'Đơn vị'],
        ['Sự cố', live.hseIncidents, 'vụ'],
        ['Vi phạm AT', live.hseViolations, 'lần'],
        ['Huấn luyện', live.hseTrainings, 'buổi'],
        ['Ngày không TNLĐ', live.ltiFreedays, 'ngày'],
      ],
    });
  }

  if (['materials', 'monthly', 'weekly'].includes(type)) {
    sheets.push({
      name: 'Vật tư',
      rows: [
        ['Chỉ tiêu', 'Giá trị', 'Đơn vị'],
        ['Phiếu đã duyệt', live.matApproved, 'phiếu'],
        ['Phiếu chờ duyệt', live.matPending, 'phiếu'],
        ['Giá trị nhập tháng', live.matValue, 'tỷ VNĐ'],
      ],
    });
  }

  if (['equipment', 'monthly'].includes(type)) {
    sheets.push({
      name: 'Thiết bị',
      rows: [
        ['Chỉ tiêu', 'Giá trị', 'Đơn vị'],
        ['Tổng thiết bị', live.eqTotal, 'cái'],
        ['Đang hoạt động', live.eqActive, 'cái'],
        ['Đang bảo trì', live.eqMaintenance, 'cái'],
      ],
    });
  }

  if (['qs', 'payment', 'finance', 'monthly'].includes(type)) {
    sheets.push({
      name: 'Tài chính',
      rows: [
        ['Chỉ tiêu', 'Giá trị', 'Đơn vị'],
        ['TT đã duyệt', live.qsApproved, 'đợt'],
        ['Giá trị TT đã duyệt', live.qsValue, 'tỷ VNĐ'],
        ['Phải thu', live.receivable, 'tỷ VNĐ'],
        ['Phải trả', live.payable, 'tỷ VNĐ'],
        ['Dòng tiền thực tế', live.cashflow, 'tỷ VNĐ'],
      ],
    });
  }

  // Sheet cuối: Nội dung báo cáo GEM soạn
  if (gemContent) {
    sheets.push({
      name: 'Nội dung báo cáo',
      rows: [
        ['NỘI DUNG BÁO CÁO — GEM&CLAUDE PM Pro'],
        [],
        [gemContent],
      ],
    });
  }

  return sheets;
}
