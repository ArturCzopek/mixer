-- A historical import records the one lineup that actually played; it never invents votes
-- or alternative variants. Ordinary mixes still require three approved variants.
create or replace function public.enforce_mix_status_transition() returns trigger
language plpgsql volatile
set search_path = ''
as $$
declare
  v_count integer;
  v_set_count integer;
  v_generation integer;
  v_required integer;
begin
  if new.status is not distinct from old.status then return new; end if;

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
    v_required := case when old.archive_source is not null and old.archive_key is not null
      then 1 else 3 end;
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
    if v_count <> v_required or v_set_count <> v_required or (
      select count(*) from public.variants v
      where v.mix_id = old.id and v.is_published
    ) <> v_required then
      raise exception 'balancing to voting requires % published variants in the latest set', v_required
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
