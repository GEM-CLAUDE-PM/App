/**
 * payos-webhook — GEM & CLAUDE PM Pro
 * Nhận webhook từ PayOS khi thanh toán thành công/thất bại
 * Cập nhật tenant plan trong Supabase
 *
 * SETUP:
 *   1. Deploy function này
 *   2. Vào PayOS Dashboard → Webhook URL:
 *      https://<project-ref>.supabase.co/functions/v1/payos-webhook
 *   3. Thêm secret: PAYOS_CHECKSUM_KEY
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PAYOS_CHECKSUM_KEY = Deno.env.get('PAYOS_CHECKSUM_KEY') ?? '';

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Verify webhook signature từ PayOS
async function verifySignature(data: Record<string, unknown>, signature: string): Promise<boolean> {
  try {
    const sortedKeys = Object.keys(data).filter(k => k !== 'signature').sort();
    const dataStr = sortedKeys.map(k => `${k}=${data[k]}`).join('&');
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(PAYOS_CHECKSUM_KEY),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(dataStr));
    const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2,'0')).join('');
    return computed === signature;
  } catch {
    return false;
  }
}

// Map orderCode → tenant_id (từ format GEMPM_{tenantId}_{timestamp})
function parseTenantFromOrder(orderCode: string): string | null {
  const match = String(orderCode).match(/GEMPM_([^_]+)_/);
  return match ? match[1] : null;
}

// Map amount → plan
function getPlanFromAmount(amount: number): { plan: string; cycle: string } {
  const plans: [number, string, string][] = [
    [990000,  'starter', 'monthly'],
    [9900000, 'starter', 'yearly'],
    [2490000, 'pro',     'monthly'],
    [24900000,'pro',     'yearly'],
  ];
  const found = plans.find(([a]) => a === amount);
  return found ? { plan: found[1], cycle: found[2] } : { plan: 'starter', cycle: 'monthly' };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const body = await req.json();
    console.log('[PayOS Webhook] Received:', JSON.stringify(body));

    const { code, data, signature } = body;

    // Verify signature
    if (signature && PAYOS_CHECKSUM_KEY) {
      const valid = await verifySignature(data || body, signature);
      if (!valid) {
        console.error('[PayOS Webhook] Invalid signature');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }
    }

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const orderCode  = String(data?.orderCode || body.orderCode || '');
    const amount     = Number(data?.amount    || body.amount    || 0);
    const status     = code === '00' ? 'paid' : 'failed';
    const txRef      = data?.reference || body.reference || '';

    // 1. Cập nhật payment_transactions
    await sb.from('payment_transactions')
      .update({
        status,
        paid_at:   status === 'paid' ? new Date().toISOString() : null,
        tx_ref:    txRef,
        raw_data:  JSON.stringify(body),
      })
      .eq('order_code', orderCode);

    // 2. Nếu thành công → nâng cấp tenant plan
    if (status === 'paid') {
      const { plan, cycle } = getPlanFromAmount(amount);

      // Tính ngày hết hạn
      const trialEnds = new Date();
      if (cycle === 'yearly') {
        trialEnds.setFullYear(trialEnds.getFullYear() + 1);
      } else {
        trialEnds.setMonth(trialEnds.getMonth() + 1);
      }

      // Tìm tenant qua payment_transactions
      const { data: txData } = await sb
        .from('payment_transactions')
        .select('tenant_id, buyer_email')
        .eq('order_code', orderCode)
        .single();

      if (txData?.tenant_id) {
        await sb.from('tenants')
          .update({
            plan,
            trial_ends_at: trialEnds.toISOString(),
            is_locked:     false,
            updated_at:    new Date().toISOString(),
          })
          .eq('id', txData.tenant_id);

        console.log(`[PayOS Webhook] Upgraded tenant ${txData.tenant_id} to ${plan} ${cycle}`);
      } else if (data?.buyerEmail || body.buyerEmail) {
        // Fallback: tìm qua email
        const email = data?.buyerEmail || body.buyerEmail;
        const { data: profile } = await sb
          .from('profiles')
          .select('tenant_id')
          .eq('email', email)
          .single();

        if (profile?.tenant_id) {
          await sb.from('tenants')
            .update({
              plan,
              trial_ends_at: trialEnds.toISOString(),
              is_locked:     false,
            })
            .eq('id', profile.tenant_id);
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
    });

  } catch (e) {
    console.error('[PayOS Webhook] Error:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
});
