/**
 * create-payos-link/index.ts — GEM&CLAUDE PM Pro
 * Supabase Edge Function: tạo PayOS payment link
 * Deploy: supabase functions deploy create-payos-link
 *
 * ENV: PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY
 */
import { createHmac } from 'https://deno.land/std@0.177.0/node/crypto.ts';

const PAYOS_CLIENT_ID   = Deno.env.get('PAYOS_CLIENT_ID')   ?? '';
const PAYOS_API_KEY     = Deno.env.get('PAYOS_API_KEY')     ?? '';
const PAYOS_CHECKSUM_KEY = Deno.env.get('PAYOS_CHECKSUM_KEY') ?? '';

function createSignature(data: Record<string, any>): string {
  // PayOS signature: HMAC-SHA256 của sorted key=value string
  const str = Object.keys(data).sort()
    .map(k => `${k}=${data[k]}`)
    .join('&');
  return createHmac('sha256', PAYOS_CHECKSUM_KEY).update(str).digest('hex');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  try {
    const { amount, orderCode, description, buyerEmail } = await req.json();

    const body = {
      orderCode:   parseInt(String(orderCode).replace(/\D/g, '').slice(-10)) || Date.now(),
      amount,
      description: description.slice(0, 25),  // PayOS max 25 chars
      buyerEmail,
      returnUrl:   'https://gemclaudepm.com?upgraded=1',
      cancelUrl:   'https://gemclaudepm.com/billing',
    };

    const signature = createSignature(body);

    const res = await fetch('https://api-merchant.payos.vn/v2/payment-requests', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'x-client-id':   PAYOS_CLIENT_ID,
        'x-api-key':     PAYOS_API_KEY,
      },
      body: JSON.stringify({ ...body, signature }),
    });

    const data = await res.json();
    if (data.code !== '00') {
      return new Response(JSON.stringify({ error: data.desc }), { status: 400 });
    }

    return new Response(
      JSON.stringify({ checkoutUrl: data.data?.checkoutUrl }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (e) {
    console.error('[create-payos-link]', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
