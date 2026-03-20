// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: cors });
  }

  try {
    const bodyText = await req.text();
    if (!bodyText?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Body rỗng' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const data = JSON.parse(bodyText);
    if (!data.ten_cong_ty) {
      return new Response(
        JSON.stringify({ error: 'Thiếu tên công ty' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const sb = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: result, error } = await sb
      .from('crm_leads')
      .insert(data)
      .select('id, ma_kh')
      .single();

    if (error) throw new Error(error.message);

    return new Response(
      JSON.stringify({ ok: true, ma_kh: result.ma_kh, id: result.id }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    );

  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
}, { port: 8000 });
