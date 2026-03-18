-- ══════════════════════════════════════════════════════════════════════════════
-- GEM & CLAUDE PM Pro — Migration: Multi-tenant + Billing v2.0 (fixed)
-- Chạy trong Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── BƯỚC 1: Enum plan ────────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'plan_enum') then
    create type public.plan_enum as enum (
      'trial', 'starter', 'pro', 'enterprise'
    );
  end if;
end $$;

-- ─── BƯỚC 2: Bảng tenants (chưa có RLS — thêm sau khi profiles có cột) ───────
create table if not exists public.tenants (
  id                  uuid default gen_random_uuid() primary key,
  name                text not null,
  slug                text unique,
  plan                public.plan_enum not null default 'trial',
  trial_ends_at       timestamptz not null default (now() + interval '30 days'),
  plan_expires_at     timestamptz,
  is_locked           boolean not null default false,
  stripe_customer_id  text,
  payos_customer_id   text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ─── BƯỚC 3: Thêm cột vào profiles TRƯỚC khi tạo RLS/policy ─────────────────
alter table public.profiles
  add column if not exists tenant_id       uuid references public.tenants(id) on delete set null,
  add column if not exists is_tenant_admin boolean not null default false;

create index if not exists idx_profiles_tenant_id on public.profiles(tenant_id);

-- ─── BƯỚC 4: Giờ mới enable RLS + tạo policy (profiles.tenant_id đã tồn tại) ─
alter table public.tenants enable row level security;

drop policy if exists "tenant_self_read" on public.tenants;
create policy "tenant_self_read" on public.tenants
  for select using (
    id in (
      select tenant_id from public.profiles where id = auth.uid()
    )
  );

-- ─── BƯỚC 5: Bảng billing_events ─────────────────────────────────────────────
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
  payment_provider  text,
  provider_ref      text,
  notes             text,
  created_at        timestamptz default now(),
  created_by        uuid references auth.users(id)
);

alter table public.billing_events enable row level security;

drop policy if exists "billing_tenant_read" on public.billing_events;
create policy "billing_tenant_read" on public.billing_events
  for select using (
    tenant_id in (
      select tenant_id from public.profiles where id = auth.uid()
    )
  );

create index if not exists idx_billing_tenant_id on public.billing_events(tenant_id);

-- ─── BƯỚC 6: Trigger tự động tạo tenant khi user signup ──────────────────────
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
  v_full_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  v_company   := coalesce(new.raw_user_meta_data->>'company_name', v_full_name || ' Company');
  v_job_role  := coalesce(new.raw_user_meta_data->>'job_role', 'ks_giam_sat');
  v_tier      := coalesce(new.raw_user_meta_data->>'tier', 'manager');

  v_tenant_id := (new.raw_user_meta_data->>'tenant_id')::uuid;

  if v_tenant_id is not null then
    -- User được invite → join tenant có sẵn
    v_is_admin := false;
  else
    -- User tự signup → tạo tenant mới, là admin
    v_is_admin := true;
    v_job_role := 'giam_doc';
    v_tier     := 'admin';

    insert into public.tenants (name)
    values (v_company)
    returning id into v_tenant_id;

    insert into public.billing_events (tenant_id, event_type, plan, notes)
    values (v_tenant_id, 'trial_start', 'trial', 'Auto on signup');
  end if;

  insert into public.profiles (
    id, email, full_name,
    job_role, tier,
    tenant_id, is_tenant_admin,
    project_ids, created_at
  ) values (
    new.id, new.email, v_full_name,
    v_job_role::public.job_role_enum,
    v_tier,
    v_tenant_id, v_is_admin,
    '{}', now()
  )
  on conflict (id) do update set
    tenant_id       = excluded.tenant_id,
    is_tenant_admin = excluded.is_tenant_admin;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── BƯỚC 7: Chỉ 1 admin per tenant ─────────────────────────────────────────
create unique index if not exists uniq_tenant_admin
  on public.profiles (tenant_id)
  where is_tenant_admin = true;

-- ─── BƯỚC 8: Hàm transfer admin ──────────────────────────────────────────────
create or replace function public.transfer_tenant_admin(new_admin_user_id uuid)
returns void language plpgsql security definer as $$
declare
  v_tenant_id  uuid;
  v_new_role   text;
begin
  select tenant_id into v_tenant_id
  from public.profiles
  where id = auth.uid() and is_tenant_admin = true;

  if v_tenant_id is null then
    raise exception 'Bạn không phải admin của tenant này';
  end if;

  select job_role::text into v_new_role
  from public.profiles
  where id = new_admin_user_id and tenant_id = v_tenant_id;

  if v_new_role is null then
    raise exception 'User không thuộc tenant của bạn';
  end if;

  if v_new_role not in ('giam_doc', 'pm', 'ke_toan_truong') then
    raise exception 'Chỉ Giám đốc, PM hoặc Kế toán trưởng mới có thể là Admin';
  end if;

  -- Atomic transfer
  update public.profiles set is_tenant_admin = false
  where tenant_id = v_tenant_id and is_tenant_admin = true;

  update public.profiles set is_tenant_admin = true
  where id = new_admin_user_id;
end;
$$;

-- ─── BƯỚC 9: Hàm check tenant active ─────────────────────────────────────────
create or replace function public.is_tenant_active()
returns boolean language plpgsql security definer as $$
declare
  v_t public.tenants;
begin
  select t.* into v_t
  from public.tenants t
  join public.profiles p on p.tenant_id = t.id
  where p.id = auth.uid()
  limit 1;

  if v_t is null          then return false; end if;
  if v_t.is_locked        then return false; end if;
  if v_t.plan = 'trial' and v_t.trial_ends_at > now() then return true; end if;
  if v_t.plan != 'trial'  then
    if v_t.plan_expires_at is null     then return true; end if;
    if v_t.plan_expires_at > now()     then return true; end if;
  end if;
  return false;
end;
$$;

-- ─── BƯỚC 10: Gán tenant cho users hiện có (chưa có tenant_id) ───────────────
do $$
declare
  p   record;
  tid uuid;
begin
  for p in select * from public.profiles where tenant_id is null loop
    insert into public.tenants (name)
    values (split_part(p.email, '@', 2))
    returning id into tid;

    insert into public.billing_events (tenant_id, event_type, plan, notes)
    values (tid, 'trial_start', 'trial', 'Migration: ' || p.email);

    update public.profiles
    set tenant_id = tid, is_tenant_admin = true
    where id = p.id;
  end loop;
end $$;

-- ─── Kiểm tra kết quả ─────────────────────────────────────────────────────────
select
  t.name            as tenant_name,
  t.plan,
  t.trial_ends_at::date as trial_ends,
  t.is_locked,
  count(p.id)       as users
from public.tenants t
left join public.profiles p on p.tenant_id = t.id
group by t.id
order by t.created_at;
