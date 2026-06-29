-- 0007 — 캐릭터 멀티뷰/추가자료 자산
-- 정면/옆면/뒷면 + 추가 세부자료를 캐릭터당 여러 장 저장. characters.ref_path는
-- primary(정면) 포인터로 유지해 기존 생성 파이프라인은 그대로 동작.

create table if not exists public.character_assets (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  owner uuid not null, -- 스코핑/RLS용 (characters.owner와 동일, 비정규화)
  kind text not null check (kind in ('front', 'side', 'back', 'extra')),
  path text not null,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists character_assets_char_idx
  on public.character_assets(character_id, kind, sort);
create index if not exists character_assets_owner_idx
  on public.character_assets(owner);

alter table public.character_assets enable row level security;
-- 본인 것만 read (서버는 service-role로 RLS 우회). 쓰기는 service-role만.
drop policy if exists character_assets_select_own on public.character_assets;
create policy character_assets_select_own on public.character_assets
  for select using (auth.uid() = owner);
