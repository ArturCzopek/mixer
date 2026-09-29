-- A FACEIT room represents one map. Keep its demo link, not the demo file.
alter table public.matches add column faceit_demo_url text
  check (faceit_demo_url is null or faceit_demo_url ~ '^https://');
create unique index matches_faceit_id_unique on public.matches (faceit_match_id)
  where faceit_match_id is not null;

create function public.record_faceit_mix_results(
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
        utility_damage, enemies_flashed
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
        (v_stat ->> 'enemiesFlashed')::smallint
      );
    end loop;
  end loop;
  update public.mixes set status = 'played' where id = p_mix_id;
end;
$$;

revoke execute on function public.record_faceit_mix_results(uuid, uuid, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_faceit_mix_results(uuid, uuid, timestamptz, jsonb)
  to service_role;
