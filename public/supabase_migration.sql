-- ══════════════════════════════════════════════════════════════════════════════
-- GEM&CLAUDE PM Pro — Full Database Migration
-- Chạy toàn bộ file này trong Supabase SQL Editor một lần duy nhất
-- Supabase Dashboard → SQL Editor → New query → paste → Run
-- ══════════════════════════════════════════════════════════════════════════════


-- ─── 1. PROFILES (mở rộng auth.users) ────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid references auth.users on delete cascade primary key,
  email       text unique not null,
  full_name   text not null,
  job_role    text not null default 'worker',
  tier        text not null default 'worker',
  phone       text,
  avatar_url  text,
  project_ids text[] default '{}',
  created_at  timestamptz default now()
);
alter table public.profiles enable row level security;

drop policy if exists "profiles_self_read"  on public.profiles;
drop policy if exists "profiles_admin_read" on public.profiles;
drop policy if exists "profiles_self_write" on public.profiles;
drop policy if exists "profiles_admin_write" on public.profiles;

create policy "profiles_self_read" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_admin_read" on public.profiles
  for select using (
    exists (select 1 from public.profiles p2 where p2.id = auth.uid() and p2.tier = 'admin')
  );

create policy "profiles_self_write" on public.profiles
  for update using (auth.uid() = id);

create policy "profiles_admin_write" on public.profiles
  for all using (
    exists (select 1 from public.profiles p2 where p2.id = auth.uid() and p2.tier = 'admin')
  );


-- ─── 2. PROJECTS ─────────────────────────────────────────────────────────────
create table if not exists public.projects (
  id           uuid default gen_random_uuid() primary key,
  name         text not null,
  code         text,
  address      text,
  status       text default 'in_progress',
  template_id  text,
  start_date   date,
  end_date     date,
  budget       numeric default 0,
  created_by   uuid references auth.users,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
alter table public.projects enable row level security;

drop policy if exists "projects_member_read"  on public.projects;
drop policy if exists "projects_admin_write"  on public.projects;

create policy "projects_member_read" on public.projects
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and (tier = 'admin' or projects.id::text = any(project_ids))
    )
  );

create policy "projects_admin_write" on public.projects
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and tier = 'admin')
  );


-- ─── 3. AUDIT LOG (append-only) ──────────────────────────────────────────────
create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users,
  project_id uuid,
  action     text not null,
  detail     text,
  created_at timestamptz default now()
);
alter table public.audit_log enable row level security;

drop policy if exists "audit_insert"     on public.audit_log;
drop policy if exists "audit_admin_read" on public.audit_log;

create policy "audit_insert" on public.audit_log
  for insert with check (auth.uid() = user_id);

create policy "audit_admin_read" on public.audit_log
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and tier = 'admin')
  );


-- ─── 4. TRIGGER: auto-create profile khi user đăng ký ───────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, job_role, tier)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'job_role', 'worker'),
    coalesce(new.raw_user_meta_data->>'tier', 'worker')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ─── 5. PROJECT MEMBERS ───────────────────────────────────────────────────────
create table if not exists public.project_members (
  id             uuid default gen_random_uuid() primary key,
  project_id     uuid references public.projects on delete cascade not null,
  user_id        uuid references auth.users on delete cascade not null,
  roles          text[] not null default '{}',
  active_role_id text not null,
  granted_extras jsonb,
  joined_at      timestamptz default now(),
  updated_at     timestamptz default now(),
  unique(project_id, user_id)
);
alter table public.project_members enable row level security;

drop policy if exists "pm_self_read"    on public.project_members;
drop policy if exists "pm_project_read" on public.project_members;
drop policy if exists "pm_admin_write"  on public.project_members;

create policy "pm_self_read" on public.project_members
  for select using (auth.uid() = user_id);

create policy "pm_project_read" on public.project_members
  for select using (
    exists (
      select 1 from public.project_members pm2
      where pm2.project_id = project_members.project_id
        and pm2.user_id = auth.uid()
    )
  );

create policy "pm_admin_write" on public.project_members
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and tier = 'admin')
  );

-- Trigger: sync project_ids vào profiles
create or replace function public.sync_profile_project_ids()
returns trigger language plpgsql security definer as $$
begin
  if (TG_OP = 'INSERT') then
    update public.profiles
      set project_ids = array_append(project_ids, NEW.project_id::text)
      where id = NEW.user_id
        and not (project_ids @> array[NEW.project_id::text]);
  elsif (TG_OP = 'DELETE') then
    update public.profiles
      set project_ids = array_remove(project_ids, OLD.project_id::text)
      where id = OLD.user_id;
  end if;
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists on_project_member_change on public.project_members;
create trigger on_project_member_change
  after insert or delete on public.project_members
  for each row execute procedure public.sync_profile_project_ids();


-- ─── 6. DELEGATIONS ──────────────────────────────────────────────────────────
create table if not exists public.delegations (
  id           uuid default gen_random_uuid() primary key,
  project_id   uuid references public.projects on delete cascade not null,
  from_user_id uuid references auth.users not null,
  to_user_id   uuid references auth.users not null,
  from_role_id text not null,
  to_role_id   text not null,
  doc_types    text[],
  level_grant  int not null default 1,
  domain_grant text[] not null default '{}',
  reason       text not null,
  note         text,
  start_at     timestamptz not null default now(),
  end_at       timestamptz not null,
  status       text not null default 'active',
  created_at   timestamptz default now(),
  revoked_at   timestamptz,
  revoked_by   uuid references auth.users
);
alter table public.delegations enable row level security;

drop policy if exists "del_parties_read"  on public.delegations;
drop policy if exists "del_member_insert" on public.delegations;
drop policy if exists "del_revoke_update" on public.delegations;

