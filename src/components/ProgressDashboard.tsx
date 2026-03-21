import React, { useState, useCallback, useRef } from 'react';
import { loadMembers } from './projectMember';
import {
  TrendingUp, Clock, AlertTriangle, Award, CheckCircle, Target,
  Sparkles, Loader2, FileSpreadsheet, ChevronDown, ChevronUp,
  BarChart2, Activity, Zap, Flag, Edit3, Save, X, Plus, RefreshCw,
  ArrowUp, ArrowDown, Minus, Info, Printer, GripVertical, DollarSign,
  Camera, GitBranch
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Dot
} from 'recharts';
import { genAI, GEM_MODEL, GEM_MODEL_QUALITY } from './gemini';
import { db, useRealtimeSync } from './db';
import { useAuth } from './AuthProvider';
import { getProjectTemplate, applyTemplate, PROJECT_TEMPLATES } from './projectTemplates';
import { usePrint } from './PrintService';
import { useNotification } from './NotificationEngine';

import type { DashboardProps } from './types';

type Props = DashboardProps;

// ─── EVM helpers — tính từ WBS data thật ────────────────────────────────────
type WBSItem = typeof WBS_INIT[number] & {
  gantt_start_date?: string;  // ISO "2026-01-15"
  gantt_end_date?: string;    // ISO "2026-03-30"
  gantt_baseline_start?: string;
  gantt_baseline_end?: string;
  depends_on?: string[];
  responsible_id?: string;
  resource_ids?: string[];
  delay_days?: number;
  // legacy drag fields (px-based, giữ tương thích)
  gantt_start?: number;
  gantt_dur?: number;
};

function calcEVM(wbs: WBSItem[]) {
  const BAC   = +wbs.reduce((s, w) => s + (w.budget || 0), 0).toFixed(3);
  const EV    = +wbs.reduce((s, w) => s + (w.budget || 0) * (w.ev_pct || 0) / 100, 0).toFixed(3);
  const PV    = +wbs.reduce((s, w) => s + (w.budget || 0) * (w.pv_pct || 0) / 100, 0).toFixed(3);
  const AC    = +wbs.reduce((s, w) => s + (w.ac || 0), 0).toFixed(3);
  const SPI   = PV > 0  ? +(EV / PV).toFixed(3) : 1;
  const CPI   = AC > 0  ? +(EV / AC).toFixed(3) : 1;
  const SV    = +(EV - PV).toFixed(2);
  const CV    = +(EV - AC).toFixed(2);
  const EAC   = CPI > 0 ? +(BAC / CPI).toFixed(2) : BAC;
  const ETC   = +(EAC - AC).toFixed(2);
  const VAC   = +(BAC - EAC).toFixed(2);
  const denom = BAC - AC;
  const TCPI  = denom > 0 ? +((BAC - EV) / denom).toFixed(3) : 1;
  return { BAC, EV, PV, AC, SPI, CPI, SV, CV, EAC, ETC, VAC, TCPI };
}

/** Tính totalDays và todayIndex từ project start/end date */
function calcGanttRange(project?: { startDate?: string; endDate?: string }) {
  const parseVN = (s?: string) => {
    if (!s || s === '-') return null;
    const parts = s.split('/');
    if (parts.length === 3) return new Date(`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`);
    return null;
  };
  const start = parseVN(project?.startDate);
  const end   = parseVN(project?.endDate);
  const now   = new Date();
  if (!start || !end || end <= start) return { totalDays: 120, todayIndex: 0, startMs: now.getTime() };
  const totalDays  = Math.round((end.getTime() - start.getTime()) / 86400000);
  const todayIndex = Math.max(0, Math.min(totalDays, Math.round((now.getTime() - start.getTime()) / 86400000)));
  return { totalDays, todayIndex, startMs: start.getTime() };
}

/** Tạo S-Curve weekly từ WBS data (snapshot lịch sử + dự báo) */
function buildSCurveData(wbs: WBSItem[], totalDays: number, todayIndex: number, BAC: number) {
  if (BAC <= 0 || totalDays <= 0) return [];
  const weeks = Math.ceil(totalDays / 7);
  const result: { week: string; pv: number; ev: number | null; ac: number | null; forecast_ev?: number; forecast_ac?: number; label: string }[] = [];
  const todayWeek = Math.floor(todayIndex / 7);
  for (let w = 0; w < weeks; w++) {
    const dayPct = Math.min(1, (w + 1) * 7 / totalDays);
    const pvCum = +wbs.reduce((s, item) => s + (item.budget || 0) * Math.min(item.pv_pct / 100, dayPct > item.pv_pct / 100 ? 1 : dayPct / (item.pv_pct / 100 || 1)), 0).toFixed(2);
    const isPast = w < todayWeek;
    const isCurrent = w === todayWeek;
    const evCum  = isPast || isCurrent ? +wbs.reduce((s, item) => s + (item.budget || 0) * Math.min(dayPct, item.ev_pct / 100), 0).toFixed(2) : null;
    const acCum  = isPast || isCurrent ? +wbs.reduce((s, item) => s + Math.min(item.ac || 0, (item.ac || 0) * (dayPct / (item.ev_pct / 100 || 1))), 0).toFixed(2) : null;
    const fEV = !isPast && !isCurrent && BAC > 0 ? +(wbs.reduce((s, i) => s + (i.budget || 0) * Math.min(1, dayPct * 1.05), 0)).toFixed(2) : undefined;
    const fAC = !isPast && !isCurrent && BAC > 0 ? +(fEV ? fEV * 1.08 : 0).toFixed(2) : undefined;
    result.push({ week: `T${w+1}`, pv: pvCum, ev: evCum, ac: acCum, forecast_ev: fEV, forecast_ac: fAC, label: `Tuần ${w+1}` });
  }
  return result;
}

// ─── WBS / Work packages — seed data (chỉ dùng khi chưa có data trong DB) ─────
const WBS_INIT: WBSItem[] = [
  { id:'1', code:'1.0', name:'Công tác chuẩn bị',        budget:1.8,  pv_pct:100, ev_pct:100, ac:1.95, category:'Móng',       responsible:'Trần Văn B', critical:false, gantt_start_date: undefined, gantt_end_date: undefined },
  { id:'2', code:'2.0', name:'Thi công móng cọc',         budget:5.2,  pv_pct:100, ev_pct:100, ac:5.60, category:'Móng',       responsible:'Trần Văn B', critical:false, gantt_start_date: undefined, gantt_end_date: undefined },
  { id:'3', code:'3.0', name:'Đài móng & giằng móng',     budget:3.8,  pv_pct:85,  ev_pct:72,  ac:3.20, category:'Móng',       responsible:'Lê Thị C',   critical:true,  gantt_start_date: undefined, gantt_end_date: undefined },
  { id:'4', code:'4.0', name:'Tầng hầm (tường vây & sàn)',budget:6.4,  pv_pct:65,  ev_pct:48,  ac:4.10, category:'Thân nhà',   responsible:'Trần Văn B', critical:true,  gantt_start_date: undefined, gantt_end_date: undefined },
  { id:'5', code:'5.0', name:'Cột & dầm tầng 1-2',        budget:4.2,  pv_pct:42,  ev_pct:28,  ac:1.40, category:'Thân nhà',   responsible:'Lê Thị C',   critical:true,  gantt_start_date: undefined, gantt_end_date: undefined },
  { id:'6', code:'6.0', name:'Sàn tầng 1-2',              budget:3.1,  pv_pct:30,  ev_pct:14,  ac:0.52, category:'Thân nhà',   responsible:'Trần Văn B', critical:true,  gantt_start_date: undefined, gantt_end_date: undefined },
  { id:'7', code:'7.0', name:'Xây tường bao tầng 1',      budget:2.4,  pv_pct:15,  ev_pct:5,   ac:0.14, category:'Hoàn thiện', responsible:'Lê Thị C',   critical:false, gantt_start_date: undefined, gantt_end_date: undefined },
  { id:'8', code:'8.0', name:'Hệ thống M&E (điện, nước)', budget:7.8,  pv_pct:22,  ev_pct:10,  ac:0.90, category:'M&E',        responsible:'Phạm Văn D', critical:false, gantt_start_date: undefined, gantt_end_date: undefined },
  { id:'9', code:'9.0', name:'Hoàn thiện kiến trúc',      budget:6.5,  pv_pct:0,   ev_pct:0,   ac:0.00, category:'Hoàn thiện', responsible:'Lê Thị C',   critical:false, gantt_start_date: undefined, gantt_end_date: undefined },
  { id:'10',code:'10.0',name:'Nghiệm thu & bàn giao',     budget:1.8,  pv_pct:0,   ev_pct:0,   ac:0.00, category:'Kết thúc',   responsible:'Nguyễn A',   critical:false, gantt_start_date: undefined, gantt_end_date: undefined },
];

