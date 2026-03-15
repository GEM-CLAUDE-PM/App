// QSTypes.ts — GEM&CLAUDE PM Pro
// Shared types, interfaces, constants cho QSDashboard

// ══════════════════════════════════════════════════════════════════════════════
export interface BOQItem {
  id: string;
  code: string;           // Mã hạng mục
  chapter: string;        // Chương (nhóm cấp 1)
  name: string;
  unit: string;
  qty_contract: number;   // KL hợp đồng
  unit_price: number;     // Đơn giá HĐ (VNĐ)
  qty_done: number;       // KL đã thực hiện/nghiệm thu
  qty_plan_current: number; // KL kế hoạch đến thời điểm này
  note?: string;
  isChapter?: boolean;
}

export interface AcceptanceLot {
  id: string;
  lot_no: string;         // Đợt NT số
  date: string;
  items: { boq_id: string; qty: number }[];
  status: "draft" | "submitted" | "approved";
  submitted_by: string;
  approved_by?: string;
  note?: string;
  total_value: number;
}

export interface PaymentRequest {
  id: string;
  request_no: string;
  date: string;
  period: string;
  lot_ids: string[];      // Các đợt NT kèm theo
  subtotal: number;
  vat: number;
  total: number;
  advance_deduct: number;
  net_payable: number;
  status: "draft" | "submitted" | "approved" | "paid";
  note?: string;
}

// ── Subcontractor types ───────────────────────────────────────────────────────
export type SubType = "subcontractor" | "team" | "supplier" | "consultant";
export type PayMechanism = "lump_sum" | "progress" | "manhour" | "unit_rate";
export type SubPayStatus = "draft" | "submitted" | "approved" | "paid";

export interface SubContractor {
  id: string;
  code: string;
  name: string;
  type: SubType;
  scope: string;             // Phạm vi công việc
  contract_value: number;   // Giá trị HĐ phụ
  contract_no: string;
  start_date: string;
  end_date: string;
  pay_mechanism: PayMechanism;
  retention_pct: number;    // % giữ lại BH (VD: 5)
  advance_paid: number;     // Tạm ứng đã trả
  contact: string;
  bank_account?: string;
}

export interface SubPayment {
  id: string;
  sub_id: string;           // FK → SubContractor
  pay_no: string;
  date: string;
  period: string;
  mechanism: PayMechanism;
  // Khoán gọn
  lump_items?: { name: string; value: number }[];
  // % tiến độ
  progress_pct?: number;
  // Ngày công / giờ máy
  manhour_rows?: { description: string; qty: number; unit: string; unit_price: number }[];
  // KL × đơn giá
  unit_rows?: { boq_ref: string; qty: number; unit: string; unit_price: number }[];
  subtotal: number;
  retention_amt: number;    // Giữ lại BH
  advance_deduct: number;   // Khấu trừ TU
  net_payable: number;
  status: SubPayStatus;
  note?: string;
}

