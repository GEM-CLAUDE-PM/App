// ReportsDashboard.tsx — GEM&CLAUDE PM Pro · S11 Rebuild
// 6 loại báo cáo · Gemini auto-write · Data thật từ db.ts · PDF print · persist history

import { genAI, GEM_MODEL_QUALITY } from './gemini';
import { useNotification } from './NotificationEngine';
import { db } from './db';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  FileText, ClipboardList, Download, Printer, Sparkles, Loader2,
  X, Calendar, BarChart2, TrendingUp, HardHat, Edit3, Save,
  FileSpreadsheet, Activity, ChevronLeft, Eye, CheckCircle2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import type { DashboardProps } from './types';

type ReportType = 'daily' | 'weekly' | 'monthly' | 'hse' | 'qs' | 'handover';
type ReportStatus = 'draft' | 'pending' | 'signed';
type ViewMode = 'templates' | 'history' | 'compose';

interface SavedReport {
  id: string; type: ReportType; title: string; content: string;
  date: string; createdBy: string; status: ReportStatus;
  projectId: string; metadata?: Record<string, string>;
}

const GEM_SYS = `Bạn là Nàng GEM Siêu Việt — chuyên gia lập báo cáo xây dựng chuẩn TCXDVN.
Xưng "em", gọi "Anh/Chị". Soạn báo cáo chuyên nghiệp, đầy đủ số liệu, văn phong trang trọng.
Chỉ trả về nội dung báo cáo — không markdown, không code block, không giải thích.`;

const STATUS_META: Record<ReportStatus, { label: string; cls: string }> = {
  signed:  { label: 'Đã ký',     cls: 'bg-emerald-100 text-emerald-700' },
  draft:   { label: 'Bản nháp',  cls: 'bg-slate-100 text-slate-600'     },
  pending: { label: 'Chờ duyệt', cls: 'bg-amber-100 text-amber-700'     },
};

const TEMPLATES = [
  {
    id: 'daily' as ReportType, name: 'Nhật ký công trường', badge: 'HÀNG NGÀY', format: 'A4' as const,
    desc: 'Báo cáo ngày — nhân lực, khối lượng, thời tiết, sự cố',
    bg: 'bg-blue-50 border-blue-200', badgeCls: 'bg-blue-100 text-blue-700',
    icon: <Calendar size={20} className="text-blue-600" />,
    fields: ['Ngày báo cáo','Thời tiết','Nhân lực (tổng)','Hạng mục thi công hôm nay',
             'Khối lượng hoàn thành','Thiết bị hoạt động','Vật tư nhập/xuất','Sự cố / An toàn','Kế hoạch ngày mai'],
  },
  {
    id: 'weekly' as ReportType, name: 'Báo cáo tiến độ tuần', badge: 'HÀNG TUẦN', format: 'A3' as const,
    desc: 'Tổng hợp tuần — tiến độ, nhân lực, vật tư, vấn đề tồn đọng',
    bg: 'bg-emerald-50 border-emerald-200', badgeCls: 'bg-emerald-100 text-emerald-700',
    icon: <BarChart2 size={20} className="text-emerald-600" />,
    fields: ['Tuần số / Kỳ báo cáo','Tiến độ tổng thể (%)','Tiến độ kế hoạch (%)','Lệch tiến độ',
             'Nhân lực trung bình/ngày','Hạng mục hoàn thành trong tuần','Vấn đề tồn đọng','Kế hoạch tuần tới'],
  },
  {
    id: 'monthly' as ReportType, name: 'Báo cáo tháng — GĐ DA', badge: 'HÀNG THÁNG', format: 'A3' as const,
    desc: 'Báo cáo tháng cho Ban QLDA — tiến độ, tài chính, HSE, EVM',
    bg: 'bg-violet-50 border-violet-200', badgeCls: 'bg-violet-100 text-violet-700',
    icon: <TrendingUp size={20} className="text-violet-600" />,
    fields: ['Tháng báo cáo','Tóm tắt điều hành','Tiến độ tổng thể & EVM','Tài chính: giải ngân / dòng tiền',
             'HSE: sự cố / vi phạm / huấn luyện','Vật tư: nhập / tồn / thiếu','Hợp đồng: thanh toán / VO','Rủi ro & kiến nghị'],
  },
  {
    id: 'hse' as ReportType, name: 'Báo cáo HSE định kỳ', badge: 'AN TOÀN', format: 'A4' as const,
    desc: 'Báo cáo An toàn – Sức khoẻ – Môi trường theo mẫu Sở LĐTBXH',
    bg: 'bg-amber-50 border-amber-200', badgeCls: 'bg-amber-100 text-amber-700',
    icon: <HardHat size={20} className="text-amber-600" />,
    fields: ['Kỳ báo cáo','Số ngày không tai nạn (LTI)','Tai nạn lao động (số vụ / mức độ)',
             'Vi phạm AT (số / phân loại)','Huấn luyện: số lượt / nội dung','Kiểm tra môi trường','Biện pháp khắc phục'],
  },
  {
    id: 'qs' as ReportType, name: 'Báo cáo QS – Tài chính', badge: 'QS / TÀI CHÍNH', format: 'A3' as const,
    desc: 'Báo cáo khối lượng, thanh toán, Variation Orders, dòng tiền',
    bg: 'bg-indigo-50 border-indigo-200', badgeCls: 'bg-indigo-100 text-indigo-700',
    icon: <FileSpreadsheet size={20} className="text-indigo-600" />,
    fields: ['Kỳ thanh toán','Khối lượng nghiệm thu đợt này','Giá trị đề nghị thanh toán',
             'Variation Orders phát sinh','Tổng giá trị HĐ điều chỉnh','Công nợ còn lại','Dự báo dòng tiền 3 tháng tới'],
  },
  {
    id: 'handover' as ReportType, name: 'Biên bản nghiệm thu bàn giao', badge: 'NGHIỆM THU', format: 'A4' as const,
    desc: 'Biên bản nghiệm thu theo TCVN — đầy đủ chữ ký các bên',
    bg: 'bg-teal-50 border-teal-200', badgeCls: 'bg-teal-100 text-teal-700',
    icon: <CheckCircle2 size={20} className="text-teal-600" />,
    fields: ['Hạng mục nghiệm thu','Căn cứ pháp lý / TCVN áp dụng','Thành phần tham dự',
             'Kết quả kiểm tra','Kết luận (đạt / không đạt)','Yêu cầu sửa chữa (nếu có)','Chữ ký các bên'],
  },
];

