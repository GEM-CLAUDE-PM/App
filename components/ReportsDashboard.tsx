import { genAI, GEM_MODEL, GEM_MODEL_QUALITY } from './gemini';
import { useNotification } from './NotificationEngine';
import React, { useState, useRef, useCallback } from 'react';
import {
  FileText, ClipboardList, Download, Printer, Sparkles, Loader2,
  Plus, X, Save, Calendar, Clock, BarChart2, TrendingUp, Users,
  AlertTriangle, CheckCircle2, Eye, Copy, ChevronDown, BookOpen,
  UploadCloud, FileSpreadsheet, Activity, Flag, Building2,
  Zap, Target, HardHat, Edit3, RefreshCw
} from 'lucide-react';

import type { DashboardProps } from './types';

type Props = DashboardProps & {
  generateWeeklyReport?:  () => Promise<void>;
  isGeneratingReport?:    boolean;
  generatedReport?:       string | null;
  isConnectedOneDrive?:   boolean;
  isConnectedGoogleDrive?: boolean;
};

const GEM_REPORT_SYS = `Bạn là Nàng GEM Siêu Việt — chuyên gia lập báo cáo xây dựng chuẩn TCXDVN. Xưng "em", gọi "Anh/Chị". Soạn báo cáo chuyên nghiệp, đầy đủ số liệu, theo đúng format yêu cầu. Sử dụng tiếng Việt chuẩn mực.`;

// ─── Report templates metadata ────────────────────────────────────────────────
const TEMPLATES = [
  {
    id: 'daily',
    name: 'Nhật ký công trường',
    desc: 'Báo cáo ngày — nhân lực, khối lượng, thời tiết, sự cố',
    icon: <Calendar size={20} className="text-blue-600"/>,
    cls: 'border-blue-200 bg-blue-50',
    badge: 'HÀNG NGÀY',
    badgeCls: 'bg-blue-100 text-blue-700',
    format: 'A4',
    fields: ['Ngày báo cáo','Thời tiết','Nhân lực (tổng)', 'Hạng mục thi công hôm nay','Khối lượng hoàn thành','Thiết bị hoạt động','Vật tư nhập/xuất','Sự cố / An toàn','Kế hoạch ngày mai'],
  },
  {
    id: 'weekly',
    name: 'Báo cáo tiến độ tuần',
    desc: 'Tổng hợp tuần — tiến độ, nhân lực, vật tư, vấn đề tồn đọng',
    icon: <BarChart2 size={20} className="text-emerald-600"/>,
    cls: 'border-emerald-200 bg-emerald-50',
    badge: 'HÀNG TUẦN',
    badgeCls: 'bg-emerald-100 text-emerald-700',
    format: 'A3',
    fields: ['Tuần số / Kỳ báo cáo','Tiến độ tổng thể (%)','Tiến độ kế hoạch (%)','Lệch tiến độ','Nhân lực trung bình/ngày','Hạng mục hoàn thành trong tuần','Vấn đề tồn đọng','Kế hoạch tuần tới'],
  },
  {
    id: 'monthly',
    name: 'Báo cáo tháng — GĐ DA',
    desc: 'Báo cáo tháng cho Ban QLDA — tiến độ, tài chính, HSE, EVM',
    icon: <TrendingUp size={20} className="text-violet-600"/>,
    cls: 'border-violet-200 bg-violet-50',
    badge: 'HÀNG THÁNG',
    badgeCls: 'bg-violet-100 text-violet-700',
    format: 'A3',
    fields: ['Tháng báo cáo','Tóm tắt điều hành','Tiến độ tổng thể & EVM','Tài chính: giải ngân / dòng tiền','HSE: sự cố / vi phạm / huấn luyện','Vật tư: nhập / tồn / thiếu','Hợp đồng: thanh toán / VO','Rủi ro & kiến nghị'],
  },
  {
    id: 'hse',
    name: 'Báo cáo HSE định kỳ',
    desc: 'Báo cáo An toàn – Sức khoẻ – Môi trường theo mẫu Sở LĐTBXH',
    icon: <HardHat size={20} className="text-amber-600"/>,
    cls: 'border-amber-200 bg-amber-50',
    badge: 'AN TOÀN',
    badgeCls: 'bg-amber-100 text-amber-700',
    format: 'A4',
    fields: ['Kỳ báo cáo','Số ngày không tai nạn (LTI)','Tai nạn lao động (số vụ / mức độ)','Vi phạm AT (số / phân loại)','Huấn luyện: số lượt / nội dung','Kiểm tra môi trường','Biện pháp khắc phục đang thực hiện'],
  },
  {
    id: 'qs',
    name: 'Báo cáo QS – Tài chính',
    desc: 'Báo cáo khối lượng, thanh toán, Variation Orders, dòng tiền',
    icon: <FileSpreadsheet size={20} className="text-indigo-600"/>,
    cls: 'border-indigo-200 bg-indigo-50',
    badge: 'QS / TÀI CHÍNH',
    badgeCls: 'bg-indigo-100 text-indigo-700',
    format: 'A3',
    fields: ['Kỳ thanh toán','Khối lượng nghiệm thu đợt này','Giá trị đề nghị thanh toán','Variation Orders phát sinh','Tổng giá trị HĐ điều chỉnh','Công nợ còn lại','Dự báo dòng tiền 3 tháng tới'],
  },
  {
    id: 'handover',
    name: 'Biên bản nghiệm thu bàn giao',
    desc: 'Biên bản nghiệm thu theo TCVN — đầy đủ chữ ký các bên',
    icon: <CheckCircle2 size={20} className="text-teal-600"/>,
    cls: 'border-teal-200 bg-teal-50',
    badge: 'NGHIỆM THU',
    badgeCls: 'bg-teal-100 text-teal-700',
    format: 'A4',
    fields: ['Hạng mục nghiệm thu','Căn cứ pháp lý / TCVN áp dụng','Thành phần tham dự','Kết quả kiểm tra','Kết luận (đạt / không đạt)','Yêu cầu sửa chữa (nếu có)','Chữ ký các bên'],
  },
];

