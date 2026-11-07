-- Security audit 2026-11-07: any Steam account can sign in, so group creation is capped to stop
-- spam groups, slug squatting and API/DB quota use on the free tiers. Site admins are exempt.
create function public.limit_groups_per_creator() returns trigger
language plpgsql volatile
set search_path = ''
as $$
begin
  if exists (select 1 from public.players p where p.id = new.created_by and p.is_site_admin) then
    return new;
  end if;
  -- Serialize one creator's inserts so two parallel requests cannot both pass the count.
  perform pg_advisory_xact_lock(hashtext('groups_per_creator:' || new.created_by::text));
  if (select count(*) from public.groups where created_by = new.created_by) >= 3 then
    raise exception 'a player may create at most 3 groups'
      using errcode = 'check_violation', constraint = 'groups_per_creator_limit';
  end if;
  return new;
end;
$$;

create trigger groups_per_creator_limit
  before insert on public.groups
  for each row execute function public.limit_groups_per_creator();

revoke execute on function public.limit_groups_per_creator() from public, anon, authenticated;
