-- M1-5: participant sign-ups and staged status transitions are enforced in Postgres.

alter table public.mixes
  add constraint mixes_title_length_check
  check (
    char_length(btrim(title)) between 2 and 60
    and title !~ '^[[:space:]]*$'
  );

-- A group delete cascades through its memberships as well as its mixes.
alter table public.mix_participants
  drop constraint mix_participants_member_fk;
alter table public.mix_participants
  add constraint mix_participants_member_fk
  foreign key (group_id, player_id)
  references public.group_members (group_id, player_id)
  on delete cascade;

create or replace function public.enforce_mix_cap() returns trigger
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_group_id uuid;
  v_status text;
  v_count integer;
begin
  -- Serialize joins and status changes on the mix row.
  select m.group_id, m.status
    into v_group_id, v_status
  from public.mixes m
  where m.id = new.mix_id
  for update;

  if not found then
    raise exception 'mix % does not exist', new.mix_id
      using errcode = 'foreign_key_violation';
  end if;

  new.group_id := v_group_id;

  if v_status is distinct from 'open' then
    raise exception 'mix % is not open for sign-ups', new.mix_id
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  if not exists (
    select 1
    from public.group_members gm
    where gm.group_id = v_group_id
      and gm.player_id = new.player_id
      and gm.left_at is null
  ) then
    raise exception 'player % is not an active member of the group', new.player_id
      using errcode = 'foreign_key_violation';
  end if;

  -- Keep this as a separate statement after the lock; VOLATILE sees joins committed while waiting.
  select count(*) into v_count
  from public.mix_participants
  where mix_id = new.mix_id;

  if v_count >= 10 then
    raise exception 'mix % is full (10 players)', new.mix_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_mix_participant_delete() returns trigger
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_status text;
  v_group_id uuid;
begin
  select m.status, m.group_id into v_status, v_group_id
  from public.mixes m
  where m.id = old.mix_id
  for update;

  -- A mix/group cascade has already removed the parent row.
  if not found then
    return old;
  end if;

  -- Group deletion may cascade through memberships before it removes the mix row.
  if not exists (select 1 from public.groups g where g.id = v_group_id) then
    return old;
  end if;

  if v_status is distinct from 'open' then
    raise exception 'participants cannot be removed from a closed mix'
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  return old;
end;
$$;

create trigger mix_participants_open_delete
  before delete on public.mix_participants
  for each row execute function public.enforce_mix_participant_delete();

create or replace function public.enforce_mix_status_transition() returns trigger
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_count integer;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if old.status = 'open' and new.status = 'balancing' then
    select count(*) into v_count
    from public.mix_participants
    where mix_id = old.id;

    if v_count <> 10 then
      raise exception 'mix % needs exactly 10 participants before balancing', old.id
        using errcode = 'check_violation';
    end if;
  elsif old.status = 'balancing' and new.status in ('open', 'voting') then
    null;
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

create trigger mixes_status_transition
  before update of status on public.mixes
  for each row execute function public.enforce_mix_status_transition();

revoke execute on function public.enforce_mix_cap() from public, anon, authenticated;
revoke execute on function public.enforce_mix_participant_delete()
  from public, anon, authenticated;
revoke execute on function public.enforce_mix_status_transition()
  from public, anon, authenticated;
