-- A manual map result is valid without a map name, player stats, or a payload.
do $$
declare
  v_match_id uuid;
  player_id uuid := '00000000-0000-4000-8000-000000000301';
  outsider_id uuid := '00000000-0000-4000-8000-000000000302';
  group_id uuid := '00000000-0000-4000-8000-000000000303';
  fixture_mix_id uuid := '00000000-0000-4000-8000-000000000304';
  faceit_mix_id uuid := '00000000-0000-4000-8000-000000000305';
  participant_id uuid;
  participants uuid[] := '{}'::uuid[];
  i integer;
  failed boolean;
begin
  insert into public.players (id, steam_id) values
    (player_id, '71000000000000301'), (outsider_id, '71000000000000302');
  insert into public.matches (score_a, score_b, source, uploaded_by)
    values (13, 11, 'manual', player_id) returning id into v_match_id;
  if (select winner from public.matches where id = v_match_id) <> 'A'
     or (select count(*) from public.match_player_stats where match_id = v_match_id) <> 0 then
    raise exception 'ASSERT: score-only result was not stored';
  end if;
  update public.matches set score_b = 13 where id = v_match_id;
  if (select winner from public.matches where id = v_match_id) is not null then
    raise exception 'ASSERT: a drawn map has a winner';
  end if;
  insert into public.match_player_stats (match_id, player_id, team, kills)
    values (v_match_id, player_id, 'A', 20);
  insert into public.match_payloads (match_id, parser_version, payload)
    values (v_match_id, 'test', '{"rounds":[]}'::jsonb);
  delete from public.matches where id = v_match_id;
  if exists (select 1 from public.match_player_stats where match_id = v_match_id)
     or exists (select 1 from public.match_payloads where match_id = v_match_id) then
    raise exception 'ASSERT: child data survived a deleted match';
  end if;

  failed := false;
  begin
    insert into public.matches (score_a, score_b, source) values (-1, 0, 'manual');
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'ASSERT: negative score accepted'; end if;
  failed := false;
  begin
    insert into public.matches (score_a, score_b, source) values (1, 0, 'other');
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'ASSERT: unknown source accepted'; end if;
  if not has_table_privilege('anon', 'public.matches', 'SELECT')
     or has_table_privilege('anon', 'public.matches', 'INSERT')
     or has_table_privilege('authenticated', 'public.match_player_stats', 'INSERT')
     or has_table_privilege('authenticated', 'public.match_payloads', 'INSERT') then
    raise exception 'ASSERT: browser privileges are wrong';
  end if;

  insert into public.groups (id, slug, name, created_by)
    values (group_id, 'result-test', 'Result test', player_id);
  for i in 1..10 loop
    insert into public.players (steam_id)
      values ('71000000000001' || lpad(i::text, 3, '0'))
      returning id into participant_id;
    participants := array_append(participants, participant_id);
    insert into public.group_members (group_id, player_id) values (group_id, participant_id);
  end loop;
  insert into public.mixes (id, group_id, title, created_by)
    values (fixture_mix_id, group_id, 'Result test', player_id);
  for i in 1..10 loop
    insert into public.mix_participants (mix_id, player_id, added_by)
      values (fixture_mix_id, participants[i], player_id);
  end loop;
  update public.mixes set status = 'balancing' where id = fixture_mix_id;
  perform public.create_mix_variant_set(fixture_mix_id, '{}'::jsonb, null, jsonb_build_array(
    jsonb_build_object('splitKey', 'result-1', 'teamA', to_jsonb(participants[1:5]), 'teamB', to_jsonb(participants[6:10]), 'avgA', 1400, 'avgB', 1400, 'winProbA', 0.5),
    jsonb_build_object('splitKey', 'result-2', 'teamA', to_jsonb(array[participants[1],participants[2],participants[3],participants[4],participants[6]]), 'teamB', to_jsonb(array[participants[5],participants[7],participants[8],participants[9],participants[10]]), 'avgA', 1400, 'avgB', 1400, 'winProbA', 0.5),
    jsonb_build_object('splitKey', 'result-3', 'teamA', to_jsonb(array[participants[1],participants[2],participants[3],participants[7],participants[8]]), 'teamB', to_jsonb(array[participants[4],participants[5],participants[6],participants[9],participants[10]]), 'avgA', 1400, 'avgB', 1400, 'winProbA', 0.5)
  ));
  perform public.approve_mix_variant_set(fixture_mix_id, 1);
  perform public.close_mix_votes(fixture_mix_id);
  failed := false;
  begin
    perform public.record_manual_mix_results(fixture_mix_id, outsider_id,
      '[{"scoreA":13,"scoreB":7}]'::jsonb);
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'ASSERT: non-admin entered result'; end if;
  if (select status from public.mixes where id = fixture_mix_id) <> 'locked' then
    raise exception 'ASSERT: failed write changed status';
  end if;
  failed := false;
  begin
    update public.mixes set status = 'played' where id = fixture_mix_id;
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'ASSERT: played mix accepted without a result'; end if;
  failed := false;
  begin
    perform public.record_manual_mix_results(fixture_mix_id, player_id,
      '[{"scoreA":13,"scoreB":7},{"scoreA":-1,"scoreB":13}]'::jsonb);
  exception when check_violation then failed := true;
  end;
  if not failed or exists (select 1 from public.matches where mix_id = fixture_mix_id) then
    raise exception 'ASSERT: invalid second map did not roll back first';
  end if;
  perform public.record_manual_mix_results(fixture_mix_id, player_id,
    '[{"mapName":"de_mirage","scoreA":13,"scoreB":7},{"scoreA":9,"scoreB":13}]'::jsonb);
  if (select status from public.mixes where id = fixture_mix_id) <> 'played'
     or (select count(*) from public.matches where mix_id = fixture_mix_id) <> 2
     or (select map_name from public.matches where mix_id = fixture_mix_id and map_number = 2) is not null then
    raise exception 'ASSERT: two-map manual evening was not saved';
  end if;
  failed := false;
  begin
    perform public.record_manual_mix_results(fixture_mix_id, player_id,
      '[{"scoreA":13,"scoreB":7}]'::jsonb);
  exception when object_not_in_prerequisite_state then failed := true;
  end;
  if not failed then raise exception 'ASSERT: result overwritten'; end if;

  insert into public.mixes (id, group_id, title, created_by)
    values (faceit_mix_id, group_id, 'FACEIT result test', player_id);
  for i in 1..10 loop
    insert into public.mix_participants (mix_id, player_id, added_by)
      values (faceit_mix_id, participants[i], player_id);
  end loop;
  update public.mixes set status = 'balancing' where id = faceit_mix_id;
  perform public.create_mix_variant_set(faceit_mix_id, '{}'::jsonb, null, jsonb_build_array(
    jsonb_build_object('splitKey', 'faceit-1', 'teamA', to_jsonb(participants[1:5]), 'teamB', to_jsonb(participants[6:10]), 'avgA', 1400, 'avgB', 1400, 'winProbA', 0.5),
    jsonb_build_object('splitKey', 'faceit-2', 'teamA', to_jsonb(array[participants[1],participants[2],participants[3],participants[4],participants[6]]), 'teamB', to_jsonb(array[participants[5],participants[7],participants[8],participants[9],participants[10]]), 'avgA', 1400, 'avgB', 1400, 'winProbA', 0.5),
    jsonb_build_object('splitKey', 'faceit-3', 'teamA', to_jsonb(array[participants[1],participants[2],participants[3],participants[7],participants[8]]), 'teamB', to_jsonb(array[participants[4],participants[5],participants[6],participants[9],participants[10]]), 'avgA', 1400, 'avgB', 1400, 'winProbA', 0.5)
  ));
  perform public.approve_mix_variant_set(faceit_mix_id, 1);
  perform public.close_mix_votes(faceit_mix_id);
  failed := false;
  begin
    perform public.record_faceit_mix_results(faceit_mix_id, outsider_id,
      (select locked_at from public.mixes where id = faceit_mix_id),
      jsonb_build_array(jsonb_build_object('faceitId', 'room-1', 'startedAt', now(), 'scoreA', 13, 'scoreB', 7, 'stats', '[]'::jsonb)));
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'ASSERT: non-admin imported FACEIT room'; end if;
  perform public.record_faceit_mix_results(faceit_mix_id, player_id,
    (select locked_at from public.mixes where id = faceit_mix_id), jsonb_build_array(
    jsonb_build_object('faceitId', 'room-1', 'mapName', 'de_mirage', 'startedAt', now(), 'scoreA', 13, 'scoreB', 7,
      'stats', jsonb_build_array(jsonb_build_object('playerId', participants[1], 'team', 'A', 'kills', 20, 'deaths', 12, 'rounds', 20, 'rating', 1.2))),
    jsonb_build_object('faceitId', 'room-2', 'mapName', 'de_nuke', 'startedAt', now(), 'scoreA', 11, 'scoreB', 13, 'stats', '[]'::jsonb)
  ));
  if (select status from public.mixes where id = faceit_mix_id) <> 'played'
     or (select count(*) from public.matches where mix_id = faceit_mix_id) <> 2
     or (select s.kills from public.match_player_stats s where s.player_id = participants[1]) <> 20
     or (select s.rating from public.match_player_stats s where s.player_id = participants[1]) <> 1.2 then
    raise exception 'ASSERT: FACEIT evening was not stored';
  end if;
  perform public.record_faceit_mix_results(faceit_mix_id, player_id,
    (select locked_at from public.mixes where id = faceit_mix_id), jsonb_build_array(
    jsonb_build_object('faceitId', 'room-1'), jsonb_build_object('faceitId', 'room-2')));
  if (select count(*) from public.matches where mix_id = faceit_mix_id) <> 2 then
    raise exception 'ASSERT: re-import duplicated maps';
  end if;
  failed := false;
  begin
    perform public.record_faceit_mix_results(faceit_mix_id, player_id,
      (select locked_at from public.mixes where id = faceit_mix_id),
      '[{"faceitId":"room-3"}]'::jsonb);
  exception when object_not_in_prerequisite_state then failed := true;
  end;
  if not failed then raise exception 'ASSERT: played evening accepted another room'; end if;
end;
$$;
