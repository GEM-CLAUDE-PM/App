/**
 * SubconPortal.tsx — GEM & CLAUDE PM Pro
 * Portal dành riêng cho Nhà thầu phụ (NTP)
 * S16 — Login riêng, xem phạm vi công việc, submit hồ sơ, nhận PO
 * RLS: chỉ thấy data của project được gán, không thấy data nhà thầu khác
 */
import React, { useState, useEffect } from 'react';
import { useNotification } from './NotificationEngine';
import { useAuth } from './AuthProvider';
import { db } from './db';
import ModalForm, { FormRow, FormGrid, FormSection, inputCls, selectCls, BtnCancel, BtnSubmit } from './ModalForm';
import {
  Building2, FileText, Package, DollarSign, CheckCircle2,
  Clock, AlertTriangle, Upload, Download, Bell, LogOut,
  ChevronRight, Plus, Eye, Sparkles, ShieldCheck, User,
} from 'lucide-react';
import { genAI, GEM_MODEL } from './gemini';

type SubconTab = 'overview' | 'scope' | 'documents' | 'payments' | 'pos';
type DocStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

interface SubconDocument {
  id: string;
  title: string;
  type: 'ho_so_thau' | 'bien_ban' | 'de_nghi_tt' | 'bao_cao' | 'khac';
  status: DocStatus;
  submitted_at: string;
  notes?: string;
  file_name?: string;
}

interface SubconPO {
  id: string;
  po_number: string;
  description: string;
  value: number;
  status: 'draft' | 'sent' | 'acknowledged' | 'completed';
  issued_date: string;
  due_date: string;
}

const TYPE_LABEL: Record<SubconDocument['type'], string> = {
  ho_so_thau: 'Hồ sơ năng lực', bien_ban: 'Biên bản', de_nghi_tt: 'Đề nghị thanh toán',
  bao_cao: 'Báo cáo', khac: 'Khác',
};
const DOC_STATUS_CFG: Record<DocStatus, {label:string; cls:string}> = {
  draft:     { label:'Nháp',         cls:'bg-slate-100 text-slate-600' },
  submitted: { label:'Đã nộp',       cls:'bg-amber-100 text-amber-700' },
  approved:  { label:'Đã duyệt',     cls:'bg-emerald-100 text-emerald-700' },
  rejected:  { label:'Từ chối',      cls:'bg-rose-100 text-rose-700' },
};
const PO_STATUS_CFG = {
  draft:        { label:'Nháp',         cls:'bg-slate-100 text-slate-600' },
  sent:         { label:'Đã gửi',       cls:'bg-blue-100 text-blue-700' },
  acknowledged: { label:'Đã xác nhận', cls:'bg-amber-100 text-amber-700' },
  completed:    { label:'Hoàn thành',  cls:'bg-emerald-100 text-emerald-700' },
};

const SEED_DOCS: SubconDocument[] = [
  { id:'d1', title:'Hồ sơ năng lực NTP Phúc Thành Q1/2026', type:'ho_so_thau', status:'approved', submitted_at:'15/01/2026', file_name:'NangLuc_PhucThanh_2026.pdf' },
  { id:'d2', title:'Đề nghị thanh toán đợt 2 — Thi công móng', type:'de_nghi_tt', status:'submitted', submitted_at:'10/03/2026', notes:'Chờ QS kiểm tra khối lượng' },
  { id:'d3', title:'Biên bản nghiệm thu hoàn thành đào đất', type:'bien_ban', status:'approved', submitted_at:'28/02/2026', file_name:'BBNT_DaoDat_2026.pdf' },
];
const SEED_POS: SubconPO[] = [
  { id:'po1', po_number:'PO-2026/001', description:'Thi công cọc khoan nhồi D600 — 45 cọc', value: 2_850_000_000, status:'completed', issued_date:'10/01/2026', due_date:'28/02/2026' },
  { id:'po2', po_number:'PO-2026/002', description:'Thi công đài móng & giằng móng', value: 1_420_000_000, status:'acknowledged', issued_date:'01/03/2026', due_date:'30/04/2026' },
];

