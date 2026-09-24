-- Phase 1 tables (docs/03-data-model.md): players, mixes, mix_participants, variants,
-- variant_players, votes. All writes go through server code with the secret (service role) key;
-- browsers (anon / publishable key) may only select (D2).

create table public.players (
  id uuid primary key default gen_random_uuid(),
  steam_id text not null unique check (steam_id ~ '^[0-9]{17}$'),
  display_name text,
  avatar_url text,
  faceit_player_id text unique,
  faceit_nickname text,
  preferred_role text not null default 'any' check (preferred_role in ('awp', 'rifle', 'any')),
  is_admin boolean not null default false,
  is_active boolean not null default true,
  manual_skill_override integer check (manual_skill_override between 100 and 5000),
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.mixes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  scheduled_at timestamptz,
  status text not null default 'open'
    check (status in ('open', 'balancing', 'voting', 'locked', 'played', 'cancelled')),
  created_by uuid not null references public.players (id),
  chosen_variant_id uuid, -- fk added below (variants references mixes)
  balance_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.mix_participants (
  mix_id uuid not null references public.mixes (id) on delete cascade,
  player_id uuid not null references public.players (id),
  added_by uuid not null references public.players (id),
  skill_snapshot jsonb,
  created_at timestamptz not null default now(),
  primary key (mix_id, player_id)
);
create index mix_participants_player_idx on public.mix_participants (player_id);

create table public.variants (
  id uuid primary key default gen_random_uuid(),
  mix_id uuid not null references public.mixes (id) on delete cascade,
  number smallint not null check (number >= 1),
  is_published boolean not null default false,
  team_a_score numeric not null,
  team_b_score numeric not null,
  win_prob_a numeric not null check (win_prob_a between 0 and 1),
  penalty numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (mix_id, number),
  unique (id, mix_id) -- target of the composite fks that pin a variant to its mix
);

alter table public.mixes
  add constraint mixes_chosen_variant_fk
  foreign key (chosen_variant_id, id) references public.variants (id, mix_id);

create table public.variant_players (
  variant_id uuid not null references public.variants (id) on delete cascade,
  player_id uuid not null references public.players (id),
  team char(1) not null check (team in ('A', 'B')),
  primary key (variant_id, player_id)
);

create table public.votes (
  mix_id uuid not null references public.mixes (id) on delete cascade,
  voter_id uuid not null,
  variant_id uuid not null,
  cast_by uuid not null references public.players (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (mix_id, voter_id),
  -- only participants vote, and only for a variant of the same mix
  foreign key (mix_id, voter_id) references public.mix_participants (mix_id, player_id) on delete cascade,
  foreign key (variant_id, mix_id) references public.variants (id, mix_id) on delete cascade
);
create index votes_variant_idx on public.votes (variant_id);

-- Hard cap of 10 participants, safe under concurrent joins: the mix row is locked first,
-- so two inserts for the same mix are serialized before counting.
create function public.enforce_mix_cap() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform 1 from public.mixes where id = new.mix_id for update;
  if (select count(*) from public.mix_participants where mix_id = new.mix_id) >= 10 then
    raise exception 'mix % is full (10 players)', new.mix_id using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger mix_participants_cap
  before insert on public.mix_participants
  for each row execute function public.enforce_mix_cap();

create function public.touch_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger votes_touch_updated_at
  before update on public.votes
  for each row execute function public.touch_updated_at();

-- Read-only for browsers: RLS on, select-only policies, and no write grants for anon/authenticated.
do $$
declare
  t text;
begin
  foreach t in array array['players', 'mixes', 'mix_participants', 'variants', 'variant_players', 'votes']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "public read" on public.%I for select to anon, authenticated using (true)', t);
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
  end loop;
end;
$$;

revoke execute on function public.enforce_mix_cap() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

-- Live lobby and voting (docs/02 "Realtime")
alter publication supabase_realtime
  add table public.mixes, public.mix_participants, public.variants, public.votes;
