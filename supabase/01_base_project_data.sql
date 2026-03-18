-- ════════════════════════════════════════
-- S00 — Base: project_data table + RLS + triggers
-- Chạy theo thứ tự: 01_base_project_data.sql
-- ════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- GEM&CLAUDE PM Pro — Supabase Migration
-- Chạy trong: Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════

-- 1. Bảng chính lưu toàn bộ data của app (JSONB key-value)
create table if not exists public.project_data (
  id           bigint generated always as identity primary key,
  project_id   text not null,
  collection   text not null,
  payload      jsonb not null default '[]'::jsonb,
  updated_at   timestamptz default now(),
  updated_by   uuid references auth.users on delete set null,
  constraint project_data_uniq unique (project_id, collection)
);

-- 2. Row Level Security
alter table public.project_data enable row level security;

-- Authenticated users có thể đọc
create policy "project_data_read" on public.project_data
  for select using (auth.role() = 'authenticated');

-- Authenticated users có thể ghi (quyền chi tiết do app-layer xử lý)
create policy "project_data_write" on public.project_data
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 3. Index tăng tốc lookup
create index if not exists project_data_lookup
  on public.project_data (project_id, collection);

-- 4. Auto-update updated_at
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists project_data_touch on public.project_data;
create trigger project_data_touch
  before update on public.project_data
  for each row execute procedure touch_updated_at();

-- ═══════════════════════════════════════════════════════════
-- Verify: chạy câu này để kiểm tra bảng đã tạo thành công
-- select count(*) from public.project_data;
-- ═══════════════════════════════════════════════════════════


