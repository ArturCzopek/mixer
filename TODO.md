# TODO (owner actions + session handoff)

Only what is still open. Task IDs refer to [docs/07-roadmap.md](docs/07-roadmap.md); decisions live in
[docs/08-decisions.md](docs/08-decisions.md), balancing in [docs/04](docs/04-team-balancing.md).

## Release plan

We keep building until the owner organises the first real mix. When ten people sign up, we release
the MVP (M1-9) if it is ready; P0-6 (separate prod Supabase) comes right before that.

## Owner (Artur)

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

### Audit follow-up (Codex audit 2026-09-26, reviewed by Claude)

Done 2026-09-26: **A1** Steam login state cookie (`mixer_login_state`, checked and cleared by the
callback; login now has to start on the host that finishes it, so a Production deployment-hash URL
with `APP_URL` set ends in `?login=failed`); **A6–A8** stale docs fixed, audit docs folded into
docs/01, 02, 04, 06 and the `lib/*/README.md` files and deleted, AGENTS.md roles (Artur decides
product).

**Artur's decisions (2026-09-26):**

- **Q1:** unpublished variants hidden from browsers (RLS on `is_published`, `variant_players` via its
  variant); `players.last_login_at`, `is_site_admin` and `groups.discord_settings` not selectable by
  anon (column grants); everything else stays public (D2).
- **Q2:** retry FACEIT once on 429/5xx (honour `Retry-After`). A player with no FACEIT ELO gets E =
  the mean E of the other players in that mix, shown as its own source in "How was this calculated?".
  Order: FACEIT ELO → group manual ELO (D18) → mix mean, so generation never blocks. A failed *form*
  fetch gives F = 0 with "form unavailable". Record as a new decision + docs/04 E row when A4 lands.
  No change to formulas or other defaults.
- **Q5** open until P0-6: which Supabase project the `DB migrate` workflow targets.

**Open, in order** (C = Claude decides/reviews, X = bounded Codex task):

1. **C A2 Write-path rule, with M1-G:** every server action starts with `requireSession` /
   `requireGroupRole`, checks state in the same transaction as the write, and has a route-level test
   for 401/403. Record as a decision; Codex can write the tests.
2. **X A3 RLS migration** (Q1) + `db/tests` assertions + the publishable-key check in
   `scripts/db-migrate.mjs`. **Before M1-6.**
3. **X A4 FACEIT resilience + ELO fallback** (Q2) in `lib/external/http.ts` / `faceit.ts` and the
   generation caller, fixture tests. **Before M1-6.**
4. **X A5 Skip samples with an invalid `finishedAt`** in `faceitForm()` + regression test (valid
   inputs unchanged). Any time.

Not planned: the 200-record FACEIT cap (F = 0 only after >190 matches in 30 days; the explanation
already shows a thin baseline) and logout CSRF (harmless).

- **State:** see the ticked rows in the roadmap. Production is `https://mixer-gray.vercel.app`; Steam
  login works there (M1-1). Deployment-hash URLs keep the env of their own build.
- **Showcase** `/demo`: the real popflash evening of 16.12.2024 on the real engine, all four states,
  live Leetify card, public votes with a seeded tie-break, admin panel (buttons do nothing yet).
- **Next tasks, in order:** **M1-G** groups UI (with A2) + seed our group from
  `db/seed/roster.json` → **P0-4** deploy pipeline + keep-alive cron → M1-3 roster → M1-5 lobby →
  A3, A4 → M1-6 variants → M1-7 voting (close rules in D33).

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
