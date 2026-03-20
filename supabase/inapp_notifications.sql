-- S30: In-App Notifications table
-- Lưu thông báo gửi cho từng user cụ thể

create table if not exists public.inapp_notifications (
  id           uuid default gen_random_uuid() primary key,
  recipient_id uuid references auth.users on delete cascade not null,
  sender_name  text not null default 'GEM PM Pro',
  title        text,
  message      text not null,
  category     text default 'general',  -- general | urgent | info
  is_read      boolean default false,
  created_at   timestamptz default now()
);

-- Index để query nhanh theo recipient
create index if not exists idx_inapp_notif_recipient 
  on public.inapp_notifications(recipient_id, is_read, created_at desc);

-- RLS: user chỉ thấy notification của mình
alter table public.inapp_notifications enable row level security;

create policy "inapp_read_own" on public.inapp_notifications
  for select using (auth.uid() = recipient_id);

create policy "inapp_insert_admin" on public.inapp_notifications
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and tier = 'admin')
  );

create policy "inapp_update_own" on public.inapp_notifications
  for update using (auth.uid() = recipient_id);
