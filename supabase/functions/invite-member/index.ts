// supabase/functions/invite-member/index.ts
// Edge Function — chạy với service_role key, an toàn
// Deploy: supabase functions deploy invite-member

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Xác thực caller — chỉ user đã login (admin tier) mới được gọi
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Client với anon key để verify caller
    const supabaseAnon = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    // Verify caller là admin tier
    const { data: { user: caller }, error: authError } = await supabaseAnon.auth.getUser()
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: callerProfile } = await supabaseAnon
      .from('profiles')
      .select('tier, job_role')
      .eq('id', caller.id)
      .single()

    if (callerProfile?.tier !== 'admin') {
      return new Response(JSON.stringify({ error: 'Chỉ Admin mới được mời thành viên' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Parse body
    const { email, full_name, job_role, tier, phone, project_ids } = await req.json()
    if (!email || !full_name || !job_role) {
      return new Response(JSON.stringify({ error: 'Thiếu thông tin bắt buộc' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Admin client với service_role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Tạo user bằng inviteUserByEmail
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { full_name, job_role, tier },
      redirectTo: req.headers.get('origin') || Deno.env.get('SITE_URL') || 'https://gemclaudepm.com',
    })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const newUserId = data.user.id

    // Update profile với đầy đủ thông tin
    await supabaseAdmin.from('profiles').update({
      full_name,
      phone: phone || null,
      job_role,
      tier,
      project_ids: project_ids || [],
    }).eq('id', newUserId)

    // Gán vào project_members
    if (project_ids?.length) {
      const roleMap: Record<string, string> = {
        giam_doc: 'giam_doc', pm: 'pm', ke_toan_truong: 'ke_toan_truong',
        truong_qs: 'truong_qs', truong_qaqc: 'truong_qaqc', truong_hse: 'truong_hse',
        hr_truong: 'hr_truong', chi_huy_truong: 'chi_huy_truong', chi_huy_pho: 'chi_huy_pho',
        qs_site: 'qs_site', qaqc_site: 'qaqc_site', ks_giam_sat: 'ks_giam_sat',
        hse_site: 'hse_site', ke_toan_site: 'ke_toan_site', ke_toan_kho: 'ke_toan_kho',
        hr_site: 'hr_site', thu_kho: 'thu_kho', thu_ky_site: 'thu_ky_site',
        operator: 'operator', ntp_site: 'ntp_site', to_doi: 'to_doi', ky_thuat_vien: 'ky_thuat_vien',
      }
      const roleId = roleMap[job_role] ?? 'ks_giam_sat'

      for (const pid of project_ids) {
        await supabaseAdmin.from('project_members').upsert({
          project_id: pid,
          user_id: newUserId,
          roles: [roleId],
          active_role_id: roleId,
        }, { onConflict: 'project_id,user_id' })
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      userId: newUserId,
      message: `Đã gửi email mời đến ${email}`,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
