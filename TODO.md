# TODO (owner actions + session handoff)

Only what is still open. Task IDs refer to [docs/07-roadmap.md](docs/07-roadmap.md); decisions live in
[docs/08-decisions.md](docs/08-decisions.md), balancing in [docs/04](docs/04-team-balancing.md).

## Release plan

We keep building until the owner organises the first real mix. When ten people sign up, we release
the MVP (M1-9) if it is ready; P0-6 (separate prod Supabase) comes right before that.

## Owner (Artur)

- [ ] **S5 FACEIT Club:** Club exists and is linked to the group (2026-09-27); still to do: the private
      queue (D17: private Club queue) and, after the first mix, send the match room link(s) to the partner working with you.
- [ ] *(optional)* FACEIT developer terms: if you see a clause against storing match stats, tell the partner working with you (D20: FACEIT data policy).
- [ ] *(optional, for M4-6)* S4 browser test of the demo parser once the spike page exists.
- [ ] *(later, Phase 5)* Discord application + bot for D-1.

## Next session (Codex or Claude): start here

**Read first:** `CLAUDE.md`, this file, `docs/07-roadmap.md`, `docs/08-decisions.md`,
`docs/04-team-balancing.md`, `DESIGN.md`. Owner talks Polish; code/docs English; UI strings go
through `lib/i18n` (English default, Polish toggle); push straight to `main` after test, lint,
typecheck, format:check and build. Pushes to `main` deploy to Vercel **Production**.

### Audit follow-up (Codex audit 2026-09-26, reviewed by Claude)

Done 2026-09-26: **A1** Steam login state cookie (`mixer_login_state`, checked and cleared by the
callback; login now has to start on the host that finishes it, so a Production deployment-hash URL
with `APP_URL` set ends in `?login=failed`); **A6–A8** stale docs fixed, audit docs folded into
docs/01, 02, 04, 06 and the `lib/*/README.md` files and deleted, AGENTS.md roles (Artur decides
product). 2026-09-27: **A2** is decision D36.

**Artur's decisions (2026-09-26):**

- **Q1:** unpublished variants hidden from browsers (RLS on `is_published`, `variant_players` via its
  variant); `players.last_login_at`, `is_site_admin` and `groups.discord_settings` not selectable by
  anon (column grants); everything else stays public (D2).
- **Q2:** retry FACEIT once on 429/5xx (honour `Retry-After`). A player with no FACEIT ELO gets E =
  the mean E of the other players in that mix, shown as its own source in "How was this calculated?".
  Order: FACEIT ELO → group manual ELO (D18) → mix mean, so generation never blocks. A failed *form*
  fetch gives F = 0 with "form unavailable". Recorded in D40 and docs/04. If the whole roster has no
  sourced ELO, the generation fallback is neutral 1400 (Artur, 2026-09-28), shown as its own source. No formula/default
  changes.
- **Q5 (migration target)** is settled for now: Artur approved the current Supabase project as the target until P0-6 (separate Production Supabase).

**Verified on the current Supabase project:**

- All migrations through `20260927150000` are applied. `db-migrate.mjs --verify` passed: five SQL
  test files and publishable-key checks.
- `db-race-check.mjs` passed: join cap, closing sign-ups waiting for the tenth join, and concurrent
  approval versus re-roll.
- Production returned HTTP 200 for `/`, `/demo`, `/g/skarpeciarze`, and
  `/g/skarpeciarze/m/<mix>`. The new homepage (open sign-ups, my active mixes, my groups) and
  Leetify rating colors are on Production.
- 2026-09-28: migrations through `20260928110000` applied; `db-migrate.mjs --verify` passed six SQL
  test files and publishable-key checks. The active `pg_cron` job checks due votes every minute.
  `db-race-check.mjs` passed the concurrent vote-move versus due-close case. Two browser tabs on
  the local app, reading the current Supabase project, received a test vote and the locked lineup
  live; the disposable mix and players were removed afterwards.

**Still to verify live:** generating variants with ten real FACEIT players; the admin re-roll,
approval, and swap flow in a browser; and live sign-up updates in two browsers. Artur confirmed the two
M1-6 (variant generation) decisions on 2026-09-28: neutral ELO 1400 when no player has sourced ELO,
and a mix mean calculated only from players with sourced ELO.

**A5 done 2026-09-27:** `faceitForm()` skips invalid `finishedAt` values instead of counting them
in the baseline; regression tests cover unchanged valid inputs and the thin-baseline threshold.

**P0-4 verification 2026-09-27:** local keepalive tests cover bearer authentication, a DB read on
every invocation, empty tables, DB failures and the daily schedule. Production-build local smoke
test against the configured real DB returned 401 without a token and 200 with a temporary local
token; both responses had `Cache-Control: no-store`. All 230 tests, lint, typecheck, format check
and production build passed. Live Vercel cron and PR preview verification remain open: GitHub CLI
is signed out and the available Vercel browser session opens the login page. Code remains ready
for deployment; no Vercel success has been claimed.

Not planned: the 200-record FACEIT cap (F = 0 only after >190 matches in 30 days; the explanation
already shows a thin baseline) and logout CSRF (harmless).

- **State:** see the ticked rows in the roadmap. Production is `https://mixer-gray.vercel.app`; Steam
  login works there (M1-1). Deployment-hash URLs keep the env of their own build.
- **Showcase** `/demo`: the real popflash evening of 16.12.2024 on the real engine, all four states,
  live Leetify card, public votes with a seeded tie-break, admin panel (buttons do nothing yet).
- **Groups (M1-G, 2026-09-27):** our group is `/g/skarpeciarze` (FACEIT Club linked, 12 roster players
  seeded with `scripts/seed-group.mjs`; names fill in on first login or with M1-3). One menu bar in
  the root layout on every page (mixer › group menu, backdrop, language, account).
- **Next tasks, in order:** finish the remaining M1-5 (mix sign-ups) and M1-6 (variant generation)
  live checks above, then M1-8 (public read-only pages). M1-7 (voting under D33: public votes and
  closing rules) is implemented and verified; the CS 1.6 backdrop now uses a stable fixed layer and
  a cookie-backed preference.

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
