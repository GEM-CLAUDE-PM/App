/**
 * zaloRouter.ts — GEM&CLAUDE PM Pro
 * Express proxy router cho Zalo OA API.
 *
 * SETUP trong server.ts:
 *   import zaloRouter from './zaloRouter';
 *   app.use('/api/zalo', zaloRouter);
 *
 * ENV vars cần thiết trong .env (server-side, không có VITE_ prefix):
 *   ZALO_OA_APP_ID=...          ← App ID từ Zalo Developer
 *   ZALO_OA_SECRET=...          ← OA Secret key
 *   ZALO_OA_ACCESS_TOKEN=...    ← Access token (hết hạn sau 3 tháng)
 *   ZALO_OA_REFRESH_TOKEN=...   ← Refresh token
 */

import express, { Request, Response } from 'express';

const router = express.Router();

const APP_ID        = process.env.ZALO_OA_APP_ID        ?? '';
const OA_SECRET     = process.env.ZALO_OA_SECRET        ?? '';
let   ACCESS_TOKEN  = process.env.ZALO_OA_ACCESS_TOKEN  ?? '';
const REFRESH_TOKEN = process.env.ZALO_OA_REFRESH_TOKEN ?? '';

const ZALO_API  = 'https://openapi.zalo.me/v2.0/oa';
const ZALO_BIZ  = 'https://business.openapi.zalo.me';
const OAUTH_URL = 'https://oauth.zaloapp.com/v4/oa';

// ─── Middleware: check config ──────────────────────────────────────────────────
router.use((req: Request, res: Response, next) => {
  if (!OA_SECRET) {
    return res.status(503).json({ error: 'Zalo OA chưa được cấu hình. Thêm ZALO_OA_SECRET vào .env' });
  }
  next();
});

// ─── POST /api/zalo/send ──────────────────────────────────────────────────────
router.post('/send', async (req: Request, res: Response) => {
  const { type, recipients, text, template_id, template_data, attachments } = req.body;

  if (!recipients?.length) {
    return res.status(400).json({ error: 'Thiếu danh sách người nhận' });
  }
  if (!text && !template_id) {
    return res.status(400).json({ error: 'Thiếu nội dung tin nhắn' });
  }

  const results: Array<{
    recipient: string; status: 'sent' | 'failed';
    msg_id?: string; error?: string;
  }> = [];

  for (const recipient of recipients) {
    try {
      if (type === 'zns' && template_id) {
        // ── ZNS (Zalo Notification Service) ──────────────────────────────
        if (!recipient.phone) {
          results.push({ recipient: recipient.name, status: 'failed', error: 'Thiếu số điện thoại cho ZNS' });
          continue;
        }
        const r = await fetch(`${ZALO_BIZ}/message/template`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'access_token': ACCESS_TOKEN,
          },
          body: JSON.stringify({
            phone:          recipient.phone,
            template_id,
            template_data:  template_data ?? {},
            tracking_id:    `gem_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
          }),
        });
        const data: any = await r.json();
        if (data.error === 0) {
          results.push({ recipient: recipient.name, status: 'sent', msg_id: data.data?.msg_id });
        } else {
          results.push({ recipient: recipient.name, status: 'failed', error: data.message });
        }

      } else {
        // ── Direct message ────────────────────────────────────────────────
        if (!recipient.user_id) {
          results.push({ recipient: recipient.name, status: 'failed', error: 'Thiếu Zalo user_id (người dùng chưa follow OA)' });
          continue;
        }
        const body: any = {
          recipient: { user_id: recipient.user_id },
          message:   { text: String(text).slice(0, 2000) },
        };
        if (attachments?.length) {
          body.message.attachment = {
            type:    'template',
            payload: {
              template_type: 'media',
              elements: [{
                media_type: 'link',
                ...attachments[0].payload,
              }],
            },
          };
        }
        const r = await fetch(`${ZALO_API}/message`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'access_token': ACCESS_TOKEN },
          body:    JSON.stringify(body),
        });
        const data: any = await r.json();
        if (data.error === 0) {
          results.push({ recipient: recipient.name, status: 'sent', msg_id: data.data?.message_id });
        } else {
          results.push({ recipient: recipient.name, status: 'failed', error: `${data.error}: ${data.message}` });
        }
      }
    } catch (err: any) {
      results.push({ recipient: recipient.name, status: 'failed', error: err.message ?? 'Network error' });
    }
  }

  const sent   = results.filter(r => r.status === 'sent').length;
  const failed = results.filter(r => r.status === 'failed').length;

  console.log(`[Zalo] Sent ${sent}/${recipients.length} — ${type} message`);

  res.json({ success: failed === 0, sent, failed, results });
});

// ─── POST /api/zalo/refresh-token ────────────────────────────────────────────
router.post('/refresh-token', async (_req: Request, res: Response) => {
  if (!REFRESH_TOKEN) {
    return res.status(400).json({ error: 'Chưa có ZALO_OA_REFRESH_TOKEN trong .env' });
  }
  try {
    const r = await fetch(`${OAUTH_URL}/access_token`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'secret_key':   OA_SECRET,
      },
      body: new URLSearchParams({
        refresh_token: REFRESH_TOKEN,
        app_id:        APP_ID,
        grant_type:    'refresh_token',
      }),
    });
    const data: any = await r.json();
    if (data.access_token) {
      ACCESS_TOKEN = data.access_token;
      console.log('[Zalo] Token refreshed — expires in', data.expires_in, 's');
      res.json({ success: true, expires_in: data.expires_in });
    } else {
      res.status(400).json({ success: false, error: data.error_description ?? 'Token refresh failed' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/zalo/followers ──────────────────────────────────────────────────
router.get('/followers', async (_req: Request, res: Response) => {
  try {
    const r = await fetch(`${ZALO_API}/getfollowers?data={"offset":0,"count":50}`, {
      headers: { 'access_token': ACCESS_TOKEN },
    });
    const data: any = await r.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/zalo/status ─────────────────────────────────────────────────────
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    configured: !!OA_SECRET,
    has_token:  !!ACCESS_TOKEN,
    app_id:     APP_ID || '(chưa cấu hình)',
  });
});

export default router;