export default function SubconPortal() {
  const { user, signOut } = useAuth();
  const { ok: notifOk, err: notifErr, info: notifInfo } = useNotification();
  const [tab, setTab] = useState<SubconTab>('overview');
  const dbLoaded = React.useRef(false);

  // Use first allowed project for the subcon
  const projectId = localStorage.getItem('gem_last_project') || 'p1';
  const subconId  = user?.id || 'subcon_default';
  // Standard collection keys — isolation via projectId (one row per project_id+collection in db)
  const collKey = 'subcon_docs';
  const poKey   = 'subcon_pos';

  const [docs, setDocs]       = useState<SubconDocument[]>(SEED_DOCS);
  const [pos,  setPOs]        = useState<SubconPO[]>(SEED_POS);
  const [showDocForm, setShowDocForm]   = useState(false);
  const [showPOAck, setShowPOAck]       = useState<SubconPO|null>(null);
  const [docForm, setDocForm]           = useState<Partial<SubconDocument>>({ type:'khac', status:'draft' });
  const [gemLoading, setGemLoading]     = useState(false);
  const [gemText, setGemText]           = useState('');
  const [notifications, setNotifications] = useState([
    { id:'n1', msg:'PO-2026/002 đã được phát hành — vui lòng xác nhận', time:'2 giờ trước', unread:true },
    { id:'n2', msg:'Đề nghị thanh toán đợt 2 đang chờ QS kiểm tra', time:'1 ngày trước', unread:false },
  ]);

  useEffect(() => {
    dbLoaded.current = false;
    Promise.all([
      db.get<SubconDocument[]>(collKey, projectId, SEED_DOCS),
      db.get<SubconPO[]>(poKey, projectId, SEED_POS),
    ]).then(([savedDocs, savedPOs]) => {
      setDocs(savedDocs); setPOs(savedPOs);
    }).catch(e => console.warn('[SubconPortal] load:', e))
      .finally(() => { dbLoaded.current = true; });
  }, [projectId]);

  const totalPOValue    = pos.reduce((s, p) => s + p.value, 0);
  const completedPOValue= pos.filter(p => p.status === 'completed').reduce((s, p) => s + p.value, 0);
  const pendingDocs     = docs.filter(d => d.status === 'submitted').length;
  const unreadNotifs    = notifications.filter(n => n.unread).length;

  const fmtVnd = (v: number) => `${(v/1e9).toFixed(3)} tỷ`;

  const handleSubmitDoc = () => {
    if (!docForm.title?.trim()) { notifErr('Vui lòng nhập tiêu đề!'); return; }
    const newDoc: SubconDocument = {
      id: 'doc_' + Date.now(),
      title: docForm.title!,
      type: docForm.type as SubconDocument['type'] ?? 'khac',
      status: 'submitted',
      submitted_at: new Date().toLocaleDateString('vi-VN'),
      notes: docForm.notes,
    };
    setDocs(prev => {
      const next = [newDoc, ...prev];
      if (dbLoaded.current) db.set(collKey, projectId, next);
      return next;
    });
    setShowDocForm(false);
    setDocForm({ type:'khac', status:'draft' });
    notifOk('Đã nộp hồ sơ — chờ Ban QLDA xem xét');
  };

  const handleAckPO = (po: SubconPO) => {
    setPOs(prev => {
      const next = prev.map(p => p.id === po.id ? {...p, status: 'acknowledged' as const} : p);
      if (dbLoaded.current) db.set(poKey, projectId, next);
      return next;
    });
    setShowPOAck(null);
    notifOk(`Đã xác nhận ${po.po_number}`);
    setNotifications(prev => prev.map(n => n.id === 'n1' ? {...n, unread:false} : n));
  };

  const analyzeWithGEM = async () => {
    setGemLoading(true); setGemText('');
    try {
      const model = genAI.getGenerativeModel({ model: GEM_MODEL });
      const r = await model.generateContent(
        `Tổng hợp tình trạng nhà thầu phụ:\n` +
        `- Tổng giá trị PO: ${fmtVnd(totalPOValue)}\n` +
        `- Đã hoàn thành: ${fmtVnd(completedPOValue)}\n` +
        `- Hồ sơ chờ duyệt: ${pendingDocs}\n` +
        `- PO chờ xác nhận: ${pos.filter(p=>p.status==='sent').length}\n` +
        `Nhận xét tình trạng và khuyến nghị bước tiếp theo. Ngắn gọn, tiếng Việt.`
      );
      setGemText(r.response.text());
    } catch { setGemText('❌ Không kết nối được GEM.'); }
    setGemLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center shrink-0">
            <Building2 size={18} className="text-white"/>
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-800">NTP Portal</h1>
            <p className="text-[10px] text-teal-600 font-semibold">GEM & CLAUDE PM Pro</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button className="p-2 hover:bg-slate-100 rounded-xl relative">
              <Bell size={16} className="text-slate-500"/>
              {unreadNotifs > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-rose-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full">{unreadNotifs}</span>
              )}
            </button>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <User size={14}/>
            <span className="font-semibold">{user?.full_name || 'NTP Phúc Thành'}</span>
          </div>
          <button onClick={signOut} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-xl">
            <LogOut size={13}/> Đăng xuất
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {/* Project badge */}
        <div className="bg-teal-600 text-white rounded-2xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold opacity-75">Dự án được gán</p>
            <p className="text-base font-black mt-0.5">Villa PAT — HCMC 2026</p>
            <p className="text-xs opacity-75 mt-0.5">Gói thầu: Thi công phần móng & cấu kiện bê tông</p>
          </div>
          <ShieldCheck size={28} className="opacity-60"/>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1.5 bg-white border border-slate-200 rounded-2xl p-2 overflow-x-auto">
          {([
            ['overview','Tổng quan', Building2],
            ['scope','Phạm vi', FileText],
            ['documents','Hồ sơ', Upload],
            ['payments','Thanh toán', DollarSign],
            ['pos','Lệnh mua PO', Package],
          ] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                tab === id ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}>
              <Icon size={13}/>{label}
              {id === 'documents' && pendingDocs > 0 && <span className="bg-white/30 text-[9px] font-bold px-1.5 rounded-full">{pendingDocs}</span>}
              {id === 'pos' && pos.filter(p=>p.status==='sent').length > 0 && <span className="bg-white/30 text-[9px] font-bold px-1.5 rounded-full">{pos.filter(p=>p.status==='sent').length}</span>}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ────────────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label:'Tổng PO',         val: fmtVnd(totalPOValue),     cls:'bg-blue-50 text-blue-700' },
                { label:'Đã nghiệm thu',   val: fmtVnd(completedPOValue), cls:'bg-emerald-50 text-emerald-700' },
                { label:'Hồ sơ chờ duyệt', val: String(pendingDocs),      cls: pendingDocs > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-600' },
                { label:'PO chờ xác nhận', val: String(pos.filter(p=>p.status==='sent').length), cls:'bg-violet-50 text-violet-700' },
              ].map(k => (
                <div key={k.label} className={`${k.cls} rounded-2xl px-4 py-3 text-center`}>
                  <p className="text-lg font-black">{k.val}</p>
                  <p className="text-[10px] font-semibold mt-0.5">{k.label}</p>
                </div>
              ))}
            </div>

            {/* Notifications */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><Bell size={14} className="text-teal-600"/>Thông báo</h3>
              <div className="space-y-2">
                {notifications.map(n => (
                  <div key={n.id} className={`flex items-start gap-3 p-3 rounded-xl ${n.unread ? 'bg-teal-50 border border-teal-200' : 'bg-slate-50'}`}>
                    <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${n.unread ? 'bg-teal-500' : 'bg-slate-300'}`}/>
                    <div className="flex-1">
                      <p className="text-xs text-slate-700">{n.msg}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{n.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* GEM Analysis */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2"><Sparkles size={14} className="text-violet-600"/>Phân tích GEM</h3>
                <button onClick={analyzeWithGEM} disabled={gemLoading}
                  className="flex items-center gap-1 px-3 py-1.5 bg-violet-100 text-violet-700 rounded-lg text-xs font-bold hover:bg-violet-200 disabled:opacity-50">
                  {gemLoading ? '...' : 'Phân tích'}
                </button>
              </div>
              {gemText && <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{gemText}</p>}
              {!gemText && !gemLoading && <p className="text-xs text-slate-400 text-center py-4">Nhấn Phân tích để GEM tóm tắt tình trạng hợp đồng</p>}
            </div>
          </div>
        )}

        {/* ── SCOPE ───────────────────────────────────────────────────────── */}
        {tab === 'scope' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-700">Phạm vi công việc được giao</h3>
            {[
              { work:'Thi công cọc khoan nhồi D600', qty:'45 cọc', unit:'Cọc', progress:100, status:'Hoàn thành' },
              { work:'Thi công đài móng M1-M12', qty:'12 đài', unit:'Đài', progress:65, status:'Đang thi công' },
              { work:'Thi công giằng móng GB1-GB8', qty:'8 giằng', unit:'Giằng', progress:40, status:'Đang thi công' },
              { work:'Thi công cột tầng hầm B1', qty:'24 cột', unit:'Cột', progress:0, status:'Chưa bắt đầu' },
            ].map((w, i) => (
              <div key={i} className="border border-slate-200 rounded-xl p-3">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="text-xs font-bold text-slate-800">{w.work}</p>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                    w.status === 'Hoàn thành' ? 'bg-emerald-100 text-emerald-700' :
                    w.status === 'Đang thi công' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-500'
                  }`}>{w.status}</span>
                </div>
                <p className="text-[10px] text-slate-500 mb-2">{w.qty} {w.unit}</p>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${w.progress === 100 ? 'bg-emerald-500' : w.progress > 0 ? 'bg-amber-400' : 'bg-slate-200'}`}
                    style={{width:`${w.progress}%`}}/>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 text-right">{w.progress}%</p>
              </div>
            ))}
          </div>
        )}

        {/* ── DOCUMENTS ───────────────────────────────────────────────────── */}
        {tab === 'documents' && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button onClick={() => setShowDocForm(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold hover:bg-teal-700">
                <Plus size={13}/> Nộp hồ sơ mới
              </button>
            </div>
            {docs.map(d => (
              <div key={d.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${DOC_STATUS_CFG[d.status].cls}`}>{DOC_STATUS_CFG[d.status].label}</span>
                    <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">{TYPE_LABEL[d.type]}</span>
                  </div>
                  <p className="text-sm font-bold text-slate-800 truncate">{d.title}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Nộp: {d.submitted_at}{d.notes && ` · ${d.notes}`}</p>
                  {d.file_name && (
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-blue-600">
                      <FileText size={10}/>{d.file_name}
                    </div>
                  )}
                </div>
                {d.status === 'approved' && <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-1"/>}
                {d.status === 'rejected' && <AlertTriangle size={18} className="text-rose-500 shrink-0 mt-1"/>}
                {d.status === 'submitted' && <Clock size={18} className="text-amber-500 shrink-0 mt-1"/>}
              </div>
            ))}
          </div>
        )}

        {/* ── PAYMENTS ────────────────────────────────────────────────────── */}
        {tab === 'payments' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3">Tình trạng thanh toán</h3>
              <div className="space-y-3">
                {[
                  { period:'Đợt 1 — Hoàn thành cọc', amount:900_000_000, status:'paid', date:'15/02/2026' },
                  { period:'Đợt 2 — 50% đài móng', amount:710_000_000, status:'pending', date:'Chờ QS duyệt' },
                  { period:'Đợt 3 — Hoàn thành móng', amount:860_000_000, status:'upcoming', date:'Dự kiến 30/04' },
                ].map((p, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50">
                    <div>
                      <p className="text-xs font-bold text-slate-700">{p.period}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{p.date}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-800">{(p.amount/1e9).toFixed(3)} tỷ</p>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        p.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                        p.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-500'
                      }`}>{p.status === 'paid' ? 'Đã TT' : p.status === 'pending' ? 'Chờ duyệt' : 'Sắp tới'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── PO ──────────────────────────────────────────────────────────── */}
        {tab === 'pos' && (
          <div className="space-y-3">
            {pos.map(po => (
              <div key={po.id} className={`bg-white border rounded-2xl p-4 ${po.status === 'sent' ? 'border-violet-200 bg-violet-50/30' : 'border-slate-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${PO_STATUS_CFG[po.status].cls}`}>{PO_STATUS_CFG[po.status].label}</span>
                      <span className="text-xs font-black text-slate-700">{po.po_number}</span>
                    </div>
                    <p className="text-xs text-slate-700">{po.description}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Phát hành: {po.issued_date} · Hạn: {po.due_date}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-slate-800">{(po.value/1e9).toFixed(3)} tỷ</p>
                    {po.status === 'sent' && (
                      <button onClick={() => setShowPOAck(po)}
                        className="mt-1 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-[10px] font-bold hover:bg-teal-700">
                        Xác nhận
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── MODALS — DS 5.2 cuối component ─────────────────────────────────── */}
      <ModalForm
        open={showDocForm}
        onClose={() => setShowDocForm(false)}
        title="Nộp hồ sơ / Tài liệu"
        subtitle="Gửi cho Ban quản lý dự án xem xét"
        icon={<Upload size={18}/>}
        color="teal"
        width="md"
        footer={<><BtnCancel onClick={() => setShowDocForm(false)}/><BtnSubmit label="Nộp hồ sơ" onClick={handleSubmitDoc}/></>}
      >
        <FormGrid cols={2}>
          <div className="col-span-2"><FormRow label="Tiêu đề *">
            <input className={inputCls} placeholder="VD: Đề nghị thanh toán đợt 3" value={docForm.title ?? ''} onChange={e => setDocForm(p => ({...p, title: e.target.value}))}/>
          </FormRow></div>
          <div className="col-span-2"><FormRow label="Loại tài liệu">
            <select className={selectCls} value={docForm.type} onChange={e => setDocForm(p => ({...p, type: e.target.value as SubconDocument['type']}))}>
              {(Object.entries(TYPE_LABEL) as [SubconDocument['type'], string][]).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </FormRow></div>
          <div className="col-span-2"><FormRow label="Ghi chú">
            <textarea rows={2} className={inputCls + ' resize-none'} value={docForm.notes ?? ''} onChange={e => setDocForm(p => ({...p, notes: e.target.value}))}/>
          </FormRow></div>
        </FormGrid>
      </ModalForm>

      <ModalForm
        open={!!showPOAck}
        onClose={() => setShowPOAck(null)}
        title="Xác nhận nhận PO"
        subtitle={showPOAck?.po_number || ''}
        icon={<Package size={18}/>}
        color="teal"
        width="sm"
        footer={<><BtnCancel onClick={() => setShowPOAck(null)}/><BtnSubmit label="Xác nhận đã nhận PO" onClick={() => showPOAck && handleAckPO(showPOAck)}/></>}
      >
        <div className="text-sm text-slate-700 space-y-2">
          <p><strong>{showPOAck?.description}</strong></p>
          <p>Giá trị: <strong className="text-teal-700">{showPOAck ? (showPOAck.value/1e9).toFixed(3) : 0} tỷ đ</strong></p>
          <p className="text-xs text-slate-500">Bằng cách xác nhận, bạn đồng ý thực hiện công việc theo đúng phạm vi và thời hạn trong PO.</p>
        </div>
      </ModalForm>
    </div>
  );
}
