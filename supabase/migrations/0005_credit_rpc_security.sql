-- 0005 — 크레딧 RPC 보안 강화 (보안 리뷰 #4, #5)
-- (1) [Critical] 기본 PostgREST가 public 스키마 함수를 anon/authenticated에 노출함 →
--     로그인 유저가 credit_topup을 RPC로 직접 호출해 무한 크레딧 발행 가능.
--     → public(=anon/authenticated 포함) 실행 권한 회수, service_role만 허용.
-- (2) [방어] 음수 금액 가드 추가.

-- ── (2) 음수 가드 포함 재정의 ──
create or replace function public.credit_topup(p_user uuid, p_amount int, p_ref text)
returns int language plpgsql security definer set search_path = public as $$
declare v_bal int;
begin
  if p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  insert into public.credit_ledger(user_id, delta, reason, ref)
    values (p_user, p_amount, 'topup', p_ref);
  insert into public.wallets(user_id, balance) values (p_user, p_amount)
    on conflict (user_id) do update
      set balance = wallets.balance + p_amount, updated_at = now()
    returning balance into v_bal;
  return v_bal;
exception when unique_violation then
  select balance into v_bal from public.wallets where user_id = p_user;
  return coalesce(v_bal, 0);
end; $$;

create or replace function public.enqueue_generation(
  p_character_id uuid, p_provider text, p_pose jsonb, p_render_path text,
  p_extra_prompt text default null, p_idempotency_key text default null,
  p_owner uuid default null, p_cost int default 0
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_bal int;
begin
  if p_cost < 0 then raise exception 'INVALID_COST'; end if;
  if p_idempotency_key is not null then
    select id into v_id from public.generations
      where idempotency_key = p_idempotency_key limit 1;
    if v_id is not null then return v_id; end if;
  end if;
  if p_owner is not null and p_cost > 0 then
    select balance into v_bal from public.wallets where user_id = p_owner for update;
    if v_bal is null then raise exception 'NO_WALLET'; end if;
    if v_bal < p_cost then raise exception 'INSUFFICIENT_CREDITS'; end if;
  end if;
  insert into public.generations
    (character_id, provider, pose, render_path, extra_prompt, idempotency_key, owner, status)
  values (p_character_id, p_provider, p_pose, p_render_path, p_extra_prompt,
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

-- ── (1) 직접 호출 차단 — service_role만 ──
revoke execute on function public.credit_topup(uuid, int, text) from public;
grant execute on function public.credit_topup(uuid, int, text) to service_role;

revoke execute on function public.credit_refund(uuid) from public;
grant execute on function public.credit_refund(uuid) to service_role;

revoke execute on function
  public.enqueue_generation(uuid, text, jsonb, text, text, text, uuid, int) from public;
grant execute on function
  public.enqueue_generation(uuid, text, jsonb, text, text, text, uuid, int) to service_role;

revoke execute on function public.handle_new_user() from public;
