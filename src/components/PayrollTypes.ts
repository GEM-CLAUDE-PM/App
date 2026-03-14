// PayrollTypes.ts — GEM&CLAUDE PM Pro · S11
// Shared types, interfaces, constants, calculation logic cho PayrollTab
// Luật BHXH 2024, Nghị định 58/2020, Thông tư 111/2013/TT-BTC

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — TYPES & INTERFACES
// ══════════════════════════════════════════════════════════════════════════════

export type EmpStatus      = 'active' | 'probation' | 'maternity' | 'resigned' | 'terminated';
export type ContractType   = 'xac_dinh' | 'khong_xac_dinh' | 'thu_viec' | 'cong_nhat' | 'thoi_vu' | 'ctv';
export type PayPeriodType  = 'monthly' | 'biweekly' | 'weekly';
export type PaymentStatus  = 'pending' | 'paid' | 'transferred';
export type AllowanceType  = 'taxable' | 'exempt'; // chịu thuế hay miễn thuế

export interface Allowance {
  id:     string;
  name:   string;        // VD: "Ăn ca", "Xăng xe", "Độc hại"
  amount: number;        // K đồng/tháng
  type:   AllowanceType; // taxable | exempt
}

export interface Employee {
  id:             string;
  full_name:      string;
  position:       string;
  department:     string;  // tổ/đội/phòng ban
  team:           string;  // tổ đội — dùng để gộp bảng lương
  cccd:           string;
  phone:          string;
  email:          string;
  dob:            string;
  join_date:      string;
  status:         EmpStatus;
  contract_type:  ContractType;
  bhxh:           string;
  bhyt:           string;
  avatar_initial: string;
  // Lương
  salary_base:    number;  // K đồng/tháng (staff) hoặc K đồng/ngày (worker)
  allowances:     Allowance[];
  dependants:     number;  // số người phụ thuộc giảm trừ TNCN
  // Thử việc
  probation_pct:  number;  // % lương thử việc (mặc định 85)
}

export interface PayrollRecord {
  id:              string;
  emp_id:          string;
  period_label:    string;   // VD: "03/2026" | "T2 10/03 - CN 16/03"
  period_start:    string;   // YYYY-MM-DD
  period_end:      string;   // YYYY-MM-DD
  period_type:     PayPeriodType;
  // Input
  days_worked:     number;   // ngày công thực tế (worker) hoặc ngày làm việc trong kỳ
  days_in_period:  number;   // tổng ngày làm việc trong kỳ (để tính lương giữa tháng)
  ot_weekday:      number;   // giờ OT ngày thường
  ot_weekend:      number;   // giờ OT cuối tuần
  ot_holiday:      number;   // giờ OT ngày lễ
  bonus:           number;   // thưởng (K đồng)
  advances:        number;   // tạm ứng đã nhận (K đồng)
  // Calculated (lưu lại để lịch sử không đổi khi rate thay đổi)
  salary_base_snap:   number;   // snapshot lương cơ bản tại thời điểm tính
  allowances_taxable: number;   // tổng phụ cấp chịu thuế
  allowances_exempt:  number;   // tổng phụ cấp miễn thuế
  ot_amount:          number;   // tổng tiền OT
  gross:              number;
  bhxh:               number;
  bhyt:               number;
  bhtn:               number;
  taxable:            number;
  tncn:               number;
  net_salary:         number;
  total_cost_nsd:     number;
  // Trạng thái
  payment_status:  PaymentStatus;
  locked:          boolean;   // khóa sau kỳ lương kế tiếp
  ref_code:        string;    // mã phiếu lương duy nhất VD: "PL-2026-03-001"
  created_at:      string;
  notes:           string;
}

