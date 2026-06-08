-- Pose Toon — initial schema
-- Run via Supabase Dashboard SQL editor or `supabase db push`

create extension if not exists "pgcrypto";

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  owner uuid,
  name text not null,
  ref_path text not null,
  thumb_path text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists characters_owner_idx on public.characters(owner);
create index if not exists characters_created_idx on public.characters(created_at desc);

create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  provider text not null check (provider in ('google','openai')),
  model text not null,
  prompt text not null,
  pose jsonb not null,
  result_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists generations_char_idx
  on public.generations(character_id, created_at desc);

-- Storage buckets (private, accessed via service role + signed URLs)
insert into storage.buckets (id, name, public)
values ('refs', 'refs', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('results', 'results', false)
on conflict (id) do nothing;

-- RLS: locked down. All access goes through Route Handlers using the service role key.
alter table public.characters enable row level security;
alter table public.generations enable row level security;