export interface QSProps {
  projectId:    string;
  projectName:  string;
  contractValue?: number;
  currentRole?: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — MOCK DATA
// ══════════════════════════════════════════════════════════════════════════════
export const INIT_BOQ: BOQItem[] = [
  // ── Chương 1: Phần Ngầm ──────────────────────────────────────────────────
  { id:"c1",   code:"C1",        chapter:"C1", name:"PHẦN NGẦM",                         unit:"",   qty_contract:0,     unit_price:0,          qty_done:0,    qty_plan_current:0,     isChapter:true },
  { id:"c1-1", code:"C1.1",      chapter:"C1", name:"Cọc BTCT D400 L=20m",                unit:"m",  qty_contract:4800,  unit_price:420000,     qty_done:4800, qty_plan_current:4800  },
  { id:"c1-2", code:"C1.2",      chapter:"C1", name:"Đập đầu cọc",                        unit:"Cọc",qty_contract:240,   unit_price:800000,     qty_done:240,  qty_plan_current:240   },
  { id:"c1-3", code:"C1.3",      chapter:"C1", name:"Đài móng M1 BTCT 250# V=42m³",       unit:"m³", qty_contract:336,   unit_price:3800000,    qty_done:336,  qty_plan_current:336   },
  { id:"c1-4", code:"C1.4",      chapter:"C1", name:"Giằng móng 250# V=18m³",             unit:"m³", qty_contract:144,   unit_price:3600000,    qty_done:144,  qty_plan_current:144   },
  { id:"c1-5", code:"C1.5",      chapter:"C1", name:"Cốt thép móng D≤10 CT3",             unit:"Tấn",qty_contract:28.5,  unit_price:28500000,   qty_done:28.5, qty_plan_current:28.5  },
  { id:"c1-6", code:"C1.6",      chapter:"C1", name:"Cốt thép móng D>10 CT3",             unit:"Tấn",qty_contract:62.4,  unit_price:26800000,   qty_done:62.4, qty_plan_current:62.4  },
  // ── Chương 2: Phần Thân ──────────────────────────────────────────────────
  { id:"c2",   code:"C2",        chapter:"C2", name:"PHẦN THÂN",                          unit:"",   qty_contract:0,     unit_price:0,          qty_done:0,    qty_plan_current:0,     isChapter:true },
  { id:"c2-1", code:"C2.1",      chapter:"C2", name:"Cột BTCT 300# F=0.25m² T1-T5",      unit:"m³", qty_contract:420,   unit_price:4200000,    qty_done:210,  qty_plan_current:280   },
  { id:"c2-2", code:"C2.2",      chapter:"C2", name:"Dầm sàn BTCT 250# T1-T5",           unit:"m³", qty_contract:680,   unit_price:3900000,    qty_done:340,  qty_plan_current:408   },
  { id:"c2-3", code:"C2.3",      chapter:"C2", name:"Sàn BTCT 250# T1-T5",               unit:"m³", qty_contract:1250,  unit_price:3750000,    qty_done:500,  qty_plan_current:625   },
  { id:"c2-4", code:"C2.4",      chapter:"C2", name:"Cốt thép cột D≤10",                 unit:"Tấn",qty_contract:45,    unit_price:28500000,   qty_done:22.5, qty_plan_current:27    },
  { id:"c2-5", code:"C2.5",      chapter:"C2", name:"Cốt thép cột D>10",                 unit:"Tấn",qty_contract:120,   unit_price:26800000,   qty_done:60,   qty_plan_current:72    },
  { id:"c2-6", code:"C2.6",      chapter:"C2", name:"Cốt thép sàn, dầm D≤10",            unit:"Tấn",qty_contract:85,    unit_price:28500000,   qty_done:42.5, qty_plan_current:51    },
  { id:"c2-7", code:"C2.7",      chapter:"C2", name:"Xây tường 20cm gạch ống T1-T3",     unit:"m²", qty_contract:3200,  unit_price:185000,     qty_done:960,  qty_plan_current:1600  },
  // ── Chương 3: Hoàn thiện ─────────────────────────────────────────────────
  { id:"c3",   code:"C3",        chapter:"C3", name:"HOÀN THIỆN",                         unit:"",   qty_contract:0,     unit_price:0,          qty_done:0,    qty_plan_current:0,     isChapter:true },
  { id:"c3-1", code:"C3.1",      chapter:"C3", name:"Trát tường trong (vữa M75)",         unit:"m²", qty_contract:8500,  unit_price:95000,      qty_done:0,    qty_plan_current:850   },
  { id:"c3-2", code:"C3.2",      chapter:"C3", name:"Ốp lát gạch ceramic 400x400",       unit:"m²", qty_contract:4200,  unit_price:320000,     qty_done:0,    qty_plan_current:420   },
  { id:"c3-3", code:"C3.3",      chapter:"C3", name:"Sơn tường ngoài 2 nước",            unit:"m²", qty_contract:6800,  unit_price:75000,      qty_done:0,    qty_plan_current:0     },
  // ── Chương 4: M&E ─────────────────────────────────────────────────────────
  { id:"c4",   code:"C4",        chapter:"C4", name:"HỆ THỐNG M&E",                       unit:"",   qty_contract:0,     unit_price:0,          qty_done:0,    qty_plan_current:0,     isChapter:true },
  { id:"c4-1", code:"C4.1",      chapter:"C4", name:"Hệ thống điện chiếu sáng",           unit:"HT", qty_contract:1,     unit_price:1850000000, qty_done:0,    qty_plan_current:0     },
  { id:"c4-2", code:"C4.2",      chapter:"C4", name:"Hệ thống cấp thoát nước",            unit:"HT", qty_contract:1,     unit_price:1200000000, qty_done:0,    qty_plan_current:0     },
  { id:"c4-3", code:"C4.3",      chapter:"C4", name:"Hệ thống PCCC",                     unit:"HT", qty_contract:1,     unit_price:980000000,  qty_done:0,    qty_plan_current:0     },
  { id:"c4-4", code:"C4.4",      chapter:"C4", name:"Thang máy 8 người (2 cabin)",        unit:"Cái",qty_contract:2,     unit_price:650000000,  qty_done:0,    qty_plan_current:0     },
];

export const INIT_ACCEPTANCE: AcceptanceLot[] = [
  {
    id:"a1", lot_no:"NT-001", date:"15/01/2026", status:"approved",
    submitted_by:"Phạm Văn D", approved_by:"Trần Văn B",
    note:"Nghiệm thu toàn bộ phần ngầm - móng M1 đến M12",
    total_value: 6_487_770_000,
    items:[
      {boq_id:"c1-1",qty:4800},{boq_id:"c1-2",qty:240},
      {boq_id:"c1-3",qty:336},{boq_id:"c1-4",qty:144},
      {boq_id:"c1-5",qty:28.5},{boq_id:"c1-6",qty:62.4},
    ],
  },
  {
    id:"a2", lot_no:"NT-002", date:"20/02/2026", status:"approved",
    submitted_by:"Phạm Văn D", approved_by:"Trần Văn B",
    note:"Nghiệm thu cột, dầm, sàn tầng 1-2",
    total_value: 2_532_900_000,
    items:[
      {boq_id:"c2-1",qty:84},{boq_id:"c2-2",qty:136},
      {boq_id:"c2-3",qty:200},{boq_id:"c2-4",qty:9},{boq_id:"c2-5",qty:24},
    ],
  },
  {
    id:"a3", lot_no:"NT-003", date:"07/03/2026", status:"submitted",
    submitted_by:"Phạm Văn D",
    note:"Nghiệm thu cột, dầm, sàn tầng 3-5 (đợt 1)",
    total_value: 5_188_200_000,
    items:[
      {boq_id:"c2-1",qty:126},{boq_id:"c2-2",qty:204},
      {boq_id:"c2-3",qty:300},{boq_id:"c2-4",qty:13.5},{boq_id:"c2-5",qty:36},
      {boq_id:"c2-6",qty:42.5},{boq_id:"c2-7",qty:960},
    ],
  },
];

export const INIT_PAYMENTS: PaymentRequest[] = [
  {
    id:"p1", request_no:"TT-001", date:"20/01/2026",
    period:"Tháng 01/2026", lot_ids:["a1"],
    subtotal:6_487_770_000, vat:648_777_000, total:7_136_547_000, advance_deduct:500_000_000, net_payable:6_636_547_000,
    status:"paid", note:"Thanh toán đợt 1 - phần ngầm",
  },
  {
    id:"p2", request_no:"TT-002", date:"25/02/2026",
    period:"Tháng 02/2026", lot_ids:["a2"],
    subtotal:2_532_900_000, vat:253_290_000, total:2_786_190_000, advance_deduct:300_000_000, net_payable:2_486_190_000,
    status:"approved", note:"Thanh toán đợt 2 - thân T1-T2",
  },
  {
    id:"p3", request_no:"TT-003", date:"08/03/2026",
    period:"Tháng 03/2026", lot_ids:["a3"],
    subtotal:5_188_200_000, vat:518_820_000, total:5_707_020_000, advance_deduct:300_000_000, net_payable:5_407_020_000,
    status:"draft", note:"Thanh toán đợt 3 - thân T3-T5 (đợt 1)",
  },
];

// ── Subcontractor mock data ───────────────────────────────────────────────────
export const INIT_SUBS: SubContractor[] = [
  {
    id:"s1", code:"NTP-001", name:"Công ty TNHH Nền móng Việt", type:"subcontractor",
    scope:"Thi công cọc khoan nhồi D400, đài móng, giằng móng",
    contract_value: 4_200_000_000, contract_no:"HĐP-2025/01",
    start_date:"10/01/2026", end_date:"20/02/2026",
    pay_mechanism:"progress", retention_pct:5,
    advance_paid: 420_000_000, contact:"Ông Nguyễn Bá Thành — 0901 234 567",
    bank_account:"VCB - 0071004123456",
  },
  {
    id:"s2", code:"NTP-002", name:"Đội thợ nề - Trần Văn Hùng", type:"team",
    scope:"Xây tường, trát, ốp lát toàn bộ dự án",
    contract_value: 2_850_000_000, contract_no:"HĐK-2025/02",
    start_date:"15/02/2026", end_date:"30/09/2026",
    pay_mechanism:"unit_rate", retention_pct:3,
    advance_paid: 200_000_000, contact:"Trần Văn Hùng — 0912 345 678",
  },
  {
    id:"s3", code:"NTP-003", name:"Công ty CP Điện lạnh Á Đông", type:"subcontractor",
    scope:"Hệ thống điện chiếu sáng, điều hòa không khí",
    contract_value: 3_650_000_000, contract_no:"HĐP-2025/03",
    start_date:"01/04/2026", end_date:"30/10/2026",
    pay_mechanism:"lump_sum", retention_pct:5,
    advance_paid: 365_000_000, contact:"Bà Lê Thị Mai — 0908 765 432",
    bank_account:"TCB - 19032847561023",
  },
  {
    id:"s4", code:"NTP-004", name:"Công ty TNHH Cơ khí Xây dựng Hoàng Gia", type:"subcontractor",
    scope:"Cung cấp và lắp đặt cửa nhôm kính, vách kính",
    contract_value: 1_480_000_000, contract_no:"HĐP-2025/04",
    start_date:"01/07/2026", end_date:"30/09/2026",
    pay_mechanism:"lump_sum", retention_pct:5,
    advance_paid: 148_000_000, contact:"Ông Hoàng Văn Minh — 0933 111 222",
  },
  {
    id:"s5", code:"NCC-001", name:"Công ty CP Thép Pomina", type:"supplier",
    scope:"Cung cấp thép CB300-V, CB400-V các loại",
    contract_value: 5_200_000_000, contract_no:"HĐMS-2025/01",
    start_date:"05/01/2026", end_date:"31/12/2026",
    pay_mechanism:"unit_rate", retention_pct:0,
    advance_paid: 0, contact:"Ms. Ngọc Anh — 0977 888 999",
    bank_account:"BIDV - 21410002847562",
  },
  {
    id:"s6", code:"NCC-002", name:"Công ty TNHH Xi Măng Hà Tiên 1", type:"supplier",
    scope:"Cung cấp xi măng PC40, PCB40 theo tiến độ dự án",
    contract_value: 1_100_000_000, contract_no:"HĐMS-2025/02",
    start_date:"05/01/2026", end_date:"31/10/2026",
    pay_mechanism:"unit_rate", retention_pct:0,
    advance_paid: 0, contact:"Nguyễn Văn A — 0966 777 888",
  },
  {
    id:"s7", code:"TVGS-001", name:"Công ty CP Tư vấn Xây dựng Đô thị", type:"consultant",
    scope:"Tư vấn giám sát thi công, kiểm tra chất lượng theo TCVN",
    contract_value: 680_000_000, contract_no:"HĐTV-2025/01",
    start_date:"01/01/2026", end_date:"31/12/2026",
    pay_mechanism:"progress", retention_pct:5,
    advance_paid: 68_000_000, contact:"KS. Phạm Thị Lan — 0902 333 444",
  },
  {
    id:"s8", code:"TD-001", name:"Đội thợ điện - Nguyễn Minh Đức", type:"team",
    scope:"Đi ống ngầm, kéo dây điện nội bộ các tầng",
    contract_value: 420_000_000, contract_no:"HĐK-2025/05",
    start_date:"01/04/2026", end_date:"30/09/2026",
    pay_mechanism:"manhour", retention_pct:0,
    advance_paid: 30_000_000, contact:"Nguyễn Minh Đức — 0944 555 666",
  },
];

export const INIT_SUB_PAYMENTS: SubPayment[] = [
  // NTP-001 Nền móng: 2 đợt đã TT, 1 đang duyệt
  {
    id:"sp1", sub_id:"s1", pay_no:"TT-NTP001-01", date:"20/01/2026",
    period:"Đợt 1 — Thi công cọc + đài móng",
    mechanism:"progress", progress_pct:50,
    subtotal:2_100_000_000, retention_amt:105_000_000,
    advance_deduct:420_000_000, net_payable:1_575_000_000,
    status:"paid", note:"Nghiệm thu hoàn thành 50% phần ngầm",
  },
  {
    id:"sp2", sub_id:"s1", pay_no:"TT-NTP001-02", date:"25/02/2026",
    period:"Đợt 2 — Hoàn thành toàn bộ phần ngầm",
    mechanism:"progress", progress_pct:50,
    subtotal:2_100_000_000, retention_amt:105_000_000,
    advance_deduct:0, net_payable:1_995_000_000,
    status:"approved",
  },
  // Đội nề: 1 đợt đã TT, 1 đang nháp
  {
    id:"sp3", sub_id:"s2", pay_no:"TT-TD002-01", date:"10/03/2026",
    period:"Tháng 02-03/2026 — Xây tường tầng 1-3",
    mechanism:"unit_rate",
    unit_rows:[
      {boq_ref:"C3.1", qty:2800, unit:"m²", unit_price:95000},
      {boq_ref:"C3.2", qty:520,  unit:"m²", unit_price:95000},
    ],
    subtotal:315_400_000, retention_amt:9_462_000,
    advance_deduct:80_000_000, net_payable:225_938_000,
    status:"paid",
  },
  {
    id:"sp4", sub_id:"s2", pay_no:"TT-TD002-02", date:"07/03/2026",
    period:"Tháng 03/2026 — Xây tường tầng 4-5 (đang thi công)",
    mechanism:"unit_rate",
    unit_rows:[
      {boq_ref:"C3.1", qty:1200, unit:"m²", unit_price:95000},
    ],
    subtotal:114_000_000, retention_amt:3_420_000,
    advance_deduct:0, net_payable:110_580_000,
    status:"draft",
  },
  // Thép Pomina: 2 đợt hàng hóa
  {
    id:"sp5", sub_id:"s5", pay_no:"TT-NCC001-01", date:"15/01/2026",
    period:"Lô hàng 01 — Thép D16-D25 cho móng",
    mechanism:"unit_rate",
    unit_rows:[
      {boq_ref:"Thép D16", qty:38.5, unit:"Tấn", unit_price:26_800_000},
      {boq_ref:"Thép D25", qty:52.4, unit:"Tấn", unit_price:26_500_000},
    ],
    subtotal:2_419_580_000, retention_amt:0,
    advance_deduct:0, net_payable:2_419_580_000,
    status:"paid",
  },
  {
    id:"sp6", sub_id:"s5", pay_no:"TT-NCC001-02", date:"20/02/2026",
    period:"Lô hàng 02 — Thép D12-D14 cho sàn T1-T2",
    mechanism:"unit_rate",
    unit_rows:[
      {boq_ref:"Thép D12", qty:42.5, unit:"Tấn", unit_price:28_500_000},
      {boq_ref:"Thép D14", qty:35.0, unit:"Tấn", unit_price:27_800_000},
    ],
    subtotal:2_185_750_000, retention_amt:0,
    advance_deduct:0, net_payable:2_185_750_000,
    status:"approved",
  },
  // Đội thợ điện: manhour
  {
    id:"sp7", sub_id:"s8", pay_no:"TT-TD008-01", date:"05/03/2026",
    period:"Tháng 02-03/2026 — Đi ống ngầm tầng 1-3",
    mechanism:"manhour",
    manhour_rows:[
      {description:"Thợ điện chính (thợ bậc 4/7)", qty:320, unit:"Công", unit_price:450_000},
      {description:"Thợ phụ", qty:160, unit:"Công", unit_price:280_000},
      {description:"Xe cẩu 25T", qty:3, unit:"Ca", unit_price:3_500_000},
    ],
    subtotal:199_300_000, retention_amt:0,
    advance_deduct:30_000_000, net_payable:169_300_000,
    status:"submitted",
  },
  // TVGS: phí tư vấn
  {
    id:"sp8", sub_id:"s7", pay_no:"TT-TVGS-01", date:"31/01/2026",
    period:"Tháng 01/2026 — Phí TVGS",
    mechanism:"progress", progress_pct:8,
    subtotal:54_400_000, retention_amt:2_720_000,
    advance_deduct:0, net_payable:51_680_000,
    status:"paid",
  },
];

export const S_CURVE_DATA = [
  { month:"T1/26", pv:8.5,  ev:8.5,  ac:9.2  },
  { month:"T2/26", pv:18.2, ev:17.8, ac:19.5 },
  { month:"T3/26", pv:29.0, ev:27.1, ac:30.8 },
  { month:"T4/26", pv:41.5, ev:null, ac:null  },
  { month:"T5/26", pv:55.0, ev:null, ac:null  },
  { month:"T6/26", pv:67.0, ev:null, ac:null  },
  { month:"T7/26", pv:78.5, ev:null, ac:null  },
  { month:"T8/26", pv:88.0, ev:null, ac:null  },
  { month:"T9/26", pv:94.5, ev:null, ac:null  },
  { month:"T10/26",pv:98.0, ev:null, ac:null  },
  { month:"T11/26",pv:100,  ev:null, ac:null  },
];

export const SUB_TYPE_CFG: Record<SubType,{label:string;color:string;icon:string}> = {
  subcontractor: { label:"Nhà thầu phụ",  color:"blue",   icon:"🏗️" },
  team:          { label:"Tổ đội khoán",  color:"violet", icon:"👷" },
  supplier:      { label:"Nhà cung cấp",  color:"amber",  icon:"📦" },
  consultant:    { label:"Tư vấn",        color:"teal",   icon:"📋" },
};
export const MECH_CFG: Record<PayMechanism,{label:string;short:string}> = {
  lump_sum:  { label:"Khoán gọn",             short:"Khoán" },
  progress:  { label:"Theo % tiến độ",         short:"% TĐ"  },
  manhour:   { label:"Ngày công / Giờ máy",    short:"NC/GM" },
  unit_rate: { label:"KL × Đơn giá khoán",    short:"KL×ĐG" },
};
export const SUB_PAY_STATUS: Record<SubPayStatus,{label:string;cls:string}> = {
  draft:     { label:"Nháp",          cls:"bg-slate-100 text-slate-600"     },
  submitted: { label:"Chờ duyệt",     cls:"bg-blue-100 text-blue-700"       },
  approved:  { label:"Đã duyệt",      cls:"bg-amber-100 text-amber-700"     },
  paid:      { label:"Đã thanh toán", cls:"bg-emerald-100 text-emerald-700" },
};
// ══════════════════════════════════════════════════════════════════════════════
export const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n));
export const fmtB = (n: number) => {           // tỷ đồng
  if (n >= 1e9) return `${(n/1e9).toFixed(2)} tỷ`;
  if (n >= 1e6) return `${(n/1e6).toFixed(0)} triệu`;
  return fmt(n);
};
export const pct = (a: number, b: number) => b > 0 ? Math.round((a / b) * 100) : 0;

