-- 0002 — 비동기 생성 파이프라인 (Phase A)
-- generations를 enqueue→처리→완료 상태기계로 전환 + 트랜잭션 outbox.
-- Run via Supabase Dashboard SQL editor or `supabase db push`.

-- ── generations: 결과는 완료 시 채워지므로 nullable화 + 상태/입력/메타 컬럼 추가 ──
alter table public.generations
  alter column result_path drop not null,
  alter column model drop not null,
  alter column prompt drop not null,
  add column if not exists status text not null default 'queued'
    check (status in ('queued','processing','done','failed')),
  add column if not exists error_message text,
  add column if not exists owner uuid,
  add column if not exists idempotency_key text,
  add column if not exists render_path text,      -- 입력 포즈 렌더 (renders 버킷)
  add column if not exists extra_prompt text,
  add column if not exists attempts int not null default 0,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists generations_idem_key_uidx
  on public.generations(idempotency_key) where idempotency_key is not null;
create index if not exists generations_status_idx
  on public.generations(status, updated_at);
create index if not exists generations_owner_idx
  on public.generations(owner, created_at desc);

-- ── 트랜잭션 outbox: enqueue를 row 생성과 원자적으로 ──
create table if not exists public.job_outbox (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.generations(id) on delete cascade,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists job_outbox_pending_idx
  on public.job_outbox(status, created_at) where status = 'pending';
alter table public.job_outbox enable row level security;  -- 서버(service role)만 접근

-- ── renders 버킷 (입력 포즈 렌더, 비공개) ──
insert into storage.buckets (id, name, public)
values ('renders', 'renders', false) on conflict (id) do nothing;

-- ── 원자적 enqueue: generations(queued) + job_outbox(pending) 한 트랜잭션 ──
-- idempotency_key가 이미 있으면 기존 generation id를 반환(중복 enqueue 방지).
create or replace function public.enqueue_generation(
  p_character_id uuid,
  p_provider text,
  p_pose jsonb,
  p_render_path text,
  p_extra_prompt text default null,
  p_idempotency_key text default null,
  p_owner uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_idempotency_key is not null then
    select id into v_id from public.generations
      where idempotency_key = p_idempotency_key limit 1;
    if v_id is not null then
      return v_id;
    end if;
  end if;

  insert into public.generations
    (character_id, provider, pose, render_path, extra_prompt, idempotency_key, owner, status)
  values
    (p_character_id, p_provider, p_pose, p_render_path, p_extra_prompt,
     p_idempotency_key, p_owner, 'queued')
  returning id into v_id;

  insert into public.job_outbox (generation_id, payload)
  values (v_id, jsonb_build_object('generationId', v_id));

  return v_id;
end;
$$;
