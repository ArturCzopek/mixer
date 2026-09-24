-- Behaviour checks for the Phase 1 schema. Runs inside a transaction that is rolled back:
-- locally on PGlite (lib/db/migrations.test.ts) and against Supabase by scripts/db-migrate.mjs --verify.
do $$
declare
  admin_id uuid;
  outsider_id uuid;
  mix1 uuid;
  mix2 uuid;
  var1 uuid;
  var2 uuid;
  p uuid;
  i int;
  failed boolean;
begin
  insert into public.players (steam_id, is_admin) values ('70000000000000000', true) returning id into admin_id;
  insert into public.players (steam_id) values ('70000000000000099') returning id into outsider_id;
  insert into public.mixes (title, created_by) values ('verify 1', admin_id) returning id into mix1;
  insert into public.mixes (title, created_by) values ('verify 2', admin_id) returning id into mix2;

  -- 10 participants fit
  for i in 1..10 loop
    insert into public.players (steam_id) values (lpad(i::text, 17, '7')) returning id into p;
    insert into public.mix_participants (mix_id, player_id, added_by) values (mix1, p, admin_id);
  end loop;

  -- the 11th is rejected
  failed := false;
  begin
    insert into public.mix_participants (mix_id, player_id, added_by) values (mix1, outsider_id, admin_id);
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'ASSERT: 11th participant was accepted'; end if;

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
    insert into public.players (steam_id) values ('70000000000000098');
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'ASSERT: anon could insert into players'; end if;
end;
$$;
reset role;
