-- A verified demo enriches one existing played map without changing its result provenance.
alter table public.matches drop constraint matches_stats_origin_check;
alter table public.matches add constraint matches_stats_origin_check check (
  stats_origin is null or stats_origin = 'demo'
  or (source = 'manual' and stats_origin in ('popflash', 'faceit'))
);

create function public.attach_demo_to_match(
  p_match_id uuid, p_actor_id uuid, p_demo_hash text, p_map_name text,
  p_score_a integer, p_score_b integer, p_rows jsonb, p_payload jsonb
) returns void
language plpgsql volatile
set search_path = ''
as $$
declare
  v_mix public.mixes%rowtype;
  v_match public.matches%rowtype;
  v_row jsonb;
  v_count integer;
begin
  select m.* into v_mix from public.mixes m
    join public.matches r on r.mix_id = m.id where r.id = p_match_id for update of m;
  if not found or v_mix.status <> 'played' then
    raise exception 'played mix required' using errcode = 'object_not_in_prerequisite_state';
  end if;
  if not exists (select 1 from public.group_members gm
      where gm.group_id = v_mix.group_id and gm.player_id = p_actor_id and gm.left_at is null) then
    raise exception 'active group member required' using errcode = 'insufficient_privilege';
  end if;
  select * into v_match from public.matches where id = p_match_id for update;
  if v_match.demo_hash = p_demo_hash then return; end if;
  if v_match.demo_hash is not null or exists (
      select 1 from public.matches where demo_hash = p_demo_hash and id <> p_match_id) then
    raise exception 'demo already attached' using errcode = 'unique_violation';
  end if;
  if p_demo_hash !~ '^[0-9a-f]{64}$' or p_map_name is null
     or length(p_map_name) > 60 or v_match.score_a <> p_score_a
     or v_match.score_b <> p_score_b
     or (v_match.map_name is not null and
       lower(regexp_replace(v_match.map_name, '^de_', '', 'i')) <>
       lower(regexp_replace(p_map_name, '^de_', '', 'i')))
     or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) <> 10
     or jsonb_typeof(p_payload) <> 'object' or length(p_payload::text) > 2000000 then
    raise exception 'demo differs from played map' using errcode = 'check_violation';
  end if;
  if (select count(distinct x ->> 'steamid') from jsonb_array_elements(p_rows) x) <> 10
     or (select count(distinct x ->> 'playerId') from jsonb_array_elements(p_rows) x) <> 10
     or (select count(*) from jsonb_array_elements(p_rows) x where x ->> 'team' = 'A') <> 5
     or (select count(*) from jsonb_array_elements(p_rows) x where x ->> 'team' = 'B') <> 5
     or exists (
       select 1 from jsonb_array_elements(p_rows) x
       left join public.players p on p.id = (x ->> 'playerId')::uuid
       where p.steam_id is distinct from x ->> 'steamid'
     ) then
    raise exception 'invalid demo roster' using errcode = 'check_violation';
  end if;
  -- A full recorded scoreboard reflects actual teams; score-only maps use voted slots.
  if (select count(*) from public.match_player_stats where match_id = p_match_id) not in (0, 10) then
    raise exception 'partial recorded lineup for demo' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.match_player_stats where match_id = p_match_id) = 10 then
    select count(*) into v_count from jsonb_array_elements(p_rows) x
      join public.match_player_stats s on s.match_id = p_match_id
        and s.player_id = (x ->> 'playerId')::uuid and s.team = x ->> 'team';
  elsif v_mix.chosen_variant_id is not null then
    select count(*) into v_count from jsonb_array_elements(p_rows) x
      join public.variant_players vp on vp.variant_id = v_mix.chosen_variant_id
        and vp.player_id = (x ->> 'playerId')::uuid and vp.team = x ->> 'team';
  else
    raise exception 'no recorded lineup for demo' using errcode = 'check_violation';
  end if;
  if v_count <> 10 then
    raise exception 'demo roster differs from played lineup' using errcode = 'check_violation';
  end if;
  update public.matches set demo_hash = p_demo_hash, stats_origin = 'demo',
    parser_version = 'demo-v1', uploaded_by = p_actor_id,
    map_name = coalesce(map_name, p_map_name) where id = p_match_id;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    insert into public.match_player_stats (
      match_id, player_id, team, kills, deaths, assists, damage, rounds, adr,
      rating, hs_kills, kast_rounds, first_kills, first_deaths, trade_kills,
      traded_deaths, multi_2k, multi_3k, multi_4k, multi_5k,
      clutch_attempts, clutch_wins, utility_damage, enemies_flashed,
      flash_assists, raw
    ) values (
      p_match_id, (v_row ->> 'playerId')::uuid, v_row ->> 'team',
      (v_row ->> 'kills')::smallint, (v_row ->> 'deaths')::smallint,
      (v_row ->> 'assists')::smallint, (v_row ->> 'damage')::integer,
      (v_row ->> 'rounds')::smallint, (v_row ->> 'adr')::numeric,
      (v_row ->> 'rating')::numeric, (v_row ->> 'headshots')::smallint,
      (v_row ->> 'kastRounds')::smallint, (v_row ->> 'openingKills')::smallint,
      (v_row ->> 'openingDeaths')::smallint, (v_row ->> 'tradeKills')::smallint,
      (v_row ->> 'tradedDeaths')::smallint, (v_row ->> 'multi2')::smallint,
      (v_row ->> 'multi3')::smallint, (v_row ->> 'multi4')::smallint,
      (v_row ->> 'multi5')::smallint, (v_row ->> 'clutchAttempts')::smallint,
      (v_row ->> 'clutchWins')::smallint, (v_row ->> 'utilityDamage')::integer,
      (v_row ->> 'enemiesFlashed')::smallint, (v_row ->> 'flashAssists')::smallint,
      v_row -> 'raw'
    ) on conflict (match_id, player_id) do update set
      team = excluded.team,
      kills = excluded.kills, deaths = excluded.deaths, assists = excluded.assists,
      damage = excluded.damage, rounds = excluded.rounds, adr = excluded.adr,
      rating = excluded.rating, hs_kills = excluded.hs_kills,
      kast_rounds = excluded.kast_rounds, first_kills = excluded.first_kills,
      first_deaths = excluded.first_deaths, trade_kills = excluded.trade_kills,
      traded_deaths = excluded.traded_deaths, multi_2k = excluded.multi_2k,
      multi_3k = excluded.multi_3k, multi_4k = excluded.multi_4k,
      multi_5k = excluded.multi_5k, clutch_attempts = excluded.clutch_attempts,
      clutch_wins = excluded.clutch_wins, utility_damage = excluded.utility_damage,
      enemies_flashed = excluded.enemies_flashed, flash_assists = excluded.flash_assists,
      raw = excluded.raw || jsonb_build_object('_previous', public.match_player_stats.raw);
  end loop;
  insert into public.match_payloads (match_id, parser_version, payload)
    values (p_match_id, 'demo-v1', p_payload)
    on conflict (match_id) do update set parser_version = excluded.parser_version,
      payload = excluded.payload || jsonb_build_object('_previous', public.match_payloads.payload);
end;
$$;

revoke execute on function public.attach_demo_to_match(uuid, uuid, text, text, integer, integer, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.attach_demo_to_match(uuid, uuid, text, text, integer, integer, jsonb, jsonb)
  to service_role;
