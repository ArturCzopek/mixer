-- M1-6: generation sets are private until approval, then frozen. Swaps preserve each player's
-- approved team slot without recalculating the stored scores.

alter table public.variants
  add column generation integer not null default 1 check (generation >= 1),
  add column rejected_at timestamptz,
  add column split_key text,
  add column details jsonb not null default '{}'::jsonb;

alter table public.mixes
  add column swap_log jsonb not null default '[]'::jsonb
    check (jsonb_typeof(swap_log) = 'array');

create function public.mix_variant_split_key(p_variant_id uuid) returns text
language sql
stable
set search_path = ''
as $$
  with roster as (
    select vp.team, p.steam_id
    from public.variant_players vp
    join public.players p on p.id = vp.player_id
    where vp.variant_id = p_variant_id
  ),
  lowest as (select min(steam_id) as steam_id from roster)
  select array_to_string(array_agg(r.steam_id order by r.steam_id), ',')
  from roster r
  where r.team = (
    select r2.team
    from roster r2, lowest l
    where r2.steam_id = l.steam_id
  )
$$;

create function public.guard_mix_variant() returns trigger
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_mix_id uuid;
begin
  v_mix_id := case when tg_op = 'DELETE' then old.mix_id else new.mix_id end;
  perform 1 from public.mixes where id = v_mix_id for update;

  if tg_op = 'INSERT' then
    if exists (
      select 1 from public.variants v
      where v.mix_id = new.mix_id and v.is_published
    ) then
      raise exception 'published variants for mix % are immutable', new.mix_id
        using errcode = 'object_not_in_prerequisite_state';
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    -- Let deleting a whole mix cascade; direct variant deletes remain forbidden after publication.
    if pg_trigger_depth() = 1 and exists (
      select 1 from public.variants v
      where v.mix_id = old.mix_id and v.is_published
    ) then
      raise exception 'published variants for mix % cannot be deleted', old.mix_id
        using errcode = 'object_not_in_prerequisite_state';
    end if;
    return old;
  end if;

  if old.mix_id <> new.mix_id or old.number <> new.number or old.generation <> new.generation then
    raise exception 'variant identity is immutable'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  if old.is_published and not new.is_published then
    raise exception 'a published variant cannot be unpublished'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  if not old.is_published and new.is_published and old.rejected_at is not null then
    raise exception 'a rejected variant cannot be published'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  if exists (
    select 1 from public.variants v
    where v.mix_id = old.mix_id and v.is_published
  ) and (
    old.team_a_score is distinct from new.team_a_score or
    old.team_b_score is distinct from new.team_b_score or
    old.win_prob_a is distinct from new.win_prob_a or
    old.penalty is distinct from new.penalty or
    old.details is distinct from new.details
  ) then
    raise exception 'published variant scores and details are immutable'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  if exists (
    select 1 from public.variants v
    where v.mix_id = old.mix_id and v.is_published
  ) and old.rejected_at is distinct from new.rejected_at then
    raise exception 'published variants cannot be rejected'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  return new;
end;
$$;

create trigger variants_guard
  before insert or update or delete on public.variants
  for each row execute function public.guard_mix_variant();

create function public.guard_mix_variant_player() returns trigger
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_variant_id uuid;
  v_mix_id uuid;
begin
  v_variant_id := case when tg_op = 'DELETE' then old.variant_id else new.variant_id end;
  select v.mix_id into v_mix_id
  from public.variants v
  where v.id = v_variant_id;

  -- Parent cascades (mix/group deletion) have already removed the variant.
  if not found then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  perform 1 from public.mixes where id = v_mix_id for update;

  if tg_op = 'INSERT' then
    if exists (
      select 1 from public.variants v
      where v.mix_id = v_mix_id and v.is_published
    ) then
      raise exception 'players of published variants cannot be added'
        using errcode = 'object_not_in_prerequisite_state';
    end if;
    if not exists (
      select 1 from public.mix_participants mp
      where mp.mix_id = v_mix_id and mp.player_id = new.player_id
    ) then
      raise exception 'variant players must be mix participants'
        using errcode = 'foreign_key_violation';
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if pg_trigger_depth() = 1 and exists (
      select 1 from public.variants v
      where v.mix_id = v_mix_id and v.is_published
    ) then
      raise exception 'players of published variants cannot be deleted'
        using errcode = 'object_not_in_prerequisite_state';
    end if;
    return old;
  end if;

  if new.variant_id <> old.variant_id or new.team is distinct from old.team then
    raise exception 'a variant player team slot is immutable'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  if new.player_id is distinct from old.player_id
     and exists (
       select 1 from public.variants v
       where v.mix_id = v_mix_id and v.is_published
     )
     and exists (
       select 1 from public.mix_participants mp
       where mp.mix_id = v_mix_id and mp.player_id = old.player_id
     ) then
    raise exception 'published variant players can only change through a completed participant swap'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  if not exists (
    select 1 from public.mix_participants mp
    where mp.mix_id = v_mix_id and mp.player_id = new.player_id
  ) then
    raise exception 'replacement must be a mix participant'
      using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;

