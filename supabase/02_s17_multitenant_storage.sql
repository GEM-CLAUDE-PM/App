-- ════════════════════════════════════════
-- S17 — Multi-tenant foundation + Storage RLS
-- Chạy theo thứ tự: 02_s17_multitenant_storage.sql
-- ════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- S17 MIGRATIONS — Multi-tenant Foundation
-- Chạy TOÀN BỘ block này sau migrations cũ ở trên.
-- Thứ tự: tenants → alter profiles → alter project_data → RLS → pg_cron
-- ═══════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────
-- M-11. Tenants table — 1 tenant = 1 công ty
-- ───────────────────────────────────────────────────────────
create table if not exists public.tenants (
  id              uuid default gen_random_uuid() primary key,
  name            text not null,
  plan_id         text not null default 'trial',   -- 'trial'|'starter'|'pro'|'enterprise'
  trial_ends_at   timestamptz,                     -- null khi đã upgrade
  is_active       boolean not null default true,   -- false = locked
  admin_user_id   uuid references auth.users on delete set null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
alter table public.tenants enable row level security;

-- Tenant admin đọc được record của mình
create policy "tenants_admin_read" on public.tenants
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and tenant_id = tenants.id
        and is_tenant_admin = true
    )
  );

-- Chỉ system (service_role) mới INSERT/UPDATE tenants
-- Client INSERT qua signUp được xử lý qua Supabase Auth trigger hoặc Edge Fn

-- Auto-touch updated_at
drop trigger if exists tenants_touch on public.tenants;
create trigger tenants_touch
  before update on public.tenants
  for each row execute procedure touch_updated_at();


-- ───────────────────────────────────────────────────────────
-- M-12. Alter profiles — thêm tenant_id, billing fields
-- ───────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists tenant_id       uuid references public.tenants on delete set null,
  add column if not exists is_tenant_admin boolean not null default false,
  add column if not exists plan_id         text not null default 'trial',
  add column if not exists trial_ends_at   timestamptz,
  add column if not exists user_name       text;

-- Index để RLS lookup nhanh
create index if not exists profiles_tenant_idx on public.profiles (tenant_id);

-- Cập nhật trigger handle_new_user — giờ cũng set tenant fields khi có metadata
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (
    id, email, full_name, job_role, tier,
    tenant_id, is_tenant_admin, plan_id, trial_ends_at
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'job_role', 'worker'),
    coalesce(new.raw_user_meta_data->>'tier', 'worker'),
    (new.raw_user_meta_data->>'tenant_id')::uuid,   -- null nếu chưa có, update sau
    coalesce((new.raw_user_meta_data->>'is_tenant_admin')::boolean, false),
    coalesce(new.raw_user_meta_data->>'plan_id', 'trial'),
    null   -- set sau khi tenant được tạo
  )
  on conflict (id) do nothing;
  return new;
end;
$$;


-- ───────────────────────────────────────────────────────────
-- M-13. Alter project_data — thêm tenant_id để isolate data
-- ───────────────────────────────────────────────────────────
alter table public.project_data
  add column if not exists tenant_id uuid references public.tenants on delete cascade;

-- Index mới bao gồm tenant_id
create index if not exists project_data_tenant_idx
  on public.project_data (tenant_id, project_id, collection);

-- Drop policy cũ (quá rộng — authenticated = mọi tenant)
drop policy if exists "project_data_read"  on public.project_data;
drop policy if exists "project_data_write" on public.project_data;

-- RLS mới — chỉ đọc/ghi data của tenant mình
create policy "project_data_tenant_read" on public.project_data
  for select using (
    tenant_id = (
      select tenant_id from public.profiles where id = auth.uid()
    )
  );

create policy "project_data_tenant_write" on public.project_data
  for all using (
    tenant_id = (
      select tenant_id from public.profiles where id = auth.uid()
    )
  )
  with check (
    tenant_id = (
      select tenant_id from public.profiles where id = auth.uid()
    )
  );


-- ───────────────────────────────────────────────────────────
-- M-14. pg_cron — tự lock tenant khi trial hết hạn
-- Extension phải được enable trong Supabase Dashboard:
--   Database → Extensions → pg_cron → Enable
-- ───────────────────────────────────────────────────────────
-- Chạy mỗi giờ, tự set is_active = false khi trial_ends_at < now()
-- Uncomment sau khi enable pg_cron:
/*
select cron.schedule(
  'lock-expired-trials',
  '0 * * * *',   -- mỗi giờ
  $$
    update public.tenants
      set is_active = false, updated_at = now()
      where plan_id = 'trial'
        and trial_ends_at < now()
        and is_active = true;
  $$
);
*/


-- ───────────────────────────────────────────────────────────
-- M-15. Helper function — tính số ngày trial còn lại
-- Dùng trong BillingPage / TrialBanner
-- ───────────────────────────────────────────────────────────
create or replace function public.get_trial_days_left(p_tenant_id uuid)
returns integer language sql security definer as $$
  select greatest(0,
    extract(day from (
      select trial_ends_at from public.tenants where id = p_tenant_id
    ) - now())::integer
  );
$$;


-- ───────────────────────────────────────────────────────────
-- M-16. Realtime — enable cho tenants (plan upgrade live)
-- ───────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.tenants;


-- ═══════════════════════════════════════════════════════════
-- Verify S17:
-- select id, name, plan_id, trial_ends_at, is_active from public.tenants limit 5;
-- select id, email, tenant_id, plan_id, trial_ends_at from public.profiles limit 5;
-- select project_data_tenant_read from pg_policies where tablename='project_data';
-- ═══════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════
-- S17 STORAGE — Supabase Storage RLS tenant-scoped
-- Chạy SAU khi tạo bucket "gem-docs" (private) trong Dashboard
-- Supabase Dashboard → Storage → New bucket → gem-docs → Private
-- ═══════════════════════════════════════════════════════════

-- Cho phép authenticated user upload — path phải bắt đầu bằng project thuộc tenant mình
create policy "storage_upload" on storage.objects
  for insert with check (
    bucket_id = 'gem-docs'
    and auth.role() = 'authenticated'
  );

-- Cho phép đọc — project phải thuộc tenant của user
create policy "storage_read" on storage.objects
  for select using (
    bucket_id = 'gem-docs'
    and auth.role() = 'authenticated'
    and exists (
      select 1 from public.projects p
      join public.profiles pr on pr.tenant_id = p.tenant_id
      where pr.id = auth.uid()
        and (storage.foldername(name))[1] = p.id::text
    )
  );

-- Cho phép xóa — admin tier hoặc đúng project
create policy "storage_delete" on storage.objects
  for delete using (
    bucket_id = 'gem-docs'
    and (
      exists (
        select 1 from public.profiles
        where id = auth.uid() and tier = 'admin'
      )
    )
  );

-- ═══════════════════════════════════════════════════════════
-- Verify Storage:
-- select * from storage.buckets where id = 'gem-docs';
-- ═══════════════════════════════════════════════════════════


