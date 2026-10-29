-- Runs against the linked database in a transaction that always rolls back.
begin;
do $$
declare
  u uuid; c uuid; g uuid; duplicate_g uuid; balance_before integer; result integer; order_id text;
begin
  select id into u from auth.users where email = 'clicktoon-pg-review@inicis.com';
  if u is null then raise exception 'Review account not found'; end if;
  if exists(select 1 from public.generations where owner = u and status <> 'failed') then
    raise exception 'Review account already has generations; refusing state-dependent test';
  end if;
  select balance into balance_before from public.wallets where user_id = u;
  balance_before := coalesce(balance_before, 0);
  order_id := 'verification_' || gen_random_uuid()::text;
  insert into public.payment_orders(order_id,user_id,pack_id,amount,credits,status,fail_code)
    values (order_id,u,'inicis-review-basic',170000,50,'failed','INICIS_REVIEW_APPROVING');
  result := public.complete_inicis_review(order_id, order_id || '_payment');
  if result <> balance_before + 50 then raise exception 'Wrong credit grant'; end if;
  result := public.complete_inicis_review(order_id, order_id || '_payment');
  if result <> balance_before + 50 then raise exception 'Duplicate grant'; end if;
  insert into public.characters(owner,name,ref_path) values(u,'verification','verification') returning id into c;
  perform public.enqueue_metered_generation(c,'google','{}'::jsonb,null,null,order_id || '_1',u,'pose');
  perform public.enqueue_metered_generation(c,'google','{}'::jsonb,null,null,order_id || '_2',u,'pose');
  if (select balance from public.wallets where user_id = u) <> balance_before + 50 then raise exception 'Free usage was charged'; end if;
  g := public.enqueue_metered_generation(c,'google','{}'::jsonb,null,null,order_id || '_3',u,'pose');
  duplicate_g := public.enqueue_metered_generation(c,'google','{}'::jsonb,null,null,order_id || '_3',u,'pose');
  if g <> duplicate_g or (select balance from public.wallets where user_id = u) <> balance_before + 49 then raise exception 'Debit or idempotency failed'; end if;
  perform public.credit_refund(g);
  perform public.credit_refund(g);
  if (select balance from public.wallets where user_id = u) <> balance_before + 50 then raise exception 'Refund failed or duplicated'; end if;
end $$;
rollback;