create trigger variant_players_guard
  before insert or update or delete on public.variant_players
  for each row execute function public.guard_mix_variant_player();

create function public.insert_mix_variant_set(
  p_mix_id uuid,
  p_generation integer,
  p_variants jsonb,
  p_snapshots jsonb default null,
  p_balance_config jsonb default null
) returns void
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_item jsonb;
  v_team_a uuid[];
  v_team_b uuid[];
  v_all uuid[];
  v_variant_id uuid;
  v_position integer := 0;
  v_participants integer;
  v_count integer;
begin
  select count(*) into v_participants
  from public.mix_participants mp where mp.mix_id = p_mix_id;
  if v_participants <> 10 then
    raise exception 'mix % needs exactly 10 participants', p_mix_id
      using errcode = 'check_violation';
  end if;
  if jsonb_typeof(p_variants) is distinct from 'array' then
    raise exception 'a variant set must be a JSON array'
      using errcode = 'check_violation';
  end if;
  if jsonb_array_length(p_variants) <> 3 then
    raise exception 'a variant set must contain exactly three variants'
      using errcode = 'check_violation';
  end if;

  if p_snapshots is not null then
    if jsonb_typeof(p_snapshots) is distinct from 'array' then
      raise exception 'skill snapshots must be a JSON array'
        using errcode = 'check_violation';
    end if;
    if jsonb_array_length(p_snapshots) <> 10 then
      raise exception 'a skill snapshot is required for each participant'
        using errcode = 'check_violation';
    end if;
    update public.mix_participants mp
    set skill_snapshot = s.value -> 'snapshot'
    from jsonb_array_elements(p_snapshots) s(value)
    where mp.mix_id = p_mix_id
      and mp.player_id = (s.value ->> 'playerId')::uuid;
    get diagnostics v_count = row_count;
    if v_count <> 10 then
      raise exception 'skill snapshots do not match the mix participants'
        using errcode = 'foreign_key_violation';
    end if;
    update public.mixes
    set balance_config = coalesce(p_balance_config, '{}'::jsonb)
    where id = p_mix_id;
  end if;

  for v_item in
    select value from jsonb_array_elements(p_variants) with ordinality as x(value, ord)
    order by ord
  loop
    v_position := v_position + 1;
    select array_agg(value::uuid order by ord)
    into v_team_a
    from jsonb_array_elements_text(v_item -> 'teamA') with ordinality as x(value, ord);
    select array_agg(value::uuid order by ord)
    into v_team_b
    from jsonb_array_elements_text(v_item -> 'teamB') with ordinality as x(value, ord);

    if cardinality(v_team_a) <> 5 or cardinality(v_team_b) <> 5 then
      raise exception 'each variant must have two teams of five'
        using errcode = 'check_violation';
    end if;
    v_all := v_team_a || v_team_b;
    if (select count(distinct x) from unnest(v_all) x) <> 10
       or exists (
         select 1 from unnest(v_all) x
         where not exists (
           select 1 from public.mix_participants mp
           where mp.mix_id = p_mix_id and mp.player_id = x
         )
       ) then
      raise exception 'variant teams must contain each mix participant exactly once'
        using errcode = 'foreign_key_violation';
    end if;

    insert into public.variants (
      mix_id, number, generation, split_key, details, team_a_score, team_b_score,
      win_prob_a, penalty
    ) values (
      p_mix_id,
      (p_generation - 1) * 3 + v_position,
      p_generation,
      v_item ->> 'splitKey',
      coalesce(v_item -> 'details', '{}'::jsonb),
      (v_item ->> 'avgA')::numeric,
      (v_item ->> 'avgB')::numeric,
      (v_item ->> 'winProbA')::numeric,
      coalesce((v_item ->> 'penalty')::numeric, 0)
    ) returning id into v_variant_id;

    insert into public.variant_players (variant_id, player_id, team)
    select v_variant_id, x, 'A' from unnest(v_team_a) x
    union all
    select v_variant_id, x, 'B' from unnest(v_team_b) x;
  end loop;
end;
$$;

create function public.create_mix_variant_set(
  p_mix_id uuid,
  p_balance_config jsonb,
  p_snapshots jsonb,
  p_variants jsonb
) returns void
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_status text;
begin
  select m.status into v_status from public.mixes m where m.id = p_mix_id for update;
  if not found or v_status <> 'balancing' then
    raise exception 'mix is not balancing' using errcode = 'object_not_in_prerequisite_state';
  end if;
  if exists (select 1 from public.variants v where v.mix_id = p_mix_id) then
    raise exception 'variants already exist for mix %', p_mix_id
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  perform public.insert_mix_variant_set(p_mix_id, 1, p_variants, p_snapshots, p_balance_config);
end;
$$;

