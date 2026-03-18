/**
 * create-checkout-session/index.ts — GEM&CLAUDE PM Pro
 * Supabase Edge Function: tạo Stripe Checkout Session
 * Deploy: supabase functions deploy create-checkout-session
 *
 * ENV: STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL
 */
import Stripe from 'https://esm.sh/stripe@13';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

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
    const { price_id, tenant_id, customer_email, success_url, cancel_url } = await req.json();
    if (!price_id || !tenant_id) {
      return new Response(JSON.stringify({ error: 'Missing price_id or tenant_id' }), { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      mode:               'subscription',
      payment_method_types: ['card'],
      customer_email,
      line_items: [{ price: price_id, quantity: 1 }],
      success_url: success_url ?? 'https://gemclaudepm.com?upgraded=1',
      cancel_url:  cancel_url  ?? 'https://gemclaudepm.com/billing',
      metadata:    { tenant_id, price_id },
      subscription_data: { metadata: { tenant_id } },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (e) {
    console.error('[create-checkout-session]', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
