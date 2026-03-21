// GanttChart.tsx — GEM & CLAUDE PM Pro
// GanttChart component + DelayLogPanel — tách từ ProgressDashboard để tránh file quá lớn

import React, { useRef } from 'react';
import {
  AlertTriangle, FileSpreadsheet, GripVertical, DollarSign,
  Camera, GitBranch, GitMerge, Plus, Save, X,
  CloudRain, Users, BarChart2,
} from 'lucide-react';
import { db } from './db';
import { loadMembers } from './projectMember';
import type { WBSItem } from './GanttTypes';
import { CAT_CLS, DELAY_REASONS } from './GanttTypes';

// ─── DelayLogPanel — tách ra để tránh vi phạm Rules of Hooks ────────────────
export function DelayLogPanel({ pid, wbs, dbLoaded, setWbs, notifOk }: {
  pid: string;
  wbs: WBSItem[];
  dbLoaded: React.MutableRefObject<boolean>;
  setWbs: React.Dispatch<React.SetStateAction<WBSItem[]>>;
  notifOk: (title: string, msg: string) => void;
}) {
  const [showForm, setShowForm] = React.useState(false);
  const [log, setLog] = React.useState<{id:string;date:string;reason:string;wbsId:string;days:number}[]>([]);
  const [form, setForm] = React.useState({
    date: new Date().toISOString().slice(0,10),
    reason: 'rain', wbsId: wbs[0]?.id ?? '', days: 1,
  });
  React.useEffect(() => {
    db.get<typeof log>('progress_delay_log', pid, []).then(d => { if (d.length) setLog(d); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pid]);

  const totalDelay = log.reduce((s,d) => s + d.days, 0);

  const addEntry = () => {
    const entry = { id:`dl${Date.now()}`, ...form };
    const next = [...log, entry];
    setLog(next);
    db.set('progress_delay_log', pid, next);
    setWbs(prev => {
      const updated = prev.map(w => {
        if (w.id !== entry.wbsId) return w;
        const newDur = (w.gantt_dur ?? 30) + entry.days;
        const newEnd = w.gantt_start_date
          ? new Date(new Date(w.gantt_start_date).getTime() + newDur * 86400000).toISOString().slice(0,10)
          : w.gantt_end_date;
        return { ...w, gantt_dur: newDur, gantt_end_date: newEnd, delay_days: (w.delay_days ?? 0) + entry.days };
      });
      if (dbLoaded.current) db.set('progress_wbs', pid, updated);
      return updated;
    });
    setShowForm(false);
    notifOk('📅 Đã ghi nhận ngày dừng', `+${entry.days} ngày — ${DELAY_REASONS.find(r=>r.value===entry.reason)?.label}`);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
          <CloudRain size={14} className="text-blue-500"/>Nhật ký ngày dừng thi công
          {totalDelay > 0 && <span className="text-[10px] font-black px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full">Tổng {totalDelay} ngày</span>}
        </h4>
        <button onClick={() => setShowForm(v=>!v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition-all">
          <Plus size={11}/>Ghi ngày dừng
        </button>
      </div>
      {showForm && (
        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-xl flex flex-wrap gap-3 items-end">
          <div><label className="text-[10px] font-bold text-slate-500 block mb-1">Ngày</label>
            <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white"/></div>
          <div><label className="text-[10px] font-bold text-slate-500 block mb-1">Hạng mục</label>
            <select value={form.wbsId} onChange={e=>setForm(f=>({...f,wbsId:e.target.value}))}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white max-w-[180px]">
              {wbs.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
            </select></div>
          <div><label className="text-[10px] font-bold text-slate-500 block mb-1">Lý do</label>
            <select value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white">
              {DELAY_REASONS.map(r=><option key={r.value} value={r.value}>{r.icon} {r.label}</option>)}
            </select></div>
          <div><label className="text-[10px] font-bold text-slate-500 block mb-1">Số ngày</label>
            <input type="number" min={1} max={30} value={form.days}
              onChange={e=>setForm(f=>({...f,days:Math.max(1,Number(e.target.value))}))}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white w-16"/></div>
          <button onClick={addEntry}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700">
            <Save size={11}/>Lưu</button>
          <button onClick={()=>setShowForm(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={12}/></button>
        </div>
      )}
      {log.length === 0
        ? <p className="text-xs text-slate-400 italic py-1">Chưa có ngày dừng nào được ghi nhận</p>
        : <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {log.map(d => {
              const r = DELAY_REASONS.find(r=>r.value===d.reason);
              const taskName = wbs.find(w=>w.id===d.wbsId)?.name ?? '—';
              return (
                <div key={d.id} className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-xl text-xs">
                  <span className="text-base shrink-0">{r?.icon??'📝'}</span>
                  <span className="font-semibold text-slate-700 shrink-0">{d.date}</span>
                  <span className="text-slate-500 flex-1 truncate">{taskName}</span>
                  <span className="text-slate-400 shrink-0">{r?.label}</span>
                  <span className="font-black text-rose-600 shrink-0">+{d.days}d</span>
                </div>
              );
            })}
          </div>
      }
    </div>
  );
}

// ─── GanttChart S32 ────────
type GanttTask = {
  id: number; name: string; start: number; dur: number;
  done: number; cat: string; wbsId?: string;
  gantt_start_date?: string; gantt_end_date?: string;
  gantt_baseline_start?: string; gantt_baseline_end?: string;
  // Financial fields (PA3 Split View)
  budget?: number; ac?: number; pv_pct?: number; ev_pct?: number;
  // S32.5 Dependency
  depends_on?: string[]; // list of wbsId strings
};

type GanttZoom = 'week' | 'month' | 'quarter';
type DragMode = 'row' | 'bar' | 'resize' | null;

export function GanttChart({
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
  // S32.5 Dependency arrows
  const [showDepArrows, setShowDepArrows] = React.useState(true);
  const [ctxMenu, setCtxMenu] = React.useState<{taskIdx: number; x: number; y: number} | null>(null);
  const [linkingFrom, setLinkingFrom] = React.useState<number | null>(null); // idx of source task

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

  // S32.6 — Critical Path (CPM — longest path)
  const [showCritical, setShowCritical] = React.useState(false);

  const criticalPathIds = React.useMemo<Set<string>>(() => {
    if (!showCritical) return new Set();
    // Build adjacency: predecessors → successors
    const idxByWbs: Record<string, number> = {};
    items.forEach((t, i) => { if (t.wbsId) idxByWbs[t.wbsId] = i; });
    // Early start / early finish forward pass
    const ES: number[] = new Array(items.length).fill(0);
    const EF: number[] = items.map((t, i) => t.dur || 1);
    // topological sort (simple — tasks in order, assumes partial order)
    for (let i = 0; i < items.length; i++) {
      const preds = items[i].depends_on ?? [];
      preds.forEach(predWbs => {
        const pi = idxByWbs[predWbs];
        if (pi !== undefined && EF[pi] > ES[i]) {
          ES[i] = EF[pi];
          EF[i] = ES[i] + (items[i].dur || 1);
        }
      });
    }
    const projectEnd = Math.max(...EF);
    // Late finish backward pass
    const LF: number[] = new Array(items.length).fill(projectEnd);
    const LS: number[] = items.map((_, i) => LF[i] - (items[i].dur || 1));
    for (let i = items.length - 1; i >= 0; i--) {
      const preds = items[i].depends_on ?? [];
      preds.forEach(predWbs => {
        const pi = idxByWbs[predWbs];
        if (pi !== undefined && ES[i] < LF[pi]) {
          LF[pi] = ES[i];
          LS[pi] = LF[pi] - (items[pi].dur || 1);
        }
      });
    }
    // Critical: total float = LS - ES ≈ 0
    const critical = new Set<string>();
    items.forEach((t, i) => {
      if (t.wbsId && (LS[i] - ES[i]) <= 0) critical.add(t.wbsId);
    });
    return critical;
  }, [items, showCritical]);

  // Float tooltip per task
  const floatDays = React.useMemo<Record<string, number>>(() => {
    const idxByWbs: Record<string, number> = {};
    items.forEach((t, i) => { if (t.wbsId) idxByWbs[t.wbsId] = i; });
    const ES: number[] = new Array(items.length).fill(0);
    const EF: number[] = items.map((t) => t.dur || 1);
    for (let i = 0; i < items.length; i++) {
      (items[i].depends_on ?? []).forEach(predWbs => {
        const pi = idxByWbs[predWbs];
        if (pi !== undefined && EF[pi] > ES[i]) { ES[i] = EF[pi]; EF[i] = ES[i] + (items[i].dur || 1); }
      });
    }
    const projectEnd = Math.max(...EF);
    const LF: number[] = new Array(items.length).fill(projectEnd);
    const LS: number[] = items.map((_, i) => LF[i] - (items[i].dur || 1));
    for (let i = items.length - 1; i >= 0; i--) {
      (items[i].depends_on ?? []).forEach(predWbs => {
        const pi = idxByWbs[predWbs];
        if (pi !== undefined && ES[i] < LF[pi]) { LF[pi] = ES[i]; LS[pi] = LF[pi] - (items[pi].dur || 1); }
      });
    }
    const result: Record<string, number> = {};
    items.forEach((t, i) => { if (t.wbsId) result[t.wbsId] = Math.max(0, LS[i] - ES[i]); });
    return result;
  }, [items]);

  // S32.5 — Circular dependency check (DFS)
  const hasCycle = (fromWbsId: string, toWbsId: string, allItems: GanttTask[]): boolean => {
    // BFS từ toWbsId xem có đến được fromWbsId không
    const visited = new Set<string>();
    const queue = [toWbsId];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (cur === fromWbsId) return true;
      if (visited.has(cur)) continue;
      visited.add(cur);
      const task = allItems.find(t => t.wbsId === cur);
      if (task?.depends_on) task.depends_on.forEach(d => queue.push(d));
    }
    return false;
  };

  // S32.5 — Add dependency link
  const addDependency = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const fromTask = items[fromIdx];
    const toTask   = items[toIdx];
    if (!fromTask.wbsId || !toTask.wbsId) return;
    // toTask depends_on fromTask (Finish-to-Start: toTask bắt đầu sau fromTask kết thúc)
    if (toTask.depends_on?.includes(fromTask.wbsId)) return; // đã có
    if (hasCycle(toTask.wbsId, fromTask.wbsId, items)) return; // circular
    const next = items.map((t, i) => i === toIdx
      ? { ...t, depends_on: [...(t.depends_on ?? []), fromTask.wbsId!] }
      : t
    );
    setItems(next);
    onUpdateTask?.({ ...next[toIdx] });
    onReorder(next);
  };

  // S32.5 — SVG dependency arrows overlay
  // ROW_H = 48px (py-3 top+bottom = 24px + content ~24px), NAME_W = 208+24 = 232, LEFT_PAD = 12
  const ROW_H = 48;
  const NAME_W = 232; // w-52 (208) + w-6 drag handle (24)
  const LEFT_PAD = 12; // px-3
  const depArrows = React.useMemo(() => {
    if (!showDepArrows) return [];
    const arrows: { x1: number; y1: number; x2: number; y2: number; isViolation: boolean }[] = [];
    items.forEach((task, toIdx) => {
      if (!task.depends_on?.length) return;
      task.depends_on.forEach(predWbsId => {
        const fromIdx = items.findIndex(t => t.wbsId === predWbsId);
        if (fromIdx < 0) return;
        const pred = items[fromIdx];
        // x positions are % of timeline width — we'll use relative SVG coords 0..100
        const x1 = (pred.start + pred.dur) / totalDays * 100; // end of predecessor
        const x2 = task.start / totalDays * 100;               // start of successor
        const y1 = fromIdx * ROW_H + ROW_H / 2;
        const y2 = toIdx   * ROW_H + ROW_H / 2;
        // isViolation: successor bắt đầu trước predecessor kết thúc
        const isViolation = task.start < (pred.start + pred.dur);
        arrows.push({ x1, y1, x2, y2, isViolation });
      });
    });
    return arrows;
  }, [items, showDepArrows, totalDays]);


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

  // ── Row reorder — document-level pointer tracking (fix: setPointerCapture blocks onPointerEnter) ──
  const rowsContainerRef = useRef<HTMLDivElement>(null);

  const onRowPointerDown = (e: React.PointerEvent, idx: number) => {
    e.preventDefault();
    setDragMode('row');
    setDraggingRow(idx);
    setDragOverRow(idx);
  };

  // Dummy — kept for API compat; real detection done in useEffect below
  const onRowPointerEnter = (_e: React.PointerEvent, _idx: number) => {};

  React.useEffect(() => {
    if (dragMode !== 'row' || draggingRow === null) return;

    const onMove = (e: PointerEvent) => {
      if (!rowsContainerRef.current) return;
      const container = rowsContainerRef.current;
      const rowEls = Array.from(container.querySelectorAll<HTMLElement>('[data-row-idx]'));
      let target: number | null = null;
      for (const el of rowEls) {
        const rect = el.getBoundingClientRect();
        const mid  = rect.top + rect.height / 2;
        if (e.clientY <= mid) { target = Number(el.dataset.rowIdx); break; }
      }
      if (target === null && rowEls.length) target = Number(rowEls[rowEls.length - 1].dataset.rowIdx);
      setDragOverRow(target);
    };

    const onUp = () => {
      setDragMode(prev => {
        if (prev === 'row') {
          setDraggingRow(src => {
            setDragOverRow(dst => {
              if (src !== null && dst !== null && src !== dst) {
                setItems(cur => {
                  const next = [...cur];
                  const [moved] = next.splice(src, 1);
                  const insertAt = dst > src ? dst - 1 : dst;
                  next.splice(insertAt, 0, moved);
                  onReorder(next);
                  return next;
                });
              }
              return null;
            });
            return null;
          });
        }
        return null;
      });
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup',   onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup',   onUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragMode, draggingRow]);

  const commitRowDrop = () => {}; // no-op — handled in useEffect above

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
          {/* S32.5 Dependency toggle */}
          <button onClick={() => setShowDepArrows(v => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${showDepArrows?'bg-orange-50 border-orange-200 text-orange-700':'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'}`}>
            <GitMerge size={11}/>Liên kết
          </button>
          {/* S32.6 Critical Path toggle */}
          <button onClick={() => setShowCritical(v => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${showCritical?'bg-rose-50 border-rose-200 text-rose-700':'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'}`}>
            <AlertTriangle size={11}/>Đường găng
          </button>
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
          <div ref={rowsContainerRef}>
          {items.map((task, idx) => {
            const isDraggingRow = draggingRow === idx && dragMode === 'row';
            const isTargetRow   = dragOverRow === idx && dragMode === 'row' && draggingRow !== idx;
            return (
              <div key={task.id}
                data-row-idx={idx}
                className={[
                  'flex border-b border-slate-100 transition-colors select-none',
                  isDraggingRow ? 'opacity-30 bg-blue-50 scale-[0.99]' : 'hover:bg-slate-50/50',
                  isTargetRow   ? 'border-t-2 border-t-blue-400' : '',
                  dragMode === 'row' ? 'cursor-grabbing' : '',
                ].join(' ')}
                onPointerEnter={e => onRowPointerEnter(e, idx)}>

                {/* Row drag handle */}
                <div className="w-6 shrink-0 flex items-center justify-center cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500"
                     onPointerDown={e => onRowPointerDown(e, idx)}>
                  <GripVertical size={13}/>
                </div>

                {/* Name */}
                <div className="w-52 shrink-0 px-4 py-3"
                  onContextMenu={e => { e.preventDefault(); setCtxMenu({ taskIdx: idx, x: e.clientX, y: e.clientY }); }}>
                  <p className={`text-xs truncate ${
                      linkingFrom !== null && linkingFrom !== idx ? 'text-orange-600 cursor-pointer hover:underline font-semibold'
                      : showCritical && task.wbsId && criticalPathIds.has(task.wbsId) ? 'text-rose-700 font-black'
                      : 'text-slate-700 font-semibold'}`}
                    onClick={() => { if (linkingFrom !== null && linkingFrom !== idx) { addDependency(linkingFrom, idx); setLinkingFrom(null); }}}
                    title={linkingFrom !== null ? 'Click để đặt task này phụ thuộc' : showCritical && task.wbsId && criticalPathIds.has(task.wbsId) ? `⚠ Đường găng — Float: ${floatDays[task.wbsId!] ?? 0} ngày` : 'Chuột phải → Thêm liên kết'}
                  >{showCritical && task.wbsId && criticalPathIds.has(task.wbsId) ? '⚠ ' : ''}{task.name}</p>
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
                           showCritical && task.wbsId && criticalPathIds.has(task.wbsId)
                             ? (task.done===100 ? 'bg-rose-400' : task.done>0 ? 'bg-rose-500' : 'bg-transparent')
                             : (task.done===100 ? 'bg-emerald-400' : task.done>0 ? 'bg-amber-400' : 'bg-transparent')
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
          </div>{/* end rowsContainerRef */}

          {/* S32.5 — SVG Dependency Arrows Overlay */}
          {showDepArrows && depArrows.length > 0 && (
            <div className="relative pointer-events-none" style={{ marginTop: -items.length * ROW_H }}>
              <svg
                width="100%" height={items.length * ROW_H}
                viewBox={`0 0 100 ${items.length * ROW_H}`}
                preserveAspectRatio="none"
                style={{ position: 'absolute', left: NAME_W + LEFT_PAD, top: 0, overflow: 'visible', width: `calc(100% - ${NAME_W + LEFT_PAD}px)` }}
                className="pointer-events-none"
              >
                <defs>
                  <marker id="arrowOrange" markerWidth="4" markerHeight="4" refX="3.5" refY="2" orient="auto" markerUnits="userSpaceOnUse">
                    <path d="M0,0 L0,4 L4,2 z" fill="#f97316"/>
                  </marker>
                  <marker id="arrowRed" markerWidth="4" markerHeight="4" refX="3.5" refY="2" orient="auto" markerUnits="userSpaceOnUse">
                    <path d="M0,0 L0,4 L4,2 z" fill="#ef4444"/>
                  </marker>
                </defs>
                {depArrows.map((a, i) => {
                  const color = a.isViolation ? '#ef4444' : '#f97316';
                  const markerId = a.isViolation ? 'arrowRed' : 'arrowOrange';
                  const cx = (a.x1 + a.x2) / 2;
                  return (
                    <path key={i}
                      d={`M ${a.x1} ${a.y1} C ${cx} ${a.y1}, ${cx} ${a.y2}, ${a.x2} ${a.y2}`}
                      fill="none" stroke={color} strokeWidth="0.6"
                      strokeOpacity="0.75"
                      markerEnd={`url(#${markerId})`}
                      strokeDasharray={a.isViolation ? '2 1' : undefined}
                    />
                  );
                })}
              </svg>
              <div style={{ height: items.length * ROW_H }}/>
            </div>
          )}
        </div>
      </div>

      {/* S32.5 — Context menu: click phải vào task name để thêm liên kết */}
      {ctxMenu !== null && (
        <div
          className="fixed z-50 bg-white border border-slate-200 rounded-xl shadow-xl py-1 min-w-[180px]"
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
          onMouseLeave={() => setCtxMenu(null)}
        >
          <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
            {items[ctxMenu.taskIdx]?.name?.slice(0, 25)}
          </div>
          {linkingFrom === null ? (
            <button
              className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-orange-50 hover:text-orange-700 flex items-center gap-2"
              onClick={() => { setLinkingFrom(ctxMenu.taskIdx); setCtxMenu(null); }}
            >
              <GitMerge size={12}/> Thêm liên kết từ đây…
            </button>
          ) : (
            <>
              <div className="px-3 py-1.5 text-[11px] text-orange-600 bg-orange-50">
                → Chọn task kế tiếp (phụ thuộc vào <b>{items[linkingFrom]?.name?.slice(0,20)}</b>)
              </div>
              <button
                className="w-full text-left px-3 py-2 text-xs text-emerald-700 hover:bg-emerald-50 flex items-center gap-2"
                onClick={() => {
                  addDependency(linkingFrom, ctxMenu.taskIdx);
                  setLinkingFrom(null); setCtxMenu(null);
                }}
              >
                ✓ Đặt "{items[ctxMenu.taskIdx]?.name?.slice(0,20)}" phụ thuộc
              </button>
              <button
                className="w-full text-left px-3 py-2 text-xs text-slate-500 hover:bg-slate-50"
                onClick={() => { setLinkingFrom(null); setCtxMenu(null); }}
              >
                Huỷ
              </button>
            </>
          )}
          {items[ctxMenu.taskIdx]?.depends_on?.length ? (
            <>
              <div className="border-t border-slate-100 mt-1 px-3 py-1.5 text-[10px] text-slate-400">Phụ thuộc vào:</div>
              {items[ctxMenu.taskIdx].depends_on!.map(wid => {
                const pred = items.find(t => t.wbsId === wid);
                return (
                  <div key={wid} className="px-3 py-1 flex items-center justify-between text-xs text-slate-600">
                    <span>← {pred?.name?.slice(0,22) ?? wid}</span>
                    <button
                      className="text-rose-400 hover:text-rose-600 ml-2"
                      onClick={() => {
                        const next = items.map((t, i) =>
                          i === ctxMenu.taskIdx ? { ...t, depends_on: t.depends_on?.filter(d => d !== wid) } : t
                        );
                        setItems(next);
                        onUpdateTask?.({ ...next[ctxMenu.taskIdx] });
                        onReorder(next);
                        setCtxMenu(null);
                      }}
                    >✕</button>
                  </div>
                );
              })}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

