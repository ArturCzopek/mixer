-- Security audit 2026-11-07: the publishable key could read balancing inputs the pages hide on
-- purpose (skill snapshots while an admin is still balancing, admin-entered fallback ELO).
-- Same pattern as players/groups: column grants, so columns added later stay private by default.
revoke select on table public.mix_participants from public, anon, authenticated;
grant select (mix_id, player_id, group_id, added_by, created_at)
  on table public.mix_participants to anon, authenticated;

revoke select on table public.group_members from public, anon, authenticated;
grant select (group_id, player_id, role, added_by, joined_at, left_at)
  on table public.group_members to anon, authenticated;
