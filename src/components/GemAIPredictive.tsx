/**
 * GemAIPredictive.tsx — GEM&CLAUDE PM Pro
 * S20 — AI Predictive: dự báo SPI/CPI, EAC, completion date
 * Đọc data thật từ db.ts (progress_wbs, qs_payments, mat_vouchers)
 * Phân tích qua Gemini → báo cáo dự báo có cơ sở định lượng
 *
 * Tích hợp vào GemAIDashboard.tsx hoặc dùng độc lập trong ProjectDashboard
 * Usage: <GemAIPredictive projectId={projectId} projectName={projectName} />
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNotification } from './NotificationEngine';
import { db } from './db';
import { genAI, GEM_MODEL_QUALITY } from './gemini';
import {
  TrendingUp, TrendingDown, AlertTriangle, Sparkles,
  RefreshCw, BarChart2, Calendar, DollarSign, Target,
  ChevronDown, ChevronUp, CheckCircle2, Clock,
} from 'lucide-react';

interface PredictiveProps {
  projectId:   string;
  projectName: string;
  budget?:     number;    // tổng ngân sách (tỷ VNĐ)
  endDate?:    string;    // ngày hoàn thành kế hoạch
}

interface KPI {
  ev:  number;   // Earned Value %
  pv:  number;   // Planned Value %
  ac:  number;   // Actual Cost (tỷ)
  bac: number;   // Budget At Completion (tỷ)
}

interface ForecastResult {
  spi:          number;
  cpi:          number;
  eac:          number;   // Estimate At Completion (tỷ)
  etc:          number;   // Estimate To Complete (tỷ)
  sv:           number;   // Schedule Variance %
  cv:           number;   // Cost Variance %
  completion:   string;   // dự báo ngày hoàn thành
  risk:         'low' | 'medium' | 'high' | 'critical';
  gemAnalysis:  string;
  generatedAt:  string;
}

function calcForecast(kpi: KPI, endDate?: string): Omit<ForecastResult, 'gemAnalysis' | 'generatedAt'> {
  const spi = kpi.pv > 0 ? kpi.ev / kpi.pv : 1;
  const cpi = kpi.ac > 0 ? (kpi.ev / 100 * kpi.bac) / kpi.ac : 1;
  const eac  = cpi > 0 ? kpi.bac / cpi : kpi.bac;
  const etc  = eac - kpi.ac;
  const sv   = kpi.ev - kpi.pv;
  const cv   = cpi > 0 ? ((kpi.ev / 100 * kpi.bac) - kpi.ac) / kpi.bac * 100 : 0;

  // Dự báo ngày hoàn thành
  let completion = endDate ?? 'N/A';
  if (endDate && spi > 0 && spi !== 1) {
    const planned = new Date(endDate.split('/').reverse().join('-'));
    const today   = new Date();
    const daysLeft = Math.ceil((planned.getTime() - today.getTime()) / 86400000);
    const projected = new Date(today.getTime() + (daysLeft / spi) * 86400000);
    completion = projected.toLocaleDateString('vi-VN');
  }

  const risk: ForecastResult['risk'] =
    spi < 0.7 || cpi < 0.7 ? 'critical' :
    spi < 0.85 || cpi < 0.85 ? 'high' :
    spi < 0.95 || cpi < 0.95 ? 'medium' : 'low';

  return { spi, cpi, eac, etc, sv, cv, completion, risk };
}

const RISK_CFG = {
  low:      { label: 'Tốt',         cls: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 size={13}/> },
  medium:   { label: 'Cần theo dõi',cls: 'bg-amber-100 text-amber-700',    icon: <Clock size={13}/> },
  high:     { label: 'Cảnh báo',    cls: 'bg-orange-100 text-orange-700',  icon: <AlertTriangle size={13}/> },
  critical: { label: 'Nguy hiểm',   cls: 'bg-red-100 text-red-700',        icon: <AlertTriangle size={13}/> },
};

export default function GemAIPredictive({ projectId, projectName, budget = 45, endDate }: PredictiveProps) {
  const { err } = useNotification();
  const [kpi, setKpi]               = useState<KPI>({ ev: 0, pv: 0, ac: 0, bac: budget });
  const [forecast, setForecast]     = useState<ForecastResult | null>(null);
  const [loading, setLoading]       = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [expanded, setExpanded]     = useState(false);

  // ── Load KPI từ db.ts thật ────────────────────────────────────────────────
  const loadKPI = useCallback(async () => {
    setDataLoading(true);
    try {
      const [wbs, payments, vouchers] = await Promise.all([
        db.get<any[]>('progress_wbs',  projectId, []),
        db.get<any[]>('qs_payments',   projectId, []),
        db.get<any[]>('mat_vouchers',  projectId, []),
      ]);

      let ev = 0, pv = 0, ac = 0;

      if (wbs.length) {
        ev = wbs.reduce((s: number, w: any) => s + (w.ev_pct  || 0), 0) / wbs.length;
        pv = wbs.reduce((s: number, w: any) => s + (w.pv_pct  || 0), 0) / wbs.length;
        const totalAC = wbs.reduce((s: number, w: any) => s + (w.ac || 0), 0);
        ac = totalAC / 1e9;
      }

      // Cộng thêm chi phí từ payments + vouchers nếu wbs không có AC
      if (ac === 0) {
        const paidPayments = (payments as any[])
          .filter(p => p.status === 'paid')
          .reduce((s: number, p: any) => s + ((p.net_payable || p.total || 0) / 1e9), 0);
        const voucherCost = (vouchers as any[])
          .filter(v => v.type === 'PX')
          .reduce((s: number, v: any) => s + ((v.totalAmount || 0) / 1e9), 0);
        ac = paidPayments + voucherCost;
      }

      setKpi({ ev, pv, ac, bac: budget });
    } catch (e: any) {
      console.warn('[GemAIPredictive] loadKPI:', e.message);
    } finally {
      setDataLoading(false);
    }
  }, [projectId, budget]);

  useEffect(() => { loadKPI(); }, [loadKPI]);

  // ── Gemini phân tích ───────────────────────────────────────────────────────
  const analyze = async () => {
    setLoading(true);
    try {
      const base = calcForecast(kpi, endDate);
      const model = genAI.getGenerativeModel({
        model: GEM_MODEL_QUALITY,
        generationConfig: { temperature: 0.25, maxOutputTokens: 2048 },
      });

      const prompt =
        `Anh là chuyên gia quản lý dự án xây dựng. Phân tích hiệu quả dự án "${projectName}" với các chỉ số sau:\n\n` +
        `- SPI (Schedule Performance Index) = ${base.spi.toFixed(3)} — tiến độ đạt ${(base.spi * 100).toFixed(1)}% kế hoạch\n` +
        `- CPI (Cost Performance Index) = ${base.cpi.toFixed(3)} — hiệu quả chi phí ${(base.cpi * 100).toFixed(1)}%\n` +
        `- EV (Earned Value) = ${kpi.ev.toFixed(1)}% khối lượng thực hiện\n` +
        `- PV (Planned Value) = ${kpi.pv.toFixed(1)}% theo kế hoạch\n` +
        `- AC (Actual Cost) = ${kpi.ac.toFixed(3)} tỷ VNĐ\n` +
        `- BAC (Budget at Completion) = ${kpi.bac} tỷ VNĐ\n` +
        `- EAC dự báo = ${base.eac.toFixed(3)} tỷ VNĐ\n` +
        `- Ngày hoàn thành dự báo = ${base.completion}\n` +
        `- Mức rủi ro: ${base.risk.toUpperCase()}\n\n` +
        `Hãy phân tích:\n` +
        `1. Đánh giá tổng quan tình trạng dự án (2-3 câu)\n` +
        `2. Nguyên nhân có thể khiến SPI/CPI thấp (nếu có)\n` +
        `3. Khuyến nghị 3 hành động cụ thể cho PM trong tuần tới\n` +
        `4. Dự báo rủi ro nếu không có biện pháp can thiệp\n\n` +
        `Trả lời bằng tiếng Việt, ngắn gọn, thực tế.`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();

      setForecast({
        ...base,
        gemAnalysis: text,
        generatedAt: new Date().toLocaleString('vi-VN'),
      });
    } catch (e: any) {
      err(`GEM AI lỗi: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const f2 = (n: number) => n.toFixed(3);
  const pct = (n: number) => `${n.toFixed(1)}%`;

  return (
    <div className="space-y-4">

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label:'EV (Thực hiện)',  val: pct(kpi.ev),  sub:'% khối lượng',     icon:<Target size={14}/>,     color:'text-emerald-700 bg-emerald-50' },
          { label:'PV (Kế hoạch)',   val: pct(kpi.pv),  sub:'% theo plan',       icon:<Calendar size={14}/>,   color:'text-blue-700 bg-blue-50' },
          { label:'AC (Chi phí thực)',val:`${kpi.ac.toFixed(2)}B`, sub:'tỷ VNĐ', icon:<DollarSign size={14}/>, color:'text-violet-700 bg-violet-50' },
          { label:'BAC (Ngân sách)', val:`${kpi.bac}B`, sub:'tỷ VNĐ',           icon:<BarChart2 size={14}/>,   color:'text-slate-700 bg-slate-50' },
        ].map(k => (
          <div key={k.label} className={`rounded-xl border border-slate-200 px-4 py-3 ${k.color.split(' ')[1]}`}>
            <div className={`flex items-center gap-1.5 mb-1 ${k.color.split(' ')[0]}`}>
              {k.icon}
              <span className="text-[10px] font-black uppercase tracking-widest">{k.label}</span>
            </div>
            <p className={`text-xl font-black ${k.color.split(' ')[0]}`}>{dataLoading ? '...' : k.val}</p>
            <p className="text-[10px] text-slate-400">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Forecast result */}
      {forecast && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-emerald-600"/>
              <span className="text-xs font-black text-slate-700">Dự báo GEM AI</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${RISK_CFG[forecast.risk].cls}`}>
                {RISK_CFG[forecast.risk].icon}{RISK_CFG[forecast.risk].label}
              </span>
            </div>
            <span className="text-[10px] text-slate-400">{forecast.generatedAt}</span>
          </div>

          {/* Index row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-x divide-slate-100 border-b border-slate-100">
            {[
              { label:'SPI', val: f2(forecast.spi), good: forecast.spi >= 0.95, icon: forecast.spi >= 1 ? <TrendingUp size={12}/> : <TrendingDown size={12}/> },
              { label:'CPI', val: f2(forecast.cpi), good: forecast.cpi >= 0.95, icon: forecast.cpi >= 1 ? <TrendingUp size={12}/> : <TrendingDown size={12}/> },
              { label:'EAC', val:`${forecast.eac.toFixed(2)}B`, good: forecast.eac <= kpi.bac, icon:<DollarSign size={12}/> },
              { label:'Hoàn thành dự báo', val: forecast.completion, good: true, icon:<Calendar size={12}/> },
            ].map(item => (
              <div key={item.label} className="px-4 py-3 text-center">
                <div className={`flex items-center justify-center gap-1 mb-0.5 ${item.good ? 'text-emerald-600' : 'text-red-500'}`}>
                  {item.icon}
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{item.label}</span>
                </div>
                <p className={`text-lg font-black ${item.good ? 'text-emerald-700' : 'text-red-600'}`}>{item.val}</p>
              </div>
            ))}
          </div>

          {/* Gemini analysis */}
          <div className="px-4 py-3">
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-800 mb-2"
            >
              {expanded ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
              {expanded ? 'Thu gọn phân tích' : 'Xem phân tích chi tiết'}
            </button>
            {expanded && (
              <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 rounded-xl p-3 border border-slate-100">
                {forecast.gemAnalysis}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button onClick={loadKPI} disabled={dataLoading}
          className="flex items-center gap-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-xl px-3 py-2 hover:bg-slate-50 transition-colors">
          <RefreshCw size={12} className={dataLoading ? 'animate-spin' : ''}/>
          Cập nhật data
        </button>
        <button onClick={analyze} disabled={loading || dataLoading}
          className="flex items-center gap-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl px-4 py-2 transition-colors disabled:opacity-50">
          <Sparkles size={13}/>
          {loading ? 'GEM đang phân tích...' : 'Phân tích & Dự báo'}
        </button>
      </div>
    </div>
  );
}
