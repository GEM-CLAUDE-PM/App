// GanttTypes.ts — GEM & CLAUDE PM Pro
// Shared types, constants, seed data cho Gantt & ProgressDashboard

// 4 loại quan hệ phụ thuộc chuẩn PM (tương thích MS Project)
export type DepType = 'FS' | 'SS' | 'FF' | 'SF';
export type DepLink = {
  wbsId: string;
  type:  DepType;
  lag?:  number; // ngày: dương = gap (chờ thêm), âm = lead (bắt đầu sớm hơn)
};

// ─── WBS Item type ────────────────────────────────────────────────────────────
export type WBSItem = {
  id: string; code: string; name: string;
  budget: number; pv_pct: number; ev_pct: number; ac: number;
  category: string; responsible: string; critical: boolean;
  gantt_start_date?: string;
  gantt_end_date?: string;
  gantt_baseline_start?: string;
  gantt_baseline_end?: string;
  depends_on?: string[];   // legacy FS only — giữ để backward compat
  dep_links?:  DepLink[];  // S32: đầy đủ FS/SS/FF/SF + lag
  responsible_id?: string;
  resource_ids?: string[];
  delay_days?: number;
  // legacy drag fields
  gantt_start?: number;
  gantt_dur?: number;
};

// ─── S34 TODO: Scheduling Engine + Predecessor UX ────────────────────────────
//
// ── 1. HIỂN THỊ — theo chuẩn MS Project ──────────────────────────────────────
//   Format: "[số thứ tự][ loại quan hệ][lag]"
//   VD:  "3"      = task 3, FS, không lag (FS là mặc định — ẩn loại nếu FS+0)
//        "3FS"    = task 3, Finish-to-Start, không lag
//        "4SS+2d" = task 4, Start-to-Start, lag +2 ngày
//        "5FF-1d" = task 5, Finish-to-Finish, lead 1 ngày
//        "2,3"    = task 2 và task 3, đều là FS
//   Màu sắc giữ nguyên:
//        FS → teal  |  SS → blue  |  FF → violet  |  SF → orange
//
// ── 2. NHẬP LIỆU THẲNG TRONG CỘT PREDECESSOR ─────────────────────────────────
//   - Click vào ô Predecessor → input text editable (như Excel)
//   - Nhập: "3" hoặc "3FS" hoặc "4SS+2d" hoặc "2,3FS-1d"
//   - Parse regex: /^(\d+)(FS|SS|FF|SF)?([+-]\d+d?)?$/i
//   - Validate: không cho circular dependency
//   - Enter/blur → parse → update dep_links → recalculate dates cascade
//   - Escape → cancel edit
//
// ── 3. RIGHT-CLICK TRÊN BAR → MINI MODAL FORM ────────────────────────────────
//   Modal nhỏ (không phải context menu text):
//   ┌─────────────────────────────────────┐
//   │ Thêm liên kết cho: [Tên task]       │
//   ├─────────────────────────────────────┤
//   │ Predecessor: [dropdown list tasks]  │
//   │ Loại:        [FS ▾] [SS] [FF] [SF] │
//   │ Lag (ngày):  [  0  ] (+gap / -lead)│
//   │                                     │
//   │        [Huỷ]    [Thêm liên kết]    │
//   └─────────────────────────────────────┘
//   - Dropdown tasks: hiện số thứ tự + tên, filter bỏ circular
//   - Lag: number input, +/- button, tooltip giải thích
//   - Submit → update dep_links → trigger recalculate dates
//
// ── 4. SCHEDULING ENGINE — tính start/finish từ predecessor ──────────────────
//   lag > 0 = gap (chờ thêm X ngày)  |  lag < 0 = lead (bắt đầu sớm X ngày)
//
//   FS: successor.start  = predecessor.finish + lag
//   SS: successor.start  = predecessor.start  + lag
//   FF: successor.finish = predecessor.finish + lag  → start = finish - dur
//   SF: successor.finish = predecessor.start  + lag  → start = finish - dur
//
//   Forward Pass CPM:
//   1. Topo sort (Kahn's algorithm)
//   2. Không có predecessor → giữ nguyên ngày PM nhập
//   3. Có predecessor → tính từ TẤT CẢ, lấy ngày LỚN NHẤT (latest constraint)
//   4. gantt_end_date = start + dur
//   5. Backward pass → float → critical path
//   6. Cascade: khi 1 task thay đổi → recalculate tất cả successors
//
// ── 5. IMPORT MS PROJECT .MPP ────────────────────────────────────────────────
//   .mpp là binary → user export sang .xml (File → Save As → XML)
//   Parse XML Task nodes:
//     Task.Name                              → WBSItem.name
//     Task.OutlineNumber                     → WBSItem.code
//     Task.Cost                              → WBSItem.budget
//     Task.Start / Task.Finish               → gantt_start_date / gantt_end_date
//     Task.PercentWorkComplete               → WBSItem.ev_pct
//     Task.PredecessorLink.PredecessorUID    → dep_links[].wbsId (map qua UID)
//     Task.PredecessorLink.Type (0=FF,1=FS,2=SF,3=SS) → dep_links[].type
//     Task.PredecessorLink.LinkLag (phút)    → dep_links[].lag (÷ 480 = ngày)
// ─────────────────────────────────────────────────────────────────────────────

