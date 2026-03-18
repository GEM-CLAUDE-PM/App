-- ══════════════════════════════════════════════════════════════════════════
-- GEM & CLAUDE PM Pro — Migration: Roles v3.0
-- Chạy trong Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ══════════════════════════════════════════════════════════════════════════
--
-- Mục đích:
--   1. Tạo enum type job_role_enum với 24 roles nội bộ + 2 external portal
--   2. Đổi cột job_role trên bảng profiles từ text → enum (có validation)
--   3. Cập nhật trigger tự động tính tier từ job_role
--   4. Cập nhật dữ liệu cũ (old role names → new role names)
--
-- SAO LƯU trước khi chạy:
--   select * from profiles;  -- copy kết quả ra ngoài
-- ══════════════════════════════════════════════════════════════════════════

-- ─── BƯỚC 1: Cập nhật dữ liệu cũ (old names → new names) ─────────────────
-- Chạy TRƯỚC khi đổi kiểu cột

update public.profiles set job_role = 'ke_toan_truong' where job_role = 'ke_toan';
update public.profiles set job_role = 'truong_qs'      where job_role = 'qs';
update public.profiles set job_role = 'truong_qaqc'    where job_role = 'qa_qc';
update public.profiles set job_role = 'truong_hse'     where job_role = 'hse';
update public.profiles set job_role = 'hr_truong'      where job_role = 'hr';
update public.profiles set job_role = 'thu_ky_site'    where job_role = 'thu_ky';
update public.profiles set job_role = 'chi_huy_pho'    where job_role = 'chi_huy_pho'; -- giữ nguyên
-- tvgs → external, chuyển tạm sang ks_giam_sat cho đến khi có portal
update public.profiles set job_role = 'ks_giam_sat'    where job_role = 'tvgs';

-- ─── BƯỚC 2: Tạo enum type ────────────────────────────────────────────────

do $$ begin
  if not exists (select 1 from pg_type where typname = 'job_role_enum') then
    create type public.job_role_enum as enum (
      -- L5
      'giam_doc',
      -- L4
      'pm',
      'ke_toan_truong',
      -- L3 HO
      'truong_qs',
      'truong_qaqc',
      'truong_hse',
      'hr_truong',
      -- L3 Site
      'chi_huy_truong',
      'chi_huy_pho',
      -- L2
      'qs_site',
      'qaqc_site',
      'ks_giam_sat',
      'hse_site',
      'ke_toan_site',
      'ke_toan_kho',
      'hr_site',
      -- L1 nội bộ
      'thu_kho',
      'thu_ky_site',
      'operator',
      -- L1 nhân công / nhà thầu (app rút gọn)
      'ntp_site',
      'to_doi',
      'ky_thuat_vien',
      -- External portals
      'ntp',
      'chu_dau_tu'
    );
    raise notice 'Created enum job_role_enum';
  else
    raise notice 'Enum job_role_enum already exists — skipping';
  end if;
end $$;

-- ─── BƯỚC 3: Đổi cột job_role sang enum ──────────────────────────────────

alter table public.profiles
  alter column job_role type public.job_role_enum
  using job_role::public.job_role_enum;

-- ─── BƯỚC 4: Cập nhật trigger tính tier từ job_role ──────────────────────

create or replace function public.compute_tier_from_role()
returns trigger language plpgsql as $$
begin
  new.tier := case new.job_role
    -- admin tier: L5 + L4
    when 'giam_doc'       then 'admin'
    when 'pm'             then 'admin'
    when 'ke_toan_truong' then 'admin'
    -- manager tier: L3 + L2
    when 'truong_qs'      then 'manager'
    when 'truong_qaqc'    then 'manager'
    when 'truong_hse'     then 'manager'
    when 'hr_truong'      then 'manager'
    when 'chi_huy_truong' then 'manager'
    when 'chi_huy_pho'    then 'manager'
    when 'qs_site'        then 'manager'
    when 'qaqc_site'      then 'manager'
    when 'ks_giam_sat'    then 'manager'
    when 'hse_site'       then 'manager'
    when 'ke_toan_site'   then 'manager'
    when 'ke_toan_kho'    then 'manager'
    when 'hr_site'        then 'manager'
    -- worker tier: L1 + external
    else 'worker'
  end;
  return new;
end;
$$;

-- Gán trigger vào profiles (drop cũ nếu có)
drop trigger if exists set_tier_from_role on public.profiles;
create trigger set_tier_from_role
  before insert or update of job_role on public.profiles
  for each row execute procedure public.compute_tier_from_role();

-- Chạy trigger cho tất cả rows hiện có
update public.profiles set job_role = job_role;

-- ─── BƯỚC 5: Kiểm tra kết quả ─────────────────────────────────────────────

select
  email,
  job_role,
  tier,
  array_length(project_ids, 1) as num_projects
from public.profiles
order by
  case tier
    when 'admin'   then 1
    when 'manager' then 2
    when 'worker'  then 3
  end,
  job_role;

-- ══════════════════════════════════════════════════════════════════════════
-- THÊM ROLE MỚI TRONG TƯƠNG LAI:
-- alter type public.job_role_enum add value 'ten_role_moi';
-- (Postgres không cho xóa value khỏi enum — phải recreate nếu cần xóa)
-- ══════════════════════════════════════════════════════════════════════════
