-- ════════════════════════════════════════
-- S18 — Portal RLS (NTP + CĐT tuyệt đối)
-- Chạy theo thứ tự: 03_s18_portal_rls.sql
-- ════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- S18 MIGRATIONS — Portal RLS (NTP + CĐT tuyệt đối)
-- ═══════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────
-- M-17. RLS cho project_data — portal users chỉ đọc project được gán
-- Thay thế policy tenant_write để phân biệt write vs read-only
-- ───────────────────────────────────────────────────────────

-- Drop policy write cũ để tạo lại với portal guard
drop policy if exists "project_data_tenant_write" on public.project_data;

-- Write: chỉ internal users (không phải ntp / chu_dau_tu)
create policy "project_data_internal_write" on public.project_data
  for all
  using (
    tenant_id = (select tenant_id from public.profiles where id = auth.uid())
    and (select job_role from public.profiles where id = auth.uid())
        not in ('ntp', 'chu_dau_tu', 'ntp_site')
  )
  with check (
    tenant_id = (select tenant_id from public.profiles where id = auth.uid())
    and (select job_role from public.profiles where id = auth.uid())
        not in ('ntp', 'chu_dau_tu', 'ntp_site')
  );

-- Read: portal users (ntp, chu_dau_tu) chỉ đọc project được gán
-- ntp_site là internal — có thể đọc/ghi bình thường (xử lý qua policy trên)
create policy "project_data_portal_read" on public.project_data
  for select
  using (
    -- Là portal user
    (select job_role from public.profiles where id = auth.uid())
      in ('ntp', 'chu_dau_tu')
    -- project_id phải nằm trong project_ids của user
    and project_id = any(
      select unnest(project_ids) from public.profiles where id = auth.uid()
    )
    -- CĐT: chỉ đọc được các collection được phép (không phải lương, HR nội bộ)
    and (
      (select job_role from public.profiles where id = auth.uid()) = 'ntp'
      or collection in (
        'progress_wbs', 'qs_payments', 'qs_acceptance',
        'qa_checklists', 'hse_incidents', 'calendar_events'
      )
    )
  );


-- ───────────────────────────────────────────────────────────
-- M-18. projects table — thêm tenant_id (nếu chưa có từ trước)
-- ───────────────────────────────────────────────────────────
alter table public.projects
  add column if not exists tenant_id uuid references public.tenants on delete cascade;

create index if not exists projects_tenant_idx on public.projects (tenant_id);

-- RLS cho projects — internal user thấy project của tenant mình
drop policy if exists "projects_member_read" on public.projects;

create policy "projects_tenant_read" on public.projects
  for select using (
    tenant_id = (select tenant_id from public.profiles where id = auth.uid())
  );

-- Portal user chỉ thấy project được gán
create policy "projects_portal_read" on public.projects
  for select using (
    id = any(
      select unnest(project_ids)::uuid
      from public.profiles where id = auth.uid()
    )
    and (select job_role from public.profiles where id = auth.uid())
        in ('ntp', 'chu_dau_tu')
  );


-- ───────────────────────────────────────────────────────────
-- M-19. profiles RLS — portal user không thấy profile người khác
-- ───────────────────────────────────────────────────────────
-- Drop policy cũ nếu có
drop policy if exists "profiles_self_read" on public.profiles;
drop policy if exists "profiles_admin_read" on public.profiles;

-- Self read
create policy "profiles_self_read" on public.profiles
  for select using (auth.uid() = id);

-- Internal user đọc được profile cùng tenant
create policy "profiles_tenant_read" on public.profiles
  for select using (
    tenant_id = (select tenant_id from public.profiles p2 where p2.id = auth.uid())
    and (select job_role from public.profiles p2 where p2.id = auth.uid())
        not in ('ntp', 'chu_dau_tu')
  );

-- Portal user chỉ thấy profile của project được gán (để xem tên PM, CHT)
create policy "profiles_portal_read" on public.profiles
  for select using (
    (select job_role from public.profiles p2 where p2.id = auth.uid())
      in ('ntp', 'chu_dau_tu')
    and id in (
      select pm.user_id from public.project_members pm
      where pm.project_id = any(
        select unnest(project_ids)::uuid
        from public.profiles p3 where p3.id = auth.uid()
      )
    )
  );


-- ═══════════════════════════════════════════════════════════
-- Verify S18:
-- -- NTP test: connect as ntp user, should only see assigned project
-- select project_id, collection from public.project_data limit 5;
-- -- CĐT test: should NOT see hr_employees, mp_payroll
-- select collection from public.project_data where collection in ('hr_employees','mp_payroll');
