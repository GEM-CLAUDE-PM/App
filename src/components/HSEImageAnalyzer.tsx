/**
 * HSEImageAnalyzer.tsx — GEM&CLAUDE PM Pro
 * S21 — AI phân tích ảnh hiện trường HSE
 * Gemini Vision → detect PPE violation, unsafe condition, risk level
 *
 * Input: ảnh từ CameraCapture hoặc upload
 * Output: báo cáo structured (violations[], risk, recommendations)
 *
 * Tích hợp trong HSEWorkspace tab Incidents + Inspections
 * Usage:
 *   <HSEImageAnalyzer
 *     projectId={pid}
 *     onAnalysis={(result) => { setIncForm(f => ({...f, ...result})) }}
 *   />
 */
import React, { useState, useRef, useCallback } from 'react';
import { useNotification } from './NotificationEngine';
import { gemGenerateMultipart, GEM_MODEL_VISION } from './gemini';
import CameraCapture from './CameraCapture';
import {
  Camera, Upload, Sparkles, AlertTriangle, CheckCircle2,
  ShieldAlert, X, Eye, Loader2, RefreshCw,
} from 'lucide-react';

export interface HSEAnalysisResult {
  risk_level:      'low' | 'medium' | 'high' | 'critical';
  violations:      string[];     // danh sách vi phạm cụ thể
  unsafe_conditions: string[];   // điều kiện không an toàn
  recommendations: string[];     // đề xuất khắc phục
  summary:         string;       // tóm tắt 1 câu
  confidence:      number;       // 0-100
}

interface HSEImageAnalyzerProps {
  projectId:    string;
  uploadedBy?:  string;
  onAnalysis?:  (result: HSEAnalysisResult, imageDataUrl: string) => void;
  compact?:     boolean;   // true = chỉ show nút, không show full UI
}

