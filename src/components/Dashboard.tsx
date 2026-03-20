import React, { useState, useEffect, useRef } from 'react';
import { genAI, GEM_MODEL } from './gemini';
import {
  AlertTriangle, TrendingUp, TrendingDown, DollarSign, Users,
  HardHat, ShieldAlert, Clock, ArrowRight, CheckCircle2,
  Sparkles, RefreshCw, Building2, Target,
  CreditCard, Wrench, ChevronRight,
  Activity, Loader2, XCircle, Package,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import PortfolioAnalytics from './PortfolioAnalytics';

// ── Gemini init ───────────────────────────────────────────────────────────────

// ── Live data types ────────────────────────────────────────────────────────────
interface RiskItem {
  id: string; icon: React.ElementType; color: string; label: string;
  value: number; unit: string; urgent: boolean;
  projectId: string; projectName: string; subTab: string;
}
interface ActionTask {
  id: number; title: string; project: string; projectId: string;
  subTab: string; deadline: string; type: 'urgent'|'today'|'week'; source: string;
}

// ── Style maps ────────────────────────────────────────────────────────────────
const C_BOX: Record<string,string> = {
  emerald:'bg-emerald-50 text-emerald-600 border-emerald-200',
  blue:   'bg-blue-50 text-blue-600 border-blue-200',
  indigo: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  rose:   'bg-rose-50 text-rose-600 border-rose-200',
  amber:  'bg-amber-50 text-amber-600 border-amber-200',
  orange: 'bg-orange-50 text-orange-600 border-orange-200',
  violet: 'bg-violet-50 text-violet-600 border-violet-200',
};
const C_TEXT: Record<string,string> = {
  emerald:'text-emerald-600', blue:'text-blue-600', indigo:'text-indigo-600',
  rose:'text-rose-600', amber:'text-amber-600', orange:'text-orange-600', violet:'text-violet-600',
};

function getCountdown(deadline: string) {
  const now = new Date();
  const parts = deadline.split(':').map(Number);
  if (parts.length < 2 || isNaN(parts[0])) return null;
  const target = new Date(now); target.setHours(parts[0], parts[1], 0, 0);
  const diff = target.getTime() - now.getTime();
  if (diff < 0) return 'Đã qua';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h === 0 ? `${m}p` : `${h}g${m}p`;
}

function Card({ children, className='', onClick }: { children: React.ReactNode; className?: string; onClick?: ()=>void }) {
  return (
    <div onClick={onClick}
      className={`relative bg-white border border-slate-200 rounded-2xl overflow-hidden
        ${onClick ? 'cursor-pointer hover:border-slate-300 hover:shadow-md' : ''}
        transition-all duration-200 ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/[0.02] to-transparent pointer-events-none"/>
      {children}
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-slate-100"/>
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      <div className="h-px flex-1 bg-slate-100"/>
    </div>
  );
}

// ══ MAIN ══════════════════════════════════════════════════════════════════════
export default function Dashboard({ onNavigate, projects = [] }: {
  projects?: any[];
  onNavigate: (tab: string, projectId?: string, subTab?: string) => void
}) {
  const [isMounted, setIsMounted]       = useState(false);
  const [briefing, setBriefing]         = useState('');
  const [loadingAI, setLoadingAI]       = useState(false);
  const [briefTime, setBriefTime]       = useState('');
  const [taskFilter, setTaskFilter]     = useState<'urgent'|'today'|'week'>('urgent');
  const [riskItems, setRiskItems]       = useState<RiskItem[]>([]);
  const [actionTasks, setActionTasks]   = useState<ActionTask[]>([]);
  const [kpiLive, setKpiLive]           = useState<{label:string;value:string;sub:string;icon:React.ElementType;color:string;trend:'up'|'down'|'flat'}[]>([]);
  const loaded = useRef(false);

  useEffect(() => { setIsMounted(true); }, []);

  // ── Load live data từ projects prop (đã fetch từ Supabase ở App.tsx) ─────────
  useEffect(() => {
    if (!projects || projects.length === 0) return;
    const activeProjects = projects.filter((p: any) => p.type === 'in_progress');

    // ── KPI cards: tổng hợp từ tất cả project ─────────────────────────────
    const totalNcr     = activeProjects.reduce((s: number, p: any) => s + (p.ncr || 0), 0);
    const totalHse     = activeProjects.reduce((s: number, p: any) => s + (p.hse || 0), 0);
    const totalNtp     = activeProjects.reduce((s: number, p: any) => s + (p.ntp_pending || 0), 0);
    const totalPeople  = activeProjects.reduce((s: number, p: any) => s + (p.manpower || 0), 0);
    const avgHseScore  = activeProjects.length
      ? (activeProjects.reduce((s: number, p: any) => s + (p.hse_score || 96), 0) / activeProjects.length).toFixed(1)
      : '—';

    setKpiLive([
      { label:'Dự án đang chạy',     value: String(activeProjects.length),  sub:`+${projects.filter((p:any)=>p.type==='planning').length} tiềm năng`, icon:HardHat,    color:'emerald', trend:'up'   },
      { label:'Giải ngân tháng này', value:'—',                             sub:'Xem tab Kế toán',   icon:DollarSign, color:'blue',    trend:'flat' },
      { label:'Nhân sự công trường', value: totalPeople > 0 ? String(totalPeople) : '—', sub:'Cập nhật hôm nay', icon:Users, color:'indigo', trend:'flat' },
      { label:'Tổng NCR mở',         value: String(totalNcr),               sub: totalNcr > 0 ? '⚠️ Cần xử lý' : '✅ Không có', icon:XCircle,    color: totalNcr>0 ? 'rose':'emerald',  trend: totalNcr>0 ? 'down':'up' },
      { label:'HSE Score TB',         value: `${avgHseScore}%`,             sub:'Mục tiêu: 98%',     icon:ShieldAlert,color:'amber',   trend:'flat' },
      { label:'NTP chờ thanh toán',  value: `${totalNtp} HĐ`,              sub: totalNtp>0 ? '⚠️ Cần duyệt' : '✅ Đã xử lý', icon:CreditCard, color: totalNtp>0 ? 'orange':'emerald', trend: totalNtp>0 ? 'down':'up' },
    ]);

    // ── Risk Radar: tìm project có vấn đề nhiều nhất cho mỗi loại ─────────
    const mostNcr  = [...activeProjects].sort((a:any,b:any)=>(b.ncr||0)-(a.ncr||0))[0];
    const mostNtp  = [...activeProjects].sort((a:any,b:any)=>(b.ntp_pending||0)-(a.ntp_pending||0))[0];
    const mostHse  = [...activeProjects].sort((a:any,b:any)=>(b.hse||0)-(a.hse||0))[0];
    const slowest  = [...activeProjects].sort((a:any,b:any)=>(a.spi||1)-(b.spi||1))[0];

    const risks: RiskItem[] = [];
    if (mostNcr?.ncr > 0)        risks.push({ id:'r1', icon:XCircle,     color:'rose',   label:'NCR đang mở',            value:mostNcr.ncr,         unit:'phiếu', urgent:true,  projectId:mostNcr.id,  projectName:mostNcr.name,  subTab:'qa-qc'    });
    if (mostNtp?.ntp_pending > 0) risks.push({ id:'r2', icon:CreditCard,  color:'amber',  label:'NTP chưa thanh toán',    value:mostNtp.ntp_pending, unit:'HĐ',    urgent:true,  projectId:mostNtp.id,  projectName:mostNtp.name,  subTab:'qs'       });
    if (mostHse?.hse > 0)         risks.push({ id:'r3', icon:ShieldAlert, color:'rose',   label:'Vi phạm HSE chưa xử lý', value:mostHse.hse,         unit:'ca',    urgent:true,  projectId:mostHse.id,  projectName:mostHse.name,  subTab:'hse'      });
    if (slowest && (slowest.spi||1) < 0.95) risks.push({ id:'r6', icon:Clock, color:'violet', label:`Tiến độ chậm (SPI=${(slowest.spi||1).toFixed(2)})`, value: Math.round((1-(slowest.spi||1))*100), unit:'%', urgent:(slowest.spi||1)<0.85, projectId:slowest.id, projectName:slowest.name, subTab:'progress' });
    // Thiết bị & vật tư — link đến project đầu tiên nếu không có field riêng
    if (activeProjects[0]) {
      risks.push({ id:'r4', icon:Wrench,  color:'orange', label:'Thiết bị — kiểm tra hạn BH', value:0, unit:'máy', urgent:false, projectId:activeProjects[0].id, projectName:activeProjects[0].name, subTab:'equipment' });
      risks.push({ id:'r5', icon:Package, color:'blue',   label:'Vật tư — kiểm tra tồn kho',  value:0, unit:'loại',urgent:false, projectId:activeProjects[0].id, projectName:activeProjects[0].name, subTab:'resources'  });
    }
    setRiskItems(risks);

    // ── Action tasks: tạo từ data thật ────────────────────────────────────
    const tasks: ActionTask[] = [];
    let taskId = 1;
    activeProjects.forEach((p: any) => {
      if ((p.ncr||0) > 0)        tasks.push({ id:taskId++, title:`Xử lý ${p.ncr} NCR tại ${p.name}`,           project:p.name, projectId:p.id, subTab:'qa-qc',    deadline:'urgent', type:'urgent', source:'ai'     });
      if ((p.hse||0) > 0)        tasks.push({ id:taskId++, title:`Xử lý vi phạm HSE tại ${p.name}`,            project:p.name, projectId:p.id, subTab:'hse',      deadline:'urgent', type:'urgent', source:'ai'     });
      if ((p.ntp_pending||0) > 0) tasks.push({ id:taskId++, title:`Duyệt ${p.ntp_pending} HĐ NTP tại ${p.name}`,project:p.name, projectId:p.id, subTab:'qs',       deadline:'today',  type:'today',  source:'manual' });
      if ((p.spi||1) < 0.85)     tasks.push({ id:taskId++, title:`Cập nhật tiến độ ${p.name} (SPI thấp)`,      project:p.name, projectId:p.id, subTab:'progress', deadline:'today',  type:'today',  source:'ai'     });
    });
    // Fallback nếu không có gì urgent
    if (tasks.length === 0 && activeProjects[0]) {
      tasks.push({ id:1, title:'Kiểm tra tiến độ tổng hợp', project:'Tất cả DA', projectId:activeProjects[0].id, subTab:'progress', deadline:'today', type:'today', source:'manual' });
    }
    setActionTasks(tasks);
  }, [projects]);

  const loadBriefing = async () => {
    setLoadingAI(true);
    const now = new Date();
    try {
      const model = genAI.getGenerativeModel({
        model: GEM_MODEL,
        systemInstruction: `Bạn là GEM. Xưng "em", gọi "Anh/Chị". Giọng nữ miền Nam, ngắn gọn, thực chiến. 
Tóm tắt buổi sáng trong 3-4 câu ngắn: nêu điểm nóng khẩn cấp nhất, rủi ro tài chính/tiến độ đáng lo, và 1 lời khuyên cụ thể. 
KHÔNG dùng ký tự markdown. Câu ngắn. Số liệu cụ thể.`,
        generationConfig: { maxOutputTokens: 512, temperature: 0.25 },
      });
      // Build context từ data thật
      const activeP = (projects||[]).filter((p:any)=>p.type==='in_progress');
      const projSummary = activeP.map((p:any) =>
        `${p.name} ${p.progress||0}% SPI=${(p.spi||1).toFixed(2)}${p.ncr>0?` (${p.ncr} NCR)`:''}${p.hse>0?` (${p.hse} HSE)`:''}${p.ntp_pending>0?` (${p.ntp_pending} NTP chờ TT)`:''}`
      ).join(', ') || 'Không có dự án đang thi công';
      const totalNcr = activeP.reduce((s:number,p:any)=>s+(p.ncr||0),0);
      const totalNtp = activeP.reduce((s:number,p:any)=>s+(p.ntp_pending||0),0);
      const slowest  = [...activeP].sort((a:any,b:any)=>(a.spi||1)-(b.spi||1))[0];
      const ctx = `Hôm nay ${now.toLocaleDateString('vi-VN',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'})}. 
Portfolio: ${projSummary}. 
Tổng: ${activeP.length} dự án đang chạy, ${totalNcr} NCR mở, ${totalNtp} HĐ NTP chờ thanh toán.
${slowest && (slowest.spi||1)<0.9 ? `Dự án chậm nhất: ${slowest.name} SPI=${(slowest.spi||1).toFixed(2)}.` : ''}`;
      const res = await model.generateContent(`Briefing sáng: ${ctx}`);
      setBriefing(res.response.text());
      setBriefTime(now.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}));
    } catch {
      setBriefing('Dạ em xin lỗi, kết nối GEM đang gián đoạn. Anh kiểm tra VITE_GEMINI_API_KEY nghen!');
      setBriefTime(now.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}));
    }
    setLoadingAI(false);
  };

  useEffect(() => {
    if (!loaded.current) { loaded.current = true; loadBriefing(); }
  }, []);

  const filtered = actionTasks.filter(t => t.type === taskFilter);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-100 space-y-6 pb-10"
      >

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between pt-1">
        <div>
          <p className="text-[10px] font-bold tracking-wider uppercase text-slate-500 mb-1">
            {new Date().toLocaleDateString('vi-VN',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'})}
          </p>
          <h1 className="text-xl md:text-2xl font-bold font-heading text-slate-800 leading-tight">
            Command Center
            <span className="ml-3 align-middle text-[10px] font-bold tracking-wider text-emerald-600
              bg-emerald-400/10 border border-emerald-200 px-2 py-0.5 rounded-full uppercase">
              ● LIVE
            </span>
          </h1>
        </div>
        <p className="text-[10px] text-slate-500 hidden md:block">
          3 dự án · 458 nhân sự · {new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}
        </p>
      </div>

      {/* ══ ZONE 1 — GEM BRIEFING ════════════════════════════════════════════ */}
      <div className="relative rounded-2xl overflow-hidden shadow-lg"
        style={{ background: 'linear-gradient(135deg, #0f4f47 0%, #1a8a7a 50%, #8b4513 100%)' }}>
        {/* subtle pattern */}
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: 'repeating-linear-gradient(45deg, #fff 0px, #fff 1px, transparent 1px, transparent 20px)' }}/>
        <div className="relative p-4 md:p-5">
          {/* Header row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(255,255,255,0.15)' }}>
                <Sparkles size={16} className="text-white"/>
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-white/90">
                  GEM · Briefing Sáng
                </p>
                {briefTime && (
                  <p className="text-[10px] text-white/50">Phân tích lúc {briefTime}</p>
                )}
              </div>
            </div>
            <button onClick={loadBriefing} disabled={loadingAI}
              className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg
                transition-all disabled:opacity-50"
              style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.25)' }}>
              {loadingAI
                ? <Loader2 size={10} className="animate-spin"/>
                : <RefreshCw size={10}/>}
              {loadingAI ? 'Đang phân tích...' : 'Làm mới'}
            </button>
          </div>

          {/* Content */}
          {loadingAI ? (
            <div className="space-y-2 py-1">
              {[85, 65, 75].map(w => (
                <div key={w} className="h-3 rounded animate-pulse"
                  style={{ width: `${w}%`, background: 'rgba(255,255,255,0.15)' }}/>
              ))}
            </div>
          ) : briefing ? (
            <p className="text-sm md:text-[15px] leading-relaxed font-medium"
              style={{ color: 'rgba(255,255,255,0.95)' }}>
              {briefing}
            </p>
          ) : (
            <p className="text-sm italic" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Nhấn "Làm mới" để GEM phân tích tình hình dự án nghen anh...
            </p>
          )}
        </div>
      </div>

      {/* ══ ZONE 2 — KPI CARDS ═══════════════════════════════════════════════ */}
      <div>
        <Divider label="Chỉ số tổng hợp portfolio"/>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
          {kpiLive.map(kpi => {
            const Icon = kpi.icon;
            return (
              <Card key={kpi.label} className="p-3.5">
                <div className={`w-7 h-7 rounded-lg border flex items-center justify-center mb-3 ${C_BOX[kpi.color]}`}>
                  <Icon size={13}/>
                </div>
                <div className="text-xl font-bold font-heading text-slate-800 leading-tight mb-1">{kpi.value}</div>
                <div className="text-[10px] text-slate-500 leading-tight mb-2">{kpi.label}</div>
                <div className={`text-[10px] font-bold flex items-center gap-1 ${
                  kpi.trend==='up' ? 'text-emerald-600' : kpi.trend==='down' ? 'text-rose-600' : 'text-slate-500'
                }`}>
                  {kpi.trend==='up' && <TrendingUp size={8}/>}
                  {kpi.trend==='down' && <TrendingDown size={8}/>}
                  {kpi.sub}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ══ ZONE 3 — PROJECT PULSE ═══════════════════════════════════════════ */}
      <div>
        <Divider label="Pulse từng dự án — click để vào"/>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {(projects || []).filter((p:any) => p.type === 'in_progress').map((proj:any) => {
            const spi = proj.spi ?? 1;
            const sc = spi >= 0.95 ? 'emerald' : spi >= 0.85 ? 'amber' : 'rose';
            const pct = proj.progress || 0;
            return (
              <Card key={proj.id}
                onClick={() => onNavigate('tasks', proj.id, 'progress')}
                className={`p-4 border-2 ${
                  sc==='rose'  ? 'border-rose-300 hover:border-rose-400/60' :
                  sc==='amber' ? 'border-amber-200 hover:border-amber-300' :
                                 'border-slate-200 hover:border-emerald-300'
                }`}>

                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      {proj.type==='in_progress'
                        ? <Building2 size={11} className={C_TEXT[sc]}/>
                        : <Target size={11} className="text-slate-500"/>}
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {proj.type==='in_progress' ? 'Đang thi công' : 'Tiềm năng'}
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm truncate">{proj.name}</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">{proj.status}</p>
                  </div>
                  <div className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border shrink-0 ml-2 ${C_BOX[sc]}`}>
                    SPI {spi.toFixed(2)}
                  </div>
                </div>

                {/* Progress */}
                <div className="mb-3">
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-slate-500">Tiến độ</span>
                    <span className="font-bold text-slate-900">{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${
                      sc==='rose'?'bg-rose-500':sc==='amber'?'bg-amber-400':'bg-emerald-400'
                    }`} style={{width:`${pct}%`}}/>
                  </div>
                </div>

                {/* Badges */}
                <div className="flex gap-1.5 flex-wrap min-h-[22px]">
                  {proj.ncr > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-bold
                      bg-rose-50 text-rose-600 border border-rose-200 px-1.5 py-0.5 rounded-md"
                      onClick={e=>{e.stopPropagation();onNavigate('tasks',proj.id,'qa-qc');}}>
                      <XCircle size={8}/>{proj.ncr} NCR
                    </span>
                  )}
                  {proj.hse > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-bold
                      bg-rose-50 text-rose-600 border border-rose-200 px-1.5 py-0.5 rounded-md"
                      onClick={e=>{e.stopPropagation();onNavigate('tasks',proj.id,'hse');}}>
                      <ShieldAlert size={8}/>{proj.hse} HSE
                    </span>
                  )}
                  {proj.ntp_pending > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-bold
                      bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded-md"
                      onClick={e=>{e.stopPropagation();onNavigate('tasks',proj.id,'qs');}}>
                      <CreditCard size={8}/>{proj.ntp_pending} TT chờ
                    </span>
                  )}
                  {proj.ncr===0 && proj.hse===0 && proj.ntp_pending===0 && (
                    <span className="flex items-center gap-1 text-[10px] font-bold
                      bg-emerald-50 text-emerald-600 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                      <CheckCircle2 size={8}/>Không cảnh báo
                    </span>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-[10px] text-slate-500 font-sans">{proj.budget}</span>
                  <span className="text-[10px] text-slate-500 flex items-center gap-0.5 group-hover:text-emerald-600">
                    Chi tiết <ChevronRight size={10}/>
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ══ ZONE 4 — ACTION CENTER ════════════════════════════════════════════ */}
      <div>
        <Divider label="Action center — việc cần xử lý"/>
        <Card className="mt-4">
          {/* Filter bar */}
          <div className="flex border-b border-slate-100">
            {([
              {key:'urgent',label:'🔴 Khẩn cấp', count:actionTasks.filter(t=>t.type==='urgent').length},
              {key:'today', label:'🟡 Hôm nay',  count:actionTasks.filter(t=>t.type==='today').length},
              {key:'week',  label:'📋 Tuần này', count:actionTasks.filter(t=>t.type==='week').length},
            ] as const).map(tab => (
              <button key={tab.key} onClick={()=>setTaskFilter(tab.key)}
                className={`flex-1 py-3 text-[11px] font-bold transition-all border-b-2 ${
                  taskFilter===tab.key
                    ? 'text-slate-900 border-emerald-400 bg-emerald-50'
                    : 'text-slate-500 border-transparent hover:text-slate-500'
                }`}>
                {tab.label}
                <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                  taskFilter===tab.key ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                }`}>{tab.count}</span>
              </button>
            ))}
          </div>

          {/* Tasks */}
          <div className="divide-y divide-slate-800/50">
            {filtered.map(task => {
              const countdown = getCountdown(task.deadline);
              return (
                <div key={task.id}
                  onClick={()=>task.projectId && onNavigate('tasks',task.projectId,task.subTab)}
                  className={`flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50/80 transition-colors
                    ${task.projectId ? 'cursor-pointer' : ''}`}>
                  {/* Source dot */}
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    task.source==='ai' ? 'bg-emerald-400' :
                    task.source==='calendar' ? 'bg-blue-400' : 'bg-slate-600'
                  }`}/>
                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-400 truncate"
                        >
                        {task.title}
                      </span>
                      {task.source==='ai' && (
                        <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600
                          border border-emerald-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shrink-0">
                          <Sparkles size={7}/>AI
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">{task.project}</p>
                  </div>
                  {/* Countdown */}
                  <div className={`text-xs font-bold tabular-nums shrink-0 ${
                    countdown==='Đã qua' ? 'text-slate-400' :
                    task.type==='urgent' ? 'text-rose-600' : 'text-slate-500'
                  }`}>
                    {countdown ?? task.deadline}
                  </div>
                  <ChevronRight size={11} className="text-slate-400 shrink-0"/>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="px-4 py-2.5 border-t border-slate-100 flex gap-5 text-[10px] text-slate-400">
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"/>Nàng GEM gợi ý</span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block"/>Lịch công trường</span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-600 inline-block"/>Thủ công</span>
          </div>
        </Card>
      </div>

      {/* ══ ZONE 5 — CASHFLOW + RISK RADAR ══════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* 5A Cashflow */}
        <div className="lg:col-span-3">
          <Divider label="Dòng tiền portfolio — 7 tháng"/>
          <Card className="p-4 md:p-5 mt-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-4 text-[10px]">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"/>Thu
                </span>
                <span className="flex items-center gap-1.5 text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-rose-400 inline-block"/>Chi
                </span>
                <span className="flex items-center gap-1.5 text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-blue-400 inline-block"/>Tồn
                </span>
              </div>
              <button onClick={()=>onNavigate('tasks',undefined,'resources')}
                className="text-[10px] text-slate-500 hover:text-emerald-600 flex items-center gap-1 transition-colors">
                Chi tiết <ArrowRight size={10}/>
              </button>
            </div>

            <div className="h-48 md:h-52 min-w-0">
              {isMounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={[]} margin={{top:5,right:5,left:-22,bottom:0}}>
                    <defs>
                      <linearGradient id="gThu" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#10b981" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="gChi" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#f43f5e" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#f87171" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
                    <XAxis dataKey="month" axisLine={false} tickLine={false}
                      tick={{fill:'#475569',fontSize:10,fontFamily:'Inter,sans-serif'}}/>
                    <YAxis axisLine={false} tickLine={false}
                      tick={{fill:'#475569',fontSize:10,fontFamily:'Inter,sans-serif'}}/>
                    <Tooltip contentStyle={{
                      background:'#ffffff',border:'1px solid #e2e8f0',
                      borderRadius:'10px',fontSize:'11px',color:'#94a3b8'
                    }}
                      formatter={(v:any,n:string)=>[`${v} Tỷ`, n==='thu'?'Thu':n==='chi'?'Chi':'Tồn']}/>
                    <Area type="monotone" dataKey="thu" stroke="#10b981" strokeWidth={2} fill="url(#gThu)"/>
                    <Area type="monotone" dataKey="chi" stroke="#f43f5e" strokeWidth={2} fill="url(#gChi)"/>
                    <Area type="monotone" dataKey="ton" stroke="#3b82f6" strokeWidth={1.5} fill="none" strokeDasharray="4 2"/>
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-3 text-center">
              {[
                {l:'Tổng thu T3', v:'68.9 Tỷ', c:'text-emerald-600'},
                {l:'Tổng chi T3', v:'61.2 Tỷ', c:'text-rose-600'},
                {l:'Tồn cuối kỳ', v:'7.7 Tỷ',  c:'text-blue-600'},
              ].map(s=>(
                <div key={s.l}>
                  <div className={`text-sm font-bold ${s.c}`}>{s.v}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{s.l}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* 5B Risk Radar */}
        <div className="lg:col-span-2">
          <Divider label="Radar nguy cơ"/>
          <Card className="mt-4 divide-y divide-slate-800/50 flex flex-col">
            {riskItems.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-400 text-sm">
                <CheckCircle2 size={24} className="mx-auto mb-2 text-emerald-400"/>
                Không có nguy cơ nào — portfolio đang ổn định 👍
              </div>
            ) : riskItems.map(item => {
              const Icon = item.icon;
              return (
                <div key={item.id}
                  onClick={()=>item.projectId && onNavigate('tasks',item.projectId,item.subTab)}
                  className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50/80 transition-colors
                    ${item.projectId?'cursor-pointer':''}`}>
                  <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${C_BOX[item.color]}`}>
                    <Icon size={12}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate">{item.label}</p>
                    <p className="text-[10px] text-slate-400 truncate">{item.projectName}</p>
                  </div>
                  <div className="flex items-baseline gap-1 shrink-0">
                    <span className={`text-base font-bold ${C_TEXT[item.color]}`}>{item.value > 0 ? item.value : '—'}</span>
                    <span className="text-[10px] text-slate-400">{item.unit}</span>
                  </div>
                  {item.urgent && (
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shrink-0"/>
                  )}
                </div>
              );
            })}

            {/* GEM insight footer */}
            <div className="px-4 py-3 bg-emerald-50 mt-auto">
              <div className="flex items-start gap-2">
                <Sparkles size={10} className="text-emerald-600 shrink-0 mt-0.5"/>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  <span className="text-emerald-600 font-bold">GEM: </span>
                  {riskItems.filter(r=>r.urgent).length === 0
                    ? 'Portfolio đang ổn định nghen anh! Em không thấy nguy cơ khẩn cấp nào cả 🎉'
                    : `Có ${riskItems.filter(r=>r.urgent).length} nguy cơ khẩn cấp cần xử lý. Click vào từng dòng để vào đúng module nghen anh!`
                  }
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* ══ ZONE 6 — PORTFOLIO ANALYTICS ════════════════════════════════════ */}
      <div>
        <Divider label="Portfolio Analytics — So sánh KPI toàn danh mục"/>
        <div className="mt-4">
          <PortfolioAnalytics projects={projects as any} onNavigate={onNavigate} />
        </div>
      </div>

    </div>
  );
}
