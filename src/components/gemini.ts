// ── Shared Gemini AI client (SI V5.0) ────────────────────────────────────────
// Package: @google/generative-ai ^0.24.1
// Model default: gemini-3-flash-preview — TUYỆT ĐỐI KHÔNG thay đổi
// temperature: 0.25 default toàn app — PM số liệu thực chiến, không bịa
// V5.0: Unified wrapper — toàn bộ app dùng file này, không init riêng lẻ
import { GoogleGenerativeAI } from "@google/generative-ai";

// ── Single client instance cho toàn app ───────────────────────────────────────
const _client = new GoogleGenerativeAI(
  (import.meta as any).env?.VITE_GEMINI_API_KEY || ''
);

// ── Defaults toàn app ─────────────────────────────────────────────────────────
export const GEM_MODEL         = 'gemini-3-flash-preview';
export const GEM_MODEL_VISION  = 'gemini-3-flash-preview'; // vision-capable
export const GEM_MODEL_QUALITY = 'gemini-3-flash-preview'; // QA/QC — dùng model chính khi quality model không available

const DEFAULT_CONFIG = {
  temperature: 0.25,  // thấp = chính xác, không hallucinate
  maxOutputTokens: 8192,  // đủ cho báo cáo dài, nhật ký, phân tích
  // topP, topK removed — Gemini 3 Flash dùng defaults của model
};

// ── Types ─────────────────────────────────────────────────────────────────────
export interface GemModelOptions {
  model?: string;               // default: GEM_MODEL
  systemInstruction?: string;
  generationConfig?: {
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
  };
}

export interface GemModel {
  generateContent: (prompt: string | any[]) => Promise<{ response: { text: () => string } }>;
  startChat: (options?: { history?: any[] }) => any;
}

// ── Core factory ──────────────────────────────────────────────────────────────
function _buildModel(opts: GemModelOptions): GemModel {
  const modelName   = opts.model || GEM_MODEL;
  const mergedConfig = { ...DEFAULT_CONFIG, ...opts.generationConfig };

  const m = _client.getGenerativeModel({
    model: modelName,
    generationConfig: mergedConfig,
    ...(opts.systemInstruction && {
      systemInstruction: opts.systemInstruction,
    }),
  });

  return {
    generateContent: async (prompt: string | any[]) => {
      let contents: any;
      if (typeof prompt === 'string') {
        // Text-only — systemInstruction đã pass vào SDK, không inject inline
        contents = prompt;
      } else {
        // Multipart (ảnh, file, mixed) — pass thẳng
        contents = prompt;
      }
      const result = await m.generateContent(contents);
      return { response: { text: () => result.response.text() } };
    },

    startChat: (options?: { history?: any[] }) => {
      // systemInstruction đã set ở getGenerativeModel level — không set lại ở startChat
      return m.startChat({
        history: options?.history || [],
      });
    },
  };
}

// ── Public API — genAI (drop-in cho các file đang import genAI) ───────────────
export const genAI = {
  getGenerativeModel: (opts: GemModelOptions): GemModel => _buildModel(opts),
};

// ── Convenience helpers — dùng cho các module mới từ S11 trở đi ───────────────

/**
 * Quick text generation — không cần tạo model object
 * @example
 * const text = await gemGenerate('Phân tích tiến độ...', { systemInstruction: SYS })
 */
export async function gemGenerate(
  prompt: string,
  opts: GemModelOptions = {}
): Promise<string> {
  try {
    const model = _buildModel(opts);
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (err) {
    console.error('[GEM] generateContent error:', err);
    throw err;
  }
}

/**
 * Multipart generation — cho ảnh + text (GemAIDashboard, Image Recognition S20)
 * @example
 * const text = await gemGenerateMultipart([{ inlineData: { data, mimeType } }, { text: prompt }])
 */
export async function gemGenerateMultipart(
  parts: any[],
  opts: GemModelOptions = {}
): Promise<string> {
  try {
    const model = _buildModel({ ...opts, model: opts.model || GEM_MODEL_VISION });
    const result = await model.generateContent(parts);
    return result.response.text();
  } catch (err) {
    console.error('[GEM] generateMultipart error:', err);
    throw err;
  }
}

/**
 * Start a persistent chat session (ChatAssistant)
 * @example
 * const session = gemStartChat({ systemInstruction: SYS, history: [] })
 * const reply = await session.sendMessage('Xin chào')
 */
export function gemStartChat(opts: GemModelOptions & { history?: any[] }) {
  const model = _buildModel(opts);
  return model.startChat({ history: opts.history || [] });
}

/**
 * Generate JSON — prompt Gemini trả về JSON thuần, parse sẵn
 * Dùng cho: auto-report, risk scoring, predictive analytics (S19)
 * @example
 * const data = await gemGenerateJSON<ReportData>(prompt, schema, opts)
 */
export async function gemGenerateJSON<T = any>(
  prompt: string,
  schema?: string,  // mô tả schema mong muốn, thêm vào system prompt
  opts: GemModelOptions = {}
): Promise<T> {
  const sysPrefix = schema
    ? `Trả lời CHỈ bằng JSON hợp lệ theo schema sau, không có text hay markdown:\n${schema}\n\n`
    : 'Trả lời CHỈ bằng JSON hợp lệ, không có text hay markdown backticks.\n\n';

  const mergedSys = opts.systemInstruction
    ? `${sysPrefix}${opts.systemInstruction}`
    : sysPrefix;

  const raw = await gemGenerate(prompt, { ...opts, systemInstruction: mergedSys });

  // Strip markdown fences nếu model vẫn wrap
  const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(clean) as T;
}

// ── Export default cho backward compat ────────────────────────────────────────
export default genAI;
