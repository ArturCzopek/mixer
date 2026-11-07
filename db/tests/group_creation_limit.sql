do $$
declare
  v_player uuid := '00000000-0000-4000-8000-000000000801';
  v_admin uuid := '00000000-0000-4000-8000-000000000802';
  v_failed boolean := false;
begin
  insert into public.players (id, steam_id) values (v_player, '76561190000000801');
  insert into public.players (id, steam_id, is_site_admin) values (v_admin, '76561190000000802', true);
  for i in 1..3 loop
    insert into public.groups (slug, name, created_by) values ('limit-' || i, 'Limit ' || i, v_player);
  end loop;
  begin
    insert into public.groups (slug, name, created_by) values ('limit-4', 'Limit 4', v_player);
  exception when check_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'ASSERT: player created a fourth group'; end if;
  for i in 1..4 loop
    insert into public.groups (slug, name, created_by) values ('site-' || i, 'Site ' || i, v_admin);
  end loop;
end;
$$;
