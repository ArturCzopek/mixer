-- M1-G (D36): group invariants the database keeps, whatever server code does.
-- 1. Whoever creates a group becomes its first admin, in the same statement.
-- 2. A group always keeps at least one active admin.

create function public.add_group_creator() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.group_members (group_id, player_id, role, added_by)
  values (new.id, new.created_by, 'admin', new.created_by);
  return new;
end;
$$;

create trigger groups_creator_is_admin
  after insert on public.groups
  for each row execute function public.add_group_creator();

create function public.keep_group_admin() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.role = 'admin' and old.left_at is null
     and (new.role <> 'admin' or new.left_at is not null) then
    -- Lock the group so two admins demoting each other at once are serialized.
    perform 1 from public.groups g where g.id = old.group_id for update;
    if not exists (
      select 1 from public.group_members gm
      where gm.group_id = old.group_id and gm.role = 'admin' and gm.left_at is null
        and gm.player_id <> old.player_id
    ) then
      raise exception 'group % must keep at least one admin', old.group_id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger group_members_keep_admin
  before update on public.group_members
  for each row execute function public.keep_group_admin();

revoke execute on function public.add_group_creator() from public, anon, authenticated;
revoke execute on function public.keep_group_admin() from public, anon, authenticated;
