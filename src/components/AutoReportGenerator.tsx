/**
 * AutoReportGenerator.tsx — GEM&CLAUDE PM Pro
 * S22 — Tự động tạo báo cáo tuần/tháng bằng Gemini + xuất PDF
 * Đọc data thật từ db.ts → Gemini tổng hợp → HTML → print PDF
 *
 * Usage:
 *   <AutoReportGenerator projectId={pid} projectName={name} ctx={ctx} />
 */
import React, { useState, useCallback } from 'react';
import { useNotification } from './NotificationEngine';
import { db } from './db';
import { genAI, GEM_MODEL_QUALITY } from './gemini';
import { usePrint } from './PrintService';
import {
  FileText, Sparkles, Download, Calendar,
  Loader2, ChevronDown, ChevronUp, RefreshCw,
} from 'lucide-react';
import type { UserContext } from './permissions';

type ReportType = 'weekly' | 'monthly' | 'milestone';
type ReportStatus = 'idle' | 'loading_data' | 'generating' | 'done' | 'error';

interface AutoReportGeneratorProps {
  projectId:   string;
  projectName: string;
  ctx?:        UserContext;
}

interface ReportData {
  wbs:         any[];
  incidents:   any[];
  payments:    any[];
  attendance:  any[];
  approvals:   any[];
  risks:       any[];
}

const REPORT_PROMPTS: Record<ReportType, (d: ReportData, name: string, period: string) => string> = {
  weekly: (d, name, period) =>
    `Anh là PM dự án xây dựng. Tạo BÁO CÁO TIẾN ĐỘ TUẦN cho dự án "${name}" — ${period}.

Dữ liệu thực tế:
- WBS/Tiến độ (${d.wbs.length} hạng mục):
${d.wbs.slice(0,10).map(w=>`  • ${w.name}: EV=${w.ev_pct?.toFixed(1)}%, PV=${w.pv_pct?.toFixed(1)}%, trạng thái=${w.status}`).join('\n')}
- Sự cố HSE trong tuần: ${d.incidents.filter((i:any)=>i.status==='open').length} đang mở
- Công nhân bình quân: ${d.attendance.length > 0 ? Math.round(d.attendance.reduce((s:any,a:any)=>s+(a.present||0),0)/Math.max(d.attendance.length,1)) : 'N/A'} người/ngày
- Hồ sơ chờ duyệt: ${d.approvals.filter((a:any)=>a.status?.includes('PENDING')).length}
- Rủi ro đang theo dõi: ${d.risks.filter((r:any)=>r.status==='open'||r.status==='monitoring').length}

Tạo báo cáo tiếng Việt chuyên nghiệp gồm:
1. **Tóm tắt tuần** (3-4 câu)
2. **Tiến độ thi công** — SPI ước tính, hạng mục đạt/trễ
3. **An toàn lao động** — sự cố, tình trạng
4. **Nhân lực & Thiết bị** — tổng quan
5. **Tài chính** — giải ngân, hồ sơ chờ
6. **Rủi ro nổi bật**
7. **Kế hoạch tuần tới** (3-5 việc cụ thể)

Format markdown với heading ##, bullet points. Ngắn gọn, số liệu cụ thể.`,

  monthly: (d, name, period) =>
    `Tạo BÁO CÁO THÁNG cho dự án "${name}" — ${period}.

Dữ liệu:
- ${d.wbs.length} hạng mục WBS, trung bình EV ${(d.wbs.reduce((s:any,w:any)=>s+(w.ev_pct||0),0)/Math.max(d.wbs.length,1)).toFixed(1)}%
- ${d.incidents.length} sự cố HSE (${d.incidents.filter((i:any)=>i.level==='major'||i.level==='fatal').length} nghiêm trọng)
- Tổng giải ngân: ${(d.payments.filter((p:any)=>p.status==='paid').reduce((s:any,p:any)=>s+((p.net_payable||p.total||0)/1e9),0)).toFixed(2)} tỷ
- ${d.risks.length} rủi ro đang quản lý

Báo cáo tháng tiếng Việt gồm: tóm tắt tháng, phân tích SPI/CPI, tiến độ tổng thể, tài chính, HSE tháng, rủi ro, kế hoạch tháng tới. Format markdown chuyên nghiệp.`,

  milestone: (d, name, _period) =>
    `Tạo BÁO CÁO MILESTONE cho dự án "${name}".

Phân tích ${d.wbs.filter((w:any)=>w.ev_pct>=100).length}/${d.wbs.length} hạng mục đã hoàn thành.
Dữ liệu WBS: ${d.wbs.map((w:any)=>`${w.name}(${w.ev_pct}%)`).join(', ')}

Báo cáo milestone tiếng Việt: thành tích đạt được, milestone tiếp theo, bottleneck, khuyến nghị.`,
};

