-- 승인 확정과 이용 횟수 지급을 한 트랜잭션으로 처리한다.
create or replace function public.complete_inicis_review(p_order_id text, p_payment_key text)
returns integer language plpgsql security definer set search_path = public as $$
declare v_order public.payment_orders%rowtype; v_balance integer;
begin
  if p_payment_key is null or p_payment_key = '' then raise exception 'INVALID_PAYMENT_KEY'; end if;
  select * into v_order from public.payment_orders where order_id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status = 'paid' and v_order.payment_key = p_payment_key then
    select balance into v_balance from public.wallets where user_id = v_order.user_id;
    return coalesce(v_balance, 0);
  end if;
  if v_order.status <> 'failed' or v_order.fail_code is distinct from 'INICIS_REVIEW_APPROVING'
    or not ((v_order.pack_id = 'inicis-review-basic' and v_order.amount = 170000 and v_order.credits = 50)
         or (v_order.pack_id = 'inicis-review-pro' and v_order.amount = 320000 and v_order.credits = 200)
         or (v_order.pack_id = 'inicis-review-premium' and v_order.amount = 500000 and v_order.credits = 312))
  then raise exception 'INVALID_REVIEW_ORDER'; end if;
  v_balance := public.credit_topup(v_order.user_id, v_order.credits, v_order.order_id);
  update public.payment_orders set status = 'paid', payment_key = p_payment_key,
    method = 'INICIS_TEST_CARD', fail_code = null, approved_at = now(), updated_at = now()
    where order_id = p_order_id;
  return v_balance;
end; $$;
revoke execute on function public.complete_inicis_review(text, text) from public, anon, authenticated;
grant execute on function public.complete_inicis_review(text, text) to service_role;

-- 무료 사용 여부와 유료 잔액 차감을 사용자별 잠금 안에서 결정한다.
create or replace function public.enqueue_metered_generation(
  p_character_id uuid, p_provider text, p_pose jsonb, p_render_path text,
  p_extra_prompt text, p_idempotency_key text, p_owner uuid, p_kind text,
  p_character_ids uuid[] default null, p_figure_layout jsonb default null,
  p_unlimited boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_used integer; v_limit integer; v_cost integer := 0;
begin
  if p_owner is null or p_kind not in ('pose', 'concept') then raise exception 'INVALID_GENERATION'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text, 0));
  if p_idempotency_key is not null then
    select id into v_id from public.generations where idempotency_key = p_idempotency_key and owner = p_owner;
    if v_id is not null then return v_id; end if;
  end if;
  if not p_unlimited then
    v_limit := case when p_kind = 'pose' then 2 else 1 end;
    select count(*) into v_used from public.generations where owner = p_owner and kind = p_kind and status <> 'failed';
    if v_used >= v_limit then v_cost := 1; end if;
  end if;
  return public.enqueue_generation(p_character_id, p_provider, p_pose, p_render_path,
    p_extra_prompt, p_idempotency_key, p_owner, v_cost, p_kind, p_character_ids, p_figure_layout);
end; $$;
revoke execute on function public.enqueue_metered_generation(uuid,text,jsonb,text,text,text,uuid,text,uuid[],jsonb,boolean) from public, anon, authenticated;
grant execute on function public.enqueue_metered_generation(uuid,text,jsonb,text,text,text,uuid,text,uuid[],jsonb,boolean) to service_role;
