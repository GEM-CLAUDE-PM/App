/**
 * VoiceCapture.tsx — GEM&CLAUDE PM Pro
 * S21 — Nhập liệu bằng giọng nói tiếng Việt
 * Web Speech API (SpeechRecognition) → text → Gemini cleanup → structured output
 *
 * Dùng trong:
 *   - HSEWorkspace: báo cáo sự cố bằng giọng nói
 *   - GiamSatDashboard: ghi chú thực địa nhanh
 *   - ManpowerDashboard: điểm danh bằng giọng (đọc tên)
 *
 * Usage:
 *   <VoiceCapture
 *     onResult={(text) => setIncForm(f => ({...f, description: text}))}
 *     context="hse_incident"
 *     placeholder="Mô tả sự cố..."
 *   />
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Loader2, Check, RefreshCw } from 'lucide-react';
import { genAI, GEM_MODEL } from './gemini';

export type VoiceContext =
  | 'hse_incident'     // HSE — làm sạch thành báo cáo sự cố
  | 'field_note'       // Giám sát — ghi chú thực địa
  | 'attendance'       // Nhân công — danh sách tên
  | 'general';         // Tự do

interface VoiceCaptureProps {
  onResult:     (text: string) => void;
  context?:     VoiceContext;
  placeholder?: string;
  className?:   string;
  autoClean?:   boolean;   // Gọi Gemini để làm sạch text — default true
}

const CONTEXT_PROMPTS: Record<VoiceContext, string> = {
  hse_incident:
    'Đây là ghi chú giọng nói về sự cố an toàn lao động. Hãy làm sạch, sửa lỗi chính tả, ' +
    'và viết lại thành mô tả sự cố chuyên nghiệp ngắn gọn (2-4 câu). Giữ nguyên thông tin thực tế. ' +
    'Chỉ trả về đoạn văn đã làm sạch, không giải thích.',
  field_note:
    'Đây là ghi chú thực địa công trường. Làm sạch lỗi nhận diện giọng nói, ' +
    'viết lại thành ghi chú kỹ thuật ngắn gọn. Chỉ trả về text đã làm sạch.',
  attendance:
    'Đây là danh sách tên công nhân đọc bằng giọng. Làm sạch, ' +
    'trả về danh sách tên mỗi người trên một dòng. Chỉ trả về danh sách.',
  general:
    'Làm sạch đoạn text ghi âm sau, sửa lỗi nhận diện giọng nói tiếng Việt. ' +
    'Chỉ trả về text đã làm sạch.',
};

// Kiểm tra browser support
function getSpeechRecognition(): any {
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export default function VoiceCapture({
  onResult,
  context = 'general',
  placeholder = 'Nhấn mic để nói...',
  className = '',
  autoClean = true,
}: VoiceCaptureProps) {
  const [status, setStatus]       = useState<'idle' | 'listening' | 'processing' | 'done' | 'error'>('idle');
  const [rawText, setRawText]     = useState('');
  const [cleanText, setCleanText] = useState('');
  const [errorMsg, setErrorMsg]   = useState('');
  const [supported, setSupported] = useState(true);
  const recogRef = useRef<any>(null);

  useEffect(() => {
    if (!getSpeechRecognition()) setSupported(false);
  }, []);

  // Khởi tạo SpeechRecognition
  const startListening = useCallback(() => {
    const SR = getSpeechRecognition();
    if (!SR) return;

    const recognition = new SR();
    recogRef.current  = recognition;

    recognition.lang              = 'vi-VN';
    recognition.interimResults    = true;
    recognition.maxAlternatives   = 1;
    recognition.continuous        = false;

    let finalTranscript = '';

    recognition.onstart = () => setStatus('listening');

    recognition.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalTranscript += t + ' ';
        else interim += t;
      }
      setRawText((finalTranscript + interim).trim());
    };

    recognition.onerror = (e: any) => {
      const msg = e.error === 'no-speech'    ? 'Không nghe thấy giọng nói. Thử lại.' :
                  e.error === 'not-allowed'  ? 'Cần cấp quyền microphone.' :
                  e.error === 'network'      ? 'Lỗi mạng — Speech API cần internet.' :
                  `Lỗi: ${e.error}`;
      setErrorMsg(msg);
      setStatus('error');
    };

    recognition.onend = async () => {
      const text = finalTranscript.trim();
      if (!text) { setStatus('idle'); return; }
      setRawText(text);

      if (autoClean) {
        setStatus('processing');
        try {
          const model = genAI.getGenerativeModel({
            model: GEM_MODEL,
            generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
          });
          const prompt = `${CONTEXT_PROMPTS[context]}\n\nText gốc:\n"${text}"`;
          const result = await model.generateContent(prompt);
          const cleaned = result.response.text().trim();
          setCleanText(cleaned);
          onResult(cleaned);
        } catch {
          // Fallback: dùng raw text nếu Gemini lỗi
          setCleanText(text);
          onResult(text);
        }
      } else {
        setCleanText(text);
        onResult(text);
      }
      setStatus('done');
    };

    recognition.start();
  }, [context, autoClean, onResult]);

  const stopListening = () => {
    recogRef.current?.stop();
  };

  const reset = () => {
    setStatus('idle');
    setRawText('');
    setCleanText('');
    setErrorMsg('');
  };

  const handleConfirm = () => {
    onResult(cleanText || rawText);
    reset();
  };

  // Không hỗ trợ → fallback text note
  if (!supported) {
    return (
      <div className={`flex items-center gap-2 text-xs text-slate-400 ${className}`}>
        <MicOff size={13}/>
        <span>Browser không hỗ trợ Voice Input. Dùng Chrome/Edge.</span>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Mic button row */}
      <div className="flex items-center gap-2">
        {status === 'idle' || status === 'error' ? (
          <button
            type="button"
            onClick={startListening}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold
              bg-slate-100 text-slate-700 hover:bg-emerald-100 hover:text-emerald-700
              border border-slate-200 hover:border-emerald-300 transition-all"
          >
            <Mic size={13}/> Nói
          </button>
        ) : status === 'listening' ? (
          <button
            type="button"
            onClick={stopListening}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold
              bg-red-100 text-red-700 border border-red-300 animate-pulse"
          >
            <MicOff size={13}/> Dừng
          </button>
        ) : status === 'processing' ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500">
            <Loader2 size={13} className="animate-spin"/> GEM đang làm sạch...
          </div>
        ) : status === 'done' ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleConfirm}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold
                bg-emerald-100 text-emerald-700 border border-emerald-300">
              <Check size={13}/> Dùng text này
            </button>
            <button type="button" onClick={reset}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs
                text-slate-500 hover:text-slate-700 border border-slate-200">
              <RefreshCw size={12}/> Nói lại
            </button>
          </div>
        ) : null}

        {status === 'listening' && (
          <span className="text-[10px] text-red-500 font-medium animate-pulse">● Đang nghe...</span>
        )}
      </div>

      {/* Live transcript */}
      {(status === 'listening' || status === 'processing') && rawText && (
        <div className="text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100 italic">
          {rawText}
        </div>
      )}

      {/* Cleaned result */}
      {status === 'done' && cleanText && (
        <div className="text-xs text-slate-700 bg-emerald-50 rounded-xl px-3 py-2 border border-emerald-100">
          {cleanText}
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <p className="text-xs text-red-500">{errorMsg}</p>
      )}

      {/* Placeholder when idle */}
      {status === 'idle' && !rawText && (
        <p className="text-[10px] text-slate-300">{placeholder}</p>
      )}
    </div>
  );
}
