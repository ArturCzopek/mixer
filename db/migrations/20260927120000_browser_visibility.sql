-- A3 / Q1: unpublished variants and private columns are not browser-readable.
-- Revoke PUBLIC as well as the API roles so inherited table grants cannot expose columns.

drop policy if exists "public read" on public.variants;
create policy "published variants read"
  on public.variants
  for select
  to anon, authenticated
  using (is_published);

drop policy if exists "public read" on public.variant_players;
create policy "published variant players read"
  on public.variant_players
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.variants v
      where v.id = variant_players.variant_id
        and v.is_published
    )
  );

-- Column grants make newly added columns private until explicitly granted.
revoke select on table public.players from public, anon, authenticated;
grant select (
  id,
  steam_id,
  display_name,
  avatar_url,
  faceit_player_id,
  faceit_nickname,
  discord_user_id,
  preferred_role,
  created_at
) on table public.players to anon, authenticated;

revoke select on table public.groups from public, anon, authenticated;
grant select (
  id,
  slug,
  name,
  faceit_club_url,
  faceit_club_id,
  discord_guild_id,
  created_by,
  created_at
) on table public.groups to anon, authenticated;
