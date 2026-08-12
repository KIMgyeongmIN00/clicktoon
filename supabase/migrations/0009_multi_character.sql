-- 0009 — 멀티 캐릭터 장면
-- 한 장면(= generations 행)에 캐릭터가 여러 명 등장할 수 있다.
-- generations.character_id는 "대표 캐릭터"로 유지한다(결과/렌더 스토리지 경로의
-- prefix, 갤러리 대표 이름) — 기존 경로와 쿼리를 깨지 않기 위함.
-- 등장인물 전체는 조인 테이블로 뺀다. 0007 character_assets와 같은 패턴.

create table if not exists public.generation_characters (
  generation_id uuid not null references public.generations(id) on delete cascade,
  character_id  uuid not null references public.characters(id)  on delete cascade,
  owner uuid, -- 스코핑/RLS용 (generations.owner와 동일, 비정규화)
  -- 0-based. 프롬프트의 [IMAGE n] 번호는 sort + 1이다.
  sort int not null default 0,
  primary key (generation_id, character_id)
);
create index if not exists generation_characters_character_idx
  on public.generation_characters(character_id, sort);
create index if not exists generation_characters_owner_idx
  on public.generation_characters(owner);

alter table public.generation_characters enable row level security;
-- 본인 것만 read (서버는 service-role로 RLS 우회). 쓰기는 service-role만.
drop policy if exists generation_characters_select_own on public.generation_characters;
create policy generation_characters_select_own on public.generation_characters
  for select using (auth.uid() = owner);

-- 캡처 시점 각 마네킹의 화면 위치(정규화 좌표 + 카메라 거리).
-- 프롬프트에서 "왼쪽 마네킹 = [IMAGE 1]"을 만드는 근거이며, 재시도/reaper
-- 경로에서 동일한 프롬프트를 재구성하려면 반드시 보존돼야 한다.
alter table public.generations
  add column if not exists figure_layout jsonb;

-- 기존 행 백필 — 등장인물 1명(대표 캐릭터).
insert into public.generation_characters (generation_id, character_id, owner, sort)
  select g.id, g.character_id, g.owner, 0
  from public.generations g
  on conflict do nothing;

-- enqueue_generation에 p_character_ids / p_figure_layout 추가.
-- 파라미터 추가는 시그니처 변경(= 신규 오버로드)이므로, 기존 9-파라미터 함수를
-- DROP하고 11-파라미터로 재생성한 뒤 권한을 다시 잠근다(0008과 동일한 이유).
drop function if exists
  public.enqueue_generation(uuid, text, jsonb, text, text, text, uuid, int, text);

create or replace function public.enqueue_generation(
  p_character_id uuid,
  p_provider text,
  p_pose jsonb,
  p_render_path text,
  p_extra_prompt text default null,
  p_idempotency_key text default null,
  p_owner uuid default null,
  p_cost int default 0,
  p_kind text default 'pose',
  p_character_ids uuid[] default null,
  p_figure_layout jsonb default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_bal int; v_ids uuid[];
begin
  if p_cost < 0 then raise exception 'INVALID_COST'; end if;
  if p_idempotency_key is not null then
    select id into v_id from public.generations
      where idempotency_key = p_idempotency_key limit 1;
    -- 멱등 재요청: 조인 행도 이미 들어가 있으므로 그대로 반환한다.
    if v_id is not null then return v_id; end if;
  end if;
  if p_owner is not null and p_cost > 0 then
    select balance into v_bal from public.wallets where user_id = p_owner for update;
    if v_bal is null then raise exception 'NO_WALLET'; end if;
    if v_bal < p_cost then raise exception 'INSUFFICIENT_CREDITS'; end if;
  end if;

  insert into public.generations
    (character_id, provider, pose, render_path, extra_prompt,
     idempotency_key, owner, status, kind, figure_layout)
  values
    (p_character_id, p_provider, p_pose, p_render_path, p_extra_prompt,
     p_idempotency_key, p_owner, 'queued', p_kind, p_figure_layout)
  returning id into v_id;

  -- 등장인물. 미지정이면 대표 캐릭터 1명만 넣는다(구 호출 호환).
  -- 같은 캐릭터가 두 피규어를 연기할 수 있으므로 중복은 접어서 넣고,
  -- sort는 처음 등장한 순서를 쓴다.
  v_ids := coalesce(p_character_ids, array[p_character_id]);
  insert into public.generation_characters (generation_id, character_id, owner, sort)
    select v_id, t.id, p_owner, (min(t.ord) - 1)::int
    from unnest(v_ids) with ordinality as t(id, ord)
    where t.id is not null
    group by t.id
  on conflict (generation_id, character_id) do nothing;

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
  public.enqueue_generation(uuid, text, jsonb, text, text, text, uuid, int, text, uuid[], jsonb)
  from public, anon, authenticated;
grant execute on function
  public.enqueue_generation(uuid, text, jsonb, text, text, text, uuid, int, text, uuid[], jsonb)
  to service_role;
