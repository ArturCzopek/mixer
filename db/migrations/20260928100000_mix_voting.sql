-- Public, movable votes and a durable result for the approved variant set.
alter table public.mixes
  add column vote_result jsonb,
  add column match_started_at timestamptz;

-- Keep the TypeScript FNV-1a tie break in lib/mix/voting.ts and SQL in agreement.
create function public.mix_vote_seed(p_seed text) returns bigint
language plpgsql immutable strict
set search_path = ''
as $$
declare
  v_hash bigint := 2166136261;
  v_bytes bytea := convert_to(p_seed, 'UTF8');
  v_index integer;
begin
  for v_index in 0..length(v_bytes) - 1 loop
    v_hash := ((v_hash # get_byte(v_bytes, v_index)) * 16777619) % 4294967296;
  end loop;
  return v_hash;
end;
$$;

-- The mix row serializes votes with closure, reopening, and participant swaps.
create function public.guard_mix_vote() returns trigger
language plpgsql volatile
set search_path = ''
as $$
declare
  v_group_id uuid;
  v_status text;
begin
  if tg_op = 'UPDATE' and (new.mix_id, new.voter_id) is distinct from (old.mix_id, old.voter_id) then
    raise exception 'a vote cannot move to another voter or mix' using errcode = 'check_violation';
  end if;
  select group_id, status into v_group_id, v_status
  from public.mixes where id = new.mix_id for update;
  if v_status is distinct from 'voting' then
    raise exception 'voting is closed' using errcode = 'object_not_in_prerequisite_state';
  end if;
  if not exists (
    select 1 from public.variants v
    where v.id = new.variant_id and v.mix_id = new.mix_id
      and v.is_published and v.rejected_at is null
  ) then
    raise exception 'vote requires an approved variant' using errcode = 'check_violation';
  end if;
  if new.cast_by <> new.voter_id and not exists (
    select 1 from public.group_members gm
    where gm.group_id = v_group_id and gm.player_id = new.cast_by
      and gm.role = 'admin' and gm.left_at is null
  ) and not exists (
    select 1 from public.players p where p.id = new.cast_by and p.is_site_admin
  ) then
    raise exception 'proxy voter must be a group admin' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger votes_guard
  before insert or update on public.votes
  for each row execute function public.guard_mix_vote();

create function public.cast_mix_vote(
  p_mix_id uuid, p_voter_id uuid, p_variant_id uuid, p_cast_by uuid
) returns void
language plpgsql volatile
set search_path = ''
as $$
begin
  insert into public.votes (mix_id, voter_id, variant_id, cast_by)
  values (p_mix_id, p_voter_id, p_variant_id, p_cast_by)
  on conflict (mix_id, voter_id) do update
    set variant_id = excluded.variant_id, cast_by = excluded.cast_by;
end;
$$;

create function public.close_mix_votes(p_mix_id uuid, p_require_due boolean default false)
returns void
language plpgsql volatile
set search_path = ''
as $$
declare
  v_status text;
  v_variant_ids uuid[];
  v_tied_numbers smallint[];
  v_winner uuid;
  v_last_vote timestamptz;
  v_vote_count integer;
begin
  select status into v_status from public.mixes where id = p_mix_id for update;
  if v_status is distinct from 'voting' then
    raise exception 'voting is closed' using errcode = 'object_not_in_prerequisite_state';
  end if;
  select count(*), max(updated_at) into v_vote_count, v_last_vote
  from public.votes where mix_id = p_mix_id;
  if p_require_due and (v_vote_count <> 10 or v_last_vote > now() - interval '60 minutes') then
    raise exception 'voting is not due to close' using errcode = 'object_not_in_prerequisite_state';
  end if;
  with counts as (
    select v.id, v.number, count(vo.voter_id) as votes
    from public.variants v
    left join public.votes vo on vo.variant_id = v.id and vo.mix_id = p_mix_id
    where v.mix_id = p_mix_id and v.is_published and v.rejected_at is null
    group by v.id, v.number
  )
  select array_agg(id order by number), array_agg(number order by number)
  into v_variant_ids, v_tied_numbers
  from counts where votes = (select max(votes) from counts);
  if coalesce(array_length(v_variant_ids, 1), 0) = 0 then
    raise exception 'no approved variants' using errcode = 'check_violation';
  end if;
  v_winner := v_variant_ids[1 + public.mix_vote_seed(p_mix_id::text) % array_length(v_variant_ids, 1)];
  update public.mixes
  set status = 'locked', chosen_variant_id = v_winner,
      vote_result = jsonb_build_object('tied', v_tied_numbers, 'closedAt', now())
  where id = p_mix_id;
end;
$$;

create function public.reopen_mix_votes(p_mix_id uuid) returns void
language plpgsql volatile
set search_path = ''
as $$
declare
  v_status text;
  v_started_at timestamptz;
begin
  select status, match_started_at into v_status, v_started_at
  from public.mixes where id = p_mix_id for update;
  if v_status is distinct from 'locked' or v_started_at is not null then
    raise exception 'the match has started or voting is not locked'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  update public.mixes
  set status = 'voting', chosen_variant_id = null, vote_result = null
  where id = p_mix_id;
end;
$$;

create function public.start_mix_match(p_mix_id uuid) returns void
language plpgsql volatile
set search_path = ''
as $$
declare
  v_status text;
  v_started_at timestamptz;
begin
  select status, match_started_at into v_status, v_started_at
  from public.mixes where id = p_mix_id for update;
  if v_status is distinct from 'locked' or v_started_at is not null then
    raise exception 'the lineup is not ready or the match has started'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  update public.mixes set match_started_at = now() where id = p_mix_id;
end;
$$;

-- Direct service-role updates must also obey the locked-lineup invariant.
create function public.guard_mix_voting_state() returns trigger
language plpgsql volatile
set search_path = ''
as $$
begin
  if old.status = 'voting' and new.status = 'locked' then
    if new.chosen_variant_id is null or not exists (
      select 1 from public.variants v where v.id = new.chosen_variant_id
        and v.mix_id = old.id and v.is_published and v.rejected_at is null
    ) then
      raise exception 'locking requires an approved chosen variant' using errcode = 'check_violation';
    end if;
  elsif old.status = 'locked' and new.status = 'voting' then
    if old.match_started_at is not null or new.chosen_variant_id is not null then
      raise exception 'cannot reopen after the match starts or keep a chosen variant'
        using errcode = 'object_not_in_prerequisite_state';
    end if;
  elsif old.status = new.status and old.status in ('locked', 'played')
        and new.chosen_variant_id is distinct from old.chosen_variant_id then
    raise exception 'chosen variant is final while voting is closed'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  return new;
end;
$$;

create trigger mixes_voting_state
  before update on public.mixes
  for each row execute function public.guard_mix_voting_state();

create function public.close_due_mix_votes() returns void
language plpgsql volatile
set search_path = ''
as $$
declare
  v_mix_id uuid;
begin
  for v_mix_id in
    select m.id from public.mixes m
    where m.status = 'voting'
      and (select count(*) from public.votes vo where vo.mix_id = m.id) = 10
      and (select max(vo.updated_at) from public.votes vo where vo.mix_id = m.id)
          <= now() - interval '60 minutes'
  loop
    begin
      perform public.close_mix_votes(v_mix_id, true);
    exception when sqlstate '55000' then
      -- A concurrent vote or admin close won the mix-row lock.
      null;
    end;
  end loop;
end;
$$;

revoke execute on function public.mix_vote_seed(text) from public, anon, authenticated;
revoke execute on function public.guard_mix_vote() from public, anon, authenticated;
revoke execute on function public.guard_mix_voting_state() from public, anon, authenticated;
revoke execute on function public.cast_mix_vote(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.close_mix_votes(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.reopen_mix_votes(uuid) from public, anon, authenticated;
revoke execute on function public.start_mix_match(uuid) from public, anon, authenticated;
revoke execute on function public.close_due_mix_votes() from public, anon, authenticated;
grant execute on function public.cast_mix_vote(uuid, uuid, uuid, uuid) to service_role;
grant execute on function public.close_mix_votes(uuid, boolean) to service_role;
grant execute on function public.reopen_mix_votes(uuid) to service_role;
grant execute on function public.start_mix_match(uuid) to service_role;
grant execute on function public.close_due_mix_votes() to service_role;

-- Supabase supplies pg_cron; PGlite does not. Schedule only where the extension is available.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
    execute $cmd$select cron.schedule('mixer-close-votes', '* * * * *', 'select public.close_due_mix_votes()')$cmd$;
  end if;
end;
$$;
