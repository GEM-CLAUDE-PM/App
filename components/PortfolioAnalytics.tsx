import React, { useState, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Clock,
  DollarSign, BarChart2, Activity, Target, Award, Zap, ArrowUp,
  ArrowDown, Minus, Filter, ChevronDown, Building2, Info,
  ShieldAlert, Users, Wrench, FileText, Sparkles, RefreshCw,
  Eye, GitCompare
} from 'lucide-react';
import { filterProjectsByScope } from './permissions';
import { getCurrentScopeCtx } from './projectMember';
import {
  BarChart, Bar, LineChart, Line, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, ReferenceLine, ScatterChart, Scatter,
  ZAxis
} from 'recharts';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Project {
  id: string;
  name: string;
  type: 'in_progress' | 'potential' | 'completed';
  status: string;
  progress: number;
  budget: string;
  startDate: string;
  endDate: string;
  address: string;
  spi: number | null;
  ncr: number;
  hse: number;
  ntp_pending: number;
}

interface Props {
  projects: Project[];
  onNavigate?: (tab: string, projectId?: string, subTab?: string) => void;
}

// ── Mock enriched data per project (sẽ thay bằng db.ts sau) ──────────────────
const ENRICHED: Record<string, {
  cpi: number; budgetUsed: number; budgetTotal: number;
  manpower: number; equipment: number; openRfi: number;
  safetyScore: number; qualityScore: number; cashflowHealth: 'good'|'warning'|'critical';
  contractValue: number; billedPct: number; collectedPct: number;
  delayDays: number; criticalIssues: number;
}> = {
  p1: { cpi:0.96, budgetUsed:42, budgetTotal:120, manpower:85, equipment:12, openRfi:3,  safetyScore:88, qualityScore:82, cashflowHealth:'warning',  contractValue:120, billedPct:32, collectedPct:28, delayDays:5,   criticalIssues:2 },
  p2: { cpi:1.02, budgetUsed:396,budgetTotal:450, manpower:120,equipment:18, openRfi:1,  safetyScore:97, qualityScore:95, cashflowHealth:'good',     contractValue:450, billedPct:86, collectedPct:82, delayDays:0,   criticalIssues:0 },
  p3: { cpi:0.82, budgetUsed:18, budgetTotal:80,  manpower:55, equipment:8,  openRfi:7,  safetyScore:72, qualityScore:70, cashflowHealth:'critical', contractValue:80,  billedPct:18, collectedPct:12, delayDays:22,  criticalIssues:4 },
  p6: { cpi:1.05, budgetUsed:295,budgetTotal:300, manpower:0,  equipment:0,  openRfi:0,  safetyScore:99, qualityScore:98, cashflowHealth:'good',     contractValue:300, billedPct:100,collectedPct:96, delayDays:0,   criticalIssues:0 },
  p7: { cpi:1.01, budgetUsed:50, budgetTotal:50,  manpower:0,  equipment:0,  openRfi:0,  safetyScore:100,qualityScore:99, cashflowHealth:'good',     contractValue:50,  billedPct:100,collectedPct:100,delayDays:0,   criticalIssues:0 },
};

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (n: number) => n >= 1000 ? `${(n/1000).toFixed(1)}K tỷ` : `${n} tỷ`;
const pct = (n: number) => `${n}%`;

function spiColor(spi: number | null) {
  if (!spi) return 'text-slate-400';
  if (spi >= 0.95) return 'text-emerald-600';
  if (spi >= 0.85) return 'text-amber-600';
  return 'text-rose-600';
}
function spiBg(spi: number | null) {
  if (!spi) return 'bg-slate-100';
  if (spi >= 0.95) return 'bg-emerald-100';
  if (spi >= 0.85) return 'bg-amber-100';
  return 'bg-rose-100';
}
function spiLabel(spi: number | null) {
  if (!spi) return '—';
  if (spi >= 0.95) return 'Đúng tiến độ';
  if (spi >= 0.85) return 'Hơi chậm';
  return 'Trễ nặng';
}
function healthColor(h: string) {
  if (h === 'good') return 'text-emerald-600';
  if (h === 'warning') return 'text-amber-600';
  return 'text-rose-600';
}
function healthBg(h: string) {
  if (h === 'good') return 'bg-emerald-50 border-emerald-200';
  if (h === 'warning') return 'bg-amber-50 border-amber-200';
  return 'bg-rose-50 border-rose-200';
}
function healthLabel(h: string) {
  if (h === 'good') return 'Tốt';
  if (h === 'warning') return 'Cảnh báo';
  return 'Nguy hiểm';
}

