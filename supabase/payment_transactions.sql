-- S30: Payment Transactions table
-- Lưu lịch sử giao dịch PayOS + Stripe

create table if not exists public.payment_transactions (
  id           uuid default gen_random_uuid() primary key,
  tenant_id    uuid references public.tenants on delete cascade,
  order_code   text not null,
  amount       bigint not null,            -- VNĐ
  description  text,
  buyer_email  text,
  status       text default 'pending',     -- pending | paid | failed | cancelled
  gateway      text default 'payos',       -- payos | stripe
  checkout_url text,
  tx_ref       text,                        -- PayOS reference / Stripe payment_intent
  raw_data     jsonb,
  paid_at      timestamptz,
  created_at   timestamptz default now()
);

-- Index
create index if not exists idx_payment_tenant
  on public.payment_transactions(tenant_id, created_at desc);
create index if not exists idx_payment_order
  on public.payment_transactions(order_code);

-- RLS: admin tenant thấy transactions của mình
alter table public.payment_transactions enable row level security;

create policy "payment_read_own" on public.payment_transactions
  for select using (
    tenant_id in (
      select tenant_id from public.profiles
      where id = auth.uid() and tier = 'admin'
    )
  );

-- Service role có thể insert/update (webhook dùng service role)
create policy "payment_service_write" on public.payment_transactions
  for all using (true)
  with check (true);