// ─── Milestones ───────────────────────────────────────────────────────────────
const MILESTONES_INIT = [
  { id:'ms1', name:'Xong móng cọc',      plan:'25/01/2026', actual:'23/01/2026', status:'done',     delta:-2, critical:false },
  { id:'ms2', name:'Xong tầng hầm B1',   plan:'22/02/2026', actual:'',           status:'delayed',  delta:12, critical:true  },
  { id:'ms3', name:'Cất nóc (hoàn thiện thô)', plan:'30/04/2026', actual:'', status:'at_risk', delta:0, critical:true  },
  { id:'ms4', name:'Hoàn thiện toàn bộ', plan:'31/07/2026', actual:'',           status:'on_track', delta:0, critical:false },
  { id:'ms5', name:'Bàn giao CĐT',       plan:'15/08/2026', actual:'',           status:'on_track', delta:0, critical:false },
];

const MS_STATUS: Record<string,{label:string;cls:string;icon:React.ReactNode}> = {
  done:     { label:'Hoàn thành', cls:'bg-emerald-100 text-emerald-700 border-emerald-200', icon:<CheckCircle size={13} className="text-emerald-600"/> },
  delayed:  { label:'Chậm',      cls:'bg-rose-100 text-rose-700 border-rose-200',          icon:<AlertTriangle size={13} className="text-rose-500"/> },
  at_risk:  { label:'Rủi ro',    cls:'bg-amber-100 text-amber-700 border-amber-200',       icon:<AlertTriangle size={13} className="text-amber-500"/> },
  on_track: { label:'Đúng tiến độ',cls:'bg-blue-100 text-blue-700 border-blue-200',        icon:<Target size={13} className="text-blue-500"/> },
};

const CAT_CLS: Record<string,string> = {
  'Móng':      'bg-emerald-100 text-emerald-700',
  'Thân nhà':  'bg-blue-100 text-blue-700',
  'Hoàn thiện':'bg-orange-100 text-orange-700',
  'M&E':       'bg-purple-100 text-purple-700',
  'Kết thúc':  'bg-slate-100 text-slate-600',
};