// Custom tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2.5 text-xs">
      <p className="font-bold text-slate-700 mb-1.5">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }}/>
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-semibold text-slate-800">{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ── Metric card ────────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, icon, color, trend }: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; color: string; trend?: 'up'|'down'|'neutral';
}) {
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    amber:   'bg-amber-50 border-amber-200 text-amber-700',
    rose:    'bg-rose-50 border-rose-200 text-rose-700',
    blue:    'bg-blue-50 border-blue-200 text-blue-700',
    violet:  'bg-violet-50 border-violet-200 text-violet-700',
    slate:   'bg-slate-50 border-slate-200 text-slate-700',
  };
  return (
    <div className={`rounded-2xl border p-4 ${colorMap[color] || colorMap.slate}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="opacity-60">{icon}</span>
        {trend && (
          <span className="opacity-70">
            {trend === 'up' ? <ArrowUp size={13}/> : trend === 'down' ? <ArrowDown size={13}/> : <Minus size={13}/>}
          </span>
        )}
      </div>
      <p className="text-2xl font-black tracking-tight">{value}</p>
      <p className="text-xs font-semibold mt-0.5 opacity-75">{label}</p>
      {sub && <p className="text-[10px] opacity-50 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function PortfolioAnalytics({ projects, onNavigate }: Props) {
  const [filter, setFilter] = useState<'all'|'in_progress'|'completed'>('all');
  const [sortBy, setSortBy] = useState<'spi'|'progress'|'budget'|'health'>('spi');
  const [activeTab, setActiveTab] = useState<'overview'|'kpi'|'financial'|'risk'|'benchmark'>('overview');

  // ── Scope filter — L1/L2/L3 chỉ thấy projects được phép ──────────────────
  const scopeCtx       = getCurrentScopeCtx();
  const scopedProjects = useMemo(
    () => filterProjectsByScope(scopeCtx, projects as any[]) as Project[],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects, scopeCtx.allowedProjectIds, scopeCtx.roleId]
  );

  // ── Filtered projects ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const base = scopedProjects.filter(p => {
      if (filter === 'in_progress') return p.type === 'in_progress';
      if (filter === 'completed') return p.type === 'completed';
      return p.type !== 'potential';
    });
    return base.sort((a, b) => {
      const ea = ENRICHED[a.id];
      const eb = ENRICHED[b.id];
      if (sortBy === 'spi') return (b.spi||0) - (a.spi||0);
      if (sortBy === 'progress') return b.progress - a.progress;
      if (sortBy === 'budget') return (eb?.contractValue||0) - (ea?.contractValue||0);
      if (sortBy === 'health') {
        const h = { good:0, warning:1, critical:2 };
        return (h[ea?.cashflowHealth||'good']||0) - (h[eb?.cashflowHealth||'good']||0);
      }
      return 0;
    });
  }, [scopedProjects, filter, sortBy]);

  const active = useMemo(() => filtered.filter(p => p.type === 'in_progress'), [filtered]);
  const done   = useMemo(() => filtered.filter(p => p.type === 'completed'),   [filtered]);

  // ── Portfolio KPIs ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const all = [...active, ...done];
    const totalBudget  = all.reduce((s, p) => s + (ENRICHED[p.id]?.contractValue||0), 0);
    const avgSpi       = active.filter(p=>p.spi).reduce((s,p,_,a)=> s+(p.spi!)/a.length, 0);
    const avgProgress  = active.reduce((s,p,_,a)=> s+p.progress/a.length, 0);
    const totalNcr     = active.reduce((s,p)=> s+p.ncr, 0);
    const totalHse     = active.reduce((s,p)=> s+p.hse, 0);
    const atRisk       = active.filter(p=> p.spi && p.spi < 0.85).length;
    const totalManpower= active.reduce((s,p)=> s+(ENRICHED[p.id]?.manpower||0), 0);
    const avgCpi       = active.filter(p=>ENRICHED[p.id]).reduce((s,p,_,a)=> s+(ENRICHED[p.id]?.cpi||1)/a.length, 0);
    const criticalCount= active.reduce((s,p)=> s+(ENRICHED[p.id]?.criticalIssues||0), 0);
    const totalBilled  = all.reduce((s,p)=> s+(ENRICHED[p.id]?.billedPct||0)/100*(ENRICHED[p.id]?.contractValue||0), 0);
    return { totalBudget, avgSpi, avgProgress, totalNcr, totalHse, atRisk, totalManpower, avgCpi, criticalCount, totalBilled };
  }, [active, done]);

  // ── Chart data ─────────────────────────────────────────────────────────────
  const spiBarData = useMemo(() =>
    active.map(p => ({
      name: p.name.length > 12 ? p.name.slice(0,12)+'…' : p.name,
      SPI: p.spi || 0,
      CPI: ENRICHED[p.id]?.cpi || 0,
      fill: p.spi! >= 0.95 ? '#10b981' : p.spi! >= 0.85 ? '#f59e0b' : '#f43f5e',
    })), [active]);

  const progressBarData = useMemo(() =>
    filtered.map(p => ({
      name: p.name.length > 10 ? p.name.slice(0,10)+'…' : p.name,
      'Tiến độ': p.progress,
      fill: p.type === 'completed' ? '#10b981' : p.progress >= 60 ? '#3b82f6' : '#f59e0b',
    })), [filtered]);

  const radarData = useMemo(() =>
    active.map(p => {
      const e = ENRICHED[p.id] || {};
      return {
        name: p.name.length > 10 ? p.name.slice(0,10)+'…' : p.name,
        'Tiến độ': p.progress,
        'Chất lượng': e.qualityScore || 0,
        'An toàn': e.safetyScore || 0,
        'Chi phí': Math.min(100, (e.cpi || 1) * 100),
        'Thu hồi TT': e.collectedPct || 0,
      };
    }), [active]);

  const cashflowScatter = useMemo(() =>
    active.map(p => {
      const e = ENRICHED[p.id] || {};
      return {
        name: p.name,
        x: e.billedPct || 0,
        y: e.collectedPct || 0,
        z: e.contractValue || 10,
        fill: e.cashflowHealth === 'good' ? '#10b981' : e.cashflowHealth === 'warning' ? '#f59e0b' : '#f43f5e',
      };
    }), [active]);

  const RADAR_COLORS = ['#10b981','#3b82f6','#f59e0b','#8b5cf6','#f43f5e'];

  const tabs = [
    { id: 'overview',   label: 'Tổng quan',    icon: <BarChart2 size={13}/> },
    { id: 'kpi',        label: 'KPI Dashboard', icon: <Activity size={13}/> },
    { id: 'financial',  label: 'Tài chính',     icon: <DollarSign size={13}/> },
    { id: 'risk',       label: 'Rủi ro',        icon: <ShieldAlert size={13}/> },
    { id: 'benchmark',  label: 'Benchmark',     icon: <GitCompare size={13}/> },
  ] as const;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-50 border border-violet-200 rounded-2xl flex items-center justify-center">
            <GitCompare size={20} className="text-violet-600"/>
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Portfolio Analytics</h2>
            <p className="text-xs text-slate-400">So sánh KPI · Benchmark · Phân tích rủi ro danh mục</p>
          </div>
        </div>
        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {(['all','in_progress','completed'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${
                filter === f
                  ? 'bg-violet-600 text-white border-violet-700 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}>
              {f === 'all' ? 'Tất cả' : f === 'in_progress' ? 'Đang chạy' : 'Hoàn thành'}
            </button>
          ))}
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
            className="text-xs border border-slate-200 rounded-xl px-3 py-1.5 bg-white text-slate-600 outline-none cursor-pointer">
            <option value="spi">Sắp xếp: SPI</option>
            <option value="progress">Sắp xếp: Tiến độ</option>
            <option value="budget">Sắp xếp: Giá trị HĐ</option>
            <option value="health">Sắp xếp: Dòng tiền</option>
          </select>
        </div>
      </div>

      {/* ── Top KPI strip ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard label="Dự án đang chạy"   value={active.length}           icon={<Building2 size={16}/>}   color="blue"    />
        <MetricCard label="Tổng giá trị HĐ"   value={fmt(stats.totalBudget)}  icon={<DollarSign size={16}/>}  color="emerald" />
        <MetricCard label="SPI trung bình"     value={stats.avgSpi.toFixed(2)} sub={spiLabel(stats.avgSpi)}   icon={<Clock size={16}/>}       color={stats.avgSpi>=0.95?'emerald':stats.avgSpi>=0.85?'amber':'rose'} />
        <MetricCard label="CPI trung bình"     value={stats.avgCpi.toFixed(2)} sub={stats.avgCpi>=1?'Tiết kiệm':'Vượt chi phí'} icon={<Target size={16}/>} color={stats.avgCpi>=1?'emerald':'amber'} />
        <MetricCard label="NCR còn mở"         value={stats.totalNcr}          sub="Cần xử lý"                icon={<AlertTriangle size={16}/>} color={stats.totalNcr>5?'rose':'amber'} />
        <MetricCard label="Dự án rủi ro cao"   value={stats.atRisk}            sub="SPI < 0.85"               icon={<ShieldAlert size={16}/>}  color={stats.atRisk>0?'rose':'emerald'} />
      </div>

      {/* ── Sub-tabs ───────────────────────────────────────────────────────── */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide border-b border-slate-200 pb-3">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`whitespace-nowrap flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              activeTab === t.id
                ? 'bg-violet-50 text-violet-700 border-violet-200'
                : 'text-slate-500 border-transparent hover:bg-slate-50 hover:border-slate-200'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Project cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(p => {
              const e = ENRICHED[p.id];
              return (
                <div key={p.id}
                  className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer"
                  onClick={() => onNavigate?.('tasks', p.id, 'overview')}>
                  {/* Color strip */}
                  <div className={`h-1.5 ${p.spi && p.spi >= 0.95 ? 'bg-emerald-500' : p.spi && p.spi >= 0.85 ? 'bg-amber-400' : p.type==='completed' ? 'bg-emerald-400' : 'bg-rose-500'}`}/>
                  <div className="p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <h3 className="font-bold text-slate-800 text-sm leading-tight">{p.name}</h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">{p.status}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border shrink-0 ${
                        p.type === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                        p.type === 'in_progress' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                        'bg-amber-50 text-amber-600 border-amber-200'
                      }`}>{p.type === 'completed' ? 'Hoàn thành' : p.type === 'in_progress' ? 'Đang chạy' : 'Tiềm năng'}</span>
                    </div>

                    {/* Progress bar */}
                    <div className="mb-3">
                      <div className="flex justify-between text-[10px] font-semibold mb-1">
                        <span className="text-slate-500">Tiến độ</span>
                        <span className="text-slate-700">{p.progress}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${
                          p.progress >= 80 ? 'bg-emerald-500' : p.progress >= 40 ? 'bg-blue-500' : 'bg-amber-400'
                        }`} style={{ width: `${p.progress}%` }}/>
                      </div>
                    </div>

                    {/* KPI row */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[
                        { label: 'SPI', value: p.spi?.toFixed(2)||'—', cls: spiColor(p.spi), bg: spiBg(p.spi) },
                        { label: 'CPI', value: e?.cpi.toFixed(2)||'—', cls: e?.cpi>=1?'text-emerald-600':e?.cpi>=0.9?'text-amber-600':'text-rose-600', bg: e?.cpi>=1?'bg-emerald-50':e?.cpi>=0.9?'bg-amber-50':'bg-rose-50' },
                        { label: 'NCR', value: String(p.ncr), cls: p.ncr===0?'text-emerald-600':p.ncr<=2?'text-amber-600':'text-rose-600', bg: p.ncr===0?'bg-emerald-50':p.ncr<=2?'bg-amber-50':'bg-rose-50' },
                      ].map(k => (
                        <div key={k.label} className={`rounded-xl p-2 text-center ${k.bg}`}>
                          <p className={`text-base font-black ${k.cls}`}>{k.value}</p>
                          <p className="text-[9px] text-slate-400 font-bold">{k.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2.5 border-t border-slate-100">
                      <span className="font-semibold text-slate-600">{p.budget}</span>
                      {e && (
                        <span className={`flex items-center gap-1 font-semibold ${healthColor(e.cashflowHealth)}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${e.cashflowHealth==='good'?'bg-emerald-500':e.cashflowHealth==='warning'?'bg-amber-400':'bg-rose-500'}`}/>
                          Dòng tiền: {healthLabel(e.cashflowHealth)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* SPI / CPI comparison chart */}
          {active.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-slate-700 mb-4">So sánh SPI & CPI — Dự án đang chạy</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={spiBarData} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false}/>
                  <YAxis domain={[0, 1.2]} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <ReferenceLine y={1} stroke="#10b981" strokeDasharray="4 2" label={{ value:'Mục tiêu 1.0', position:'insideTopRight', fontSize:10, fill:'#10b981' }}/>
                  <ReferenceLine y={0.85} stroke="#f59e0b" strokeDasharray="4 2" label={{ value:'Ngưỡng 0.85', position:'insideTopRight', fontSize:10, fill:'#f59e0b' }}/>
                  <Bar dataKey="SPI" name="SPI (Tiến độ)" radius={[6,6,0,0]}>
                    {spiBarData.map((e, i) => <Cell key={i} fill={e.fill}/>)}
                  </Bar>
                  <Bar dataKey="CPI" name="CPI (Chi phí)" fill="#6366f1" fillOpacity={0.7} radius={[6,6,0,0]}/>
                  <Legend wrapperStyle={{ fontSize: 11 }}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── KPI TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'kpi' && (
        <div className="space-y-5">
          {/* Radar chart — multi-project comparison */}
          {active.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-700">Radar KPI — So sánh toàn diện</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  {active.map((p, i) => (
                    <span key={p.id} className="flex items-center gap-1 text-[10px] font-semibold text-slate-600">
                      <span className="w-2 h-2 rounded-full" style={{ background: RADAR_COLORS[i % RADAR_COLORS.length] }}/>
                      {p.name.length > 14 ? p.name.slice(0,14)+'…' : p.name}
                    </span>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={[
                  { subject: 'Tiến độ' },
                  { subject: 'Chất lượng' },
                  { subject: 'An toàn' },
                  { subject: 'Chi phí' },
                  { subject: 'Thu TT' },
                ].map(item => {
                  const result: any = { subject: item.subject };
                  active.forEach(p => {
                    const e = ENRICHED[p.id] || {};
                    const shortName = p.name.length > 10 ? p.name.slice(0,10)+'…' : p.name;
                    if (item.subject === 'Tiến độ')   result[shortName] = p.progress;
                    if (item.subject === 'Chất lượng') result[shortName] = e.qualityScore || 0;
                    if (item.subject === 'An toàn')    result[shortName] = e.safetyScore || 0;
                    if (item.subject === 'Chi phí')    result[shortName] = Math.min(100, (e.cpi||1)*100);
                    if (item.subject === 'Thu TT')     result[shortName] = e.collectedPct || 0;
                  });
                  return result;
                })}>
                  <PolarGrid stroke="#e2e8f0"/>
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#64748b' }}/>
                  {active.map((p, i) => {
                    const shortName = p.name.length > 10 ? p.name.slice(0,10)+'…' : p.name;
                    return (
                      <Radar key={p.id} name={shortName} dataKey={shortName}
                        stroke={RADAR_COLORS[i % RADAR_COLORS.length]}
                        fill={RADAR_COLORS[i % RADAR_COLORS.length]}
                        fillOpacity={0.12}/>
                    );
                  })}
                  <Legend wrapperStyle={{ fontSize: 11 }}/>
                  <Tooltip content={<CustomTooltip/>}/>
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Progress comparison */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-4">Tiến độ tổng thể các dự án</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={progressBarData} layout="vertical" barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false}/>
                <XAxis type="number" domain={[0,100]} tick={{ fontSize:10, fill:'#94a3b8' }} tickLine={false} axisLine={false}/>
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize:11, fill:'#475569' }} axisLine={false} tickLine={false}/>
                <Tooltip content={<CustomTooltip/>}/>
                <ReferenceLine x={100} stroke="#10b981" strokeDasharray="4 2"/>
                <Bar dataKey="Tiến độ" name="Tiến độ (%)" radius={[0,6,6,0]}>
                  {progressBarData.map((e, i) => <Cell key={i} fill={e.fill}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* KPI table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
              <h3 className="text-sm font-bold text-slate-700">Bảng KPI chi tiết</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Dự án','Trạng thái','Tiến độ','SPI','CPI','NCR','HSE','An toàn','Chất lượng','Nhân lực'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left font-bold text-slate-500 uppercase tracking-wide text-[10px] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, i) => {
                    const e = ENRICHED[p.id];
                    return (
                      <tr key={p.id}
                        className={`border-b border-slate-50 hover:bg-emerald-50/40 transition-colors cursor-pointer ${i%2===0?'':'bg-slate-50/30'}`}
                        onClick={() => onNavigate?.('tasks', p.id, 'overview')}>
                        <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{p.name}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${
                            p.type==='completed'?'bg-emerald-50 text-emerald-600':p.type==='in_progress'?'bg-blue-50 text-blue-600':'bg-amber-50 text-amber-600'
                          }`}>{p.type==='completed'?'Xong':p.type==='in_progress'?'Đang chạy':'Tiềm năng'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${p.progress>=80?'bg-emerald-500':p.progress>=40?'bg-blue-500':'bg-amber-400'}`} style={{width:`${p.progress}%`}}/>
                            </div>
                            <span className="font-semibold text-slate-700">{p.progress}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3"><span className={`font-black ${spiColor(p.spi)}`}>{p.spi?.toFixed(2)||'—'}</span></td>
                        <td className="px-4 py-3"><span className={`font-black ${e?.cpi>=1?'text-emerald-600':e?.cpi>=0.9?'text-amber-600':'text-rose-600'}`}>{e?.cpi.toFixed(2)||'—'}</span></td>
                        <td className="px-4 py-3"><span className={`font-bold ${p.ncr===0?'text-emerald-600':p.ncr<=2?'text-amber-600':'text-rose-600'}`}>{p.ncr}</span></td>
                        <td className="px-4 py-3"><span className={`font-bold ${p.hse===0?'text-emerald-600':'text-rose-600'}`}>{p.hse}</span></td>
                        <td className="px-4 py-3"><span className="font-semibold text-slate-700">{e?.safetyScore||'—'}/100</span></td>
                        <td className="px-4 py-3"><span className="font-semibold text-slate-700">{e?.qualityScore||'—'}/100</span></td>
                        <td className="px-4 py-3"><span className="font-semibold text-slate-700">{e?.manpower||0} người</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── FINANCIAL TAB ───────────────────────────────────────────────── */}
      {activeTab === 'financial' && (
        <div className="space-y-5">
          {/* Financial summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Tổng HĐ portfolio"  value={fmt(stats.totalBudget)}               icon={<DollarSign size={16}/>} color="emerald"/>
            <MetricCard label="Đã xuất TT"          value={fmt(Math.round(stats.totalBilled))}   icon={<FileText size={16}/>}   color="blue"/>
            <MetricCard label="CPI trung bình"      value={stats.avgCpi.toFixed(2)}               icon={<Target size={16}/>}    color={stats.avgCpi>=1?'emerald':'amber'}/>
            <MetricCard label="Vấn đề nghiêm trọng" value={stats.criticalCount}                   icon={<AlertTriangle size={16}/>} color={stats.criticalCount>0?'rose':'emerald'}/>
          </div>

          {/* Cash flow health + Scatter */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Health cards */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
                <h3 className="text-sm font-bold text-slate-700">Sức khoẻ dòng tiền</h3>
              </div>
              <div className="p-4 space-y-2.5">
                {filtered.filter(p=>ENRICHED[p.id]).map(p => {
                  const e = ENRICHED[p.id];
                  return (
                    <div key={p.id}
                      className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 border cursor-pointer hover:opacity-80 transition-opacity ${healthBg(e.cashflowHealth)}`}
                      onClick={() => onNavigate?.('tasks', p.id, 'qs')}>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 text-sm truncate">{p.name}</p>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
                          <span>Xuất TT: <strong>{e.billedPct}%</strong></span>
                          <span>Thu: <strong>{e.collectedPct}%</strong></span>
                          <span>Còn TT: <strong>{e.billedPct - e.collectedPct}%</strong></span>
                        </div>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${healthBg(e.cashflowHealth)} ${healthColor(e.cashflowHealth)}`}>
                        {healthLabel(e.cashflowHealth)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Billing vs Collection scatter */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-slate-700 mb-1">Xuất TT vs Thu hồi (%)</h3>
              <p className="text-[10px] text-slate-400 mb-4">Bong bóng = giá trị HĐ. Đường chéo = lý tưởng (thu=xuất)</p>
              <ResponsiveContainer width="100%" height={220}>
                <ScatterChart margin={{ top:10, right:20, bottom:10, left:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis dataKey="x" name="Xuất TT" unit="%" domain={[0,110]} tick={{ fontSize:10, fill:'#94a3b8' }} label={{ value:'Xuất TT (%)', position:'insideBottom', offset:-5, fontSize:10, fill:'#94a3b8' }}/>
                  <YAxis dataKey="y" name="Thu hồi" unit="%" domain={[0,110]} tick={{ fontSize:10, fill:'#94a3b8' }} label={{ value:'Thu (%)', angle:-90, position:'insideLeft', fontSize:10, fill:'#94a3b8' }}/>
                  <ZAxis dataKey="z" range={[100, 800]}/>
                  <ReferenceLine stroke="#10b981" strokeDasharray="4 2" segment={[{ x:0, y:0 }, { x:100, y:100 }]}/>
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs">
                        <p className="font-bold text-slate-800 mb-1">{d.name}</p>
                        <p>Xuất TT: <strong>{d.x}%</strong></p>
                        <p>Thu: <strong>{d.y}%</strong></p>
                        <p>Chênh: <strong className={d.x-d.y>10?'text-rose-600':'text-emerald-600'}>{d.x-d.y}%</strong></p>
                      </div>
                    );
                  }}/>
                  <Scatter data={cashflowScatter}>
                    {cashflowScatter.map((e, i) => <Cell key={i} fill={e.fill}/>)}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Billing table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
              <h3 className="text-sm font-bold text-slate-700">Chi tiết tài chính từng dự án</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Dự án','Giá trị HĐ (tỷ)','Đã xuất TT (%)','Đã thu (%)','Chênh lệch','CPI','Trễ (ngày)','Sức khoẻ'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left font-bold text-slate-500 uppercase tracking-wide text-[10px] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.filter(p=>ENRICHED[p.id]).map((p, i) => {
                    const e = ENRICHED[p.id];
                    const gap = e.billedPct - e.collectedPct;
                    return (
                      <tr key={p.id}
                        className={`border-b border-slate-50 hover:bg-emerald-50/40 cursor-pointer transition-colors ${i%2===0?'':'bg-slate-50/30'}`}
                        onClick={() => onNavigate?.('tasks', p.id, 'qs')}>
                        <td className="px-4 py-3 font-semibold text-slate-800">{p.name}</td>
                        <td className="px-4 py-3 font-bold text-slate-700">{e.contractValue} tỷ</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-400 rounded-full" style={{width:`${e.billedPct}%`}}/>
                            </div>
                            <span>{e.billedPct}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-400 rounded-full" style={{width:`${e.collectedPct}%`}}/>
                            </div>
                            <span>{e.collectedPct}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-bold ${gap>15?'text-rose-600':gap>5?'text-amber-600':'text-emerald-600'}`}>
                            {gap > 0 ? `+${gap}%` : `${gap}%`}
                          </span>
                        </td>
                        <td className="px-4 py-3"><span className={`font-black ${e.cpi>=1?'text-emerald-600':e.cpi>=0.9?'text-amber-600':'text-rose-600'}`}>{e.cpi.toFixed(2)}</span></td>
                        <td className="px-4 py-3"><span className={`font-bold ${e.delayDays===0?'text-emerald-600':e.delayDays<=7?'text-amber-600':'text-rose-600'}`}>{e.delayDays === 0 ? '—' : `+${e.delayDays}`}</span></td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${healthBg(e.cashflowHealth)} ${healthColor(e.cashflowHealth)}`}>
                            {healthLabel(e.cashflowHealth)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── RISK TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'risk' && (
        <div className="space-y-4">
          {/* Risk summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="Dự án rủi ro cao"  value={stats.atRisk}                           icon={<AlertTriangle size={16}/>} color={stats.atRisk>0?'rose':'emerald'}/>
            <MetricCard label="Tổng vấn đề nghiêm trọng" value={stats.criticalCount}             icon={<ShieldAlert size={16}/>}  color={stats.criticalCount>0?'rose':'emerald'}/>
            <MetricCard label="Tổng NCR đang mở"  value={stats.totalNcr}                         icon={<FileText size={16}/>}     color={stats.totalNcr>5?'rose':'amber'}/>
            <MetricCard label="Sự cố HSE"          value={stats.totalHse}                         icon={<AlertTriangle size={16}/>} color={stats.totalHse>0?'rose':'emerald'}/>
          </div>

          {/* Risk matrix per project */}
          <div className="space-y-3">
            {filtered.filter(p=>ENRICHED[p.id]).map(p => {
              const e = ENRICHED[p.id];
              const risks: { label: string; level: 'low'|'medium'|'high'; note: string }[] = [];
              if (p.spi && p.spi < 0.85) risks.push({ label: 'Trễ tiến độ nặng', level: 'high', note: `SPI = ${p.spi.toFixed(2)}` });
              else if (p.spi && p.spi < 0.95) risks.push({ label: 'Tiến độ hơi chậm', level: 'medium', note: `SPI = ${p.spi.toFixed(2)}` });
              if (e.cpi < 0.9) risks.push({ label: 'Vượt chi phí', level: 'high', note: `CPI = ${e.cpi.toFixed(2)}` });
              else if (e.cpi < 0.97) risks.push({ label: 'Chi phí cần theo dõi', level: 'medium', note: `CPI = ${e.cpi.toFixed(2)}` });
              if (p.ncr > 3) risks.push({ label: 'NCR tồn đọng', level: 'high', note: `${p.ncr} NCR mở` });
              else if (p.ncr > 0) risks.push({ label: 'Có NCR cần xử lý', level: 'medium', note: `${p.ncr} NCR mở` });
              if (p.hse > 0) risks.push({ label: 'Sự cố an toàn', level: 'high', note: `${p.hse} sự cố` });
              if (e.cashflowHealth === 'critical') risks.push({ label: 'Dòng tiền nguy hiểm', level: 'high', note: `Chênh ${e.billedPct-e.collectedPct}%` });
              else if (e.cashflowHealth === 'warning') risks.push({ label: 'Dòng tiền cảnh báo', level: 'medium', note: `Chênh ${e.billedPct-e.collectedPct}%` });
              if (e.openRfi > 5) risks.push({ label: 'RFI tồn đọng', level: 'medium', note: `${e.openRfi} RFI chưa đóng` });
              if (risks.length === 0) risks.push({ label: 'Không có rủi ro đáng kể', level: 'low', note: 'Mọi chỉ số trong ngưỡng an toàn' });

              const highCount = risks.filter(r=>r.level==='high').length;
              return (
                <div key={p.id} className={`bg-white border rounded-2xl overflow-hidden ${highCount>0?'border-rose-200':'border-slate-200'}`}>
                  <div className={`flex items-center justify-between px-5 py-3 ${highCount>1?'bg-rose-50':highCount===1?'bg-amber-50':'bg-slate-50'} border-b ${highCount>1?'border-rose-100':highCount===1?'border-amber-100':'border-slate-100'}`}>
                    <div className="flex items-center gap-2">
                      <Building2 size={14} className="text-slate-500"/>
                      <span className="font-bold text-slate-800 text-sm">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {highCount > 0 && <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-100 text-rose-600 rounded-lg">{highCount} rủi ro cao</span>}
                      <span className="text-[10px] text-slate-400">{risks.length} vấn đề</span>
                    </div>
                  </div>
                  <div className="p-4 flex flex-wrap gap-2">
                    {risks.map((r, i) => (
                      <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                        r.level === 'high' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        r.level === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {r.level === 'high' ? <AlertTriangle size={11}/> : r.level === 'medium' ? <Info size={11}/> : <CheckCircle2 size={11}/>}
                        {r.label}
                        <span className="opacity-60 font-normal text-[10px]">· {r.note}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── BENCHMARK TAB ───────────────────────────────────────────────── */}
      {activeTab === 'benchmark' && (
        <div className="space-y-5">
          {/* Industry benchmark comparison */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-700">Benchmark ngành xây dựng VN</h3>
              <span className="flex items-center gap-1 text-[10px] text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                <Info size={10}/> Nguồn: BXD 2024
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Chỉ số','Benchmark ngành','Portfolio anh Tuấn','Đánh giá'].map(h => (
                      <th key={h} className="px-5 py-2.5 text-left font-bold text-slate-500 uppercase tracking-wide text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { metric: 'SPI trung bình',            benchmark: '0.88 – 0.92', portfolio: stats.avgSpi.toFixed(2),           good: stats.avgSpi >= 0.92 },
                    { metric: 'CPI trung bình',            benchmark: '0.93 – 0.97', portfolio: stats.avgCpi.toFixed(2),           good: stats.avgCpi >= 0.95 },
                    { metric: '% dự án đúng tiến độ',      benchmark: '45 – 60%',   portfolio: `${Math.round(active.filter(p=>p.spi&&p.spi>=0.95).length/Math.max(active.length,1)*100)}%`, good: active.filter(p=>p.spi&&p.spi>=0.95).length/Math.max(active.length,1) >= 0.55 },
                    { metric: 'NCR / dự án',               benchmark: '< 3',        portfolio: (stats.totalNcr/Math.max(active.length,1)).toFixed(1), good: stats.totalNcr/Math.max(active.length,1) < 3 },
                    { metric: 'Tỷ lệ thu hồi thanh toán',  benchmark: '> 85%',      portfolio: `${Math.round(filtered.filter(p=>ENRICHED[p.id]).reduce((s,p,_,a)=>s+ENRICHED[p.id].collectedPct/a.length,0))}%`, good: filtered.filter(p=>ENRICHED[p.id]).reduce((s,p,_,a)=>s+ENRICHED[p.id].collectedPct/a.length,0) > 85 },
                    { metric: 'Sự cố HSE / dự án',         benchmark: '< 0.5',      portfolio: (stats.totalHse/Math.max(active.length,1)).toFixed(1), good: stats.totalHse/Math.max(active.length,1) < 0.5 },
                    { metric: 'Điểm an toàn TB',            benchmark: '> 85/100',   portfolio: `${Math.round(active.filter(p=>ENRICHED[p.id]).reduce((s,p,_,a)=>s+(ENRICHED[p.id]?.safetyScore||0)/a.length,0))}/100`, good: active.filter(p=>ENRICHED[p.id]).reduce((s,p,_,a)=>s+(ENRICHED[p.id]?.safetyScore||0)/a.length,0) > 85 },
                  ].map((row, i) => (
                    <tr key={i} className={`border-b border-slate-50 hover:bg-slate-50/60 ${i%2===0?'':'bg-slate-50/30'}`}>
                      <td className="px-5 py-3 font-semibold text-slate-700">{row.metric}</td>
                      <td className="px-5 py-3 text-slate-500">{row.benchmark}</td>
                      <td className="px-5 py-3 font-black text-slate-800">{row.portfolio}</td>
                      <td className="px-5 py-3">
                        <span className={`flex items-center gap-1.5 text-[11px] font-bold ${row.good ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {row.good ? <><CheckCircle2 size={12}/> Tốt hơn ngành</> : <><AlertTriangle size={12}/> Cần cải thiện</>}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recommendation box */}
          <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-violet-600"/>
              <span className="text-sm font-bold text-violet-800">GEM nhận xét portfolio</span>
            </div>
            <div className="space-y-2 text-xs text-violet-700">
              {stats.atRisk > 0 && (
                <div className="flex items-start gap-2">
                  <AlertTriangle size={12} className="text-rose-500 shrink-0 mt-0.5"/>
                  <span><strong>{stats.atRisk} dự án</strong> có SPI &lt; 0.85 — cần họp đánh giá tiến độ khẩn ngay tuần này.</span>
                </div>
              )}
              {stats.avgCpi < 0.95 && (
                <div className="flex items-start gap-2">
                  <TrendingDown size={12} className="text-amber-500 shrink-0 mt-0.5"/>
                  <span>CPI trung bình <strong>{stats.avgCpi.toFixed(2)}</strong> — chi phí đang vượt kế hoạch, rà soát khối lượng phát sinh.</span>
                </div>
              )}
              {stats.totalNcr > 0 && (
                <div className="flex items-start gap-2">
                  <FileText size={12} className="text-amber-500 shrink-0 mt-0.5"/>
                  <span>Còn <strong>{stats.totalNcr} NCR</strong> chưa đóng — ảnh hưởng tiến độ nghiệm thu và thanh toán.</span>
                </div>
              )}
              {stats.avgSpi >= 0.95 && stats.avgCpi >= 0.97 && stats.totalHse === 0 && (
                <div className="flex items-start gap-2">
                  <CheckCircle2 size={12} className="text-emerald-500 shrink-0 mt-0.5"/>
                  <span>Portfolio đang vận hành tốt — tiếp tục duy trì và cập nhật KPI hàng tuần.</span>
                </div>
              )}
              <div className="flex items-start gap-2 pt-1 border-t border-violet-200">
                <Award size={12} className="text-violet-500 shrink-0 mt-0.5"/>
                <span>Tổng giá trị portfolio <strong>{fmt(stats.totalBudget)}</strong> với <strong>{active.length} dự án đang chạy</strong> và <strong>{done.length} đã hoàn thành</strong>.</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
