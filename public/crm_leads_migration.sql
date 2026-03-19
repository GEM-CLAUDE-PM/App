-- ═══════════════════════════════════════════════════════════
-- CRM Leads table — GEM & CLAUDE PM Pro
-- Chạy trong Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

create table if not exists public.crm_leads (
  -- Meta
  id                uuid default gen_random_uuid() primary key,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),

  -- A. Tiếp cận
  ma_kh             text,                    -- KH001, KH002...
  ngay_tiep_can     date default current_date,
  kenh              text,                    -- Referral/LinkedIn/Google/Sự kiện/Khác
  tu_van_vien       text,
  giai_doan         text default 'Cold',     -- Cold/Warm/Hot/Negotiation/Won/Lost
  xac_suat_chot     integer default 10,      -- %

  -- B. Thông tin công ty
  ten_cong_ty       text not null,
  dia_chi           text,
  ma_so_thue        text,
  website           text,
  linh_vuc          text,                    -- Dân dụng/CN/Hạ tầng/Chuyên ngành
  quy_mo_nv         text,                    -- <50/50-200/200-500/>500

  -- C. Đại diện
  ho_ten_dd         text,
  chuc_vu_dd        text,
  dien_thoai        text,
  email             text,
  zalo              text,

  -- D. Qualify
  so_da             text,                    -- 1/2-5/5-10/>10
  quy_mo_da         text,                    -- <50 tỷ/...
  so_nv_ql          text,                    -- <10/10-30/...
  pm_hien_tai       text,                    -- Excel/MS Project/Khác/Chưa có
  pain_point        text,
  ngan_sach         text,                    -- <1M/1-3M/3-10M/>10M
  timeline_mua      text,
  decision_maker    text,

  -- E. Gói & Hợp đồng
  goi_de_xuat       text,                    -- Starter/Pro/Enterprise
  goi_ky            text,
  chu_ky_tt         text,                    -- Hàng tháng/Hàng năm
  so_hd             text,
  ngay_ky           date,
  ngay_bd_dv        date,
  ngay_kt           date,
  so_da_hd          integer,
  so_seats          integer,
  dung_luong        text,

  -- F. Tài chính
  gia_dv            bigint,                  -- VNĐ
  phi_setup         bigint default 0,
  tong_hd           bigint,
  phuong_thuc_tt    text,

  -- G. Follow-up
  thach_thuc        text,
  muc_tieu          text,
  ghi_chu           text,
  followup_date     date,
  trang_thai        text default 'Active'    -- Active/Closed Won/Closed Lost/On hold
);

-- RLS: public insert (sales form không cần login), admin read all
alter table public.crm_leads enable row level security;

-- Ai cũng insert được (sales form public)
create policy "crm_leads_public_insert" on public.crm_leads
  for insert with check (true);

-- Chỉ authenticated user (admin trong app) mới đọc được
create policy "crm_leads_auth_read" on public.crm_leads
  for select using (auth.role() = 'authenticated');

-- Chỉ authenticated mới update/delete
create policy "crm_leads_auth_update" on public.crm_leads
  for update using (auth.role() = 'authenticated');

create policy "crm_leads_auth_delete" on public.crm_leads
  for delete using (auth.role() = 'authenticated');

-- Auto update updated_at
create trigger crm_leads_touch
  before update on public.crm_leads
  for each row execute procedure touch_updated_at();

-- Auto generate ma_kh
create or replace function generate_ma_kh()
returns trigger as $$
declare
  seq integer;
begin
  select count(*) + 1 into seq from public.crm_leads;
  new.ma_kh := 'KH' || lpad(seq::text, 3, '0');
  return new;
end;
$$ language plpgsql;

create trigger crm_leads_ma_kh
  before insert on public.crm_leads
  for each row execute procedure generate_ma_kh();

-- Index
create index if not exists crm_leads_giai_doan on public.crm_leads(giai_doan);
create index if not exists crm_leads_trang_thai on public.crm_leads(trang_thai);
create index if not exists crm_leads_tu_van_vien on public.crm_leads(tu_van_vien);

select 'crm_leads table created ✅' as status;
