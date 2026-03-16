/**
 * RiskDashboard.tsx — GEM & CLAUDE PM Pro
 * Risk Register + Ma trận 5×5 + Early Warning Indicators (EWI)
 * S15 — Sprint mới hoàn toàn
 */
import React, { useState } from 'react';
import { AlertTriangle, Shield, TrendingUp, Plus, X, Flag,
  CheckCircle2, Clock, Zap, Target, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { useNotification } from './NotificationEngine';
import ModalForm, { FormRow, FormGrid, FormSection, inputCls, selectCls, BtnCancel, BtnSubmit } from './ModalForm';
import { db, useRealtimeSync } from './db';
import type { DashboardProps } from './types';

type Likelihood  = 1|2|3|4|5;
type Impact      = 1|2|3|4|5;
type RiskStatus  = 'open'|'mitigating'|'closed'|'accepted';
type RiskCategory= 'technical'|'financial'|'schedule'|'safety'|'legal'|'external';

interface Risk {
  id: string;
  code: string;
  title: string;
  description: string;
  category: RiskCategory;
  likelihood: Likelihood;
  impact: Impact;
  owner: string;
  mitigation: string;
  contingency: string;
  status: RiskStatus;
  created_at: string;
  due_date?: string;
  residual_likelihood?: Likelihood;
  residual_impact?: Impact;
}

const CAT_LABEL: Record<RiskCategory, string> = {
  technical:  'Kỹ thuật',
  financial:  'Tài chính',
  schedule:   'Tiến độ',
  safety:     'An toàn',
  legal:      'Pháp lý',
  external:   'Bên ngoài',
};
const CAT_COLOR: Record<RiskCategory, string> = {
  technical:  'bg-blue-100 text-blue-700',
  financial:  'bg-emerald-100 text-emerald-700',
  schedule:   'bg-amber-100 text-amber-700',
  safety:     'bg-rose-100 text-rose-700',
  legal:      'bg-violet-100 text-violet-700',
  external:   'bg-slate-100 text-slate-600',
};
const STATUS_CFG: Record<RiskStatus, {label:string; cls:string}> = {
  open:       { label:'Mở',           cls:'bg-rose-100 text-rose-700' },
  mitigating: { label:'Đang xử lý',   cls:'bg-amber-100 text-amber-700' },
  closed:     { label:'Đã đóng',      cls:'bg-emerald-100 text-emerald-700' },
  accepted:   { label:'Chấp nhận',    cls:'bg-slate-100 text-slate-600' },
};

const SEED_RISKS: Risk[] = [
  { id:'r1', code:'R-001', title:'Trễ bàn giao mặt bằng tầng hầm', description:'Thi công tầng hầm bị chậm do địa chất phức tạp hơn dự kiến', category:'schedule', likelihood:4, impact:4, owner:'CHT Trần Văn B', mitigation:'Tăng ca, bổ sung thiết bị đào', contingency:'EOT + phạt NTP theo HĐ', status:'mitigating', created_at:'01/03/2026', due_date:'30/04/2026', residual_likelihood:2, residual_impact:3 },
  { id:'r2', code:'R-002', title:'Biến động giá thép', description:'Giá thép tăng >15% so với dự toán gốc', category:'financial', likelihood:3, impact:4, owner:'QS Tuấn', mitigation:'Lock giá với NCC trước 3 tháng', contingency:'Điều chỉnh HĐ theo Phụ lục giá', status:'open', created_at:'15/02/2026', due_date:'15/04/2026', residual_likelihood:2, residual_impact:2 },
  { id:'r3', code:'R-003', title:'Chứng chỉ an toàn nhân công hết hạn', description:'12 công nhân tổ sắt chứng chỉ AN TOÀN hết hạn trước khi hoàn thành tầng 3', category:'safety', likelihood:4, impact:3, owner:'HSE Hải', mitigation:'Lên lịch huấn luyện lại tháng 3', contingency:'Tạm ngừng công việc trên cao cho nhóm này', status:'mitigating', created_at:'10/03/2026', due_date:'20/03/2026' },
  { id:'r4', code:'R-004', title:'Thay đổi thiết kế M&E từ CĐT', description:'CĐT đang xem xét thay đổi hệ thống điều hòa tầng 4-5', category:'technical', likelihood:2, impact:3, owner:'KS M&E Phạm', mitigation:'Freeze design review trước 31/03', contingency:'Variation order + điều chỉnh tiến độ', status:'open', created_at:'05/03/2026' },
  { id:'r5', code:'R-005', title:'Trễ phê duyệt hồ sơ pháp lý', description:'Xin phép xây dựng bổ sung tầng mái chưa được duyệt', category:'legal', likelihood:2, impact:5, owner:'GĐ DA', mitigation:'Nộp hồ sơ bổ sung, thuê tư vấn pháp lý', contingency:'Dừng thi công mái nếu không có phép', status:'open', created_at:'01/03/2026', due_date:'01/05/2026' },
];

const SCORE = (l: Likelihood, i: Impact) => l * i;
const riskLevel = (score: number): {label:string; cls:string; cell:string} => {
  if (score >= 15) return { label:'Nghiêm trọng', cls:'text-rose-700 bg-rose-50 border-rose-200',   cell:'bg-rose-500' };
  if (score >= 9)  return { label:'Cao',           cls:'text-orange-700 bg-orange-50 border-orange-200', cell:'bg-orange-400' };
  if (score >= 4)  return { label:'Trung bình',    cls:'text-amber-700 bg-amber-50 border-amber-200', cell:'bg-amber-300' };
  return             { label:'Thấp',          cls:'text-emerald-700 bg-emerald-50 border-emerald-200', cell:'bg-emerald-200' };
};

const LIKELIHOOD_LABEL = ['','Hiếm khi','Khó xảy ra','Có thể','Khả năng cao','Gần như chắc'];
const IMPACT_LABEL     = ['','Không đáng kể','Nhỏ','Trung bình','Lớn','Thảm họa'];

export default function RiskDashboard({ project: selectedProject, projectId: projectIdProp }: DashboardProps) {
  const pid = projectIdProp ?? selectedProject?.id ?? 'default';
  const { ok: notifOk, err: notifErr } = useNotification();
  const dbLoaded = React.useRef(false);

  const [risks, setRisks]       = useState<Risk[]>(SEED_RISKS);
  const [tab, setTab]           = useState<'register'|'matrix'|'ewi'>('register');
  const [showForm, setShowForm] = useState(false);
  const [riskForm, setRiskForm] = useState<Partial<Risk>>({ category:'technical', likelihood:3, impact:3, status:'open' });
  const [expanded, setExpanded] = useState<string|null>(null);
  const [filterStatus, setFilterStatus] = useState<RiskStatus|'all'>('all');
  const [filterCat, setFilterCat]       = useState<RiskCategory|'all'>('all');

  // ── Load from db ─────────────────────────────────────────────────────────
  React.useEffect(() => {
    dbLoaded.current = false;
    db.get<Risk[]>('risk_register', pid, SEED_RISKS)
      .then(data => { setRisks(data); })
      .catch(e => { console.warn('[RiskDashboard] load error:', e); })
      .finally(() => { dbLoaded.current = true; });
  }, [pid]);

  useRealtimeSync(pid, ['risk_register'], async () => {
    const data = await db.get<Risk[]>('risk_register', pid, SEED_RISKS);
    setRisks(data);
  });

  // ── Computed ─────────────────────────────────────────────────────────────
  const filtered = risks.filter(r =>
    (filterStatus === 'all' || r.status === filterStatus) &&
    (filterCat    === 'all' || r.category === filterCat)
  );
  const critical = risks.filter(r => SCORE(r.likelihood, r.impact) >= 15 && r.status !== 'closed');
  const highRisk = risks.filter(r => SCORE(r.likelihood, r.impact) >= 9  && r.status !== 'closed');

  // EWI thresholds
  const ewi = [
    { label:'Rủi ro nghiêm trọng chưa xử lý', value: critical.length, threshold: 1, unit:'', icon:<AlertTriangle size={14}/>, color:'rose' },
    { label:'Rủi ro cao đang mở',              value: highRisk.length, threshold: 3, unit:'', icon:<Flag size={14}/>,           color:'orange' },
    { label:'Rủi ro quá hạn xử lý',           value: risks.filter(r => r.due_date && r.status === 'open' && r.due_date < new Date().toLocaleDateString('vi-VN')).length, threshold: 2, unit:'', icon:<Clock size={14}/>, color:'amber' },
    { label:'Tổng rủi ro đang mở',             value: risks.filter(r => r.status === 'open').length,  threshold: 5, unit:'', icon:<Eye size={14}/>,  color:'blue' },
  ];

  const handleSave = () => {
    if (!riskForm.title?.trim())      { notifErr('Vui lòng nhập tiêu đề rủi ro!'); return; }
    if (!riskForm.owner?.trim())      { notifErr('Vui lòng nhập người phụ trách!'); return; }
    if (!riskForm.mitigation?.trim()) { notifErr('Vui lòng nhập biện pháp xử lý!'); return; }
    const newRisk: Risk = {
      id: 'r_' + Date.now(),
      code: `R-${String(risks.length + 1).padStart(3,'0')}`,
      title: riskForm.title!,
      description: riskForm.description ?? '',
      category: riskForm.category as RiskCategory ?? 'technical',
      likelihood: (riskForm.likelihood as Likelihood) ?? 3,
      impact: (riskForm.impact as Impact) ?? 3,
      owner: riskForm.owner!,
      mitigation: riskForm.mitigation!,
      contingency: riskForm.contingency ?? '',
      status: 'open',
      created_at: new Date().toLocaleDateString('vi-VN'),
      due_date: riskForm.due_date,
    };
    setRisks(prev => {
      const next = [newRisk, ...prev];
      if (dbLoaded.current) db.set('risk_register', pid, next);
      return next;
    });
    setShowForm(false);
    setRiskForm({ category:'technical', likelihood:3, impact:3, status:'open' });
    notifOk(`Đã thêm ${newRisk.code} vào Risk Register!`);
  };

  const updateStatus = (id: string, status: RiskStatus) => {
    setRisks(prev => {
      const next = prev.map(r => r.id === id ? {...r, status} : r);
      if (dbLoaded.current) db.set('risk_register', pid, next);
      return next;
    });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <AlertTriangle size={20} className="text-rose-600"/>
            Quản lý Rủi ro — {selectedProject?.name || 'Dự án'}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">Risk Register · Ma trận 5×5 · Chỉ báo cảnh báo sớm (EWI)</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 transition-colors">
          <Plus size={14}/> Thêm rủi ro
        </button>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label:'Tổng rủi ro',     val: risks.length,                                          cls:'bg-slate-100 text-slate-700' },
          { label:'Nghiêm trọng',    val: critical.length,                                       cls:'bg-rose-100 text-rose-700' },
          { label:'Đang xử lý',      val: risks.filter(r=>r.status==='mitigating').length,       cls:'bg-amber-100 text-amber-700' },
          { label:'Đã đóng/Chấp nhận', val: risks.filter(r=>r.status==='closed'||r.status==='accepted').length, cls:'bg-emerald-100 text-emerald-700' },
        ].map(k => (
          <div key={k.label} className={`${k.cls} rounded-2xl px-4 py-3 text-center`}>
            <p className="text-2xl font-black">{k.val}</p>
            <p className="text-[11px] font-semibold mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 bg-white border border-slate-200 rounded-2xl p-2">
        {([['register','Register','Shield'],['matrix','Ma trận 5×5','Target'],['ewi','EWI','Zap']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id as any)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              tab === id ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}>
            {id === 'register' && <Shield size={13}/>}
            {id === 'matrix'   && <Target size={13}/>}
            {id === 'ewi'      && <Zap size={13}/>}
            {label}
            {id === 'register' && critical.length > 0 && (
              <span className="bg-white/30 text-[9px] font-bold px-1.5 rounded-full">{critical.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── RISK REGISTER ─────────────────────────────────────────────────── */}
      {tab === 'register' && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <select className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-rose-200"
              value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
              <option value="all">Tất cả trạng thái</option>
              {(Object.entries(STATUS_CFG) as [RiskStatus, any][]).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-rose-200"
              value={filterCat} onChange={e => setFilterCat(e.target.value as any)}>
              <option value="all">Tất cả danh mục</option>
              {(Object.entries(CAT_LABEL) as [RiskCategory, string][]).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <span className="text-xs text-slate-400 self-center">{filtered.length} rủi ro</span>
          </div>

          {filtered.map(r => {
            const score = SCORE(r.likelihood, r.impact);
            const level = riskLevel(score);
            const isExp = expanded === r.id;
            return (
              <div key={r.id} className={`bg-white border rounded-2xl shadow-sm overflow-hidden ${score >= 15 ? 'border-rose-200' : score >= 9 ? 'border-orange-200' : 'border-slate-200'}`}>
                <div className="px-4 py-3 flex items-start gap-3 cursor-pointer hover:bg-slate-50/50"
                  onClick={() => setExpanded(isExp ? null : r.id)}>
                  <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 font-black text-sm ${level.cell} text-white`}>
                    {score}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-[10px] font-bold text-slate-400">{r.code}</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${CAT_COLOR[r.category]}`}>{CAT_LABEL[r.category]}</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${STATUS_CFG[r.status].cls}`}>{STATUS_CFG[r.status].label}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-800">{r.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Phụ trách: {r.owner} {r.due_date ? `· Hạn: ${r.due_date}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${level.cls}`}>{level.label}</span>
                    {isExp ? <ChevronUp size={14} className="text-slate-400"/> : <ChevronDown size={14} className="text-slate-400"/>}
                  </div>
                </div>

                {isExp && (
                  <div className="border-t border-slate-100 px-4 py-3 space-y-3 bg-slate-50/50">
                    <p className="text-xs text-slate-600">{r.description}</p>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="font-bold text-slate-400 uppercase text-[9px] mb-0.5">Biện pháp xử lý</p>
                        <p className="text-slate-700">{r.mitigation}</p>
                      </div>
                      {r.contingency && (
                        <div>
                          <p className="font-bold text-slate-400 uppercase text-[9px] mb-0.5">Dự phòng</p>
                          <p className="text-slate-700">{r.contingency}</p>
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-slate-400 uppercase text-[9px] mb-0.5">Khả năng × Tác động</p>
                        <p className="text-slate-700">{LIKELIHOOD_LABEL[r.likelihood]} × {IMPACT_LABEL[r.impact]} = <strong>{score}</strong></p>
                      </div>
                      {r.residual_likelihood && r.residual_impact && (
                        <div>
                          <p className="font-bold text-slate-400 uppercase text-[9px] mb-0.5">Rủi ro còn lại</p>
                          <p className="text-slate-700">{LIKELIHOOD_LABEL[r.residual_likelihood]} × {IMPACT_LABEL[r.residual_impact]} = <strong>{SCORE(r.residual_likelihood, r.residual_impact)}</strong></p>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {r.status === 'open' && (
                        <button onClick={() => updateStatus(r.id, 'mitigating')}
                          className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-bold hover:bg-amber-200">
                          Bắt đầu xử lý
                        </button>
                      )}
                      {r.status === 'mitigating' && (
                        <button onClick={() => updateStatus(r.id, 'closed')}
                          className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-bold hover:bg-emerald-200">
                          ✓ Đóng rủi ro
                        </button>
                      )}
                      {r.status === 'open' && (
                        <button onClick={() => updateStatus(r.id, 'accepted')}
                          className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-200">
                          Chấp nhận
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── MA TRẬN 5×5 ───────────────────────────────────────────────────── */}
      {tab === 'matrix' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Ma trận rủi ro 5×5 — {risks.filter(r=>r.status!=='closed').length} rủi ro đang mở</h3>
          <div className="overflow-x-auto">
            <div style={{minWidth: 480}}>
              {/* Y axis label */}
              <div className="flex items-end gap-1 mb-1">
                <div className="w-28 shrink-0"/>
                <div className="flex-1 grid grid-cols-5 gap-1 text-center">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className="text-[9px] text-slate-400 font-semibold pb-1">
                      Tác động {i}<br/><span className="font-normal">{IMPACT_LABEL[i]}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Grid rows (likelihood 5→1 top to bottom) */}
              {([5,4,3,2,1] as Likelihood[]).map(l => (
                <div key={l} className="flex items-stretch gap-1 mb-1">
                  <div className="w-28 shrink-0 flex items-center text-[9px] text-slate-400 font-semibold pr-2 text-right leading-tight">
                    L{l} {LIKELIHOOD_LABEL[l]}
                  </div>
                  {([1,2,3,4,5] as Impact[]).map(i => {
                    const score = l * i;
                    const lv = riskLevel(score);
                    const cellRisks = risks.filter(r => r.likelihood === l && r.impact === i && r.status !== 'closed');
                    return (
                      <div key={i} className={`flex-1 min-h-[60px] rounded-lg ${lv.cell} flex flex-col items-center justify-center p-1 relative`}>
                        <span className="text-white text-[10px] font-black opacity-60">{score}</span>
                        {cellRisks.map(r => (
                          <div key={r.id} className="bg-white/90 text-[8px] font-bold text-slate-800 px-1 py-0.5 rounded mt-0.5 max-w-full truncate"
                            title={r.title}>
                            {r.code}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
              {/* Legend */}
              <div className="flex gap-4 mt-3 flex-wrap text-[10px] font-semibold">
                {[['bg-rose-500','Nghiêm trọng (≥15)'],['bg-orange-400','Cao (9-14)'],['bg-amber-300','Trung bình (4-8)'],['bg-emerald-200','Thấp (1-3)']].map(([c,l]) => (
                  <span key={l} className="flex items-center gap-1"><span className={`w-3 h-3 rounded ${c}`}/><span className="text-slate-600">{l}</span></span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── EARLY WARNING INDICATORS ──────────────────────────────────────── */}
      {tab === 'ewi' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ewi.map(e => {
              const triggered = e.value >= e.threshold;
              return (
                <div key={e.label} className={`bg-white border rounded-2xl p-4 flex items-start gap-3 ${triggered ? 'border-rose-200' : 'border-slate-200'}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${triggered ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                    {e.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-700">{e.label}</p>
                    <div className="flex items-end gap-2 mt-1">
                      <span className={`text-2xl font-black ${triggered ? 'text-rose-600' : 'text-slate-700'}`}>{e.value}</span>
                      <span className="text-[10px] text-slate-400 mb-0.5">Ngưỡng: {e.threshold}</span>
                    </div>
                    {triggered && (
                      <div className="mt-2 text-[10px] font-bold text-rose-700 bg-rose-50 rounded-lg px-2 py-1">
                        ⚠ Đã vượt ngưỡng cảnh báo — cần hành động ngay
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
              <TrendingUp size={14} className="text-rose-600"/> Xu hướng rủi ro
            </h3>
            <div className="space-y-2">
              {risks.filter(r => r.status !== 'closed').sort((a,b) => SCORE(b.likelihood,b.impact) - SCORE(a.likelihood,a.impact)).slice(0,5).map(r => {
                const score = SCORE(r.likelihood, r.impact);
                const lv = riskLevel(score);
                return (
                  <div key={r.id} className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-slate-400 w-12 shrink-0">{r.code}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className={`h-full rounded-full ${lv.cell}`} style={{width:`${(score/25)*100}%`}}/>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${lv.cls}`}>{score}</span>
                    <span className="text-[10px] text-slate-500 truncate max-w-[120px]">{r.title}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal thêm rủi ro — DS 5.2 cuối component ─────────────────────── */}
      <ModalForm
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Thêm rủi ro mới"
        subtitle="Nhận diện và đánh giá rủi ro dự án"
        icon={<AlertTriangle size={18}/>}
        color="rose"
        width="lg"
        footer={<><BtnCancel onClick={() => setShowForm(false)}/><BtnSubmit label="Thêm vào Register" onClick={handleSave}/></>}
      >
        <FormSection title="Thông tin rủi ro">
          <FormGrid cols={2}>
            <FormRow label="Tiêu đề *" className="col-span-2">
              <input className={inputCls} placeholder="Mô tả ngắn gọn rủi ro" value={riskForm.title ?? ''} onChange={e => setRiskForm(p => ({...p, title: e.target.value}))}/>
            </FormRow>
            <FormRow label="Danh mục">
              <select className={selectCls} value={riskForm.category} onChange={e => setRiskForm(p => ({...p, category: e.target.value as RiskCategory}))}>
                {(Object.entries(CAT_LABEL) as [RiskCategory, string][]).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </FormRow>
            <FormRow label="Người phụ trách *">
              <input className={inputCls} placeholder="Tên / chức vụ" value={riskForm.owner ?? ''} onChange={e => setRiskForm(p => ({...p, owner: e.target.value}))}/>
            </FormRow>
            <FormRow label="Mô tả" className="col-span-2">
              <textarea rows={2} className={inputCls + ' resize-none'} value={riskForm.description ?? ''} onChange={e => setRiskForm(p => ({...p, description: e.target.value}))}/>
            </FormRow>
          </FormGrid>
        </FormSection>
        <FormSection title="Đánh giá">
          <FormGrid cols={3}>
            <FormRow label="Khả năng xảy ra (1-5)">
              <select className={selectCls} value={riskForm.likelihood} onChange={e => setRiskForm(p => ({...p, likelihood: +e.target.value as Likelihood}))}>
                {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} — {LIKELIHOOD_LABEL[n]}</option>)}
              </select>
            </FormRow>
            <FormRow label="Mức tác động (1-5)">
              <select className={selectCls} value={riskForm.impact} onChange={e => setRiskForm(p => ({...p, impact: +e.target.value as Impact}))}>
                {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} — {IMPACT_LABEL[n]}</option>)}
              </select>
            </FormRow>
            <FormRow label="Điểm rủi ro">
              <div className={`px-3 py-2.5 rounded-xl border text-sm font-black text-center ${riskLevel(((riskForm.likelihood??1) * (riskForm.impact??1))).cls}`}>
                {((riskForm.likelihood??1) * (riskForm.impact??1))} — {riskLevel(((riskForm.likelihood??1) * (riskForm.impact??1))).label}
              </div>
            </FormRow>
          </FormGrid>
        </FormSection>
        <FormSection title="Biện pháp">
          <FormGrid cols={1}>
            <FormRow label="Biện pháp xử lý *">
              <input className={inputCls} placeholder="Hành động để giảm thiểu rủi ro" value={riskForm.mitigation ?? ''} onChange={e => setRiskForm(p => ({...p, mitigation: e.target.value}))}/>
            </FormRow>
            <FormRow label="Kế hoạch dự phòng">
              <input className={inputCls} placeholder="Hành động nếu rủi ro xảy ra" value={riskForm.contingency ?? ''} onChange={e => setRiskForm(p => ({...p, contingency: e.target.value}))}/>
            </FormRow>
            <FormRow label="Hạn xử lý">
              <input type="date" className={inputCls} onChange={e => setRiskForm(p => ({...p, due_date: new Date(e.target.value).toLocaleDateString('vi-VN')}))}/>
            </FormRow>
          </FormGrid>
        </FormSection>
      </ModalForm>
    </div>
  );
}
