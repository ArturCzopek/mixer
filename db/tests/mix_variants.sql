-- M1-6: approval, re-roll, reopening and 1:1 swaps are database invariants.
do $$
declare
  admin_id uuid := '00000000-0000-4000-8000-000000000001';
  group_id uuid := '00000000-0000-4000-8000-000000000010';
  main_mix uuid := '00000000-0000-4000-8000-000000000020';
  reroll_mix uuid := '00000000-0000-4000-8000-000000000021';
  reopen_mix uuid := '00000000-0000-4000-8000-000000000022';
  partial_mix uuid := '00000000-0000-4000-8000-000000000023';
  open_mix uuid := '00000000-0000-4000-8000-000000000024';
  p uuid[];
  leaving_id uuid;
  joining_id uuid;
  active_extra_id uuid;
  inactive_id uuid;
  outsider_id uuid;
  target_variant_id uuid;
  old_team char(1);
  old_score numeric;
  old_probability numeric;
  actual integer[];
  failed boolean;
  snapshots jsonb;
  first_set jsonb;
  next_set jsonb;
  i integer;
begin
  insert into public.players (id, steam_id, display_name)
  values (admin_id, '70000000000000001', 'Variant admin');
  for i in 1..14 loop
    insert into public.players (id, steam_id, display_name)
    values (
      ('00000000-0000-4000-8000-' || lpad((100 + i)::text, 12, '0'))::uuid,
      lpad((70000000000000000 + i + 1)::text, 17, '7'),
      'Variant player ' || i
    );
  end loop;
  insert into public.groups (id, slug, name, created_by)
  values (group_id, 'verify-variants', 'Variant Test', admin_id);

  for i in 1..14 loop
    if i <= 12 then
      insert into public.group_members (group_id, player_id)
      values (group_id, ('00000000-0000-4000-8000-' || lpad((100 + i)::text, 12, '0'))::uuid);
    elsif i = 13 then
      insert into public.group_members (group_id, player_id, left_at)
      values (group_id, ('00000000-0000-4000-8000-' || lpad((100 + i)::text, 12, '0'))::uuid, now());
    end if;
  end loop;

  select array_agg(('00000000-0000-4000-8000-' || lpad((100 + n)::text, 12, '0'))::uuid order by n)
  into p from generate_series(1, 10) as nums(n);
  joining_id := '00000000-0000-4000-8000-000000000111';
  active_extra_id := '00000000-0000-4000-8000-000000000112';
  inactive_id := '00000000-0000-4000-8000-000000000113';
  outsider_id := '00000000-0000-4000-8000-000000000115';

  insert into public.mixes (id, group_id, title, created_by)
  values
    (main_mix, group_id, 'Approval and swap', admin_id),
    (reroll_mix, group_id, 'Re-roll', admin_id),
    (reopen_mix, group_id, 'Reopen', admin_id),
    (partial_mix, group_id, 'Partial approval', admin_id),
    (open_mix, group_id, 'Open swap rejected', admin_id);
  insert into public.mix_participants (mix_id, player_id, added_by)
  select m.id, p.player_id, admin_id
  from unnest(array[main_mix, reroll_mix, reopen_mix, partial_mix]::uuid[]) m(id)
  cross join unnest(p) p(player_id);
  update public.mixes set status = 'balancing'
  where id in (main_mix, reroll_mix, reopen_mix, partial_mix);

  select jsonb_agg(jsonb_build_object(
    'playerId', mp.player_id,
    'snapshot', jsonb_build_object(
      'input', jsonb_build_object('steamId', pl.steam_id),
      'breakdown', jsonb_build_object('steamId', pl.steam_id, 'S', 1500)
    )
  )) into snapshots
  from public.mix_participants mp join public.players pl on pl.id = mp.player_id
  where mp.mix_id = main_mix;

  first_set := jsonb_build_array(
    jsonb_build_object('splitKey', 'split-1', 'teamA', to_jsonb(p[1:5]), 'teamB', to_jsonb(p[6:10]), 'avgA', 1500, 'avgB', 1490, 'winProbA', 0.514, 'penalty', 0, 'details', '{"labels":["most-even"],"candidateCount":40}'::jsonb),
    jsonb_build_object('splitKey', 'split-2', 'teamA', to_jsonb(array[p[1], p[2], p[3], p[4], p[6]]), 'teamB', to_jsonb(array[p[5], p[7], p[8], p[9], p[10]]), 'avgA', 1490, 'avgB', 1500, 'winProbA', 0.486, 'penalty', 1, 'details', '{"labels":[],"candidateCount":40}'::jsonb),
    jsonb_build_object('splitKey', 'split-3', 'teamA', to_jsonb(array[p[1], p[2], p[3], p[7], p[8]]), 'teamB', to_jsonb(array[p[4], p[5], p[6], p[9], p[10]]), 'avgA', 1502, 'avgB', 1488, 'winProbA', 0.520, 'penalty', 0, 'details', '{"labels":["fresh"],"candidateCount":40}'::jsonb)
  );
  next_set := jsonb_build_array(
    jsonb_build_object('splitKey', 'split-4', 'teamA', to_jsonb(array[p[1], p[2], p[3], p[4], p[7]]), 'teamB', to_jsonb(array[p[5], p[6], p[8], p[9], p[10]]), 'avgA', 1498, 'avgB', 1492, 'winProbA', 0.509, 'penalty', 0, 'details', '{"labels":[],"candidateCount":37}'::jsonb),
    jsonb_build_object('splitKey', 'split-5', 'teamA', to_jsonb(array[p[1], p[2], p[5], p[6], p[8]]), 'teamB', to_jsonb(array[p[3], p[4], p[7], p[9], p[10]]), 'avgA', 1490, 'avgB', 1500, 'winProbA', 0.486, 'penalty', 0, 'details', '{"labels":[],"candidateCount":37}'::jsonb),
    jsonb_build_object('splitKey', 'split-6', 'teamA', to_jsonb(array[p[1], p[3], p[5], p[8], p[9]]), 'teamB', to_jsonb(array[p[2], p[4], p[6], p[7], p[10]]), 'avgA', 1501, 'avgB', 1489, 'winProbA', 0.517, 'penalty', 0, 'details', '{"labels":[],"candidateCount":37}'::jsonb)
  );

  -- Status cannot enter voting without a complete published latest set.
  failed := false;
  begin
    update public.mixes set status = 'voting' where id = main_mix;
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'ASSERT: balancing to voting accepted zero published variants'; end if;

  perform public.create_mix_variant_set(main_mix, '{"weights":{"elo":1}}', snapshots, first_set);
  perform public.create_mix_variant_set(reroll_mix, '{"weights":{"elo":1}}', snapshots, first_set);
  perform public.create_mix_variant_set(reopen_mix, '{"weights":{"elo":1}}', snapshots, first_set);
  perform public.create_mix_variant_set(partial_mix, '{"weights":{"elo":1}}', snapshots, first_set);

  -- A partial publish cannot transition to voting.
  update public.variants set is_published = true
  where mix_id = partial_mix and number in (1, 2);
  failed := false;
  begin
    update public.mixes set status = 'voting' where id = partial_mix;
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'ASSERT: balancing to voting accepted only two published variants'; end if;
  failed := false;
  begin
    perform public.approve_mix_variant_set(partial_mix, 1);
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'ASSERT: approve accepted a set with only one unpublished variant'; end if;
  update public.variants set is_published = true where mix_id = partial_mix and number = 3;
  update public.mixes set status = 'voting' where id = partial_mix;

  -- The approved RPC publishes exactly the current set and advances the state together.
  perform public.approve_mix_variant_set(main_mix, 1);
  if (select status from public.mixes where id = main_mix) <> 'voting'
     or (select count(*) from public.variants where mix_id = main_mix and is_published) <> 3 then
    raise exception 'ASSERT: approval did not publish exactly three and start voting';
  end if;

  failed := false;
  begin
    perform public.reroll_mix_variant_set(main_mix, 1, next_set);
  exception when object_not_in_prerequisite_state then failed := true;
  end;
  if not failed then raise exception 'ASSERT: re-roll worked after approval'; end if;

  -- Published variants cannot be inserted, deleted, unpublished or have score/team data edited.
  failed := false;
  begin
    insert into public.variants (mix_id, number, generation, team_a_score, team_b_score, win_prob_a)
    values (main_mix, 4, 2, 1500, 1500, 0.5);
  exception when object_not_in_prerequisite_state then failed := true;
  end;
  if not failed then raise exception 'ASSERT: a variant was inserted after publication'; end if;
  select id, team_a_score, win_prob_a into target_variant_id, old_score, old_probability
  from public.variants where mix_id = main_mix and number = 1;
  failed := false;
  begin
    delete from public.variants where id = target_variant_id;
  exception when object_not_in_prerequisite_state then failed := true;
  end;
  if not failed then raise exception 'ASSERT: a published variant was deleted'; end if;
  failed := false;
  begin
    update public.variants set team_a_score = team_a_score + 1 where id = target_variant_id;
  exception when object_not_in_prerequisite_state then failed := true;
  end;
  if not failed then raise exception 'ASSERT: a published variant score was edited'; end if;
  failed := false;
  begin
    update public.variants set is_published = false where id = target_variant_id;
  exception when object_not_in_prerequisite_state then failed := true;
  end;
  if not failed then raise exception 'ASSERT: a published variant was unpublished'; end if;
  select team into old_team from public.variant_players where variant_players.variant_id = target_variant_id and player_id = p[1];
  failed := false;
  begin
    insert into public.variant_players (variant_id, player_id, team)
    values (target_variant_id, joining_id, old_team);
  exception when object_not_in_prerequisite_state then failed := true;
  end;
  if not failed then raise exception 'ASSERT: a player was inserted into a published variant'; end if;
  failed := false;
  begin
    update public.variant_players set team = case team when 'A' then 'B' else 'A' end
    where variant_players.variant_id = target_variant_id and player_id = p[1];
  exception when object_not_in_prerequisite_state then failed := true;
  end;
  if not failed then raise exception 'ASSERT: a published player changed team'; end if;
  failed := false;
  begin
    update public.variant_players set player_id = p[2]
    where variant_players.variant_id = target_variant_id and player_id = p[1];
  exception when object_not_in_prerequisite_state then failed := true;
  end;
  if not failed then raise exception 'ASSERT: a published player slot changed outside a swap'; end if;
  failed := false;
  begin
    delete from public.variant_players where variant_players.variant_id = target_variant_id and player_id = p[1];
  exception when object_not_in_prerequisite_state then failed := true;
  end;
  if not failed then raise exception 'ASSERT: a published variant player was deleted'; end if;

  -- Reroll checks the current generation and every split already shown, then numbers continue 4..6.
  failed := false;
  begin
    perform public.reroll_mix_variant_set(reroll_mix, 1, first_set);
  exception when object_not_in_prerequisite_state then failed := true;
  end;
  if not failed then raise exception 'ASSERT: re-roll repeated a split already shown'; end if;
  perform public.reroll_mix_variant_set(reroll_mix, 1, next_set);
  select array_agg(number order by number) into actual
  from public.variants where mix_id = reroll_mix and generation = 2;
  if actual <> array[4, 5, 6] then raise exception 'ASSERT: re-roll numbers did not continue at 4'; end if;
  failed := false;
  begin
    update public.variants set is_published = true
    where mix_id = reroll_mix and generation = 1 and number = 1;
  exception when object_not_in_prerequisite_state then failed := true;
  end;
  if not failed then raise exception 'ASSERT: a rejected variant was published'; end if;
  failed := false;
  begin
    perform public.reroll_mix_variant_set(reroll_mix, 1, first_set);
  exception when object_not_in_prerequisite_state then failed := true;
  end;
  if not failed then raise exception 'ASSERT: stale generation re-roll was accepted'; end if;

  -- Reopening sign-ups atomically removes all unpublished sets and their snapshots.
  update public.mixes set status = 'open' where id = reopen_mix;
  if exists (select 1 from public.variants where mix_id = reopen_mix)
     or exists (select 1 from public.mix_participants where mix_id = reopen_mix and skill_snapshot is not null)
     or (select balance_config from public.mixes where id = reopen_mix) <> '{}'::jsonb then
    raise exception 'ASSERT: reopening did not clear unpublished variants and generation snapshots';
  end if;

  -- A valid 1:1 swap deletes the leaver's vote, preserves every team assignment and score, and logs it.
  leaving_id := p[1];
  joining_id := '00000000-0000-4000-8000-000000000111';
  select v.id, vp.team into target_variant_id, old_team from public.variants v
  join public.variant_players vp on vp.variant_id = v.id
  where v.mix_id = main_mix and v.number = 1 and vp.player_id = leaving_id;
  insert into public.votes (mix_id, voter_id, variant_id, cast_by)
  values (main_mix, leaving_id, target_variant_id, leaving_id);
  perform public.swap_mix_participant(main_mix, leaving_id, joining_id, admin_id);
  if exists (select 1 from public.votes where mix_id = main_mix and voter_id = leaving_id)
     or exists (select 1 from public.mix_participants where mix_id = main_mix and player_id = leaving_id)
     or not exists (select 1 from public.mix_participants where mix_id = main_mix and player_id = joining_id)
     or not exists (select 1 from public.variant_players where variant_players.variant_id = target_variant_id and player_id = joining_id and team = old_team)
     or (select team_a_score from public.variants where id = target_variant_id) <> old_score
     or (select win_prob_a from public.variants where id = target_variant_id) <> old_probability
     or (select jsonb_array_length(swap_log) from public.mixes where id = main_mix) <> 1 then
    raise exception 'ASSERT: approved swap did not preserve the slot, votes and scores';
  end if;
  if (select skill_snapshot #>> '{input,eloSource}' from public.mix_participants where mix_id = main_mix and player_id = joining_id) <> 'swap-slot'
     or (select skill_snapshot #>> '{input,swapInheritedFrom}' from public.mix_participants where mix_id = main_mix and player_id = joining_id) <> (select steam_id from public.players where id = leaving_id)
     or (select skill_snapshot #>> '{breakdown,steamId}' from public.mix_participants where mix_id = main_mix and player_id = joining_id) <> (select steam_id from public.players where id = joining_id) then
    raise exception 'ASSERT: swap did not preserve and mark the approved skill slot';
  end if;

  failed := false;
  begin
    perform public.swap_mix_participant(main_mix, leaving_id, p[12], admin_id);
  exception when object_not_in_prerequisite_state then failed := true;
  end;
  if not failed then raise exception 'ASSERT: swap accepted a leaver outside the mix'; end if;
  failed := false;
  begin
    perform public.swap_mix_participant(main_mix, p[2], p[3], admin_id);
  exception when foreign_key_violation then failed := true;
  end;
  if not failed then raise exception 'ASSERT: swap accepted a newcomer already in the mix'; end if;
  failed := false;
  begin
    perform public.swap_mix_participant(main_mix, p[2], inactive_id, admin_id);
  exception when foreign_key_violation then failed := true;
  end;
  if not failed then raise exception 'ASSERT: swap accepted an inactive group member'; end if;
  failed := false;
  begin
    perform public.swap_mix_participant(main_mix, p[2], outsider_id, admin_id);
  exception when foreign_key_violation then failed := true;
  end;
  if not failed then raise exception 'ASSERT: swap accepted a non-member'; end if;

  -- Swaps remain available in balancing and locked, and are rejected while sign-ups are open.
  perform public.swap_mix_participant(reroll_mix, p[3], active_extra_id, admin_id);
  update public.mixes set status = 'locked' where id = main_mix;
  perform public.swap_mix_participant(main_mix, p[2], active_extra_id, admin_id);
  failed := false;
  begin
    perform public.swap_mix_participant(open_mix, p[1], p[11], admin_id);
  exception when object_not_in_prerequisite_state then failed := true;
  end;
  if not failed then raise exception 'ASSERT: swap was accepted while sign-ups were open'; end if;

  if has_function_privilege('anon', 'public.create_mix_variant_set(uuid,jsonb,jsonb,jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.reroll_mix_variant_set(uuid,integer,jsonb)', 'EXECUTE')
     or has_function_privilege('anon', 'public.approve_mix_variant_set(uuid,integer)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.swap_mix_participant(uuid,uuid,uuid,uuid)', 'EXECUTE') then
    raise exception 'ASSERT: browser role can execute a mix variant or swap operation';
  end if;
end;
$$;
