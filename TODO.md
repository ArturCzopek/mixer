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
- [ ] **Vercel env vars (M1-1 login code is on `main`; we go through this step by step together)**: check which Supabase vars the integration
      added (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY` are used), then add `STEAM_WEB_API_KEY`,
      `ADMIN_STEAM_IDS=76561197993187687`, `SESSION_SECRET` and `CRON_SECRET` (each: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`),
      `FACEIT_API_KEY`, `LEETIFY_API_KEY`; `APP_URL` **only for Production** (previews use their own URL).
      Then open a preview deploy, "Sign In Through Steam", and tell Claude whether you land back logged in as site admin.
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
- [x] WIOTKI-CHAN (`76561197973636234`) = chelmut's other account (owner confirmed 2026-09-25); Profesor never played on popflash; former players are backtest-only (FACEIT nicknames resolved), not added to the roster

## Next Claude session: start here (handover 2026-09-25, cloud → local)

**Read first:** `CLAUDE.md`, this file, `docs/07-roadmap.md`, `docs/08-decisions.md` (D15–D30),
`docs/04-team-balancing.md`, `backtest/README.md`, `DESIGN.md`. Owner talks Polish; code/docs English;
push straight to `main`; run test, lint, typecheck, format:check and build before every push.

### State
- **Done:** P0-1, P0-3, P0-5, S3, M1-2, M1-4, **M1-4b**, UI-0, **T-1**, **T-2**.
- **In progress: M1-1** (Steam login). Code is on `main` (`lib/auth/`, routes `/auth/steam`,
  `/auth/steam/callback`, `POST /auth/logout`, home page sign-in row, 20 unit tests). Never run
  against a real Steam + Supabase yet. Owner wants to go through the Vercel env step by step with you
  (checklist above). Locally: fill `.env.local`, `npm run dev`, open http://localhost:3000 →
  "Sign In Through Steam" (leave `APP_URL` empty or `http://localhost:3000`), check the `players` row
  (display name, avatar, `is_site_admin` for the owner) and that `/` shows "site admin".
- **Design preview** `/design/mix?state=lobby|voting|locked|played` runs on the real engine
  (`lib/mock/mix.ts`): join order, variant labels, explanation panel with window dates,
  Leetify card (FACEIT matches of the 30 days before the mix, invented numbers), 5 maps.

### Balancing (what changed today, all in docs/04 + D24/D26/D30)
- `S = E + F + 0.5·M + 0.5·A`, contributions rounded, S = their sum.
- F asymmetry by **absolute ELO** anchors (≤1000: ×1.5 up / ×0.3 down … ≥2000: ×0.1 / ×0.6).
- A: sessions in 30 days → 0: −60, 1: −40, 2: −20, 3: 0, 6+: +15; weight 0.5 (D30).
- **Every "last 30 days" is the 30 days before the mix** (D30); engine returns `windowFrom/windowTo`.

### Backtest (`npm run backtest` → `backtest/REPORT.md`)
- Data: 71 popflash maps (2024), FACEIT stats of 26 players, and FACEIT **results up to today** in
  `lib/balance/__fixtures__/backtest/faceit-results/` (for rebuilding ELO at each map,
  `backtest/elo-history.ts`, ±25 per EU-queue match walked back from today's ELO).
- Findings in `backtest/README.md`. Rebuilding 2024 ELO from results (±25) was **tried and is
  worse than today's ELO** (log-loss 0.694 vs 0.634), so the backtest keeps today's ELO for now.
- **Done 2026-09-25 (local):** real FACEIT ELO per map from the site API (browser, `backtest/.local/`, not in git). Today's ELO predicts the 2024 mixes better than the real 2024 ELO (log-loss 0.634 vs 0.695): keep ELO today. Details in `backtest/README.md`.

### Next tasks, in order
1. **M1-1** finish with the owner (env vars, local login, preview deploy test), tick it.
2. **M1-G** groups UI + seed our group from `db/seed/roster.json` (uses `requireGroupRole`).
3. **P0-4** deploy pipeline + keep-alive cron.
4. Then M1-3 roster, M1-5 lobby (realtime, join order), M1-6 variants (+ labels, explanation panel,
   Leetify card anchored at the mix), M1-7 voting.

### Tools
- Live FACEIT / popflash from the cloud: workflows **API spike** and **Backtest data**
  (`probe` / `popflash` / `faceit` / `results` / `probe-elo`). Locally just run
  `node --env-file=.env.local scripts/backtest-data.mjs <step>`.
- Before M1-9: **P0-6** separate prod Supabase project (current one becomes dev).
- Windows: the repo forces LF (`.gitattributes`); keep `core.autocrlf=false`.
