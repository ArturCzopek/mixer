-- Browser visibility checks for A3 / Q1.
-- The test harness wraps this file in a transaction and rolls it back.

insert into public.players (
  id, steam_id, display_name, avatar_url, faceit_player_id, faceit_nickname,
  discord_user_id, preferred_role, is_site_admin, last_login_at
) values
  (
    '00000000-0000-4000-8000-000000000001',
    '70000000000000001',
    'Visibility Admin',
    null,
    'verify-faceit-1',
    'verify-player-1',
    'verify-discord-user-1',
    'rifle',
    true,
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    '70000000000000002',
    'Visibility Member',
    null,
    'verify-faceit-2',
    'verify-player-2',
    'verify-discord-user-2',
    'any',
    false,
    null
  );

insert into public.groups (
  id, slug, name, discord_guild_id, discord_settings, created_by
) values (
  '00000000-0000-4000-8000-000000000010',
  'verify-visibility',
  'Visibility Test',
  'verify-discord-guild',
  '{"private_test_setting":"must-not-be-public"}'::jsonb,
  '00000000-0000-4000-8000-000000000001'
);

insert into public.mixes (id, group_id, title, created_by)
values (
  '00000000-0000-4000-8000-000000000020',
  '00000000-0000-4000-8000-000000000010',
  'Visibility test mix',
  '00000000-0000-4000-8000-000000000001'
);

insert into public.variants (
  id, mix_id, number, is_published, team_a_score, team_b_score, win_prob_a
) values
  (
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000020',
    1,
    true,
    1500,
    1490,
    0.51
  ),
  (
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000020',
    2,
    false,
    1480,
    1510,
    0.48
  );

insert into public.variant_players (variant_id, player_id, team)
values
  (
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000001',
    'A'
  ),
  (
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000002',
    'B'
  );

set local role anon;

do $$
begin
  if (
    select count(*)
    from public.variants
    where mix_id = '00000000-0000-4000-8000-000000000020'
  ) <> 1 then
    raise exception 'ASSERT: anon must see only the published variant';
  end if;

  if not exists (
    select 1 from public.variants
    where id = '00000000-0000-4000-8000-000000000101'
  ) then
    raise exception 'ASSERT: anon cannot see the published variant';
  end if;

  if exists (
    select 1 from public.variants
    where id = '00000000-0000-4000-8000-000000000102'
  ) then
    raise exception 'ASSERT: anon can see the unpublished variant';
  end if;

  if (
    select count(*)
    from public.variant_players
    where variant_id in (
      '00000000-0000-4000-8000-000000000101',
      '00000000-0000-4000-8000-000000000102'
    )
  ) <> 1 then
    raise exception 'ASSERT: anon must see players only for the published variant';
  end if;

  if not exists (
    select 1 from public.variant_players
    where variant_id = '00000000-0000-4000-8000-000000000101'
      and player_id = '00000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'ASSERT: anon cannot see the published variant player';
  end if;

  perform
    id, steam_id, display_name, avatar_url, faceit_player_id, faceit_nickname,
    discord_user_id, preferred_role, created_at
  from public.players
  where id = '00000000-0000-4000-8000-000000000001';

  perform
    id, slug, name, faceit_club_url, faceit_club_id, discord_guild_id,
    created_by, created_at
  from public.groups
  where id = '00000000-0000-4000-8000-000000000010';

  begin
    perform last_login_at
    from public.players
    where id = '00000000-0000-4000-8000-000000000001';
    raise exception 'ASSERT: anon selected players.last_login_at';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform is_site_admin
    from public.players
    where id = '00000000-0000-4000-8000-000000000001';
    raise exception 'ASSERT: anon selected players.is_site_admin';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform discord_settings
    from public.groups
    where id = '00000000-0000-4000-8000-000000000010';
    raise exception 'ASSERT: anon selected groups.discord_settings';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;

-- Authenticated has the same column boundary, even though this test uses no user JWT.
do $$
begin
  if not has_column_privilege(
    'authenticated', 'public.players', 'display_name', 'SELECT'
  ) then
    raise exception 'ASSERT: authenticated cannot select a granted player column';
  end if;

  if has_column_privilege(
    'authenticated', 'public.players', 'last_login_at', 'SELECT'
  ) then
    raise exception 'ASSERT: authenticated can select players.last_login_at';
  end if;

  if has_column_privilege(
    'authenticated', 'public.players', 'is_site_admin', 'SELECT'
  ) then
    raise exception 'ASSERT: authenticated can select players.is_site_admin';
  end if;

  if has_column_privilege(
    'authenticated', 'public.groups', 'discord_settings', 'SELECT'
  ) then
    raise exception 'ASSERT: authenticated can select groups.discord_settings';
  end if;
end;
$$;

-- The migration leaves service_role's direct table grants and RLS bypass intact.
set local role service_role;

do $$
begin
  if (
    select count(*)
    from public.variants
    where mix_id = '00000000-0000-4000-8000-000000000020'
  ) <> 2 then
    raise exception 'ASSERT: service_role did not bypass variant RLS';
  end if;

  perform last_login_at, is_site_admin
  from public.players
  where id = '00000000-0000-4000-8000-000000000001';

  perform discord_settings
  from public.groups
  where id = '00000000-0000-4000-8000-000000000010';
end;
$$;

reset role;