create policy "del_parties_read" on public.delegations
  for select using (
    auth.uid() = from_user_id
    or auth.uid() = to_user_id
    or exists (select 1 from public.profiles where id = auth.uid() and tier = 'admin')
  );

create policy "del_member_insert" on public.delegations
  for insert with check (
    auth.uid() = from_user_id
    and exists (
      select 1 from public.project_members
      where project_id = delegations.project_id and user_id = auth.uid()
    )
  );

create policy "del_revoke_update" on public.delegations
  for update using (
    auth.uid() = from_user_id
    or exists (select 1 from public.profiles where id = auth.uid() and tier = 'admin')
  );


-- ─── 7. PROJECT TEMPLATES ────────────────────────────────────────────────────
create table if not exists public.project_templates (
  project_id  uuid references public.projects on delete cascade primary key,
  template_id text not null,
  applied_at  timestamptz default now(),
  applied_by  uuid references auth.users
);
alter table public.project_templates enable row level security;

drop policy if exists "pt_member_read" on public.project_templates;
drop policy if exists "pt_pm_write"    on public.project_templates;

create policy "pt_member_read" on public.project_templates
  for select using (
    exists (
      select 1 from public.project_members
      where project_id = project_templates.project_id and user_id = auth.uid()
    )
  );

create policy "pt_pm_write" on public.project_templates
  for all using (
    exists (
      select 1 from public.project_members
      where project_id = project_templates.project_id
        and user_id = auth.uid()
        and active_role_id in ('pm','giam_doc')
    )
    or exists (select 1 from public.profiles where id = auth.uid() and tier = 'admin')
  );


-- ─── 8. APPROVALS ────────────────────────────────────────────────────────────
create table if not exists public.approvals (
  id              uuid default gen_random_uuid() primary key,
  project_id      uuid references public.projects on delete cascade not null,
  doc_type        text not null,
  doc_ref         text,
  title           text not null,
  amount          numeric default 0,
  workflow_steps  jsonb not null default '[]',
  current_step_id text,
  status          text not null default 'PENDING_REVIEW',
  thresholds      jsonb,
  data            jsonb,
  created_by      uuid references auth.users not null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
alter table public.approvals enable row level security;

drop policy if exists "ap_member_read"   on public.approvals;
drop policy if exists "ap_member_insert" on public.approvals;
drop policy if exists "ap_admin_update"  on public.approvals;

create policy "ap_member_read" on public.approvals
  for select using (
    exists (
      select 1 from public.project_members
      where project_id = approvals.project_id and user_id = auth.uid()
    )
  );

create policy "ap_member_insert" on public.approvals
  for insert with check (
    auth.uid() = created_by
    and exists (
      select 1 from public.project_members
      where project_id = approvals.project_id and user_id = auth.uid()
    )
  );

create policy "ap_admin_update" on public.approvals
  for update using (
    exists (
      select 1 from public.project_members
      where project_id = approvals.project_id and user_id = auth.uid()
    )
  );


-- ─── 9. APPROVAL ACTIONS (append-only audit trail) ───────────────────────────
create table if not exists public.approval_actions (
  id          bigint generated always as identity primary key,
  approval_id uuid references public.approvals on delete cascade not null,
  step_id     text not null,
  action_type text not null,
  actor_id    uuid references auth.users not null,
  actor_role  text not null,
  pin_verified boolean default false,
  comment     text,
  acted_at    timestamptz default now()
);
alter table public.approval_actions enable row level security;

drop policy if exists "aa_member_read" on public.approval_actions;
drop policy if exists "aa_actor_insert" on public.approval_actions;

create policy "aa_member_read" on public.approval_actions
  for select using (
    exists (
      select 1 from public.approvals ap
      join public.project_members pm on pm.project_id = ap.project_id
      where ap.id = approval_actions.approval_id
        and pm.user_id = auth.uid()
    )
  );

create policy "aa_actor_insert" on public.approval_actions
  for insert with check (auth.uid() = actor_id);


-- ─── 10. REALTIME ────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.approvals;
alter publication supabase_realtime add table public.approval_actions;


-- ─── 11. APP DATA (lưu dữ liệu nghiệp vụ các dashboard) ─────────────────────
-- Bảng tổng hợp: mỗi row là 1 record nghiệp vụ (vật tư, HSE, QS, v.v.)
create table if not exists public.app_data (
  id          uuid default gen_random_uuid() primary key,
  project_id  uuid references public.projects on delete cascade not null,
  module      text not null,   -- 'materials', 'hse', 'qs', 'hr', 'equipment', v.v.
  record_type text not null,   -- 'voucher', 'incident', 'leave', v.v.
  data        jsonb not null default '{}',
  created_by  uuid references auth.users,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table public.app_data enable row level security;

drop policy if exists "appdata_member_read"   on public.app_data;
drop policy if exists "appdata_member_write"  on public.app_data;

create policy "appdata_member_read" on public.app_data
  for select using (
    exists (
      select 1 from public.project_members
      where project_id = app_data.project_id and user_id = auth.uid()
    )
  );

create policy "appdata_member_write" on public.app_data
  for all using (
    exists (
      select 1 from public.project_members
      where project_id = app_data.project_id and user_id = auth.uid()
    )
  );


-- ─── HOÀN THÀNH ──────────────────────────────────────────────────────────────
-- Tables: profiles, projects, audit_log, project_members, delegations,
--         project_templates, approvals, approval_actions, app_data
-- Triggers: on_auth_user_created, on_project_member_change
-- RLS: enabled on all tables
-- Realtime: approvals, approval_actions
