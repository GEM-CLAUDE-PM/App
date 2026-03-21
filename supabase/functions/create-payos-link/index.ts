/**
 * create-payos-link — GEM & CLAUDE PM Pro
 * Tạo payment link PayOS cho việc nâng cấp gói
 *
 * SETUP:
 *   Supabase Dashboard → Settings → Edge Functions → Secrets:
 *     PAYOS_CLIENT_ID     = từ PayOS Dashboard
 *     PAYOS_API_KEY       = từ PayOS Dashboard
 *     PAYOS_CHECKSUM_KEY  = từ PayOS Dashboard
 *     APP_URL             = https://gemclaudepm.com
 *
 * Sandbox test:
 *   PAYOS_CLIENT_ID     = test_...
 *   PAYOS_API_KEY       = test_...
 *   PAYOS_CHECKSUM_KEY  = test_...
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PAYOS_CLIENT_ID    = Deno.env.get('PAYOS_CLIENT_ID')    ?? '';
const PAYOS_API_KEY      = Deno.env.get('PAYOS_API_KEY')      ?? '';
const PAYOS_CHECKSUM_KEY = Deno.env.get('PAYOS_CHECKSUM_KEY') ?? '';
const APP_URL            = Deno.env.get('APP_URL')            ?? 'https://gemclaudepm.com';
const PAYOS_API          = 'https://api-merchant.payos.vn/v2/payment-requests';

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tạo checksum HMAC-SHA256 theo spec PayOS
async function makeChecksum(data: Record<string, string | number>): Promise<string> {
  // Sort keys alphabetically, concat as key=value&key=value
  const sortedKeys = Object.keys(data).sort();
  const dataStr = sortedKeys.map(k => `${k}=${data[k]}`).join('&');
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(PAYOS_CHECKSUM_KEY),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(dataStr));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2,'0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    if (!PAYOS_CLIENT_ID || !PAYOS_API_KEY || !PAYOS_CHECKSUM_KEY) {
      return new Response(JSON.stringify({
        error: 'PayOS chưa được cấu hình. Thêm PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY vào Supabase Secrets.'
      }), { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const { amount, orderCode, description, buyerEmail, buyerName, buyerPhone } = await req.json();

    if (!amount || amount <= 0) {
      return new Response(JSON.stringify({ error: 'Số tiền không hợp lệ' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    // orderCode phải là số nguyên theo spec PayOS
    const orderCodeNum = parseInt(String(orderCode).replace(/\D/g, '').slice(-10)) || Date.now() % 1000000000;

    const checksumData = {
      amount:       amount,
      cancelUrl:    `${APP_URL}?payment=cancelled`,
      description:  description || 'GEM PM Pro',
      orderCode:    orderCodeNum,
      returnUrl:    `${APP_URL}?payment=success&orderCode=${orderCodeNum}`,
    };

    const signature = await makeChecksum(checksumData);

    const payload = {
      orderCode:   orderCodeNum,
      amount:      amount,
      description: (description || 'GEM PM Pro').slice(0, 25), // PayOS max 25 chars
      buyerName:   buyerName   || 'GEM PM User',
      buyerEmail:  buyerEmail  || '',
      buyerPhone:  buyerPhone  || '',
      items: [{
        name:     (description || 'GEM PM Pro').slice(0, 25),
        quantity: 1,
        price:    amount,
      }],
      cancelUrl:  checksumData.cancelUrl,
      returnUrl:  checksumData.returnUrl,
      signature,
      expiredAt:  Math.floor(Date.now() / 1000) + 3600, // 1 giờ
    };

    const res = await fetch(PAYOS_API, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id':  PAYOS_CLIENT_ID,
        'x-api-key':    PAYOS_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const result = await res.json();

    if (!res.ok || result.code !== '00') {
      console.error('[PayOS] Error:', JSON.stringify(result));
      return new Response(JSON.stringify({
        error: result.desc || result.message || 'PayOS tạo link thất bại'
      }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // Lưu payment record vào Supabase
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      try {
        const sb = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        await sb.from('payment_transactions').insert({
          order_code:   String(orderCodeNum),
          amount,
          description:  description || '',
          buyer_email:  buyerEmail || '',
          status:       'pending',
          gateway:      'payos',
          checkout_url: result.data?.checkoutUrl || '',
          created_at:   new Date().toISOString(),
        });
      } catch (e) {
        console.warn('[PayOS] Could not save transaction:', e);
      }
    }

    return new Response(JSON.stringify({
      success:     true,
      checkoutUrl: result.data?.checkoutUrl,
      orderCode:   orderCodeNum,
      qrCode:      result.data?.qrCode,
    }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error('[PayOS] Exception:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
});
