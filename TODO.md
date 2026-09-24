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
- [ ] **S4 browser test (when your tokens renew):** once the demo spike page exists, run it locally
      (`npm run dev`), drop the demo `.dem` in the browser and note parse time + memory. Local machine
      = real browser numbers; the cloud sandbox only measured native Node.
- [ ] Demo from an actual **mix** on Valve PM (your POV recording or the match demo) for S1
- [ ] More past mixes (date, teams, score per map) for the balancing backtest (T-1)

## Next Claude session: start here

1. Read `CLAUDE.md`, this file and `docs/07-roadmap.md`.
2. Check `env` for the keys above and that FACEIT/Steam APIs respond.
3. Do **S3** (FACEIT API spike: fields for ELO + per-match stats for `faceitMatchRating`, rate limits,
   fixtures for the 12 roster SteamIDs in `db/seed/roster.json`), then map the nicknames in
   `lib/balance/__fixtures__/mix-2026-09-20.json` to SteamIDs.
4. Then **P0-3** (schema + migrations) if `SUPABASE_ACCESS_TOKEN` is set.
