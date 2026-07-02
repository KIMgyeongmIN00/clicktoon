-- 0008 — 생성 종류(kind) 추가: 'pose'(포즈 전이) | 'concept'(단일 이미지 컨셉아트)
alter table public.generations
  add column if not exists kind text not null default 'pose'
    check (kind in ('pose', 'concept'));

-- enqueue_generation에 p_kind 파라미터 추가.
-- 파라미터 추가는 함수 시그니처 변경(=신규 오버로드)이므로, 기존 8-파라미터 함수를 DROP하고
-- 9-파라미터로 재생성한 뒤 권한을 다시 잠근다(0006의 회수는 옛 시그니처에만 적용됨).
drop function if exists
  public.enqueue_generation(uuid, text, jsonb, text, text, text, uuid, int);

create or replace function public.enqueue_generation(
  p_character_id uuid,
  p_provider text,
  p_pose jsonb,
  p_render_path text,
  p_extra_prompt text default null,
  p_idempotency_key text default null,
  p_owner uuid default null,
  p_cost int default 0,
  p_kind text default 'pose'
) returns uuid
language plpgsql security definer set search_path = public as $$
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
    (character_id, provider, pose, render_path, extra_prompt,
     idempotency_key, owner, status, kind)
  values
    (p_character_id, p_provider, p_pose, p_render_path, p_extra_prompt,
     p_idempotency_key, p_owner, 'queued', p_kind)
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

-- 신규 시그니처 권한 잠금 — service_role만.
revoke execute on function
  public.enqueue_generation(uuid, text, jsonb, text, text, text, uuid, int, text)
  from public, anon, authenticated;
grant execute on function
  public.enqueue_generation(uuid, text, jsonb, text, text, text, uuid, int, text)
  to service_role;
