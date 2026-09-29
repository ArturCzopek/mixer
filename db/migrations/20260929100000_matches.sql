-- One result per map. A manual result needs only a score; stats and raw payloads are optional.
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  mix_id uuid references public.mixes (id) on delete cascade,
  map_number integer not null default 1 check (map_number > 0),
  map_name text check (length(btrim(map_name)) between 1 and 60),
  played_at timestamptz not null default now(),
  score_a smallint not null check (score_a >= 0),
  score_b smallint not null check (score_b >= 0),
  winner char(1) generated always as (
    case when score_a > score_b then 'A'::char(1)
         when score_b > score_a then 'B'::char(1)
         else null end
  ) stored,
  source text not null check (source in ('faceit', 'manual', 'demo')),
  faceit_match_id text check (length(btrim(faceit_match_id)) > 0),
  demo_hash text unique,
  demo_recorder_id uuid references public.players (id),
  parser_version text,
  uploaded_by uuid references public.players (id),
  created_at timestamptz not null default now(),
  unique (mix_id, map_number),
  unique (faceit_match_id, map_number)
);

create table public.match_player_stats (
  match_id uuid not null references public.matches (id) on delete cascade,
  player_id uuid not null references public.players (id),
  team char(1) not null check (team in ('A', 'B')),
  kills smallint check (kills >= 0),
  deaths smallint check (deaths >= 0),
  assists smallint check (assists >= 0),
  damage integer check (damage >= 0),
  rounds smallint check (rounds >= 0),
  adr numeric check (adr >= 0),
  hs_kills smallint check (hs_kills >= 0),
  kast_rounds smallint check (kast_rounds >= 0),
  first_kills smallint check (first_kills >= 0),
  first_deaths smallint check (first_deaths >= 0),
  trade_kills smallint check (trade_kills >= 0),
  traded_deaths smallint check (traded_deaths >= 0),
  multi_2k smallint check (multi_2k >= 0),
  multi_3k smallint check (multi_3k >= 0),
  multi_4k smallint check (multi_4k >= 0),
  multi_5k smallint check (multi_5k >= 0),
  clutch_attempts smallint check (clutch_attempts >= 0),
  clutch_wins smallint check (clutch_wins >= 0),
  utility_damage integer check (utility_damage >= 0),
  enemies_flashed smallint check (enemies_flashed >= 0),
  flash_assists smallint check (flash_assists >= 0),
  rating numeric,
  raw jsonb not null default '{}'::jsonb check (jsonb_typeof(raw) = 'object'),
  created_at timestamptz not null default now(),
  primary key (match_id, player_id)
);
create index match_player_stats_player_idx on public.match_player_stats (player_id);

create table public.match_payloads (
  match_id uuid primary key references public.matches (id) on delete cascade,
  parser_version text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

-- Browser clients can read results, but all writes stay behind authenticated server actions.
alter table public.matches enable row level security;
alter table public.match_player_stats enable row level security;
alter table public.match_payloads enable row level security;
create policy "public read" on public.matches for select to anon, authenticated using (true);
create policy "public read" on public.match_player_stats for select to anon, authenticated using (true);
create policy "public read" on public.match_payloads for select to anon, authenticated using (true);
revoke all on public.matches, public.match_player_stats, public.match_payloads
  from public, anon, authenticated;
grant select on public.matches, public.match_player_stats, public.match_payloads
  to anon, authenticated;
grant all on public.matches, public.match_player_stats, public.match_payloads
  to service_role;