export const calcBOQValue = (item: BOQItem) => item.qty_contract * item.unit_price;
export const calcDoneValue = (item: BOQItem) => item.qty_done * item.unit_price;

export const PAYMENT_STATUS: Record<string, { label: string; cls: string }> = {
  draft:     { label: "Nháp",       cls: "bg-slate-100 text-slate-600"   },
  submitted: { label: "Đã gửi",     cls: "bg-blue-100 text-blue-700"     },
  approved:  { label: "Đã duyệt",   cls: "bg-amber-100 text-amber-700"   },
  paid:      { label: "Đã thanh toán", cls: "bg-emerald-100 text-emerald-700" },
};
export const ACCEPT_STATUS: Record<string, { label: string; cls: string }> = {
  draft:     { label: "Nháp",       cls: "bg-slate-100 text-slate-600"  },
  submitted: { label: "Chờ duyệt",  cls: "bg-blue-100 text-blue-700"   },
  approved:  { label: "Đã duyệt",   cls: "bg-emerald-100 text-emerald-700" },
};

export const CHAPTERS = ["C1","C2","C3","C4"];
export const CHAPTER_NAMES: Record<string,string> = {
  C1:"Phần Ngầm", C2:"Phần Thân", C3:"Hoàn thiện", C4:"Hệ thống M&E"
};
export const CHAPTER_COLORS: Record<string,string> = {
  C1:"emerald", C2:"blue", C3:"violet", C4:"orange"
};

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — SMALL UI COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

