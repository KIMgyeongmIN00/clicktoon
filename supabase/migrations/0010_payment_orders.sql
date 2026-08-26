-- 0010 — 결제 주문 (계정별 결제)
--
-- 결제 금액은 브라우저에서 requestPayment()로 넘어가므로 조작될 수 있다. 지금까지는
-- 승인 직전에 하드코딩된 팩 가격과만 대조했는데, 그러면 "누가 무엇을 얼마에 주문했는지"가
-- 서버에 남지 않는다. 결제창을 열기 전에 서버가 주문을 만들어 두고, 승인 때 그 주문과
-- 대조하는 방식으로 바꾼다.

create table if not exists public.payment_orders (
  -- 토스에 넘기는 주문번호. 서버가 발급하고 승인 때 이 값으로 되찾는다.
  order_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  pack_id text not null,
  amount int not null check (amount > 0),      -- KRW, 결제 요청 금액
  credits int not null default 0,              -- 승인 시 적립할 크레딧
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'canceled')),
  -- 승인 결과
  payment_key text,
  method text,
  approved_at timestamptz,
  fail_code text,
  fail_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_orders_user_idx
  on public.payment_orders(user_id, created_at desc);
-- 같은 결제건이 두 주문에 붙지 않도록. 승인 재시도의 멱등성도 여기서 잡힌다.
create unique index if not exists payment_orders_payment_key_idx
  on public.payment_orders(payment_key) where payment_key is not null;

alter table public.payment_orders enable row level security;
-- 본인 주문만 read (서버는 service-role로 RLS 우회). 쓰기 정책 없음 → service-role만.
drop policy if exists payment_orders_select_own on public.payment_orders;
create policy payment_orders_select_own on public.payment_orders
  for select using (auth.uid() = user_id);
