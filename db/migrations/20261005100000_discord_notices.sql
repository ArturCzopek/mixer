-- D-4: Discord notices already posted for a mix ('created', 'locked', 'played'), so each posts once.
alter table public.mixes add column discord_notices text[] not null default '{}';