// ─── Variation Order types ───────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// SECTION 5 — MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
// VARIATION ORDERS TAB COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export type VOStatus = "draft" | "submitted" | "approved" | "rejected" | "implemented";
export type VOType   = "scope_addition" | "scope_omission" | "unit_price_change" | "acceleration" | "unforeseen";

export interface VariationOrder {
  id: string;
  vo_no: string;
  title: string;
  type: VOType;
  status: VOStatus;
  date_issued: string;
  date_approved?: string;
  value_change: number;      // (+) tăng, (-) giảm
  contract_value_before: number;
  description: string;
  reason: string;
  submitted_by: string;
  approved_by?: string;
  boq_items: { code: string; description: string; qty_change: number; unit: string; unit_price: number }[];
  note?: string;
}

export const VO_STATUS: Record<VOStatus, { label: string; cls: string; dot: string }> = {
  draft:       { label:"Nháp",            cls:"bg-slate-100 text-slate-600",   dot:"bg-slate-400"   },
  submitted:   { label:"Chờ phê duyệt",   cls:"bg-blue-100 text-blue-700",     dot:"bg-blue-500"    },
  approved:    { label:"Đã phê duyệt",    cls:"bg-emerald-100 text-emerald-700",dot:"bg-emerald-500" },
  rejected:    { label:"Từ chối",         cls:"bg-rose-100 text-rose-700",     dot:"bg-rose-500"    },
  implemented: { label:"Đã thực hiện",   cls:"bg-teal-100 text-teal-700",     dot:"bg-teal-500"    },
};

