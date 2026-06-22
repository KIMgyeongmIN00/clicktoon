-- 0004 — 서버 크레딧 (Phase C2)
-- wallets/credit_ledger + 가입 시 지갑 자동생성 트리거 + 원자적 RPC(예약 차감/충전/환불).

create table if not exists public.wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance int not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delta int not null,
  reason text not null check (reason in ('topup', 'generation', 'refund', 'adjust')),
  ref text,
  created_at timestamptz not null default now(),
  unique (reason, ref) -- 멱등: 같은 결제/생성 중복 적립·차감·환불 방지
);
create index if not exists credit_ledger_user_idx
  on public.credit_ledger(user_id, created_at desc);

alter table public.wallets enable row level security;
alter table public.credit_ledger enable row level security;

-- 본인 것만 read (서버는 service-role로 RLS 우회). 쓰기 정책 없음 → service-role만.
drop policy if exists wallets_select_own on public.wallets;
create policy wallets_select_own on public.wallets
  for select using (auth.uid() = user_id);
drop policy if exists ledger_select_own on public.credit_ledger;
create policy ledger_select_own on public.credit_ledger
  for select using (auth.uid() = user_id);

-- per-user 읽기 정책 (owner=null 데모는 자동 숨김 — 클라/Realtime용; 라우트는 service-role+owner필터)
drop policy if exists generations_select_own on public.generations;
create policy generations_select_own on public.generations
  for select using (auth.uid() = owner);
drop policy if exists characters_select_own on public.characters;
create policy characters_select_own on public.characters
  for select using (auth.uid() = owner);

-- 가입 시 지갑 자동 생성
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.wallets(user_id) values (new.id) on conflict do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 충전 (멱등: ref=paymentKey)
create or replace function public.credit_topup(p_user uuid, p_amount int, p_ref text)
returns int language plpgsql security definer set search_path = public as $$
declare v_bal int;
begin
  insert into public.credit_ledger(user_id, delta, reason, ref)
    values (p_user, p_amount, 'topup', p_ref);
  insert into public.wallets(user_id, balance) values (p_user, p_amount)
    on conflict (user_id) do update
      set balance = wallets.balance + p_amount, updated_at = now()
    returning balance into v_bal;
  return v_bal;
exception when unique_violation then
  -- 이미 처리된 결제 → 현재 잔액 반환 (멱등)
  select balance into v_bal from public.wallets where user_id = p_user;
  return coalesce(v_bal, 0);
end; $$;

-- 환불 (generation_id의 'generation' 차감액을 찾아 환불; 이중환불 방지)
create or replace function public.credit_refund(p_generation uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_amount int;
begin
  select user_id, -delta into v_user, v_amount from public.credit_ledger
    where reason = 'generation' and ref = p_generation::text limit 1;
  if v_user is null then return; end if; -- 예약 차감 없음
  insert into public.credit_ledger(user_id, delta, reason, ref)
    values (v_user, v_amount, 'refund', p_generation::text);
  update public.wallets set balance = balance + v_amount, updated_at = now()
    where user_id = v_user;
exception when unique_violation then
  return; -- 이미 환불됨
end; $$;

-- enqueue_generation 확장: 예약 차감 포함 (잔액 부족 시 예외 → 라우트 402)
create or replace function public.enqueue_generation(
  p_character_id uuid,
  p_provider text,
  p_pose jsonb,
  p_render_path text,
  p_extra_prompt text default null,
  p_idempotency_key text default null,
  p_owner uuid default null,
  p_cost int default 0
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_bal int;
begin
  if p_idempotency_key is not null then
    select id into v_id from public.generations
      where idempotency_key = p_idempotency_key limit 1;
    if v_id is not null then return v_id; end if;
  end if;

  -- 예약 차감 (로그인 + 비용 있을 때만)
  if p_owner is not null and p_cost > 0 then
    select balance into v_bal from public.wallets where user_id = p_owner for update;
    if v_bal is null then raise exception 'NO_WALLET'; end if;
    if v_bal < p_cost then raise exception 'INSUFFICIENT_CREDITS'; end if;
  end if;

  insert into public.generations
    (character_id, provider, pose, render_path, extra_prompt, idempotency_key, owner, status)
  values
    (p_character_id, p_provider, p_pose, p_render_path, p_extra_prompt,
     p_idempotency_key, p_owner, 'queued')
  returning id into v_id;

  insert into public.job_outbox (generation_id, payload)
  values (v_id, jsonb_build_object('generationId', v_id));

  if p_owner is not null and p_cost > 0 then
    insert into public.credit_ledger(user_id, delta, reason, ref)
      values (p_owner, -p_cost, 'generation', v_id::text);
    update public.wallets set balance = balance - p_cost, updated_at = now()
      where user_id = p_owner;
  end if;

  return v_id;
end; $$;
