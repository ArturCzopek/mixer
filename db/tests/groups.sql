-- Behaviour checks for group admins (M1-G, D36): creator becomes admin, last admin cannot go.
do $$
declare
  a uuid;
  b uuid;
  grp uuid;
  failed boolean;
begin
  insert into public.players (steam_id) values ('70000000000000001') returning id into a;
  insert into public.players (steam_id) values ('70000000000000002') returning id into b;
  insert into public.groups (slug, name, created_by) values ('verify-admins', 'Verify', a) returning id into grp;

  if not exists (
    select 1 from public.group_members
    where group_id = grp and player_id = a and role = 'admin' and left_at is null
  ) then
    raise exception 'ASSERT: group creator is not an admin';
  end if;

  -- the only admin can neither step down nor leave
  failed := false;
  begin
    update public.group_members set role = 'member' where group_id = grp and player_id = a;
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'ASSERT: last admin was demoted'; end if;
  failed := false;
  begin
    update public.group_members set left_at = now() where group_id = grp and player_id = a;
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'ASSERT: last admin left'; end if;

  -- with a second admin, the first may step down; then the second is the last one
  insert into public.group_members (group_id, player_id, role, added_by) values (grp, b, 'admin', a);
  update public.group_members set role = 'member' where group_id = grp and player_id = a;
  update public.group_members set left_at = now() where group_id = grp and player_id = a;
  failed := false;
  begin
    update public.group_members set role = 'member' where group_id = grp and player_id = b;
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'ASSERT: last remaining admin was demoted'; end if;
end;
$$;