export const VO_TYPE_CFG: Record<VOType, { label: string; icon: string; cls: string }> = {
  scope_addition:    { label:"Bổ sung phạm vi",    icon:"➕", cls:"bg-emerald-50 text-emerald-700 border-emerald-200" },
  scope_omission:    { label:"Cắt giảm phạm vi",   icon:"➖", cls:"bg-rose-50 text-rose-700 border-rose-200"         },
  unit_price_change: { label:"Thay đổi đơn giá",   icon:"💲", cls:"bg-amber-50 text-amber-700 border-amber-200"      },
  acceleration:      { label:"Đẩy nhanh tiến độ",  icon:"⚡", cls:"bg-blue-50 text-blue-700 border-blue-200"         },
  unforeseen:        { label:"Phát sinh ngoài dự kiến", icon:"⚠️", cls:"bg-orange-50 text-orange-700 border-orange-200" },
};

export const MOCK_VOS: VariationOrder[] = [
  {
    id:"vo1", vo_no:"VO-001", title:"Bổ sung tường kính cường lực sảnh B",
    type:"scope_addition", status:"approved", date_issued:"10/01/2026", date_approved:"18/01/2026",
    value_change: 1_850_000_000, contract_value_before: 85_000_000_000,
    description:"Thêm tường kính cường lực 12mm toàn bộ sảnh tầng 1 block B theo yêu cầu thay đổi thiết kế của CĐT.",
    reason:"CĐT yêu cầu nâng cấp thiết kế sảnh — xem biên bản họp ngày 05/01/2026.",
    submitted_by:"Nguyễn Văn Tùng (QS)", approved_by:"Ban Giám đốc DA",
    boq_items:[
      { code:"B.1.15", description:"Tường kính cường lực 12mm", qty_change:245, unit:"m²", unit_price:4_200_000 },
      { code:"B.1.16", description:"Khung nhôm định hình tường kính", qty_change:490, unit:"m dài", unit_price:850_000 },
    ],
  },
  {
    id:"vo2", vo_no:"VO-002", title:"Cắt giảm ốp đá granite sảnh A",
    type:"scope_omission", status:"implemented", date_issued:"15/01/2026", date_approved:"22/01/2026",
    value_change: -650_000_000, contract_value_before: 85_000_000_000,
    description:"Giảm diện tích ốp đá granite sảnh A do thay bằng sàn gỗ công nghiệp.",
    reason:"Tối ưu chi phí theo chỉ đạo GĐ DA — thay vật liệu sang gỗ công nghiệp cao cấp.",
    submitted_by:"Trần Thị Mai (QS)", approved_by:"Ban Giám đốc DA",
    boq_items:[
      { code:"A.2.08", description:"Ốp đá granite sảnh A (cắt giảm)", qty_change:-320, unit:"m²", unit_price:1_200_000 },
      { code:"A.2.09", description:"Công lắp đặt đá (cắt giảm)", qty_change:-320, unit:"m²", unit_price:230_000 },
    ],
  },
  {
    id:"vo3", vo_no:"VO-003", title:"Điều chỉnh đơn giá cốt thép do biến động thị trường",
    type:"unit_price_change", status:"submitted", date_issued:"20/02/2026",
    value_change: 2_400_000_000, contract_value_before: 86_350_000_000,
    description:"Điều chỉnh đơn giá cốt thép CB300-V (phi 16-25) theo biến động giá thép tháng 2/2026.",
    reason:"Giá thép CB300-V tăng 12% so với thời điểm ký HĐ (tháng 9/2025) — Theo điều khoản HĐ mục 8.3.",
    submitted_by:"Lê Văn Hùng (QS)",
    boq_items:[
      { code:"C.3.01", description:"Cốt thép CB300-V phi 16 — Điều chỉnh ĐG", qty_change:0, unit:"tấn", unit_price:1_850_000 },
      { code:"C.3.02", description:"Cốt thép CB300-V phi 20-25 — Điều chỉnh ĐG", qty_change:0, unit:"tấn", unit_price:1_950_000 },
    ],
    note:"Đang chờ CĐT phê duyệt — hạn phản hồi 10/03/2026",
  },
  {
    id:"vo4", vo_no:"VO-004", title:"Công tác đẩy nhanh tiến độ tầng hầm B2",
    type:"acceleration", status:"draft", date_issued:"01/03/2026",
    value_change: 980_000_000, contract_value_before: 88_750_000_000,
    description:"Chi phí nhân công tăng ca và thiết bị bổ sung để đẩy nhanh tầng hầm B2 theo yêu cầu CĐT.",
    reason:"CĐT yêu cầu hoàn thành tầng hầm B2 trước 30/04/2026 — sớm hơn kế hoạch 45 ngày.",
    submitted_by:"Nguyễn Văn Tùng (QS)",
    boq_items:[
      { code:"ACCEL-001", description:"Nhân công tăng ca tầng hầm B2 (est.)", qty_change:1200, unit:"công", unit_price:450_000 },
      { code:"ACCEL-002", description:"Thiết bị bổ sung (máy đào, cẩu)", qty_change:45, unit:"ca", unit_price:8_000_000 },
    ],
  },
  {
    id:"vo5", vo_no:"VO-005", title:"Gia cố nền đất yếu khu vực C — phát sinh ngoài dự kiến",
    type:"unforeseen", status:"rejected", date_issued:"05/02/2026",
    value_change: 3_200_000_000, contract_value_before: 86_350_000_000,
    description:"Gia cố nền đất yếu bất thường tại ô lưới C4-D6, tầng B1.",
    reason:"Kết quả khảo sát địa chất bổ sung phát hiện lớp bùn sét mềm yếu dày 3.5m không có trong hồ sơ khảo sát ban đầu.",
    submitted_by:"Trần Thị Mai (QS)", approved_by:"CĐT — Từ chối",
    note:"CĐT từ chối — yêu cầu xem lại hồ sơ khảo sát địa chất gốc. Đang tranh chấp.",
    boq_items:[
      { code:"UF-001", description:"Cọc xi măng đất φ600 gia cố khu vực C", qty_change:480, unit:"m", unit_price:280_000 },
      { code:"UF-002", description:"Đệm cát san lấp và đầm chặt", qty_change:850, unit:"m³", unit_price:380_000 },
    ],
  },
];


