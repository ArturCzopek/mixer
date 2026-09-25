# TODO (owner actions + session handoff)

Live checklist of things only the owner can do, plus where the next Claude session should start.
Task IDs refer to [docs/07-roadmap.md](docs/07-roadmap.md).

## Where the keys are (read this first)

- **Local machine (from 2026-09-24 we work locally):** copy `.env.example` → `.env.local` and fill it
  (same values as the GitHub secrets). Locally `open.faceit.com` works, so no workflow detour is needed:
  - `npm ci && npm run dev`
  - migrations: `node --env-file=.env.local scripts/db-migrate.mjs --verify` (needs `SUPABASE_ACCESS_TOKEN`)
  - refresh API fixtures: `node --env-file=.env.local scripts/faceit-spike.mjs`
- **GitHub Actions secrets** hold the same keys: `FACEIT_API_KEY`, `STEAM_WEB_API_KEY`, `LEETIFY_API_KEY`,
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`,
  `SUPABASE_ACCESS_TOKEN`. The `DB migrate` workflow applies migrations on every push to `main` touching
  `db/`; `API spike` (manual) records fixtures and commits them back.
- Claude **cloud** sessions see no keys and cannot reach `open.faceit.com` (Cloudflare challenge); there
  they use the two workflows (GitHub MCP `actions_run_trigger`, then `get_job_logs`).

## Owner (Artur)

- [x] Cloud environment: network access for FACEIT, Steam, Supabase, Leetify, Google Drive
- [x] Keys in GitHub Actions secrets (all names match `.env.example`)
- [x] Leetify key valid (use header `_leetify_key`; `Authorization: Bearer` returns 401)
- [ ] *(optional)* FACEIT developer terms: docs.faceit.com is blocked for Claude; D20 accepts the risk
      (we store only derived stats). If you see a clause against storing match stats, tell Claude.
- [x] Vercel project created
- [ ] Vercel env vars (**not needed yet**, only from the first preview deploy of M1-1 / P0-4): check which Supabase vars the integration
      added, then add `FACEIT_API_KEY`, `STEAM_WEB_API_KEY`, `LEETIFY_API_KEY`, `ADMIN_STEAM_IDS=76561197993187687`,
      `SESSION_SECRET` and `CRON_SECRET` (each: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`), `APP_URL` (the Vercel URL).
      Keys shown only once can be regenerated (FACEIT App Studio, Steam dev page, Supabase API keys).
- [ ] *(optional, for demo extras M4-6)* **S4 browser test:** once the demo spike page exists, run it
      locally (`npm run dev`), drop the demo `.dem` in the browser and note parse time + memory.
- [ ] **S5 FACEIT Club:** create a free Club + private queue for the group (we play there from now on, D17);
      send Claude the **Club link** (goes into our group's seed, `groups.faceit_club_url`; optional per D21); note whether club matches
      change main FACEIT ELO; after the first mix send Claude the match room link(s)
- [ ] *(later, Phase 5)* Discord: create a Discord application + bot in the Developer Portal when we get to D-1
- [x] "Jawor" in the 2026-09-20 mix = Steam `jawOla.exe` / FACEIT `jawOla21` (confirmed)
- [x] Past mixes source: popflash club `skarpeciarze-i-pantofle` (T-2 exports it)
- [x] T-2 mapping: popflash players → SteamID64 in `lib/balance/__fixtures__/popflash/players.json` (owner named them 2026-09-25)
- [ ] Confirm WIOTKI-CHAN (`76561197973636234`) is chelmut's other account (currently merged, `confirmed: false`)

## Next Claude session: start here

1. Read `CLAUDE.md`, this file, `docs/07-roadmap.md` and `docs/08-decisions.md` (D15–D21).
2. Done: P0-1, M1-4, **S3** (FACEIT fields/units/rate limits: `docs/06` "Spike S3 findings", fixtures in
   `lib/external/__fixtures__/`), **P0-3** + **P0-5** (schema with groups live on Supabase; `lib/db/README.md`).
3. Product rules to keep in mind:
   - **Multi-group** (D18): our group (`db/seed/roster.json`) is just the first one, seeded in M1-G.
   - **FACEIT optional** (D21): the group's Club is the preferred place to play and sync from, but a mix
     can have manual results only (M2-7) and demos uploaded by hand later (M4-6); never assume FACEIT data exists.
   - Discord voice moves per group come in Phase 5 (D19).
4. Next: **M1-2** (`lib/external/steam.ts`, `faceit.ts`, Zod on the recorded fixtures; games-stats
   `from`/`to` in ms, values are strings; Leetify header `_leetify_key`), **M1-4b** (balancing
   explanation + weights, D22), then **M1-1** (Steam login, `is_site_admin` + group role guards),
   **M1-G** (groups UI, seed our group), P0-4. **T-2** (popflash export) can run any time.
5. Before M1-9: **P0-6** separate prod Supabase project (current one becomes dev).
6. Windows: the repo forces LF (`.gitattributes`); keep `core.autocrlf=false`.
