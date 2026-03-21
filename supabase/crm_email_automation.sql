-- ═══════════════════════════════════════════════════════════════════
-- GEM & CLAUDE PM Pro — CRM Email Automation Setup
-- Chạy trong Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- 1. Bảng log email CRM
create table if not exists public.crm_email_logs (
  id          uuid default gen_random_uuid() primary key,
  type        text,         -- overdue_summary | reminder_summary | hot_lead_email
  to_email    text,
  lead_id     text,
  status      text,         -- sent | failed
  resend_id   text,
  error_msg   text,
  leads_count int default 1,
  sent_at     timestamptz default now()
);

-- Index để query log nhanh
create index if not exists idx_crm_email_logs_sent_at
  on public.crm_email_logs(sent_at desc);

-- RLS: service role write, admin read
alter table public.crm_email_logs enable row level security;

create policy "crm_email_logs_read" on public.crm_email_logs
  for select using (auth.role() = 'authenticated');

-- ═══════════════════════════════════════════════════════════════════
-- 2. Cron job — chạy 8:00 AM GMT+7 mỗi ngày (01:00 UTC)
-- QUAN TRỌNG: Thay <project-ref> và <anon-key> trước khi chạy
-- ═══════════════════════════════════════════════════════════════════

-- Bật extension pg_cron (chạy 1 lần)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Tạo cron job
select cron.schedule(
  'crm-daily-followup',
  '0 1 * * *',
  $$
  select net.http_post(
    url     := 'https://REPLACE_PROJECT_REF.supabase.co/functions/v1/crm-followup-scheduler',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer REPLACE_ANON_KEY'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Kiểm tra cron đã tạo chưa
select jobname, schedule, command from cron.job;

-- ═══════════════════════════════════════════════════════════════════
-- 3. Secrets cần thêm vào Supabase Dashboard → Settings → Secrets
-- ═══════════════════════════════════════════════════════════════════
-- RESEND_API_KEY    = re_xxxx          (đã có từ S30)
-- NOTIFY_EMAIL      = pat@email.com    (email anh Tuấn nhận thông báo)
-- APP_URL           = https://gemclaudepm.com

-- ═══════════════════════════════════════════════════════════════════
-- 4. Test thủ công (không cần đợi cron)
-- ═══════════════════════════════════════════════════════════════════
-- select net.http_post(
--   url     := 'https://REPLACE_PROJECT_REF.supabase.co/functions/v1/crm-followup-scheduler',
--   headers := '{"Content-Type":"application/json","Authorization":"Bearer REPLACE_ANON_KEY"}'::jsonb,
--   body    := '{}'::jsonb
-- );

-- Xem kết quả log sau khi test:
-- select * from public.crm_email_logs order by sent_at desc limit 10;
-- select * from cron.job_run_details order by start_time desc limit 5;
