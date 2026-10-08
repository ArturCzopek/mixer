-- Persist exact FACEIT counts used by map awards. Absent values stay NULL.
alter table public.match_player_stats
  add column entry_attempts smallint check (entry_attempts >= 0),
  add column entry_wins smallint check (entry_wins >= 0),
  add column flashes_thrown smallint check (flashes_thrown >= 0),
  add column flashes_successful smallint check (flashes_successful >= 0),
  add column sniper_kills smallint check (sniper_kills >= 0),
  add column mvps smallint check (mvps >= 0),
  add constraint match_player_stats_entry_wins_lte_attempts_check check (
    entry_attempts is null or entry_wins is null or entry_wins <= entry_attempts
  ),
  add constraint match_player_stats_clutch_wins_lte_attempts_check check (
    clutch_attempts is null or clutch_wins is null or clutch_wins <= clutch_attempts
  ),
  add constraint match_player_stats_flash_successes_check check (
    flashes_thrown is null or flashes_successful is null
    or flashes_successful <= flashes_thrown
  );
create or replace function public.record_faceit_mix_results(
  p_mix_id uuid, p_actor_id uuid, p_locked_at timestamptz, p_maps jsonb
) returns void
language plpgsql volatile
set search_path = ''
as $$
declare
  v_mix public.mixes%rowtype;
  v_map jsonb;
  v_stat jsonb;
  v_match_id uuid;
  v_number integer := 0;
begin
  select * into v_mix from public.mixes where id = p_mix_id for update;
  if not found then
    raise exception 'mix not found' using errcode = 'object_not_in_prerequisite_state';
  end if;
  if not exists (
    select 1 from public.group_members gm
    where gm.group_id = v_mix.group_id and gm.player_id = p_actor_id
      and gm.role = 'admin' and gm.left_at is null
  ) and not exists (
    select 1 from public.players p where p.id = p_actor_id and p.is_site_admin
  ) then
    raise exception 'group admin required' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_maps) <> 'array' or jsonb_array_length(p_maps) < 1 then
    raise exception 'at least one room is required' using errcode = 'check_violation';
  end if;
  if v_mix.status = 'played' then
    if (select count(*) from public.matches where mix_id = p_mix_id) = jsonb_array_length(p_maps)
       and not exists (
         select 1 from jsonb_array_elements(p_maps) m
         where not exists (
           select 1 from public.matches r where r.mix_id = p_mix_id
             and r.faceit_match_id = m ->> 'faceitId'
         )
       ) then
      return; -- exact re-import is a no-op
    end if;
    raise exception 'mix already has results' using errcode = 'object_not_in_prerequisite_state';
  end if;
  if v_mix.status <> 'locked' or v_mix.chosen_variant_id is null
     or v_mix.locked_at is distinct from p_locked_at then
    raise exception 'mix is not locked' using errcode = 'object_not_in_prerequisite_state';
  end if;
  for v_map in select value from jsonb_array_elements(p_maps) loop
    v_number := v_number + 1;
    if jsonb_typeof(v_map) <> 'object'
       or nullif(v_map ->> 'faceitId', '') is null
       or jsonb_typeof(v_map -> 'scoreA') <> 'number'
       or jsonb_typeof(v_map -> 'scoreB') <> 'number'
       or (v_map ->> 'scoreA') !~ '^[0-9]+$'
       or (v_map ->> 'scoreB') !~ '^[0-9]+$'
       or jsonb_typeof(v_map -> 'stats') <> 'array' then
      raise exception 'invalid FACEIT map' using errcode = 'check_violation';
    end if;
    insert into public.matches (
      mix_id, map_number, map_name, played_at, score_a, score_b,
      source, faceit_match_id, faceit_demo_url, uploaded_by
    ) values (
      p_mix_id, v_number, nullif(btrim(v_map ->> 'mapName'), ''),
      (v_map ->> 'startedAt')::timestamptz,
      (v_map ->> 'scoreA')::smallint, (v_map ->> 'scoreB')::smallint,
      'faceit', v_map ->> 'faceitId', v_map ->> 'demoUrl', p_actor_id
    ) returning id into v_match_id;
    for v_stat in select value from jsonb_array_elements(v_map -> 'stats') loop
      insert into public.match_player_stats (
        match_id, player_id, team, kills, deaths, assists, damage, rounds,
        adr, rating, hs_kills, first_kills, multi_2k, multi_3k, multi_4k, multi_5k,
        utility_damage, enemies_flashed, entry_attempts, entry_wins, clutch_attempts, clutch_wins, flashes_thrown, flashes_successful, sniper_kills, mvps
      ) values (
        v_match_id, (v_stat ->> 'playerId')::uuid, (v_stat ->> 'team')::char(1),
        (v_stat ->> 'kills')::smallint, (v_stat ->> 'deaths')::smallint,
        (v_stat ->> 'assists')::smallint, (v_stat ->> 'damage')::integer,
        (v_stat ->> 'rounds')::smallint, (v_stat ->> 'adr')::numeric,
        (v_stat ->> 'rating')::numeric,
        (v_stat ->> 'headshots')::smallint, (v_stat ->> 'firstKills')::smallint,
        (v_stat ->> 'doubleKills')::smallint, (v_stat ->> 'tripleKills')::smallint,
        (v_stat ->> 'quadroKills')::smallint, (v_stat ->> 'pentaKills')::smallint,
        (v_stat ->> 'utilityDamage')::integer,
        (v_stat ->> 'enemiesFlashed')::smallint,
        (v_stat ->> 'entryAttempts')::smallint, (v_stat ->> 'entryWins')::smallint,
        (v_stat ->> 'clutchAttempts')::smallint, (v_stat ->> 'clutchWins')::smallint,
        (v_stat ->> 'flashesThrown')::smallint, (v_stat ->> 'flashesSuccessful')::smallint,
        (v_stat ->> 'sniperKills')::smallint, (v_stat ->> 'mvps')::smallint
      );
    end loop;
  end loop;
  update public.mixes set status = 'played' where id = p_mix_id;
