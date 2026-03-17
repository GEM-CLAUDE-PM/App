// ReportsDashboard.tsx — GEM&CLAUDE PM Pro · S11 Rebuild
// 12 loại báo cáo nhà thầu · Gemini auto-write · PDF PrintService · Excel SheetJS
// S13: + báo cáo đột xuất/pháp lý | S14: + quyết toán/KPI

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  ClipboardList, Sparkles, Loader2, X, ChevronLeft,
  Eye, Printer, Download, Save, CheckCircle2, FileText,
  BarChart2, Calendar, TrendingUp, HardHat, FileSpreadsheet,
  Package, Wrench, PieChart, Users, Banknote, DollarSign,
  Filter, Search,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart as RechartsPie, Pie, Cell,
} from 'recharts';
import { genAI, GEM_MODEL_QUALITY } from './gemini';
import { useNotification } from './NotificationEngine';
import { db } from './db';
import { PrintHeader } from './PrintService';
import type { DashboardProps } from './types';
import {
  S11_TEMPLATES, STATUS_META, GROUP_META, AUDIENCE_META, GEM_SYS,
  buildGemContext, buildExcelSheets,
  type ReportType, type ReportStatus, type SavedReport,
  type ReportLiveData, type ReportTemplate, type ReportGroup,
} from './ReportTypes';

// ─── Icon map ─────────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ReactNode> = {
  Calendar:      <Calendar     size={20} />,
  BarChart2:     <BarChart2    size={20} />,
  TrendingUp:    <TrendingUp   size={20} />,
  HardHat:       <HardHat      size={20} />,
  FileSpreadsheet:<FileSpreadsheet size={20} />,
  CheckCircle2:  <CheckCircle2 size={20} />,
  DollarSign:    <DollarSign   size={20} />,
  Package:       <Package      size={20} />,
  Wrench:        <Wrench       size={20} />,
  PieChart:      <PieChart     size={20} />,
  Users:         <Users        size={20} />,
  Banknote:      <Banknote     size={20} />,
};

type ViewMode = 'templates' | 'history' | 'compose';

const EMPTY_LIVE: ReportLiveData = {
  totalWorkers: 0, presentToday: 0, avgWorkers: 0, otHoursMonth: 0,
  hseIncidents: 0, hseViolations: 0, hseTrainings: 0, ltiFreedays: 0,
  matApproved: 0, matPending: 0, matValue: 0,
  eqTotal: 0, eqActive: 0, eqMaintenance: 0,
  qsTotal: 0, qsApproved: 0, qsValue: 0,
  receivable: 0, payable: 0, cashflow: 0,
};

// ─── Excel export via SheetJS ─────────────────────────────────────────────────
async function exportExcel(
  sheets: Array<{ name: string; rows: (string | number)[][] }>,
  filename: string,
) {
  // Dynamic import SheetJS
  const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs' as any);
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sheet.rows);
    // Auto column width
    const colWidths = sheet.rows.reduce((acc: number[], row) => {
      row.forEach((cell, i) => {
        const len = String(cell || '').length;
        acc[i] = Math.max(acc[i] || 10, Math.min(len + 2, 50));
      });
      return acc;
    }, []);
    ws['!cols'] = colWidths.map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ─── Print via browser ────────────────────────────────────────────────────────
