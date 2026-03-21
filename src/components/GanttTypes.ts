// GanttTypes.ts — GEM & CLAUDE PM Pro
// Shared types, constants, seed data cho Gantt & ProgressDashboard

// 4 loại quan hệ phụ thuộc chuẩn PM (tương thích MS Project)
export type DepType = 'FS' | 'SS' | 'FF' | 'SF';
export type DepLink = { wbsId: string; type: DepType; lag?: number };

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

// ─── S34 TODO: Import từ MS Project (.mpp) ────────────────────────────────────
// MS Project .mpp là binary format — cần thư viện parse phía server hoặc
// export từ MS Project ra XML (.xml) rồi parse trên client.
// Mapping khi import:
//   Task.Name          → WBSItem.name
//   Task.OutlineNumber → WBSItem.code
//   Task.Cost          → WBSItem.budget
//   Task.Start         → WBSItem.gantt_start_date
//   Task.Finish        → WBSItem.gantt_end_date
//   Task.PercentWorkComplete → WBSItem.ev_pct
//   Task.PredecessorLink.PredecessorUID + Type (0=FF,1=FS,2=SF,3=SS) + Lag
//                      → WBSItem.dep_links
// Approach khuyến nghị S34:
//   1. User export .mpp → .xml từ MS Project (File → Save As → XML)
//   2. App đọc XML → parse Task nodes → map sang WBSItem[]
//   3. Preview → confirm → db.set('progress_wbs')
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
