-- Atomic claim: true for exactly one caller per (mix, flag); concurrent flags never overwrite each other.
create function public.claim_mix_flag(p_mix_id uuid, p_flag text) returns boolean
language sql volatile
set search_path = ''
as $$
  with claimed as (
    update public.mixes set discord_notices = array_append(discord_notices, p_flag)
    where id = p_mix_id and not (p_flag = any(discord_notices))
    returning 1
  )
  select exists (select 1 from claimed);
$$;
revoke execute on function public.claim_mix_flag(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_mix_flag(uuid, text) to service_role;
