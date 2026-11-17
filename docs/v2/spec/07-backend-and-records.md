# 07 · Backend and records (Supabase, Netlify functions, identity, verified runs, leaderboards, `/classic`)

> **Summary.** V2 keeps V1's no-account model (nickname + secret token, plus a new recovery code) on the same Supabase project, in new `v2_*` tables reached only through Netlify functions. Every record is a **replay** (`RunLog`, stored as a `.pkr` file) that a background function **re-simulates with the same `@ga/sim` code**; the server computes the score, bucket and rank itself and never trusts the client's claim.
> Leaderboards are per level x player-count bucket (Solo, Duo, Squad 3-4, Party 5-6) x difficulty (Meal, Feast) x `SIM_VERSION`, with personal bests, friends (by friend code) and world. V1 stays untouched and is served at `/classic`.

## Table of contents
1. [Principles and names](#1-principles-and-names)
2. [Supabase schema](#2-supabase-schema)
3. [Netlify functions](#3-netlify-functions)
4. [Identity](#4-identity)
5. [Errors and rate limits](#5-errors-and-rate-limits)
6. [Run submission and server re-verification](#6-run-submission-and-server-re-verification)
7. [Leaderboards](#7-leaderboards)
8. [Personal bests and friends](#8-personal-bests-and-friends)
9. [Anti-cheat](#9-anti-cheat)
10. [Costs on free tiers](#10-costs-on-free-tiers)
11. [V1 and V2 coexistence (`/classic`)](#11-v1-and-v2-coexistence-classic)
12. [Current state vs target](#12-current-state-vs-target)
13. [Tests and acceptance criteria](#13-tests-and-acceptance-criteria)
14. [Implementation order](#14-implementation-order)

---

## 1. Principles and names

1. **The browser never gets a table key.** All table reads and writes go through Netlify functions using `SUPABASE_SECRET_KEY` (as V1). The only things the browser receives are the public anon key and a **room JWT** for Realtime signaling ([06 §5.1](./06-multiplayer.md#51-auth-model)).
2. **The replay is the only trusted record data.** Score, stars, bucket, served counts are recomputed by the server from `(RunConfig, input frames)`. Client claims are compared, never stored as truth.
3. **No accounts, no OAuth, no email.** Identity = `playerId` (uuid), `token` (secret), `recoveryCode` (secret), `friendCode` (public), nickname.
4. **Everything is idempotent** where a retry is plausible (submit, friend add).
5. Names reused from other docs (do not rename): `RunConfig`, `RunResult`, `RunLog`, `SIM_VERSION`, `contentHash(levelId)` ([01 §7.6](./01-architecture.md)); `InlineSimDriver` ([01 §9.2](./01-architecture.md)); `verifyRun` ([01 §14](./01-architecture.md)); `.pkr` replay file `PKR1` ([02 §4.6](./02-simulation.md)); `bucketForPlayers`, `BucketId` (`'solo' | 'duo' | 'squad' | 'party'`).
6. Difficulty: `'snack' | 'meal' | 'feast'` exists in the sim ([02 §15.3](./02-simulation.md)); **only `meal` and `feast` are ranked**. `snack` runs are never submitted (the client hides the submit step) and the server answers `not_ranked` if one arrives.
7. Repo locations (target):
   - `v2/netlify/functions/*.ts` the functions, `v2/netlify/functions/_shared/*.ts` helpers (`db.ts`, `auth.ts`, `ratelimit.ts`, `errors.ts`, `codes.ts`, `store.ts`).
   - `v2/packages/records/` = `@ga/records` (codec, `verifyRun`, submission schema); see [01 §9.5](./01-architecture.md).
   - `v2/supabase/migrations/0001_v2.sql` (and later numbered files) = the schema in §2.
   - The V1 schema stays in `supabase/schema.sql` and is not modified.

---

## 2. Supabase schema

One Supabase project (the V1 one). V2 tables are prefixed `v2_` and live in `public`. File: `v2/supabase/migrations/0001_v2.sql`; idempotent (`if not exists`, `create or replace`) so re-running is safe, like V1's `schema.sql`.

### 2.1 Tables

```sql
create extension if not exists pgcrypto;

-- Players: identity. Secrets are stored only as HMAC-SHA256 hex (pepper = env TOKEN_PEPPER).
create table if not exists public.v2_players (
  id            uuid primary key default gen_random_uuid(),
  nickname      text not null check (char_length(nickname) between 2 and 20),
  token_hash    text not null unique,            -- hmac(pepper, token)
  recovery_hash text not null unique,            -- hmac(pepper, normalized recovery code)
  friend_code   text not null unique check (friend_code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  banned        boolean not null default false,
  strikes       smallint not null default 0     -- rejected-run strikes, see section 9
);

-- Rooms: only the code registry. Live room state stays in the host's browser (06).
create table if not exists public.v2_rooms (
  code           text primary key check (code ~ '^[A-HJ-NP-Z]{4}$'),   -- 24 letters, no I, no O
  host_player_id uuid references public.v2_players(id) on delete set null,
  status         text not null default 'open' check (status in ('open','closed')),
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null,
  max_chefs      smallint not null default 6
);
create index if not exists v2_rooms_expires_idx on public.v2_rooms (expires_at);

-- Run start tokens: proof that a run began at a known wall-clock time (anti-cheat, section 9).
create table if not exists public.v2_run_starts (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.v2_players(id) on delete cascade,
  level_id    text not null,
  players     smallint not null check (players between 1 and 6),
  seed        bigint  not null check (seed between 0 and 4294967295),
  difficulty  text not null check (difficulty in ('meal','feast')),
  sim_version integer not null,
  started_at  timestamptz not null default now(),
  used_at     timestamptz,
  unique (player_id, level_id, seed, started_at)
);
create index if not exists v2_run_starts_player_idx on public.v2_run_starts (player_id, started_at desc);

-- Runs: one row per distinct replay (deduplicated by replay_key). Result columns are SERVER-computed.
create table if not exists public.v2_runs (
  id            uuid primary key default gen_random_uuid(),
  replay_key    text not null unique,            -- sha256 hex of canonical PKR1 bytes without checkpoints
  status        text not null default 'pending'
                  check (status in ('pending','verifying','verified','rejected')),
  reject_reason text,                            -- error code, see section 5.3
  flag          text,                            -- null | 'inhuman_rate' | 'manual_hold' ... (section 9); flagged => visible=false
  visible       boolean not null default false,  -- on public boards
  level_id      text not null,
  difficulty    text not null check (difficulty in ('meal','feast')),
  bucket        text not null check (bucket in ('solo','duo','squad','party')),
  players       smallint not null check (players between 1 and 6),
  sim_version   integer not null,
  content_hash  text not null,
  seed          bigint not null,
  ticks         integer not null check (ticks between 1 and 20000),
  score         integer not null check (score between -100000 and 1000000),
  stars         smallint not null check (stars between 0 and 3),
  served        integer not null default 0,
  expired       integer not null default 0,
  wrong         integer not null default 0,
  final_hash    text not null,                   -- RunResult.hash
  team_key      text,                            -- sha256 of sorted participant ids, recomputed on every claim
  first_submitter uuid references public.v2_players(id) on delete set null,
  attempts      smallint not null default 0,     -- verification attempts
  verify_ms     integer,
  created_at    timestamptz not null default now(),   -- first submission time
  verified_at   timestamptz
);
create index if not exists v2_runs_board_idx
  on public.v2_runs (level_id, bucket, difficulty, sim_version, score desc, ticks asc, created_at asc)
  where status = 'verified' and visible;
create index if not exists v2_runs_pending_idx on public.v2_runs (status, created_at) where status in ('pending','verifying');

-- Participants of a run. A slot can be claimed once. (run_id, slot) is unique: nobody can steal a slot.
create table if not exists public.v2_run_players (
  run_id     uuid not null references public.v2_runs(id) on delete cascade,
  slot       smallint not null check (slot between 0 and 5),
  player_id  uuid not null references public.v2_players(id) on delete cascade,
  nickname   text not null,                      -- snapshot at claim time
  claimed_at timestamptz not null default now(),
  primary key (run_id, slot)
);
create index if not exists v2_run_players_player_idx on public.v2_run_players (player_id, run_id);

-- Replay bytes (PKR1, section 6.2). Separate table so listings never load blobs.
create table if not exists public.v2_replays (
  run_id uuid primary key references public.v2_runs(id) on delete cascade,
  data   bytea not null,
  bytes  integer not null check (bytes <= 262144),
  created_at timestamptz not null default now()
);

-- Personal bests: one row per (player, level, bucket, difficulty, sim_version).
create table if not exists public.v2_personal_bests (
  player_id   uuid not null references public.v2_players(id) on delete cascade,
  level_id    text not null,
  bucket      text not null check (bucket in ('solo','duo','squad','party')),
  difficulty  text not null check (difficulty in ('meal','feast')),
  sim_version integer not null,
  run_id      uuid not null references public.v2_runs(id) on delete cascade,
  score       integer not null,
  stars       smallint not null,
  ticks       integer not null,
  achieved_at timestamptz not null,
  primary key (player_id, level_id, bucket, difficulty, sim_version)
);
create index if not exists v2_pb_rank_idx
  on public.v2_personal_bests (level_id, bucket, difficulty, sim_version, score desc, ticks asc);

-- Friends: one-directional follow by friend code (no consent, nickname and scores are public anyway).
create table if not exists public.v2_friendships (
  player_id  uuid not null references public.v2_players(id) on delete cascade,
  friend_id  uuid not null references public.v2_players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (player_id, friend_id),
  check (player_id <> friend_id)
);

-- Rate limiting: fixed windows. Key = '<bucket>:<hmac(ip) or player id>'.
create table if not exists public.v2_rate_limits (
  key          text not null,
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (key, window_start)
);
```

### 2.2 RLS
```sql
alter table public.v2_players        enable row level security;
alter table public.v2_rooms          enable row level security;
alter table public.v2_run_starts     enable row level security;
alter table public.v2_runs           enable row level security;
alter table public.v2_run_players    enable row level security;
alter table public.v2_replays        enable row level security;
alter table public.v2_personal_bests enable row level security;
alter table public.v2_friendships    enable row level security;
alter table public.v2_rate_limits    enable row level security;
-- No policies for anon or authenticated on any table: only the secret key (service role) can read or write.
revoke all on all tables in schema public from anon, authenticated;   -- re-run after adding tables; also covers V1 tables (already RLS-locked)
```
The CI schema test ([09 §12](./09-testing-and-quality.md)) asserts that the anon key cannot select from or insert into any `v2_*` table.

### 2.3 Views
```sql
-- World board source: best verified, visible run per (board key, team). Crew names are fetched by the function in a second query.
create or replace view public.v2_world_board with (security_invoker = true) as
select distinct on (r.level_id, r.bucket, r.difficulty, r.sim_version, coalesce(r.team_key, r.id::text))
  r.id as run_id, r.level_id, r.bucket, r.difficulty, r.sim_version, r.players,
  r.score, r.stars, r.served, r.ticks, r.created_at
from public.v2_runs r
where r.status = 'verified' and r.visible
order by r.level_id, r.bucket, r.difficulty, r.sim_version, coalesce(r.team_key, r.id::text),
         r.score desc, r.ticks asc, r.created_at asc;

-- Rank of a score in a board = 1 + number of board rows with a strictly higher score.
create or replace function public.v2_rank(p_level text, p_bucket text, p_diff text, p_sim integer, p_score integer)
returns integer language sql stable as $$
  select 1 + count(*)::integer from public.v2_world_board
  where level_id = p_level and bucket = p_bucket and difficulty = p_diff and sim_version = p_sim and score > p_score;
$$;
```
The `distinct on` view is acceptable at the expected size (tens of thousands of runs). If it gets slow, replace it by a table maintained in `v2_finalize_run` (section 2.4); the function API in section 3.5 does not change.

### 2.4 Functions (SQL)
```sql
-- Fixed-window rate limit. Returns true when the call is allowed.
create or replace function public.v2_rate_hit(p_key text, p_window_seconds integer, p_max integer)
returns boolean language plpgsql as $$
declare w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
        h integer;
begin
  insert into public.v2_rate_limits(key, window_start, hits) values (p_key, w, 1)
    on conflict (key, window_start) do update set hits = public.v2_rate_limits.hits + 1
    returning hits into h;
  return h <= p_max;
end $$;

-- Called after a run is verified or after a participant claim changes. Recomputes team_key, visibility, personal bests.
create or replace function public.v2_finalize_run(p_run uuid) returns void language plpgsql as $$
declare r public.v2_runs%rowtype;
begin
  select * into r from public.v2_runs where id = p_run for update;
  if r.status <> 'verified' then return; end if;
  update public.v2_runs set
    team_key = (select encode(digest(string_agg(distinct player_id::text, ',' order by player_id::text), 'sha256'), 'hex')
                from public.v2_run_players where run_id = p_run),
    visible  = (flag is null and exists (select 1 from public.v2_run_players where run_id = p_run))
  where id = p_run;
  -- personal bests for every claimant when the run is visible
  insert into public.v2_personal_bests (player_id, level_id, bucket, difficulty, sim_version, run_id, score, stars, ticks, achieved_at)
  select rp.player_id, r.level_id, r.bucket, r.difficulty, r.sim_version, r.id, r.score, r.stars, r.ticks, r.created_at
  from (select distinct player_id from public.v2_run_players where run_id = p_run) rp
  where exists (select 1 from public.v2_runs x where x.id = p_run and x.visible)
  on conflict (player_id, level_id, bucket, difficulty, sim_version) do update
    set run_id = excluded.run_id, score = excluded.score, stars = excluded.stars, ticks = excluded.ticks, achieved_at = excluded.achieved_at
    where (excluded.score, -excluded.ticks) > (v2_personal_bests.score, -v2_personal_bests.ticks);
end $$;
```
A run is a better personal best when `score` is higher, or equal with fewer `ticks` (the run ended earlier).

### 2.5 Realtime authorization
Private Realtime channels for room signaling ([06 §5](./06-multiplayer.md#5-signaling-over-supabase-realtime)). The JWT is signed by the function `rooms` with the project JWT secret (`SUPABASE_JWT_SECRET`; if the project has migrated to asymmetric signing keys, sign with the configured key and algorithm instead, verify at implementation time). Claims: `aud: 'authenticated'`, `role: 'authenticated'`, `sub`, `room`, `exp`.
```sql
create policy "pk2 room read" on realtime.messages for select to authenticated
  using ( (select realtime.topic()) = 'room:' || (auth.jwt() ->> 'room') );
create policy "pk2 room write" on realtime.messages for insert to authenticated
  with check ( (select realtime.topic()) = 'room:' || (auth.jwt() ->> 'room') );
```
These policies are the only policies V2 adds. Enable "Allow public access" **off** for channels so only private channels work.

### 2.6 Scheduled SQL maintenance
Done by scheduled functions (section 3.7): delete `v2_rooms` expired > 1 day, `v2_run_starts` older than 2 days, `v2_rate_limits` older than 1 day, replays per the retention policy (section 10.3).

---

## 3. Netlify functions

### 3.1 Conventions
- Location `v2/netlify/functions/`, TypeScript, **Netlify Functions v2 API**: `export default async (req: Request, ctx: Context): Promise<Response>` plus `export const config = { path: '/api/...' }`. No redirect rules needed for `/api/*`.
- Bundler: esbuild (Netlify default for TS). `v2/netlify.toml` gets:
  ```toml
  [functions]
    directory = "netlify/functions"
    node_bundler = "esbuild"
  [functions."verify-run-background"]
    timeout = 900
  ```
  (background functions are limited by Netlify to 15 minutes; check the account's current limits at deploy time).
- Env vars (Netlify site settings, never in the repo): `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWT_SECRET`, `TOKEN_PEPPER` (32+ random bytes, hex), `RUN_START_SECRET` (HMAC key for `runToken`), `INTERNAL_KEY` (shared secret between `runs` and the background verifier), `ADMIN_TOKEN`, `CF_TURN_KEY_ID`, `CF_TURN_API_TOKEN`, `METERED_API_KEY`, `METERED_APP` (optional), `RELAY_ENABLED` (optional). Document them in `v2/.env.example` (names only).
- Request/response bodies are JSON, UTF-8. Body size cap 1 MB everywhere except `POST /api/runs` (400 KB). Over the cap: 413 `payload_too_large`.
- Auth: `Authorization: Bearer <token>` (never in query strings or bodies; this fixes V1's token-in-body habit). `auth.ts` exports `requirePlayer(req): Promise<Player>` (401 `unauthorized` if missing/invalid, 403 `banned`).
- Store interface: all functions use `Store` from `_shared/store.ts` (`SupabaseStore` in production, `MemoryStore` in tests, [09 §12](./09-testing-and-quality.md)). `Store` has typed methods per query (e.g. `getPlayerByTokenHash`, `insertRun`, `boardPage`), not a generic SQL escape hatch.
- Success `200` (or `201` on creation). Errors use the shape in section 5.1.
- Timing: every handler logs `{ fn, status, ms }` as one JSON line (Netlify log), no tokens or codes.

### 3.2 Identity (`identity.ts`, path `/api/identity/*`)
| Method + path | Auth | Request | Response |
|---|---|---|---|
| `POST /api/identity` | none | `{ nickname: string }` | `201 { playerId, token, recoveryCode, friendCode, nickname }` |
| `POST /api/identity/recover` | none | `{ recoveryCode: string }` | `200 { playerId, token, recoveryCode, friendCode, nickname }` (new token and new recovery code; the old ones stop working) |
| `GET /api/identity` | bearer | - | `200 { playerId, nickname, friendCode, createdAt }` |
| `PATCH /api/identity` | bearer | `{ nickname: string }` | `200 { nickname }` |
```ts
export interface IdentityCreateReq { nickname: string }
export interface IdentitySecrets { playerId: string; token: string; recoveryCode: string; friendCode: string; nickname: string }
```
Details in section 4. Errors: `invalid_nickname` (422), `nickname_blocked` (422), `rate_limited` (429), `invalid_recovery_code` (404, same response for unknown and malformed to avoid probing).

### 3.3 Rooms (`rooms.ts`, path `/api/rooms/*`, plus `turn.ts`)
| Method + path | Auth | Request | Response |
|---|---|---|---|
| `POST /api/rooms` | bearer | `{ maxChefs?: number }` (default 6, 2..6) | `201 { code, jwt, expiresAt, iceServers }` |
| `GET /api/rooms/:code` | none | - | `200 { code, status: 'open', hostNickname, expiresAt }` or `404 room_not_found` / `410 room_expired` |
| `POST /api/rooms/:code/join` | bearer or none (guest) | `{ guestNickname?: string }` (guests only) | `200 { jwt, hostPlayerId, iceServers, expiresAt }` |
| `POST /api/rooms/:code/heartbeat` | bearer (host) | - | `200 { expiresAt }` (extends `expires_at` to `min(now + 2 h, created_at + 12 h)`) |
| `POST /api/rooms/:code/host` | bearer | `{}` | `200 { ok: true }`; allowed only when the caller's JWT-room claim equals `code` and the current host's last heartbeat is older than 15 s (host migration, [06 §12.7](./06-multiplayer.md#127-host-leaves-host-migration-specified-behaviour)); sets `host_player_id` |
| `DELETE /api/rooms/:code` | bearer (host) | - | `200 { ok: true }` (status `closed`) |
| `GET /api/turn` | bearer | - | `200 { iceServers: RTCIceServer[]; ttlSeconds: number }` ([06 §6.1](./06-multiplayer.md#61-ice-servers)) |
```ts
export interface RoomCreateRes { code: string; jwt: string; expiresAt: string; iceServers: RTCIceServer[] }
export interface RoomJoinRes   { jwt: string; hostPlayerId: string | null; iceServers: RTCIceServer[]; expiresAt: string }
```
Code allocation: 8 attempts of random 4 letters (via `crypto.randomInt`), skip `BLOCKED_CODES`, insert; on unique violation or collision with a live room retry; after 8 failures `503 code_space_busy`. Expired rows are overwritten (`delete ... where code = $1 and expires_at < now()` first).
Guest join: `sub` = `guest-<uuid>`, nickname sanitised with the rules in section 4.2; guests cannot submit runs (no token).

### 3.4 Runs (`runs.ts`, path `/api/runs/*`, plus `verify-run-background.ts`)

| Method + path | Auth | Request | Response |
|---|---|---|---|
| `POST /api/runs/start` | bearer | `RunStartReq` | `201 { runToken, startedAt }` |
| `POST /api/runs` | bearer | `RunSubmitReq` | `202 { runId, status: 'pending' | 'verifying' | 'verified', deduplicated: boolean }` |
| `GET /api/runs/:id` | none | - | `200 RunStatusRes` |
| `GET /api/runs/:id/replay` | none | - | `200 application/octet-stream` (the `.pkr` bytes) for `verified && visible` runs, else `404 run_not_found` |
```ts
export interface RunStartReq {
  levelId: string;
  players: number;                 // 1..6 total chefs in the run
  seed: number;                    // u32, RunConfig.seed
  difficulty: 'meal' | 'feast';
  simVersion: number;              // SIM_VERSION of the client build
}
// runToken = base64url( JSON{ pid, lvl, n, seed, diff, sv, t } ) + '.' + base64url( HMAC_SHA256(RUN_START_SECRET, that payload) ), t = ms epoch.
// Also inserted in v2_run_starts. Refused: 409 stale_client when simVersion != server SIM_VERSION; 404 unknown_level; 422 not_ranked (snack).

export interface RunSubmitReq {
  runToken: string;
  replayB64: string;               // base64 of the .pkr file (section 6.2), <= 262144 raw bytes
  claim: { score: number; hash: string };   // RunResult.score and RunResult.hash as the client computed them
  slots: number[];                 // slots this submitter controlled (>= 1, each < players)
}
export interface RunStatusRes {
  runId: string;
  status: 'pending' | 'verifying' | 'verified' | 'rejected';
  rejectReason?: string;           // when rejected
  result?: {                       // when verified
    levelId: string; bucket: 'solo' | 'duo' | 'squad' | 'party'; difficulty: 'meal' | 'feast';
    score: number; stars: 0 | 1 | 2 | 3; served: number; expired: number; wrong: number; ticks: number; players: number;
    visible: boolean;              // false when flagged for review
    rank: number | null;           // current board rank, null if not visible
    isPersonalBest: boolean | null;   // for the requesting player if a bearer token is sent
    isWorldRecord: boolean;
  };
  claimedSlots: number[];          // the requesting player's slots (empty without a token)
}
```
`POST /api/runs` algorithm (the whole function, in order):
1. `requirePlayer`; rate limit `runs_submit` (section 5.2); decode body (cap 400 KB).
2. Verify `runToken` HMAC and parse; check `t` and `used_at` (section 9.2). Fetch the `v2_run_starts` row; refuse `run_token_used` (409) if the same token was already used **for a different replay**; the same token with the same replay is an idempotent retry.
3. Decode the `.pkr` header only (no sim yet): magic, size, JSON header. Check `config.simVersion === SIM_VERSION` else `409 stale_client`; `config.contentHash === contentHash(levelId)` else `409 stale_client`; `config` fields equal the token's (`levelId`, `players`, `seed`; `difficulty` equal to `header.difficulty`) else `422 token_mismatch`; `header.ticks <= maxTicks(level)` (section 6.4) else `422 replay_too_long`; `slots` valid (non-empty, unique, each `< players`) else `422 bad_slots`.
4. `replay_key = sha256(canonicalPkr(bytes))` where `canonicalPkr` re-encodes the decoded log with no checkpoints (`@ga/records` `canonicalBytes(log)`). Look up `v2_runs.replay_key`:
   - **Exists**: this is an additional participant (another peer of the same online run, [06 §15](./06-multiplayer.md#15-run-end-and-record-submission-hand-off)). Apply the claim rules (section 9.3). On success insert `v2_run_players` rows for the requested slots (conflict on `(run_id, slot)` = `409 slot_taken`), mark the run token used, and if the run is `verified` call `v2_finalize_run`. Respond `202 { runId, status, deduplicated: true }`.
   - **New**: insert `v2_runs` (`status 'pending'`, placeholder result columns from the *claim header*, which the verifier overwrites; `visible false`), the replay row, the participant rows, mark token used. Then invoke the verifier: `fetch(<site>/.netlify/functions/verify-run-background, { method: 'POST', headers: { 'x-internal-key': INTERNAL_KEY }, body: JSON.stringify({ runId }) })` without awaiting the result (fire and forget, the background function answers `202` immediately). Respond `202 { runId, status: 'pending', deduplicated: false }`.
5. Placeholder note: columns `score`, `stars`, `bucket`, ... are `not null`, so the insert writes the **header's claimed values** and `status = 'pending'`; boards only read `status = 'verified'`, and the verifier always overwrites all result columns from its own run (section 6.3 step 6).

`verify-run-background.ts` (no `config.path`; invoked at `/.netlify/functions/verify-run-background`): see section 6.3.

### 3.5 Boards (`boards.ts`, path `/api/boards/*`, `/api/pb`)
| Method + path | Auth | Query | Response |
|---|---|---|---|
| `GET /api/boards/:levelId` | optional bearer | `bucket` (`solo|duo|squad|party`, required), `difficulty` (`meal|feast`, required), `scope` (`world` default, `friends`, `me`), `limit` (1..100, default 25), `offset` (0..900), `legacy` (`1` to use older `simVersion`s) | `200 BoardRes` |
| `GET /api/pb` | bearer | - | `200 { entries: PbEntry[] }` all of the caller's personal bests for the current `SIM_VERSION` (max 10 x 4 x 2 = 80 rows) |
```ts
export interface BoardEntry {
  rank: number; runId: string; score: number; stars: 0 | 1 | 2 | 3; served: number; ticks: number; players: number;
  crew: Array<{ nickname: string; playerId: string | null; slots: number[] }>;   // claimed participants only
  unclaimedSlots: number;           // players - claimed slots, shown as "+N guests"
  achievedAt: string;
  legacy: boolean;                  // sim_version != current
  isMe: boolean;                    // the bearer is in the crew
}
export interface BoardRes {
  levelId: string; bucket: BucketId; difficulty: 'meal' | 'feast'; simVersion: number; scope: 'world' | 'friends' | 'me';
  entries: BoardEntry[];
  me: { rank: number | null; entry: BoardEntry | null };   // caller's best in this board (null without token or without a run)
  total: number;                    // rows in the board, capped at 1000
}
export interface PbEntry { levelId: string; bucket: BucketId; difficulty: 'meal' | 'feast'; score: number; stars: 0 | 1 | 2 | 3; ticks: number; runId: string; achievedAt: string }
```
Behaviour per scope: section 7. Response headers: `Cache-Control: public, max-age=15, s-maxage=30` for `world` without bearer; `private, no-store` otherwise.

### 3.6 Friends (`friends.ts`, path `/api/friends/*`)
| Method + path | Auth | Request | Response |
|---|---|---|---|
| `GET /api/friends` | bearer | - | `200 { friends: Array<{ playerId, nickname, friendCode }> }` |
| `POST /api/friends` | bearer | `{ friendCode: string }` | `201 { playerId, nickname }` (idempotent: `200` if already followed) |
| `DELETE /api/friends/:playerId` | bearer | - | `200 { ok: true }` |
Errors: `friend_not_found` (404), `cannot_friend_self` (422), `friend_limit` (422, max 100), `rate_limited`.

### 3.7 Scheduled and admin functions
| File | Schedule or path | Job |
|---|---|---|
| `keep-alive.ts` | `@daily` | `select 1` through the store (Supabase free projects pause after 7 days without activity); the V1 `keep-alive.mjs` keeps running for V1 tables |
| `verify-sweep.ts` | `*/5 * * * *` | find runs `pending` older than 2 min, or `verifying` older than 20 min; `attempts < 3` -> re-invoke the verifier; `attempts >= 3` -> `status = 'rejected'`, `reject_reason = 'verify_failed'` |
| `gc.ts` | `@hourly` | delete expired rooms, old run starts and rate-limit rows; delete replays per section 10.3 |
| `admin.ts` `POST /api/admin/runs/:id` | header `x-admin-token: $ADMIN_TOKEN` | body `{ action: 'approve' | 'remove' | 'ban_player', note?: string }`: approve = clear `flag` and call `v2_finalize_run`; remove = `visible=false, status='rejected', reject_reason='removed'` and delete PBs pointing to it; ban_player = ban the first submitter |

---

## 4. Identity

### 4.1 Model (V2, extends V1)
V1 has a random device token (`makeId('token')` in `src/saveManager.js`, stored in the save data) and a nickname, with **no recovery mechanism**. V2 keeps token + nickname and adds a **recovery code** and a **friend code**:

| Item | Format | Secret? | Where stored |
|---|---|---|---|
| `playerId` | uuid v4 | public | server and client |
| `token` | `pk2_` + 43 chars base64url (32 random bytes) | **secret** | client `localStorage['pk2.token']`; server only `HMAC-SHA256(TOKEN_PEPPER, token)` in hex |
| `recoveryCode` | 16 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, shown as `XXXX-XXXX-XXXX-XXXX` (80 bits) | **secret** | shown once at creation and in Settings > Account; server only its HMAC (of the upper-cased code without dashes) |
| `friendCode` | 8 chars of the same alphabet, shown `XXXX-XXXX` | public | server and client |
| `nickname` | 2..20 chars | public | server and client |

Random values come from `crypto.randomBytes` / `crypto.randomInt` (never `Math.random`).

### 4.2 Nickname rules
Applied identically client side (instant feedback) and server side (authoritative), in `@ga/records`: `sanitizeNickname`.
1. Trim, collapse inner whitespace to one space, strip control characters and zero-width characters, NFKC-normalise.
2. Length 2..20 after sanitising, else `invalid_nickname`.
3. Allowed: letters (any script), digits, space, `_ - . '`. Anything else is removed.
4. Blocklist: a word list (EN, FR, ES) matched against the lower-cased, accent-stripped, leetspeak-normalised (`0->o 1->i 3->e 4->a 5->s 7->t @->a $->s`) string with separators removed; a hit gives `nickname_blocked`. The list lives in `v2/packages/records/src/blocklist.ts` (`export const BLOCKED: readonly string[]`), reviewed by a human; start with an empty-but-wired list plus a test with 3 sentinel entries.
5. Names are not unique.
6. Default nickname at first launch: random funny name from the strings table (`strings.identity.defaultNames`), chosen on the client.

### 4.3 Flows
**Create (first launch, silent or at first online action):** client `POST /api/identity { nickname }`; stores `token`, `playerId`, `friendCode`; shows the recovery code once with "Copy" and "I saved it". If the server is unreachable the game still plays offline; creation is retried at the next online action.

**Authenticate:** every request sends `Authorization: Bearer <token>`. `requirePlayer` computes the HMAC and looks up `v2_players.token_hash`. `last_seen_at` is updated at most once per hour.

**Recover on a new device:** Settings > "I have a recovery code" -> `POST /api/identity/recover`. Server: HMAC the normalised code, find the player, generate a **new token and a new recovery code**, replace both hashes in one update, return them. The old token stops working immediately. Rate limited hard (section 5.2) and logged. After success the client replaces its local identity and re-downloads personal bests from `GET /api/pb`.

**Change nickname:** `PATCH /api/identity`. Runs already on boards keep the nickname stored in `v2_run_players.nickname` (snapshot); boards show the snapshot, so changing it does not rewrite history (privacy tool: a future admin action can).

**Lost token and recovery code:** identity is lost. Accepted trade-off of the no-account rule ([13](../13-social-and-virality.md)).

**V1 identities:** V1 tokens are not accepted by V2 and nothing is migrated: V1 scores live in V1's tables and appear only in `/classic`.

### 4.4 Privacy
- No emails, no IPs stored. The IP is only used as `HMAC(TOKEN_PEPPER, ip)` inside rate-limit keys, in a table purged daily.
- Public data: nickname, friend code, scores, crew lists. Documented on the Account screen.
- `DELETE /api/identity` (target addition): deletes the player row (cascade removes PBs, friendships; `v2_run_players.player_id` cascades so their claims disappear; runs without any claimant become invisible). Add it in the same ticket as GDPR-style needs; not required for V2.0.

---

## 5. Errors and rate limits

### 5.1 Error shape
```ts
export interface ApiError { error: { code: ErrorCode; message: string; retryAfterSeconds?: number } }
```
`message` is English and for developers; the client maps `code` to a localized string `strings.errors.<code>`.

### 5.2 Rate limits
Fixed windows via `v2_rate_hit(key, windowSeconds, max)`. `ip` = `hmac(ip)` from the `x-nf-client-connection-ip` header. A limited call returns `429 rate_limited` with `Retry-After` and `retryAfterSeconds`.

| Bucket | Key | Window | Max |
|---|---|---|---|
| `identity_create` | ip | 1 h | 5 |
| `identity_create_day` | ip | 24 h | 20 |
| `identity_recover` | ip | 1 h | 5 |
| `identity_recover_day` | ip | 24 h | 15 |
| `identity_patch` | player | 1 h | 10 |
| `rooms_create` | player | 1 h | 10 |
| `rooms_join` | ip | 1 h | 120 |
| `rooms_get` | ip | 1 min | 60 |
| `turn` | player | 1 h | 30 |
| `runs_start` | player | 1 h | 60 |
| `runs_submit` | player | 1 h | 30 |
| `runs_pending` | player | concurrent | 3 runs in `pending`/`verifying` (checked by count, not a window) |
| `boards_read` | ip | 1 min | 120 |
| `replay_read` | ip | 1 min | 20 |
| `friends_write` | player | 24 h | 60 |

Defaults (tunable). Boards GET additionally benefits from the edge cache headers in section 3.5.

### 5.3 Error codes
| HTTP | `code` | When |
|---|---|---|
| 400 | `bad_request` | malformed JSON or missing fields |
| 401 | `unauthorized` | missing or unknown token |
| 403 | `banned` | player banned |
| 404 | `room_not_found`, `run_not_found`, `friend_not_found`, `unknown_level`, `invalid_recovery_code` | |
| 409 | `stale_client` | `simVersion` or `contentHash` differs from the server build: tell the player to reload |
| 409 | `slot_taken`, `run_token_used`, `duplicate_replay` | claim conflicts (section 9.3) |
| 410 | `room_expired` | |
| 413 | `payload_too_large` | |
| 422 | `invalid_nickname`, `nickname_blocked`, `bad_slots`, `token_mismatch`, `replay_too_long`, `replay_malformed`, `not_ranked`, `cannot_friend_self`, `friend_limit`, `run_too_fast`, `claim_window_closed` | validation |
| 429 | `rate_limited` | |
| 503 | `code_space_busy`, `store_unavailable` | |
Rejection reasons stored in `v2_runs.reject_reason` (set by the verifier): `replay_malformed`, `unknown_level`, `bad_players`, `version_mismatch`, `content_mismatch`, `replay_too_long`, `phase_not_ended`, `hash_mismatch`, `score_mismatch`, `players_mismatch`, `verify_failed`, `removed`.

---

## 6. Run submission and server re-verification

### 6.1 Client flow (all peers, see [06 §15](./06-multiplayer.md#15-run-end-and-record-submission-hand-off))
1. At run start (`RunConfig` known): `POST /api/runs/start` -> `runToken` (best effort; if it fails the run is **unranked**, never blocking play). Offline play and snack are unranked.
2. After `phase === 'ended'`: `log = await driver.log()` (`WorkerSimDriver.log()`, [01 §9.5](./01-architecture.md)), `result = driver.result()`, `bytes = encodePkr(log, result)`, `POST /api/runs { runToken, replayB64, claim: { score: result.score, hash: result.hash }, slots }`.
3. Poll `GET /api/runs/:id` every 1 s for up to 90 s (then every 5 s while the results screen is open). Show "Verifying...", then "Verified, rank #N" (with a world-record or personal-best banner) or "Not verified" with the localized `rejectReason`.
4. The local personal best (`localStorage`, `pk2.best.<level>.<bucket>.<difficulty>`) is updated immediately from the local result; the server value wins at the next `GET /api/pb`.
5. Failed network: keep the pending submission in `localStorage['pk2.pendingRuns']` (max 5, 1 MB total) and retry on next launch if the `runToken` is still valid (section 9.2), else drop.

### 6.2 Replay container format
This is exactly the `.pkr` format of [02 §4.6](./02-simulation.md): magic `PKR1`, `headerLen u16`, UTF-8 JSON header, then run-length-encoded per-slot input records (5-byte `encodeRushInput`). Header (owned by 02, restated for the server):
```ts
export interface PkrHeader {
  config: RunConfig;             // { simVersion, contentHash, levelId, players, seed }
  difficulty: 'snack' | 'meal' | 'feast';
  ticks: number;                 // steps executed
  finalHash: string;             // RunResult.hash
  score: number;                 // RunResult.score as the client computed it
  checkpoints: Array<[number, string]>;   // [tick, hash] every 150 ticks; optional for the server
}
```
`@ga/records` exports (all pure, Node and browser):
```ts
export function encodePkr(log: RunLog, result: RunResult, difficulty: Difficulty): Uint8Array;
export function decodePkr(bytes: Uint8Array): { header: PkrHeader; log: RunLog };      // throws PkrError(code) on any malformation
export function canonicalBytes(log: RunLog, difficulty: Difficulty): Uint8Array;        // PKR1 with header { config, difficulty, ticks } only and no checkpoints: input of replay_key
export function replayKey(bytes: Uint8Array): string;                                   // sha256 hex of canonicalBytes(decodePkr(bytes))
export interface VerifyResult { ok: boolean; reason?: string; result?: RunResult }
export function verifyRun(log: RunLog, claim: { score: number; hash: string }, opts?: { difficulty?: Difficulty; maxMs?: number; now?: () => number }): VerifyResult;
```
The wire form for upload is the `.pkr` bytes base64-encoded in `replayB64` (about 54 KB for a 40 KB file; hard cap 262,144 raw bytes). `decodePkr` rejects: wrong magic, header length beyond the buffer, header JSON invalid, `players` not 1..6, per-slot run lengths that do not sum to `header.ticks`, `ticks` 0 or above 20,000, trailing bytes.

Note for [06](./06-multiplayer.md): the online input log is a `RunLog`; the confirmed-frame log of a net run converts to `frames[t][slot]` via `decodeRushInput`; the `.pkr` codec is the single replay codec. If 06 mentions a different container name or `SIM_BUILD_ID`, the names in this section and in 01 §7.6 (`SIM_VERSION`) win.

### 6.3 The verifier (`verify-run-background.ts`)
```ts
export default async (req: Request): Promise<Response> => {
  if (req.headers.get('x-internal-key') !== process.env.INTERNAL_KEY) return new Response(null, { status: 401 });
  const { runId } = await req.json();
  // Background functions return 202 to the caller at once; the work below continues until the function returns.
  await verifyOne(runId);
  return new Response(null, { status: 202 });
};
```
`verifyOne(runId)`:
1. Atomically claim: `update v2_runs set status='verifying', attempts=attempts+1 where id=$1 and status in ('pending','verifying') returning *`; no row = return (already done).
2. Load the replay bytes, `decodePkr` -> `{ header, log }`. On `PkrError` -> reject `replay_malformed`.
3. Check `log.config.simVersion === SIM_VERSION`, `contentHash(levelId) === log.config.contentHash`, level exists (`rushLevelById`), `players` in 1..6 -> else reject `version_mismatch` / `content_mismatch` / `unknown_level` / `bad_players`. (Rejections for version/content mismatch do **not** add a strike.)
4. `verifyRun(log, { score: header.score, hash: header.finalHash }, { difficulty, maxMs: VERIFY_MAX_MS })`. Inside `verifyRun`:
   - create `new InlineSimDriver()` and `start({ ...log.config, difficulty }, { kind: 'driven' })` (the same sim code as the client, [01 §9.2](./01-architecture.md));
   - for `t` in `0 .. log.frames.length - 1`: `driver.advance(1, [log.frames[t]])`; every 256 ticks check `now() - t0 <= maxMs`, else return `{ ok: false, reason: 'verify_timeout' }` (the caller retries, section 6.3 step 8);
   - after the last frame require `phase === 'ended'` (`phase_not_ended`) and that no frame was supplied after the `TimeUp` tick (extra frames are rejected: `replay_too_long`);
   - compute `RunResult` (`levelId, bucket, score, stars, served, expired, wrong, ticks, hash`) from the sim;
   - compare `result.hash === claim.hash` (`hash_mismatch`) and `result.score === claim.score` (`score_mismatch`); compare `result.ticks === header.ticks`.
5. `bucket` in the result comes from the sim's `bucketForPlayers(level, players)` (the client cannot choose it).
6. On `ok`: one SQL update sets `status='verified'`, `verified_at=now()`, `bucket, score, stars, served, expired, wrong, ticks, final_hash` from the **server's** `RunResult`, `verify_ms`, then the human-rate heuristics (section 9.4) may set `flag`; then `select v2_finalize_run($1)`.
7. On a definitive failure (`hash_mismatch`, `score_mismatch`, `players_mismatch`, `phase_not_ended`, `replay_*`, `*_mismatch`): `status='rejected'`, `reject_reason=<code>`, `visible=false`; if the reason is `hash_mismatch` or `score_mismatch` increment `strikes` of the first submitter (section 9.5).
8. On `verify_timeout` or an exception: leave `status='pending'` (so `verify-sweep` retries) and log; after `attempts >= 3` the sweeper rejects with `verify_failed`.

### 6.4 Bundling, CPU and memory limits
- **Bundling:** the function imports `@ga/records`, which imports `@ga/sim/rush` (sim without `worker.ts`), `@ga/content` (JSON data and zod) and `@ga/shared`. esbuild resolves the pnpm workspace symlinks and inlines the JSON, so there are no `included_files`. Add to `@ga/sim` `package.json`: `"exports": { ".": "./src/index.ts", "./worker": "./src/worker.ts", "./rush": "./src/rush/index.ts" }`; the function imports **only `@ga/sim/rush`** (never `@ga/sim`, whose barrel pulls `bitecs` and the other sim) so the bundle stays small (expected under 1.5 MB). A test (`records/test/bundle.test.ts`) bundles the function with esbuild and fails if `bitecs`, `three` or `worker.ts` appear in the metafile.
- **Determinism in Node:** same double arithmetic as V8 in browsers; sim code uses only `+ - * /` and `Math.sqrt` ([01 §5](./01-architecture.md) lint rule), so Node and browsers agree. CI test: golden hashes ([09 §6.2](./09-testing-and-quality.md)) run under Node in the same job that builds the function.
- **CPU budget:** sim budget is under 0.3 ms per tick ([02](./02-simulation.md)); a 180 s level is 5,490 ticks, so about 1.7 s; a function vCPU may be 2-3x slower than a dev laptop: plan for under 6 s. `VERIFY_MAX_MS = 60000` (`Default (tunable)`). Pre-check before any sim work: `header.ticks <= maxTicks(level)`, where `maxTicks = (countdownSeconds + durationSeconds) * 30 + 30` (30 extra ticks of slack).
- **Wall-clock limits:** background functions may run up to 15 minutes (Netlify), so the 60 s budget is far inside the limit. Synchronous functions (10 s default) are **not** used for verification; this is why submission is asynchronous.
- **Memory:** log 6 x 5,490 inputs is below 200 KB; the sim state is small; default function memory is enough.
- **Cold start:** about 300-600 ms (bundle load). Acceptable; the client polls.
- **Concurrency:** Netlify scales functions; `runs_pending` caps 3 concurrent runs per player.

### 6.5 What happens on mismatch
| Case | Server result | Player sees | Strike? |
|---|---|---|---|
| Different `simVersion` or `contentHash` at `POST /api/runs/start` or `/api/runs` | `409 stale_client` before anything is stored | "A new version is available. Reload to submit your runs." plus Reload button | no |
| Replay malformed or too long | `422` at submit, or `rejected` | "Run not verified" | no (could be a bug) |
| `hash_mismatch` or `score_mismatch` (verifier's result differs from the claim) | `rejected`, not visible, no PB | "Run not verified" (the local score stays visible locally) | **yes** |
| Same replay submitted again | idempotent, `deduplicated: true` | normal | no |
| Verifier timeout or crash | stays `pending`, retried up to 3 times, then `rejected verify_failed` | "Verification delayed" then "Run not verified" | no |
| A genuine desync bug in the sim (hash differs although the client is honest) | same as hash mismatch | same | yes, but see 9.5: strikes only ban at 5 within 24 h and unban on request. Telemetry event `verify_mismatch` includes `simVersion`, `levelId`, `buildId` so a sim determinism bug shows up as a cluster of mismatches across many players |

The server **never trusts** the claim: even if it matched, the stored values are the server's.

---

## 7. Leaderboards

### 7.1 Board key
`(levelId, bucket, difficulty, simVersion)`. Level ids are the 10 level ids in [08](./08-levels.md) (`l01_kiosque`, ...). `bucket` follows the sim (`bucketForPlayers`): Solo 1, Duo 2, Squad 3-4, Party 5-6 (as in each `level.json` `buckets`). `difficulty` is `meal` or `feast`. 10 levels x 4 buckets x 2 difficulties = 80 boards for the current `SIM_VERSION`.

### 7.2 Ranking
1. `score` descending.
2. `ticks` ascending (finished earlier... the sim ends at a fixed time, so this only matters when levels end early; kept as a stable tie-break).
3. `created_at` ascending (earliest wins).
`stars` is derived from score and not used for ranking.

### 7.3 One row per team
The view `v2_world_board` keeps the **best run per `team_key`** (the set of claimant players), so a team that replays 50 times appears once, with its best. Different team compositions appear separately. A player can therefore appear in several rows in team buckets (Duo with different partners) but at most once per distinct team. Solo boards are best-per-player.

### 7.4 Scopes
| `scope` | Source | Notes |
|---|---|---|
| `world` | `v2_world_board` filtered by the key, ordered per 7.2, `limit/offset` | Cached 15 s at the browser, 30 s at the edge |
| `friends` | requires bearer. Rows of `v2_world_board` whose run has at least one participant in `{caller} ∪ friends` (friends from `v2_friendships`), then rank among those | Rank is computed within this set, not the world rank |
| `me` | caller's `v2_personal_bests` rows for the key (one row) plus the caller's rank in the world board via `v2_rank` | Used by the results screen |
`me` in `BoardRes`: the caller's best entry in the **world** board and its world rank, even when scope is `friends`.

### 7.5 Crew fetch
After selecting `run_id`s, the function loads `v2_run_players where run_id in (...)` in a second query, groups by run, and builds `crew` (nickname snapshots) and `unclaimedSlots = players - claimedCount`.

### 7.6 Legacy rows (older `SIM_VERSION`)
Rows from an older `SIM_VERSION` stay stored and are visible with `?legacy=1` (the client shows a "Previous rules" tab), flagged `legacy: true`. Default boards show only the current version, because a sim change can make old scores unbeatable or too easy. When `SIM_VERSION` is bumped, nothing is deleted. Personal bests are per version too, so a player's old PB does not block a new one.

### 7.7 World records
A world record is rank 1 at verification time. `RunStatusRes.result.isWorldRecord = true` if `rank === 1`; the client shows the record banner and the share card ([13](../13-social-and-virality.md)). A record held for 30 days gets no special treatment.

---

## 8. Personal bests and friends

### 8.1 Personal bests
- Server truth: `v2_personal_bests`, updated only in `v2_finalize_run` (so only verified, visible runs count).
- Client cache: `localStorage['pk2.best.<levelId>.<bucket>.<difficulty>'] = { score, stars, ticks, runId? }`. `runId` is absent for local-only (unverified or offline) bests.
- Sync: on app start and after login/recover, `GET /api/pb` and merge: per key take the higher score; keep the local-only value when it is higher (it shows "unverified" until submitted).
- A **ghost** (replay of the personal best) is `GET /api/runs/:id/replay` for the PB run, played back through `InlineSimDriver` or the worker with the log ([01 §9](./01-architecture.md)); a world-record ghost likewise (visible runs only).

### 8.2 Friends
- Each player has a public `friendCode`. "Add friend" takes a code (typed or from a link `https://<domain>/f/ABCD-EFGH` handled by the router).
- Following is one-directional, no confirmation, no notifications. It reveals nothing beyond what boards show publicly.
- Limit 100 follows per player. Friends board = section 7.4.
- Friend codes are not secret but unguessable enough (8 chars of 32 = 40 bits) and `POST /api/friends` is rate limited (60/day), so enumeration is impractical.

---

## 9. Anti-cheat

Threat model: players who want a fake record. The design makes **forging a score impossible** (the server re-simulates) and keeps cheating limited to "provide inputs that a bot or tool computed". There are no accounts to ban, so heavy-handed measures are limited.

### 9.1 What is enforced by construction
- Score, stars, bucket and counts come from the server's re-simulation with the same sim code, never from the client.
- Pinned versions: `simVersion` and `contentHash` must equal the server's.
- Seeds and levels are bound to a `runToken` created at run start.
- Replays are bounded in size (256 KB) and ticks (`maxTicks`), and decoded defensively (`decodePkr` never executes content).
- Inputs are sanitised by `step` ([02 §4.2](./02-simulation.md)), so crafted out-of-range inputs cannot break the sim; they only produce a different (still deterministic) run.

### 9.2 Run token and timing (`POST /api/runs/start`)
- The token proves a run began at wall-clock `t` and that the submitter was authenticated then.
- At submit: `now - t >= 0.9 x (durationSeconds + countdownSeconds)` seconds, else `422 run_too_fast`. And `now - t <= 6 h`, else `410`-style `run_token_used` (expired token: `422 token_mismatch`).
- A token is single use; the same token with the same replay is a retry.
- This stops mass submission of synthetic replays at CPU speed: each submission costs real time on the clock. A single player can still run many tokens in parallel; `runs_start` is limited to 60/h and `runs_pending` to 3.

### 9.3 Claiming a run that already exists (online co-op)
Rules for adding a participant to a run with the same `replay_key`:
1. Slots requested must be free (`(run_id, slot)` primary key; conflict = `slot_taken`).
2. The submitter's `runToken` must be valid and `started_at <= run.created_at - 0.9 x duration` ... meaning the claimant started the run **before the first submission appeared**. A player who downloads somebody else's replay (replays are public for visible runs) and starts a token afterwards fails this check (`claim_window_closed`).
3. The claim must arrive within **10 minutes** of `run.created_at` (`claim_window_closed` after that).
4. A player may claim at most `MAX_LOCAL_PER_PEER = 4` slots on one run.
5. A run with a `flag` or `status = 'rejected'` accepts no new claims.

### 9.4 Heuristics (`flag`, soft)
Computed in the verifier from `log.frames` per slot, only for slots claimed at verification time or all slots if none:
| Flag | Rule (`Default (tunable)`) | Effect |
|---|---|---|
| `inhuman_rate` | any slot changes its 5-byte input more than 30 times per second sustained over 10 s, **or** presses A more than 8 times per second over 5 s | `flag` set, `visible=false`, waits for admin review |
| `perfect_idle_precision` | not implemented in V2.0 (listed to avoid re-proposing); a frame-perfect bot cannot be distinguished by timing alone |
| `superhuman_score` | `score > 1.5 x` the current world rank-1 score for the board and `> 2 x` the 3-star threshold | `flag`, hidden until review (protects against a bug in a new level producing nonsense) |
A flagged run is **verified but not visible**; the owner sees it as "Pending review" (`RunStatusRes.result.visible = false`). `POST /api/admin/runs/:id` approves or removes. Thresholds are constants in `@ga/records` `heuristics.ts` with unit tests on recorded bot runs (the bot at full speed must **not** be flagged on level 1).

### 9.5 Strikes
- `hash_mismatch` or `score_mismatch` increments `v2_players.strikes` of the first submitter. At **5 strikes within 24 h** (counted from `v2_runs` rows with those reasons in the window) the player is rate-limited to 1 submission per hour for 24 h (not banned). Strikes decay by recount, not by a stored counter, so the `strikes` column is informational.
- Manual `ban_player`: `banned = true`; the player's runs stay but become invisible; the token returns `403 banned`.
- Honest desync bugs must not punish: telemetry (section 6.5) lets us spot sim bugs, and a `SIM_VERSION` bump or a hotfix plus an admin "forgive" action (`ban_player` with `action: 'unban'` is allowed in `admin.ts`) resets the window. Add `'unban'` to the admin action union when implementing.

### 9.6 Known limitations (accepted)
- A tool-assisted or bot player who inputs frame-perfect, human-rate-looking sequences passes. Mitigation is the replay itself: every visible record has a downloadable replay that anyone can watch ("watch the record"), and admin removal.
- Tokens can be shared; a friend can play under one identity. Not a problem for a no-account game.
- Teammates cannot be forced to submit; a host's run might list fewer players than played. The board shows "+N guests".

---

## 10. Costs on free tiers

Numbers are `Default (tunable)` planning figures; **re-check the providers' current free-tier limits at launch** (they change).

### 10.1 Supabase (free project)
| Resource | Limit (approx.) | V2 usage estimate |
|---|---|---|
| Database | 500 MB | rows are small; replays are the bulk: 20-40 KB each. 5,000 runs/month x 30 KB = 150 MB/month before pruning, so pruning (10.3) is mandatory |
| Realtime | 200 concurrent connections, about 100 msg/s, 2 M msg/month | signaling only: about 20 messages per join; 100 simultaneous rooms of 4 = 400 connections > 200, so the free tier supports about 50 concurrent rooms. Upgrade trigger: > 40 concurrent rooms |
| Egress | 5 GB/month | board responses are small (a 25-row page about 5 KB) and edge-cached; replay downloads 40 KB each |
| Inactivity | project pauses after 7 days idle | `keep-alive.ts` daily |

### 10.2 Netlify (free plan)
| Resource | Notes | V2 usage estimate |
|---|---|---|
| Function invocations | historically 125k/month on the free plan (the plan may now be credit based, check) | per ranked run about 10 invocations (start, submit, verify, ~5 polls, 1-2 board reads): 5,000 runs = 50k. Room creation/joins add little. Boards are edge cached |
| Function runtime | historically 100 h/month | verify about 3 s per run: 5,000 runs = 4 h |
| Bandwidth | 100 GB | the game bundle dominates (a few MB x visits) |
| Build minutes | 300/month | `pnpm install && pnpm build` per deploy |
Two sites (V1 and V2) each have their own allowance.

### 10.3 Replay retention (pruning, in `gc.ts`)
Keep a replay when its run is any of: in the top 100 of its board key; the personal best of any player; younger than 7 days. Delete the `v2_replays` row otherwise (the run row stays; `GET /replay` then returns `404`). Expected steady state: 80 boards x 100 + PB runs (about 10 per active player) -> about 10-15k replays = 300-450 MB worst case, so cap: keep top **50** per board key if the table exceeds 350 MB (`gc.ts` checks `pg_total_relation_size`). If this is still not enough, move `data` to Supabase Storage (1 GB free) behind the same `Store.getReplay/putReplay` methods.

### 10.4 TURN
Cloudflare Realtime TURN free allowance is large; relayed traffic is about 4 KB/s per relayed player ([06 §5](./06-multiplayer.md)), about 1 MB per 4-minute run. Not a cost concern at this scale. If no TURN is configured, play still works for most players (STUN only).

### 10.5 Upgrade path
Supabase Pro (about 25 USD/month) and Netlify Pro lift every limit above; no code changes needed.

---

## 11. V1 and V2 coexistence (`/classic`)

### 11.1 Decision
V2 is the main site at `/`. V1 (the 2D game in the repo root) is served at **`/classic`**, unchanged in gameplay, with its own data. Two Netlify sites stay as today:
- **V2 site:** base directory `v2`, config `v2/netlify.toml`, the custom domain.
- **V1 site:** repo root, config `netlify.toml`, a `*.netlify.app` URL (and optionally `classic.<domain>`).

### 11.2 Routing (add to `v2/netlify.toml`)
```toml
[[redirects]]
  from = "/classic"
  to = "/classic/"
  status = 301
  force = true
[[redirects]]
  from = "/classic/*"
  to = "https://<v1-site>.netlify.app/:splat"
  status = 200
  force = true
[[redirects]]
  from = "/r/*"
  to = "/index.html"
  status = 200
[[redirects]]
  from = "/f/*"
  to = "/index.html"
  status = 200
```
The `/classic/*` rule is a proxy rewrite (status 200), so the browser stays on the V2 domain. V1's Vite config has `base: './'` and fetches `levels/...` relatively, so it works under `/classic/` **as long as the URL has the trailing slash** (hence the 301).

### 11.3 Headers
`v2/netlify.toml` sets `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` for `/*`. For `/classic/*` override with no COOP/COEP (V1 does not need isolation and loads no cross-origin assets):
```toml
[[headers]]
  for = "/classic/*"
  [headers.values]
    Cross-Origin-Embedder-Policy = "unsafe-none"
    Cross-Origin-Opener-Policy = "unsafe-none"
```
(Headers on proxied responses combine with the upstream's; verify in a deploy preview with devtools and adjust to the exact working combination.)

### 11.4 V1 changes (minimal, in the V1 tree)
1. `src/onlineService.js`: `FUNCTIONS_BASE_URL` becomes `import.meta.env.VITE_V1_FUNCTIONS_BASE ?? '/.netlify/functions'`. V1 site's build env sets `VITE_V1_FUNCTIONS_BASE=https://<v1-site>.netlify.app/.netlify/functions`, because `/.netlify/functions/*` on the V2 domain points to V2's functions, not V1's.
2. V1 functions (`netlify/functions/_supabase.mjs` `json()`) add `Access-Control-Allow-Origin: https://<v2-domain>`, `Access-Control-Allow-Headers: Content-Type, X-Player-Token`, `Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS`, and each handler returns `204` with those headers for `OPTIONS`.
3. Nothing else: levels, saves, token and leaderboards of V1 remain as they are.
4. A link "Classic" in the V2 title screen footer: `<a href="/classic/">` ([05](./05-client-ui-input-audio.md)).

### 11.5 Data separation
| | V1 | V2 |
|---|---|---|
| Tables | `leaderboard_entries`, `custom_levels`, `level_ratings`, views `leaderboard_*`, `community_levels_with_ratings` | `v2_*` |
| Functions | `netlify/functions/{leaderboard,levels,rate,keep-alive}.mjs` on the V1 site | `v2/netlify/functions/*.ts` on the V2 site |
| Identity | token in V1 save (`player.token`) | `pk2_` token |
| Schema file | `supabase/schema.sql` | `v2/supabase/migrations/*.sql` |
Same Supabase project, same secret key env var names on both sites. No V2 migration touches V1 tables. `keep-alive` exists on both sites (harmless duplicates).

### 11.6 Later
When V2 is the only product, point the V1 site to read-only (functions return 503 on POST) and keep `/classic` for archive. Do not delete V1 tables.

---

## 12. Current state vs target

| Area | Current (repo, 2026-11-17) | Target |
|---|---|---|
| Hosting | V1: root `netlify.toml` (`npm run build`, publish `dist`, functions `netlify/functions`). V2: separate site, `v2/netlify.toml` (base `v2`, `pnpm install && pnpm build`, publish `apps/client/dist`, COOP/COEP headers), **no functions directory, no redirects** | V2 `[functions]`, `/classic` proxy, SPA fallbacks (section 11) |
| Functions | V1 only: `leaderboard.mjs` (GET scopes `all`, `global:*`, `level:N`, `custom:uuid`; POST `{nickname, playerToken, levelKey, score, stars}` with plausibility cap `ceil(star3 x 2.5)` and one submission per level duration), `levels.mjs`, `rate.mjs`, `keep-alive.mjs` (daily), helper `_supabase.mjs` (`supabaseRequest` over PostgREST with the secret key) | `v2/netlify/functions/*.ts` per section 3. Reuse the `supabaseRequest` pattern in `_shared/db.ts` |
| Trust | V1 trusts the client's score (only a plausibility cap) | Server re-simulation (section 6) |
| Schema | `supabase/schema.sql`: `leaderboard_entries`, `custom_levels`, `level_ratings`, views, RLS enabled with no policies, `revoke all ... from anon, authenticated` on views | `v2_*` tables in `v2/supabase/migrations/0001_v2.sql` (section 2) + the two `realtime.messages` policies |
| Identity | token (`makeId('token')`) in the V1 save + nickname; token sent in POST body (`playerToken`) or `X-Player-Token`; **no recovery** | Token (header), recovery code, friend code (section 4) |
| Client service | `src/onlineService.js` `OnlineServices` class with `fetchLeaderboard`, `submitScore`, community level calls | V2 client `apps/client/src/online/api.ts` with typed wrappers for section 3 (shared types from `@ga/records`) |
| Records in V2 | `localStorage` best per level and bucket only (`pk.best.<level>.<bucket>`, [01 §13](./01-architecture.md)); no `RunLog`, no `SIM_VERSION`, no `contentHash` | `@ga/records`, `.pkr`, `verifyRun`, boards |
| Sim readiness | `RushSim.stateHash()` and `bucketForPlayers` exist; `RushOptions` has no `difficulty`; no `InlineSimDriver`, no `RunConfig` in the worker yet ([01 §7.6](./01-architecture.md), [02 §15.3](./02-simulation.md)) | Delivered by the sim tickets; this doc's verifier depends on `RunConfig`, `InlineSimDriver`, `SIM_VERSION`, `contentHash` |
| Rooms and Realtime | none | section 3.3, 2.5 and [06](./06-multiplayer.md) |

---

## 13. Tests and acceptance criteria

### 13.1 Tests ([09 §12](./09-testing-and-quality.md) lists the gate; these are the cases)
`@ga/records` (`packages/records/test/`):
1. `.pkr` round trip (`encodePkr` -> `decodePkr`) for 1, 2, 4, 6 players; header fields; canonical bytes ignore checkpoints (`replayKey` stable).
2. `decodePkr` rejects: wrong magic, truncated header, run sums not equal to `ticks`, `players` 0 and 7, trailing bytes, oversize.
3. `verifyRun` accepts a bot-recorded run on level 1 at 1, 2 and 6 players; rejects altered score, altered hash, one flipped input frame, wrong `simVersion`, wrong `contentHash`, truncated log, extra frames after `TimeUp`, unknown level.
4. `sanitizeNickname`: blocked sentinels (leetspeak, spacing), length, control chars.
5. Heuristics: full-speed bot not flagged; synthetic 60 Hz button mashing flagged.
6. `bundle.test.ts` (section 6.4).

Functions (Vitest, `MemoryStore`, handlers called with `new Request(...)`):
7. identity: create, recover (old token dead), patch; blocked nickname 422; rate limit trips at 5/h.
8. rooms: create returns 4-letter code in alphabet; collision retry; join returns JWT whose `room` claim equals the code; heartbeat extends; expired -> 410.
9. runs: valid submit -> `pending`; run the verifier in-process -> `verified`, board shows it; duplicate replay -> `deduplicated`; second participant claim within window OK, after window `claim_window_closed`, slot reuse `slot_taken`; `run_too_fast`; stale `simVersion` -> 409; oversize -> 413; bad token -> 401; tampered score claim -> rejected with a strike.
10. boards: ordering and tie-breaks, one row per team, `friends` scope, `me` block, `legacy` flag, cache headers.

Schema: migrations apply on empty Postgres; anon cannot read or write `v2_*`; `v2_finalize_run` updates PB only when better (equal score with fewer ticks wins).

### 13.2 Acceptance criteria
1. A 6-player online run from [06](./06-multiplayer.md) ends, every peer submits, one `v2_runs` row exists, `v2_run_players` has all claimed slots, and the board shows one crew row.
2. Changing one input byte in a stored replay and resubmitting yields `rejected hash_mismatch`; the board is unchanged.
3. Verification of a 6-player 180 s replay completes in under 10 s on the deployed function (logged `verify_ms`).
4. Recovering with the recovery code on a second browser restores the identity and PBs; the old token gets 401.
5. `https://<domain>/classic/` plays V1 fully, including its leaderboards (CORS works) and community levels.
6. Submitting from a client with an older `simVersion` shows the "reload" message and stores nothing.

---

## 14. Implementation order

| Step | Work | Depends on |
|---|---|---|
| B1 | `@ga/records` skeleton: `RunLog`, `.pkr` codec, `replayKey`, `sanitizeNickname`, tests | 02 codec (`encodeRushInput`), `RunConfig` |
| B2 | `verifyRun` + `InlineSimDriver` integration + tests with the bot | sim tickets (`InlineSimDriver`, `RunResult`) |
| B3 | `v2/supabase/migrations/0001_v2.sql` + CI schema test | - |
| B4 | `_shared/*` (`store`, `auth`, `ratelimit`, `errors`, `codes`) with `MemoryStore` | B3 |
| B5 | `identity.ts` + client `api.ts` identity + Account screen | B4 |
| B6 | `runs.ts` start/submit/status + `verify-run-background.ts` + `verify-sweep.ts` | B2, B4 |
| B7 | `boards.ts`, `/api/pb`, results screen integration, PB sync | B6 |
| B8 | `rooms.ts`, `turn.ts`, Realtime policies, `gc.ts`, `keep-alive.ts` (feeds [06 N8](./06-multiplayer.md#18-implementation-order)) | B4 |
| B9 | `friends.ts` + friends board scope | B7 |
| B10 | Heuristics, `admin.ts`, strikes | B6 |
| B11 | `/classic` proxy, V1 CORS and base-URL change, headers | independent, do early |
| B12 | Replay retention in `gc.ts`, ghost playback hook | B6 |
