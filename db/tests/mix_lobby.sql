-- M1-5 lobby and transition guards. The harness runs this file in a rolled-back transaction.
do $$
declare
  admin_id uuid;
  outsider_id uuid;
  former_id uuid;
  group_id uuid;
  other_group_id uuid;
  two_char_mix uuid;
  sixty_char_mix uuid;
  order_mix uuid;
  nine_mix uuid;
  full_mix uuid;
  closed_mix uuid;
  group_cascade_mix uuid;
  cancelled_mix uuid;
  illegal_mix uuid;
  other_mix uuid;
  variant_id uuid;
  new_player_id uuid;
  p4 uuid;
  p5 uuid;
  p6 uuid;
  p13 uuid;
  p14 uuid;
  actual uuid[];
  expected uuid[];
  full_roster uuid[];
  variant_set jsonb;
  failed boolean;
  i integer;
begin
  insert into public.players (steam_id) values ('70000000000000001') returning id into admin_id;
  insert into public.players (steam_id) values ('70000000000000002') returning id into outsider_id;
  insert into public.players (steam_id) values ('70000000000000003') returning id into former_id;
  for i in 4..14 loop
    insert into public.players (steam_id) values (lpad(i::text, 17, '7')) returning id into new_player_id;
    if i = 4 then p4 := new_player_id; end if;
    if i = 5 then p5 := new_player_id; end if;
    if i = 6 then p6 := new_player_id; end if;
    if i = 13 then p13 := new_player_id; end if;
    if i = 14 then p14 := new_player_id; end if;
  end loop;

  insert into public.groups (slug, name, created_by)
  values ('verify-mix-lobby', 'Mix Lobby Test', admin_id)
  returning id into group_id;
  insert into public.groups (slug, name, created_by)
  values ('verify-mix-other', 'Other Group', admin_id)
  returning id into other_group_id;
  for i in 4..14 loop
    insert into public.group_members (group_id, player_id)
      select group_id, id from public.players where steam_id = lpad(i::text, 17, '7');
  end loop;
  insert into public.group_members (group_id, player_id, left_at) values (group_id, former_id, now());
  insert into public.group_members (group_id, player_id) values (other_group_id, outsider_id);

  insert into public.mixes (group_id, title, created_by)
    values (group_id, 'OK', admin_id) returning id into two_char_mix;
  insert into public.mixes (group_id, title, created_by)
    values (group_id, repeat('x', 60), admin_id) returning id into sixty_char_mix;

  failed := false;
  begin
    insert into public.mixes (group_id, title, created_by) values (group_id, 'x', admin_id);
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'ASSERT: too-short mix title was accepted'; end if;

  failed := false;
  begin
    insert into public.mixes (group_id, title, created_by) values (group_id, repeat('x', 61), admin_id);
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'ASSERT: too-long mix title was accepted'; end if;

  failed := false;
  begin
    insert into public.mixes (group_id, title, created_by) values (group_id, E' \t\n ', admin_id);
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'ASSERT: whitespace-only mix title was accepted'; end if;

  insert into public.mixes (group_id, title, created_by) values (group_id, 'Join order', admin_id)
    returning id into order_mix;
  insert into public.mix_participants (mix_id, player_id, added_by, created_at)
    values
      (order_mix, p5, admin_id, '2026-09-27 20:02:00+00'),
      (order_mix, p6, admin_id, '2026-09-27 20:02:00+00'),
      (order_mix, p4, admin_id, '2026-09-27 20:01:00+00');
  delete from public.mix_participants where mix_id = order_mix and player_id = p4;
  insert into public.mix_participants (mix_id, player_id, added_by, created_at)
    values (order_mix, p4, admin_id, '2026-09-27 20:03:00+00');
  select array_agg(mp.player_id order by mp.created_at, mp.player_id) into actual
    from public.mix_participants mp where mp.mix_id = order_mix;
  select array[least(p5, p6), greatest(p5, p6), p4] into expected;
  if actual <> expected then raise exception 'ASSERT: participant join order is not stable'; end if;

  insert into public.mixes (group_id, title, created_by) values (group_id, 'Nine players', admin_id)
    returning id into nine_mix;
  for i in 4..12 loop
    insert into public.mix_participants (mix_id, player_id, added_by)
      select nine_mix, id, admin_id from public.players where steam_id = lpad(i::text, 17, '7');
  end loop;

  failed := false;
  begin
    insert into public.mix_participants (mix_id, player_id, added_by)
      values (nine_mix, outsider_id, admin_id);
  exception when foreign_key_violation then failed := true;
  end;
  if not failed then raise exception 'ASSERT: member of another group joined a mix'; end if;
  failed := false;
  begin
    insert into public.mix_participants (mix_id, player_id, added_by)
      values (nine_mix, former_id, admin_id);
  exception when foreign_key_violation then failed := true;
  end;
  if not failed then raise exception 'ASSERT: former member joined a mix'; end if;

  failed := false;
  begin
    update public.mixes set status = 'balancing' where id = nine_mix;
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'ASSERT: balancing began with nine participants'; end if;

  insert into public.mixes (group_id, title, created_by) values (group_id, 'Full lobby', admin_id)
    returning id into full_mix;
  insert into public.mix_participants (mix_id, player_id, added_by)
    values (full_mix, admin_id, admin_id);
  for i in 4..12 loop
    insert into public.mix_participants (mix_id, player_id, added_by)
      select full_mix, id, admin_id from public.players where steam_id = lpad(i::text, 17, '7');
  end loop;
  if (select count(*) from public.mix_participants where mix_id = full_mix) <> 10 then
    raise exception 'ASSERT: ten participants did not fit';
  end if;

  failed := false;
  begin
    insert into public.mix_participants (mix_id, player_id, added_by) values (full_mix, p13, admin_id);
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'ASSERT: eleventh participant was accepted'; end if;

  -- A direct delete is allowed while sign-ups are open; the rejoin moves to the end.
  delete from public.mix_participants where mix_id = full_mix and player_id = p4;
  insert into public.mix_participants (mix_id, player_id, added_by) values (full_mix, p4, admin_id);

  update public.mixes set status = 'balancing' where id = full_mix;
  failed := false;
  begin
    insert into public.mix_participants (mix_id, player_id, added_by) values (full_mix, p13, admin_id);
  exception when object_not_in_prerequisite_state then failed := true;
  end;
  if not failed then raise exception 'ASSERT: participant insert worked after sign-ups closed'; end if;
  failed := false;
  begin
    delete from public.mix_participants where mix_id = full_mix and player_id = p4;
  exception when object_not_in_prerequisite_state then failed := true;
  end;
  if not failed then raise exception 'ASSERT: participant delete worked after sign-ups closed'; end if;

  -- Reopening clears any pending set. A fresh set must be approved before voting starts.
  update public.mixes set status = 'balancing' where id = full_mix;
  update public.mixes set status = 'open' where id = full_mix;
  update public.mixes set status = 'balancing' where id = full_mix;
  select array_agg(player_id order by created_at, player_id) into full_roster
  from public.mix_participants where mix_id = full_mix;
  variant_set := jsonb_build_array(
    jsonb_build_object('splitKey', 'lobby-1', 'teamA', to_jsonb(full_roster[1:5]), 'teamB', to_jsonb(full_roster[6:10]), 'avgA', 1500, 'avgB', 1500, 'winProbA', 0.5),
    jsonb_build_object('splitKey', 'lobby-2', 'teamA', to_jsonb(array[full_roster[1], full_roster[2], full_roster[3], full_roster[4], full_roster[6]]), 'teamB', to_jsonb(array[full_roster[5], full_roster[7], full_roster[8], full_roster[9], full_roster[10]]), 'avgA', 1501, 'avgB', 1499, 'winProbA', 0.51),
    jsonb_build_object('splitKey', 'lobby-3', 'teamA', to_jsonb(array[full_roster[1], full_roster[2], full_roster[3], full_roster[7], full_roster[8]]), 'teamB', to_jsonb(array[full_roster[4], full_roster[5], full_roster[6], full_roster[9], full_roster[10]]), 'avgA', 1499, 'avgB', 1501, 'winProbA', 0.49)
  );
  perform public.create_mix_variant_set(full_mix, '{}'::jsonb, null, variant_set);
  perform public.approve_mix_variant_set(full_mix, 1);
  update public.mixes set status = 'locked' where id = full_mix;
  update public.mixes set status = 'voting' where id = full_mix;
  update public.mixes set status = 'locked' where id = full_mix;
  update public.mixes set status = 'played' where id = full_mix;
  failed := false;
  begin
    update public.mixes set status = 'cancelled' where id = full_mix;
  exception when object_not_in_prerequisite_state then failed := true;
  end;
  if not failed then raise exception 'ASSERT: played mix was not terminal'; end if;

  insert into public.mixes (group_id, title, created_by) values (group_id, 'Cancelled', admin_id)
    returning id into cancelled_mix;
  update public.mixes set status = 'cancelled' where id = cancelled_mix;
  update public.mixes set status = 'cancelled' where id = cancelled_mix;
  failed := false;
  begin
    update public.mixes set status = 'open' where id = cancelled_mix;
  exception when object_not_in_prerequisite_state then failed := true;
  end;
  if not failed then raise exception 'ASSERT: cancelled mix was not terminal'; end if;

  insert into public.mixes (group_id, title, created_by) values (group_id, 'Illegal edge', admin_id)
    returning id into illegal_mix;
  failed := false;
  begin
    update public.mixes set status = 'locked' where id = illegal_mix;
  exception when object_not_in_prerequisite_state then failed := true;
  end;
  if not failed then raise exception 'ASSERT: open to locked transition was accepted'; end if;

  -- Closed-mix deletion still cascades through the participant delete trigger.
  insert into public.mixes (group_id, title, created_by) values (group_id, 'Closed cascade', admin_id)
    returning id into closed_mix;
  insert into public.mix_participants (mix_id, player_id, added_by)
    values (closed_mix, admin_id, admin_id);
  for i in 4..12 loop
    insert into public.mix_participants (mix_id, player_id, added_by)
      select closed_mix, id, admin_id from public.players where steam_id = lpad(i::text, 17, '7');
  end loop;
  update public.mixes set status = 'balancing' where id = closed_mix;
  delete from public.mixes where id = closed_mix;
  if exists (select 1 from public.mix_participants where mix_id = closed_mix) then
    raise exception 'ASSERT: closed mix participant cascade failed';
  end if;

  -- Group deletion also removes a closed mix and its participants through both cascades.
  insert into public.mixes (group_id, title, created_by) values (group_id, 'Group cascade', admin_id)
    returning id into group_cascade_mix;
  insert into public.mix_participants (mix_id, player_id, added_by)
    values (group_cascade_mix, admin_id, admin_id);
  for i in 4..12 loop
    insert into public.mix_participants (mix_id, player_id, added_by)
      select group_cascade_mix, id, admin_id from public.players where steam_id = lpad(i::text, 17, '7');
  end loop;
  update public.mixes set status = 'balancing' where id = group_cascade_mix;
  delete from public.groups where id = group_id;
  if exists (select 1 from public.mix_participants where mix_id = group_cascade_mix) then
    raise exception 'ASSERT: group cascade left participants behind';
  end if;

  -- Keep the cross-mix chosen_variant foreign-key behavior covered here as well.
  insert into public.mixes (group_id, title, created_by)
    values (other_group_id, 'Variant owner', admin_id) returning id into other_mix;
  insert into public.mixes (group_id, title, created_by)
    values (other_group_id, 'Other mix', admin_id) returning id into group_cascade_mix;
  insert into public.variants (mix_id, number, team_a_score, team_b_score, win_prob_a)
    values (group_cascade_mix, 1, 1500, 1490, 0.51) returning id into variant_id;
  failed := false;
  begin
    update public.mixes set chosen_variant_id = variant_id where id = other_mix;
  exception when foreign_key_violation then failed := true;
  end;
  if not failed then raise exception 'ASSERT: chosen variant from another mix was accepted'; end if;
end;
$$;
