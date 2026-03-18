-- ══════════════════════════════════════════════════════════════════════════
-- GEM & CLAUDE PM Pro — Migration: Roles v3.0 (fixed)
-- ══════════════════════════════════════════════════════════════════════════

-- ─── BƯỚC 1: Cập nhật data cũ → tên mới ──────────────────────────────────
update public.profiles set job_role = 'ke_toan_truong' where job_role = 'ke_toan';
update public.profiles set job_role = 'truong_qs'      where job_role = 'qs';
update public.profiles set job_role = 'truong_qaqc'    where job_role = 'qa_qc';
update public.profiles set job_role = 'truong_hse'     where job_role = 'hse';
update public.profiles set job_role = 'hr_truong'      where job_role = 'hr';
update public.profiles set job_role = 'thu_ky_site'    where job_role = 'thu_ky';
update public.profiles set job_role = 'ks_giam_sat'    where job_role = 'tvgs';

-- ─── BƯỚC 2: Tạo enum ─────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'job_role_enum') then
    create type public.job_role_enum as enum (
      'giam_doc',
      'pm', 'ke_toan_truong',
      'truong_qs', 'truong_qaqc', 'truong_hse', 'hr_truong',
      'chi_huy_truong', 'chi_huy_pho',
      'qs_site', 'qaqc_site', 'ks_giam_sat', 'hse_site',
      'ke_toan_site', 'ke_toan_kho', 'hr_site',
      'thu_kho', 'thu_ky_site', 'operator',
      'ntp_site', 'to_doi', 'ky_thuat_vien',
      'ntp', 'chu_dau_tu'
    );
  end if;
end $$;

-- ─── BƯỚC 3: Drop default → alter type → set default mới ─────────────────
alter table public.profiles alter column job_role drop default;

alter table public.profiles
  alter column job_role type public.job_role_enum
  using job_role::public.job_role_enum;

alter table public.profiles
  alter column job_role set default 'ks_giam_sat'::public.job_role_enum;

-- ─── BƯỚC 4: Trigger tự tính tier ────────────────────────────────────────
create or replace function public.compute_tier_from_role()
returns trigger language plpgsql as $$
begin
  new.tier := case new.job_role
    when 'giam_doc'       then 'admin'
    when 'pm'             then 'admin'
    when 'ke_toan_truong' then 'admin'
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
    else 'worker'
  end;
  return new;
end;
$$;

drop trigger if exists set_tier_from_role on public.profiles;
create trigger set_tier_from_role
  before insert or update of job_role on public.profiles
  for each row execute procedure public.compute_tier_from_role();

-- Apply trigger cho data hiện có
update public.profiles set job_role = job_role;

-- ─── BƯỚC 5: Kiểm tra ────────────────────────────────────────────────────
select email, job_role, tier
from public.profiles
order by case tier when 'admin' then 1 when 'manager' then 2 else 3 end, job_role;
