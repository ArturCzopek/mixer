-- Security audit 2026-11-07: session cookies are 30-day JWTs. Each one carries the player's
-- session_version from login; bumping it (on logout) revokes every older cookie on every device.
-- players has column-level grants, so the new column stays private to the service role.
alter table public.players add column session_version integer not null default 0
  check (session_version >= 0);
