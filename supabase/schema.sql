-- The browser never receives a Supabase key. Netlify Functions use a secret key
-- to access these tables, so RLS stays enabled without public table policies.

create extension if not exists pgcrypto;

create table if not exists public.leaderboard_entries (
    id uuid primary key default gen_random_uuid(),
    player_token text not null,
    nickname text not null check (char_length(nickname) between 1 and 24),
    level_key text not null,
    score integer not null check (score between 0 and 50000),
    stars smallint not null check (stars between 0 and 3),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (level_key, player_token)
);

create index if not exists leaderboard_entries_rank_idx
    on public.leaderboard_entries (level_key, score desc, stars desc, updated_at asc);

alter table public.leaderboard_entries enable row level security;

create table if not exists public.custom_levels (
    id uuid primary key default gen_random_uuid(),
    player_token text not null,
    nickname text not null check (char_length(nickname) between 1 and 24),
    name text not null check (char_length(name) between 1 and 100),
    description text check (char_length(description) <= 300),
    difficulty integer check (difficulty between 1 and 5) default 3,
    data jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Migration checks to alter custom_levels if columns do not exist
do $$
begin
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='custom_levels' and column_name='description') then
        alter table public.custom_levels add column description text check (char_length(description) <= 300);
    end if;
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='custom_levels' and column_name='difficulty') then
        alter table public.custom_levels add column difficulty integer check (difficulty between 1 and 5) default 3;
    end if;
end $$;

create index if not exists custom_levels_player_idx on public.custom_levels (player_token);
create index if not exists custom_levels_updated_idx on public.custom_levels (updated_at desc);

alter table public.custom_levels enable row level security;

-- Create level ratings table
create table if not exists public.level_ratings (
    id uuid primary key default gen_random_uuid(),
    level_id uuid not null references public.custom_levels(id) on delete cascade,
    player_token text not null,
    rating integer not null check (rating between 1 and 5),
    created_at timestamptz not null default now(),
    unique (level_id, player_token)
);

create index if not exists level_ratings_level_idx on public.level_ratings (level_id);

alter table public.level_ratings enable row level security;

-- View combining levels and rating summaries
create or replace view public.community_levels_with_ratings as
select 
    cl.id,
    cl.player_token,
    cl.nickname,
    cl.name,
    cl.description,
    cl.difficulty,
    cl.data,
    cl.created_at,
    cl.updated_at,
    coalesce(avg(lr.rating), 0)::float as average_rating,
    count(lr.rating)::integer as rating_count
from public.custom_levels cl
left join public.level_ratings lr on cl.id = lr.level_id
group by cl.id, cl.player_token, cl.nickname, cl.name, cl.description, cl.difficulty, cl.data, cl.created_at, cl.updated_at;

-- V1 leaderboard aggregation views (run this file again in the Supabase SQL editor after pulling).

-- Best score per player per level. leaderboard_entries is unique on (level_key, player_token),
-- so this keeps the single stored row; the order by still defines "best" if that constraint changes.
create or replace view public.leaderboard_best_per_level with (security_invoker = true) as
select distinct on (player_token, level_key)
    player_token,
    level_key,
    nickname,
    score,
    stars,
    updated_at
from public.leaderboard_entries
order by player_token, level_key, score desc, stars desc, updated_at desc;

-- Global totals over official levels only (level:<number>, matching the roadmap).
create or replace view public.leaderboard_totals_official with (security_invoker = true) as
select
    player_token,
    (array_agg(nickname order by updated_at desc))[1] as nickname,
    sum(score) as score,
    sum(stars) as stars,
    max(updated_at) as updated_at
from public.leaderboard_best_per_level
where level_key ~ '^level:[0-9]+$'
group by player_token;

-- Global totals over official levels plus community levels that still exist in custom_levels.
-- The uuid cast is guarded by CASE so non-custom keys never reach it.
create or replace view public.leaderboard_totals_community with (security_invoker = true) as
select
    b.player_token,
    (array_agg(b.nickname order by b.updated_at desc))[1] as nickname,
    sum(b.score) as score,
    sum(b.stars) as stars,
    max(b.updated_at) as updated_at
from public.leaderboard_best_per_level b
left join public.custom_levels cl
    on cl.id = case
        when b.level_key ~ '^custom:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
            then substring(b.level_key from 8)::uuid
    end
where b.level_key ~ '^level:[0-9]+$'
   or cl.id is not null
group by b.player_token;

-- Views are read only by Netlify Functions using the secret key.
revoke all on public.leaderboard_best_per_level, public.leaderboard_totals_official, public.leaderboard_totals_community from anon, authenticated;