// ══════════════════════════════════════════════════════════════════════════════
// S12 — RATE LIBRARY (Đơn giá định mức)
// ══════════════════════════════════════════════════════════════════════════════

export type RateSource = 'thong_tu' | 'custom'; // Thông tư nhà nước | Tự nhập
export type RateUnit   = 'm' | 'm²' | 'm³' | 'tấn' | 'kg' | 'cái' | 'bộ' | 'đồng' | 'công' | 'ca' | 'km' | 'kw' | 'gói' | 'lô';

export interface RateItem {
  id:          string;
  code:        string;       // Mã định mức VD: AA.10110
  name:        string;
  unit:        RateUnit | string;
  unit_price:  number;       // VNĐ
  source:      RateSource;
  category:    string;       // Nhóm công tác VD: "Đất", "Bê tông", "Cốp pha"
  region?:     string;       // Vùng áp dụng
  effective?:  string;       // Hiệu lực từ (Thông tư)
  note?:       string;
}

// Seed rate library — đơn giá tham khảo theo TT13/2021/BXD
export const INIT_RATE_LIBRARY: RateItem[] = [
  // ── Công tác đất ──────────────────────────────────────────────────────────
  { id:'r001', code:'AB.11110', name:'Đào đất cấp I bằng máy đào ≤ 0.8m³', unit:'m³', unit_price:18_500, source:'thong_tu', category:'Đất', region:'TP.HCM', effective:'2021' },
  { id:'r002', code:'AB.11120', name:'Đào đất cấp II bằng máy đào ≤ 0.8m³', unit:'m³', unit_price:22_300, source:'thong_tu', category:'Đất', region:'TP.HCM', effective:'2021' },
  { id:'r003', code:'AB.21110', name:'Đắp đất công trình bằng máy đầm', unit:'m³', unit_price:28_700, source:'thong_tu', category:'Đất', region:'TP.HCM', effective:'2021' },
  // ── Bê tông ───────────────────────────────────────────────────────────────
  { id:'r010', code:'BE.11100', name:'Bê tông móng đơn, móng băng đổ tại chỗ M200', unit:'m³', unit_price:1_850_000, source:'thong_tu', category:'Bê tông', region:'TP.HCM', effective:'2021' },
  { id:'r011', code:'BE.21100', name:'Bê tông cột, trụ tiết diện ≤ 0.1m² M300', unit:'m³', unit_price:2_150_000, source:'thong_tu', category:'Bê tông', region:'TP.HCM', effective:'2021' },
  { id:'r012', code:'BE.31100', name:'Bê tông dầm nhà M300', unit:'m³', unit_price:2_080_000, source:'thong_tu', category:'Bê tông', region:'TP.HCM', effective:'2021' },
  { id:'r013', code:'BE.41100', name:'Bê tông sàn mái M300', unit:'m³', unit_price:1_980_000, source:'thong_tu', category:'Bê tông', region:'TP.HCM', effective:'2021' },
  // ── Cốt thép ──────────────────────────────────────────────────────────────
  { id:'r020', code:'BF.11110', name:'Gia công lắp dựng cốt thép móng ≤ 10mm', unit:'tấn', unit_price:8_200_000, source:'thong_tu', category:'Cốt thép', region:'TP.HCM', effective:'2021' },
  { id:'r021', code:'BF.21110', name:'Gia công lắp dựng cốt thép cột ≤ 18mm', unit:'tấn', unit_price:8_850_000, source:'thong_tu', category:'Cốt thép', region:'TP.HCM', effective:'2021' },
  // ── Cốp pha ───────────────────────────────────────────────────────────────
  { id:'r030', code:'BG.11110', name:'Lắp dựng cốp pha móng bằng gỗ', unit:'m²', unit_price:125_000, source:'thong_tu', category:'Cốp pha', region:'TP.HCM', effective:'2021' },
  { id:'r031', code:'BG.21110', name:'Lắp dựng cốp pha cột bằng thép', unit:'m²', unit_price:185_000, source:'thong_tu', category:'Cốp pha', region:'TP.HCM', effective:'2021' },
  // ── Xây gạch ──────────────────────────────────────────────────────────────
  { id:'r040', code:'BE.61110', name:'Xây tường gạch ống dày 100mm M75', unit:'m³', unit_price:980_000, source:'thong_tu', category:'Xây gạch', region:'TP.HCM', effective:'2021' },
  { id:'r041', code:'BE.61120', name:'Xây tường gạch ống dày 200mm M75', unit:'m³', unit_price:920_000, source:'thong_tu', category:'Xây gạch', region:'TP.HCM', effective:'2021' },
  // ── Hoàn thiện ────────────────────────────────────────────────────────────
  { id:'r050', code:'BJ.11110', name:'Trát tường trong nhà vữa xi măng M50 dày 15mm', unit:'m²', unit_price:48_500, source:'thong_tu', category:'Hoàn thiện', region:'TP.HCM', effective:'2021' },
  { id:'r051', code:'BJ.21110', name:'Lát nền gạch ceramic 400x400', unit:'m²', unit_price:125_000, source:'thong_tu', category:'Hoàn thiện', region:'TP.HCM', effective:'2021' },
];