// ─── Saved report history ─────────────────────────────────────────────────────
const MOCK_HISTORY = [
  { id:'r1', type:'weekly',  title:'Báo cáo tuần 9/2026',          date:'03/03/2026', by:'Trần Văn B',   pages:2, status:'signed'   },
  { id:'r2', type:'daily',   title:'Nhật ký công trường 05/03',     date:'05/03/2026', by:'Phạm Minh Q',  pages:1, status:'draft'    },
  { id:'r3', type:'monthly', title:'Báo cáo tháng 2/2026',          date:'01/03/2026', by:'Nguyễn Thị L', pages:4, status:'signed'   },
  { id:'r4', type:'hse',     title:'Báo cáo HSE tháng 2/2026',      date:'28/02/2026', by:'Lê Văn Hải',   pages:2, status:'signed'   },
  { id:'r5', type:'qs',      title:'Báo cáo thanh toán đợt 3',      date:'25/02/2026', by:'Minh Tuấn QS', pages:3, status:'pending'  },
];

type ViewMode = 'templates' | 'history' | 'compose';

const STATUS_CLS: Record<string,string> = {
  signed:  'bg-emerald-100 text-emerald-700',
  draft:   'bg-slate-100 text-slate-600',
  pending: 'bg-amber-100 text-amber-700',
};
const STATUS_LABEL: Record<string,string> = { signed:'Đã ký', draft:'Nháp', pending:'Chờ duyệt' };

