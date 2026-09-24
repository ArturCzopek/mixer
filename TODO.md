# TODO (owner actions + session handoff)

Live checklist of things only the owner can do, plus where the next Claude session should start.
Task IDs refer to [docs/07-roadmap.md](docs/07-roadmap.md).

## Where the keys are (read this first)

- **GitHub Actions secrets** (repo Settings → Secrets → Actions) hold all keys: `FACEIT_API_KEY`,
  `STEAM_WEB_API_KEY`, `LEETIFY_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  `SUPABASE_SECRET_KEY`, `SUPABASE_ACCESS_TOKEN` (checked 2026-09-24 by the `API spike` workflow).
- The **Claude cloud sandbox sees none of them** (Actions secrets exist only inside workflow runs), and
  `open.faceit.com` blocks the sandbox anyway (Cloudflare challenge). So Claude runs live API / DB work
  through manual workflows it can trigger: `API spike` (`.github/workflows/api-spike.yml`) and, from P0-3,
  `DB migrate`. Nothing else to set up for that.
- Optional: the same keys as **cloud environment variables** would let Claude call Steam / Leetify /
  Supabase directly from the sandbox (quicker debugging). Not required.

## Owner (Artur)

- [x] Cloud environment: network access for FACEIT, Steam, Supabase, Leetify, Google Drive
- [x] Keys in GitHub Actions secrets (all names match `.env.example`)
- [x] Leetify key valid (use header `_leetify_key`; `Authorization: Bearer` returns 401)
- [ ] FACEIT developer terms: glance at the Developer Portal terms (docs.faceit.com is blocked for Claude)
      for anything against storing derived stats (ELO/form snapshot, per-map stats of our mixes).
- [x] Vercel project created
- [ ] Vercel env vars (needed from M1-1 / P0-4, not urgent): check which Supabase vars the integration
      added, then add `FACEIT_API_KEY`, `STEAM_WEB_API_KEY`, `LEETIFY_API_KEY`, `ADMIN_STEAM_IDS=76561197993187687`,
      `SESSION_SECRET` and `CRON_SECRET` (each `openssl rand -base64 32`), `APP_URL` (the Vercel URL).
      Keys shown only once can be regenerated (FACEIT App Studio, Steam dev page, Supabase API keys).
- [ ] *(optional, for demo extras M4-6)* **S4 browser test:** once the demo spike page exists, run it
      locally (`npm run dev`), drop the demo `.dem` in the browser and note parse time + memory.
- [ ] **S5 FACEIT Club:** create a free Club + private queue for the group (we play there from now on, D17);
      note whether club matches change main FACEIT ELO; after the first mix send Claude the match room link(s)
- [ ] Confirm "Jawor" in the 2026-09-20 mix = Steam `jawOla.exe` / FACEIT `jawOla21` (matched by elimination)
- [ ] More past mixes (date, teams, score per map) for the balancing backtest (T-1)

## Next Claude session: start here

1. Read `CLAUDE.md`, this file and `docs/07-roadmap.md`.
2. Done so far: M1-4, P0-1, **S3** (FACEIT fields/units/rate limits in `docs/06` "Spike S3 findings",
   fixtures in `lib/external/__fixtures__/`), **P0-3** (Phase 1 schema live on Supabase, applied by the
   `DB migrate` workflow; see `lib/db/README.md`).
3. Live API / DB work goes through workflows (GitHub MCP `actions_run_trigger` on `main`, then read logs
   with `get_job_logs`): `api-spike.yml` refreshes fixtures and commits them back (`git pull` after);
   `db-migrate.yml` runs automatically on pushes touching `db/`.
4. Next: **M1-2** (`lib/external/steam.ts`, `faceit.ts`, Zod on the recorded fixtures; games-stats
   `from`/`to` in ms, values are strings; Leetify header `_leetify_key`), then **M1-1** (Steam login) and P0-4.
