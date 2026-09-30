-- Preserve manually entered scores while attaching later FACEIT stats to the same maps.
alter table public.matches drop constraint matches_stats_origin_check;
alter table public.matches add constraint matches_stats_origin_check check (
  stats_origin is null or (source = 'manual' and stats_origin in ('popflash', 'faceit'))
);

create function public.enrich_manual_mix_results(
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
        utility_damage, enemies_flashed
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
        (v_stat ->> 'enemiesFlashed')::smallint
      );
    end loop;
  end loop;
end;
$$;

revoke execute on function public.enrich_manual_mix_results(uuid, uuid, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.enrich_manual_mix_results(uuid, uuid, timestamptz, jsonb)
  to service_role;
