import React, { useState, useRef, useCallback } from 'react';
import {
  Sparkles, Upload, X, FileText, FileSpreadsheet, Image as ImageIcon,
  File, Loader2, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2,
  Copy, Check, Download, Zap, Brain, GitCompare, Search, RotateCcw,
  PlusCircle, ArrowRight, Info, TrendingUp, DollarSign, Shield,
  ClipboardList, HardHat, Maximize2, Minimize2
} from 'lucide-react';
import { GEM_MODEL } from './gemini';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ── Gemini init — SI v4: @google/generative-ai, gemini-3-flash-preview ────────
const genAI = new GoogleGenerativeAI(
  (import.meta as any).env?.VITE_GEMINI_API_KEY || ''
);

// ── Types ──────────────────────────────────────────────────────────────────────
interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: FileType;
  mimeType: string;
  base64: string;
  status: 'ready' | 'processing' | 'done' | 'error';
}

type FileType = 'pdf' | 'excel' | 'word' | 'image' | 'cad' | 'other';
type AnalysisMode =
  | 'compare'       // So sánh nhiều tài liệu
  | 'extract'       // Bóc tách dữ liệu
  | 'risk'          // Phát hiện rủi ro
  | 'summary'       // Tóm tắt nhanh
  | 'discrepancy';  // Tìm mâu thuẫn

interface AnalysisResult {
  mode: AnalysisMode;
  content: string;
  files: string[];
  timestamp: Date;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function getFileType(mimeType: string, name: string): FileType {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) return 'excel';
  if (mimeType.includes('wordprocessingml') || mimeType.includes('msword') || name.endsWith('.docx') || name.endsWith('.doc')) return 'word';
  if (mimeType.startsWith('image/')) return 'image';
  if (name.endsWith('.dwg') || name.endsWith('.dxf') || name.endsWith('.dwf')) return 'cad';
  return 'other';
}

function fileIcon(type: FileType) {
  switch (type) {
    case 'pdf':    return <FileText size={16} className="text-rose-500"/>;
    case 'excel':  return <FileSpreadsheet size={16} className="text-emerald-500"/>;
    case 'word':   return <FileText size={16} className="text-blue-500"/>;
    case 'image':  return <ImageIcon size={16} className="text-violet-500"/>;
    case 'cad':    return <File size={16} className="text-amber-500"/>;
    default:       return <File size={16} className="text-slate-400"/>;
  }
}