function doPrint(content: string, title: string, format: string, projectName: string) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html lang="vi"><head>
    <meta charset="UTF-8"><title>${title}</title>
    <style>
      body { font-family: "Times New Roman", serif; font-size: 13px; line-height: 1.8; padding: 20mm 25mm; }
      pre  { white-space: pre-wrap; font-family: inherit; }
      .hd  { text-align: center; font-weight: bold; text-transform: uppercase;
             margin-bottom: 16px; padding-bottom: 10px; border-bottom: 2px solid #000; }
      .sub { text-align: center; font-size: 12px; margin-bottom: 24px; color: #555; }
      @page { size: ${format === 'A3' ? 'A3' : 'A4'}; margin: 20mm; }
    </style></head>
    <body>
      <div class="hd">GEM&CLAUDE PM Pro — ${projectName}</div>
      <div class="sub">${title} — ${new Date().toLocaleDateString('vi-VN')}</div>
      <pre>${content}</pre>
    </body></html>`);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 300);
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function ReportsDashboard({ project }: DashboardProps) {
  const pid         = project?.id   || 'default';
  const projectName = project?.name || 'Dự án';
  const { ok: notifOk, err: notifErr } = useNotification();

  // ── State ──────────────────────────────────────────────────────────────────
  const [view, setView]               = useState<ViewMode>('templates');
  const [selectedTpl, setSelectedTpl] = useState<ReportTemplate | null>(null);
  const [formData, setFormData]       = useState<Record<string, string>>({});
  const [gemLoading, setGemLoading]   = useState(false);
  const [gemReport, setGemReport]     = useState('');
  const [history, setHistory]         = useState<SavedReport[]>([]);
  const [viewing, setViewing]         = useState<SavedReport | null>(null);
  const [live, setLive]               = useState<ReportLiveData>(EMPTY_LIVE);
  const [groupFilter, setGroupFilter]       = useState<ReportGroup | 'all'>('all');
  const [searchQ, setSearchQ]               = useState('');
  const [exporting, setExporting]           = useState(false);
  const [histSearchQ, setHistSearchQ]       = useState('');
  const [histStatusFilter, setHistStatusFilter] = useState<ReportStatus | 'all'>('all');
  const [histTypeFilter, setHistTypeFilter]  = useState<ReportType | 'all'>('all');

  // ── Load live data ─────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const thisMonth = today.slice(0, 7); // YYYY-MM

      const [people, att, inc, vio, tra, mat, eq, qsp, acc, hist] = await Promise.all([
        db.get<any[]>('mp_people',      pid, []),
        db.get<any[]>('mp_attendance',  pid, []),
        db.get<any[]>('hse_incidents',  pid, []),
        db.get<any[]>('hse_violations', pid, []),
        db.get<any[]>('hse_trainings',  pid, []),
        db.get<any[]>('mat_vouchers',   pid, []),
        db.get<any[]>('eq_equipment',   pid, []),
        db.get<any[]>('qs_payments',    pid, []),
        db.get<any[]>('acc_debts',      pid, []),
        db.get<SavedReport[]>('reports_history', pid, []),
      ]);

      const active = people.filter((p: any) => p.status === 'active');
      const monthAtt = att.filter((a: any) => a.date?.startsWith(thisMonth));
      const presentDays = new Set(monthAtt.filter((a: any) => a.status === 'present').map((a: any) => a.date)).size;

      setLive({
        totalWorkers:  active.length,
        presentToday:  att.filter((a: any) => a.date === today && a.status === 'present').length,
        avgWorkers:    presentDays > 0 ? Math.round(monthAtt.filter((a: any) => a.status === 'present').length / presentDays) : 0,
        otHoursMonth:  monthAtt.reduce((s: number, a: any) => s + (a.otHours || 0), 0),
        hseIncidents:  inc.length,
        hseViolations: vio.length,
        hseTrainings:  tra.filter((t: any) => t.status === 'completed').length,
        ltiFreedays:   (() => {
          const sorted = inc.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
          if (!sorted.length) return 0;
          return Math.floor((Date.now() - new Date(sorted[0].date).getTime()) / 86400000);
        })(),
        matApproved:   mat.filter((v: any) => v.status === 'approved').length,
        matPending:    mat.filter((v: any) => v.status === 'pending').length,
        matValue:      mat.filter((v: any) => v.status === 'approved').reduce((s: number, v: any) => s + (v.totalValue || 0), 0) / 1e9,
        eqTotal:       eq.length,
        eqActive:      eq.filter((e: any) => e.status === 'active').length,
        eqMaintenance: eq.filter((e: any) => e.status === 'maintenance').length,
        qsTotal:       qsp.length,
        qsApproved:    qsp.filter((p: any) => p.status === 'approved').length,
        qsValue:       qsp.filter((p: any) => p.status === 'approved').reduce((s: number, p: any) => s + (p.netPayable || 0), 0) / 1e9,
        receivable:    acc.filter((d: any) => d.type === 'receivable').reduce((s: number, d: any) => s + ((d.total || 0) - (d.paid || 0)), 0) / 1e9,
        payable:       acc.filter((d: any) => d.type === 'payable').reduce((s: number, d: any) => s + ((d.total || 0) - (d.paid || 0)), 0) / 1e9,
        cashflow:      0,
      });
      setHistory(hist.filter((r: SavedReport) => r.projectId === pid));
    })();
  }, [pid]);

  // ── Gemini generate ────────────────────────────────────────────────────────
  const generateReport = useCallback(async () => {
    if (!selectedTpl) return;
    setGemLoading(true); setGemReport('');
    try {
      const model  = genAI.getGenerativeModel({ model: GEM_MODEL_QUALITY, systemInstruction: GEM_SYS });
      const ctx    = buildGemContext(selectedTpl.id, live, projectName);
      const filled = selectedTpl.fields.map(f => `${f}: ${formData[f] || '[Tự điền từ data]'}`).join('\n');
      const r = await model.generateContent(
        `${ctx}\nMẪU: ${selectedTpl.name} (${selectedTpl.format})\nTHÔNG TIN:\n${filled}\n\nSoạn báo cáo hoàn chỉnh chuẩn TCXDVN.`
      );
      setGemReport(r.response.text());
      notifOk('GEM soạn xong!');
    } catch {
      notifErr('Lỗi kết nối GEM');
      setGemReport('❌ Lỗi kết nối GEM. Thử lại.');
    }
    setGemLoading(false);
  }, [selectedTpl, formData, live, projectName]);

  // ── Save report ────────────────────────────────────────────────────────────
  const saveReport = useCallback(async (status: ReportStatus) => {
    if (!selectedTpl || !gemReport) return;
    const rpt: SavedReport = {
      id: `rpt_${Date.now()}`,
      type: selectedTpl.id,
      title: `${selectedTpl.name} — ${formData[selectedTpl.fields[0]] || new Date().toLocaleDateString('vi-VN')}`,
      content: gemReport,
      date: new Date().toLocaleDateString('vi-VN'),
      createdBy: 'Người dùng',
      status,
      projectId: pid,
      metadata: formData,
    };
    const next = [rpt, ...history];
    setHistory(next);
    await db.set('reports_history', pid, next);
    notifOk(status === 'signed' ? 'Đã ký duyệt!' : 'Đã lưu nháp!');
    setView('history');
  }, [selectedTpl, gemReport, formData, history, pid]);

  // ── Export Excel ───────────────────────────────────────────────────────────
  const handleExcel = useCallback(async () => {
    if (!selectedTpl) return;
    setExporting(true);
    try {
      const sheets = buildExcelSheets(selectedTpl.id, live, projectName, gemReport, formData);
      await exportExcel(sheets, `${selectedTpl.name}_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}`);
      notifOk('Xuất Excel thành công!');
    } catch {
      notifErr('Lỗi xuất Excel');
    }
    setExporting(false);
  }, [selectedTpl, live, projectName, gemReport, formData]);

  // ── Filtered templates ─────────────────────────────────────────────────────
  const filteredTpls = S11_TEMPLATES.filter(t => {
    const matchGroup = groupFilter === 'all' || t.group === groupFilter;
    const matchSearch = !searchQ || t.name.toLowerCase().includes(searchQ.toLowerCase());
    return matchGroup && matchSearch;
  });

  // ── Charts data ────────────────────────────────────────────────────────────
  const filteredHistory = history.filter(r => {
    const matchSearch = !histSearchQ || r.title.toLowerCase().includes(histSearchQ.toLowerCase());
    const matchStatus = histStatusFilter === 'all' || r.status === histStatusFilter;
    const matchType   = histTypeFilter === 'all' || r.type === histTypeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const byType   = S11_TEMPLATES.map(t => ({ name: t.badge.split('/')[0].trim(), count: history.filter(r => r.type === t.id).length })).filter(x => x.count > 0);
  const byStatus = [
    { name: 'Đã ký',     value: history.filter(r => r.status === 'signed').length,  fill: '#10b981' },
    { name: 'Chờ duyệt', value: history.filter(r => r.status === 'pending').length, fill: '#f59e0b' },
    { name: 'Nháp',      value: history.filter(r => r.status === 'draft').length,   fill: '#94a3b8' },
  ].filter(x => x.value > 0);

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-4">

      {/* ── Header + KPI ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <ClipboardList size={20} className="text-rose-600" />
              Báo cáo — {projectName}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              12 templates TCXDVN · GEM soạn từ data thật · {history.length} báo cáo đã lưu
            </p>
          </div>
        </div>

        {/* KPI strip */}
        <div className="mt-3 grid grid-cols-3 md:grid-cols-6 gap-2">
          {[
            ['Có mặt', `${live.presentToday}/${live.totalWorkers}`, 'bg-blue-50 text-blue-700'],
            ['Sự cố HSE', live.hseIncidents, 'bg-amber-50 text-amber-700'],
            ['Vi phạm AT', live.hseViolations, 'bg-red-50 text-red-700'],
            ['TT duyệt', `${live.qsApproved}/${live.qsTotal}`, 'bg-emerald-50 text-emerald-700'],
            ['Phải thu (tỷ)', live.receivable.toFixed(1), 'bg-violet-50 text-violet-700'],
            ['Báo cáo', history.length, 'bg-rose-50 text-rose-700'],
          ].map(([label, val, cls], i) => (
            <div key={i} className={`rounded-xl px-3 py-2 ${cls}`}>
              <div className="text-lg font-bold">{val}</div>
              <div className="text-[10px] font-semibold opacity-70">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Nav tabs ── */}
      {view !== 'compose' && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
            {([['templates', '📋 Templates'], ['history', '🗂 Lịch sử']] as [ViewMode, string][]).map(([id, label]) => (
              <button key={id} onClick={() => setView(id as ViewMode)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all
                  ${view === id ? 'bg-white shadow-sm text-rose-600' : 'text-slate-500 hover:text-slate-700'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Filter + search — chỉ hiện ở templates */}
          {view === 'templates' && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                  placeholder="Tìm báo cáo..."
                  className="pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white w-40 focus:outline-none focus:ring-2 focus:ring-rose-200"/>
              </div>
              <select value={groupFilter} onChange={e => setGroupFilter(e.target.value as any)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700">
                <option value="all">Tất cả nhóm</option>
                {Object.entries(GROUP_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* VIEW: TEMPLATES                                                      */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {view === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTpls.map(tpl => (
            <div key={tpl.id}
              onClick={() => { setSelectedTpl(tpl); setFormData({}); setGemReport(''); setView('compose'); }}
              className={`bg-white border-2 ${tpl.bg} rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group`}>

              <div className="flex items-start justify-between mb-3">
                <div className={`w-11 h-11 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center ${tpl.badgeCls}`}>
                  {ICON_MAP[tpl.iconName] ?? <FileText size={20}/>}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full tracking-widest ${tpl.badgeCls}`}>
                    {tpl.badge}
                  </span>
                  <span className={`text-[9px] font-semibold ${GROUP_META[tpl.group].color}`}>
                    {tpl.frequency}
                  </span>
                </div>
              </div>

              <h3 className="font-bold text-slate-800 mb-1">{tpl.name}</h3>
              <p className="text-xs text-slate-500 leading-relaxed mb-3">{tpl.desc}</p>

              {/* Audience tags */}
              <div className="flex flex-wrap gap-1 mb-3">
                {tpl.audience.map(a => (
                  <span key={a} className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md ${AUDIENCE_META[a].cls}`}>
                    {AUDIENCE_META[a].label}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 bg-white border border-slate-200 px-2 py-1 rounded-lg">
                  {tpl.format}
                </span>
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 group-hover:scale-105 transition-transform shadow-sm">
                  <Sparkles size={11}/> GEM soạn
                </button>
              </div>

              {history.filter(r => r.type === tpl.id).length > 0 && (
                <p className="mt-2 text-[10px] text-slate-400">
                  📄 {history.filter(r => r.type === tpl.id).length} đã lưu
                </p>
              )}
            </div>
          ))}

          {filteredTpls.length === 0 && (
            <div className="col-span-3 bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <FileText size={40} className="text-slate-200 mx-auto mb-3"/>
              <p className="text-slate-400 text-sm">Không tìm thấy template phù hợp.</p>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* VIEW: HISTORY                                                         */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {view === 'history' && (
        <div className="space-y-4">
          {/* Filter + Search */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input value={histSearchQ} onChange={e => setHistSearchQ(e.target.value)}
                placeholder="Tìm trong lịch sử..."
                className="pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white w-44 focus:outline-none focus:ring-2 focus:ring-rose-200"/>
            </div>
            <select value={histStatusFilter} onChange={e => setHistStatusFilter(e.target.value as any)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700">
              <option value="all">Tất cả trạng thái</option>
              <option value="signed">Đã ký</option>
              <option value="pending">Chờ duyệt</option>
              <option value="draft">Nháp</option>
            </select>
            <select value={histTypeFilter} onChange={e => setHistTypeFilter(e.target.value as any)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700">
              <option value="all">Tất cả loại</option>
              {S11_TEMPLATES.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {(histSearchQ || histStatusFilter !== 'all' || histTypeFilter !== 'all') && (
              <button onClick={() => { setHistSearchQ(''); setHistStatusFilter('all'); setHistTypeFilter('all'); }}
                className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
                <X size={12}/> Xoá filter
              </button>
            )}
            <span className="ml-auto text-xs text-slate-400">{filteredHistory.length} / {history.length} báo cáo</span>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ['Tổng',      history.length,                                        'text-rose-600'],
              ['Đã ký',     history.filter(r => r.status === 'signed').length,    'text-emerald-600'],
              ['Chờ duyệt', history.filter(r => r.status === 'pending').length,   'text-amber-600'],
              ['Nháp',      history.filter(r => r.status === 'draft').length,     'text-slate-500'],
            ].map(([label, val, cls], i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center">
                <div className={`text-2xl font-bold ${cls}`}>{val}</div>
                <div className="text-xs text-slate-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {/* Charts */}
          {history.length > 1 && (
            <div className="grid md:grid-cols-2 gap-4">
              {byType.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Theo loại</p>
                  <ResponsiveContainer width="100%" height={140} minWidth={0}>
                    <BarChart data={byType} barSize={20}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                      <XAxis dataKey="name" tick={{ fontSize: 9 }}/>
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false}/>
                      <Tooltip/>
                      <Bar dataKey="count" fill="#e11d48" radius={[4,4,0,0]} name="Số lượng"/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {byStatus.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Trạng thái</p>
                  <ResponsiveContainer width="100%" height={140} minWidth={0}>
                    <RechartsPie>
                      <Pie data={byStatus} dataKey="value" cx="50%" cy="50%" outerRadius={55}
                        label={({ name, value }) => `${name}:${value}`} labelLine={false}>
                        {byStatus.map((s, i) => <Cell key={i} fill={s.fill}/>)}
                      </Pie>
                      <Tooltip/>
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* List */}
          {filteredHistory.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <FileText size={40} className="text-slate-200 mx-auto mb-3"/>
              <p className="text-slate-400 text-sm">
                {history.length === 0 ? 'Chưa có báo cáo. Chọn template để bắt đầu.' : 'Không tìm thấy báo cáo phù hợp.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredHistory.map(r => {
                const tpl = S11_TEMPLATES.find(t => t.id === r.type);
                return (
                  <div key={r.id}
                    className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 flex items-center gap-3 hover:border-rose-200 hover:shadow-md transition-all">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tpl?.badgeCls ?? 'bg-slate-50 text-slate-400'}`}>
                      {ICON_MAP[tpl?.iconName ?? ''] ?? <FileText size={16}/>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{r.title}</p>
                      <p className="text-[11px] text-slate-400">{r.date} · {r.createdBy}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${STATUS_META[r.status].cls}`}>
                      {STATUS_META[r.status].label}
                    </span>
                    <div className="flex gap-1.5 shrink-0 flex-wrap">
                      <button onClick={() => setViewing(r)}
                        className="px-2.5 py-1.5 bg-slate-100 rounded-lg text-xs font-bold hover:bg-slate-200 flex items-center gap-1">
                        <Eye size={11}/>Xem
                      </button>
                      <button onClick={() => tpl && doPrint(r.content, r.title, tpl.format, projectName)}
                        className="px-2.5 py-1.5 bg-slate-700 text-white rounded-lg text-xs font-bold hover:bg-slate-800 flex items-center gap-1">
                        <Printer size={11}/>In
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* VIEW: COMPOSE                                                         */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {view === 'compose' && selectedTpl && (
        <div className="space-y-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => { setView('templates'); setGemReport(''); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200">
              <ChevronLeft size={14}/> Templates
            </button>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 ${selectedTpl.bg}`}>
              <span className={selectedTpl.badgeCls}>{ICON_MAP[selectedTpl.iconName]}</span>
              <span className="font-bold text-slate-800 text-sm">{selectedTpl.name}</span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${selectedTpl.badgeCls}`}>
                {selectedTpl.format}
              </span>
            </div>
            {/* Audience tags */}
            {selectedTpl.audience.map(a => (
              <span key={a} className={`text-[10px] font-semibold px-2 py-1 rounded-lg ${AUDIENCE_META[a].cls}`}>
                {AUDIENCE_META[a].label}
              </span>
            ))}
          </div>

          {/* Data context */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 text-xs text-blue-700">
            <span className="font-bold mr-2">📊 Data GEM sẽ dùng:</span>
            {buildGemContext(selectedTpl.id, live, projectName)
              .split('\n')
              .filter(l => l && !l.startsWith('DỰ ÁN') && !l.startsWith('NGÀY'))
              .join(' · ')}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Form */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
              <h3 className="font-bold text-slate-800 mb-4 text-sm">✏️ Thông tin bổ sung</h3>
              <div className="space-y-3">
                {selectedTpl.fields.map(field => (
                  <div key={field}>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1 block">
                      {field}
                    </label>
                    <input
                      value={formData[field] || ''}
                      onChange={e => setFormData(p => ({ ...p, [field]: e.target.value }))}
                      placeholder="Để trống → GEM tự điền từ data..."
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-300 transition-colors"/>
                  </div>
                ))}
              </div>
              <button onClick={generateReport} disabled={gemLoading}
                className="mt-5 w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-60 shadow-sm shadow-rose-200">
                {gemLoading
                  ? <><Loader2 size={15} className="animate-spin"/>Nàng GEM đang soạn...</>
                  : <><Sparkles size={15}/>GEM soạn từ data thật</>}
              </button>
            </div>

            {/* Preview */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex flex-col">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h3 className="font-bold text-slate-800 text-sm">👁 Xem trước</h3>
                {gemReport && !gemLoading && (
                  <div className="flex gap-1.5 flex-wrap">
                    <button onClick={() => doPrint(gemReport, selectedTpl.name, selectedTpl.format, projectName)}
                      className="px-2.5 py-1.5 bg-slate-700 text-white rounded-lg text-xs font-bold hover:bg-slate-800 flex items-center gap-1">
                      <Printer size={11}/>In {selectedTpl.format}
                    </button>
                    <button onClick={handleExcel} disabled={exporting}
                      className="px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 flex items-center gap-1 disabled:opacity-60">
                      {exporting ? <Loader2 size={11} className="animate-spin"/> : <Download size={11}/>}
                      Excel
                    </button>
                    <button onClick={() => saveReport('draft')}
                      className="px-2.5 py-1.5 bg-slate-500 text-white rounded-lg text-xs font-bold hover:bg-slate-600 flex items-center gap-1">
                      <Save size={11}/>Nháp
                    </button>
                    <button onClick={() => saveReport('pending')}
                      className="px-2.5 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 flex items-center gap-1">
                      <FileText size={11}/>Gửi duyệt
                    </button>
                    <button onClick={() => saveReport('signed')}
                      className="px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 flex items-center gap-1">
                      <CheckCircle2 size={11}/>Ký duyệt
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 min-h-72 bg-slate-50 rounded-xl border border-slate-200 p-4 overflow-y-auto">
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
                  <pre className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-sans">
                    {gemReport}
                  </pre>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── View modal ── */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setViewing(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <p className="font-bold text-slate-800">{viewing.title}</p>
                <p className="text-xs text-slate-400">{viewing.date} · {viewing.createdBy}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const t = S11_TEMPLATES.find(x => x.id === viewing.type);
                    doPrint(viewing.content, viewing.title, t?.format || 'A4', projectName);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 text-white rounded-lg text-xs font-bold">
                  <Printer size={11}/>In
                </button>
                <button onClick={() => setViewing(null)}
                  className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center">
                  <X size={16}/>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <pre className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-sans">
                {viewing.content}
              </pre>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