export interface PayrollPeriod {
  id:          string;
  project_id:  string;
  period_type: PayPeriodType;
  period_label:string;
  period_start:string;
  period_end:  string;
  locked:      boolean;
  records:     PayrollRecord[];
  created_at:  string;
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — CONSTANTS & RATES
// ══════════════════════════════════════════════════════════════════════════════

// ── BHXH 2024 (Luật BHXH, Nghị định 58/2020) ─────────────────────────────────
export const RATES = {
  BHXH_NLD:    0.08,    // Người lao động
  BHYT_NLD:    0.015,
  BHTN_NLD:    0.01,
  BHXH_NSDLD:  0.175,   // Người sử dụng lao động
  BHYT_NSDLD:  0.03,
  BHTN_NSDLD:  0.01,
  // OT (Điều 97 BLLĐ 2019)
  OT_WEEKDAY:  1.5,
  OT_WEEKEND:  2.0,
  OT_HOLIDAY:  3.0,
  // Thử việc mặc định
  PROBATION:   0.85,
  // Thuế TNCN flat cho thời vụ/CTV
  TNCN_FLAT:   0.10,
};

// ── Giảm trừ gia cảnh (Nghị quyết 954/2020/UBTVQH14) ──────────────────────────
export const GIAM_TRU = {
  BAN_THAN:       11_000,   // K đồng/tháng
  NGUOI_PHU_THUOC: 4_400,   // K đồng/người/tháng
  AN_CA_MAX:          730,  // K đồng/tháng — miễn thuế
};

// ── Bậc thuế TNCN lũy tiến (7 bậc) ──────────────────────────────────────────
export const TNCN_BRACKETS = [
  { ceiling:  5_000, rate: 0.05 },
  { ceiling: 10_000, rate: 0.10 },
  { ceiling: 18_000, rate: 0.15 },
  { ceiling: 32_000, rate: 0.20 },
  { ceiling: 52_000, rate: 0.25 },
  { ceiling: 80_000, rate: 0.30 },
  { ceiling: Infinity, rate: 0.35 },
];

// ── Số ngày làm việc mặc định ─────────────────────────────────────────────────
export const DEFAULT_WORK_DAYS = 26;

// ── Giờ làm việc/ngày ─────────────────────────────────────────────────────────
export const HOURS_PER_DAY = 8;

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — CALCULATION FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

/** Tính thuế TNCN lũy tiến */
export function calcTNCN(taxable: number): number {
  if (taxable <= 0) return 0;
  let tax = 0;
  let prev = 0;
  for (const b of TNCN_BRACKETS) {
    const slice = Math.min(taxable, b.ceiling) - prev;
    if (slice <= 0) break;
    tax += slice * b.rate;
    prev = b.ceiling;
  }
  return Math.round(tax);
}

/** Tính OT amount từ lương cơ bản */
export function calcOT(
  salary_base: number,
  ot_weekday: number,
  ot_weekend: number,
  ot_holiday: number,
): number {
  const hourlyRate = salary_base / DEFAULT_WORK_DAYS / HOURS_PER_DAY;
  return Math.round(
    hourlyRate * ot_weekday * RATES.OT_WEEKDAY +
    hourlyRate * ot_weekend * RATES.OT_WEEKEND +
    hourlyRate * ot_holiday * RATES.OT_HOLIDAY
  );
}

/** Tính toàn bộ payslip cho 1 nhân viên */
export function calcPayslip(
  emp: Employee,
  input: {
    days_worked:    number;
    days_in_period: number;
    ot_weekday:     number;
    ot_weekend:     number;
    ot_holiday:     number;
    bonus:          number;
    advances:       number;
  }
): Omit<PayrollRecord,
  'id' | 'emp_id' | 'period_label' | 'period_start' | 'period_end' |
  'period_type' | 'payment_status' | 'locked' | 'ref_code' | 'created_at' | 'notes' |
  'days_worked' | 'days_in_period' | 'ot_weekday' | 'ot_weekend' | 'ot_holiday' |
  'bonus' | 'advances'
> {
  const { days_worked, days_in_period, ot_weekday, ot_weekend, ot_holiday, bonus, advances } = input;

  // Lương cơ bản theo loại hợp đồng
  let salary_base_snap = emp.salary_base;
  if (emp.contract_type === 'thu_viec') {
    salary_base_snap = Math.round(emp.salary_base * (emp.probation_pct / 100 || RATES.PROBATION));
  }

  // Worker: tính theo ngày công
  // Staff: tính theo tháng, nếu vào/nghỉ giữa tháng tính ngày công thực tế
  let base_salary: number;
  if (emp.contract_type === 'cong_nhat') {
    base_salary = Math.round(salary_base_snap * days_worked);
  } else {
    base_salary = days_in_period > 0
      ? Math.round(salary_base_snap * (days_worked / days_in_period))
      : salary_base_snap;
  }

  // Phụ cấp
  const allowances_taxable = emp.allowances
    .filter(a => a.type === 'taxable')
    .reduce((s, a) => s + a.amount, 0);
  const allowances_exempt = emp.allowances
    .filter(a => a.type === 'exempt')
    .reduce((s, a) => s + Math.min(a.amount, a.name.includes('ăn') || a.name.toLowerCase().includes('an ca') ? GIAM_TRU.AN_CA_MAX : a.amount), 0);

  // OT
  const ot_amount = calcOT(salary_base_snap, ot_weekday, ot_weekend, ot_holiday);

  // Thu nhập gộp
  const gross = base_salary + allowances_taxable + allowances_exempt + ot_amount + bonus;

  // Thời vụ/CTV: không BHXH, thuế 10% flat
  if (emp.contract_type === 'thoi_vu' || emp.contract_type === 'ctv') {
    const tncn = Math.round(gross * RATES.TNCN_FLAT);
    const net_salary = gross - tncn - advances;
    return {
      salary_base_snap, allowances_taxable, allowances_exempt, ot_amount,
      gross, bhxh: 0, bhyt: 0, bhtn: 0,
      taxable: gross, tncn, net_salary,
      total_cost_nsd: gross,
    };
  }

  // Thai sản: BHXH chi trả, không tính lương công ty
  if (emp.status === 'maternity') {
    return {
      salary_base_snap, allowances_taxable: 0, allowances_exempt: 0, ot_amount: 0,
      gross: 0, bhxh: 0, bhyt: 0, bhtn: 0,
      taxable: 0, tncn: 0, net_salary: 0,
      total_cost_nsd: 0,
    };
  }

  // BHXH/BHYT/BHTN tính trên lương cơ bản (không tính phụ cấp, OT)
  const bhxh = Math.round(salary_base_snap * RATES.BHXH_NLD);
  const bhyt = Math.round(salary_base_snap * RATES.BHYT_NLD);
  const bhtn = Math.round(salary_base_snap * RATES.BHTN_NLD);
  const totalDeduct = bhxh + bhyt + bhtn;

  // Thu nhập tính thuế = gộp - BHXH/BHYT/BHTN - giảm trừ bản thân - giảm trừ người phụ thuộc
  const giam_tru_gia_canh = GIAM_TRU.BAN_THAN + (emp.dependants || 0) * GIAM_TRU.NGUOI_PHU_THUOC;
  // Chỉ phần taxable (base + phụ cấp chịu thuế + OT + thưởng) mới tính thuế
  const taxable_income = base_salary + allowances_taxable + ot_amount + bonus;
  const taxable = Math.max(0, taxable_income - totalDeduct - giam_tru_gia_canh);
  const tncn = calcTNCN(taxable);

  const net_salary = gross - totalDeduct - tncn - advances;

  // Chi phí NSDLĐ
  const bhxh_nsd = Math.round(salary_base_snap * RATES.BHXH_NSDLD);
  const bhyt_nsd = Math.round(salary_base_snap * RATES.BHYT_NSDLD);
  const bhtn_nsd = Math.round(salary_base_snap * RATES.BHTN_NSDLD);
  const total_cost_nsd = gross + bhxh_nsd + bhyt_nsd + bhtn_nsd;

  return {
    salary_base_snap, allowances_taxable, allowances_exempt, ot_amount,
    gross, bhxh, bhyt, bhtn, taxable, tncn, net_salary, total_cost_nsd,
  };
}

/** Tính tổng hợp toàn bảng lương */
export function calcTotals(records: Array<ReturnType<typeof calcPayslip>>) {
  return records.reduce((acc, p) => ({
    gross:          acc.gross          + p.gross,
    bhxh:           acc.bhxh           + p.bhxh,
    tncn:           acc.tncn           + p.tncn,
    net_salary:     acc.net_salary     + p.net_salary,
    total_cost_nsd: acc.total_cost_nsd + p.total_cost_nsd,
    ot_amount:      acc.ot_amount      + p.ot_amount,
  }), { gross: 0, bhxh: 0, tncn: 0, net_salary: 0, total_cost_nsd: 0, ot_amount: 0 });
}

/** Generate mã phiếu lương duy nhất */
export function genRefCode(pid: string, empId: string, periodLabel: string): string {
  const clean = periodLabel.replace(/\//g, '-').replace(/\s/g, '');
  return `PL-${pid.slice(-4).toUpperCase()}-${clean}-${empId.slice(-4).toUpperCase()}`;
}

/** Generate QR data string cho phiếu lương */
export function genQRData(record: Partial<PayrollRecord>, empName: string, projectName: string): string {
  return JSON.stringify({
    ref:     record.ref_code,
    emp:     empName,
    project: projectName,
    period:  record.period_label,
    net:     record.net_salary,
    ts:      Date.now(),
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — HELPER FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

export const fmt  = (n: number) => Math.round(n).toLocaleString('vi-VN');
export const fmtM = (n: number) => `${(n / 1000).toFixed(2)} triệu`;

export const CONTRACT_LABEL: Record<ContractType, string> = {
  xac_dinh:     'Xác định thời hạn',
  khong_xac_dinh: 'Không xác định',
  thu_viec:     'Thử việc',
  cong_nhat:    'Công nhật',
  thoi_vu:      'Thời vụ',
  ctv:          'Cộng tác viên',
};

export const STATUS_LABEL: Record<EmpStatus, { label: string; cls: string }> = {
  active:      { label: 'Đang làm',    cls: 'bg-emerald-100 text-emerald-700' },
  probation:   { label: 'Thử việc',    cls: 'bg-blue-100 text-blue-700'       },
  maternity:   { label: 'Thai sản',    cls: 'bg-pink-100 text-pink-700'       },
  resigned:    { label: 'Đã nghỉ',     cls: 'bg-slate-100 text-slate-500'     },
  terminated:  { label: 'Chấm dứt HĐ',cls: 'bg-red-100 text-red-700'         },
};

export const PAYMENT_LABEL: Record<PaymentStatus, { label: string; cls: string }> = {
  pending:    { label: 'Chưa TT',        cls: 'bg-amber-100 text-amber-700'   },
  paid:       { label: 'Đã thanh toán',  cls: 'bg-emerald-100 text-emerald-700'},
  transferred:{ label: 'Đã chuyển khoản',cls: 'bg-blue-100 text-blue-700'    },
};

/** Nhóm employees theo team */
export function groupByTeam(employees: Employee[]): Record<string, Employee[]> {
  return employees.reduce((acc, emp) => {
    const team = emp.team || emp.department || 'Chưa phân nhóm';
    if (!acc[team]) acc[team] = [];
    acc[team].push(emp);
    return acc;
  }, {} as Record<string, Employee[]>);
}

/** Kiểm tra bảng lương có bị khóa không */
export function isPeriodLocked(period: PayrollPeriod): boolean {
  return period.locked;
}

/** Lấy kỳ lương mặc định (tháng hiện tại) */
export function getCurrentPeriodLabel(): string {
  return new Date().toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' }).replace(' ', '/');
}

/** Tạo danh sách 12 tháng gần nhất để chọn */
export function getLast12Months(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' }).replace(' ', '/'));
  }
  return months;
}

// ── Seed data mẫu ─────────────────────────────────────────────────────────────
export const SEED_EMPLOYEES: Employee[] = [
  {
    id: 'hr_e1', full_name: 'Trần Văn Bình', position: 'Chỉ huy trưởng', department: 'Ban Chỉ huy',
    team: 'Ban Chỉ huy', cccd: '079012345678', phone: '0901234567', email: '',
    dob: '20/08/1980', join_date: '01/01/2024', status: 'active',
    contract_type: 'khong_xac_dinh', bhxh: 'BH-001-2024', bhyt: 'YT-001-2024',
    avatar_initial: 'B', salary_base: 35_000, dependants: 2,
    allowances: [
      { id: 'a1', name: 'Phụ cấp chức vụ', amount: 3_000, type: 'taxable' },
      { id: 'a2', name: 'Ăn ca', amount: 730, type: 'exempt' },
    ],
    probation_pct: 85,
  },
  {
    id: 'hr_e2', full_name: 'Lê Thị Thu', position: 'Kỹ sư QA/QC', department: 'Ban Chỉ huy',
    team: 'Ban Chỉ huy', cccd: '079023456789', phone: '0912345678', email: '',
    dob: '10/12/1990', join_date: '01/01/2024', status: 'active',
    contract_type: 'xac_dinh', bhxh: 'BH-002-2024', bhyt: 'YT-002-2024',
    avatar_initial: 'T', salary_base: 25_000, dependants: 1,
    allowances: [
      { id: 'a3', name: 'Phụ cấp kỹ thuật', amount: 2_000, type: 'taxable' },
      { id: 'a4', name: 'Ăn ca', amount: 730, type: 'exempt' },
    ],
    probation_pct: 85,
  },
  {
    id: 'hr_e3', full_name: 'Nguyễn Văn Hùng', position: 'Tổ trưởng', department: 'Tổ Cốp Pha',
    team: 'Tổ Cốp Pha', cccd: '079034567890', phone: '0923456789', email: '',
    dob: '15/05/1985', join_date: '01/03/2024', status: 'active',
    contract_type: 'cong_nhat', bhxh: '', bhyt: '',
    avatar_initial: 'H', salary_base: 500, dependants: 0,
    allowances: [
      { id: 'a5', name: 'Ăn ca', amount: 50, type: 'exempt' },
    ],
    probation_pct: 85,
  },
];