const RISK_CFG = {
  low:      { label: 'Thấp',       cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  medium:   { label: 'Trung bình', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  high:     { label: 'Cao',        cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  critical: { label: 'Nghiêm trọng', cls: 'bg-red-100 text-red-700 border-red-200' },
};

const HSE_ANALYSIS_PROMPT =
  `Anh là chuyên gia an toàn lao động (HSE) với 20 năm kinh nghiệm công trường xây dựng Việt Nam.
Phân tích ảnh hiện trường này và trả về JSON với cấu trúc sau (chỉ JSON, không giải thích):

{
  "risk_level": "low|medium|high|critical",
  "violations": ["vi phạm cụ thể 1", "vi phạm 2"],
  "unsafe_conditions": ["điều kiện không an toàn 1", "điều kiện 2"],
  "recommendations": ["đề xuất khắc phục 1", "đề xuất 2", "đề xuất 3"],
  "summary": "Tóm tắt 1 câu về tình trạng an toàn trong ảnh",
  "confidence": 85
}

Kiểm tra các yếu tố:
- PPE: mũ bảo hộ, giày bảo hộ, dây an toàn, áo phản quang, kính bảo hộ, khẩu trang
- Điều kiện làm việc: rào chắn, biển cảnh báo, vệ sinh công trường, sắp xếp vật liệu
- Hoạt động nguy hiểm: làm việc trên cao, vận hành thiết bị, điện, hóa chất
- Nếu không thấy vi phạm rõ ràng, violations và unsafe_conditions là mảng rỗng []`;

export default function HSEImageAnalyzer({
  projectId,
  uploadedBy = 'hse_officer',
  onAnalysis,
  compact = false,
}: HSEImageAnalyzerProps) {
  const { err } = useNotification();

  const [showCamera, setShowCamera]       = useState(false);
  const [imageDataUrl, setImageDataUrl]   = useState<string | null>(null);
  const [analyzing, setAnalyzing]         = useState(false);
  const [result, setResult]               = useState<HSEAnalysisResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Phân tích ảnh qua Gemini Vision
  const analyze = useCallback(async (dataUrl: string) => {
    setAnalyzing(true);
    setResult(null);
    try {
      const base64 = dataUrl.split(',')[1];
      const mimeType = dataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';

      const raw = await gemGenerateMultipart(
        [
          { inlineData: { data: base64, mimeType } },
          { text: HSE_ANALYSIS_PROMPT },
        ],
        { model: GEM_MODEL_VISION, temperature: 0.1 }
      );

      // Parse JSON — strip markdown fences nếu có
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const parsed: HSEAnalysisResult = JSON.parse(cleaned);

      // Validate fields
      const safe: HSEAnalysisResult = {
        risk_level:        ['low','medium','high','critical'].includes(parsed.risk_level)
                             ? parsed.risk_level : 'medium',
        violations:        Array.isArray(parsed.violations) ? parsed.violations : [],
        unsafe_conditions: Array.isArray(parsed.unsafe_conditions) ? parsed.unsafe_conditions : [],
        recommendations:   Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        summary:           parsed.summary ?? 'Không thể phân tích.',
        confidence:        typeof parsed.confidence === 'number' ? parsed.confidence : 70,
      };

      setResult(safe);
      onAnalysis?.(safe, dataUrl);
    } catch (e: any) {
      err(`GEM Vision lỗi: ${e.message}`);
    } finally {
      setAnalyzing(false);
    }
  }, [onAnalysis]);

  const handleCapture = useCallback(({ dataUrl }: { dataUrl: string }) => {
    setImageDataUrl(dataUrl);
    setShowCamera(false);
    analyze(dataUrl);
  }, [analyze]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setImageDataUrl(url);
      analyze(url);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [analyze]);

  const reset = () => {
    setImageDataUrl(null);
    setResult(null);
  };

  if (compact) {
    return (
      <>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowCamera(true)}
            className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50
              border border-emerald-200 rounded-xl px-3 py-1.5 hover:bg-emerald-100 transition-colors">
            <Camera size={12}/> Chụp + Phân tích HSE
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50
              border border-slate-200 rounded-xl px-3 py-1.5 hover:bg-slate-100 transition-colors">
            <Upload size={12}/> Upload ảnh
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload}/>
        </div>
        {showCamera && (
          <CameraCapture
            projectId={projectId} category="hse" uploadedBy={uploadedBy}
            onCapture={handleCapture} onClose={() => setShowCamera(false)}
          />
        )}
        {analyzing && (
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
            <Loader2 size={12} className="animate-spin"/> GEM đang phân tích ảnh...
          </div>
        )}
        {result && (
          <div className={`mt-2 text-xs px-3 py-2 rounded-xl border ${RISK_CFG[result.risk_level].cls}`}>
            <span className="font-bold">Rủi ro {RISK_CFG[result.risk_level].label}:</span> {result.summary}
            {result.violations.length > 0 && (
              <div className="mt-1">Vi phạm: {result.violations.join(' · ')}</div>
            )}
          </div>
        )}
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* Input zone */}
      {!imageDataUrl ? (
        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center space-y-3">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto">
            <Eye size={20} className="text-slate-400"/>
          </div>
          <p className="text-sm font-medium text-slate-700">Phân tích ảnh hiện trường bằng GEM AI</p>
          <p className="text-xs text-slate-400">Detect vi phạm PPE, điều kiện không an toàn, rủi ro</p>
          <div className="flex gap-2 justify-center">
            <button type="button" onClick={() => setShowCamera(true)}
              className="flex items-center gap-1.5 text-xs font-bold text-white
                bg-emerald-600 hover:bg-emerald-700 rounded-xl px-4 py-2 transition-colors">
              <Camera size={13}/> Chụp ảnh
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-700
                bg-white border border-slate-200 hover:bg-slate-50 rounded-xl px-4 py-2 transition-colors">
              <Upload size={13}/> Upload ảnh
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload}/>
          </div>
        </div>
      ) : (
        <div className="relative">
          <img src={imageDataUrl} alt="HSE" className="w-full max-h-64 object-cover rounded-2xl border border-slate-200"/>
          <button onClick={reset}
            className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70">
            <X size={14}/>
          </button>
          {analyzing && (
            <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center">
              <div className="bg-white rounded-xl px-4 py-3 flex items-center gap-2 text-sm font-medium">
                <Loader2 size={16} className="animate-spin text-emerald-600"/>
                GEM đang phân tích...
              </div>
            </div>
          )}
        </div>
      )}

      {/* Result */}
      {result && !analyzing && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {/* Risk header */}
          <div className={`flex items-center justify-between px-4 py-3 border-b ${RISK_CFG[result.risk_level].cls}`}>
            <div className="flex items-center gap-2">
              {result.risk_level === 'low'
                ? <CheckCircle2 size={15}/>
                : <ShieldAlert size={15}/>}
              <span className="text-sm font-black">
                Rủi ro {RISK_CFG[result.risk_level].label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold opacity-70">Độ tin cậy {result.confidence}%</span>
              <button onClick={() => imageDataUrl && analyze(imageDataUrl)}
                className="opacity-60 hover:opacity-100">
                <RefreshCw size={12}/>
              </button>
            </div>
          </div>

          <div className="px-4 py-3 space-y-3">
            {/* Summary */}
            <p className="text-xs text-slate-700">{result.summary}</p>

            {/* Violations */}
            {result.violations.length > 0 && (
              <div>
                <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1.5">
                  Vi phạm PPE / An toàn
                </p>
                <ul className="space-y-1">
                  {result.violations.map((v, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                      <AlertTriangle size={11} className="text-red-500 mt-0.5 shrink-0"/>
                      {v}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Unsafe conditions */}
            {result.unsafe_conditions.length > 0 && (
              <div>
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1.5">
                  Điều kiện không an toàn
                </p>
                <ul className="space-y-1">
                  {result.unsafe_conditions.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                      <AlertTriangle size={11} className="text-amber-500 mt-0.5 shrink-0"/>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {result.recommendations.length > 0 && (
              <div>
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1.5">
                  Khuyến nghị khắc phục
                </p>
                <ul className="space-y-1">
                  {result.recommendations.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                      <CheckCircle2 size={11} className="text-emerald-500 mt-0.5 shrink-0"/>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* No violations */}
            {result.violations.length === 0 && result.unsafe_conditions.length === 0 && (
              <div className="flex items-center gap-2 text-xs text-emerald-700">
                <CheckCircle2 size={14}/>
                Không phát hiện vi phạm rõ ràng trong ảnh.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Camera overlay */}
      {showCamera && (
        <CameraCapture
          projectId={projectId} category="hse" uploadedBy={uploadedBy}
          description="HSE Image Analysis"
          onCapture={handleCapture} onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}