export default function ReportsDashboard({ project }: DashboardProps) {
  const pid = project?.id || 'default';
  const projectName = project?.name || 'Dự án';
  const { ok: notifOk, err: notifErr } = useNotification();

  const [view, setView]               = useState<ViewMode>('templates');
  const [selectedTpl, setSelectedTpl] = useState<typeof TEMPLATES[0] | null>(null);
  const [formData, setFormData]       = useState<Record<string, string>>({});
  const [gemLoading, setGemLoading]   = useState(false);
  const [gemReport, setGemReport]     = useState('');
  const [history, setHistory]         = useState<SavedReport[]>([]);
  const [viewing, setViewing]         = useState<SavedReport | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // ── Live data ──────────────────────────────────────────────────────────────
  const [live, setLive] = useState({
    totalWorkers: 0, presentToday: 0, hseIncidents: 0, hseViolations: 0,
    hseTrainings: 0, matApproved: 0, qsTotal: 0, qsApproved: 0,
    receivable: 0, payable: 0,
  });

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [people, att, inc, vio, tra, mat, qsp, acc, hist] = await Promise.all([
        db.get<any[]>('mp_people',      pid, []),
        db.get<any[]>('mp_attendance',  pid, []),
        db.get<any[]>('hse_incidents',  pid, []),
        db.get<any[]>('hse_violations', pid, []),
        db.get<any[]>('hse_trainings',  pid, []),
        db.get<any[]>('mat_vouchers',   pid, []),
        db.get<any[]>('qs_payments',    pid, []),
        db.get<any[]>('acc_debts',      pid, []),
        db.get<SavedReport[]>('reports_history', pid, []),
      ]);
      setLive({
        totalWorkers: people.filter((p:any) => p.status === 'active').length,
        presentToday: att.filter((a:any) => a.date === today && a.status === 'present').length,
        hseIncidents: inc.length,
        hseViolations: vio.length,
        hseTrainings: tra.filter((t:any) => t.status === 'completed').length,
        matApproved:  mat.filter((v:any) => v.status === 'approved').length,
        qsTotal:      qsp.length,
        qsApproved:   qsp.filter((p:any) => p.status === 'approved').length,
        receivable:   acc.filter((d:any) => d.type === 'receivable').reduce((s:number,d:any) => s+(d.total-d.paid), 0),
        payable:      acc.filter((d:any) => d.type === 'payable').reduce((s:number,d:any) => s+(d.total-d.paid), 0),
      });
      setHistory(hist.filter((r:SavedReport) => r.projectId === pid));
    })();
  }, [pid]);

  const buildCtx = useCallback((type: ReportType) => {
    const base = `DỰ ÁN: ${projectName}\nNGÀY: ${new Date().toLocaleDateString('vi-VN')}\n`;
    const mp = `NHÂN LỰC: ${live.totalWorkers} người, có mặt ${live.presentToday}\n`;
    const hse = `HSE: ${live.hseIncidents} sự cố, ${live.hseViolations} vi phạm, ${live.hseTrainings} buổi huấn luyện\n`;
    const fin = `QS: ${live.qsApproved}/${live.qsTotal} TT đã duyệt · Phải thu ${live.receivable.toFixed(2)} tỷ · Phải trả ${live.payable.toFixed(2)} tỷ\n`;
    const mat = `VẬT TƯ: ${live.matApproved} phiếu đã duyệt\n`;
    if (type === 'hse') return base + hse;
    if (type === 'qs')  return base + fin;
    if (type === 'monthly') return base + mp + hse + fin;
    return base + mp + hse + mat;
  }, [live, projectName]);

  const generateReport = useCallback(async () => {
    if (!selectedTpl) return;
    setGemLoading(true); setGemReport('');
    try {
      const model = genAI.getGenerativeModel({ model: GEM_MODEL_QUALITY, systemInstruction: GEM_SYS });
      const ctx = buildCtx(selectedTpl.id);
      const filled = selectedTpl.fields.map(f => `${f}: ${formData[f] || '[Tự điền từ data]'}`).join('\n');
      const r = await model.generateContent(
        `${ctx}\nMẪU: ${selectedTpl.name} (${selectedTpl.format})\nTHÔNG TIN:\n${filled}\n\nSoạn báo cáo hoàn chỉnh chuẩn TCXDVN.`
      );
      setGemReport(r.response.text());
      notifOk('GEM soạn xong!');
    } catch { notifErr('Lỗi kết nối GEM'); setGemReport('❌ Lỗi kết nối GEM. Thử lại.'); }
    setGemLoading(false);
  }, [selectedTpl, formData, buildCtx]);

  const saveReport = useCallback(async (status: ReportStatus) => {
    if (!selectedTpl || !gemReport) return;
    const rpt: SavedReport = {
      id: `rpt_${Date.now()}`, type: selectedTpl.id,
      title: `${selectedTpl.name} — ${formData[selectedTpl.fields[0]] || new Date().toLocaleDateString('vi-VN')}`,
      content: gemReport, date: new Date().toLocaleDateString('vi-VN'),
      createdBy: 'Người dùng', status, projectId: pid, metadata: formData,
    };
    const next = [rpt, ...history];
    setHistory(next);
    await db.set('reports_history', pid, next);
    notifOk(status === 'signed' ? 'Đã ký duyệt!' : 'Đã lưu nháp!');
    setView('history');
  }, [selectedTpl, gemReport, formData, history, pid]);

  const doPrint = useCallback((content: string, title: string, format: string) => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>${title}</title>
    <style>body{font-family:"Times New Roman",serif;font-size:13px;line-height:1.8;padding:20mm 25mm}
    pre{white-space:pre-wrap;font-family:inherit}
    .hd{text-align:center;font-weight:bold;text-transform:uppercase;margin-bottom:16px;padding-bottom:10px;border-bottom:2px solid #000}
    @page{size:${format === 'A3' ? 'A3' : 'A4'};margin:20mm}</style></head>
    <body><div class="hd">GEM&CLAUDE PM Pro — ${projectName}</div><pre>${content}</pre></body></html>`);
    w.document.close(); setTimeout(() => { w.focus(); w.print(); }, 300);
  }, [projectName]);

  const doExport = (content: string, title: string) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    a.download = `${title}.txt`; a.click();
  };

  const openTemplate = (tpl: typeof TEMPLATES[0]) => {
    setSelectedTpl(tpl); setFormData({}); setGemReport(''); setView('compose');
  };

  // Charts
  const byType = TEMPLATES.map(t => ({ name: t.badge.split('/')[0].trim(), count: history.filter(r => r.type === t.id).length })).filter(x => x.count > 0);
  const byStatus = [
    { name: 'Đã ký', value: history.filter(r => r.status === 'signed').length, fill: '#10b981' },
    { name: 'Chờ duyệt', value: history.filter(r => r.status === 'pending').length, fill: '#f59e0b' },
    { name: 'Nháp', value: history.filter(r => r.status === 'draft').length, fill: '#94a3b8' },
  ].filter(x => x.value > 0);

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <ClipboardList size={20} className="text-rose-600" /> Báo cáo — {projectName}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">6 templates TCXDVN · GEM soạn từ data thật · {history.length} báo cáo đã lưu</p>
          </div>
        </div>
        {/* KPI strip */}
        <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2">
          {[
            ['Có mặt', `${live.presentToday}/${live.totalWorkers}`, 'bg-blue-50 text-blue-700'],
            ['Sự cố HSE', live.hseIncidents, 'bg-amber-50 text-amber-700'],
            ['Vi phạm AT', live.hseViolations, 'bg-red-50 text-red-700'],
            ['TT đã duyệt', `${live.qsApproved}/${live.qsTotal}`, 'bg-emerald-50 text-emerald-700'],
            ['Phải thu (tỷ)', live.receivable.toFixed(1), 'bg-violet-50 text-violet-700'],
          ].map(([label, val, cls], i) => (
            <div key={i} className={`rounded-xl px-3 py-2 ${cls}`}>
              <div className="text-lg font-bold">{val}</div>
              <div className="text-[10px] font-semibold opacity-70">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Nav tabs */}
      {view !== 'compose' && (
        <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
          {([['templates', '📋 Templates'], ['history', '🗂 Lịch sử']] as [ViewMode, string][]).map(([id, label]) => (
            <button key={id} onClick={() => setView(id)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${view === id ? 'bg-white shadow-sm text-rose-600' : 'text-slate-500 hover:text-slate-700'}`}>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* === TEMPLATES === */}
      {view === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {TEMPLATES.map(tpl => (
            <div key={tpl.id} onClick={() => openTemplate(tpl)}
              className={`bg-white border-2 ${tpl.bg} rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group`}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-11 h-11 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center">{tpl.icon}</div>
                <span className={`text-[10px] font-black px-2 py-1 rounded-full tracking-widest ${tpl.badgeCls}`}>{tpl.badge}</span>
              </div>
              <h3 className="font-bold text-slate-800 mb-1">{tpl.name}</h3>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">{tpl.desc}</p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 bg-white border border-slate-200 px-2 py-1 rounded-lg">Format {tpl.format}</span>
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 group-hover:scale-105 transition-transform shadow-sm">
                  <Sparkles size={11} /> GEM soạn
                </button>
              </div>
              {history.filter(r => r.type === tpl.id).length > 0 && (
                <p className="mt-2 text-[10px] text-slate-400">📄 {history.filter(r => r.type === tpl.id).length} đã lưu</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* === HISTORY === */}
      {view === 'history' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ['Tổng', history.length, 'text-rose-600'],
              ['Đã ký', history.filter(r => r.status === 'signed').length, 'text-emerald-600'],
              ['Chờ duyệt', history.filter(r => r.status === 'pending').length, 'text-amber-600'],
              ['Nháp', history.filter(r => r.status === 'draft').length, 'text-slate-500'],
            ].map(([label, val, cls], i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center">
                <div className={`text-2xl font-bold ${cls}`}>{val}</div>
                <div className="text-xs text-slate-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {history.length > 1 && (
            <div className="grid md:grid-cols-2 gap-4">
              {byType.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Theo loại</p>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={byType} barSize={24}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#e11d48" radius={[4,4,0,0]} name="Số lượng" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {byStatus.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Trạng thái</p>
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie data={byStatus} dataKey="value" cx="50%" cy="50%" outerRadius={55}
                        label={({ name, value }) => `${name}:${value}`} labelLine={false}>
                        {byStatus.map((s, i) => <Cell key={i} fill={s.fill} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {history.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <FileText size={40} className="text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Chưa có báo cáo. Chọn template để bắt đầu.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map(r => {
                const tpl = TEMPLATES.find(t => t.id === r.type);
                return (
                  <div key={r.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 flex items-center gap-3 hover:border-rose-200 hover:shadow-md transition-all">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                      {tpl?.icon ?? <FileText size={16} className="text-slate-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{r.title}</p>
                      <p className="text-[11px] text-slate-400">{r.date} · {r.createdBy}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${STATUS_META[r.status].cls}`}>{STATUS_META[r.status].label}</span>
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => setViewing(r)} className="px-2.5 py-1.5 bg-slate-100 rounded-lg text-xs font-bold hover:bg-slate-200 flex items-center gap-1"><Eye size={11}/>Xem</button>
                      <button onClick={() => tpl && doPrint(r.content, r.title, tpl.format)} className="px-2.5 py-1.5 bg-slate-100 rounded-lg text-xs font-bold hover:bg-slate-200 flex items-center gap-1"><Printer size={11}/>In</button>
                      <button onClick={() => doExport(r.content, r.title)} className="px-2.5 py-1.5 bg-slate-100 rounded-lg text-xs font-bold hover:bg-slate-200 flex items-center gap-1"><Download size={11}/>Tải</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* === COMPOSE === */}
      {view === 'compose' && selectedTpl && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={() => { setView('templates'); setGemReport(''); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200">
              <ChevronLeft size={14}/> Templates
            </button>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 ${selectedTpl.bg}`}>
              {selectedTpl.icon}
              <span className="font-bold text-slate-800 text-sm">{selectedTpl.name}</span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${selectedTpl.badgeCls}`}>{selectedTpl.format}</span>
            </div>
          </div>

          {/* Data context strip */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 text-xs text-blue-700">
            <span className="font-bold mr-2">📊 Data GEM sẽ dùng:</span>
            {buildCtx(selectedTpl.id).split('\n').filter(l => l && !l.startsWith('DỰ ÁN') && !l.startsWith('NGÀY')).join(' · ')}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Form */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Edit3 size={14} className="text-slate-500"/>Thông tin bổ sung</h3>
              <div className="space-y-3">
                {selectedTpl.fields.map(field => (
                  <div key={field}>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1 block">{field}</label>
                    <input value={formData[field] || ''} onChange={e => setFormData(p => ({ ...p, [field]: e.target.value }))}
                      placeholder="Để trống → GEM tự điền từ data..."
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-300 transition-colors" />
                  </div>
                ))}
              </div>
              <button onClick={generateReport} disabled={gemLoading}
                className="mt-5 w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-60 shadow-sm shadow-rose-200">
                {gemLoading ? <><Loader2 size={15} className="animate-spin"/>Nàng GEM đang soạn...</> : <><Sparkles size={15}/>GEM soạn từ data thật</>}
              </button>
            </div>

            {/* Preview */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-800 flex items-center gap-2"><Eye size={14} className="text-slate-500"/>Xem trước</h3>
                {gemReport && !gemLoading && (
                  <div className="flex gap-1.5 flex-wrap">
                    <button onClick={() => doPrint(gemReport, selectedTpl.name, selectedTpl.format)}
                      className="px-2.5 py-1.5 bg-slate-700 text-white rounded-lg text-xs font-bold hover:bg-slate-800 flex items-center gap-1"><Printer size={11}/>In {selectedTpl.format}</button>
                    <button onClick={() => doExport(gemReport, selectedTpl.name)}
                      className="px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 flex items-center gap-1"><Download size={11}/>TXT</button>
                    <button onClick={() => saveReport('draft')}
                      className="px-2.5 py-1.5 bg-slate-500 text-white rounded-lg text-xs font-bold hover:bg-slate-600 flex items-center gap-1"><Save size={11}/>Nháp</button>
                    <button onClick={() => saveReport('signed')}
                      className="px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 flex items-center gap-1"><CheckCircle2 size={11}/>Ký duyệt</button>
                  </div>
                )}
              </div>
              <div className="flex-1 min-h-72 bg-slate-50 rounded-xl border border-slate-200 p-4 overflow-y-auto" ref={printRef}>
                {gemLoading && (
                  <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-400">
                    <Loader2 size={28} className="animate-spin text-rose-400"/>
                    <p className="text-sm">Nàng GEM đang soạn...</p>
                  </div>
                )}
                {!gemLoading && !gemReport && (
                  <div className="flex flex-col items-center justify-center h-48 gap-2 text-slate-300">
                    <FileText size={36}/>
                    <p className="text-sm text-slate-400">Nhấn "GEM soạn" để tạo báo cáo</p>
                    <p className="text-xs text-slate-300">Có thể để trống form — GEM tự điền từ data</p>
                  </div>
                )}
                {gemReport && !gemLoading && (
                  <pre className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-sans">{gemReport}</pre>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === VIEW MODAL === */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setViewing(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <p className="font-bold text-slate-800">{viewing.title}</p>
                <p className="text-xs text-slate-400">{viewing.date} · {viewing.createdBy}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { const t = TEMPLATES.find(x => x.id === viewing.type); doPrint(viewing.content, viewing.title, t?.format || 'A4'); }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 text-white rounded-lg text-xs font-bold"><Printer size={11}/>In</button>
                <button onClick={() => setViewing(null)} className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center"><X size={16}/></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <pre className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-sans">{viewing.content}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
