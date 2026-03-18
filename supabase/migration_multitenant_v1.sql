-- ══════════════════════════════════════════════════════════════════════════════
-- GEM & CLAUDE PM Pro — Migration: Multi-tenant + Billing v1.0
-- Chạy trong Supabase SQL Editor
-- Chạy SAU migration_roles_v3_fixed.sql
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── BƯỚC 1: Enum plan ────────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'plan_enum') then
    create type public.plan_enum as enum (
      'trial',
      'starter',
      'pro',
      'enterprise'
    );
    raise notice 'Created enum plan_enum';
  end if;
end $$;

-- ─── BƯỚC 2: Bảng tenants ─────────────────────────────────────────────────────
create table if not exists public.tenants (
  id                  uuid default gen_random_uuid() primary key,
  name                text not null,                          -- tên công ty
  slug                text unique,                            -- subdomain (tùy chọn)
  plan                public.plan_enum not null default 'trial',
  trial_ends_at       timestamptz not null default (now() + interval '30 days'),
  plan_expires_at     timestamptz,                            -- null = không có hạn (enterprise)
  is_locked           boolean not null default false,         -- true khi hết trial/hết hạn
  stripe_customer_id  text,
  payos_customer_id   text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

alter table public.tenants enable row level security;

-- Tenant tự đọc record của mình
create policy "tenant_self_read" on public.tenants
  for select using (
    id in (
      select tenant_id from public.profiles where id = auth.uid()
    )
  );

-- Chỉ GEM&CLAUDE super admin mới update (dùng service_role qua Edge Function)
-- User thường không update trực tiếp

-- ─── BƯỚC 3: Thêm cột vào profiles ──────────────────────────────────────────
alter table public.profiles
  add column if not exists tenant_id        uuid references public.tenants(id) on delete set null,
  add column if not exists is_tenant_admin  boolean not null default false;

-- Index để query nhanh
create index if not exists idx_profiles_tenant_id on public.profiles(tenant_id);

-- ─── BƯỚC 4: Bảng billing_events ─────────────────────────────────────────────
create table if not exists public.billing_events (
  id                uuid default gen_random_uuid() primary key,
  tenant_id         uuid references public.tenants(id) on delete cascade not null,
  event_type        text not null check (event_type in (
                      'trial_start', 'trial_extended',
                      'payment_success', 'payment_failed',
                      'upgrade', 'downgrade', 'cancel',
                      'manual_unlock', 'locked'
                    )),
  plan              public.plan_enum,
  amount_vnd        bigint default 0,
  payment_provider  text check (payment_provider in ('payos', 'stripe', 'manual', null)),
  provider_ref      text,                                    -- mã GD từ provider
  notes             text,
  created_at        timestamptz default now(),
  created_by        uuid references auth.users(id)
);

alter table public.billing_events enable row level security;

create policy "billing_tenant_read" on public.billing_events
  for select using (
    tenant_id in (
      select tenant_id from public.profiles where id = auth.uid()
    )
  );

create index if not exists idx_billing_tenant_id on public.billing_events(tenant_id);

-- ─── BƯỚC 5: Trigger tự động tạo tenant khi user signup ─────────────────────
-- Khi auth.users INSERT → tạo tenant mới + profile với is_tenant_admin=true
-- Nếu user được invite (có metadata tenant_id) → join tenant hiện có

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  v_tenant_id   uuid;
  v_company     text;
  v_full_name   text;
  v_job_role    text;
  v_tier        text;
  v_is_admin    boolean;
begin
  -- Đọc metadata từ signup form
  v_full_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  v_company   := coalesce(new.raw_user_meta_data->>'company_name', v_full_name || '''s Company');
  v_job_role  := coalesce(new.raw_user_meta_data->>'job_role', 'ks_giam_sat');
  v_tier      := coalesce(new.raw_user_meta_data->>'tier', 'manager');

  -- Kiểm tra user được invite vào tenant có sẵn
  v_tenant_id := (new.raw_user_meta_data->>'tenant_id')::uuid;

  if v_tenant_id is not null then
    -- User được invite → join tenant hiện có, không phải admin
    v_is_admin := false;
  else
    -- User tự signup → tạo tenant mới, là admin
    v_is_admin := true;
    v_job_role := 'giam_doc';
    v_tier     := 'admin';

    insert into public.tenants (name)
    values (v_company)
    returning id into v_tenant_id;

    -- Ghi billing event: trial_start
    insert into public.billing_events (tenant_id, event_type, plan, notes)
    values (v_tenant_id, 'trial_start', 'trial', 'Auto-created on signup');
  end if;

  -- Tạo profile
  insert into public.profiles (
    id, email, full_name,
    job_role, tier,
    tenant_id, is_tenant_admin,
    project_ids, created_at
  ) values (
    new.id,
    new.email,
    v_full_name,
    v_job_role::public.job_role_enum,
    v_tier,
    v_tenant_id,
    v_is_admin,
    '{}',
    now()
  )
  on conflict (id) do update set
    tenant_id       = excluded.tenant_id,
    is_tenant_admin = excluded.is_tenant_admin;

  return new;
end;
$$;

-- Drop trigger cũ nếu có, tạo lại
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── BƯỚC 6: Hàm kiểm tra tenant có bị locked không ─────────────────────────
-- App gọi hàm này để check quyền write
create or replace function public.is_tenant_active()
returns boolean language plpgsql security definer as $$
declare
  v_tenant public.tenants;
begin
  select t.* into v_tenant
  from public.tenants t
  join public.profiles p on p.tenant_id = t.id
  where p.id = auth.uid()
  limit 1;

  if v_tenant is null then return false; end if;
  if v_tenant.is_locked then return false; end if;

  -- Trial chưa hết
  if v_tenant.plan = 'trial' and v_tenant.trial_ends_at > now() then
    return true;
  end if;

  -- Paid plan còn hạn (hoặc enterprise không có ngày hết hạn)
  if v_tenant.plan != 'trial' then
    if v_tenant.plan_expires_at is null then return true; end if;
    if v_tenant.plan_expires_at > now() then return true; end if;
  end if;

  return false;
end;
$$;

-- ─── BƯỚC 7: Cron job kiểm tra lock tenant hết hạn (chạy hàng ngày) ─────────
-- Cần enable pg_cron extension trước: Dashboard → Database → Extensions → pg_cron
-- Nếu chưa có pg_cron thì bỏ qua phần này, dùng Edge Function scheduled thay thế

-- select cron.schedule(
--   'lock-expired-tenants',
--   '0 2 * * *',  -- 2am mỗi ngày
--   $$
--     update public.tenants set is_locked = true
--     where is_locked = false
--     and (
--       (plan = 'trial' and trial_ends_at < now())
--       or (plan != 'trial' and plan_expires_at is not null and plan_expires_at < now())
--     );
--   $$
-- );

-- ─── BƯỚC 8: Gán tenant_id cho users hiện có ─────────────────────────────────
-- User hiện tại chưa có tenant → tạo tenant cho họ
do $$
declare
  p record;
  v_tenant_id uuid;
begin
  for p in
    select * from public.profiles where tenant_id is null
  loop
    -- Tạo tenant mới cho user này
    insert into public.tenants (name)
    values (split_part(p.email, '@', 2))  -- dùng domain email làm tên tạm
    returning id into v_tenant_id;

    -- Ghi billing event
    insert into public.billing_events (tenant_id, event_type, plan, notes)
    values (v_tenant_id, 'trial_start', 'trial', 'Migration: assigned to existing user ' || p.email);

    -- Update profile
    update public.profiles set
      tenant_id = v_tenant_id,
      is_tenant_admin = true
    where id = p.id;

    raise notice 'Created tenant for %', p.email;
  end loop;
end $$;

-- ─── BƯỚC 9: Kiểm tra kết quả ────────────────────────────────────────────────
select
  t.name as tenant_name,
  t.plan,
  t.trial_ends_at::date as trial_ends,
  t.is_locked,
  count(p.id) as user_count
from public.tenants t
left join public.profiles p on p.tenant_id = t.id
group by t.id, t.name, t.plan, t.trial_ends_at, t.is_locked
order by t.created_at;

-- ══════════════════════════════════════════════════════════════════════════════
-- SAU KHI CHẠY XONG:
-- 1. Kiểm tra kết quả SELECT ở trên
-- 2. Enable pg_cron nếu muốn auto-lock (Dashboard → Database → Extensions)
-- 3. Hoặc tạo Edge Function scheduled thay thế pg_cron
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── BƯỚC 10: Enforce chỉ 1 admin per tenant ─────────────────────────────────

-- Partial unique index: chỉ có thể có 1 row is_tenant_admin=true per tenant
create unique index if not exists uniq_tenant_admin
  on public.profiles (tenant_id)
  where is_tenant_admin = true;

-- Hàm transfer admin an toàn (atomic — không bao giờ có 0 hoặc 2 admin)
create or replace function public.transfer_tenant_admin(
  new_admin_user_id uuid
)
returns void language plpgsql security definer as $$
declare
  v_tenant_id     uuid;
  v_new_job_role  text;
begin
  -- Lấy tenant_id của caller
  select tenant_id into v_tenant_id
  from public.profiles
  where id = auth.uid() and is_tenant_admin = true;

  if v_tenant_id is null then
    raise exception 'Bạn không phải admin của tenant này';
  end if;

  -- Kiểm tra user mới thuộc cùng tenant
  select job_role into v_new_job_role
  from public.profiles
  where id = new_admin_user_id and tenant_id = v_tenant_id;

  if v_new_job_role is null then
    raise exception 'User không thuộc tenant của bạn';
  end if;

  -- Chỉ L4/L5 mới được làm admin (pm, ke_toan_truong, giam_doc)
  if v_new_job_role not in ('giam_doc', 'pm', 'ke_toan_truong') then
    raise exception 'Chỉ Giám đốc, PM hoặc Kế toán trưởng mới có thể là Admin tenant';
  end if;

  -- Transfer atomic: xóa admin cũ → set admin mới trong cùng transaction
  update public.profiles set is_tenant_admin = false
  where tenant_id = v_tenant_id and is_tenant_admin = true;

  update public.profiles set is_tenant_admin = true
  where id = new_admin_user_id;

end;
$$;
