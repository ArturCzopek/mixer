# TODO (owner actions + session handoff)

Only what is still open. Task IDs refer to [docs/07-roadmap.md](docs/07-roadmap.md); decisions live in
[docs/08-decisions.md](docs/08-decisions.md), balancing in [docs/04](docs/04-team-balancing.md).

## Release plan

We keep building until the owner organises the first real mix. When ten people sign up, we release
the MVP (M1-9) if it is ready; P0-6 (separate prod Supabase) comes right before that.

## Owner (Artur)

- [ ] **Vercel Production env:** add `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY` (values
      from `.env.local`, tick Production), then Redeploy. The home page lists anything still missing.
      Then "Sign In Through Steam" on Production and tell Claude if you land back as site admin (closes M1-1).
- [ ] **S5 FACEIT Club:** create a free Club + private queue for the group (D17); send Claude the Club
      link; after the first mix, the match room link(s).
- [ ] *(optional)* FACEIT developer terms: if you see a clause against storing match stats, tell Claude (D20).
- [ ] *(optional, for M4-6)* S4 browser test of the demo parser once the spike page exists.
- [ ] *(later, Phase 5)* Discord application + bot for D-1.

## Next Claude session: start here

**Read first:** `CLAUDE.md`, this file, `docs/07-roadmap.md`, `docs/08-decisions.md`,
`docs/04-team-balancing.md`, `DESIGN.md`. Owner talks Polish; code/docs English; UI strings go
through `lib/i18n` (English default, Polish toggle); push straight to `main` after test, lint,
typecheck, format:check and build. Pushes to `main` deploy to Vercel **Production**.

- **State:** see the ticked rows in the roadmap. M1-1 works locally (owner logged in, `players` row
  with `is_site_admin`); waiting for the Production env vars above.
- **Showcase** `/demo`: the real popflash evening of 16.12.2024 on the real engine, all four states,
  live Leetify card, public votes with a seeded tie-break, admin panel (buttons do nothing yet).
- **Next tasks, in order:** close M1-1 → **M1-G** groups UI + seed our group from
  `db/seed/roster.json` → **P0-4** deploy pipeline + keep-alive cron → M1-3 roster → M1-5 lobby →
  M1-6 variants → M1-7 voting (close rules in D33).

## Where the keys are

- Local: `.env.local` (copy of `.env.example`). Migrations:
  `node --env-file=.env.local scripts/db-migrate.mjs --verify`; FACEIT fixtures:
  `node --env-file=.env.local scripts/faceit-spike.mjs`.
- GitHub Actions secrets hold the same keys; the `DB migrate` workflow applies migrations on pushes to
  `main` touching `db/`. Cloud sessions have no keys and cannot reach `open.faceit.com`: they use the
  **API spike** / **Backtest data** workflows.
- Real FACEIT ELO per match (FACEIT's site API) only works from a browser; such data stays in
  `backtest/.local/`, never in git (`npm run backtest:real-elo`).
- Windows: the repo forces LF (`.gitattributes`); keep `core.autocrlf=false`.
