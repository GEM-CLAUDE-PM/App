/**
 * send-email — GEM & CLAUDE PM Pro
 * Supabase Edge Function gửi email qua Resend API
 *
 * SETUP:
 *   1. Đăng ký tại resend.com (free 3,000 email/tháng)
 *   2. Lấy API Key → Supabase Dashboard → Settings → Edge Functions → Secrets
 *      RESEND_API_KEY = re_xxxxxxxxxxxx
 *   3. Deploy: supabase functions deploy send-email --no-verify-jwt
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL     = 'GEM PM Pro <notifications@gemclaudepm.com>';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY chưa được cấu hình' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { to, subject, html, text } = await req.json();

    if (!to || !subject) {
      return new Response(JSON.stringify({ error: 'Thiếu to hoặc subject' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const toArray = Array.isArray(to) ? to : [to];

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    FROM_EMAIL,
        to:      toArray,
        subject: subject,
        html:    html ?? `<p>${text ?? ''}</p>`,
        text:    text ?? '',
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return new Response(JSON.stringify({ error: data.message ?? 'Resend API error' }), {
        status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, id: data.id, to: toArray }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