function fileBadge(type: FileType) {
  const map: Record<FileType, { label: string; cls: string }> = {
    pdf:   { label: 'PDF',   cls: 'bg-rose-50 text-rose-600 border-rose-200' },
    excel: { label: 'Excel', cls: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
    word:  { label: 'Word',  cls: 'bg-blue-50 text-blue-600 border-blue-200' },
    image: { label: 'Ảnh',   cls: 'bg-violet-50 text-violet-600 border-violet-200' },
    cad:   { label: 'CAD',   cls: 'bg-amber-50 text-amber-600 border-amber-200' },
    other: { label: 'File',  cls: 'bg-slate-50 text-slate-500 border-slate-200' },
  };
  const { label, cls } = map[type];
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${cls}`}>{label}</span>;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const MODES: { id: AnalysisMode; label: string; desc: string; icon: React.ReactNode; color: string; minFiles: number }[] = [
  { id: 'summary',     label: 'Tóm tắt nhanh',    desc: 'GEM tóm tắt nội dung chính từng tài liệu',   icon: <Brain size={15}/>,       color: 'blue',    minFiles: 1 },
  { id: 'extract',     label: 'Bóc tách số liệu',  desc: 'Trích xuất khối lượng, đơn giá, tổng tiền',  icon: <Search size={15}/>,      color: 'emerald', minFiles: 1 },
  { id: 'compare',     label: 'So sánh tài liệu',  desc: 'Tìm điểm khác nhau giữa các phiên bản/file', icon: <GitCompare size={15}/>,  color: 'violet',  minFiles: 2 },
  { id: 'discrepancy', label: 'Tìm mâu thuẫn',     desc: 'Phát hiện số liệu không khớp, lỗi thiếu sót',icon: <AlertTriangle size={15}/>, color: 'amber', minFiles: 2 },
  { id: 'risk',        label: 'Phân tích rủi ro',  desc: 'Cảnh báo điều khoản bất lợi, rủi ro pháp lý',icon: <Shield size={15}/>,      color: 'rose',    minFiles: 1 },
];

const MODE_COLOR: Record<string, string> = {
  blue:    'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
  violet:  'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100',
  amber:   'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
  rose:    'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100',
};

const MODE_ACTIVE: Record<string, string> = {
  blue:    'bg-blue-600 text-white border-blue-700 shadow-md',
  emerald: 'bg-emerald-600 text-white border-emerald-700 shadow-md',
  violet:  'bg-violet-600 text-white border-violet-700 shadow-md',
  amber:   'bg-amber-500 text-white border-amber-600 shadow-md',
  rose:    'bg-rose-600 text-white border-rose-700 shadow-md',
};

const QUICK_PROMPTS: { label: string; prompt: string; icon: React.ReactNode }[] = [
  { label: 'HĐ vs Phụ lục', prompt: 'So sánh giá trị, khối lượng và điều khoản giữa hợp đồng gốc và phụ lục. Liệt kê điểm thay đổi và đánh giá tác động tài chính.', icon: <DollarSign size={13}/> },
  { label: 'BOQ vs Thực tế', prompt: 'So sánh khối lượng trong BOQ với số liệu thực tế thi công. Tính % chênh lệch và đề xuất Variation Order nếu cần.', icon: <ClipboardList size={13}/> },
  { label: 'Bản vẽ vs Nghiệm thu', prompt: 'Đối chiếu thông số kỹ thuật trong bản vẽ với biên bản nghiệm thu. Liệt kê hạng mục chưa đủ điều kiện nghiệm thu.', icon: <HardHat size={13}/> },
  { label: 'Tóm tắt hợp đồng', prompt: 'Tóm tắt ngắn gọn: giá trị hợp đồng, thời gian, các bên, điều khoản thanh toán, bảo lãnh và điều khoản phạt quan trọng nhất.', icon: <FileText size={13}/> },
  { label: 'Kiểm tra tiến độ', prompt: 'Phân tích tiến độ thi công từ tài liệu. Tính SPI (Schedule Performance Index), xác định hạng mục trễ và đề xuất biện pháp khắc phục.', icon: <TrendingUp size={13}/> },
  { label: 'Rủi ro pháp lý', prompt: 'Rà soát toàn bộ tài liệu, liệt kê các điều khoản bất lợi, mơ hồ hoặc tiềm ẩn rủi ro pháp lý. Đánh giá mức độ nghiêm trọng từng rủi ro.', icon: <Shield size={13}/> },
];

// ── System prompt cho GEM multi-document ──────────────────────────────────────
import { getProjectTemplate, PROJECT_TEMPLATES } from './projectTemplates';

const SYSTEM_PROMPT = `Bạn là GEM — chuyên gia phân tích tài liệu xây dựng hàng đầu Việt Nam.

NHIỆM VỤ: Phân tích, so sánh và trích xuất thông tin từ các tài liệu xây dựng được cung cấp.

KIẾN THỨC CHUYÊN SÂU:
- Hợp đồng xây dựng theo Luật Xây dựng VN, Nghị định 37/2015/NĐ-CP
- BOQ (Bảng khối lượng) và định mức XDCT Việt Nam
- TCVN tiêu chuẩn kỹ thuật xây dựng
- Thông tư 09/2016/TT-BTC về quyết toán vốn đầu tư
- FIDIC conditions of contract (áp dụng cho dự án quốc tế)
- Quy trình nghiệm thu theo TCXDVN 371:2006

CÁCH TRẢ LỜI:
- Xưng "em", gọi "anh/chị" — giọng miền Nam thân thiện
- Dùng Markdown: **bold** cho điểm quan trọng, bảng cho so sánh số liệu
- Số tiền: định dạng VNĐ (VD: 45.800.000.000 đồng)
- Cảnh báo rủi ro: dùng ⚠️, điểm tốt dùng ✅, cần lưu ý dùng 📌
- Kết thúc bằng khuyến nghị hành động cụ thể

GIỚI HẠN: Nếu file là CAD (.dwg/.dxf), em chỉ đọc được metadata và tên layer — không render được bản vẽ. Hãy thông báo rõ.`;

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  projectName?: string;
  projectId?:   string;
}

import GemAIPredictive from './GemAIPredictive';

export default function GemAIDashboard({ projectName = 'Dự án', projectId }: Props) {
  const [mainTab, setMainTab] = useState<'rag' | 'predictive'>('rag');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [mode, setMode] = useState<AnalysisMode>('summary');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [expandedResult, setExpandedResult] = useState<number | null>(0);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [fullscreenIdx, setFullscreenIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File handling ────────────────────────────────────────────────────────
  const processFile = useCallback((file: File): Promise<UploadedFile> => {
    return new Promise((resolve, reject) => {
      if (file.size > 20 * 1024 * 1024) {
        reject(new Error(`File "${file.name}" quá lớn (tối đa 20MB)`));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        const fType = getFileType(file.type, file.name);
        resolve({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: file.name,
          size: file.size,
          type: fType,
          mimeType: file.type || 'application/octet-stream',
          base64,
          status: 'ready',
        });
      };
      reader.onerror = () => reject(new Error(`Không đọc được file "${file.name}"`));
      reader.readAsDataURL(file);
    });
  }, []);

  const addFiles = useCallback(async (newFiles: FileList | File[]) => {
    setError(null);
    const arr = Array.from(newFiles);
    const results = await Promise.allSettled(arr.map(processFile));
    const processed: UploadedFile[] = [];
    const errors: string[] = [];
    results.forEach(r => {
      if (r.status === 'fulfilled') processed.push(r.value);
      else errors.push(r.reason.message);
    });
    if (errors.length) setError(errors.join('\n'));
    setFiles(prev => {
      const existingNames = new Set(prev.map(f => f.name));
      const unique = processed.filter(f => !existingNames.has(f.name));
      return [...prev, ...unique].slice(0, 10); // max 10 files
    });
  }, [processFile]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const removeFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id));
  const clearAll = () => { setFiles([]); setResults([]); setError(null); };

  // ── Analysis ─────────────────────────────────────────────────────────────
  const buildPrompt = (): string => {
    if (customPrompt.trim()) return customPrompt.trim();
    const modeObj = MODES.find(m => m.id === mode)!;
    const fileList = files.map(f => `- ${f.name} (${f.type.toUpperCase()})`).join('\n');
    const prompts: Record<AnalysisMode, string> = {
      summary:     `Dự án: ${projectName}\nCác tài liệu:\n${fileList}\n\nHãy tóm tắt nội dung chính của từng tài liệu. Với mỗi file, nêu: mục đích, các bên liên quan, số liệu quan trọng, và điểm cần lưu ý.`,
      extract:     `Dự án: ${projectName}\nCác tài liệu:\n${fileList}\n\nBóc tách và tổng hợp tất cả số liệu quan trọng: khối lượng công việc, đơn giá, tổng giá trị, thời gian, tên các bên. Trình bày dạng bảng nếu có thể.`,
      compare:     `Dự án: ${projectName}\nCác tài liệu cần so sánh:\n${fileList}\n\nSo sánh chi tiết các tài liệu này. Lập bảng so sánh từng hạng mục quan trọng. Nêu rõ điểm giống, điểm khác và tác động của sự khác biệt.`,
      discrepancy: `Dự án: ${projectName}\nCác tài liệu:\n${fileList}\n\nRà soát kỹ và tìm tất cả mâu thuẫn, bất nhất giữa các tài liệu: số liệu không khớp, điều khoản xung đột, thông tin thiếu sót. Đánh giá mức độ nghiêm trọng từng vấn đề.`,
      risk:        `Dự án: ${projectName}\nCác tài liệu:\n${fileList}\n\nPhân tích rủi ro toàn diện: điều khoản bất lợi, nghĩa vụ không rõ ràng, rủi ro pháp lý, rủi ro tài chính. Xếp hạng từng rủi ro (Cao/Trung bình/Thấp) và đề xuất biện pháp giảm thiểu.`,
    };
    return prompts[mode];
  };

  const buildContentParts = () => {
    const parts: any[] = [];
    // Text prompt
    parts.push({ text: buildPrompt() });
    // File parts — chỉ image và PDF Gemini đọc trực tiếp được
    files.forEach(f => {
      if (f.type === 'image') {
        parts.push({ inlineData: { mimeType: f.mimeType, data: f.base64 } });
      } else if (f.type === 'pdf') {
        parts.push({ inlineData: { mimeType: 'application/pdf', data: f.base64 } });
      } else {
        // Word, Excel, CAD — gửi dưới dạng text mô tả
        parts.push({ text: `\n[File đính kèm: ${f.name} — ${f.type.toUpperCase()}, ${formatSize(f.size)}. Lưu ý: em chỉ nhận được metadata của file này, không đọc được nội dung trực tiếp. Hãy phân tích dựa trên tên file và ngữ cảnh dự án.]` });
      }
    });
    return parts;
  };

  const handleAnalyze = async () => {
    if (files.length === 0) { setError('Dạ anh cần upload ít nhất 1 file trước nghen!'); return; }
    const selectedMode = MODES.find(m => m.id === mode)!;
    if (!customPrompt.trim() && files.length < selectedMode.minFiles) {
      setError(`Chế độ "${selectedMode.label}" cần ít nhất ${selectedMode.minFiles} file.`);
      return;
    }
    setIsAnalyzing(true);
    setError(null);
    try {
      const model = genAI.getGenerativeModel({
        model: GEM_MODEL,
        systemInstruction: (() => {
          // Inject template risk context nếu có
          if (!projectId) return SYSTEM_PROMPT;
          const tplId = getProjectTemplate(projectId);
          const tpl   = tplId ? PROJECT_TEMPLATES[tplId] : null;
          if (!tpl?.risks?.length) return SYSTEM_PROMPT;
          const riskLines = tpl.risks.map(r =>
            `  - [${r.impact === 'cao' ? '⚠ CAO' : r.impact === 'trung_binh' ? '⚡ VỪA' : '✓ THẤP'}] ${r.risk} → ${r.mitigation}`
          ).join('\n');
          return SYSTEM_PROMPT + `\n\nBỐI CẢNH DỰ ÁN — LOẠI: ${tpl.name} (${tpl.icon})\nCÁC RỦI RO ĐÃ XÁC ĐỊNH:\n${riskLines}\n\nKhi phân tích tài liệu, hãy đặc biệt lưu ý các rủi ro trên và liên hệ khi phù hợp.`;
        })(),
        generationConfig: { temperature: 0.3, topP: 0.8, maxOutputTokens: 8192 },
      });
      const result = await model.generateContent(buildContentParts());
      const text = result.response.text();
      const newResult: AnalysisResult = {
        mode,
        content: text,
        files: files.map(f => f.name),
        timestamp: new Date(),
      };
      setResults(prev => [newResult, ...prev]);
      setExpandedResult(0);
    } catch (err: any) {
      setError(`Dạ có lỗi kết nối GEM: ${err.message || 'Unknown error'}. Anh thử lại giúp em nhé!`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopy = (idx: number, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    });
  };

  const modeObj = MODES.find(m => m.id === mode)!;

  // ── Fullscreen result overlay ────────────────────────────────────────────
  if (fullscreenIdx !== null && results[fullscreenIdx]) {
    const r = results[fullscreenIdx];
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <Sparkles size={18} className="text-emerald-600"/>
            <span className="font-bold text-slate-800">Kết quả phân tích — {MODES.find(m=>m.id===r.mode)?.label}</span>
            <span className="text-xs text-slate-400">{r.files.join(', ')}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => handleCopy(fullscreenIdx, r.content)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors">
              {copiedIdx === fullscreenIdx ? <><Check size={12} className="text-emerald-500"/> Đã copy</> : <><Copy size={12}/> Sao chép</>}
            </button>
            <button onClick={() => setFullscreenIdx(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors">
              <Minimize2 size={12}/> Thu nhỏ
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="max-w-4xl mx-auto prose prose-sm prose-slate max-w-none">
            <MarkdownRenderer content={r.content}/>
          </div>
        </div>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* S20: Main tab switcher */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {([["rag","📄 Phân tích tài liệu"],["predictive","📈 Dự báo AI"]] as const).map(([id,label]) => (
          <button key={id} onClick={() => setMainTab(id)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              mainTab === id ? "bg-white shadow text-slate-800" : "text-slate-500 hover:text-slate-700"
            }`}>{label}</button>
        ))}
      </div>

      {mainTab === "predictive" && projectId && (
        <GemAIPredictive projectId={projectId} projectName={projectName} />
      )}
      {mainTab === "predictive" && !projectId && (
        <div className="text-sm text-slate-400 py-8 text-center">Cần chọn dự án để xem dự báo.</div>
      )}
      {mainTab === "rag" && <>{/* RAG content below */}</>}
      {mainTab === "rag" && <div className="space-y-5" style={{display: mainTab === "rag" ? undefined : "none"}}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center">
            <Brain size={20} className="text-emerald-600"/>
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">GEM Phân tích AI</h2>
            <p className="text-xs text-slate-400">Đọc + so sánh tài liệu thông minh — PDF, Excel, Word, Ảnh, CAD</p>
          </div>
        </div>
        {files.length > 0 && (
          <button onClick={clearAll}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-100">
            <RotateCcw size={12}/> Làm mới
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* ── LEFT PANEL: Upload + Config ─────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-emerald-400 bg-emerald-50/80 scale-[1.01]'
                : files.length === 0
                  ? 'border-slate-200 bg-slate-50/50 hover:border-emerald-300 hover:bg-emerald-50/30'
                  : 'border-slate-200 bg-white hover:border-emerald-300'
            }`}>
            <input ref={fileInputRef} type="file" multiple accept=".pdf,.xlsx,.xls,.csv,.docx,.doc,.png,.jpg,.jpeg,.gif,.webp,.dwg,.dxf"
              onChange={e => e.target.files && addFiles(e.target.files)} className="hidden"/>
            <Upload size={22} className={`mx-auto mb-2 ${isDragging ? 'text-emerald-500' : 'text-slate-300'}`}/>
            <p className="text-sm font-semibold text-slate-600">
              {isDragging ? 'Thả file vào đây!' : 'Kéo thả hoặc click để chọn file'}
            </p>
            <p className="text-xs text-slate-400 mt-1">PDF · Excel · Word · Ảnh · CAD — Tối đa 10 file, 20MB/file</p>
            {files.length > 0 && (
              <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {files.length}
              </div>
            )}
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Tài liệu đã nạp ({files.length})</span>
                <button onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-semibold">
                  <PlusCircle size={11}/> Thêm
                </button>
              </div>
              <div className="divide-y divide-slate-50 max-h-56 overflow-y-auto">
                {files.map(f => (
                  <div key={f.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/60 group transition-colors">
                    {fileIcon(f.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700 truncate">{f.name}</p>
                      <p className="text-[10px] text-slate-400">{formatSize(f.size)}</p>
                    </div>
                    {fileBadge(f.type)}
                    <button onClick={() => removeFile(f.id)}
                      className="p-1 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                      <X size={12}/>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CAD warning */}
          {files.some(f => f.type === 'cad') && (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
              <Info size={14} className="text-amber-500 shrink-0 mt-0.5"/>
              <p className="text-xs text-amber-700">File CAD (.dwg/.dxf): GEM chỉ đọc được metadata và tên layer — không render bản vẽ được. Em sẽ phân tích theo tên file và ngữ cảnh dự án.</p>
            </div>
          )}

          {/* Mode selector */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Chế độ phân tích</span>
            </div>
            <div className="p-3 space-y-1.5">
              {MODES.map(m => {
                const isActive = mode === m.id;
                const disabled = files.length > 0 && !customPrompt.trim() && files.length < m.minFiles;
                return (
                  <button key={m.id}
                    onClick={() => !disabled && setMode(m.id)}
                    title={disabled ? `Cần ít nhất ${m.minFiles} file` : ''}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all border text-xs ${
                      disabled ? 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-100 text-slate-400' :
                      isActive ? MODE_ACTIVE[m.color] : MODE_COLOR[m.color]
                    }`}>
                    {m.icon}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">{m.label}</div>
                      <div className={`text-[10px] mt-0.5 ${isActive ? 'opacity-80' : 'opacity-70'}`}>{m.desc}</div>
                    </div>
                    {m.minFiles > 1 && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isActive ? 'bg-white/20' : 'bg-white border border-current opacity-60'}`}>
                        ≥{m.minFiles} file
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom prompt */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Câu hỏi tuỳ chỉnh</span>
            </div>
            <div className="p-3 space-y-2">
              <textarea
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                placeholder="Nhập câu hỏi cụ thể cho GEM phân tích... (bỏ trống để dùng chế độ mặc định)"
                rows={3}
                className="w-full text-xs text-slate-700 placeholder-slate-300 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:border-emerald-400 focus:bg-white transition-all"
              />
              {/* Quick prompts */}
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PROMPTS.map((qp, i) => (
                  <button key={i} onClick={() => setCustomPrompt(qp.prompt)}
                    className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 rounded-lg transition-colors border border-transparent hover:border-emerald-200">
                    {qp.icon} {qp.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5">
              <AlertTriangle size={14} className="text-rose-500 shrink-0 mt-0.5"/>
              <p className="text-xs text-rose-700 whitespace-pre-line">{error}</p>
            </div>
          )}

          {/* Analyze button */}
          <button onClick={handleAnalyze} disabled={isAnalyzing || files.length === 0}
            className={`w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl text-sm font-bold transition-all ${
              isAnalyzing || files.length === 0
                ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200 hover:shadow-emerald-300 active:scale-[0.98]'
            }`}>
            {isAnalyzing
              ? <><Loader2 size={16} className="animate-spin"/> Nàng GEM đang phân tích...</>
              : <><Zap size={16}/> Phân tích ngay</>
            }
          </button>
        </div>

        {/* ── RIGHT PANEL: Results ─────────────────────────────────────────── */}
        <div className="lg:col-span-3 space-y-4">

          {/* Empty state */}
          {results.length === 0 && !isAnalyzing && (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center min-h-[320px]">
              <div className="w-16 h-16 bg-emerald-50 border border-emerald-100 rounded-3xl flex items-center justify-center mb-4">
                <Brain size={28} className="text-emerald-400"/>
              </div>
              <h3 className="font-bold text-slate-700 mb-1">Sẵn sàng phân tích</h3>
              <p className="text-sm text-slate-400 mb-5 max-w-xs">Upload tài liệu dự án, chọn chế độ phân tích và để GEM làm việc</p>
              <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
                {[
                  { icon: <GitCompare size={13}/>, text: 'So sánh HĐ gốc vs phụ lục' },
                  { icon: <Search size={13}/>, text: 'Bóc tách BOQ từ PDF' },
                  { icon: <Shield size={13}/>, text: 'Rà soát rủi ro pháp lý' },
                  { icon: <AlertTriangle size={13}/>, text: 'Tìm mâu thuẫn số liệu' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 text-xs text-slate-500">
                    <span className="text-emerald-400">{item.icon}</span> {item.text}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Loading state */}
          {isAnalyzing && (
            <div className="bg-white border border-emerald-200 rounded-2xl p-8 flex flex-col items-center justify-center min-h-[200px]">
              <div className="relative mb-4">
                <div className="w-14 h-14 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center">
                  <Sparkles size={24} className="text-emerald-500 animate-pulse"/>
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full animate-bounce"/>
              </div>
              <p className="font-bold text-slate-700 mb-1">Nàng GEM đang phân tích...</p>
              <p className="text-xs text-slate-400 text-center max-w-xs">
                Em đang đọc {files.length} tài liệu, {MODES.find(m=>m.id===mode)?.label.toLowerCase()}. Thường mất 10–30 giây.
              </p>
            </div>
          )}

          {/* Results list */}
          {results.map((result, idx) => {
            const isExpanded = expandedResult === idx;
            const mObj = MODES.find(m => m.id === result.mode);
            const isFullscreen = fullscreenIdx === idx;
            return (
              <div key={idx} className={`bg-white border rounded-2xl overflow-hidden transition-all ${
                idx === 0 ? 'border-emerald-200 shadow-sm shadow-emerald-100' : 'border-slate-200'
              }`}>
                {/* Result header */}
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50/60 border-b border-slate-100">
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                    idx === 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'
                  }`}>
                    <Sparkles size={13}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-700">{mObj?.label}</span>
                      {idx === 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-600 rounded">Mới nhất</span>}
                    </div>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                      {result.files.join(' · ')} · {result.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => handleCopy(idx, result.content)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                      {copiedIdx === idx ? <Check size={13} className="text-emerald-500"/> : <Copy size={13}/>}
                    </button>
                    <button onClick={() => setFullscreenIdx(idx)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                      <Maximize2 size={13}/>
                    </button>
                    <button onClick={() => setExpandedResult(isExpanded ? null : idx)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                      {isExpanded ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                    </button>
                  </div>
                </div>
                {/* Result content */}
                {isExpanded && (
                  <div className="px-5 py-4 overflow-y-auto max-h-[520px]">
                    <MarkdownRenderer content={result.content}/>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
      </div>}
  );
}

// ── Minimal Markdown renderer ─────────────────────────────────────────────────
function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  const parseInline = (text: string): React.ReactNode => {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**'))
        return <strong key={idx} className="font-semibold text-slate-800">{part.slice(2,-2)}</strong>;
      if (part.startsWith('`') && part.endsWith('`'))
        return <code key={idx} className="bg-slate-100 text-rose-600 px-1 py-0.5 rounded text-[11px] font-mono">{part.slice(1,-1)}</code>;
      return part;
    });
  };

  while (i < lines.length) {
    const line = lines[i];
    // H1
    if (line.startsWith('# ')) {
      elements.push(<h1 key={i} className="text-lg font-bold text-slate-800 mt-5 mb-3 pb-2 border-b border-slate-200">{parseInline(line.slice(2))}</h1>);
    }
    // H2
    else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-base font-bold text-slate-700 mt-4 mb-2">{parseInline(line.slice(3))}</h2>);
    }
    // H3
    else if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-sm font-bold text-slate-700 mt-3 mb-1.5">{parseInline(line.slice(4))}</h3>);
    }
    // Bullet
    else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={i} className="flex items-start gap-2 my-1 pl-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5"/>
          <span className="text-sm text-slate-600 leading-relaxed">{parseInline(line.slice(2))}</span>
        </div>
      );
    }
    // Numbered list
    else if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\./)?.[1];
      elements.push(
        <div key={i} className="flex items-start gap-2 my-1 pl-2">
          <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{num}</span>
          <span className="text-sm text-slate-600 leading-relaxed">{parseInline(line.replace(/^\d+\.\s/, ''))}</span>
        </div>
      );
    }
    // Table
    else if (line.startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      i--;
      const rows = tableLines.filter(r => !r.match(/^\|[-:\s|]+\|$/));
      elements.push(
        <div key={i} className="overflow-x-auto my-3 rounded-xl border border-slate-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50">
                {rows[0]?.split('|').filter(Boolean).map((cell, ci) => (
                  <th key={ci} className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">{parseInline(cell.trim())}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(1).map((row, ri) => (
                <tr key={ri} className={ri%2===0?'bg-white':'bg-slate-50/50'}>
                  {row.split('|').filter(Boolean).map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-slate-600 border-b border-slate-100">{parseInline(cell.trim())}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    // Horizontal rule
    else if (line.match(/^---+$/)) {
      elements.push(<hr key={i} className="my-4 border-slate-200"/>);
    }
    // Blockquote / highlight
    else if (line.startsWith('> ')) {
      elements.push(
        <div key={i} className="border-l-4 border-emerald-400 bg-emerald-50/60 px-4 py-2.5 my-2 rounded-r-xl">
          <span className="text-sm text-slate-600">{parseInline(line.slice(2))}</span>
        </div>
      );
    }
    // Empty line
    else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2"/>);
    }
    // Normal paragraph
    else {
      elements.push(<p key={i} className="text-sm text-slate-600 leading-relaxed my-1">{parseInline(line)}</p>);
    }
    i++;
  }
  return <div className="space-y-0.5">{elements}</div>;
}
