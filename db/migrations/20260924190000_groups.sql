-- Groups (D18): the app can host several friend groups. A player (Steam identity) is global and can
-- belong to many groups; mixes belong to one group and only its active members can take part.
-- Group admins manage their group; players.is_site_admin is the platform-level admin.

alter table public.players rename column is_admin to is_site_admin;
-- Per-group now (group_members): leaving is membership state, the fallback ELO is set by a group admin.
alter table public.players drop column is_active;
alter table public.players drop column manual_skill_override;
-- Discord account link (for voice channel moves, D18); filled by a later OAuth step.
alter table public.players add column discord_user_id text unique;

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'),
  name text not null check (length(name) between 2 and 60),
  -- FACEIT Club where the group plays its mixes (D17); asked for when the group is created
  faceit_club_url text check (faceit_club_url ~ '^https://(www\.)?faceit\.com/'),
  faceit_club_id text,
  -- Discord server of the group; bot settings (voice channel ids etc.) in discord_settings
  discord_guild_id text unique,
  discord_settings jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.players (id),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  player_id uuid not null references public.players (id),
  role text not null default 'member' check (role in ('admin', 'member')),
  manual_skill_override integer check (manual_skill_override between 100 and 5000),
  added_by uuid references public.players (id),
  joined_at timestamptz not null default now(),
  left_at timestamptz, -- kept (not deleted) so past mixes still resolve
  primary key (group_id, player_id)
);
create index group_members_player_idx on public.group_members (player_id);

-- Phase 1 tables are still empty, so the new not null columns need no backfill.
alter table public.mixes add column group_id uuid not null references public.groups (id) on delete cascade;
alter table public.mixes add constraint mixes_id_group_key unique (id, group_id);
create index mixes_group_idx on public.mixes (group_id);

-- group_id is copied from the mix by the trigger below; the composite fks then guarantee that the
-- participant is a member of the mix's group.
alter table public.mix_participants add column group_id uuid not null;
alter table public.mix_participants
  add constraint mix_participants_mix_group_fk
  foreign key (mix_id, group_id) references public.mixes (id, group_id) on delete cascade;
alter table public.mix_participants
  add constraint mix_participants_member_fk
  foreign key (group_id, player_id) references public.group_members (group_id, player_id);

create or replace function public.enforce_mix_cap() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Lock the mix row first so concurrent joins are serialized before counting.
  select m.group_id into new.group_id from public.mixes m where m.id = new.mix_id for update;
  if not exists (
    select 1 from public.group_members gm
    where gm.group_id = new.group_id and gm.player_id = new.player_id and gm.left_at is null
  ) then
    raise exception 'player % is not an active member of the group', new.player_id
      using errcode = 'foreign_key_violation';
  end if;
  if (select count(*) from public.mix_participants where mix_id = new.mix_id) >= 10 then
    raise exception 'mix % is full (10 players)', new.mix_id using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['groups', 'group_members']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "public read" on public.%I for select to anon, authenticated using (true)', t);
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
  end loop;
end;
$$;
