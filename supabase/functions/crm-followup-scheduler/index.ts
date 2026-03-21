/**
 * crm-followup-scheduler — GEM & CLAUDE PM Pro
 * Supabase Edge Function — chạy hàng ngày qua pg_cron
 * Tự động gửi email follow-up cho CRM leads theo rules:
 *
 * RULES:
 *   Cold  → không liên hệ 7 ngày  → nhắc follow-up
 *   Warm  → không liên hệ 3 ngày  → nhắc follow-up
 *   Hot   → không liên hệ 1 ngày  → nhắc gấp
 *   Any   → next_followup quá hạn → nhắc ngay
 *
 * SETUP:
 *   1. Deploy: npx supabase functions deploy crm-followup-scheduler --no-verify-jwt
 *   2. Chạy SQL bên dưới để tạo cron job (chạy 8:00 AM mỗi ngày)
 *   3. Cần secrets: RESEND_API_KEY, NOTIFY_EMAIL (email nhận thông báo)
 *
 * SQL để tạo cron (chạy trong Supabase SQL Editor):
 * ─────────────────────────────────────────────────
 *   select cron.schedule(
 *     'crm-daily-followup',
 *     '0 1 * * *',   -- 8:00 AM GMT+7 = 01:00 UTC
 *     $$
 *     select net.http_post(
 *       url := 'https://<project-ref>.supabase.co/functions/v1/crm-followup-scheduler',
 *       headers := '{"Content-Type":"application/json","Authorization":"Bearer <anon-key>"}'::jsonb,
 *       body := '{}'::jsonb
 *     );
 *     $$
 *   );
 *
 * Để dừng cron:
 *   select cron.unschedule('crm-daily-followup');
 *
 * Kiểm tra cron log:
 *   select * from cron.job_run_details order by start_time desc limit 10;
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY  = Deno.env.get('RESEND_API_KEY')  ?? '';
const NOTIFY_EMAIL    = Deno.env.get('NOTIFY_EMAIL')    ?? ''; // email nhận thông báo (anh Tuấn)
const FROM_EMAIL      = 'GEM PM CRM <crm@gemclaudepm.com>';
const APP_URL         = Deno.env.get('APP_URL') ?? 'https://gemclaudepm.com';

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Số ngày không liên hệ trước khi nhắc theo stage
const FOLLOWUP_RULES: Record<string, number> = {
  cold:       7,
  warm:       3,
  hot:        1,
  closed_won: 999,  // không nhắc
  closed_lost:999,
};

interface Lead {
  id: string;
  ma_kh: string;
  company_name: string;
  contact_name: string;
  phone: string;
  email?: string;
  stage: string;
  next_followup?: string;
  history: { date: string; note: string }[];
  updated_at: string;
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return { ok: false, error: 'No RESEND_API_KEY' };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  });
  const data = await res.json();
  return { ok: res.ok, id: data.id, error: data.message };
}

function daysSince(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function lastContactDate(lead: Lead): string {
  if (lead.history && lead.history.length > 0) {
    const sorted = [...lead.history].sort((a, b) => b.date.localeCompare(a.date));
    return sorted[0].date;
  }
  return lead.updated_at;
}

function emailTemplate(leads: Lead[], type: 'overdue' | 'reminder'): string {
  const title  = type === 'overdue' ? '⚠️ Leads QUÁ HẠN Follow-up' : '📅 Nhắc nhở Follow-up hôm nay';
  const color  = type === 'overdue' ? '#ef4444' : '#f97316';
  const stageLabel: Record<string, string> = {
    cold: 'Cold 🥶', warm: 'Warm 🔥', hot: 'Hot 💎',
  };

  const rows = leads.map(l => {
    const daysSinceContact = daysSince(lastContactDate(l));
    const overdueDays = l.next_followup
      ? Math.max(0, Math.floor((new Date().getTime() - new Date(l.next_followup).getTime()) / 86400000))
      : 0;
    return `
      <tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:12px 8px;font-weight:700">${l.company_name}</td>
        <td style="padding:12px 8px;color:#64748b">${l.contact_name}<br/><small>${l.phone}</small></td>
        <td style="padding:12px 8px">
          <span style="background:${color}22;color:${color};padding:2px 8px;border-radius:20px;font-size:12px;font-weight:700">
            ${stageLabel[l.stage] || l.stage}
          </span>
        </td>
        <td style="padding:12px 8px;color:#64748b">${daysSinceContact} ngày trước</td>
        <td style="padding:12px 8px">
          ${overdueDays > 0
            ? `<span style="color:#ef4444;font-weight:700">Quá ${overdueDays} ngày</span>`
            : l.next_followup ? new Date(l.next_followup).toLocaleDateString('vi-VN') : '—'
          }
        </td>
      </tr>`;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family:'Helvetica Neue',Arial,sans-serif;background:#f8fafc;margin:0;padding:20px">
      <div style="max-width:700px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
        <div style="background:linear-gradient(135deg,#1a8a7a,#0f5f54);padding:24px 32px">
          <h1 style="color:white;margin:0;font-size:20px">💼 GEM PM · CRM</h1>
          <p style="color:rgba(255,255,255,.8);margin:4px 0 0;font-size:14px">${title}</p>
        </div>
        <div style="padding:24px 32px">
          <p style="color:#475569;margin:0 0 16px">Xin chào Anh Tuấn,<br/>
          Dưới đây là danh sách ${leads.length} khách hàng cần liên hệ hôm nay:</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="background:#f8fafc;text-align:left">
                <th style="padding:10px 8px;color:#94a3b8;font-weight:600;text-transform:uppercase;font-size:11px">Công ty</th>
                <th style="padding:10px 8px;color:#94a3b8;font-weight:600;text-transform:uppercase;font-size:11px">Liên hệ</th>
                <th style="padding:10px 8px;color:#94a3b8;font-weight:600;text-transform:uppercase;font-size:11px">Giai đoạn</th>
                <th style="padding:10px 8px;color:#94a3b8;font-weight:600;text-transform:uppercase;font-size:11px">Liên hệ lần cuối</th>
                <th style="padding:10px 8px;color:#94a3b8;font-weight:600;text-transform:uppercase;font-size:11px">Follow-up</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div style="margin-top:24px;text-align:center">
            <a href="${APP_URL}/CRM_Pipeline.html"
               style="display:inline-block;background:#1a8a7a;color:white;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px">
              Mở CRM Pipeline →
            </a>
          </div>
        </div>
        <div style="background:#f8fafc;padding:16px 32px;color:#94a3b8;font-size:12px;text-align:center">
          GEM & CLAUDE PM Pro · gemclaudepm.com · Email tự động — không cần trả lời
        </div>
      </div>
    </body>
    </html>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Load tất cả leads active (không phải closed)
    const { data: leads, error } = await sb
      .from('crm_leads')
      .select('*')
      .not('stage', 'in', '(closed_won,closed_lost)')
      .order('updated_at', { ascending: true });

    if (error) throw new Error('Lỗi load leads: ' + error.message);
    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'Không có leads active' }), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    const now      = new Date();
    const overdueLeads: Lead[]  = [];
    const reminderLeads: Lead[] = [];

    for (const lead of leads as Lead[]) {
      // Check 1: next_followup quá hạn
      if (lead.next_followup) {
        const followupDate = new Date(lead.next_followup);
        if (followupDate < now) {
          overdueLeads.push(lead);
          continue;
        }
        // Nhắc trước 1 ngày
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (followupDate <= tomorrow) {
          reminderLeads.push(lead);
          continue;
        }
      }

      // Check 2: không liên hệ quá X ngày theo stage rule
      const rule = FOLLOWUP_RULES[lead.stage] ?? 7;
      const lastContact = lastContactDate(lead);
      const daysSinceContact = daysSince(lastContact);
      if (daysSinceContact >= rule) {
        reminderLeads.push(lead);
      }
    }

    const results: any[] = [];

    // Gửi email tổng hợp cho anh Tuấn
    if (NOTIFY_EMAIL) {
      if (overdueLeads.length > 0) {
        const r = await sendEmail(
          NOTIFY_EMAIL,
          `⚠️ [GEM CRM] ${overdueLeads.length} leads quá hạn follow-up — ${now.toLocaleDateString('vi-VN')}`,
          emailTemplate(overdueLeads, 'overdue')
        );
        results.push({ type: 'overdue_summary', to: NOTIFY_EMAIL, count: overdueLeads.length, ...r });
      }

      if (reminderLeads.length > 0) {
        const r = await sendEmail(
          NOTIFY_EMAIL,
          `📅 [GEM CRM] ${reminderLeads.length} leads cần follow-up hôm nay — ${now.toLocaleDateString('vi-VN')}`,
          emailTemplate(reminderLeads, 'reminder')
        );
        results.push({ type: 'reminder_summary', to: NOTIFY_EMAIL, count: reminderLeads.length, ...r });
      }
    }

    // Gửi email trực tiếp cho KH (nếu lead có email và stage = hot)
    for (const lead of overdueLeads.filter(l => l.email && l.stage === 'hot')) {
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px">
          <h2 style="color:#1a8a7a">Kính gửi ${lead.contact_name}</h2>
          <p>Chúng tôi từ <strong>GEM & CLAUDE PM Pro</strong> muốn được trao đổi thêm về giải pháp quản lý dự án cho <strong>${lead.company_name}</strong>.</p>
          <p>Anh/Chị có thể liên hệ lại với chúng tôi để được tư vấn miễn phí không?</p>
          <p style="margin-top:24px">Trân trọng,<br/><strong>GEM & CLAUDE PM Pro</strong><br/>gemclaudepm.com</p>
        </div>`;
      const r = await sendEmail(
        lead.email!,
        `${lead.company_name} — GEM PM Pro muốn kết nối`,
        html
      );
      results.push({ type: 'hot_lead_email', to: lead.email, lead_id: lead.id, company: lead.company_name, ...r });
    }

    // Ghi log vào Supabase
    if (results.length > 0) {
      await sb.from('crm_email_logs').insert(
        results.map(r => ({
          type:       r.type,
          to_email:   r.to,
          lead_id:    r.lead_id ?? null,
          status:     r.ok ? 'sent' : 'failed',
          resend_id:  r.id ?? null,
          error_msg:  r.error ?? null,
          leads_count: r.count ?? 1,
          sent_at:    new Date().toISOString(),
        }))
      );
    }

    return new Response(JSON.stringify({
      success: true,
      date: now.toISOString(),
      overdue:  overdueLeads.length,
      reminder: reminderLeads.length,
      emails_sent: results.filter(r => r.ok).length,
      results,
    }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error('[CRM Scheduler] Error:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
});
