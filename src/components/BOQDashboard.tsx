// BOQDashboard.tsx — GEM&CLAUDE PM Pro · S12
// Quản lý BOQ: Import Excel/PDF · Rate library · So sánh dự toán vs QS actual
// Data source: QSTypes.ts (BOQItem đã có) + RateItem (S12 mới)

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileSpreadsheet, Upload, Plus, Search, Edit3, Trash2, Save, X,
  ChevronDown, ChevronRight, Download, Sparkles, Loader2,
  BarChart2, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  BookOpen, Filter, RefreshCw, FileText,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { genAI, GEM_MODEL } from './gemini';
import { useNotification } from './NotificationEngine';
import { db } from './db';
import type { DashboardProps } from './types';
import {
  type BOQItem, type RateItem,
  INIT_BOQ, INIT_RATE_LIBRARY, RATE_CATEGORIES,
  fmt, fmtB, pct, calcBOQValue, calcDoneValue,
  CHAPTERS, CHAPTER_NAMES, CHAPTER_COLORS,
} from './QSTypes';

type ViewMode = 'boq' | 'rate' | 'compare';

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmtM = (n: number) => `${(n / 1_000_000).toFixed(1)}M`;

function getVarianceClass(done: number, plan: number): string {
  const diff = done - plan;
  if (diff > 10) return 'text-emerald-600';
  if (diff < -10) return 'text-red-600';
  return 'text-amber-600';
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function BOQDashboard({ project }: DashboardProps) {
  const pid         = project?.id   || 'default';
  const projectName = project?.name || 'Dự án';
  const { ok: notifOk, err: notifErr, warn: notifWarn } = useNotification();

  // ── State ──────────────────────────────────────────────────────────────────
  const [view, setView]                   = useState<ViewMode>('boq');
  const [boqItems, setBoqItems]           = useState<BOQItem[]>(INIT_BOQ);
  const [rateLib, setRateLib]             = useState<RateItem[]>(INIT_RATE_LIBRARY);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set(CHAPTERS));
  const [searchQ, setSearchQ]             = useState('');
  const [filterChapter, setFilterChapter] = useState('all');
  const [editingId, setEditingId]         = useState<string | null>(null);
  const [editRow, setEditRow]             = useState<Partial<BOQItem>>({});
  const [showAddRow, setShowAddRow]       = useState(false);
  const [newRow, setNewRow]               = useState<Partial<BOQItem>>({ chapter: 'C1', unit: 'm³' });
  const [gemLoading, setGemLoading]       = useState(false);
  const [importing, setImporting]         = useState(false);
  const [rateSearch, setRateSearch]       = useState('');
  const [rateCategory, setRateCategory]   = useState('all');
  const [showAddRate, setShowAddRate]     = useState(false);
  const [newRate, setNewRate]             = useState<Partial<RateItem>>({ source: 'custom', category: 'Khác' });

  // ── Load from db ───────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [items, rates] = await Promise.all([
        db.get<BOQItem[]>('boq_items', pid, INIT_BOQ),
        db.get<RateItem[]>('rate_library', pid, INIT_RATE_LIBRARY),
      ]);
      setBoqItems(items);
      setRateLib(rates);
    })();
  }, [pid]);

  // ── Persist ────────────────────────────────────────────────────────────────
  useEffect(() => { db.set('boq_items', pid, boqItems); }, [boqItems, pid]);
  useEffect(() => { db.set('rate_library', pid, rateLib); }, [rateLib, pid]);

  // ── Computed ───────────────────────────────────────────────────────────────
  const nonChapter = useMemo(() => boqItems.filter(i => !i.isChapter), [boqItems]);
  const totalContract = useMemo(() => nonChapter.reduce((s, i) => s + calcBOQValue(i), 0), [nonChapter]);
  const totalDone     = useMemo(() => nonChapter.reduce((s, i) => s + calcDoneValue(i), 0), [nonChapter]);
  const totalPlan     = useMemo(() => nonChapter.reduce((s, i) => s + i.qty_plan_current * i.unit_price, 0), [nonChapter]);
  const spi           = totalPlan > 0 ? totalDone / totalPlan : 0;

  const filteredItems = useMemo(() => {
    const q = searchQ.toLowerCase();
    return boqItems.filter(i => {
      const matchSearch = !q || i.name.toLowerCase().includes(q) || i.code?.toLowerCase().includes(q);
      const matchChapter = filterChapter === 'all' || i.chapter === filterChapter || i.isChapter;
      return matchSearch && matchChapter;
    });
  }, [boqItems, searchQ, filterChapter]);

  const filteredRates = useMemo(() => {
    const q = rateSearch.toLowerCase();
    return rateLib.filter(r => {
      const matchSearch = !q || r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q);
      const matchCat = rateCategory === 'all' || r.category === rateCategory;
      return matchSearch && matchCat;
    });
  }, [rateLib, rateSearch, rateCategory]);

  // Chart data — by chapter
  const chartData = useMemo(() => CHAPTERS.map(ch => {
    const items = nonChapter.filter(i => i.chapter === ch);
    return {
      name: CHAPTER_NAMES[ch] || ch,
      contract: Math.round(items.reduce((s, i) => s + calcBOQValue(i), 0) / 1e6),
      done: Math.round(items.reduce((s, i) => s + calcDoneValue(i), 0) / 1e6),
      plan: Math.round(items.reduce((s, i) => s + i.qty_plan_current * i.unit_price, 0) / 1e6),
    };
  }).filter(d => d.contract > 0), [nonChapter]);

  // ── Import Excel via SheetJS ───────────────────────────────────────────────
  const handleImportExcel = useCallback(async (file: File) => {
    setImporting(true);
    try {
      const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs' as any);
      const buf  = await file.arrayBuffer();
      const wb   = XLSX.read(buf, { type: 'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      // Gemini auto-detect columns
      const headerRow = rows.slice(0, 5).map(r => r.join(' | ')).join('\n');
      const model = genAI.getGenerativeModel({ model: GEM_MODEL });
      const detectRes = await model.generateContent(
        `Đây là các dòng đầu của file Excel BOQ xây dựng:\n${headerRow}\n\n` +
        `Hãy xác định index (0-based) của các cột sau (trả về JSON object, nếu không tìm thấy trả về -1):\n` +
        `{ "code": <index mã hạng mục>, "name": <index tên hạng mục>, "unit": <index đơn vị>, "qty_contract": <index khối lượng HĐ>, "unit_price": <index đơn giá>, "chapter": <index chương/mục> }\n` +
        `Chỉ trả về JSON, không giải thích.`
      );
      let colMap: Record<string, number> = {};
      try {
        const txt = detectRes.response.text().replace(/```json|```/g, '').trim();
        colMap = JSON.parse(txt);
      } catch {
        // Fallback: guess common patterns
        colMap = { code: 0, name: 1, unit: 2, qty_contract: 3, unit_price: 4, chapter: -1 };
      }

      // Parse rows into BOQItems
      const newItems: BOQItem[] = [];
      let currentChapter = 'C1';
      let itemIdx = 1;

      for (const row of rows.slice(1)) {
        if (!row || row.every((c: any) => !c)) continue;
        const name = String(row[colMap.name] || '').trim();
        if (!name) continue;

        const qty  = parseFloat(String(row[colMap.qty_contract] || '0').replace(/,/g, '')) || 0;
        const price = parseFloat(String(row[colMap.unit_price] || '0').replace(/,/g, '')) || 0;

        // Detect chapter row (no qty/price, or total row)
        if ((qty === 0 && price === 0) || name.toLowerCase().startsWith('chương')) {
          newItems.push({
            id: `imp_ch_${itemIdx++}`,
            code: String(row[colMap.code] || '').trim(),
            chapter: currentChapter,
            name,
            unit: '',
            qty_contract: 0, unit_price: 0, qty_done: 0, qty_plan_current: 0,
            isChapter: true,
          });
          continue;
        }

        newItems.push({
          id: `imp_${itemIdx++}`,
          code: String(row[colMap.code] || `HM-${itemIdx}`).trim(),
          chapter: currentChapter,
          name,
          unit: String(row[colMap.unit] || 'm³').trim(),
          qty_contract: qty,
          unit_price: price,
          qty_done: 0,
          qty_plan_current: qty * 0.3, // Mặc định 30% kế hoạch
        });
      }

      if (newItems.length === 0) {
        notifWarn('Không đọc được dữ liệu — kiểm tra format file');
        return;
      }

      setBoqItems(prev => [...prev, ...newItems]);
      notifOk(`Import thành công ${newItems.filter(i => !i.isChapter).length} hạng mục!`);
    } catch (e) {
      notifErr('Lỗi import Excel');
      console.error(e);
    }
    setImporting(false);
  }, [pid]);

  // ── Import PDF via Gemini Vision ───────────────────────────────────────────
  const handleImportPDF = useCallback(async (file: File) => {
    setImporting(true);
    try {
      const buf    = await file.arrayBuffer();
      const b64    = btoa(String.fromCharCode(...new Uint8Array(buf)));
      const model  = genAI.getGenerativeModel({ model: GEM_MODEL });
      const result = await model.generateContent([
        { inlineData: { data: b64, mimeType: 'application/pdf' } },
        `Đây là file BOQ xây dựng. Hãy đọc và trích xuất tất cả hạng mục thành JSON array:\n` +
        `[{ "code": "mã HM", "name": "tên HM", "unit": "đơn vị", "qty_contract": số lượng, "unit_price": đơn giá, "chapter": "C1/C2/C3/C4" }]\n` +
        `Chỉ trả về JSON array, không giải thích.`,
      ]);
      const txt  = result.response.text().replace(/```json|```/g, '').trim();
      const data = JSON.parse(txt) as any[];

      const newItems: BOQItem[] = data.map((d, i) => ({
        id: `pdf_${Date.now()}_${i}`,
        code: d.code || `HM-${i+1}`,
        chapter: d.chapter || 'C1',
        name: d.name || '',
        unit: d.unit || 'm³',
        qty_contract: +d.qty_contract || 0,
        unit_price: +d.unit_price || 0,
        qty_done: 0,
        qty_plan_current: (+d.qty_contract || 0) * 0.3,
      }));

      setBoqItems(prev => [...prev, ...newItems]);
      notifOk(`Import PDF thành công ${newItems.length} hạng mục!`);
    } catch {
      notifErr('Lỗi import PDF — thử lại hoặc nhập thủ công');
    }
    setImporting(false);
  }, []);

  // ── Export Excel ───────────────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs' as any);
    const rows = [
      [`BOQ — ${projectName}`],
      [`Tổng giá trị HĐ: ${fmtB(totalContract)} | Đã thực hiện: ${fmtB(totalDone)} (${pct(totalDone, totalContract)}%)`],
      [],
      ['Mã HM', 'Tên hạng mục', 'Đơn vị', 'KL HĐ', 'Đơn giá', 'Giá trị HĐ', 'KL Thực hiện', 'Giá trị TH', '% TH', 'KL Kế hoạch', 'SPI'],
      ...nonChapter.map(i => [
        i.code, i.name, i.unit,
        i.qty_contract, i.unit_price, calcBOQValue(i),
        i.qty_done, calcDoneValue(i), pct(calcDoneValue(i), calcBOQValue(i)),
        i.qty_plan_current, i.qty_plan_current > 0 ? (i.qty_done / i.qty_plan_current).toFixed(2) : '-',
      ]),
      [],
      ['TỔNG', '', '', '', '', totalContract, '', totalDone, pct(totalDone, totalContract), totalPlan, spi.toFixed(2)],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [8, 35, 8, 10, 12, 14, 12, 14, 8, 12, 8].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BOQ');
    XLSX.writeFile(wb, `BOQ_${projectName.replace(/\s/g, '_')}.xlsx`);
    notifOk('Xuất Excel thành công!');
  }, [boqItems, projectName, totalContract, totalDone, totalPlan, spi]);

  // ── CRUD BOQ ───────────────────────────────────────────────────────────────
  const saveEdit = useCallback(() => {
    if (!editingId) return;
    setBoqItems(prev => prev.map(i => i.id === editingId ? { ...i, ...editRow } : i));
    setEditingId(null);
    notifOk('Đã cập nhật!');
  }, [editingId, editRow]);

  const deleteItem = useCallback((id: string) => {
    setBoqItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const addItem = useCallback(() => {
    if (!newRow.name) return;
    const item: BOQItem = {
      id: `item_${Date.now()}`,
      code: newRow.code || `HM-${nonChapter.length + 1}`,
      chapter: newRow.chapter || 'C1',
      name: newRow.name || '',
      unit: newRow.unit || 'm³',
      qty_contract: +newRow.qty_contract! || 0,
      unit_price: +newRow.unit_price! || 0,
      qty_done: 0,
      qty_plan_current: +(newRow.qty_contract!) * 0.3 || 0,
    };
    setBoqItems(prev => [...prev, item]);
    setNewRow({ chapter: 'C1', unit: 'm³' });
    setShowAddRow(false);
    notifOk('Đã thêm hạng mục!');
  }, [newRow, nonChapter.length]);

  // ── Apply rate from library ────────────────────────────────────────────────
  const applyRate = useCallback((rate: RateItem, itemId: string) => {
    setBoqItems(prev => prev.map(i =>
      i.id === itemId ? { ...i, unit_price: rate.unit_price, unit: rate.unit } : i
    ));
    notifOk(`Áp dụng đơn giá ${rate.name}!`);
  }, []);

  // ── Add custom rate ────────────────────────────────────────────────────────
  const addRate = useCallback(() => {
    if (!newRate.name || !newRate.unit_price) return;
    const rate: RateItem = {
      id: `rate_${Date.now()}`,
      code: newRate.code || `CUS-${rateLib.length + 1}`,
      name: newRate.name || '',
      unit: newRate.unit || 'm³',
      unit_price: +newRate.unit_price! || 0,
      source: 'custom',
      category: newRate.category || 'Khác',
    };
    setRateLib(prev => [...prev, rate]);
    setNewRate({ source: 'custom', category: 'Khác' });
    setShowAddRate(false);
    notifOk('Đã thêm đơn giá!');
  }, [newRate, rateLib.length]);

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-4">

      {/* ── Header KPI ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <FileSpreadsheet size={20} className="text-indigo-600"/>
              BOQ & Dự toán — {projectName}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{nonChapter.length} hạng mục · Import Excel/PDF · Rate library</p>
          </div>
          <div className="flex gap-2">
            <label className={`flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 cursor-pointer ${importing ? 'opacity-60' : ''}`}>
              {importing ? <Loader2 size={12} className="animate-spin"/> : <Upload size={12}/>}
              Import Excel
              <input type="file" accept=".xlsx,.xls" className="hidden"
                onChange={e => e.target.files?.[0] && handleImportExcel(e.target.files[0])}/>
            </label>
            <label className={`flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 cursor-pointer ${importing ? 'opacity-60' : ''}`}>
              {importing ? <Loader2 size={12} className="animate-spin"/> : <FileText size={12}/>}
              Import PDF
              <input type="file" accept=".pdf" className="hidden"
                onChange={e => e.target.files?.[0] && handleImportPDF(e.target.files[0])}/>
            </label>
            <button onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700">
              <Download size={12}/> Xuất Excel
            </button>
          </div>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Giá trị BOQ HĐ', value: fmtB(totalContract), cls: 'text-slate-700' },
            { label: 'Đã thực hiện', value: `${fmtB(totalDone)} (${pct(totalDone, totalContract)}%)`, cls: 'text-emerald-700' },
            { label: 'Kế hoạch lũy kế', value: fmtB(totalPlan), cls: 'text-blue-700' },
            { label: 'SPI', value: spi.toFixed(2), cls: spi >= 1 ? 'text-emerald-700' : spi >= 0.9 ? 'text-amber-700' : 'text-red-700' },
          ].map((k, i) => (
            <div key={i} className="bg-slate-50 rounded-xl p-3">
              <div className={`text-xl font-bold ${k.cls}`}>{k.value}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── View tabs ── */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
        {([['boq', '📋 BOQ'], ['rate', '📚 Rate Library'], ['compare', '📊 So sánh']] as [ViewMode, string][]).map(([v, l]) => (
          <button key={v} onClick={() => setView(v)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all
              ${view === v ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* VIEW: BOQ                                                             */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {view === 'boq' && (
        <div className="space-y-3">
          {/* Toolbar */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                placeholder="Tìm hạng mục..."
                className="pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white w-44 focus:outline-none focus:ring-2 focus:ring-indigo-200"/>
            </div>
            <select value={filterChapter} onChange={e => setFilterChapter(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700">
              <option value="all">Tất cả chương</option>
              {CHAPTERS.map(ch => <option key={ch} value={ch}>{CHAPTER_NAMES[ch]}</option>)}
            </select>
            <button onClick={() => setShowAddRow(true)}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700">
              <Plus size={12}/> Thêm hạng mục
            </button>
          </div>

          {/* Add row form */}
          {showAddRow && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
              <h3 className="font-bold text-indigo-800 text-sm mb-3">Thêm hạng mục mới</h3>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                <input placeholder="Mã HM" value={newRow.code || ''} onChange={e => setNewRow(p => ({...p, code: e.target.value}))}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200"/>
                <input placeholder="Tên hạng mục *" value={newRow.name || ''} onChange={e => setNewRow(p => ({...p, name: e.target.value}))}
                  className="col-span-2 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200"/>
                <select value={newRow.chapter} onChange={e => setNewRow(p => ({...p, chapter: e.target.value}))}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white">
                  {CHAPTERS.map(ch => <option key={ch} value={ch}>{CHAPTER_NAMES[ch]}</option>)}
                </select>
                <input placeholder="Đơn vị" value={newRow.unit || ''} onChange={e => setNewRow(p => ({...p, unit: e.target.value}))}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"/>
                <input type="number" placeholder="KL HĐ" value={newRow.qty_contract || ''} onChange={e => setNewRow(p => ({...p, qty_contract: +e.target.value}))}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"/>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={addItem}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 flex items-center gap-1">
                  <Save size={11}/> Lưu
                </button>
                <button onClick={() => setShowAddRow(false)}
                  className="px-3 py-1.5 bg-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-300">
                  Huỷ
                </button>
              </div>
            </div>
          )}

          {/* BOQ table by chapter */}
          {CHAPTERS.map(ch => {
            const chapterItems = filteredItems.filter(i => i.chapter === ch);
            if (chapterItems.length === 0) return null;
            const chapterHeader = chapterItems.find(i => i.isChapter);
            const chapterData   = chapterItems.filter(i => !i.isChapter);
            const chTotal  = chapterData.reduce((s, i) => s + calcBOQValue(i), 0);
            const chDone   = chapterData.reduce((s, i) => s + calcDoneValue(i), 0);
            const isExpanded = expandedChapters.has(ch);

            return (
              <div key={ch} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Chapter header */}
                <button
                  onClick={() => setExpandedChapters(prev => {
                    const next = new Set(prev);
                    if (next.has(ch)) next.delete(ch); else next.add(ch);
                    return next;
                  })}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
                  style={{ borderLeft: `4px solid ${CHAPTER_COLORS[ch] || '#6366f1'}` }}>
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                    <span className="font-bold text-slate-800 text-sm">
                      {CHAPTER_NAMES[ch]} ({chapterData.length} HM)
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-600">
                    <span>HĐ: <b>{fmtB(chTotal)}</b></span>
                    <span>TH: <b className="text-emerald-700">{fmtB(chDone)}</b></span>
                    <span className={pct(chDone, chTotal) >= 50 ? 'text-emerald-600' : 'text-amber-600'}>
                      {pct(chDone, chTotal)}%
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          {['Mã HM', 'Tên hạng mục', 'ĐVT', 'KL HĐ', 'Đơn giá', 'GT HĐ', 'KL TH', 'GT TH', '% TH', ''].map((h, i) => (
                            <th key={i} className="px-2 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {chapterData.map(item => {
                          const gtHD  = calcBOQValue(item);
                          const gtTH  = calcDoneValue(item);
                          const pctTH = pct(gtTH, gtHD);
                          const isEditing = editingId === item.id;

                          return (
                            <tr key={item.id} className="border-b border-slate-100 hover:bg-indigo-50/30 transition-colors">
                              <td className="px-2 py-2 text-slate-500 font-mono text-[10px]">{item.code}</td>
                              <td className="px-2 py-2">
                                {isEditing
                                  ? <input value={editRow.name || ''} onChange={e => setEditRow(p => ({...p, name: e.target.value}))}
                                      className="w-full border border-indigo-300 rounded px-1 py-0.5 text-xs focus:outline-none"/>
                                  : <span className="font-medium text-slate-800">{item.name}</span>
                                }
                              </td>
                              <td className="px-2 py-2 text-slate-500">{item.unit}</td>
                              <td className="px-2 py-2 text-right font-mono">
                                {isEditing
                                  ? <input type="number" value={editRow.qty_contract || 0} onChange={e => setEditRow(p => ({...p, qty_contract: +e.target.value}))}
                                      className="w-20 text-right border border-indigo-300 rounded px-1 py-0.5 text-xs focus:outline-none"/>
                                  : fmt(item.qty_contract)
                                }
                              </td>
                              <td className="px-2 py-2 text-right font-mono">
                                {isEditing
                                  ? <input type="number" value={editRow.unit_price || 0} onChange={e => setEditRow(p => ({...p, unit_price: +e.target.value}))}
                                      className="w-24 text-right border border-indigo-300 rounded px-1 py-0.5 text-xs focus:outline-none"/>
                                  : fmt(item.unit_price)
                                }
                              </td>
                              <td className="px-2 py-2 text-right font-mono font-semibold">{fmtM(gtHD)}</td>
                              <td className="px-2 py-2 text-right font-mono text-emerald-700">{fmt(item.qty_done)}</td>
                              <td className="px-2 py-2 text-right font-mono text-emerald-700">{fmtM(gtTH)}</td>
                              <td className="px-2 py-2">
                                <div className="flex items-center gap-1">
                                  <div className="w-14 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(pctTH, 100)}%` }}/>
                                  </div>
                                  <span className={`text-[10px] font-bold ${pctTH >= 100 ? 'text-emerald-600' : pctTH >= 50 ? 'text-amber-600' : 'text-slate-500'}`}>
                                    {pctTH}%
                                  </span>
                                </div>
                              </td>
                              <td className="px-2 py-2">
                                {isEditing ? (
                                  <div className="flex gap-1">
                                    <button onClick={saveEdit} className="p-1 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200"><Save size={11}/></button>
                                    <button onClick={() => setEditingId(null)} className="p-1 bg-slate-100 text-slate-600 rounded hover:bg-slate-200"><X size={11}/></button>
                                  </div>
                                ) : (
                                  <div className="flex gap-1">
                                    <button onClick={() => { setEditingId(item.id); setEditRow(item); }} className="p-1 hover:bg-slate-100 rounded text-slate-500"><Edit3 size={11}/></button>
                                    <button onClick={() => deleteItem(item.id)} className="p-1 hover:bg-red-100 rounded text-red-500"><Trash2 size={11}/></button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* VIEW: RATE LIBRARY                                                    */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {view === 'rate' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input value={rateSearch} onChange={e => setRateSearch(e.target.value)}
                placeholder="Tìm đơn giá..."
                className="pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white w-44 focus:outline-none focus:ring-2 focus:ring-indigo-200"/>
            </div>
            <select value={rateCategory} onChange={e => setRateCategory(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700">
              <option value="all">Tất cả nhóm</option>
              {RATE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <span className="text-xs text-slate-400">{filteredRates.length} đơn giá</span>
            <button onClick={() => setShowAddRate(true)}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700">
              <Plus size={12}/> Thêm đơn giá
            </button>
          </div>

          {/* Add rate form */}
          {showAddRate && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
              <h3 className="font-bold text-indigo-800 text-sm mb-3">Thêm đơn giá tùy chỉnh</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <input placeholder="Mã định mức" value={newRate.code || ''} onChange={e => setNewRate(p => ({...p, code: e.target.value}))}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"/>
                <input placeholder="Tên công tác *" value={newRate.name || ''} onChange={e => setNewRate(p => ({...p, name: e.target.value}))}
                  className="col-span-2 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"/>
                <input placeholder="Đơn vị" value={newRate.unit || ''} onChange={e => setNewRate(p => ({...p, unit: e.target.value}))}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"/>
                <input type="number" placeholder="Đơn giá (VNĐ) *" value={newRate.unit_price || ''} onChange={e => setNewRate(p => ({...p, unit_price: +e.target.value}))}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"/>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={addRate}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 flex items-center gap-1">
                  <Save size={11}/> Lưu
                </button>
                <button onClick={() => setShowAddRate(false)}
                  className="px-3 py-1.5 bg-slate-200 text-slate-600 rounded-lg text-xs font-bold">Huỷ</button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Mã', 'Tên công tác', 'Nhóm', 'ĐVT', 'Đơn giá (VNĐ)', 'Nguồn', ''].map((h, i) => (
                    <th key={i} className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRates.map(rate => (
                  <tr key={rate.id} className="border-b border-slate-100 hover:bg-indigo-50/30">
                    <td className="px-3 py-2 font-mono text-[10px] text-slate-500">{rate.code}</td>
                    <td className="px-3 py-2 font-medium text-slate-800">{rate.name}</td>
                    <td className="px-3 py-2">
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{rate.category}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-500">{rate.unit}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-indigo-700">{fmt(rate.unit_price)}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${rate.source === 'thong_tu' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                        {rate.source === 'thong_tu' ? 'Thông tư' : 'Tùy chỉnh'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {rate.source === 'custom' && (
                        <button onClick={() => setRateLib(prev => prev.filter(r => r.id !== rate.id))}
                          className="p-1 hover:bg-red-100 rounded text-red-500"><Trash2 size={11}/></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* VIEW: COMPARE                                                         */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {view === 'compare' && (
        <div className="space-y-4">
          {/* Chart */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="font-bold text-slate-800 text-sm mb-4">So sánh dự toán vs thực hiện theo chương</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="name" tick={{ fontSize: 10 }}/>
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}M`}/>
                <Tooltip formatter={(v: number) => `${v}M VNĐ`}/>
                <Bar dataKey="contract" name="Giá trị HĐ" fill="#6366f1" radius={[4,4,0,0]} barSize={20}/>
                <Bar dataKey="done"     name="Thực hiện"  fill="#10b981" radius={[4,4,0,0]} barSize={20}/>
                <Bar dataKey="plan"     name="Kế hoạch"   fill="#f59e0b" radius={[4,4,0,0]} barSize={20}/>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Detail table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Chương', 'GT HĐ', 'GT TH', '% TH', 'Kế hoạch', 'SPI', 'Trạng thái'].map((h, i) => (
                    <th key={i} className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CHAPTERS.map(ch => {
                  const items = nonChapter.filter(i => i.chapter === ch);
                  const gtHD  = items.reduce((s, i) => s + calcBOQValue(i), 0);
                  const gtTH  = items.reduce((s, i) => s + calcDoneValue(i), 0);
                  const gtPlan = items.reduce((s, i) => s + i.qty_plan_current * i.unit_price, 0);
                  const chSPI = gtPlan > 0 ? gtTH / gtPlan : 0;
                  const pctTH = pct(gtTH, gtHD);

                  return (
                    <tr key={ch} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2.5 font-bold text-slate-800">{CHAPTER_NAMES[ch]}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{fmtB(gtHD)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-emerald-700">{fmtB(gtTH)}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{pctTH}%</td>
                      <td className="px-3 py-2.5 text-right font-mono text-amber-700">{fmtB(gtPlan)}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold">
                        <span className={chSPI >= 1 ? 'text-emerald-700' : chSPI >= 0.9 ? 'text-amber-700' : 'text-red-700'}>
                          {chSPI.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {chSPI >= 1
                          ? <span className="flex items-center gap-1 text-emerald-700 text-[10px] font-bold"><CheckCircle2 size={10}/> Đúng tiến độ</span>
                          : chSPI >= 0.9
                          ? <span className="flex items-center gap-1 text-amber-700 text-[10px] font-bold"><AlertTriangle size={10}/> Chậm nhẹ</span>
                          : <span className="flex items-center gap-1 text-red-700 text-[10px] font-bold"><AlertTriangle size={10}/> Chậm nguy hiểm</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                <tr>
                  <td className="px-3 py-2.5 font-bold">TỔNG</td>
                  <td className="px-3 py-2.5 text-right font-bold font-mono">{fmtB(totalContract)}</td>
                  <td className="px-3 py-2.5 text-right font-bold font-mono text-emerald-700">{fmtB(totalDone)}</td>
                  <td className="px-3 py-2.5 text-right font-bold font-mono">{pct(totalDone, totalContract)}%</td>
                  <td className="px-3 py-2.5 text-right font-bold font-mono text-amber-700">{fmtB(totalPlan)}</td>
                  <td className="px-3 py-2.5 text-right font-bold font-mono">
                    <span className={spi >= 1 ? 'text-emerald-700' : spi >= 0.9 ? 'text-amber-700' : 'text-red-700'}>
                      {spi.toFixed(2)}
                    </span>
                  </td>
                  <td/>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