// Hàm tính ngày successor — core của scheduling engine S34
// Exported để test và tái dùng trong recalculate cascade
export function calcSuccessorStart(
  predStart: Date, predDur: number,
  depType: DepType, lag: number = 0
): Date {
  const predFinish = new Date(predStart.getTime() + predDur * 86400000);
  let resultMs: number;
  switch (depType) {
    case 'FS': resultMs = predFinish.getTime() + lag * 86400000; break;
    case 'SS': resultMs = predStart.getTime()  + lag * 86400000; break;
    case 'FF': resultMs = predFinish.getTime() + lag * 86400000; break; // caller: start = result - dur
    case 'SF': resultMs = predStart.getTime()  + lag * 86400000; break; // caller: start = result - dur
    default:   resultMs = predFinish.getTime();
  }
  return new Date(resultMs);
}

// Parse predecessor text như MS Project: "3", "3FS", "4SS+2d", "2,3FS-1d"
// Dùng trong S34 inline edit + import
export function parsePredecessorText(
  text: string,
  items: { id: number; wbsId?: string }[]
): { wbsId: string; type: DepType; lag: number }[] {
  const result: { wbsId: string; type: DepType; lag: number }[] = [];
  const parts = text.split(',').map(s => s.trim()).filter(Boolean);
  for (const part of parts) {
    const m = part.match(/^(\d+)(FS|SS|FF|SF)?([+-]\d+)d?$/i);
    if (!m) continue;
    const idx  = parseInt(m[1]) - 1; // 1-based → 0-based
    const item = items[idx];
    if (!item?.wbsId) continue;
    const type = ((m[2] ?? 'FS').toUpperCase()) as DepType;
    const lag  = m[3] ? parseInt(m[3]) : 0;
    result.push({ wbsId: item.wbsId, type, lag });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────

// ─── Seed data ────────────────────────────────────────────────────────────────
export const WBS_INIT: WBSItem[] = [
  { id:'1', code:'1.0', name:'Công tác chuẩn bị',         budget:1.8,  pv_pct:100, ev_pct:100, ac:1.95, category:'Móng',       responsible:'Trần Văn B', critical:false, gantt_start_date:undefined, gantt_end_date:undefined },
  { id:'2', code:'2.0', name:'Thi công móng cọc',          budget:5.2,  pv_pct:100, ev_pct:100, ac:5.60, category:'Móng',       responsible:'Trần Văn B', critical:false, gantt_start_date:undefined, gantt_end_date:undefined },
  { id:'3', code:'3.0', name:'Đài móng & giằng móng',      budget:3.8,  pv_pct:85,  ev_pct:72,  ac:3.20, category:'Móng',       responsible:'Lê Thị C',   critical:true,  gantt_start_date:undefined, gantt_end_date:undefined },
  { id:'4', code:'4.0', name:'Tầng hầm (tường vây & sàn)', budget:6.4,  pv_pct:65,  ev_pct:48,  ac:4.10, category:'Thân nhà',   responsible:'Trần Văn B', critical:true,  gantt_start_date:undefined, gantt_end_date:undefined },
  { id:'5', code:'5.0', name:'Cột & dầm tầng 1-2',         budget:4.2,  pv_pct:42,  ev_pct:28,  ac:1.40, category:'Thân nhà',   responsible:'Lê Thị C',   critical:true,  gantt_start_date:undefined, gantt_end_date:undefined },
  { id:'6', code:'6.0', name:'Sàn tầng 1-2',               budget:3.1,  pv_pct:30,  ev_pct:14,  ac:0.52, category:'Thân nhà',   responsible:'Trần Văn B', critical:true,  gantt_start_date:undefined, gantt_end_date:undefined },
  { id:'7', code:'7.0', name:'Xây tường bao tầng 1',       budget:2.4,  pv_pct:15,  ev_pct:5,   ac:0.14, category:'Hoàn thiện', responsible:'Lê Thị C',   critical:false, gantt_start_date:undefined, gantt_end_date:undefined },
  { id:'8', code:'8.0', name:'Hệ thống M&E (điện, nước)',  budget:7.8,  pv_pct:22,  ev_pct:10,  ac:0.90, category:'M&E',        responsible:'Phạm Văn D', critical:false, gantt_start_date:undefined, gantt_end_date:undefined },
  { id:'9', code:'9.0', name:'Hoàn thiện kiến trúc',       budget:6.5,  pv_pct:0,   ev_pct:0,   ac:0.00, category:'Hoàn thiện', responsible:'Lê Thị C',   critical:false, gantt_start_date:undefined, gantt_end_date:undefined },
  { id:'10',code:'10.0',name:'Nghiệm thu & bàn giao',      budget:1.8,  pv_pct:0,   ev_pct:0,   ac:0.00, category:'Kết thúc',   responsible:'Nguyễn A',   critical:false, gantt_start_date:undefined, gantt_end_date:undefined },
];

export const MILESTONES_INIT = [
  { id:'ms1', name:'Xong móng cọc',           plan:'25/01/2026', actual:'23/01/2026', status:'done',     delta:-2, critical:false },
  { id:'ms2', name:'Xong tầng hầm B1',        plan:'22/02/2026', actual:'',           status:'delayed',  delta:12, critical:true  },
  { id:'ms3', name:'Cất nóc (hoàn thiện thô)',plan:'30/04/2026', actual:'',           status:'at_risk',  delta:0,  critical:true  },
  { id:'ms4', name:'Hoàn thiện toàn bộ',      plan:'31/07/2026', actual:'',           status:'on_track', delta:0,  critical:false },
  { id:'ms5', name:'Bàn giao CĐT',            plan:'15/08/2026', actual:'',           status:'on_track', delta:0,  critical:false },
];

export const CAT_CLS: Record<string,string> = {
  'Móng':       'bg-emerald-100 text-emerald-700',
  'Thân nhà':   'bg-blue-100 text-blue-700',
  'Hoàn thiện': 'bg-orange-100 text-orange-700',
  'M&E':        'bg-purple-100 text-purple-700',
  'Kết thúc':   'bg-slate-100 text-slate-600',
};

export const DELAY_REASONS = [
  { value:'rain',     label:'Mưa lớn',      icon:'🌧' },
  { value:'holiday',  label:'Nghỉ lễ',      icon:'📅' },
  { value:'incident', label:'Sự cố',        icon:'⚠️' },
  { value:'material', label:'Thiếu vật tư', icon:'📦' },
  { value:'other',    label:'Khác',         icon:'📝' },
];

export const GEM_SYS = `Bạn là Nàng GEM Siêu Việt — chuyên gia phân tích tiến độ và Earned Value Management (EVM) xây dựng. Xưng "em", gọi "Anh/Chị". Phân tích ngắn gọn, súc tích, chuyên nghiệp. Đưa ra cảnh báo rõ ràng và khuyến nghị hành động cụ thể.`;

// ─── EVM helpers ──────────────────────────────────────────────────────────────
export function calcEVM(wbs: WBSItem[]) {
  const BAC  = +wbs.reduce((s,w) => s + (w.budget||0), 0).toFixed(3);
  const EV   = +wbs.reduce((s,w) => s + (w.budget||0)*(w.ev_pct||0)/100, 0).toFixed(3);
  const PV   = +wbs.reduce((s,w) => s + (w.budget||0)*(w.pv_pct||0)/100, 0).toFixed(3);
  const AC   = +wbs.reduce((s,w) => s + (w.ac||0), 0).toFixed(3);
  const SPI  = PV > 0 ? +(EV/PV).toFixed(3) : 1;
  const CPI  = AC > 0 ? +(EV/AC).toFixed(3) : 1;
  const SV   = +(EV-PV).toFixed(2);
  const CV   = +(EV-AC).toFixed(2);
  const EAC  = CPI > 0 ? +(BAC/CPI).toFixed(2) : BAC;
  const ETC  = +(EAC-AC).toFixed(2);
  const VAC  = +(BAC-EAC).toFixed(2);
  const denom = BAC - AC;
  const TCPI = denom > 0 ? +((BAC-EV)/denom).toFixed(3) : 1;
  return { BAC, EV, PV, AC, SPI, CPI, SV, CV, EAC, ETC, VAC, TCPI };
}

export function calcGanttRange(project?: { startDate?: string; endDate?: string }) {
  const parseVN = (s?: string) => {
    if (!s || s === '-') return null;
    const parts = s.split('/');
    if (parts.length === 3) return new Date(`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`);
    return null;
  };
  const start = parseVN(project?.startDate);
  const end   = parseVN(project?.endDate);
  const now   = new Date();
  if (!start || !end || end <= start) return { totalDays:120, todayIndex:0, startMs:now.getTime() };
  const totalDays  = Math.round((end.getTime()-start.getTime())/86400000);
  const todayIndex = Math.max(0, Math.min(totalDays, Math.round((now.getTime()-start.getTime())/86400000)));
  return { totalDays, todayIndex, startMs: start.getTime() };
}

export function buildSCurveData(wbs: WBSItem[], totalDays: number, todayIndex: number, BAC: number) {
  if (BAC <= 0 || totalDays <= 0) return [];
  const weeks = Math.ceil(totalDays / 7);
  const result: { week:string; pv:number; ev:number|null; ac:number|null; forecast_ev?:number; forecast_ac?:number; label:string }[] = [];
  const todayWeek = Math.floor(todayIndex / 7);
  for (let w = 0; w < weeks; w++) {
    const dayPct = Math.min(1, (w+1)*7/totalDays);
    const pvCum  = +wbs.reduce((s,item) => s + (item.budget||0)*Math.min(item.pv_pct/100, dayPct > item.pv_pct/100 ? 1 : dayPct/(item.pv_pct/100||1)), 0).toFixed(2);
    const isPast = w < todayWeek, isCurrent = w === todayWeek;
    const evCum  = isPast||isCurrent ? +wbs.reduce((s,item) => s+(item.budget||0)*Math.min(dayPct, item.ev_pct/100), 0).toFixed(2) : null;
    const acCum  = isPast||isCurrent ? +wbs.reduce((s,item) => s+Math.min(item.ac||0, (item.ac||0)*(dayPct/(item.ev_pct/100||1))), 0).toFixed(2) : null;
    const fEV = !isPast&&!isCurrent&&BAC>0 ? +(wbs.reduce((s,i) => s+(i.budget||0)*Math.min(1,dayPct*1.05),0)).toFixed(2) : undefined;
    const fAC = !isPast&&!isCurrent&&BAC>0 ? +(fEV ? fEV*1.08 : 0).toFixed(2) : undefined;
    result.push({ week:`T${w+1}`, pv:pvCum, ev:evCum, ac:acCum, forecast_ev:fEV, forecast_ac:fAC, label:`Tuần ${w+1}` });
  }
  return result;
}
