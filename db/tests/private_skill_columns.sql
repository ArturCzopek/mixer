-- Balancing inputs stay server-only; the lobby's realtime columns stay readable.
do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if has_column_privilege(r, 'public.mix_participants', 'skill_snapshot', 'SELECT') then
      raise exception 'ASSERT: % can select mix_participants.skill_snapshot', r;
    end if;
    if has_column_privilege(r, 'public.group_members', 'manual_skill_override', 'SELECT') then
      raise exception 'ASSERT: % can select group_members.manual_skill_override', r;
    end if;
    if not has_column_privilege(r, 'public.mix_participants', 'mix_id', 'SELECT')
       or not has_column_privilege(r, 'public.mix_participants', 'player_id', 'SELECT')
       or not has_column_privilege(r, 'public.group_members', 'role', 'SELECT') then
      raise exception 'ASSERT: % lost a public lobby column', r;
    end if;
    if has_column_privilege(r, 'public.players', 'session_version', 'SELECT') then
      raise exception 'ASSERT: % can select players.session_version', r;
    end if;
  end loop;
end;
$$;
