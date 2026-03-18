-- ══════════════════════════════════════════════════════════════════════════════
-- GEM & CLAUDE PM Pro — Migration: Project Permission Overrides
-- Cho phép admin cấp quyền tùy biến theo từng DA
-- ══════════════════════════════════════════════════════════════════════════════

-- Bảng override quyền tab theo từng dự án
create table if not exists public.project_member_overrides (
  id           uuid default gen_random_uuid() primary key,
  project_id   text not null,                    -- ID dự án
  user_id      uuid references auth.users(id) on delete cascade not null,
  tab_id       text not null,                    -- tab bị override: 'boq', 'contracts', 'accounting'...
  access_level text not null check (access_level in ('full', 'readonly', 'hidden')),
  -- Override chỉ được NÂNG lên, không hạ xuống (enforce ở app layer)
  granted_by   uuid references auth.users(id),
  granted_at   timestamptz default now(),
  note         text,                             -- lý do cấp quyền
  unique (project_id, user_id, tab_id)           -- 1 override per user per tab per project
);

alter table public.project_member_overrides enable row level security;

-- Chỉ admin tenant mới thấy và quản lý overrides
create policy "overrides_admin_manage" on public.project_member_overrides
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and (tier = 'admin' or job_role in ('giam_doc', 'pm'))
    )
  );

-- Member xem override của chính mình
create policy "overrides_self_read" on public.project_member_overrides
  for select using (user_id = auth.uid());

create index if not exists idx_overrides_project_user
  on public.project_member_overrides (project_id, user_id);

-- ── Kiểm tra ──────────────────────────────────────────────────────────────────
select 'project_member_overrides created' as status;
