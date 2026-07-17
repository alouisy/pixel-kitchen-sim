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
    data jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists custom_levels_player_idx on public.custom_levels (player_token);
create index if not exists custom_levels_updated_idx on public.custom_levels (updated_at desc);

alter table public.custom_levels enable row level security;

