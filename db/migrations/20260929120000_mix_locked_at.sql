-- FACEIT candidate windows start when the lineup was locked, not at mix creation.
alter table public.mixes add column locked_at timestamptz;

create function public.stamp_mix_lock() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'locked' and old.status is distinct from 'locked' then
    new.locked_at := now();
  elsif old.status = 'locked' and new.status = 'voting' then
    new.locked_at := null;
  end if;
  return new;
end;
$$;
create trigger mixes_stamp_lock
  before update of status on public.mixes
  for each row execute function public.stamp_mix_lock();
revoke execute on function public.stamp_mix_lock() from public, anon, authenticated;

-- No historical locked/played rows exist in the approved project at migration time.