export default function ReportsDashboard({ project: selectedProject }: Props) {
  const { ok: notifOk, err: notifErr, warn: notifWarn, info: notifInfo } = useNotification();
  const [view, setView] = useState<ViewMode>('templates');
  const [selectedTpl, setSelectedTpl] = useState<typeof TEMPLATES[0]|null>(null);
  const [history] = useState(MOCK_HISTORY);
  const [formData, setFormData] = useState<Record<string,string>>({});
  const [gemLoading, setGemLoading] = useState(false);
  const [gemReport, setGemReport] = useState('');
  const [printReady, setPrintReady] = useState(false);
  const [expandedId, setExpandedId] = useState<string|null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const openTemplate = (tpl: typeof TEMPLATES[0]) => {
    setSelectedTpl(tpl);
    setFormData({});
    setGemReport('');
    setPrintReady(false);
    setView('compose');
  };

  const generateReport = useCallback(async () => {
    if (!selectedTpl) return;
    setGemLoading(true); setGemReport('');
    try {
      const model = genAI.getGenerativeModel({ model: GEM_MODEL_QUALITY, systemInstruction: GEM_REPORT_SYS });
      const filledFields = selectedTpl.fields.map(f => `${f}: ${formData[f] || '[Chưa nhập]'}`).join('\n');
      const prompt = `Soạn ${selectedTpl.name} cho dự án xây dựng:\nDự án: ${selectedProject?.name || 'Villa PAT'}\nĐịa chỉ: ${selectedProject?.address || 'TP. HCM'}\n\nThông tin:\n${filledFields}\n\nYêu cầu: Soạn báo cáo đầy đủ theo chuẩn TCXDVN, format ${selectedTpl.format}, chuyên nghiệp, có đầy đủ tiêu đề, bảng biểu, kết luận và chữ ký. Điền số liệu hợp lý nếu trường trống.`;
      const r = await model.generateContent(prompt);
      setGemReport(r.response.text());
      setPrintReady(true);
    } catch { setGemReport('❌ Không kết nối được GEM. Vui lòng thử lại.'); }
    setGemLoading(false);
  }, [selectedTpl, formData, selectedProject]);

  const handlePrint = () => {
    if (!printRef.current) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>${selectedTpl?.name || 'Báo cáo'}</title>
      <style>body{font-family:Arial,sans-serif;font-size:12px;line-height:1.6;max-width:210mm;margin:auto;padding:20mm}
      pre{white-space:pre-wrap;font-family:Arial,sans-serif}
      @page{size:${selectedTpl?.format==='A3'?'A3':'A4'};margin:20mm}
      @media print{body{margin:0;padding:15mm}}
      </style></head><body><pre>${gemReport}</pre></body></html>`);
    w.document.close(); w.print();
  };

  const typeIcon = (type: string) => {
    const t = TEMPLATES.find(x=>x.id===type);
    return t ? t.icon : <FileText size={16}/>;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <ClipboardList size={20} className="text-rose-600"/>
          Báo cáo — {selectedProject?.name||'Dự án'}
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">Templates chuẩn TCXDVN · GEM soạn tự động · Xuất PDF / In A3/A4</p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
        {[
          { id:'templates' as ViewMode, label:'📋 Templates', icon:null },
          { id:'history'   as ViewMode, label:'🗂 Lịch sử', icon:null },
        ].map(t=>(
          <button key={t.id} onClick={()=>setView(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${view===t.id?'bg-white shadow-sm text-rose-600':'text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Templates ──────────────────────────────────────────────────────── */}
      {view==='templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {TEMPLATES.map(tpl=>(
            <div key={tpl.id} className={`bg-white border-2 ${tpl.cls} rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group`}
              onClick={()=>openTemplate(tpl)}>
              <div className="flex items-start justify-between mb-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${tpl.cls}`}>{tpl.icon}</div>
                <span className={`text-[10px] font-black px-2 py-1 rounded-full ${tpl.badgeCls} tracking-widest`}>{tpl.badge}</span>
              </div>
              <h3 className="font-bold text-slate-800 mb-1.5">{tpl.name}</h3>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">{tpl.desc}</p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">Format {tpl.format}</span>
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 group-hover:scale-105 transition-transform">
                  <Sparkles size={11}/> GEM soạn
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── History ──────────────────────────────────────────────────────────── */}
      {view==='history' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label:'Tổng báo cáo', val:history.length,                               cls:'bg-rose-100 text-rose-700'    },
              { label:'Đã ký duyệt',  val:history.filter(h=>h.status==='signed').length, cls:'bg-emerald-100 text-emerald-700' },
              { label:'Chờ duyệt',    val:history.filter(h=>h.status==='pending').length,cls:'bg-amber-100 text-amber-700'  },
              { label:'Bản nháp',     val:history.filter(h=>h.status==='draft').length,  cls:'bg-slate-100 text-slate-600'  },
            ].map((k,i)=>(
              <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center mb-3 ${k.cls}`}><FileText size={16}/></div>
                <div className="text-2xl font-bold text-slate-800">{k.val}</div>
                <div className="text-xs text-slate-500 mt-0.5">{k.label}</div>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {history.map(r=>{
              const tpl = TEMPLATES.find(t=>t.id===r.type);
              return (
                <div key={r.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 flex items-center gap-4 hover:border-rose-200 cursor-pointer" onClick={()=>setExpandedId(expandedId===r.id?null:r.id)}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-slate-50 border border-slate-200">
                    {tpl ? tpl.icon : <FileText size={17} className="text-slate-500"/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{r.title}</p>
                    <p className="text-[11px] text-slate-400">{r.date} · {r.by} · {r.pages} trang</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_CLS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                    <button className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200"><Download size={11}/>Tải về</button>
                    <button className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200"><Printer size={11}/>In</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Compose ──────────────────────────────────────────────────────────── */}
      {view==='compose' && selectedTpl && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <button onClick={()=>{setView('templates');setGemReport('');}} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200">
              ← Templates
            </button>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 ${selectedTpl.cls}`}>
              {selectedTpl.icon}
              <span className="font-bold text-slate-800 text-sm">{selectedTpl.name}</span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${selectedTpl.badgeCls}`}>{selectedTpl.format}</span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {/* Input form */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Edit3 size={15} className="text-slate-500"/>Thông tin báo cáo</h3>
              <div className="space-y-3">
                {selectedTpl.fields.map(field=>(
                  <div key={field}>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">{field}</label>
                    <input
                      value={formData[field]||''}
                      onChange={e=>setFormData(p=>({...p,[field]:e.target.value}))}
                      placeholder={`Nhập ${field.toLowerCase()}...`}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-300"
                    />
                  </div>
                ))}
              </div>
              <button onClick={generateReport} disabled={gemLoading}
                className="mt-5 w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-60 shadow-sm">
                {gemLoading ? <><Loader2 size={15} className="animate-spin"/>Nàng GEM đang soạn...</> : <><Sparkles size={15}/>GEM soạn báo cáo tự động</>}
              </button>
            </div>

            {/* Preview */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2"><Eye size={15} className="text-slate-500"/>Xem trước báo cáo</h3>
                {printReady && (
                  <div className="flex gap-2">
                    <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 text-white rounded-lg text-xs font-bold hover:bg-slate-800">
                      <Printer size={11}/>In {selectedTpl.format}
                    </button>
                    <button onClick={()=>{const el=document.createElement('a');el.href='data:text/plain;charset=utf-8,'+encodeURIComponent(gemReport);el.download=selectedTpl.name+'.txt';el.click();}}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700">
                      <Download size={11}/>Tải về
                    </button>
                  </div>
                )}
              </div>
              <div className="flex-1 min-h-64 bg-slate-50 rounded-xl border border-slate-200 p-4 overflow-y-auto" ref={printRef}>
                {gemLoading && (
                  <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-3">
                    <Loader2 size={28} className="animate-spin text-rose-400"/>
                    <p className="text-sm">Nàng GEM đang soạn báo cáo...</p>
                  </div>
                )}
                {!gemLoading && !gemReport && (
                  <div className="flex flex-col items-center justify-center h-40 text-slate-300 gap-3">
                    <FileText size={36}/>
                    <p className="text-sm text-slate-400">Điền thông tin và nhấn GEM soạn báo cáo</p>
                  </div>
                )}
                {gemReport && (
                  <pre className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-sans">{gemReport}</pre>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
