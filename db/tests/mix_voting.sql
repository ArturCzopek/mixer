-- M1-7 voting invariants, including the delayed deadline and seeded tie.
do $$
declare
  admin_id uuid := '00000000-0000-4000-8000-000000000201';
  outsider_id uuid := '00000000-0000-4000-8000-000000000202';
  group_id uuid := '00000000-0000-4000-8000-000000000203';
  fixture_mix_id uuid := '00000000-0000-4000-8000-000000000111';
  p uuid[] := '{}'::uuid[];
  v_player_id uuid;
  v1 uuid;
  v2 uuid;
  v3 uuid;
  i integer;
  failed boolean;
begin
  insert into public.players (id, steam_id) values
    (admin_id, '71000000000000201'), (outsider_id, '71000000000000202');
  insert into public.groups (id, slug, name, created_by)
    values (group_id, 'voting-test', 'Voting test', admin_id);
  for i in 1..10 loop
    insert into public.players (steam_id)
      values ('71000000000000' || lpad(i::text, 3, '0'))
      returning id into v_player_id;
    p := array_append(p, v_player_id);
    insert into public.group_members (group_id, player_id) values (group_id, v_player_id);
  end loop;
  insert into public.mixes (id, group_id, title, created_by)
    values (fixture_mix_id, group_id, 'Voting test', admin_id);
  for i in 1..10 loop
    insert into public.mix_participants (mix_id, player_id, added_by)
      values (fixture_mix_id, p[i], admin_id);
  end loop;
  update public.mixes set status = 'balancing' where id = fixture_mix_id;
  perform public.create_mix_variant_set(fixture_mix_id, '{}'::jsonb, null, jsonb_build_array(
    jsonb_build_object('splitKey', 'vote-1', 'teamA', to_jsonb(p[1:5]), 'teamB', to_jsonb(p[6:10]), 'avgA', 1400, 'avgB', 1400, 'winProbA', 0.5),
    jsonb_build_object('splitKey', 'vote-2', 'teamA', to_jsonb(array[p[1],p[2],p[3],p[4],p[6]]), 'teamB', to_jsonb(array[p[5],p[7],p[8],p[9],p[10]]), 'avgA', 1400, 'avgB', 1400, 'winProbA', 0.5),
    jsonb_build_object('splitKey', 'vote-3', 'teamA', to_jsonb(array[p[1],p[2],p[3],p[7],p[8]]), 'teamB', to_jsonb(array[p[4],p[5],p[6],p[9],p[10]]), 'avgA', 1400, 'avgB', 1400, 'winProbA', 0.5)
  ));
  perform public.approve_mix_variant_set(fixture_mix_id, 1);
  select id into v1 from public.variants where mix_id = fixture_mix_id and number = 1;
  select id into v2 from public.variants where mix_id = fixture_mix_id and number = 2;
  select id into v3 from public.variants where mix_id = fixture_mix_id and number = 3;

  if public.mix_vote_seed(fixture_mix_id::text) <> 1457201024 then
    raise exception 'ASSERT: SQL and TypeScript tie seeds differ';
  end if;
  failed := false;
  begin
    perform public.cast_mix_vote(fixture_mix_id, outsider_id, v1, outsider_id);
  exception when foreign_key_violation then failed := true;
  end;
  if not failed then raise exception 'ASSERT: outsider voted'; end if;
  failed := false;
  begin
    perform public.cast_mix_vote(fixture_mix_id, p[1], v1, outsider_id);
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'ASSERT: non-admin cast a proxy vote'; end if;

  perform public.cast_mix_vote(fixture_mix_id, p[1], v3, p[1]);
  perform public.cast_mix_vote(fixture_mix_id, p[1], v1, p[1]);
  if (select count(*) from public.votes where mix_id = fixture_mix_id and voter_id = p[1]) <> 1 then
    raise exception 'ASSERT: moving a vote created a duplicate';
  end if;
  for i in 2..10 loop
    perform public.cast_mix_vote(fixture_mix_id, p[i], case when i <= 5 then v1 else v2 end,
      case when i = 10 then admin_id else p[i] end);
  end loop;
  if (select status from public.mixes where id = fixture_mix_id) <> 'voting'
     or (select cast_by from public.votes where mix_id = fixture_mix_id and voter_id = p[10]) <> admin_id then
    raise exception 'ASSERT: tenth vote closed voting or proxy attribution was lost';
  end if;
  perform public.close_due_mix_votes();
  if (select status from public.mixes where id = fixture_mix_id) <> 'voting' then
    raise exception 'ASSERT: vote closed before 60 minutes';
  end if;

  alter table public.votes disable trigger votes_touch_updated_at;
  update public.votes set updated_at = now() - interval '61 minutes' where mix_id = fixture_mix_id;
  alter table public.votes enable trigger votes_touch_updated_at;
  perform public.cast_mix_vote(fixture_mix_id, p[10], v2, p[10]);
  perform public.close_due_mix_votes();
  if (select status from public.mixes where id = fixture_mix_id) <> 'voting' then
    raise exception 'ASSERT: moving a vote did not reset the deadline';
  end if;
  alter table public.votes disable trigger votes_touch_updated_at;
  update public.votes set updated_at = now() - interval '61 minutes' where mix_id = fixture_mix_id;
  alter table public.votes enable trigger votes_touch_updated_at;
  perform public.close_due_mix_votes();
  if (select status from public.mixes where id = fixture_mix_id) <> 'locked'
     or (select chosen_variant_id from public.mixes where id = fixture_mix_id) <> v1
     or (select vote_result -> 'tied' from public.mixes where id = fixture_mix_id) <> '[1, 2]'::jsonb
     or (select vote_result ->> 'winnerVotes' from public.mixes where id = fixture_mix_id) <> '5' then
    raise exception 'ASSERT: due tie was not locked with the seeded winner';
  end if;
  if (select locked_at from public.mixes where id = fixture_mix_id) is null then
    raise exception 'ASSERT: lock time missing';
  end if;
  failed := false;
  begin
    perform public.cast_mix_vote(fixture_mix_id, p[1], v2, p[1]);
  exception when object_not_in_prerequisite_state then failed := true;
  end;
  if not failed then raise exception 'ASSERT: vote changed after closure'; end if;
  perform public.reopen_mix_votes(fixture_mix_id);
  if (select locked_at from public.mixes where id = fixture_mix_id) is not null then
    raise exception 'ASSERT: old lock time survived reopening';
  end if;
  if (select chosen_variant_id from public.mixes where id = fixture_mix_id) is not null
     or (select count(*) from public.votes where mix_id = fixture_mix_id) <> 10
     or (select count(*) from public.variants where mix_id = fixture_mix_id and is_published) <> 3 then
    raise exception 'ASSERT: reopening changed votes or approved variants';
  end if;
  perform public.close_mix_votes(fixture_mix_id);
  perform public.start_mix_match(fixture_mix_id);
  failed := false;
  begin
    perform public.reopen_mix_votes(fixture_mix_id);
  exception when object_not_in_prerequisite_state then failed := true;
  end;
  if not failed then raise exception 'ASSERT: reopened after match start'; end if;
end;
$$;
