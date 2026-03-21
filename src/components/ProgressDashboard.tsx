import React, { useState, useCallback, useRef } from 'react';
import { loadMembers } from './projectMember';
import {
  TrendingUp, Clock, AlertTriangle, Award, CheckCircle, Target,
  Sparkles, Loader2, FileSpreadsheet, ChevronDown, ChevronUp,
  BarChart2, Activity, Zap, Flag, Edit3, Save, X, Plus, RefreshCw,
  ArrowUp, ArrowDown, Minus, Info, Printer, GripVertical, DollarSign,
  Camera, GitBranch, GitMerge, Calendar, Download,
  CloudRain, FileText, CalendarDays, Users, Wrench
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
import CalendarSchedule from './CalendarSchedule';
import ReportsDashboard from './ReportsDashboard';
import { GanttChart, DelayLogPanel } from './GanttChart';
import {
  WBSItem, WBS_INIT, MILESTONES_INIT, CAT_CLS, GEM_SYS,
  calcEVM, calcGanttRange, buildSCurveData,
} from './GanttTypes';

type Props = DashboardProps;

// ─── Milestone status map (React nodes — giữ ở đây, không đưa vào GanttTypes) ─
const MS_STATUS: Record<string,{label:string;cls:string;icon:React.ReactNode}> = {
  done:     { label:'Hoàn thành',    cls:'bg-emerald-100 text-emerald-700 border-emerald-200', icon:<CheckCircle  size={13} className="text-emerald-600"/> },
  delayed:  { label:'Chậm',         cls:'bg-rose-100 text-rose-700 border-rose-200',          icon:<AlertTriangle size={13} className="text-rose-500"/> },
  at_risk:  { label:'Có rủi ro',    cls:'bg-amber-100 text-amber-700 border-amber-200',       icon:<AlertTriangle size={13} className="text-amber-500"/> },
  on_track: { label:'Đúng tiến độ', cls:'bg-blue-100 text-blue-700 border-blue-200',          icon:<Target        size={13} className="text-blue-500"/> },
};

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


// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ProgressDashboard({ project: selectedProject, projectId: projectIdProp }: Props) {
  const pid = projectIdProp ?? selectedProject?.id ?? 'default';
  const { user } = useAuth();
  const { ok: notifOk, err: notifErr, warn: notifWarn } = useNotification();
  // L4+ (admin/manager-finance) thấy số tiền thật, L3 chỉ thấy CPI indicator
  const canViewFinance        = ['admin','manager'].includes(user?.tier ?? '') || (user?.tier === 'manager');
  const canViewFinanceNumbers = user?.tier === 'admin';
  const [tab, setTab] = useState<'scurve'|'evm'|'wbs'|'milestones'|'lookahead'|'calendar'|'reports'>('wbs');
  const { printComponent, printProgressReport } = usePrint();
  const dbLoaded = useRef(false);
  const [wbs, setWbs] = useState(WBS_INIT);
  // S32.9 — load nhân lực từ mp_people để tính resource histogram
  const [mpPeople, setMpPeople] = useState<{ id:string; name:string; status:string; team:string; type:string }[]>([]);

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
        const [savedWbs, savedMs, savedPeople] = await Promise.all([
          db.get<typeof WBS_INIT>('progress_wbs', pid, WBS_INIT),
          db.get<typeof MILESTONES_INIT>('progress_milestones', pid, []),
          db.get<any[]>('mp_people', pid, []),
        ]);
        setWbs(savedWbs);
        if (savedMs.length) setMilestones(savedMs as any);
        if (savedPeople.length) setMpPeople(savedPeople);
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
        depends_on: w.depends_on,
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
    { id:'wbs'       as const, label:'Gantt & WBS',     icon:<FileSpreadsheet size={14}/> },
    { id:'scurve'    as const, label:'Đường S-Curve',   icon:<TrendingUp size={14}/> },
    { id:'evm'       as const, label:'Chỉ số EVM',      icon:<Activity size={14}/>   },
    { id:'milestones'as const, label:'Cột mốc',         icon:<Flag size={14}/>       },
    { id:'lookahead' as const, label:'Kế hoạch tới',    icon:<Calendar size={14}/>   },
    { id:'calendar'  as const, label:'Lịch & Sự kiện', icon:<CalendarDays size={14}/> },
    { id:'reports'   as const, label:'Báo cáo',         icon:<FileText size={14}/>   },
  ];

  return (
    <div className="space-y-5">
      {/* S32.8 Print/Export CSS */}
      <style>{`
        @media print {
          body > *:not(.progress-dashboard-root) { display: none !important; }
          .progress-dashboard-root { display: block !important; }
          .print\\:hidden { display: none !important; }
          .hidden.print\\:block { display: block !important; }
          .lookahead-print { page-break-inside: avoid; }
          @page { size: A4 portrait; margin: 12mm; }
        }
      `}</style>
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
          <button onClick={() => {
              // S32.8 Export Excel — WBS table as CSV download
              const rows = [['Code','Tên hạng mục','Bắt đầu','Kết thúc','% EV','Ngân sách (tỷ)','Phụ trách']];
              (wbs as WBSItem[]).forEach(w => rows.push([
                w.code, w.name,
                w.gantt_start_date || '', w.gantt_end_date || '',
                String(w.ev_pct), String(w.budget), w.responsible,
              ]));
              const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
              const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8'});
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url;
              a.download = `WBS_${selectedProject?.name||'DuAn'}_${new Date().toISOString().slice(0,10)}.csv`;
              a.click(); URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-white border border-slate-200 hover:border-emerald-300 text-slate-600 rounded-xl text-sm font-semibold shadow-sm transition-all">
            <Download size={14}/> Excel
          </button>
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
            <Printer size={14}/> PDF
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
        </div>
      )}

      {/* ── Chỉ số EVM ───────────────────────────────────────────────────────── */}
      {tab==='evm' && (
        <div className="space-y-5">
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

      {/* ── Cột mốc ──────────────────────────────────────────────────────────── */}
      {tab==='milestones' && (
        <div className="space-y-4">
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
              { label:'Tổng cột mốc', val:milestones.length,                               cls:'bg-slate-100 text-slate-700' },
              { label:'Hoàn thành',   val:milestones.filter(m=>m.status==='done').length,   cls:'bg-emerald-100 text-emerald-700' },
              { label:'Đang chậm',    val:milestones.filter(m=>m.status==='delayed').length,cls:'bg-rose-100 text-rose-700' },
              { label:'Có rủi ro',    val:milestones.filter(m=>m.status==='at_risk').length,cls:'bg-amber-100 text-amber-700' },
            ].map((k,i)=>(
              <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center mb-3 ${k.cls}`}><Flag size={16}/></div>
                <div className="text-2xl font-bold text-slate-800">{k.val}</div>
                <div className="text-xs text-slate-500 mt-0.5">{k.label}</div>
              </div>
            ))}
          </div>
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
          {milestones.some(m=>m.status==='delayed'&&m.critical) && (
            <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle size={18} className="text-rose-500 mt-0.5 shrink-0"/>
              <div>
                <p className="font-bold text-rose-800 text-sm">🚨 Cảnh báo Critical Path</p>
                {milestones.filter(m=>m.status==='delayed'&&m.critical).map(m=>(
                  <p key={m.id} className="text-xs text-rose-700 mt-1">• <strong>{m.name}</strong> — chậm {m.delta} ngày ({m.plan})</p>
                ))}
                <button onClick={callGEM} className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700">
                  <Sparkles size={11}/>GEM đề xuất phục hồi tiến độ
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Gantt & WBS ──────────────────────────────────────────────────────── */}
      {tab==='wbs' && (
        <div className="space-y-3">
          {/* Gantt chart */}
          <GanttChart
            tasks={ganttTasks}
            totalDays={totalDays}
            today={today}
            startMs={startMs}
            canViewFinance={canViewFinance}
            canViewFinanceNumbers={canViewFinanceNumbers}
            onReorder={(reordered) => {
              const wbsById = Object.fromEntries(wbs.map(w => [w.id, w]));
              const nextWbs = reordered.map(t => wbsById[(t as any).wbsId]).filter(Boolean);
              if (nextWbs.length === wbs.length) {
                setWbs(() => { if (dbLoaded.current) db.set('progress_wbs', pid, nextWbs); return nextWbs; });
              }
            }}
            onUpdateTask={(updated) => {
              setWbs(prev => {
                const next = (prev as WBSItem[]).map(w => {
                  if (w.id !== updated.wbsId) return w;
                  const patch: Partial<WBSItem> = { ev_pct: updated.done, gantt_start: updated.start, gantt_dur: updated.dur };
                  if (startMs > 0) {
                    const s = new Date(startMs + updated.start * 86400000);
                    const e = new Date(startMs + (updated.start + updated.dur) * 86400000);
                    patch.gantt_start_date = s.toISOString().slice(0,10);
                    patch.gantt_end_date   = e.toISOString().slice(0,10);
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
                  return { ...w, gantt_baseline_start: ft.gantt_baseline_start, gantt_baseline_end: ft.gantt_baseline_end };
                });
                if (dbLoaded.current) db.set('progress_wbs', pid, next);
                return next;
              });
              notifOk('📸 Baseline đã được chụp', 'Mọi thay đổi tiến độ sẽ so sánh với mốc này');
            }}
          />

          {/* S32.9 Resource histogram — wire từ mp_people + WBS */}
          {(() => {
            const BUCKET = 7;
            const activePeople = mpPeople.filter(p => p.status === 'active');
            const workerCount  = activePeople.filter(p => p.type === 'worker').length;
            const staffCount   = activePeople.filter(p => p.type === 'staff').length;
            const capacity     = Math.max(workerCount || 10, 5);
            const buckets: { label:string; workers:number; staff:number; equip:number; overload:boolean }[] = [];
            for (let w = 0; w < Math.min(Math.ceil(totalDays / BUCKET), 16); w++) {
              const dayStart = w * BUCKET;
              const dayEnd   = dayStart + BUCKET;
              const activeTasks = (wbs as WBSItem[]).filter(item => {
                const s = item.gantt_start ?? 0;
                const e = s + (item.gantt_dur ?? 0);
                return e > dayStart && s < dayEnd && item.ev_pct < 100;
              });
              const equipTasks = activeTasks.filter(t => ['M&E','Móng','Thân nhà'].includes(t.category));
              const label = startMs > 0
                ? new Date(startMs + dayStart * 86400000).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'})
                : `T${w+1}`;
              buckets.push({
                label,
                workers: Math.min(activeTasks.length * Math.max(1, Math.floor(workerCount / Math.max(activeTasks.length,1))), workerCount || activeTasks.length),
                staff:   staffCount > 0 ? Math.ceil(staffCount / Math.max(activeTasks.length,1)) : 0,
                equip:   equipTasks.length,
                overload: activeTasks.length > capacity / 2,
              });
            }
            const maxVal = Math.max(...buckets.map(b => b.workers + b.staff), capacity, 1);
            return (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Users size={14} className="text-indigo-500"/>Tải trọng nhân lực & thiết bị theo tuần
                  </h4>
                  <div className="flex items-center gap-3 text-[10px] font-semibold text-slate-500">
                    {mpPeople.length > 0
                      ? <><span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-400 inline-block"/>Công nhân ({workerCount})</span>
                          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-blue-400 inline-block"/>Cán bộ ({staffCount})</span></>
                      : <span className="text-amber-600">⚠ Chưa có nhân sự — mở tab Nhân sự để nhập</span>
                    }
                  </div>
                </div>
                <div className="flex items-end gap-1 overflow-x-auto pb-6" style={{minHeight:80}}>
                  {buckets.map((b,i) => {
                    const totalH  = Math.round(((b.workers+b.staff)/maxVal)*64);
                    const workerH = Math.round((b.workers/maxVal)*64);
                    const staffH  = totalH - workerH;
                    return (
                      <div key={i} className="flex flex-col items-center shrink-0" style={{minWidth:32}}>
                        <div className="relative flex flex-col justify-end" style={{height:64,width:20}}>
                          <div className="absolute w-full border-t border-dashed border-rose-300"
                               style={{bottom:`${Math.round((capacity/maxVal)*64)}px`}}/>
                          <div className="w-full rounded-t-sm"
                               style={{height:workerH, background: b.overload?'#f87171':'#fbbf24'}}/>
                          {staffH>0 && <div className="w-full" style={{height:staffH,background:'#60a5fa'}}/>}
                        </div>
                        <div className="w-full mt-0.5 rounded-sm bg-slate-200"
                             style={{height:Math.max(Math.round((b.equip/Math.max(...buckets.map(x=>x.equip),1))*16),0),width:20}}
                             title={`${b.label}: ${b.equip} thiết bị`}/>
                        <span className="text-[7px] text-slate-400 mt-1 whitespace-nowrap"
                              style={{writingMode:'vertical-rl',transform:'rotate(180deg)',height:28}}>{b.label}</span>
                      </div>
                    );
                  })}
                </div>
                {buckets.some(b=>b.overload) && (
                  <p className="text-[10px] text-rose-600 font-semibold flex items-center gap-1 mt-1">
                    <AlertTriangle size={10}/>Tuần màu đỏ có nguy cơ quá tải — cần điều phối lại tiến độ
                  </p>
                )}
              </div>
            );
          })()}


          {/* S32.10 Delay log */}
          <DelayLogPanel
            pid={pid}
            wbs={wbs as WBSItem[]}
            dbLoaded={dbLoaded}
            setWbs={setWbs as any}
            notifOk={notifOk}
          />

          {/* WBS table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">Click vào hạng mục để cập nhật % EV thực tế</p>
              <div className="flex gap-2 text-[10px] font-bold">
                {[['bg-emerald-200','OK'],['bg-amber-200','Rủi ro'],['bg-rose-200','Critical']].map(([c,l])=>(
                  <span key={l} className="flex items-center gap-1"><span className={`w-2.5 h-2.5 rounded ${c}`}/>{l}</span>
                ))}
              </div>
            </div>
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
                          <input type="number" min={0} max={100} value={editEv} onChange={e=>setEditEv(e.target.value)}
                            className="w-14 text-xs text-center border border-emerald-300 rounded-lg px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-400"/>
                          <button onClick={()=>{
                            setWbs(p=>{const next=p.map(x=>x.id===w.id?{...x,ev_pct:+editEv}:x);if(dbLoaded.current)db.set('progress_wbs',pid,next);return next;});
                            setEditingWbs(null);
                          }} className="p-1 bg-emerald-500 text-white rounded"><Save size={9}/></button>
                          <button onClick={()=>setEditingWbs(null)} className="p-1 bg-slate-200 rounded"><X size={9}/></button>
                        </div>
                      ) : (
                        <button onClick={e=>{e.stopPropagation();setEditingWbs(w.id);setEditEv(String(w.ev_pct));}} className="group/ev">
                          <div className={`text-xs font-bold ${gap<-10?'text-rose-600':gap<-5?'text-amber-600':'text-emerald-600'}`}>{w.ev_pct}%</div>
                          <div className="h-1.5 bg-emerald-100 rounded-full mt-1 overflow-hidden">
                            <div className={`h-full rounded-full ${gap<-10?'bg-rose-400':gap<-5?'bg-amber-400':'bg-emerald-400'}`} style={{width:`${w.ev_pct}%`}}/>
                          </div>
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
                          <select value={w.responsible} onClick={e=>e.stopPropagation()}
                            onChange={e=>{e.stopPropagation();setWbs(prev=>{const next=prev.map(x=>x.id===w.id?{...x,responsible:e.target.value}:x);if(dbLoaded.current)db.set('progress_wbs',pid,next);return next;});}}
                            className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer">
                            {loadMembers(pid).map(m=>(<option key={m.userId} value={m.userName}>{m.userName}</option>))}
                            {loadMembers(pid).length===0 && <option value={w.responsible}>{w.responsible}</option>}
                          </select>
                        </div>
                        <div><span className="font-bold text-slate-400 uppercase text-[9px] block mb-0.5">Lệch PV-EV</span>
                          <span className={gap<0?'text-rose-600 font-bold':'text-emerald-600 font-bold'}>{gap>0?'+':''}{gap}%</span></div>
                        <div><span className="font-bold text-slate-400 uppercase text-[9px] block mb-0.5">Critical path</span>
                          <span className={w.critical?'text-rose-600 font-bold':'text-slate-500'}>{w.critical?'⚠ Có':'Không'}</span></div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Lịch & Sự kiện ───────────────────────────────────────────────────── */}
      {tab==='calendar' && (
        <CalendarSchedule projects={selectedProject ? [selectedProject] : []}/>
      )}

      {/* ── Báo cáo ──────────────────────────────────────────────────────────── */}
      {tab==='reports' && selectedProject && (
        <ReportsDashboard project={selectedProject} projectId={selectedProject.id}/>
      )}
      {/* S32.7 — Look-ahead 3 tuần */}
      {tab === 'lookahead' && (() => {
        const nowMs = Date.now();
        const startOfToday = new Date(); startOfToday.setHours(0,0,0,0);
        const todayMs = startOfToday.getTime();
        const week1End = todayMs + 7  * 86400000;
        const week2End = todayMs + 14 * 86400000;
        const week3End = todayMs + 21 * 86400000;

        // Build gantt tasks với real dates từ wbs
        const ganttTasks = (wbs as WBSItem[]).map(w => {
          const startDate = w.gantt_start_date ? new Date(w.gantt_start_date).getTime() : null;
          const endDate   = w.gantt_end_date   ? new Date(w.gantt_end_date).getTime()   : null;
          return { ...w, startMs: startDate, endMs: endDate };
        });

        const groups = [
          { label:'Tuần này',      from: todayMs, to: week1End,  cls:'bg-blue-50 border-blue-200',   hdr:'text-blue-700' },
          { label:'Tuần tới',      from: week1End, to: week2End, cls:'bg-violet-50 border-violet-200', hdr:'text-violet-700' },
          { label:'Tuần sau nữa',  from: week2End, to: week3End, cls:'bg-slate-50 border-slate-200',  hdr:'text-slate-600' },
        ];

        const fmtDate = (ms: number) => new Date(ms).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit' });

        return (
          <div className="space-y-4 lookahead-print">
            {/* Print header — chỉ hiện khi in */}
            <div className="hidden print:block text-center mb-4">
              <h2 className="text-lg font-bold">KẾ HOẠCH LOOK-AHEAD 3 TUẦN</h2>
              <p className="text-sm text-slate-500">{selectedProject?.name||'Dự án'} — In ngày {new Date().toLocaleDateString('vi-VN')}</p>
            </div>

            {/* Export bar */}
            <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-3 print:hidden">
              <div>
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2"><Calendar size={14} className="text-blue-600"/>Look-ahead 3 tuần tới</h3>
                <p className="text-xs text-slate-400 mt-0.5">Task bắt đầu trong 21 ngày — dùng cho họp giao ban</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-all">
                  <Printer size={12}/>In A4
                </button>
              </div>
            </div>

            {groups.map(g => {
              const tasks = ganttTasks.filter(t =>
                t.startMs !== null && t.startMs >= g.from && t.startMs < g.to
              );
              return (
                <div key={g.label} className={`rounded-2xl border-2 ${g.cls} overflow-hidden`}>
                  <div className={`px-5 py-3 flex items-center justify-between border-b ${g.cls}`}>
                    <h4 className={`font-bold text-sm ${g.hdr} flex items-center gap-2`}>
                      <Calendar size={13}/>{g.label}
                      <span className="ml-2 text-[10px] font-normal opacity-70">{fmtDate(g.from)} – {fmtDate(g.to - 86400000)}</span>
                    </h4>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/60 ${g.hdr}`}>{tasks.length} task</span>
                  </div>
                  {tasks.length === 0 ? (
                    <p className="px-5 py-4 text-xs text-slate-400 italic">Không có task nào bắt đầu trong giai đoạn này</p>
                  ) : (
                    <div className="divide-y divide-white/50">
                      {tasks.map(t => {
                        const dur = t.endMs && t.startMs ? Math.round((t.endMs - t.startMs) / 86400000) : null;
                        const overdue = t.endMs && t.endMs < nowMs && t.ev_pct < 100;
                        return (
                          <div key={t.id} className="px-5 py-3 flex items-center gap-4 flex-wrap">
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-semibold truncate ${overdue ? 'text-rose-700' : 'text-slate-800'}`}>
                                {overdue && '⚠ '}{t.name}
                              </p>
                              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                <span className="text-[10px] text-slate-400">{t.code}</span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${CAT_CLS[t.category]||'bg-slate-100 text-slate-500'}`}>{t.category}</span>
                                <span className="text-[10px] text-slate-500">👤 {t.responsible}</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0 space-y-0.5">
                              <p className="text-[11px] font-bold text-slate-700">
                                {t.startMs ? fmtDate(t.startMs) : '?'} → {t.endMs ? fmtDate(t.endMs) : '?'}
                              </p>
                              {dur !== null && <p className="text-[10px] text-slate-400">{dur} ngày</p>}
                            </div>
                            <div className="shrink-0">
                              <div className="w-20 h-2 bg-white/60 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${t.ev_pct >= 100 ? 'bg-emerald-400' : t.ev_pct > 0 ? 'bg-amber-400' : 'bg-slate-300'}`}
                                     style={{width:`${t.ev_pct}%`}}/>
                              </div>
                              <p className="text-[9px] text-center mt-0.5 text-slate-500">{t.ev_pct}%</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Tasks không có gantt_start_date */}
            {(() => {
              const noDate = (wbs as WBSItem[]).filter(w => !w.gantt_start_date);
              if (!noDate.length) return null;
              return (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 print:hidden">
                  <p className="text-xs text-amber-700 font-semibold flex items-center gap-2">
                    <AlertTriangle size={12}/>{noDate.length} task chưa gán ngày bắt đầu — mở tab WBS/Tiến độ để kéo Gantt
                  </p>
                </div>
              );
            })()}
          </div>
        );
      })()}

      {printComponent}
    </div>
  );
}
