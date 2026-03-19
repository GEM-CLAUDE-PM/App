// supabase/functions/bulk-create-users/index.ts
// Edge Function: Tạo users hàng loạt qua Supabase Admin API
// Gọi bởi: BulkUserUpload.tsx (chỉ admin tier)
//
// Body: { users: BulkUserPayload[] }
// Response: { results: BulkResult[] }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface BulkUserPayload {
  email: string;
  phone: string;
  full_name: string;
  job_role: string;
  tier: string;
  password: string;
  tenant_id: string;
}

interface BulkResult {
  email: string;
  full_name: string;
  ok: boolean;
  error?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify caller là authenticated user (JWT từ client)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Admin client (service_role) để tạo users
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify caller là admin tier trong tenant
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Không xác thực được người dùng.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Kiểm tra caller là admin/manager tier
    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('tier, tenant_id, is_tenant_admin')
      .eq('id', user.id)
      .single();

    if (!callerProfile || callerProfile.tier === 'worker') {
      return new Response(JSON.stringify({ error: 'Chỉ Admin hoặc Manager mới có thể tạo tài khoản.' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { users } = await req.json() as { users: BulkUserPayload[] };

    if (!Array.isArray(users) || users.length === 0) {
      return new Response(JSON.stringify({ error: 'Danh sách users rỗng.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (users.length > 200) {
      return new Response(JSON.stringify({ error: 'Tối đa 200 users mỗi lần upload.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Đảm bảo tất cả users thuộc cùng tenant của caller
    const tenantId = callerProfile.tenant_id;
    const results: BulkResult[] = [];

    for (const u of users) {
      try {
        // Tạo auth user qua Admin API — đúng cách, không INSERT thẳng SQL
        const { data: authData, error: createError } = await adminClient.auth.admin.createUser({
          email: u.email,
          password: u.password,
          phone: u.phone ? (u.phone.startsWith('+84') ? u.phone : '+84' + u.phone.slice(1)) : undefined,
          email_confirm: true,  // Confirm ngay — không cần email verify
          user_metadata: {
            full_name: u.full_name,
            job_role:  u.job_role,
            tier:      u.tier,
            tenant_id: tenantId,
            is_tenant_admin: false,
            plan_id: 'trial',
          },
        });

        if (createError) {
          // Nếu email đã tồn tại thì bỏ qua
          if (createError.message.includes('already been registered')) {
            results.push({ email: u.email, full_name: u.full_name, ok: false, error: 'Email đã tồn tại' });
          } else {
            results.push({ email: u.email, full_name: u.full_name, ok: false, error: createError.message });
          }
          continue;
        }

        // Update profile với đúng tenant_id (trigger handle_new_user đã tạo profile)
        // Đợi trigger chạy xong (nhỏ delay)
        await new Promise(r => setTimeout(r, 100));

        await adminClient.from('profiles').update({
          tenant_id:  tenantId,
          job_role:   u.job_role,
          tier:       u.tier,
          phone:      u.phone || null,
          plan_id:    'trial',
        }).eq('id', authData.user.id);

        results.push({ email: u.email, full_name: u.full_name, ok: true });

      } catch (e: any) {
        results.push({ email: u.email, full_name: u.full_name, ok: false, error: e.message });
      }
    }

    const successCount = results.filter(r => r.ok).length;
    console.log(`bulk-create-users: ${successCount}/${users.length} created for tenant ${tenantId}`);

    return new Response(JSON.stringify({ results, success: successCount, total: users.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e: any) {
    console.error('bulk-create-users error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
