/**
 * ZaloService.ts — GEM&CLAUDE PM Pro
 * Zalo Official Account (OA) API integration.
 *
 * Architecture:
 *   Browser → /api/zalo/send (Express proxy) → Zalo OA API
 *
 * WHY a proxy?
 *   Zalo OA requires a server-side secret key (OA_SECRET) — cannot expose in browser.
 *   The Express server (server.ts) handles auth and forwards requests.
 *
 * SETUP:
 *   1. Đăng ký Zalo OA tại: https://oa.zalo.me
 *   2. Lấy OA_ID, OA_SECRET từ Zalo Developer Console
 *   3. Thêm vào .env:
 *        VITE_ZALO_OA_ID=your_oa_id
 *        ZALO_OA_SECRET=your_oa_secret       ← server-only (no VITE_ prefix)
 *        ZALO_OA_ACCESS_TOKEN=...            ← refresh every 3 months
 *   4. Thêm server/zaloRouter.ts vào Express app (xem cuối file)
 *   5. Người nhận phải follow OA trước khi nhận ZNS/broadcast
 *
 * Message types:
 *   - ZNS (Zalo Notification Service) — giao dịch, OTP, nhắc lịch → không cần follow
 *   - Broadcast — nội dung chung → cần follow OA
 *   - Direct message — 1-1 với user_id cụ thể → cần follow OA
 */

export type ZaloMsgType = 'broadcast' | 'direct' | 'zns';

export interface ZaloRecipient {
  user_id?: string;       // Zalo user_id (lấy khi user authorize OA)
  phone?: string;         // Dùng cho ZNS (nếu đã liên kết SĐT)
  name: string;           // Tên hiển thị trong log
}

export interface ZaloMessage {
  type: ZaloMsgType;
  recipients: ZaloRecipient[];
  text: string;           // Plain text (≤ 300 ký tự cho ZNS)
  template_id?: string;   // ZNS template ID (bắt buộc cho ZNS)
  template_data?: Record<string, string>; // ZNS template params
  attachments?: ZaloAttachment[];
}

export interface ZaloAttachment {
  type: 'link';
  payload: {
    title: string;
    description?: string;
    url: string;
    thumbnail?: string;
  };
}

export interface ZaloSendResult {
  success: boolean;
  sent: number;
  failed: number;
  results: Array<{
    recipient: string;
    status: 'sent' | 'failed';
    msg_id?: string;
    error?: string;
  }>;
}

// ─── Mock send results (dev mode) ─────────────────────────────────────────────
async function mockSend(msg: ZaloMessage): Promise<ZaloSendResult> {
  await new Promise(r => setTimeout(r, 600));
  console.log('[ZaloService DEV] Would send:', msg.text.slice(0, 80));
  return {
    success: true,
    sent: msg.recipients.length,
    failed: 0,
    results: msg.recipients.map(r => ({
      recipient: r.name,
      status: 'sent',
      msg_id: 'mock_' + Date.now(),
    })),
  };
}

// ─── Real send via Express proxy ──────────────────────────────────────────────
async function realSend(msg: ZaloMessage): Promise<ZaloSendResult> {
  const res = await fetch('/api/zalo/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(msg),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Zalo proxy error ${res.status}: ${err}`);
  }
  return res.json();
}

// ─── Public API ───────────────────────────────────────────────────────────────
export const ZaloService = {
  isEnabled(): boolean {
    return !!(import.meta as any).env?.VITE_ZALO_OA_ID;
  },

  async send(msg: ZaloMessage): Promise<ZaloSendResult> {
    const useReal = (import.meta as any).env?.VITE_USE_SUPABASE === 'true' && this.isEnabled();
    if (useReal) return realSend(msg);
    return mockSend(msg);
  },

  /** Gửi cảnh báo khẩn cấp (HSE, deadline, tài chính) */
  async sendAlert(opts: {
    title: string;
    body: string;
    recipients: ZaloRecipient[];
    url?: string;
    emoji?: string;
  }): Promise<ZaloSendResult> {
    const emoji = opts.emoji ?? '⚠️';
    const text  = `${emoji} *${opts.title}*\n${opts.body}${opts.url ? `\n\n🔗 ${opts.url}` : ''}`;
    const msg: ZaloMessage = {
      type: 'direct',
      recipients: opts.recipients,
      text: text.slice(0, 300),
      attachments: opts.url ? [{
        type: 'link',
        payload: { title: opts.title, description: opts.body.slice(0, 100), url: opts.url },
      }] : undefined,
    };
    return this.send(msg);
  },

  /** Gửi nhắc lịch họp */
  async sendMeetingReminder(opts: {
    title: string;
    date: string;
    location: string;
    recipients: ZaloRecipient[];
  }): Promise<ZaloSendResult> {
    return this.sendAlert({
      title: `Nhắc lịch họp: ${opts.title}`,
      body:  `📅 ${opts.date}\n📍 ${opts.location}\nVui lòng xác nhận tham dự.`,
      recipients: opts.recipients,
      emoji: '📅',
    });
  },

  /** Gửi thông báo thanh toán */
  async sendPaymentNotice(opts: {
    period: string;
    amount: string;
    deadline: string;
    recipients: ZaloRecipient[];
  }): Promise<ZaloSendResult> {
    return this.sendAlert({
      title: `Thanh toán đến hạn: ${opts.period}`,
      body:  `💰 Số tiền: ${opts.amount}\n📅 Hạn: ${opts.deadline}\nVui lòng chuẩn bị hồ sơ thanh toán.`,
      recipients: opts.recipients,
      emoji: '💰',
    });
  },

  /** Gửi cảnh báo HSE khẩn */
  async sendHSEAlert(opts: {
    incident: string;
    location: string;
    time: string;
    recipients: ZaloRecipient[];
  }): Promise<ZaloSendResult> {
    return this.sendAlert({
      title: '🚨 CẢNH BÁO AN TOÀN LAO ĐỘNG',
      body:  `${opts.incident}\n📍 ${opts.location}\n🕐 ${opts.time}\nCần xử lý NGAY!`,
      recipients: opts.recipients,
      emoji: '🚨',
    });
  },

  /** Format số điện thoại VN → Zalo phone format */
  formatPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('0')) return '84' + digits.slice(1);
    if (digits.startsWith('84')) return digits;
    return '84' + digits;
  },
};

