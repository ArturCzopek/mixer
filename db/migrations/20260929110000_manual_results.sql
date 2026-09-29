-- Store all manual map scores and finish a locked mix in one transaction.
create function public.record_manual_mix_results(
  p_mix_id uuid, p_actor_id uuid, p_maps jsonb
) returns void
language plpgsql volatile
set search_path = ''
as $$
declare
  v_mix public.mixes%rowtype;
  v_map jsonb;
  v_number integer := 0;
begin
  select * into v_mix from public.mixes where id = p_mix_id for update;
  if not found or v_mix.status <> 'locked' or v_mix.chosen_variant_id is null then
    raise exception 'mix is not locked with a chosen variant'
      using errcode = 'object_not_in_prerequisite_state';
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
    raise exception 'at least one map is required' using errcode = 'check_violation';
  end if;
  for v_map in select value from jsonb_array_elements(p_maps) loop
    v_number := v_number + 1;
    if jsonb_typeof(v_map) <> 'object'
       or jsonb_typeof(v_map -> 'scoreA') <> 'number'
       or jsonb_typeof(v_map -> 'scoreB') <> 'number'
       or (v_map ->> 'scoreA') !~ '^[0-9]+$'
       or (v_map ->> 'scoreB') !~ '^[0-9]+$'
       or (v_map ? 'mapName' and jsonb_typeof(v_map -> 'mapName') <> 'string') then
      raise exception 'invalid map result' using errcode = 'check_violation';
    end if;
    insert into public.matches (mix_id, map_number, map_name, score_a, score_b, source, uploaded_by)
      values (p_mix_id, v_number, nullif(btrim(v_map ->> 'mapName'), ''),
              (v_map ->> 'scoreA')::smallint, (v_map ->> 'scoreB')::smallint,
              'manual', p_actor_id);
  end loop;
  update public.mixes set status = 'played' where id = p_mix_id;
end;
$$;

revoke execute on function public.record_manual_mix_results(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_manual_mix_results(uuid, uuid, jsonb)
  to service_role;

create function public.require_mix_result() returns trigger
language plpgsql volatile
set search_path = ''
as $$
begin
  if old.status = 'locked' and new.status = 'played'
     and not exists (select 1 from public.matches where mix_id = old.id) then
    raise exception 'played mix requires at least one map result'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger mixes_require_result
  before update of status on public.mixes
  for each row execute function public.require_mix_result();
revoke execute on function public.require_mix_result() from public, anon, authenticated;