export const RATE_CATEGORIES = ['Đất', 'Bê tông', 'Cốt thép', 'Cốp pha', 'Xây gạch', 'Hoàn thiện', 'Khác'];

// ══════════════════════════════════════════════════════════════════════════════
// S12 — PROCUREMENT TYPES (Mua sắm & Đấu thầu)
// ══════════════════════════════════════════════════════════════════════════════

export type RFQStatus      = 'draft' | 'submitted' | 'approved' | 'rejected' | 'closed';
export type QuoteStatus    = 'pending' | 'received' | 'selected' | 'rejected';
export type POStatus       = 'draft' | 'pending_pm' | 'pending_gd' | 'approved' | 'rejected' | 'completed';
export type ProcurementCat = 'vat_lieu' | 'thiet_bi' | 'nhan_cong' | 'dich_vu' | 'khac';

export interface Supplier {
  id:       string;
  name:     string;
  tax_code: string;
  phone:    string;
  email:    string;
  address:  string;
  category: ProcurementCat[];
  rating:   number;    // 1-5
  notes?:   string;
}

export interface RFQItem {
  boq_ref?:    string;   // Tham chiếu BOQ item nếu có
  description: string;
  unit:        string;
  qty:         number;
  note?:       string;
}

export interface RFQ {
  id:           string;
  rfq_no:       string;       // VD: RFQ-2026-001
  project_id:   string;
  title:        string;
  category:     ProcurementCat;
  items:        RFQItem[];
  requested_by: string;       // Công trình / Bộ phận cung ứng
  approved_by?: string;       // CHT → PM
  status:       RFQStatus;
  deadline:     string;       // Hạn báo giá
  notes?:       string;
  created_at:   string;
}