const GEM_SYS = `Bạn là Nàng GEM Siêu Việt — chuyên gia phân tích tiến độ và Earned Value Management (EVM) xây dựng. Xưng "em", gọi "Anh/Chị". Phân tích ngắn gọn, súc tích, chuyên nghiệp. Đưa ra cảnh báo rõ ràng và khuyến nghị hành động cụ thể.`;

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const EVMTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-bold text-slate-700 mb-2">{payload[0]?.payload?.label || label}</p>
      {payload.map((p: any, i: number) => p.value != null && (
        <div key={i} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full shrink-0" style={{background:p.color}}/>
          <span className="text-slate-600">{p.name}:</span>
          <span className="font-bold text-slate-800">{typeof p.value==='number'?p.value.toFixed(1)+' tỷ':p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── SPI/CPI Gauge ────────────────────────────────────────────────────────────
function IndexBadge({ label, value, threshold1=0.85, threshold2=0.95, unit='' }: { label:string; value:number; threshold1?:number; threshold2?:number; unit?:string }) {
  const cls = value >= threshold2 ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
            : value >= threshold1 ? 'text-amber-600 bg-amber-50 border-amber-200'
            : 'text-rose-600 bg-rose-50 border-rose-200';
  const Icon = value >= threshold2 ? ArrowUp : value >= threshold1 ? Minus : ArrowDown;
  return (
    <div className={`flex flex-col items-center p-4 rounded-2xl border-2 ${cls} min-w-[110px]`}>
      <div className="text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">{label}</div>
      <div className="text-3xl font-black">{value.toFixed(3)}{unit}</div>
      <div className={`flex items-center gap-1 text-[10px] font-bold mt-1`}>
        <Icon size={10}/>{value >= threshold2 ? 'Tốt' : value >= threshold1 ? 'Cần chú ý' : 'Cảnh báo'}
      </div>
    </div>
  );
}

// ─── GanttChart S32 — drag bar + resize + inline % edit + zoom 3 cấp ────────
type GanttTask = {
  id: number; name: string; start: number; dur: number;
  done: number; cat: string; wbsId?: string;
  gantt_start_date?: string; gantt_end_date?: string;
  // Financial fields (PA3 Split View)
  budget?: number; ac?: number; pv_pct?: number; ev_pct?: number;
};

type GanttZoom = 'week' | 'month' | 'quarter';
type DragMode = 'row' | 'bar' | 'resize' | null;

function GanttChart({
  tasks, totalDays, today, startMs = 0, onReorder, onUpdateTask, onFreezeBaseline, canViewFinance = false, canViewFinanceNumbers = false,
}: {
  tasks: GanttTask[];
  totalDays: number;
  today: number;
  startMs?: number;
  onReorder: (tasks: GanttTask[]) => void;
  onUpdateTask?: (task: GanttTask) => void;
  onFreezeBaseline?: (tasks: GanttTask[]) => void;
  canViewFinance?: boolean;
  canViewFinanceNumbers?: boolean;
}) {
  const [items, setItems] = React.useState<GanttTask[]>(tasks);
  const [showFinance, setShowFinance] = React.useState(canViewFinance);
  const [zoom, setZoom] = React.useState<GanttZoom>('week');
  const [showConfirmBaseline, setShowConfirmBaseline] = React.useState(false);
  const [dragMode, setDragMode]     = React.useState<DragMode>(null);
  const [draggingRow, setDraggingRow]   = React.useState<number | null>(null);
  const [dragOverRow, setDragOverRow]   = React.useState<number | null>(null);
  const [editingDone, setEditingDone]   = React.useState<number | null>(null);

  const barDragRef = useRef<{
    taskId: number; mode: 'bar' | 'resize';
    startX: number; origStart: number; origDur: number;
  } | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => { setItems(tasks); }, [tasks]);

  // Kiểm tra đã có baseline chưa (bất kỳ task nào có gantt_baseline_start)
  const hasBaseline = items.some(t => t.gantt_baseline_start);

  // Freeze baseline — copy gantt_start_date/end_date → baseline fields
  const freezeBaseline = () => {
    const next = items.map(t => ({
      ...t,
      gantt_baseline_start: t.gantt_start_date,
      gantt_baseline_end:   t.gantt_end_date,
    }));
    setItems(next);
    onFreezeBaseline?.(next);
    setShowConfirmBaseline(false);
  };

  // ── Tính tick marks cho header theo zoom level ────────────────────────────
  const headerTicks = React.useMemo(() => {
    if (totalDays <= 0) return [];
    const ticks: { day: number; label: string }[] = [];
    if (zoom === 'week') {
      // Mỗi 7 ngày = 1 tuần
      const numWeeks = Math.ceil(totalDays / 7);
      for (let w = 0; w < numWeeks; w++) {
        const day = w * 7;
        if (startMs > 0) {
          const d = new Date(startMs + day * 86400000);
          ticks.push({ day, label: `${d.getDate()}/${d.getMonth()+1}` });
        } else {
          ticks.push({ day, label: `T${w+1}` });
        }
      }
    } else if (zoom === 'month') {
      // Mỗi tháng 1 tick
      if (startMs > 0) {
        const start = new Date(startMs);
        const cur = new Date(start.getFullYear(), start.getMonth(), 1);
        while (true) {
          const dayOff = Math.round((cur.getTime() - startMs) / 86400000);
          if (dayOff >= totalDays) break;
          const label = `T${cur.getMonth()+1}/${cur.getFullYear().toString().slice(2)}`;
          ticks.push({ day: Math.max(0, dayOff), label });
          cur.setMonth(cur.getMonth() + 1);
          if (ticks.length > 36) break;
        }
      } else {
        for (let d = 0; d < totalDays; d += 30)
          ticks.push({ day: d, label: `T${Math.floor(d/30)+1}` });
      }
    } else {
      // Quarter — mỗi 3 tháng 1 tick
      if (startMs > 0) {
        const start = new Date(startMs);
        const qMonth = Math.floor(start.getMonth() / 3) * 3;
        const cur = new Date(start.getFullYear(), qMonth, 1);
        while (true) {
          const dayOff = Math.round((cur.getTime() - startMs) / 86400000);
          if (dayOff >= totalDays) break;
          const q = Math.floor(cur.getMonth() / 3) + 1;
          ticks.push({ day: Math.max(0, dayOff), label: `Q${q}/${cur.getFullYear().toString().slice(2)}` });
          cur.setMonth(cur.getMonth() + 3);
          if (ticks.length > 16) break;
        }
      } else {
        for (let d = 0; d < totalDays; d += 90)
          ticks.push({ day: d, label: `Q${Math.floor(d/90)+1}` });
      }
    }
    return ticks;
  }, [zoom, totalDays, startMs]);

  // ── Row reorder (drag handle) ─────────────────────────────────────────────
  const onRowPointerDown = (e: React.PointerEvent, idx: number) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragMode('row');
    setDraggingRow(idx);
  };
  const onRowPointerEnter = (_e: React.PointerEvent, idx: number) => {
    if (dragMode === 'row') setDragOverRow(idx);
  };
  const commitRowDrop = () => {
    if (dragMode === 'row' && draggingRow !== null && dragOverRow !== null && draggingRow !== dragOverRow) {
      const next = [...items];
      const [moved] = next.splice(draggingRow, 1);
      next.splice(dragOverRow, 0, moved);
      setItems(next);
      onReorder(next);
    }
    setDragMode(null); setDraggingRow(null); setDragOverRow(null);
  };

  // ── Bar drag — dời start ──────────────────────────────────────────────────
  const onBarPointerDown = (e: React.PointerEvent, taskId: number) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const task = items.find(t => t.id === taskId)!;
    barDragRef.current = { taskId, mode: 'bar', startX: e.clientX, origStart: task.start, origDur: task.dur };
    setDragMode('bar');
  };

  // ── Resize handle — kéo cuối bar để thay đổi duration ────────────────────
  const onResizePointerDown = (e: React.PointerEvent, taskId: number) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const task = items.find(t => t.id === taskId)!;
    barDragRef.current = { taskId, mode: 'resize', startX: e.clientX, origStart: task.start, origDur: task.dur };
    setDragMode('resize');
  };

  const onTimelinePointerMove = (e: React.PointerEvent) => {
    if (!barDragRef.current || !timelineRef.current) return;
    const { taskId, mode, startX, origStart, origDur } = barDragRef.current;
    const rect     = timelineRef.current.getBoundingClientRect();
    const pxPerDay = rect.width / totalDays;
    const deltaDays = Math.round((e.clientX - startX) / pxPerDay);
    setItems(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      if (mode === 'bar') {
        const newStart = Math.max(0, Math.min(origStart + deltaDays, totalDays - t.dur));
        return { ...t, start: newStart };
      } else {
        const newDur = Math.max(1, Math.min(origDur + deltaDays, totalDays - t.start));
        return { ...t, dur: newDur };
      }
    }));
  };

  const onTimelinePointerUp = () => {
    if (barDragRef.current) {
      const updated = items.find(t => t.id === barDragRef.current!.taskId);
      if (updated) onUpdateTask?.(updated);
    }
    barDragRef.current = null;
    setDragMode(null);
  };

  // ── Inline % edit ─────────────────────────────────────────────────────────
  const handleDoneChange = (taskId: number, val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    setItems(prev => prev.map(t => t.id === taskId ? { ...t, done: clamped } : t));
    const updated = items.find(t => t.id === taskId);
    if (updated) onUpdateTask?.({ ...updated, done: clamped });
    setEditingDone(null);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
         onPointerUp={commitRowDrop}>
      <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <FileSpreadsheet size={16} className="text-blue-600"/>
          Sơ đồ Gantt — {items.length} hạng mục
          <span className="text-[10px] font-normal text-slate-400 ml-1">
            ☰ reorder · kéo bar để dời · kéo cạnh để resize · click % để sửa
          </span>
        </h3>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Zoom toggle */}
          <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg">
            {(['week','month','quarter'] as GanttZoom[]).map(z => (
              <button key={z} onClick={() => setZoom(z)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${zoom===z?'bg-white shadow text-blue-700':'text-slate-500 hover:text-slate-700'}`}>
                {z==='week'?'Tuần':z==='month'?'Tháng':'Quý'}
              </button>
            ))}
          </div>

          {/* Baseline button */}
          {!hasBaseline ? (
            <button onClick={() => setShowConfirmBaseline(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 transition-all">
              <Camera size={11}/>Chụp baseline
            </button>
          ) : (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border border-slate-200 bg-slate-50 text-slate-500">
              <GitBranch size={11}/>Baseline đã chụp
            </span>
          )}

          <div className="flex gap-3 text-[10px] font-semibold text-slate-500">
            {[['bg-emerald-400','Hoàn thành'],['bg-amber-400','Đang thi công'],['bg-slate-300','Chưa bắt đầu'],['bg-violet-300/60','Baseline']].map(([cls,lbl])=>(
              <span key={lbl} className="flex items-center gap-1">
                <span className={`w-3 h-2.5 rounded ${cls} inline-block`}/>{lbl}
              </span>
            ))}
          </div>
          {canViewFinance && (
            <button onClick={()=>setShowFinance(v=>!v)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${showFinance?'bg-indigo-50 border-indigo-200 text-indigo-700':'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'}`}>
              <DollarSign size={11}/>{showFinance?'Ẩn tài chính':'💰 Tài chính'}
            </button>
          )}
        </div>
      </div>

      {/* Confirm baseline dialog */}
      {showConfirmBaseline && (
        <div className="mx-4 mt-3 mb-1 p-3.5 bg-violet-50 border border-violet-200 rounded-xl flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <Camera size={15} className="text-violet-600 mt-0.5 shrink-0"/>
            <div>
              <p className="text-xs font-bold text-violet-800">Xác nhận chụp baseline?</p>
              <p className="text-[11px] text-violet-600 mt-0.5">
                Lưu ngày bắt đầu/kết thúc hiện tại làm mốc so sánh. <strong>Chỉ thực hiện được 1 lần.</strong>
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setShowConfirmBaseline(false)}
              className="px-3 py-1.5 text-[11px] font-bold bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">
              Huỷ
            </button>
            <button onClick={freezeBaseline}
              className="px-3 py-1.5 text-[11px] font-bold bg-violet-600 text-white rounded-lg hover:bg-violet-700">
              Xác nhận
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <div style={{ minWidth: 640 }}>
          {/* Header */}
          <div className="flex bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
            <div className="w-6 shrink-0"/>
            <div className="w-52 shrink-0 px-4 py-2.5">Hạng mục</div>
            <div className="flex-1 px-3 py-2.5 relative" style={{minWidth:0}}>
              <div className="relative w-full h-4">
                {headerTicks.map((tick, i) => (
                  <span key={i} className="absolute text-[9px] font-semibold text-slate-400 whitespace-nowrap"
                    style={{ left: `${(tick.day / totalDays) * 100}%`, transform: 'translateX(-50%)' }}>
                    {tick.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="w-16 shrink-0 px-2 py-2.5 text-center">EV%</div>
            {showFinance && canViewFinance && (
              <>
                {canViewFinanceNumbers && <div className="w-20 shrink-0 px-2 py-2.5 text-center text-indigo-500">Budget</div>}
                {canViewFinanceNumbers && <div className="w-20 shrink-0 px-2 py-2.5 text-center text-amber-500">AC</div>}
                <div className="w-24 shrink-0 px-2 py-2.5 text-center text-emerald-500">CPI</div>
              </>
            )}
          </div>

          {/* Rows */}
          {items.map((task, idx) => {
            const isDraggingRow = draggingRow === idx && dragMode === 'row';
            const isTargetRow   = dragOverRow === idx && dragMode === 'row' && draggingRow !== idx;
            return (
              <div key={task.id}
                className={[
                  'flex border-b border-slate-100 transition-colors select-none',
                  isDraggingRow ? 'opacity-40 bg-blue-50' : 'hover:bg-slate-50/50',
                  isTargetRow   ? 'border-t-2 border-t-blue-400' : '',
                ].join(' ')}
                onPointerEnter={e => onRowPointerEnter(e, idx)}>

                {/* Row drag handle */}
                <div className="w-6 shrink-0 flex items-center justify-center cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500"
                     onPointerDown={e => onRowPointerDown(e, idx)}>
                  <GripVertical size={13}/>
                </div>

                {/* Name */}
                <div className="w-52 shrink-0 px-4 py-3">
                  <p className="text-xs font-semibold text-slate-700 truncate">{task.name}</p>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${CAT_CLS[task.cat]||'bg-slate-100 text-slate-500'}`}>{task.cat}</span>
                </div>

                {/* Timeline */}
                <div ref={idx === 0 ? timelineRef : undefined}
                     className="flex-1 px-3 py-3 relative flex items-center"
                     onPointerMove={onTimelinePointerMove}
                     onPointerUp={onTimelinePointerUp}>
                  {/* Grid lines — theo tick marks */}
                  {headerTicks.map((tick, gi) => (
                    <div key={gi} className="absolute top-0 bottom-0 border-l border-slate-100"
                         style={{left:`${(tick.day/totalDays)*100}%`}}/>
                  ))}
                  {/* Today line */}
                  <div className="absolute top-0 bottom-0 border-l-2 border-rose-400 border-dashed z-10"
                       style={{left:`${(today/totalDays)*100}%`}}/>

                  <div className="relative w-full h-6">
                    {/* Background track */}
                    <div className="absolute h-full rounded-md bg-slate-100"
                         style={{left:`${(task.start/totalDays)*100}%`, width:`${(task.dur/totalDays)*100}%`}}/>
                    {/* Progress fill */}
                    <div className={`absolute h-full rounded-md transition-all ${
                           task.done===100 ? 'bg-emerald-400' : task.done>0 ? 'bg-amber-400' : 'bg-transparent'
                         }`}
                         style={{
                           left:`${(task.start/totalDays)*100}%`,
                           width:`${(task.dur/totalDays)*(task.done/100)*100}%`,
                         }}/>
                    {/* Draggable bar overlay */}
                    <div className={`absolute h-full rounded-md cursor-move z-20 ${
                           dragMode === 'bar' ? 'opacity-0' : 'opacity-0 hover:opacity-20 hover:bg-blue-400'
                         }`}
                         style={{left:`${(task.start/totalDays)*100}%`, width:`${(task.dur/totalDays)*100}%`}}
                         onPointerDown={e => onBarPointerDown(e, task.id)}/>
                    {/* Resize handle — right edge */}
                    <div className="absolute top-0.5 bottom-0.5 w-2 rounded-r-md cursor-ew-resize z-30
                                    bg-slate-400/0 hover:bg-blue-500/40 transition-colors"
                         style={{left:`calc(${((task.start+task.dur)/totalDays)*100}% - 4px)`}}
                         onPointerDown={e => onResizePointerDown(e, task.id)}/>
                    {/* Baseline bar — hiện nếu đã freeze */}
                    {task.gantt_baseline_start && task.gantt_baseline_end && startMs > 0 && (() => {
                      const bs = new Date(task.gantt_baseline_start).getTime();
                      const be = new Date(task.gantt_baseline_end).getTime();
                      const bStart = Math.max(0, Math.round((bs - startMs) / 86400000));
                      const bDur   = Math.max(1, Math.round((be - bs) / 86400000));
                      const deltaEnd = (task.start + task.dur) - (bStart + bDur);
                      return (
                        <>
                          {/* Baseline track — xám mờ bên dưới */}
                          <div className="absolute h-1.5 rounded-sm bg-violet-300/50 bottom-0.5 z-5 pointer-events-none"
                               style={{ left:`${(bStart/totalDays)*100}%`, width:`${(bDur/totalDays)*100}%` }}/>
                          {/* Delta badge */}
                          {deltaEnd !== 0 && (
                            <div className={`absolute text-[8px] font-black px-1 py-0.5 rounded z-20 pointer-events-none whitespace-nowrap
                              ${deltaEnd > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}
                                 style={{ left:`calc(${((task.start+task.dur)/totalDays)*100}% + 4px)`, top: '2px' }}>
                              {deltaEnd > 0 ? `+${deltaEnd}d` : `${deltaEnd}d`}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* % done — click to edit */}
                <div className="w-16 shrink-0 flex items-center justify-center">
                  {editingDone === task.id ? (
                    <input
                      type="number" min={0} max={100} defaultValue={task.done}
                      className="w-12 text-xs text-center border border-slate-300 rounded-lg px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      autoFocus
                      onBlur={e => handleDoneChange(task.id, parseInt(e.target.value) || 0)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleDoneChange(task.id, parseInt((e.target as HTMLInputElement).value) || 0);
                        if (e.key === 'Escape') setEditingDone(null);
                      }}
                    />
                  ) : (
                    <span
                      className={`text-xs font-bold cursor-pointer hover:underline ${
                        task.done===100?'text-emerald-600':task.done>0?'text-amber-600':'text-slate-400'
                      }`}
                      onClick={() => setEditingDone(task.id)}
                      title="Click để sửa"
                    >
                      {task.done}%
                    </span>
                  )}
                </div>

                {/* ── PA3 Financial Panel (right side) ───────────────────── */}
                {showFinance && canViewFinance && (() => {
                  const wCPI = (task.budget && task.ac && task.ac > 0)
                    ? +((task.budget * (task.done/100)) / task.ac).toFixed(2)
                    : null;
                  const cpiColor = wCPI === null ? 'text-slate-400'
                    : wCPI >= 0.95 ? 'text-emerald-600'
                    : wCPI >= 0.85 ? 'text-amber-600'
                    : 'text-rose-600';
                  const cpiBg = wCPI === null ? ''
                    : wCPI >= 0.95 ? 'bg-emerald-50'
                    : wCPI >= 0.85 ? 'bg-amber-50'
                    : 'bg-rose-50';
                  const pvGap = task.pv_pct !== undefined ? task.done - task.pv_pct : null;
                  return (
                    <>
                      {/* Budget — chỉ L4+ */}
                      {canViewFinanceNumbers && (
                        <div className="w-20 shrink-0 flex flex-col items-center justify-center px-1 border-l border-slate-100">
                          <span className="text-xs font-bold text-indigo-700">
                            {task.budget != null ? `${task.budget}t` : '—'}
                          </span>
                          {pvGap !== null && (
                            <span className={`text-[9px] font-semibold mt-0.5 ${pvGap >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                              PV:{task.pv_pct}%{pvGap >= 0 ? '✓' : '↓'}
                            </span>
                          )}
                        </div>
                      )}
                      {/* AC — chỉ L4+ */}
                      {canViewFinanceNumbers && (
                        <div className="w-20 shrink-0 flex flex-col items-center justify-center px-1 border-l border-slate-100">
                          <span className="text-xs font-bold text-amber-700">
                            {task.ac != null ? `${task.ac}t` : '—'}
                          </span>
                          {task.budget != null && task.ac != null && (
                            <span className={`text-[9px] font-semibold mt-0.5 ${task.ac <= task.budget ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {task.ac <= task.budget ? 'Trong NS' : 'Vượt NS'}
                            </span>
                          )}
                        </div>
                      )}
                      {/* CPI — L3 thấy indicator, L4 thấy số */}
                      <div className={`w-24 shrink-0 flex flex-col items-center justify-center px-2 border-l border-slate-100 ${cpiBg}`}>
                        {wCPI !== null ? (
                          <>
                            <span className={`text-sm font-black ${cpiColor}`}>{wCPI}</span>
                            <span className={`text-[9px] font-bold ${cpiColor}`}>
                              {wCPI >= 0.95 ? '✅ Tốt' : wCPI >= 0.85 ? '⚠️ Lưu ý' : '🔴 Vượt NS'}
                            </span>
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-300">—</span>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ProgressDashboard({ project: selectedProject, projectId: projectIdProp }: Props) {
  const pid = projectIdProp ?? selectedProject?.id ?? 'default';
  const { user } = useAuth();
  const { notify } = useNotification();
  // L4+ (admin/manager-finance) thấy số tiền thật, L3 chỉ thấy CPI indicator
  const canViewFinance        = ['admin','manager'].includes(user?.tier ?? '') || (user?.tier === 'manager');
  const canViewFinanceNumbers = user?.tier === 'admin';
  const [tab, setTab] = useState<'scurve'|'evm'|'wbs'|'milestones'>('scurve');
  const { printComponent, printProgressReport } = usePrint();
  const dbLoaded = useRef(false);
  const [wbs, setWbs] = useState(WBS_INIT);

  // Milestones: ưu tiên từ template nếu project có chọn template
  const [milestones, setMilestones] = useState(() => {
    const tplId = getProjectTemplate(pid);
    if (!tplId) return MILESTONES_INIT;
    const startDate = selectedProject?.startDate && selectedProject.startDate !== '-'
      ? new Date(selectedProject.startDate.split('/').reverse().join('-'))
      : new Date();
    const applied = applyTemplate(tplId, startDate);
    if (!applied.milestones.length) return MILESTONES_INIT;
    return applied.milestones.map((m, i) => ({
      id:       `ms_tpl_${i+1}`,
      name:     m.name,
      plan:     (m as any).date || '-',
      actual:   m.type === 'start' ? (m as any).date || '' : '',
      status:   m.type === 'start' ? 'done' : i === 1 ? 'on_track' : 'on_track',
      delta:    0,
      critical: m.type === 'finish' || (i < 3),
    }));
  });

  // ── Load from db on mount ──────────────────────────────────────────────────
  React.useEffect(() => {
    dbLoaded.current = false;
    (async () => {
      try {
        const [savedWbs, savedMs] = await Promise.all([
          db.get<typeof WBS_INIT>('progress_wbs', pid, WBS_INIT),
          db.get<typeof MILESTONES_INIT>('progress_milestones', pid, []),
        ]);
        setWbs(savedWbs);
        if (savedMs.length) setMilestones(savedMs as any);
      } catch (e) {
        console.warn('[ProgressDashboard] load error, dùng seed data:', e);
      } finally {
        dbLoaded.current = true;
      }
    })();
  }, [pid]);

  // ── Realtime sync ──────────────────────────────────────────────────────────
  useRealtimeSync(pid, ['progress_wbs', 'progress_milestones'], async () => {
    const [savedWbs, savedMs] = await Promise.all([
      db.get<typeof WBS_INIT>('progress_wbs', pid, WBS_INIT),
      db.get<typeof MILESTONES_INIT>('progress_milestones', pid, []),
    ]);
    setWbs(savedWbs);
    if (savedMs.length) setMilestones(savedMs as any);
  });
  const [editingWbs, setEditingWbs] = useState<string|null>(null);
  const [editEv, setEditEv] = useState('');
  const [gemLoading, setGemLoading] = useState(false);
  const [gemText, setGemText] = useState('');
  const [showGem, setShowGem] = useState(false);
  const [expandedWbs, setExpandedWbs] = useState<string|null>(null);

  // ── Gantt range từ project dates (dynamic) ─────────────────────────────────
  const { totalDays, todayIndex: today, startMs } = React.useMemo(
    () => calcGanttRange(selectedProject as any),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedProject?.startDate, selectedProject?.endDate]
  );

  // ── EVM tính từ WBS data thật ───────────────────────────────────────────────
  const evm = React.useMemo(() => calcEVM(wbs as WBSItem[]), [wbs]);
  const { BAC, EV: EV_NOW, PV: PV_NOW, AC: AC_NOW, SPI, CPI, SV, CV, EAC, ETC, VAC, TCPI } = evm;

  // ── S-Curve data từ WBS thật ────────────────────────────────────────────────
  const EVM_DATA = React.useMemo(
    () => buildSCurveData(wbs as WBSItem[], totalDays, today, BAC),
    [wbs, totalDays, today, BAC]
  );

  // ── Gantt tasks — ưu tiên gantt_start_date/end_date nếu có ─────────────────
  const ganttTasks = React.useMemo(() => {
    const fallbackOffsets = [0, 5, 22, 30, 42, 48, 55, 50, 62, 85];
    const fallbackDurs    = [10, 20, 15, 18, 20, 14, 12, 30, 25, 10];
    return (wbs as WBSItem[]).map((w, i) => {
      let start = w.gantt_start ?? fallbackOffsets[i] ?? i * 8;
      let dur   = w.gantt_dur   ?? fallbackDurs[i]   ?? 10;
      if (w.gantt_start_date && startMs > 0) {
        const s = new Date(w.gantt_start_date).getTime();
        start = Math.max(0, Math.round((s - startMs) / 86400000));
      }
      if (w.gantt_start_date && w.gantt_end_date) {
        const s = new Date(w.gantt_start_date).getTime();
        const e = new Date(w.gantt_end_date).getTime();
        dur = Math.max(1, Math.round((e - s) / 86400000));
      }
      return {
        id: i + 1, name: w.name, start, dur,
        done: w.ev_pct, cat: w.category, wbsId: w.id,
        budget: w.budget, ac: w.ac, pv_pct: w.pv_pct, ev_pct: w.ev_pct,
        gantt_start_date: w.gantt_start_date, gantt_end_date: w.gantt_end_date,
        gantt_baseline_start: w.gantt_baseline_start, gantt_baseline_end: w.gantt_baseline_end,
      };
    });
  }, [wbs, startMs]);

  const callGEM = useCallback(async () => {
    setGemLoading(true); setGemText(''); setShowGem(true);
    try {
      const model = genAI.getGenerativeModel({ model: GEM_MODEL_QUALITY, systemInstruction: GEM_SYS });
      const critical = (wbs as WBSItem[]).filter(w=>w.critical && w.ev_pct < w.pv_pct);
      const projectName = selectedProject?.name || 'Dự án';
      const r = await model.generateContent(
        `Phân tích EVM dự án xây dựng ${projectName}:\n` +
        `BAC=${BAC}tỷ | EV=${EV_NOW}tỷ | PV=${PV_NOW}tỷ | AC=${AC_NOW}tỷ\n` +
        `SPI=${SPI} | CPI=${CPI} | SV=${SV}tỷ | CV=${CV}tỷ\n` +
        `EAC=${EAC}tỷ | ETC=${ETC}tỷ | VAC=${VAC}tỷ | TCPI=${TCPI}\n` +
        `Critical packages chậm: ${critical.map(c=>`${c.name}(PV=${c.pv_pct}%,EV=${c.ev_pct}%)`).join(', ')}\n\n` +
        `Hãy phân tích: (1) Đánh giá sức khỏe dự án hiện tại, (2) Dự báo kết quả cuối nếu giữ hiệu suất này, (3) Top 3 khuyến nghị ưu tiên cao nhất, (4) Cảnh báo rủi ro ngân sách. Trả lời súc tích, dùng gạch đầu dòng.`
      );
      setGemText(r.response.text());
    } catch { setGemText('❌ Không kết nối được GEM.'); }
    setGemLoading(false);
  }, [wbs]);

  const tabs = [
    { id:'scurve'    as const, label:'S-Curve',       icon:<TrendingUp size={14}/> },
    { id:'evm'       as const, label:'EVM Dashboard', icon:<Activity size={14}/>   },
    { id:'wbs'       as const, label:'WBS / Tiến độ', icon:<FileSpreadsheet size={14}/> },
    { id:'milestones'as const, label:'Cột mốc',       icon:<Flag size={14}/>       },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp size={20} className="text-emerald-600"/>
            Tiến độ & EVM — {selectedProject?.name||'Dự án'}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">S-Curve · Earned Value Management · WBS · Cột mốc</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => printProgressReport({
            projectName: selectedProject?.name || 'Dự án',
            spi: SPI, cpi: CPI, eac: EAC, bac: BAC,
            ev: EV_NOW, pv: PV_NOW, ac: AC_NOW, sv: SV, cv: CV, tcpi: TCPI,
            overallPct: Math.round(EV_NOW / BAC * 100),
            reportDate: new Date().toLocaleDateString('vi-VN'),
            milestones: milestones.map(m => ({
              name: m.name,
              planned: m.plan,
              actual: m.actual || undefined,
              status: m.status === 'done' ? 'done' : m.status === 'on_track' ? 'ontrack' : m.status === 'delayed' ? 'delayed' : 'critical'
            })),
          })}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-white border border-slate-200 hover:border-emerald-300 text-slate-600 rounded-xl text-sm font-semibold shadow-sm transition-all">
            <Printer size={14}/> Xuất PDF
          </button>
          <button onClick={callGEM} disabled={gemLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-60 shadow-sm">
            {gemLoading ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>}
            GEM phân tích EVM
          </button>
        </div>
      </div>

      {/* GEM panel */}
      {showGem && (
        <div className="bg-gradient-to-br from-emerald-900 to-teal-900 rounded-2xl p-5 text-white shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-emerald-100 flex items-center gap-2"><Sparkles size={15} className="text-emerald-300"/>Nàng GEM — Phân tích EVM</span>
            <button onClick={()=>setShowGem(false)} className="p-1 hover:bg-white/10 rounded-lg"><X size={14}/></button>
          </div>
          {gemLoading ? (
            <div className="flex items-center gap-3 text-emerald-200"><Loader2 size={16} className="animate-spin"/>Đang phân tích dữ liệu EVM...</div>
          ) : (
            <pre className="text-sm text-emerald-100 whitespace-pre-wrap leading-relaxed font-sans">{gemText}</pre>
          )}
        </div>
      )}

      {/* Top KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label:'Tiến độ thực tế (EV)', val:`${((EV_NOW/BAC)*100).toFixed(1)}%`, sub:`${EV_NOW} / ${BAC} tỷ`, cls:'bg-emerald-50 border-emerald-200 text-emerald-700', icon:<Target size={16}/> },
          { label:'Kế hoạch (PV)',        val:`${((PV_NOW/BAC)*100).toFixed(1)}%`, sub:`${PV_NOW} / ${BAC} tỷ`, cls:'bg-blue-50 border-blue-200 text-blue-700',         icon:<TrendingUp size={16}/> },
          { label:'Lệch tiến độ (SV)',    val:`${SV} tỷ`,  sub:`SPI = ${SPI}`, cls:SV<0?'bg-rose-50 border-rose-200 text-rose-700':'bg-emerald-50 border-emerald-200 text-emerald-700', icon:<Clock size={16}/> },
          { label:'Lệch chi phí (CV)',    val:`${CV} tỷ`,  sub:`CPI = ${CPI}`, cls:CV<0?'bg-rose-50 border-rose-200 text-rose-700':'bg-emerald-50 border-emerald-200 text-emerald-700', icon:<Zap size={16}/> },
        ].map((k,i)=>(
          <div key={i} className={`bg-white p-4 rounded-2xl border-2 shadow-sm ${k.cls.split(' ').map(c=>c.startsWith('border')?c:'').join(' ')} border`}>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center mb-3 ${k.cls}`}>{k.icon}</div>
            <div className="text-xl font-black text-slate-800">{k.val}</div>
            <div className="text-[11px] font-bold text-slate-400 mt-0.5">{k.label}</div>
            <div className="text-[11px] text-slate-500 mt-1">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit overflow-x-auto">
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${tab===t.id?'bg-white shadow-sm text-emerald-700':'text-slate-500 hover:text-slate-700'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── S-Curve ──────────────────────────────────────────────────────────── */}
      {tab==='scurve' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2"><TrendingUp size={16} className="text-emerald-600"/>Đường cong S — PV / EV / AC</h3>
              <div className="flex gap-4 text-[11px] font-semibold flex-wrap">
                {[['#3b82f6','PV (Kế hoạch)'],['#10b981','EV (Giá trị thực)'],['#f59e0b','AC (Chi phí thực)'],['#94a3b8','Dự báo']].map(([c,l])=>(
                  <span key={l} className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm inline-block" style={{background:c}}/>{l}</span>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={320} minWidth={0}>
              <AreaChart data={EVM_DATA} margin={{top:10,right:10,left:0,bottom:0}}>
                <defs>
                  <linearGradient id="gradPV" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gradEV" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="week" tick={{fontSize:11}} tickLine={false} axisLine={false}/>
                <YAxis tick={{fontSize:11}} tickLine={false} axisLine={false} tickFormatter={v=>`${v}tỷ`} width={48}/>
                <Tooltip content={<EVMTooltip/>}/>
                <ReferenceLine x="T8" stroke="#ef4444" strokeDasharray="4 3" strokeWidth={1.5} label={{value:'Hôm nay',position:'top',fontSize:10,fill:'#ef4444'}}/>
                <Area type="monotone" dataKey="pv" stroke="#3b82f6" strokeWidth={2} fill="url(#gradPV)" name="PV (Kế hoạch)" connectNulls/>
                <Area type="monotone" dataKey="ev" stroke="#10b981" strokeWidth={2.5} fill="url(#gradEV)" name="EV (Giá trị thực)" dot={{r:3,fill:'#10b981'}} connectNulls/>
                <Line type="monotone" dataKey="ac" stroke="#f59e0b" strokeWidth={2} dot={{r:3,fill:'#f59e0b'}} name="AC (Chi phí thực)" connectNulls/>
                <Line type="monotone" dataKey="forecast_ev" stroke="#10b981" strokeWidth={1.5} strokeDasharray="5 3" dot={false} name="EV dự báo" connectNulls/>
                <Line type="monotone" dataKey="forecast_ac" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 3" dot={false} name="AC dự báo" connectNulls/>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Gantt — drag-drop bằng pointer events */}
          <GanttChart
            tasks={ganttTasks}
            totalDays={totalDays}
            today={today}
            startMs={startMs}
            canViewFinance={canViewFinance}
            canViewFinanceNumbers={canViewFinanceNumbers}
            onReorder={(reordered) => {
              const wbsById = Object.fromEntries(wbs.map(w => [w.id, w]));
              const nextWbs = reordered
                .map(t => wbsById[(t as any).wbsId])
                .filter(Boolean);
              if (nextWbs.length === wbs.length) {
                setWbs(() => {
                  if (dbLoaded.current) db.set('progress_wbs', pid, nextWbs);
                  return nextWbs;
                });
              }
            }}
            onUpdateTask={(updated) => {
              // Sync start/dur/done về WBS + tính gantt_start_date/end_date ISO
              setWbs(prev => {
                const next = (prev as WBSItem[]).map(w => {
                  if (w.id !== updated.wbsId) return w;
                  const patch: Partial<WBSItem> = {
                    ev_pct: updated.done,
                    gantt_start: updated.start,
                    gantt_dur: updated.dur,
                  };
                  // Nếu có project start date → tính ISO date
                  if (startMs > 0) {
                    const s = new Date(startMs + updated.start * 86400000);
                    const e = new Date(startMs + (updated.start + updated.dur) * 86400000);
                    patch.gantt_start_date = s.toISOString().slice(0, 10);
                    patch.gantt_end_date   = e.toISOString().slice(0, 10);
                  }
                  return { ...w, ...patch };
                });
                if (dbLoaded.current) db.set('progress_wbs', pid, next);
                return next;
              });
            }}
            onFreezeBaseline={(frozenTasks) => {
              setWbs(prev => {
                const next = (prev as WBSItem[]).map(w => {
                  const ft = frozenTasks.find(t => t.wbsId === w.id);
                  if (!ft) return w;
                  return {
                    ...w,
                    gantt_baseline_start: ft.gantt_baseline_start,
                    gantt_baseline_end:   ft.gantt_baseline_end,
                  };
                });
                if (dbLoaded.current) db.set('progress_wbs', pid, next);
                return next;
              });
              notify('success', '📸 Baseline đã được chụp', 'Mọi thay đổi tiến độ sẽ so sánh với mốc này');
            }}
          />
        </div>
      )}

      {/* ── EVM Dashboard ────────────────────────────────────────────────────── */}
      {tab==='evm' && (
        <div className="space-y-5">
          {/* Index badges */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2"><Activity size={16} className="text-blue-600"/>Chỉ số EVM hiện tại</h3>
            <div className="flex gap-4 flex-wrap justify-start">
              <IndexBadge label="SPI" value={SPI} threshold1={0.85} threshold2={0.95}/>
              <IndexBadge label="CPI" value={CPI} threshold1={0.85} threshold2={0.95}/>
              <IndexBadge label="TCPI" value={TCPI} threshold1={1.1} threshold2={1.05}/>
            </div>
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
              <strong>⚠ Diễn giải:</strong> SPI={SPI} → Dự án hoàn thành được {(SPI*100).toFixed(0)}% giá trị so với kế hoạch.
              CPI={CPI} → Mỗi 1 tỷ chi phí chỉ tạo ra {CPI.toFixed(2)} tỷ giá trị.
              TCPI={TCPI} → Cần đạt hiệu suất {TCPI.toFixed(2)} trong phần còn lại để hoàn thành trong ngân sách — <strong>rất thách thức</strong>.
            </div>
          </div>

          {/* Forecast table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2"><BarChart2 size={16} className="text-indigo-600"/>Dự báo hoàn thành (EAC / ETC / VAC)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label:'BAC (Ngân sách gốc)', val:`${BAC} tỷ`, sub:'Budget at Completion', cls:'bg-blue-50 border-blue-200 text-blue-800' },
                { label:'EAC (Dự báo cuối)',   val:`${EAC} tỷ`, sub:'Estimate at Completion', cls:'bg-rose-50 border-rose-200 text-rose-800' },
                { label:'ETC (Chi phí còn lại)',val:`${ETC} tỷ`, sub:'Estimate to Complete',   cls:'bg-amber-50 border-amber-200 text-amber-800' },
                { label:'VAC (Lệch ngân sách)', val:`${VAC} tỷ`, sub:'Variance at Completion',cls:'bg-rose-50 border-rose-200 text-rose-700 font-black' },
              ].map((k,i)=>(
                <div key={i} className={`p-4 rounded-2xl border-2 ${k.cls}`}>
                  <div className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">{k.label}</div>
                  <div className="text-2xl font-black">{k.val}</div>
                  <div className="text-[10px] opacity-60 mt-1">{k.sub}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
              <strong>🚨 Cảnh báo:</strong> Nếu duy trì CPI hiện tại ({CPI}), dự án sẽ vượt ngân sách <strong>{Math.abs(VAC).toFixed(1)} tỷ VNĐ ({((Math.abs(VAC)/BAC)*100).toFixed(0)}%)</strong> so với hợp đồng.
            </div>
          </div>

          {/* SPI/CPI trend bar chart */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-emerald-600"/>Xu hướng SV & CV theo tuần (tỷ VNĐ)</h3>
            <ResponsiveContainer width="100%" height={240} minWidth={0}>
              <BarChart data={EVM_DATA.filter(d=>d.ev!=null)} margin={{top:5,right:10,left:0,bottom:0}} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                <XAxis dataKey="week" tick={{fontSize:11}} tickLine={false} axisLine={false}/>
                <YAxis tick={{fontSize:11}} tickLine={false} axisLine={false} tickFormatter={v=>`${v}tỷ`} width={48}/>
                <Tooltip content={<EVMTooltip/>}/>
                <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1.5}/>
                <Bar dataKey="ev" name="EV (Giá trị)" fill="#10b981" radius={[4,4,0,0]}/>
                <Bar dataKey="ac" name="AC (Chi phí)" fill="#f59e0b" radius={[4,4,0,0]}/>
                <Bar dataKey="pv" name="PV (Kế hoạch)" fill="#3b82f6" radius={[4,4,0,0]} opacity={0.6}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── WBS ──────────────────────────────────────────────────────────────── */}
      {tab==='wbs' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Click vào hạng mục để cập nhật % EV thực tế</p>
            <div className="flex gap-2 text-[10px] font-bold">
              {[['bg-emerald-200','OK'],['bg-amber-200','Rủi ro'],['bg-rose-200','Critical']].map(([c,l])=>(
                <span key={l} className="flex items-center gap-1"><span className={`w-2.5 h-2.5 rounded ${c}`}/>{l}</span>
              ))}
            </div>
          </div>
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-100 rounded-xl text-[10px] font-bold text-slate-500 uppercase tracking-wide">
            <div className="col-span-4">Hạng mục</div>
            <div className="col-span-1 text-right">Ngân sách</div>
            <div className="col-span-2 text-center">PV%</div>
            <div className="col-span-2 text-center">EV% (thực)</div>
            <div className="col-span-1 text-right">AC</div>
            <div className="col-span-2 text-center">CPI hạng mục</div>
          </div>
          {wbs.map(w=>{
            const gap = w.ev_pct - w.pv_pct;
            const wCPI = w.ac > 0 ? +((w.budget * w.ev_pct/100) / w.ac).toFixed(2) : null;
            const rowCls = w.critical && gap < -10 ? 'bg-rose-50 border-rose-200' : gap < -5 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200';
            const isEditing = editingWbs === w.id;
            return (
              <div key={w.id} className={`border rounded-2xl shadow-sm overflow-hidden ${rowCls}`}>
                <div className="grid grid-cols-12 gap-2 px-3 py-3 items-center cursor-pointer hover:bg-black/[0.02]"
                  onClick={()=>setExpandedWbs(expandedWbs===w.id?null:w.id)}>
                  <div className="col-span-4 flex items-center gap-2 min-w-0">
                    {w.critical && <Flag size={11} className="text-rose-500 shrink-0"/>}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{w.code} {w.name}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${CAT_CLS[w.category]||''}`}>{w.category}</span>
                    </div>
                  </div>
                  <div className="col-span-1 text-right text-xs font-bold text-slate-700">{w.budget}tỷ</div>
                  <div className="col-span-2 text-center">
                    <div className="text-xs font-bold text-blue-600">{w.pv_pct}%</div>
                    <div className="h-1.5 bg-blue-100 rounded-full mt-1 overflow-hidden"><div className="h-full bg-blue-400 rounded-full" style={{width:`${w.pv_pct}%`}}/></div>
                  </div>
                  <div className="col-span-2 text-center">
                    {isEditing ? (
                      <div className="flex gap-1" onClick={e=>e.stopPropagation()}>
                        <input type="number" min={0} max={100} value={editEv} onChange={e=>setEditEv(e.target.value)} className="w-14 text-xs text-center border border-emerald-300 rounded-lg px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-400"/>
                        <button onClick={()=>{
                          setWbs(p => {
                            const next = p.map(x=>x.id===w.id?{...x,ev_pct:+editEv}:x);
                            if (dbLoaded.current) db.set('progress_wbs', pid, next);
                            return next;
                          });
                          setEditingWbs(null);
                        }} className="p-1 bg-emerald-500 text-white rounded"><Save size={9}/></button>
                        <button onClick={()=>setEditingWbs(null)} className="p-1 bg-slate-200 rounded"><X size={9}/></button>
                      </div>
                    ) : (
                      <button onClick={e=>{e.stopPropagation();setEditingWbs(w.id);setEditEv(String(w.ev_pct));}} className="group/ev">
                        <div className={`text-xs font-bold ${gap<-10?'text-rose-600':gap<-5?'text-amber-600':'text-emerald-600'}`}>{w.ev_pct}%</div>
                        <div className="h-1.5 bg-emerald-100 rounded-full mt-1 overflow-hidden"><div className={`h-full rounded-full ${gap<-10?'bg-rose-400':gap<-5?'bg-amber-400':'bg-emerald-400'}`} style={{width:`${w.ev_pct}%`}}/></div>
                        <div className="text-[9px] text-slate-400 group-hover/ev:text-slate-600 mt-0.5 flex items-center justify-center gap-0.5"><Edit3 size={8}/>Sửa</div>
                      </button>
                    )}
                  </div>
                  <div className="col-span-1 text-right text-xs font-bold text-amber-700">{w.ac}tỷ</div>
                  <div className="col-span-2 text-center">
                    {wCPI!=null && (
                      <span className={`text-xs font-black px-2 py-0.5 rounded-full ${wCPI>=0.95?'bg-emerald-100 text-emerald-700':wCPI>=0.85?'bg-amber-100 text-amber-700':'bg-rose-100 text-rose-700'}`}>
                        {wCPI.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
                {expandedWbs===w.id && (
                  <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/50">
                    <div className="grid grid-cols-3 gap-3 text-xs text-slate-600">
                      <div>
                        <span className="font-bold text-slate-400 uppercase text-[9px] block mb-1">Phụ trách</span>
                        <select
                          value={w.responsible}
                          onClick={e => e.stopPropagation()}
                          onChange={e => {
                            e.stopPropagation();
                            setWbs(prev => {
                              const next = prev.map(x => x.id === w.id ? {...x, responsible: e.target.value} : x);
                              if (dbLoaded.current) db.set('progress_wbs', pid, next);
                              return next;
                            });
                          }}
                          className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer"
                        >
                          {loadMembers(pid).map(m => (
                            <option key={m.userId} value={m.userName}>{m.userName}</option>
                          ))}
                          {/* Fallback nếu chưa có members */}
                          {loadMembers(pid).length === 0 && (
                            <option value={w.responsible}>{w.responsible}</option>
                          )}
                        </select>
                      </div>
                      <div><span className="font-bold text-slate-400 uppercase text-[9px] block mb-0.5">Lệch PV-EV</span><span className={gap<0?'text-rose-600 font-bold':'text-emerald-600 font-bold'}>{gap>0?'+':''}{gap}%</span></div>
                      <div><span className="font-bold text-slate-400 uppercase text-[9px] block mb-0.5">Critical path</span><span className={w.critical?'text-rose-600 font-bold':'text-slate-500'}>{w.critical?'⚠ Có':'Không'}</span></div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Milestones ───────────────────────────────────────────────────────── */}
      {tab==='milestones' && (
        <div className="space-y-4">
          {/* Template badge */}
          {(() => {
            const tplId = selectedProject?.id ? getProjectTemplate(selectedProject.id) : null;
            const tpl   = tplId ? PROJECT_TEMPLATES[tplId] : null;
            if (!tpl) return null;
            return (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs">
                <span>{tpl.icon}</span>
                <span className="font-bold text-blue-700">{tpl.name}</span>
                <span className="text-blue-500">— {milestones.length} cột mốc từ template</span>
              </div>
            );
          })()}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label:'Tổng cột mốc', val:milestones.length,                           cls:'bg-slate-100 text-slate-700' },
              { label:'Hoàn thành',   val:milestones.filter(m=>m.status==='done').length, cls:'bg-emerald-100 text-emerald-700' },
              { label:'Đang chậm',    val:milestones.filter(m=>m.status==='delayed').length, cls:'bg-rose-100 text-rose-700' },
              { label:'Có rủi ro',    val:milestones.filter(m=>m.status==='at_risk').length, cls:'bg-amber-100 text-amber-700' },
            ].map((k,i)=>(
              <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center mb-3 ${k.cls}`}><Flag size={16}/></div>
                <div className="text-2xl font-bold text-slate-800">{k.val}</div>
                <div className="text-xs text-slate-500 mt-0.5">{k.label}</div>
              </div>
            ))}
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-base font-bold text-slate-800 mb-5 flex items-center gap-2"><Award size={16} className="text-amber-500"/>Timeline cột mốc</h3>
            <div className="relative">
              <div className="absolute left-5 top-3 bottom-3 w-0.5 bg-slate-200"/>
              <div className="space-y-4">
                {milestones.map(m=>{
                  const st = MS_STATUS[m.status];
                  return (
                    <div key={m.id} className="relative flex items-start gap-4 pl-12">
                      <div className={`absolute left-2.5 w-5 h-5 rounded-full flex items-center justify-center border-2 ${
                        m.status==='done'?'bg-emerald-500 border-emerald-500':m.status==='delayed'?'bg-rose-500 border-rose-500':m.status==='at_risk'?'bg-amber-400 border-amber-400':'bg-white border-blue-400'
                      }`}>
                        {m.status==='done'&&<CheckCircle size={11} className="text-white"/>}
                        {m.status==='delayed'&&<X size={11} className="text-white"/>}
                      </div>
                      <div className={`flex-1 p-3.5 rounded-2xl border-2 ${st.cls} ${m.critical?'ring-2 ring-rose-200':''}`}>
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              {st.icon}
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                              {m.critical&&<span className="text-[9px] font-black px-1.5 py-0.5 bg-rose-600 text-white rounded-full">CRITICAL</span>}
                            </div>
                            <p className="font-bold text-sm text-slate-800">{m.name}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[10px] text-slate-400">Kế hoạch</p>
                            <p className="text-xs font-bold text-slate-700">{m.plan}</p>
                            {m.actual&&<><p className="text-[10px] text-slate-400 mt-1">Thực tế</p><p className="text-xs font-bold text-emerald-600">{m.actual}</p></>}
                            {m.delta!==0&&<p className={`text-[10px] font-bold mt-1 ${m.delta>0?'text-rose-600':'text-emerald-600'}`}>{m.delta>0?`+${m.delta} ngày chậm`:`${Math.abs(m.delta)} ngày sớm`}</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Critical path warning */}
          {milestones.some(m=>m.status==='delayed'&&m.critical) && (
            <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle size={18} className="text-rose-500 mt-0.5 shrink-0"/>
              <div>
                <p className="font-bold text-rose-800 text-sm">🚨 Cảnh báo Critical Path</p>
                {milestones.filter(m=>m.status==='delayed'&&m.critical).map(m=>(
                  <p key={m.id} className="text-xs text-rose-700 mt-1">• <strong>{m.name}</strong> — chậm {m.delta} ngày so với kế hoạch ({m.plan}). Ảnh hưởng trực tiếp đến bàn giao.</p>
                ))}
                <button onClick={callGEM} className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700">
                  <Sparkles size={11}/>GEM đề xuất phục hồi tiến độ
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {printComponent}
    </div>
  );
}
