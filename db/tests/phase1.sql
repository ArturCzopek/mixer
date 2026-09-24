-- Behaviour checks for the Phase 1 schema. Runs inside a transaction that is rolled back:
-- locally on PGlite (lib/db/migrations.test.ts) and against Supabase by scripts/db-migrate.mjs --verify.
do $$
declare
  admin_id uuid;
  outsider_id uuid;
  former_id uuid;
  grp uuid;
  other_grp uuid;
  mix1 uuid;
  mix2 uuid;
  var1 uuid;
  var2 uuid;
  p uuid;
  i int;
  failed boolean;
begin
  insert into public.players (steam_id) values ('70000000000000000') returning id into admin_id;
  insert into public.players (steam_id) values ('70000000000000099') returning id into outsider_id;
  insert into public.players (steam_id) values ('70000000000000098') returning id into former_id;
  insert into public.groups (slug, name, faceit_club_url, created_by)
    values ('verify-group', 'Verify', 'https://www.faceit.com/en/club/00000000-0000-0000-0000-000000000000', admin_id)
    returning id into grp;
  insert into public.groups (slug, name, created_by) values ('verify-other', 'Other', admin_id) returning id into other_grp;
  insert into public.group_members (group_id, player_id, role) values (grp, admin_id, 'admin');
  insert into public.group_members (group_id, player_id, left_at) values (grp, former_id, now());
  insert into public.group_members (group_id, player_id) values (other_grp, outsider_id);
  insert into public.mixes (group_id, title, created_by) values (grp, 'verify 1', admin_id) returning id into mix1;
  insert into public.mixes (group_id, title, created_by) values (grp, 'verify 2', admin_id) returning id into mix2;

  -- only active members of the mix's group can join
  failed := false;
  begin
    insert into public.mix_participants (mix_id, player_id, added_by) values (mix1, outsider_id, admin_id);
  exception when foreign_key_violation then failed := true;
  end;
  if not failed then raise exception 'ASSERT: member of another group joined the mix'; end if;
  failed := false;
  begin
    insert into public.mix_participants (mix_id, player_id, added_by) values (mix1, former_id, admin_id);
  exception when foreign_key_violation then failed := true;
  end;
  if not failed then raise exception 'ASSERT: former member joined the mix'; end if;

  -- 10 participants fit (group_id is filled from the mix)
  for i in 1..10 loop
    insert into public.players (steam_id) values (lpad(i::text, 17, '7')) returning id into p;
    insert into public.group_members (group_id, player_id) values (grp, p);
    insert into public.mix_participants (mix_id, player_id, added_by) values (mix1, p, admin_id);
  end loop;
  if (select count(*) from public.mix_participants where mix_id = mix1 and group_id = grp) <> 10 then
    raise exception 'ASSERT: participants did not get the group of the mix';
  end if;

  -- the 11th is rejected
  failed := false;
  begin
    insert into public.mix_participants (mix_id, player_id, added_by) values (mix1, admin_id, admin_id);
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'ASSERT: 11th participant was accepted'; end if;

  -- invalid group slug / FACEIT link
  failed := false;
  begin
    insert into public.groups (slug, name, created_by) values ('Bad Slug', 'x y', admin_id);
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'ASSERT: invalid group slug was accepted'; end if;
  failed := false;
  begin
    insert into public.groups (slug, name, faceit_club_url, created_by) values ('ok-slug', 'Ok', 'https://evil.example/', admin_id);
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'ASSERT: non-FACEIT club link was accepted'; end if;

  insert into public.variants (mix_id, number, team_a_score, team_b_score, win_prob_a)
    values (mix1, 1, 1500, 1490, 0.51) returning id into var1;
  insert into public.variants (mix_id, number, team_a_score, team_b_score, win_prob_a)
    values (mix2, 1, 1500, 1490, 0.51) returning id into var2;

  select player_id into p from public.mix_participants where mix_id = mix1 limit 1;
  insert into public.votes (mix_id, voter_id, variant_id, cast_by) values (mix1, p, var1, p);

  -- a non-participant cannot vote
  failed := false;
  begin
    insert into public.votes (mix_id, voter_id, variant_id, cast_by) values (mix1, outsider_id, var1, outsider_id);
  exception when foreign_key_violation then failed := true;
  end;
  if not failed then raise exception 'ASSERT: non-participant vote was accepted'; end if;

  -- a vote for another mix's variant is rejected
  failed := false;
  begin
    update public.votes set variant_id = var2 where mix_id = mix1 and voter_id = p;
  exception when foreign_key_violation then failed := true;
  end;
  if not failed then raise exception 'ASSERT: vote for a variant of another mix was accepted'; end if;

  -- chosen variant must belong to the mix
  failed := false;
  begin
    update public.mixes set chosen_variant_id = var2 where id = mix1;
  exception when foreign_key_violation then failed := true;
  end;
  if not failed then raise exception 'ASSERT: chosen variant from another mix was accepted'; end if;
  update public.mixes set chosen_variant_id = var1, status = 'locked' where id = mix1;

  -- SteamID64 format
  failed := false;
  begin
    insert into public.players (steam_id) values ('123');
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'ASSERT: invalid steam_id was accepted'; end if;
end;
$$;

-- anon can read but not write
set local role anon;
select count(*) from public.mixes;
do $$
declare
  failed boolean := false;
begin
  begin
    insert into public.groups (slug, name, created_by) select 'anon-group', 'Anon', id from public.players limit 1;
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'ASSERT: anon could insert into groups'; end if;
end;
$$;
reset role;
