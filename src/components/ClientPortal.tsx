/**
 * ClientPortal.tsx — GEM & CLAUDE PM Pro
 * Portal dành riêng cho Chủ đầu tư (CĐT) — read-only
 * S16 — Dashboard tiến độ/tài chính, báo cáo tự động hàng tuần
 * RLS: chỉ xem, không thể edit bất kỳ data nào
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { db } from './db';
import {
  TrendingUp, DollarSign, Shield, FileText, BarChart2,
  CheckCircle2, AlertTriangle, Clock, LogOut, Bell,
  Download, Calendar, ChevronRight, Eye, Building2,
  Activity, Sparkles, User,
} from 'lucide-react';
import { genAI, GEM_MODEL_QUALITY } from './gemini';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from 'recharts';

type ClientTab = 'dashboard' | 'progress' | 'finance' | 'reports';

const SCURVE_DATA = [
  { week:'T1', plan:2.1, actual:2.0 }, { week:'T2', plan:4.5, actual:4.3 },
  { week:'T3', plan:7.2, actual:6.8 }, { week:'T4', plan:10.4, actual:9.5 },
  { week:'T5', plan:14.0, actual:12.2 }, { week:'T6', plan:18.2, actual:15.1 },
  { week:'T7', plan:22.8, actual:18.0 }, { week:'T8', plan:27.5, actual:20.5 },
];

const PAYMENT_DATA = [
  { month:'T1', giai_ngan:4.2, ke_hoach:4.5 },
  { month:'T2', giai_ngan:3.8, ke_hoach:4.5 },
  { month:'T3', giai_ngan:5.1, ke_hoach:5.0 },
];

const WEEKLY_REPORTS = [
  { id:'w9', week:'Tuần 9 (03-09/03/2026)', spi:0.745, cpi:0.730, highlights:'Hoàn thành đào đất Zone 2. Bắt đầu đổ bê tông đài M5-M8.', issues:'Máy bơm bê tông hỏng 1 ngày — đã khắc phục.', generated_at:'09/03/2026' },
  { id:'w8', week:'Tuần 8 (24/02-02/03/2026)', spi:0.780, cpi:0.755, highlights:'Nghiệm thu cọc khoan nhồi đạt 100%. Khởi công đài móng.', issues:'Không có sự cố đáng kể.', generated_at:'02/03/2026' },
];

export default function ClientPortal() {
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState<ClientTab>('dashboard');
  const [gemLoading, setGemLoading] = useState(false);
  const [gemReport, setGemReport] = useState('');
  const [notifications] = useState([
    { id:'n1', msg:'Báo cáo tuần 9 đã sẵn sàng — SPI 0.745, CPI 0.730', time:'09/03/2026', unread:true },
    { id:'n2', msg:'Đã nghiệm thu hoàn thành cọc khoan nhồi (45 cọc)', time:'28/02/2026', unread:false },
  ]);
  const unreadCount = notifications.filter(n => n.unread).length;

  const projectId = localStorage.getItem('gem_last_project') || 'p1';

  // Read-only KPIs (no write access)
  const kpis = {
    totalContract: 45.0,    // tỷ VNĐ
    disbursed:     13.1,
    remaining:     31.9,
    progressPct:   45.6,
    spi:           0.745,
    cpi:           0.730,
    daysRemaining: 37,
    openRisks:     3,
  };

  const generateWeeklyReport = async () => {
    setGemLoading(true); setGemReport('');
    try {
      const model = genAI.getGenerativeModel({ model: GEM_MODEL_QUALITY });
      const r = await model.generateContent(
        `Tạo báo cáo tiến độ tuần cho Chủ đầu tư dự án Villa PAT:\n` +
        `- SPI = ${kpis.spi} (Tiến độ đạt ${(kpis.spi*100).toFixed(0)}% kế hoạch)\n` +
        `- CPI = ${kpis.cpi} (Hiệu quả chi phí ${(kpis.cpi*100).toFixed(0)}%)\n` +
        `- Tổng giải ngân: ${kpis.disbursed}/${kpis.totalContract} tỷ (${((kpis.disbursed/kpis.totalContract)*100).toFixed(1)}%)\n` +
        `- Tiến độ hoàn thành tổng thể: ${kpis.progressPct}%\n` +
        `- Còn ${kpis.daysRemaining} ngày đến mốc tiến độ kế tiếp\n` +
        `Viết báo cáo ngắn gọn cho CĐT (không phải kỹ thuật): tình trạng, điểm nổi bật, rủi ro cần biết, và dự báo. Tiếng Việt.`
      );
      setGemReport(r.response.text());
    } catch { setGemReport('❌ Không tạo được báo cáo. Vui lòng thử lại.'); }
    setGemLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0">
            <Eye size={18} className="text-white"/>
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-800">CĐT Portal</h1>
            <p className="text-[10px] text-blue-600 font-semibold">GEM & CLAUDE PM Pro · Chỉ xem</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button className="p-2 hover:bg-slate-100 rounded-xl relative">
              <Bell size={16} className="text-slate-500"/>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-rose-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full">{unreadCount}</span>
              )}
            </button>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <User size={14}/>
            <span className="font-semibold">{user?.full_name || 'Chủ đầu tư'}</span>
          </div>
          <button onClick={signOut} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-xl">
            <LogOut size={13}/> Đăng xuất
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* Project badge */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-2xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold opacity-75">Dự án theo dõi</p>
            <p className="text-lg font-black mt-0.5">Villa PAT — TP. HCM 2026</p>
            <p className="text-xs opacity-75 mt-0.5">Giá trị HĐ: {kpis.totalContract} tỷ VNĐ · Tiến độ: {kpis.progressPct}%</p>
          </div>
          <Building2 size={32} className="opacity-40"/>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1.5 bg-white border border-slate-200 rounded-2xl p-2">
          {([
            ['dashboard','Dashboard', BarChart2],
            ['progress','Tiến độ', TrendingUp],
            ['finance','Tài chính', DollarSign],
            ['reports','Báo cáo', FileText],
          ] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                tab === id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}>
              <Icon size={13}/>{label}
            </button>
          ))}
        </div>

        {/* ── DASHBOARD ──────────────────────────────────────────────────── */}
        {tab === 'dashboard' && (
          <div className="space-y-4">
            {/* KPI grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label:'SPI',                 val:kpis.spi.toFixed(3),                           cls: kpis.spi >= 0.95 ? 'bg-emerald-50 text-emerald-700' : kpis.spi >= 0.85 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700', sub:'Chỉ số tiến độ' },
                { label:'CPI',                 val:kpis.cpi.toFixed(3),                           cls: kpis.cpi >= 0.95 ? 'bg-emerald-50 text-emerald-700' : kpis.cpi >= 0.85 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700', sub:'Chỉ số chi phí' },
                { label:'Giải ngân',           val:`${kpis.disbursed}/${kpis.totalContract} tỷ`, cls:'bg-blue-50 text-blue-700', sub:`${((kpis.disbursed/kpis.totalContract)*100).toFixed(0)}% tổng HĐ` },
                { label:'Mốc tiến độ kế tiếp', val:`${kpis.daysRemaining} ngày`,                 cls: kpis.daysRemaining < 14 ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-700', sub:'Hoàn thành tầng hầm' },
              ].map(k => (
                <div key={k.label} className={`${k.cls} rounded-2xl px-4 py-3`}>
                  <p className="text-[10px] font-semibold opacity-70 uppercase tracking-wide">{k.label}</p>
                  <p className="text-xl font-black mt-0.5">{k.val}</p>
                  <p className="text-[10px] opacity-60 mt-0.5">{k.sub}</p>
                </div>
              ))}
            </div>

            {/* S-Curve preview */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2"><TrendingUp size={14} className="text-blue-600"/>S-Curve Tiến độ</h3>
                <button onClick={() => setTab('progress')} className="text-xs text-blue-600 font-semibold flex items-center gap-1 hover:underline">
                  Chi tiết <ChevronRight size={12}/>
                </button>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={SCURVE_DATA}>
                  <defs>
                    <linearGradient id="planGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis dataKey="week" tick={{fontSize:11}} tickLine={false} axisLine={false}/>
                  <YAxis tick={{fontSize:11}} tickLine={false} axisLine={false} tickFormatter={v=>`${v}tỷ`} width={40}/>
                  <Tooltip formatter={(v:number, name:string) => [`${v.toFixed(1)} tỷ`, name === 'plan' ? 'Kế hoạch' : 'Thực tế']}/>
                  <Area type="monotone" dataKey="plan" stroke="#3b82f6" strokeWidth={2} fill="url(#planGrad)" name="plan"/>
                  <Area type="monotone" dataKey="actual" stroke="#10b981" strokeWidth={2.5} fill="url(#actualGrad)" name="actual"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* HSE & Risk summary — read only */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <h3 className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1.5"><Shield size={12} className="text-emerald-600"/>An toàn HSE</h3>
                <p className="text-2xl font-black text-emerald-700">127</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Ngày an toàn liên tục</p>
                <p className="text-[10px] text-slate-500 mt-2">0 tai nạn · 2 vi phạm nhỏ (đã xử lý)</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <h3 className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1.5"><AlertTriangle size={12} className="text-rose-600"/>Rủi ro</h3>
                <p className="text-2xl font-black text-rose-700">{kpis.openRisks}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Rủi ro đang mở</p>
                <p className="text-[10px] text-slate-500 mt-2">1 nghiêm trọng · 2 trung bình</p>
              </div>
            </div>
          </div>
        )}

        {/* ── PROGRESS ───────────────────────────────────────────────────── */}
        {tab === 'progress' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-sm font-bold text-slate-700 mb-4">Tiến độ theo hạng mục (EVM)</h3>
              {[
                { name:'Móng cọc',         pv:100, ev:100, color:'emerald' },
                { name:'Đài móng',         pv:85,  ev:72,  color:'amber'   },
                { name:'Tầng hầm',         pv:65,  ev:48,  color:'orange'  },
                { name:'Cột & dầm T1-T2',  pv:42,  ev:28,  color:'orange'  },
                { name:'Hệ thống M&E',     pv:22,  ev:10,  color:'rose'    },
                { name:'Hoàn thiện',       pv:0,   ev:0,   color:'slate'   },
              ].map(w => (
                <div key={w.name} className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-slate-700">{w.name}</p>
                    <div className="flex gap-3 text-[10px] font-bold">
                      <span className="text-blue-600">KH: {w.pv}%</span>
                      <span className={w.ev < w.pv ? 'text-rose-600' : 'text-emerald-600'}>TT: {w.ev}%</span>
                    </div>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden relative">
                    <div className="absolute h-full bg-blue-200 rounded-full" style={{width:`${w.pv}%`}}/>
                    <div className={`absolute h-full rounded-full ${
                      w.color === 'emerald' ? 'bg-emerald-500' :
                      w.color === 'amber'   ? 'bg-amber-400'   :
                      w.color === 'orange'  ? 'bg-orange-400'  :
                      w.color === 'rose'    ? 'bg-rose-400'    : 'bg-slate-300'
                    }`} style={{width:`${w.ev}%`}}/>
                  </div>
                </div>
              ))}
              <div className="flex gap-4 mt-3 text-[10px] font-semibold">
                <span className="flex items-center gap-1"><span className="w-3 h-2.5 rounded bg-blue-200 inline-block"/> Kế hoạch PV</span>
                <span className="flex items-center gap-1"><span className="w-3 h-2.5 rounded bg-emerald-500 inline-block"/> Thực tế EV</span>
              </div>
            </div>
          </div>
        )}

        {/* ── FINANCE ────────────────────────────────────────────────────── */}
        {tab === 'finance' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><DollarSign size={14} className="text-blue-600"/>Tình hình giải ngân</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={PAYMENT_DATA}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis dataKey="month" tick={{fontSize:11}} tickLine={false} axisLine={false}/>
                  <YAxis tick={{fontSize:11}} tickLine={false} axisLine={false} tickFormatter={v=>`${v}tỷ`} width={40}/>
                  <Tooltip formatter={(v:number, name:string) => [`${v.toFixed(1)} tỷ`, name === 'giai_ngan' ? 'Thực tế giải ngân' : 'Kế hoạch']}/>
                  <Legend formatter={(v) => v === 'giai_ngan' ? 'Thực tế' : 'Kế hoạch'}/>
                  <Bar dataKey="ke_hoach" fill="#bfdbfe" radius={[4,4,0,0]} name="ke_hoach"/>
                  <Bar dataKey="giai_ngan" fill="#3b82f6" radius={[4,4,0,0]} name="giai_ngan"/>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-sm font-bold text-slate-700 mb-3">Thanh toán theo giai đoạn</h3>
              {[
                { dot:'Đợt 1 — Khởi công', amount:4.5,  paid:4.5,  status:'paid',    date:'15/01/2026' },
                { dot:'Đợt 2 — Hoàn thành móng cọc', amount:4.5, paid:4.5, status:'paid', date:'28/02/2026' },
                { dot:'Đợt 3 — Hoàn thành tầng hầm', amount:5.0, paid:4.1, status:'partial', date:'Dự kiến 30/04' },
                { dot:'Đợt 4 — Hoàn thiện thô', amount:6.0, paid:0, status:'upcoming', date:'Dự kiến 31/07' },
              ].map((p, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
                  <div>
                    <p className="text-xs font-semibold text-slate-700">{p.dot}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{p.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-800">{p.paid}/{p.amount} tỷ</p>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      p.status === 'paid'     ? 'bg-emerald-100 text-emerald-700' :
                      p.status === 'partial'  ? 'bg-amber-100 text-amber-700'    :
                                                'bg-slate-100 text-slate-500'
                    }`}>{p.status === 'paid' ? 'Đã TT' : p.status === 'partial' ? 'Thanh toán một phần' : 'Chưa đến hạn'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── REPORTS ────────────────────────────────────────────────────── */}
        {tab === 'reports' && (
          <div className="space-y-4">
            {/* Generate report button */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Sparkles size={14} className="text-violet-600"/> Báo cáo GEM tự động
                </h3>
                <button onClick={generateWeeklyReport} disabled={gemLoading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white rounded-xl text-xs font-bold hover:bg-violet-700 disabled:opacity-50">
                  {gemLoading ? '⏳ Đang tạo...' : '✨ Tạo báo cáo tuần'}
                </button>
              </div>
              {gemReport && (
                <div className="bg-slate-50 rounded-xl p-4 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap border border-slate-200">
                  {gemReport}
                </div>
              )}
              {!gemReport && !gemLoading && (
                <p className="text-xs text-slate-400 text-center py-6">GEM sẽ tự động tổng hợp tiến độ + tài chính + rủi ro thành báo cáo cho CĐT</p>
              )}
            </div>

            {/* Weekly report archive */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-700">Lịch sử báo cáo</h3>
              {WEEKLY_REPORTS.map(r => (
                <div key={r.id} className="bg-white border border-slate-200 rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="text-xs font-bold text-slate-800">{r.week}</p>
                    <div className="flex gap-1.5 shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.spi >= 0.95 ? 'bg-emerald-100 text-emerald-700' : r.spi >= 0.85 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                        SPI {r.spi.toFixed(3)}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.cpi >= 0.95 ? 'bg-emerald-100 text-emerald-700' : r.cpi >= 0.85 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                        CPI {r.cpi.toFixed(3)}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-600 mb-1">✅ {r.highlights}</p>
                  {r.issues && <p className="text-[11px] text-amber-700">⚠ {r.issues}</p>}
                  <p className="text-[10px] text-slate-400 mt-2">{r.generated_at}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
