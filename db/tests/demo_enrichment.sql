do $$
declare
  v_group uuid := '00000000-0000-4000-8000-000000000701';
  v_mix uuid := '00000000-0000-4000-8000-000000000702';
  v_match uuid := '00000000-0000-4000-8000-000000000703';
  v_other uuid := '00000000-0000-4000-8000-000000000704';
  v_actor uuid := '00000000-0000-4000-8000-000000000705';
  v_outsider uuid := '00000000-0000-4000-8000-000000000706';
  v_player uuid;
  v_rows jsonb := '[]'::jsonb;
  v_one jsonb;
  v_failed boolean;
  v_hash text := repeat('a', 64);
begin
  insert into public.players (id, steam_id) values
    (v_actor, '76561190000000705'), (v_outsider, '76561190000000706');
  insert into public.groups (id, slug, name, created_by)
    values (v_group, 'demo-test', 'Demo test', v_actor);
  insert into public.mixes (id, group_id, title, created_by, status)
    values (v_mix, v_group, 'Demo test', v_actor, 'played');
  insert into public.matches (id, mix_id, score_a, score_b, map_name, source)
    values (v_match, v_mix, 1, 0, 'de_mirage', 'manual');
  insert into public.matches (id, mix_id, map_number, score_a, score_b, map_name, source)
    values (v_other, v_mix, 2, 0, 1, 'de_nuke', 'faceit');
  for i in 1..10 loop
    insert into public.players (steam_id)
      values ('7656119000000' || lpad(i::text, 4, '0')) returning id into v_player;
    insert into public.match_player_stats (
      match_id, player_id, team, kills, mvps, sniper_kills,
      flashes_thrown, flashes_successful, entry_attempts, entry_wins, raw
    ) values (
      v_match, v_player, case when i <= 5 then 'A' else 'B' end,
      0, 2, 3, 7, 4, 5, 2, '{"apiSource":"faceit"}'::jsonb
    );
    v_one := jsonb_build_object(
      'playerId', v_player, 'steamid', '7656119000000' || lpad(i::text, 4, '0'),
      'team', case when i <= 5 then 'A' else 'B' end,
      'kills', 1, 'deaths', 1, 'assists', 0, 'damage', 100,
      'rounds', 1, 'adr', 100, 'rating', 1, 'headshots', 0,
      'kastRounds', 1, 'openingKills', 0, 'openingDeaths', 0,
      'tradeKills', 0, 'tradedDeaths', 0, 'multi2', 0, 'multi3', 0,
      'multi4', 0, 'multi5', 0, 'clutchAttempts', 0, 'clutchWins', 0,
      'utilityDamage', 0, 'enemiesFlashed', 0, 'flashAssists', 0,
      'raw', jsonb_build_object('kills', 1));
    v_rows := v_rows || jsonb_build_array(v_one);
  end loop;
  if has_function_privilege('anon', 'public.attach_demo_to_match(uuid,uuid,text,text,integer,integer,jsonb,jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.attach_demo_to_match(uuid,uuid,text,text,integer,integer,jsonb,jsonb)', 'EXECUTE') then
    raise exception 'ASSERT: browser can execute demo attachment';
  end if;
  v_failed := false;
  begin
    perform public.attach_demo_to_match(v_match, v_outsider, v_hash, 'mirage', 1, 0, v_rows, '{}'::jsonb);
  exception when insufficient_privilege then v_failed := true;
  end;
  if not v_failed then raise exception 'ASSERT: outsider attached demo'; end if;
  v_failed := false;
  begin
    perform public.attach_demo_to_match(v_match, v_actor, v_hash, 'mirage', 0, 1, v_rows, '{}'::jsonb);
  exception when check_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'ASSERT: wrong score attached demo'; end if;
  v_failed := false;
  begin
    perform public.attach_demo_to_match(v_match, v_actor, v_hash, 'nuke', 1, 0, v_rows, '{}'::jsonb);
  exception when check_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'ASSERT: wrong map attached demo'; end if;
  v_failed := false;
  begin
    perform public.attach_demo_to_match(v_match, v_actor, v_hash, 'mirage', 1, 0,
      jsonb_set(v_rows, '{0,team}', '"B"'::jsonb), '{}'::jsonb);
  exception when check_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'ASSERT: wrong team attached demo'; end if;
  if (select demo_hash from public.matches where id = v_match) is not null
     or (select kills from public.match_player_stats where match_id = v_match limit 1) <> 0 then
    raise exception 'ASSERT: failed attachment changed data';
  end if;
  insert into public.match_payloads (match_id, parser_version, payload)
    values (v_match, 'faceit', '{"source":"faceit"}'::jsonb);
  perform public.attach_demo_to_match(v_match, v_actor, v_hash, 'mirage', 1, 0, v_rows, '{"version":1}'::jsonb);
  perform public.attach_demo_to_match(v_match, v_actor, v_hash, 'mirage', 1, 0, v_rows, '{"version":1}'::jsonb);
  if (select stats_origin from public.matches where id = v_match) <> 'demo'
     or (select count(*) from public.match_player_stats where match_id = v_match and kills = 1) <> 10
     or (select count(*) from public.match_player_stats where match_id = v_match
          and mvps = 2 and sniper_kills = 3 and flashes_thrown = 7
          and flashes_successful = 4 and entry_attempts = 5 and entry_wins = 2
          and raw -> '_previous' ->> 'apiSource' = 'faceit') <> 10
     or (select payload ->> 'version' from public.match_payloads where match_id = v_match) <> '1'
     or (select payload -> '_previous' ->> 'source' from public.match_payloads where match_id = v_match) <> 'faceit' then
    raise exception 'ASSERT: demo not attached atomically';
  end if;
  v_failed := false;
  begin
    perform public.attach_demo_to_match(v_other, v_actor, v_hash, 'nuke', 0, 1, v_rows, '{}'::jsonb);
  exception when unique_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'ASSERT: reused demo hash on another map'; end if;
  v_failed := false;
  begin
    perform public.attach_demo_to_match(v_match, v_actor, repeat('b',64), 'mirage', 1, 0, v_rows, '{}'::jsonb);
  exception when unique_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'ASSERT: existing demo overwritten'; end if;
end;
$$;