create function public.reroll_mix_variant_set(
  p_mix_id uuid,
  p_expected_generation integer,
  p_variants jsonb
) returns void
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_status text;
  v_generation integer;
  v_count integer;
begin
  select m.status into v_status from public.mixes m where m.id = p_mix_id for update;
  if not found or v_status <> 'balancing' then
    raise exception 'mix is not balancing' using errcode = 'object_not_in_prerequisite_state';
  end if;
  select max(v.generation) into v_generation from public.variants v where v.mix_id = p_mix_id;
  if v_generation is distinct from p_expected_generation then
    raise exception 'variant set changed; refresh before retrying'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  select count(*) into v_count
  from public.variants v
  where v.mix_id = p_mix_id and v.generation = v_generation
    and v.rejected_at is null and not v.is_published;
  if v_count <> 3 or exists (
    select 1 from public.variants v where v.mix_id = p_mix_id and v.is_published
  ) then
    raise exception 'only the current unpublished variant set can be re-rolled'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_variants) n(value)
    join public.variants old on old.mix_id = p_mix_id
      and old.split_key = n.value ->> 'splitKey'
  ) then
    raise exception 're-roll repeats a split already shown for this mix'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  update public.variants
  set rejected_at = now()
  where mix_id = p_mix_id and generation = v_generation and rejected_at is null;
  perform public.insert_mix_variant_set(p_mix_id, v_generation + 1, p_variants);
end;
$$;

create function public.approve_mix_variant_set(
  p_mix_id uuid,
  p_expected_generation integer
) returns void
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_status text;
  v_generation integer;
  v_count integer;
begin
  select m.status into v_status from public.mixes m where m.id = p_mix_id for update;
  if not found or v_status <> 'balancing' then
    raise exception 'mix is not balancing' using errcode = 'object_not_in_prerequisite_state';
  end if;
  select max(v.generation) into v_generation from public.variants v where v.mix_id = p_mix_id;
  if v_generation is distinct from p_expected_generation then
    raise exception 'variant set changed; refresh before approving'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  select count(*) into v_count
  from public.variants v
  where v.mix_id = p_mix_id and v.generation = v_generation
    and v.rejected_at is null and not v.is_published;
  if v_count <> 3 then
    raise exception 'approval requires exactly three unpublished variants in the latest set'
      using errcode = 'check_violation';
  end if;
  if exists (
    select 1 from public.variants v
    where v.mix_id = p_mix_id and v.is_published
  ) then
    raise exception 'a published variant set cannot be approved again'
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  update public.variants
  set is_published = true
  where mix_id = p_mix_id and generation = v_generation and rejected_at is null;
  update public.mixes set status = 'voting' where id = p_mix_id;
end;
$$;

create function public.swap_mix_participant(
  p_mix_id uuid,
  p_leaving_player_id uuid,
  p_joining_player_id uuid,
  p_admin_id uuid
) returns void
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_group_id uuid;
  v_status text;
  v_leaving_steam_id text;
  v_joining_steam_id text;
  v_leaving_name text;
  v_joining_name text;
  v_admin_name text;
  v_snapshot jsonb;