export default function AutoReportGenerator({ projectId, projectName, ctx }: AutoReportGeneratorProps) {
  const { err } = useNotification();
  const { printComponent, printSupervisionLog } = usePrint();

  const [reportType, setReportType] = useState<ReportType>('weekly');
  const [status, setStatus]         = useState<ReportStatus>('idle');
  const [report, setReport]         = useState('');
  const [period, setPeriod]         = useState(() => {
    const now = new Date();
    return `Tuần ${Math.ceil(now.getDate()/7)} — ${now.toLocaleDateString('vi-VN', {month:'long', year:'numeric'})}`;
  });
  const [expanded, setExpanded]     = useState(true);
  const [errorMsg, setErrorMsg]     = useState('');

  const generate = useCallback(async () => {
    setStatus('loading_data');
    setReport('');
    setErrorMsg('');
    try {
      // Load tất cả data
      const [wbs, incidents, payments, attendance, risks] = await Promise.all([
        db.get<any[]>('progress_wbs',    projectId, []),
        db.get<any[]>('hse_incidents',   projectId, []),
        db.get<any[]>('qs_payments',     projectId, []),
        db.get<any[]>('mp_attendance',   projectId, []),
        db.get<any[]>('risk_register',   projectId, []),
      ]);

      // Load approvals từ localStorage (approvalEngine)
      let approvals: any[] = [];
      try {
        approvals = JSON.parse(localStorage.getItem(`gem_approvals_${projectId}`) || '[]');
      } catch {}

      const data: ReportData = { wbs, incidents, payments, attendance: attendance.slice(-7), approvals, risks };

      setStatus('generating');
      const model = genAI.getGenerativeModel({
        model: GEM_MODEL_QUALITY,
        generationConfig: { temperature: 0.3, maxOutputTokens: 3000 },
      });
      const prompt = REPORT_PROMPTS[reportType](data, projectName, period);
      const result = await model.generateContent(prompt);
      setReport(result.response.text());
      setStatus('done');
    } catch (e: any) {
      setErrorMsg(e.message);
      setStatus('error');
      err(`Lỗi tạo báo cáo: ${e.message}`);
    }
  }, [projectId, projectName, reportType, period]);

  // Print to PDF qua browser print dialog
  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html lang="vi"><head>
      <meta charset="UTF-8">
      <title>Báo cáo — ${projectName}</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; font-size: 13px; line-height: 1.7; color: #1e293b; }
        h1 { color: #059669; border-bottom: 2px solid #059669; padding-bottom: 8px; }
        h2 { color: #334155; margin-top: 24px; }
        h3 { color: #475569; }
        ul { padding-left: 20px; }
        li { margin-bottom: 4px; }
        strong { color: #1e293b; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .meta { font-size: 11px; color: #64748b; }
        @media print { body { margin: 20px; } }
      </style></head><body>
      <div class="header">
        <div>
          <h1>${projectName}</h1>
          <div class="meta">Kỳ báo cáo: ${period} · Tạo bởi GEM AI · ${new Date().toLocaleString('vi-VN')}</div>
        </div>
      </div>
      ${report
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br/>')
      }
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  // Markdown → simple HTML for preview
  const renderMarkdown = (md: string) =>
    md
      .replace(/^## (.+)$/gm, '<h2 class="text-sm font-black text-slate-800 mt-4 mb-1">$1</h2>')
      .replace(/^### (.+)$/gm, '<h3 class="text-xs font-bold text-slate-700 mt-3 mb-0.5">$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^- (.+)$/gm, '<li class="text-xs text-slate-700 ml-4 list-disc">$1</li>')
      .replace(/\n\n/g, '<br/><br/>')
      .replace(/\n/g, '<br/>');

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <FileText size={15} className="text-emerald-600"/>
          <span className="text-sm font-black text-slate-800">Báo cáo tự động</span>
        </div>
        <button onClick={() => setExpanded(v => !v)} className="text-slate-400 hover:text-slate-600">
          {expanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
        </button>
      </div>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Loại báo cáo</p>
              <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                {(['weekly','monthly','milestone'] as ReportType[]).map(t => (
                  <button key={t} onClick={() => setReportType(t)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      reportType === t ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'
                    }`}>
                    {t === 'weekly' ? 'Tuần' : t === 'monthly' ? 'Tháng' : 'Milestone'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 min-w-40">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Kỳ báo cáo</p>
              <input
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                value={period} onChange={e => setPeriod(e.target.value)}
                placeholder="VD: Tuần 12, T3/2026"
              />
            </div>

            <button onClick={generate}
              disabled={status === 'loading_data' || status === 'generating'}
              className="flex items-center gap-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700
                         rounded-xl px-4 py-2 transition-colors disabled:opacity-50">
              {status === 'loading_data' ? <><Loader2 size={12} className="animate-spin"/> Đọc data...</> :
               status === 'generating'   ? <><Loader2 size={12} className="animate-spin"/> GEM đang viết...</> :
               <><Sparkles size={12}/> Tạo báo cáo</>}
            </button>

            {status === 'done' && (
              <button onClick={handlePrint}
                className="flex items-center gap-1.5 text-xs font-bold text-violet-700 bg-violet-50
                           border border-violet-200 rounded-xl px-3 py-2 hover:bg-violet-100 transition-colors">
                <Download size={12}/> Xuất PDF
              </button>
            )}
          </div>

          {/* Error */}
          {status === 'error' && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{errorMsg}</p>
          )}

          {/* Report preview */}
          {status === 'done' && report && (
            <div
              className="text-xs text-slate-700 leading-relaxed border border-slate-100 rounded-xl p-4 bg-slate-50 max-h-96 overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(report) }}
            />
          )}
        </div>
      )}
    </div>
  );
}