/*
 * ── Express Proxy Router (thêm vào server.ts) ─────────────────────────────────
 *
 * File: src/server/zaloRouter.ts
 *
 * import express from 'express';
 * import fetch from 'node-fetch';
 *
 * const router = express.Router();
 * const OA_SECRET      = process.env.ZALO_OA_SECRET ?? '';
 * const OA_ACCESS_TOKEN= process.env.ZALO_OA_ACCESS_TOKEN ?? '';
 * const ZALO_API_BASE  = 'https://openapi.zalo.me/v2.0/oa';
 *
 * router.post('/send', async (req, res) => {
 *   try {
 *     const { type, recipients, text, template_id, template_data, attachments } = req.body;
 *     const results = [];
 *
 *     for (const recipient of recipients) {
 *       if (type === 'zns' && template_id) {
 *         // ZNS — Zalo Notification Service
 *         const r = await fetch(`https://business.openapi.zalo.me/message/template`, {
 *           method: 'POST',
 *           headers: {
 *             'Content-Type': 'application/json',
 *             'access_token': OA_ACCESS_TOKEN,
 *           },
 *           body: JSON.stringify({
 *             phone: recipient.phone,
 *             template_id,
 *             template_data,
 *             tracking_id: `gem_${Date.now()}`,
 *           }),
 *         });
 *         const data = await r.json();
 *         results.push({ recipient: recipient.name, status: data.error === 0 ? 'sent' : 'failed', msg_id: data.data?.msg_id });
 *       } else {
 *         // Direct message (requires user_id)
 *         const body: any = {
 *           recipient: { user_id: recipient.user_id },
 *           message: { text },
 *         };
 *         if (attachments?.length) body.message.attachment = attachments[0];
 *         const r = await fetch(`${ZALO_API_BASE}/message`, {
 *           method: 'POST',
 *           headers: { 'Content-Type': 'application/json', 'access_token': OA_ACCESS_TOKEN },
 *           body: JSON.stringify(body),
 *         });
 *         const data = await r.json();
 *         results.push({ recipient: recipient.name, status: data.error === 0 ? 'sent' : 'failed', msg_id: data.data?.message_id, error: data.message });
 *       }
 *     }
 *
 *     const sent   = results.filter(r => r.status === 'sent').length;
 *     const failed = results.filter(r => r.status === 'failed').length;
 *     res.json({ success: failed === 0, sent, failed, results });
 *   } catch (err: any) {
 *     res.status(500).json({ success: false, sent: 0, failed: 1, results: [], error: err.message });
 *   }
 * });
 *
 * // Token refresh (Zalo tokens expire every 3 months — set up a cron)
 * router.post('/refresh-token', async (req, res) => {
 *   const r = await fetch(`https://oauth.zaloapp.com/v4/oa/access_token`, {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'secret_key': OA_SECRET },
 *     body: new URLSearchParams({ refresh_token: process.env.ZALO_OA_REFRESH_TOKEN ?? '', app_id: process.env.VITE_ZALO_OA_ID ?? '', grant_type: 'refresh_token' }),
 *   });
 *   const data = await r.json();
 *   res.json(data);
 * });
 *
 * export default router;
 *
 * // In server.ts:
 * // import zaloRouter from './server/zaloRouter';
 * // app.use('/api/zalo', zaloRouter);
 */