export interface QuoteItem {
  description: string;
  unit:        string;
  qty:         number;
  unit_price:  number;
  total:       number;
}

export interface Quote {
  id:          string;
  rfq_id:      string;
  supplier_id: string;
  supplier_name: string;
  quote_no?:   string;
  items:       QuoteItem[];
  subtotal:    number;
  vat_pct:     number;    // % VAT
  total:       number;
  validity:    string;    // Hiệu lực báo giá
  delivery:    string;    // Thời gian giao hàng
  status:      QuoteStatus;
  notes?:      string;
  received_at: string;
}

export interface PurchaseOrder {
  id:            string;
  po_no:         string;      // VD: PO-2026-001
  rfq_id:        string;
  quote_id:      string;
  project_id:    string;
  supplier_id:   string;
  supplier_name: string;
  items:         QuoteItem[];
  subtotal:      number;
  vat_pct:       number;
  total:         number;
  delivery_date: string;
  delivery_addr: string;
  payment_terms: string;    // Điều khoản thanh toán
  status:        POStatus;
  approved_by_pm?: string;
  approved_by_gd?: string;
  gd_threshold:  number;    // Ngưỡng duyệt GĐ (VNĐ)
  notes?:        string;
  created_at:    string;
  // Auto-update Materials khi approved
  mat_voucher_created?: boolean;
}

// ── Procurement constants ─────────────────────────────────────────────────────
export const PROCUREMENT_CAT: Record<ProcurementCat, { label: string; icon: string }> = {
  vat_lieu:  { label: 'Vật liệu',   icon: '🧱' },
  thiet_bi:  { label: 'Thiết bị',   icon: '⚙️' },
  nhan_cong: { label: 'Nhân công',  icon: '👷' },
  dich_vu:   { label: 'Dịch vụ',    icon: '🔧' },
  khac:      { label: 'Khác',       icon: '📦' },
};

export const RFQ_STATUS: Record<RFQStatus, { label: string; cls: string }> = {
  draft:     { label: 'Nháp',         cls: 'bg-slate-100 text-slate-600'   },
  submitted: { label: 'Chờ duyệt',    cls: 'bg-amber-100 text-amber-700'   },
  approved:  { label: 'Đã duyệt',     cls: 'bg-emerald-100 text-emerald-700'},
  rejected:  { label: 'Từ chối',      cls: 'bg-red-100 text-red-700'       },
  closed:    { label: 'Đã đóng',      cls: 'bg-slate-100 text-slate-500'   },
};

export const PO_STATUS: Record<POStatus, { label: string; cls: string }> = {
  draft:      { label: 'Nháp',          cls: 'bg-slate-100 text-slate-600'   },
  pending_pm: { label: 'Chờ PM duyệt',  cls: 'bg-amber-100 text-amber-700'   },
  pending_gd: { label: 'Chờ GĐ duyệt', cls: 'bg-orange-100 text-orange-700' },
  approved:   { label: 'Đã duyệt',      cls: 'bg-emerald-100 text-emerald-700'},
  rejected:   { label: 'Từ chối',       cls: 'bg-red-100 text-red-700'       },
  completed:  { label: 'Hoàn thành',    cls: 'bg-blue-100 text-blue-700'     },
};

export const DEFAULT_GD_THRESHOLD = 500_000_000; // 500 triệu VNĐ

// Seed data
export const INIT_SUPPLIERS: Supplier[] = [
  { id:'s1', name:'Công ty TNHH Vật liệu Xây dựng Hoàng Phát', tax_code:'0312345678', phone:'0901234567', email:'contact@hoangphat.vn', address:'123 Điện Biên Phủ, Q.Bình Thạnh, TP.HCM', category:['vat_lieu'], rating:4, notes:'Nhà cung cấp thép, xi măng' },
  { id:'s2', name:'Công ty CP Thiết bị Xây dựng Miền Nam', tax_code:'0398765432', phone:'0912345678', email:'info@tbxdmn.vn', address:'456 Quốc lộ 13, Bình Dương', category:['thiet_bi'], rating:4 },
  { id:'s3', name:'HTX Dịch vụ Nhân công Xây dựng Phú Mỹ', tax_code:'0387654321', phone:'0923456789', email:'', address:'789 Nguyễn Văn Linh, Q.7, TP.HCM', category:['nhan_cong'], rating:3 },
];

export const INIT_RFQS: RFQ[] = [
  {
    id:'rfq1', rfq_no:'RFQ-2026-001', project_id:'',
    title:'Cung cấp thép CB400-V φ12-φ25 tháng 4/2026',
    category:'vat_lieu',
    items:[
      { description:'Thép CB400-V φ12', unit:'tấn', qty:15.5, note:'Cốt thép sàn tầng 3-5' },
      { description:'Thép CB400-V φ16', unit:'tấn', qty:22.0, note:'Cốt thép cột tầng 3-5' },
      { description:'Thép CB400-V φ25', unit:'tấn', qty:8.5, note:'Cốt thép dầm chính' },
    ],
    requested_by:'Nguyễn Văn Hùng - Tổ trưởng Cốt thép',
    status:'approved', deadline:'25/03/2026', created_at:'15/03/2026',
    notes:'Cần giao hàng đúng tiến độ — tầng 3 bắt đầu đổ BT 01/04/2026',
  },
];

export const INIT_POS: PurchaseOrder[] = [];
