-- A manual map result is valid without a map name, player stats, or a payload.
do $$
declare
  v_match_id uuid;
  player_id uuid := '00000000-0000-4000-8000-000000000301';
  outsider_id uuid := '00000000-0000-4000-8000-000000000302';
  group_id uuid := '00000000-0000-4000-8000-000000000303';
  fixture_mix_id uuid := '00000000-0000-4000-8000-000000000304';
  faceit_mix_id uuid := '00000000-0000-4000-8000-000000000305';
  archive_mix_id uuid := '00000000-0000-4000-8000-000000000306';
  archive_variant_id uuid := '00000000-0000-4000-8000-000000000307';
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
  failed := false;
  begin
    insert into public.match_player_stats (match_id, player_id, team, entry_attempts, entry_wins)
      values (v_match_id, outsider_id, 'B', 2, 3);
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'ASSERT: entry wins exceeded attempts'; end if;
  failed := false;
  begin
    insert into public.match_player_stats (match_id, player_id, team, flashes_thrown, flashes_successful)
      values (v_match_id, outsider_id, 'B', 2, 3);
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'ASSERT: flash successes exceeded thrown'; end if;
  failed := false;
  begin
    insert into public.match_player_stats (match_id, player_id, team, clutch_attempts, clutch_wins)
      values (v_match_id, outsider_id, 'B', 2, 3);
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'ASSERT: clutch wins exceeded attempts'; end if;
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
  failed := false;
  begin
    insert into public.matches (score_a, score_b, source, stats_origin)
      values (13, 7, 'faceit', 'popflash');
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'ASSERT: historical stats were mislabeled FACEIT'; end if;
  insert into public.matches (score_a, score_b, source, stats_origin, source_reference)
    values (13, 7, 'manual', 'popflash', 'popflash:fixture')
    returning id into v_match_id;
  if (select stats_origin from public.matches where id = v_match_id) <> 'popflash' then
    raise exception 'ASSERT: historical provenance was lost';
  end if;
  delete from public.matches where id = v_match_id;
  if not has_table_privilege('anon', 'public.matches', 'SELECT')
     or has_table_privilege('anon', 'public.matches', 'INSERT')
     or has_table_privilege('authenticated', 'public.match_player_stats', 'INSERT')
     or has_table_privilege('authenticated', 'public.match_payloads', 'INSERT')
     or has_function_privilege('anon', 'public.enrich_manual_mix_results(uuid,uuid,timestamptz,jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.enrich_manual_mix_results(uuid,uuid,timestamptz,jsonb)', 'EXECUTE') then
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

  failed := false;
  begin
    perform public.enrich_manual_mix_results(fixture_mix_id, outsider_id,
      (select locked_at from public.mixes where id = fixture_mix_id),
      jsonb_build_array(
        jsonb_build_object('faceitId', 'manual-room-1', 'startedAt', now(), 'scoreA', 13, 'scoreB', 7, 'stats', '[]'::jsonb),
        jsonb_build_object('faceitId', 'manual-room-2', 'startedAt', now(), 'scoreA', 9, 'scoreB', 13, 'stats', '[]'::jsonb)
      ));
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'ASSERT: non-admin enriched manual result'; end if;
  failed := false;
  begin
    perform public.enrich_manual_mix_results(fixture_mix_id, player_id,
      (select locked_at from public.mixes where id = fixture_mix_id),
      jsonb_build_array(
        jsonb_build_object('faceitId', 'manual-room-1', 'startedAt', now(), 'scoreA', 13, 'scoreB', 7,
          'stats', jsonb_build_array(jsonb_build_object('playerId', participants[2], 'team', 'A', 'kills', 21))),
        jsonb_build_object('faceitId', 'manual-room-2', 'startedAt', now(), 'scoreA', 13, 'scoreB', 9, 'stats', '[]'::jsonb)
      ));
  exception when check_violation then failed := true;
  end;
  if not failed or exists (
    select 1 from public.matches where mix_id = fixture_mix_id and stats_origin is not null
  ) or exists (
    select 1 from public.match_player_stats s join public.matches m on m.id = s.match_id
    where m.mix_id = fixture_mix_id
  ) then
    raise exception 'ASSERT: mismatched second map did not roll back enrichment';
  end if;
  perform public.enrich_manual_mix_results(fixture_mix_id, player_id,
    (select locked_at from public.mixes where id = fixture_mix_id),
    jsonb_build_array(
      jsonb_build_object('faceitId', 'manual-room-1', 'mapName', 'Mirage', 'startedAt', now(), 'scoreA', 13, 'scoreB', 7,
        'stats', jsonb_build_array(jsonb_build_object('playerId', participants[2], 'team', 'A', 'kills', 21, 'rating', 1.3,
          'entryAttempts', 4, 'entryWins', 2, 'clutchAttempts', 2, 'clutchWins', 1,
          'flashesThrown', 11, 'flashesSuccessful', 6, 'sniperKills', 3, 'mvps', 5))),
      jsonb_build_object('faceitId', 'manual-room-2', 'mapName', 'Nuke', 'startedAt', now(), 'scoreA', 9, 'scoreB', 13, 'stats', '[]'::jsonb)
    ));
  if (select count(*) from public.matches where mix_id = fixture_mix_id and source = 'manual' and stats_origin = 'faceit') <> 2
     or (select map_name from public.matches where mix_id = fixture_mix_id and map_number = 1) <> 'de_mirage'
     or (select map_name from public.matches where mix_id = fixture_mix_id and map_number = 2) <> 'Nuke'
     or (select score_a from public.matches where mix_id = fixture_mix_id and map_number = 2) <> 9
     or (select s.rating from public.match_player_stats s join public.matches m on m.id = s.match_id
         where m.mix_id = fixture_mix_id and s.player_id = participants[2]) <> 1.3
     or not exists (
       select 1 from public.match_player_stats s join public.matches m on m.id = s.match_id
       where m.mix_id = fixture_mix_id and s.player_id = participants[2]
         and (s.entry_attempts, s.entry_wins, s.clutch_attempts, s.clutch_wins,
              s.flashes_thrown, s.flashes_successful, s.sniper_kills, s.mvps)
           = (4, 2, 2, 1, 11, 6, 3, 5)
     ) then
    raise exception 'ASSERT: FACEIT stats did not preserve manual score provenance';
  end if;
  failed := false;
  begin
    perform public.enrich_manual_mix_results(fixture_mix_id, player_id,
      (select locked_at from public.mixes where id = fixture_mix_id),
      '[{"faceitId":"manual-room-1","scoreA":13,"scoreB":7,"stats":[]},{"faceitId":"manual-room-2","scoreA":9,"scoreB":13,"stats":[]}]'::jsonb);
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'ASSERT: manual result enriched twice'; end if;

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
      'stats', jsonb_build_array(
        jsonb_build_object('playerId', participants[1], 'team', 'A', 'kills', 20, 'deaths', 12, 'rounds', 20, 'rating', 1.2,
          'entryAttempts', 6, 'entryWins', 1, 'clutchAttempts', 3, 'clutchWins', 0,
          'flashesThrown', 12, 'flashesSuccessful', 2, 'sniperKills', 8, 'mvps', 6),
        jsonb_build_object('playerId', participants[2], 'team', 'A', 'kills', 10))),
    jsonb_build_object('faceitId', 'room-2', 'mapName', 'de_nuke', 'startedAt', now(), 'scoreA', 11, 'scoreB', 13, 'stats', '[]'::jsonb)
  ));
  if (select status from public.mixes where id = faceit_mix_id) <> 'played'
     or (select count(*) from public.matches where mix_id = faceit_mix_id) <> 2
     or (select s.kills from public.match_player_stats s where s.player_id = participants[1]) <> 20
     or (select s.rating from public.match_player_stats s where s.player_id = participants[1]) <> 1.2
     or not exists (
       select 1 from public.match_player_stats s join public.matches m on m.id = s.match_id
       where m.mix_id = faceit_mix_id and s.player_id = participants[1]
         and (s.entry_attempts, s.entry_wins, s.clutch_attempts, s.clutch_wins,
              s.flashes_thrown, s.flashes_successful, s.sniper_kills, s.mvps)
           = (6, 1, 3, 0, 12, 2, 8, 6)
     ) or not exists (
       select 1 from public.match_player_stats s join public.matches m on m.id = s.match_id
       where m.mix_id = faceit_mix_id and s.player_id = participants[2]
         and s.entry_attempts is null and s.entry_wins is null
         and s.clutch_attempts is null and s.clutch_wins is null
         and s.flashes_thrown is null and s.flashes_successful is null
         and s.sniper_kills is null and s.mvps is null
     ) then
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

  insert into public.mixes (id, group_id, title, created_by, archive_source, archive_key)
    values (archive_mix_id, group_id, 'Archive test', player_id, 'popflash', 'popflash:test:1');
  for i in 1..10 loop
    insert into public.mix_participants (mix_id, player_id, added_by)
      values (archive_mix_id, participants[i], player_id);
  end loop;
  update public.mixes set status = 'balancing' where id = archive_mix_id;
  insert into public.variants (id, mix_id, number, team_a_score, team_b_score, win_prob_a)
    values (archive_variant_id, archive_mix_id, 1, 1400, 1400, 0.5);
  for i in 1..10 loop
    insert into public.variant_players (variant_id, player_id, team)
      values (archive_variant_id, participants[i], case when i <= 5 then 'A' else 'B' end);
  end loop;
  update public.variants set is_published = true where id = archive_variant_id;
  update public.mixes set status = 'voting' where id = archive_mix_id;
  update public.mixes set status = 'locked', chosen_variant_id = archive_variant_id
    where id = archive_mix_id;
  insert into public.matches (mix_id, score_a, score_b, source, stats_origin, source_reference)
    values (archive_mix_id, 13, 9, 'manual', 'popflash', 'popflash:test-map');
  update public.mixes set status = 'played' where id = archive_mix_id;
  if (select status from public.mixes where id = archive_mix_id) <> 'played'
     or exists (select 1 from public.votes where mix_id = archive_mix_id)
     or (select count(*) from public.variants where mix_id = archive_mix_id) <> 1 then
    raise exception 'ASSERT: one-lineup archive required invented variants or votes';
  end if;
  failed := false;
  begin
    perform public.enrich_manual_mix_results(archive_mix_id, player_id,
      (select locked_at from public.mixes where id = archive_mix_id),
      '[{"faceitId":"archive-room","scoreA":13,"scoreB":9,"stats":[]}]'::jsonb);
  exception when object_not_in_prerequisite_state then failed := true;
  end;
  if not failed then raise exception 'ASSERT: archived mix accepted FACEIT enrichment'; end if;
end;
$$;