begin
  select m.group_id, m.status into v_group_id, v_status
  from public.mixes m where m.id = p_mix_id for update;
  if not found or v_status not in ('balancing', 'voting', 'locked') then
    raise exception 'mix does not allow participant swaps'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  if p_leaving_player_id = p_joining_player_id then
    raise exception 'swap participants must be different' using errcode = 'check_violation';
  end if;
  select p.steam_id, coalesce(p.display_name, p.steam_id)
  into v_leaving_steam_id, v_leaving_name
  from public.players p where p.id = p_leaving_player_id;
  select p.steam_id, coalesce(p.display_name, p.steam_id)
  into v_joining_steam_id, v_joining_name
  from public.players p where p.id = p_joining_player_id;
  select coalesce(p.display_name, p.steam_id) into v_admin_name
  from public.players p where p.id = p_admin_id;
  if not exists (
    select 1 from public.mix_participants mp
    where mp.mix_id = p_mix_id and mp.player_id = p_leaving_player_id
  ) then
    raise exception 'leaving player is not in this mix'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  if not exists (
    select 1 from public.group_members gm
    where gm.group_id = v_group_id and gm.player_id = p_joining_player_id
      and gm.left_at is null
  ) or exists (
    select 1 from public.mix_participants mp
    where mp.mix_id = p_mix_id and mp.player_id = p_joining_player_id
  ) then
    raise exception 'replacement must be an active group member not in the mix'
      using errcode = 'foreign_key_violation';
  end if;

  delete from public.votes
  where mix_id = p_mix_id and voter_id = p_leaving_player_id;
  select mp.skill_snapshot into v_snapshot
  from public.mix_participants mp
  where mp.mix_id = p_mix_id and mp.player_id = p_leaving_player_id;
  update public.mix_participants
  set player_id = p_joining_player_id,
      skill_snapshot = case when v_snapshot is null then null else
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(v_snapshot, '{input,steamId}', to_jsonb(v_joining_steam_id), true),
              '{input,eloSource}', '"swap-slot"'::jsonb, true
            ),
            '{input,swapInheritedFrom}', to_jsonb(v_leaving_steam_id), true
          ),
          '{breakdown,steamId}', to_jsonb(v_joining_steam_id), true
        )
        end
  where mix_id = p_mix_id and player_id = p_leaving_player_id;
  update public.variant_players vp
  set player_id = p_joining_player_id
  from public.variants v
  where vp.variant_id = v.id and v.mix_id = p_mix_id
    and vp.player_id = p_leaving_player_id;
  update public.variants v
  set split_key = public.mix_variant_split_key(v.id)
  where v.mix_id = p_mix_id;
  update public.mixes
  set swap_log = swap_log || jsonb_build_array(jsonb_build_object(
    'from', p_leaving_player_id,
    'fromSteamId', v_leaving_steam_id,
    'fromName', v_leaving_name,
    'to', p_joining_player_id,
    'toSteamId', v_joining_steam_id,
    'toName', v_joining_name,
    'by', p_admin_id,
    'byName', v_admin_name,
    'at', now()
  ))
  where id = p_mix_id;
end;
$$;

create or replace function public.enforce_mix_status_transition() returns trigger
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_count integer;
  v_set_count integer;
  v_generation integer;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if old.status = 'open' and new.status = 'balancing' then
    select count(*) into v_count from public.mix_participants where mix_id = old.id;
    if v_count <> 10 then
      raise exception 'mix % needs exactly 10 participants before balancing', old.id
        using errcode = 'check_violation';
    end if;
  elsif old.status = 'balancing' and new.status = 'open' then
    if exists (select 1 from public.variants v where v.mix_id = old.id and v.is_published) then
      raise exception 'published variants cannot be reopened for sign-ups'
        using errcode = 'object_not_in_prerequisite_state';
    end if;
    delete from public.variants v where v.mix_id = old.id and not v.is_published;
    update public.mix_participants set skill_snapshot = null where mix_id = old.id;
    new.balance_config := '{}'::jsonb;
  elsif old.status = 'balancing' and new.status = 'voting' then
    select max(v.generation) into v_generation
    from public.variants v where v.mix_id = old.id;
    select count(*) into v_count
    from public.variants v
    where v.mix_id = old.id and v.generation = v_generation
      and v.rejected_at is null and v.is_published;
    select count(*) into v_set_count
    from public.variants v
    where v.mix_id = old.id and v.generation = v_generation
      and v.rejected_at is null;
    if v_count <> 3 or v_set_count <> 3 or (
      select count(*) from public.variants v
      where v.mix_id = old.id and v.is_published
    ) <> 3 then
      raise exception 'balancing to voting requires exactly three published variants in the latest set'
        using errcode = 'check_violation';
    end if;
  elsif old.status = 'voting' and new.status = 'locked' then
    null;
  elsif old.status = 'locked' and new.status in ('voting', 'played') then
    null;
  elsif old.status in ('open', 'balancing', 'voting', 'locked')
        and new.status = 'cancelled' then
    null;
  else
    raise exception 'invalid mix status transition: % -> %', old.status, new.status
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  return new;
end;
$$;

revoke execute on function public.mix_variant_split_key(uuid) from public, anon, authenticated;
revoke execute on function public.guard_mix_variant() from public, anon, authenticated;
revoke execute on function public.guard_mix_variant_player() from public, anon, authenticated;
revoke execute on function public.insert_mix_variant_set(uuid, integer, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
revoke execute on function public.create_mix_variant_set(uuid, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
revoke execute on function public.reroll_mix_variant_set(uuid, integer, jsonb)
  from public, anon, authenticated;
revoke execute on function public.approve_mix_variant_set(uuid, integer)
  from public, anon, authenticated;
revoke execute on function public.swap_mix_participant(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.create_mix_variant_set(uuid, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.reroll_mix_variant_set(uuid, integer, jsonb) to service_role;
grant execute on function public.approve_mix_variant_set(uuid, integer) to service_role;
grant execute on function public.swap_mix_participant(uuid, uuid, uuid, uuid) to service_role;
grant execute on function public.mix_variant_split_key(uuid) to service_role;
grant execute on function public.insert_mix_variant_set(uuid, integer, jsonb, jsonb, jsonb) to service_role;

revoke execute on function public.enforce_mix_status_transition() from public, anon, authenticated;
