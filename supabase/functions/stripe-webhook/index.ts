/**
 * StripeWebhookHandler.ts — GEM&CLAUDE PM Pro
 * S26 — Supabase Edge Function xử lý Stripe + PayOS webhook
 *
 * Deploy: supabase functions deploy stripe-webhook
 *
 * File này đặt tại: supabase/functions/stripe-webhook/index.ts
 *
 * ENV vars cần set trong Supabase Dashboard → Settings → Edge Functions:
 *   STRIPE_SECRET_KEY          sk_live_...
 *   STRIPE_WEBHOOK_SECRET      whsec_...
 *   PAYOS_CHECKSUM_KEY         (từ PayOS Dashboard)
 *   SUPABASE_URL               https://xxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY  service_role key
 *
 * Stripe: Settings → Webhooks → Add endpoint:
 *   URL: https://xxx.supabase.co/functions/v1/stripe-webhook
 *   Events: checkout.session.completed, invoice.payment_succeeded,
 *           invoice.payment_failed, customer.subscription.deleted
 *
 * PayOS: Dashboard → Webhook URL:
 *   https://xxx.supabase.co/functions/v1/stripe-webhook?provider=payos
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@13';
import { createHmac } from 'https://deno.land/std@0.177.0/node/crypto.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const sb = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

// ─── Plan mapping: Stripe price_id / PayOS amount → PlanId ──────────────────
// Anh cần điền price_id thật từ Stripe Dashboard sau khi tạo products
const STRIPE_PRICE_TO_PLAN: Record<string, string> = {
  'price_starter_monthly':    'starter',
  'price_starter_yearly':     'starter',
  'price_pro_monthly':        'pro',
  'price_pro_yearly':         'pro',
  'price_enterprise_monthly': 'enterprise',
};

const PAYOS_AMOUNT_TO_PLAN: Record<number, string> = {
  990000:   'starter',    // Starter monthly
  9900000:  'starter',    // Starter yearly
  2490000:  'pro',        // Pro monthly
  24900000: 'pro',        // Pro yearly
};

// ─── Activate tenant plan after payment ──────────────────────────────────────
async function activatePlan(tenantId: string, planId: string) {
  const { error } = await sb
    .from('tenants')
    .update({
      plan_id:       planId,
      trial_ends_at: null,
      is_active:     true,
      updated_at:    new Date().toISOString(),
    })
    .eq('id', tenantId);
  if (error) throw new Error(`activatePlan failed: ${error.message}`);
}

// ─── Lock tenant on payment failure / cancellation ───────────────────────────
async function lockTenant(tenantId: string, reason: string) {
  await sb
    .from('tenants')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', tenantId);
  console.log(`[webhook] Locked tenant ${tenantId}: ${reason}`);
}

// ─── Verify PayOS checksum ───────────────────────────────────────────────────
function verifyPayOSSignature(body: string, signature: string): boolean {
  const key = Deno.env.get('PAYOS_CHECKSUM_KEY') ?? '';
  if (!key) return false;
  const expected = createHmac('sha256', key).update(body).digest('hex');
  return expected === signature;
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const url      = new URL(req.url);
  const provider = url.searchParams.get('provider') ?? 'stripe';
  const body     = await req.text();

  // ── PayOS webhook ──────────────────────────────────────────────────────────
  if (provider === 'payos') {
    const signature = req.headers.get('x-payos-signature') ?? '';
    if (!verifyPayOSSignature(body, signature)) {
      return new Response('Invalid signature', { status: 401 });
    }
    try {
      const data = JSON.parse(body);
      // PayOS sends: { code, desc, data: { orderCode, amount, status, ... } }
      if (data.code !== '00') {
        return new Response('Ignored non-success event', { status: 200 });
      }
      const { orderCode, amount, status } = data.data ?? {};
      if (status !== 'PAID') {
        return new Response('Not PAID', { status: 200 });
      }
      const planId = PAYOS_AMOUNT_TO_PLAN[amount];
      if (!planId) {
        console.warn(`[webhook] PayOS unknown amount: ${amount}`);
        return new Response('Unknown plan amount', { status: 200 });
      }
      // orderCode format: GEMPM_{tenantId}_{timestamp}
      const tenantId = String(orderCode).split('_')[1];
      if (!tenantId) {
        return new Response('Cannot extract tenantId from orderCode', { status: 400 });
      }
      await activatePlan(tenantId, planId);
      console.log(`[webhook] PayOS: activated ${planId} for tenant ${tenantId}`);
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      console.error('[webhook] PayOS error:', e);
      return new Response('Internal error', { status: 500 });
    }
  }

  // ── Stripe webhook ─────────────────────────────────────────────────────────
  const sig = req.headers.get('stripe-signature') ?? '';
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (e) {
    console.error('[webhook] Stripe signature verification failed:', e);
    return new Response(`Webhook error: ${e}`, { status: 400 });
  }

  console.log(`[webhook] Stripe event: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenantId = session.metadata?.tenant_id;
        const priceId  = session.metadata?.price_id ?? '';
        const planId   = STRIPE_PRICE_TO_PLAN[priceId] ?? 'starter';
        if (!tenantId) break;
        await activatePlan(tenantId, planId);
        console.log(`[webhook] checkout.completed: activated ${planId} for ${tenantId}`);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice   = event.data.object as Stripe.Invoice;
        const tenantId  = invoice.metadata?.tenant_id;
        const priceId   = (invoice.lines.data[0]?.price as Stripe.Price)?.id ?? '';
        const planId    = STRIPE_PRICE_TO_PLAN[priceId] ?? 'starter';
        if (!tenantId) break;
        await activatePlan(tenantId, planId);
        console.log(`[webhook] invoice.paid: renewed ${planId} for ${tenantId}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice  = event.data.object as Stripe.Invoice;
        const tenantId = invoice.metadata?.tenant_id;
        if (!tenantId) break;
        await lockTenant(tenantId, 'invoice.payment_failed');
        break;
      }

      case 'customer.subscription.deleted': {
        const sub      = event.data.object as Stripe.Subscription;
        const tenantId = sub.metadata?.tenant_id;
        if (!tenantId) break;
        await lockTenant(tenantId, 'subscription.deleted');
        break;
      }

      default:
        console.log(`[webhook] Unhandled event: ${event.type}`);
    }
  } catch (e) {
    console.error('[webhook] Handler error:', e);
    return new Response('Handler error', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