end;
$$;

create or replace function public.enrich_manual_mix_results(
  p_mix_id uuid, p_actor_id uuid, p_locked_at timestamptz, p_maps jsonb
) returns void
language plpgsql volatile
set search_path = ''
as $$
declare
  v_mix public.mixes%rowtype;
  v_map jsonb;
  v_stat jsonb;
  v_match public.matches%rowtype;
  v_number integer := 0;
begin
  select * into v_mix from public.mixes where id = p_mix_id for update;
  if not found or v_mix.status <> 'played' or v_mix.archive_source is not null
     or v_mix.chosen_variant_id is null or v_mix.locked_at is distinct from p_locked_at then
    raise exception 'mix cannot be enriched' using errcode = 'object_not_in_prerequisite_state';
  end if;
  if not exists (
    select 1 from public.group_members gm
    where gm.group_id = v_mix.group_id and gm.player_id = p_actor_id
      and gm.role = 'admin' and gm.left_at is null
  ) and not exists (
    select 1 from public.players p where p.id = p_actor_id and p.is_site_admin
  ) then
    raise exception 'group admin required' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_maps) <> 'array' or jsonb_array_length(p_maps) < 1
     or (select count(*) from public.matches where mix_id = p_mix_id) <> jsonb_array_length(p_maps) then
    raise exception 'FACEIT maps must match manual maps' using errcode = 'check_violation';
  end if;
  for v_map in select value from jsonb_array_elements(p_maps) loop
    v_number := v_number + 1;
    select * into v_match from public.matches
      where mix_id = p_mix_id and map_number = v_number for update;
    if not found or v_match.source <> 'manual' or v_match.stats_origin is not null
       or v_match.faceit_match_id is not null
       or jsonb_typeof(v_map) <> 'object'
       or nullif(v_map ->> 'faceitId', '') is null
       or jsonb_typeof(v_map -> 'scoreA') <> 'number'
       or jsonb_typeof(v_map -> 'scoreB') <> 'number'
       or (v_map ->> 'scoreA') !~ '^[0-9]+$'
       or (v_map ->> 'scoreB') !~ '^[0-9]+$'
       or jsonb_typeof(v_map -> 'startedAt') <> 'string'
       or nullif(v_map ->> 'startedAt', '') is null
       or v_match.score_a <> (v_map ->> 'scoreA')::smallint
       or v_match.score_b <> (v_map ->> 'scoreB')::smallint
       or jsonb_typeof(v_map -> 'stats') <> 'array' then
      raise exception 'FACEIT map differs from manual result' using errcode = 'check_violation';
    end if;
    update public.matches set
      stats_origin = 'faceit',
      faceit_match_id = v_map ->> 'faceitId',
      faceit_demo_url = v_map ->> 'demoUrl',
      map_name = coalesce(map_name, nullif(btrim(v_map ->> 'mapName'), '')),
      played_at = (v_map ->> 'startedAt')::timestamptz
      where id = v_match.id;
    for v_stat in select value from jsonb_array_elements(v_map -> 'stats') loop
      insert into public.match_player_stats (
        match_id, player_id, team, kills, deaths, assists, damage, rounds,
        adr, rating, hs_kills, first_kills, multi_2k, multi_3k, multi_4k, multi_5k,
        utility_damage, enemies_flashed, entry_attempts, entry_wins, clutch_attempts, clutch_wins, flashes_thrown, flashes_successful, sniper_kills, mvps
      ) values (
        v_match.id, (v_stat ->> 'playerId')::uuid, (v_stat ->> 'team')::char(1),
        (v_stat ->> 'kills')::smallint, (v_stat ->> 'deaths')::smallint,
        (v_stat ->> 'assists')::smallint, (v_stat ->> 'damage')::integer,
        (v_stat ->> 'rounds')::smallint, (v_stat ->> 'adr')::numeric,
        (v_stat ->> 'rating')::numeric,
        (v_stat ->> 'headshots')::smallint, (v_stat ->> 'firstKills')::smallint,
        (v_stat ->> 'doubleKills')::smallint, (v_stat ->> 'tripleKills')::smallint,
        (v_stat ->> 'quadroKills')::smallint, (v_stat ->> 'pentaKills')::smallint,
        (v_stat ->> 'utilityDamage')::integer,
        (v_stat ->> 'enemiesFlashed')::smallint,
        (v_stat ->> 'entryAttempts')::smallint, (v_stat ->> 'entryWins')::smallint,
        (v_stat ->> 'clutchAttempts')::smallint, (v_stat ->> 'clutchWins')::smallint,
        (v_stat ->> 'flashesThrown')::smallint, (v_stat ->> 'flashesSuccessful')::smallint,
        (v_stat ->> 'sniperKills')::smallint, (v_stat ->> 'mvps')::smallint
      );
    end loop;
  end loop;
end;
$$;
