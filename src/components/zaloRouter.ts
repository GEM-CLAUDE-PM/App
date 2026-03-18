/**
 * zaloRouter.ts — GEM&CLAUDE PM Pro
 * Express proxy cho Zalo OA API.
 * Browser không được gọi Zalo API trực tiếp vì lộ OA_SECRET.
 *
 * DEPLOY:
 *   Option A — Vercel Edge Function: đổi sang Next.js API route
 *   Option B — Express server riêng (Node.js trên Railway/Render)
 *
 * ENV (server-side, KHÔNG có VITE_ prefix):
 *   ZALO_OA_SECRET         — OA Secret từ Zalo Developer Console
 *   ZALO_OA_ACCESS_TOKEN   — Access token (refresh mỗi 3 tháng)
 *   ZALO_OA_REFRESH_TOKEN  — Dùng để refresh access token
 *   VITE_ZALO_OA_ID        — OA ID (public — OK để expose)
 *
 * Mount trong server.ts:
 *   import zaloRouter from './zaloRouter';
 *   app.use('/api/zalo', zaloRouter);
 */

import express, { Request, Response } from 'express';

const router = express.Router();

const OA_ACCESS_TOKEN  = process.env.ZALO_OA_ACCESS_TOKEN  ?? '';
const OA_SECRET        = process.env.ZALO_OA_SECRET        ?? '';
const OA_REFRESH_TOKEN = process.env.ZALO_OA_REFRESH_TOKEN ?? '';
const OA_ID            = process.env.VITE_ZALO_OA_ID       ?? '';

const ZALO_API_BASE    = 'https://openapi.zalo.me/v2.0/oa';
const ZALO_ZNS_BASE    = 'https://business.openapi.zalo.me/message/template';

// ─── POST /api/zalo/send ─────────────────────────────────────────────────────
router.post('/send', async (req: Request, res: Response) => {
  if (!OA_ACCESS_TOKEN) {
    res.status(503).json({ success: false, error: 'ZALO_OA_ACCESS_TOKEN chưa được cấu hình.' });
    return;
  }

  try {
    const { type, recipients, text, template_id, template_data, attachments } = req.body;
    const results: any[] = [];

    for (const recipient of recipients) {
      if (type === 'zns' && template_id) {
        // ── ZNS — không cần follow OA ─────────────────────────────────────
        const r = await fetch(ZALO_ZNS_BASE, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'access_token': OA_ACCESS_TOKEN,
          },
          body: JSON.stringify({
            phone:         recipient.phone,
            template_id,
            template_data: template_data ?? {},
            tracking_id:   `gem_${Date.now()}`,
          }),
        });
        const data: any = await r.json();
        results.push({
          recipient: recipient.name,
          status:    data.error === 0 ? 'sent' : 'failed',
          msg_id:    data.data?.msg_id,
          error:     data.error !== 0 ? data.message : undefined,
        });

      } else {
        // ── Direct message — cần user_id (đã follow OA) ────────────────────
        if (!recipient.user_id) {
          results.push({ recipient: recipient.name, status: 'failed', error: 'Thiếu user_id — user chưa follow OA' });
          continue;
        }
        const body: any = {
          recipient: { user_id: recipient.user_id },
          message:   { text: (text as string).slice(0, 2000) },
        };
        if (attachments?.length) {
          body.message.attachment = {
            type:    'template',
            payload: {
              template_type: 'media',
              elements: [{
                media_type:  'link',
                url:         attachments[0].payload.url,
                title:       attachments[0].payload.title,
                subtitle:    attachments[0].payload.description ?? '',
              }],
            },
          };
        }
        const r = await fetch(`${ZALO_API_BASE}/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'access_token': OA_ACCESS_TOKEN,
          },
          body: JSON.stringify(body),
        });
        const data: any = await r.json();
        results.push({
          recipient: recipient.name,
          status:    data.error === 0 ? 'sent' : 'failed',
          msg_id:    data.data?.message_id,
          error:     data.error !== 0 ? data.message : undefined,
        });
      }
    }

    const sent   = results.filter(r => r.status === 'sent').length;
    const failed = results.filter(r => r.status === 'failed').length;
    res.json({ success: failed === 0, sent, failed, results });

  } catch (err: any) {
    res.status(500).json({ success: false, sent: 0, failed: 1, results: [], error: err.message });
  }
});

// ─── POST /api/zalo/refresh-token ────────────────────────────────────────────
// Gọi thủ công hoặc qua cron job mỗi 3 tháng
router.post('/refresh-token', async (_req: Request, res: Response) => {
  if (!OA_SECRET || !OA_REFRESH_TOKEN || !OA_ID) {
    res.status(503).json({ error: 'Thiếu ZALO_OA_SECRET / ZALO_OA_REFRESH_TOKEN / VITE_ZALO_OA_ID' });
    return;
  }
  try {
    const r = await fetch('https://oauth.zaloapp.com/v4/oa/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'secret_key':   OA_SECRET,
      },
      body: new URLSearchParams({
        refresh_token: OA_REFRESH_TOKEN,
        app_id:        OA_ID,
        grant_type:    'refresh_token',
      }),
    });
    const data = await r.json();
    // Trả về token mới — anh cần update ZALO_OA_ACCESS_TOKEN + ZALO_OA_REFRESH_TOKEN trong env
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/zalo/status ─────────────────────────────────────────────────────
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    configured: !!(OA_ACCESS_TOKEN && OA_ID),
    oa_id:      OA_ID || '(chưa set)',
    token_set:  !!OA_ACCESS_TOKEN,
  });
});

export default router;
