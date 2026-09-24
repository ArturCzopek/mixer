# TODO (owner actions + session handoff)

Live checklist of things only the owner can do, plus where the next Claude session should start.
Task IDs refer to [docs/07-roadmap.md](docs/07-roadmap.md).

## Owner (Artur)

- [x] Cloud environment: network access for FACEIT, Steam, Supabase, Leetify, Google Drive
- [x] Cloud environment variables: `FACEIT_API_KEY`, `STEAM_WEB_API_KEY`, `LEETIFY_API_KEY`, 3× Supabase
- [ ] Cloud environment: check the Supabase variable **names** match `.env.example`
      (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`), or tell Claude the names you used
- [ ] Cloud environment: add `SUPABASE_ACCESS_TOKEN` (supabase.com/dashboard/account/tokens) so Claude can run migrations (P0-3)
- [x] Vercel project created
- [ ] Vercel env vars (needed from M1-1 / P0-4, not urgent): check which Supabase vars the integration
      added, then add `FACEIT_API_KEY`, `STEAM_WEB_API_KEY`, `LEETIFY_API_KEY`, `ADMIN_STEAM_IDS=76561197993187687`,
      `SESSION_SECRET` and `CRON_SECRET` (each `openssl rand -base64 32`), `APP_URL` (the Vercel URL).
      Keys shown only once can be regenerated (FACEIT App Studio, Steam dev page, Supabase API keys).
- [ ] *(optional, for demo extras M4-6)* **S4 browser test:** once the demo spike page exists, run it
      locally (`npm run dev`), drop the demo `.dem` in the browser and note parse time + memory.
- [ ] **S5 FACEIT Club:** create a free Club + private queue for the group (we play there from now on, D17);
      note whether club matches change main FACEIT ELO; after the first mix send Claude the match room link(s)
- [ ] More past mixes (date, teams, score per map) for the balancing backtest (T-1)

## Next Claude session: start here

1. Read `CLAUDE.md`, this file and `docs/07-roadmap.md`.
2. Check `env` for the keys above and that FACEIT/Steam APIs respond.
3. Do **S3** (FACEIT API spike: fields for ELO + per-match stats for `faceitMatchRating`, match stats
   endpoint `/matches/{id}/stats` (use the test match `1-1cb5b18b-6856-42a9-bf3c-561c0737b52f`),
   rate limits, terms on storing match stats, fixtures for the 12 roster SteamIDs in
   `db/seed/roster.json`), then map the nicknames in `lib/balance/__fixtures__/mix-2026-09-20.json`
   to SteamIDs. Note: the 2026-09-20 mix itself was on Valve PM (no FACEIT room); only the
   scores/lineups are known.
4. Then **P0-3** (schema + migrations) if `SUPABASE_ACCESS_TOKEN` is set, then M1-1 onward.
