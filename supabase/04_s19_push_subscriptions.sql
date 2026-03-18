-- ════════════════════════════════════════
-- S19 — Push notification subscriptions
-- Chạy theo thứ tự: 04_s19_push_subscriptions.sql
-- ════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════
-- S19 MIGRATIONS — Push Notification subscriptions
-- ═══════════════════════════════════════════════════════════

-- M-20. push_subscriptions — lưu Web Push token của từng user/device
create table if not exists public.push_subscriptions (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references auth.users on delete cascade not null unique,
  subscription jsonb not null,          -- PushSubscription JSON (endpoint + keys)
  user_agent   text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
alter table public.push_subscriptions enable row level security;

-- User chỉ đọc/ghi subscription của mình
create policy "push_sub_self" on public.push_subscriptions
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Server (service_role) đọc tất cả để gửi push
-- Không cần policy cho service_role — nó bypass RLS

drop trigger if exists push_sub_touch on public.push_subscriptions;
create trigger push_sub_touch
  before update on public.push_subscriptions
  for each row execute procedure touch_updated_at();

-- ═══════════════════════════════════════════════════════════
-- Verify S19:
-- select user_id, user_agent, updated_at from public.push_subscriptions limit 5;
-- ═══════════════════════════════════════════════════════════
