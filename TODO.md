# TODO (owner actions + session handoff)

Only what is still open. Task IDs refer to [docs/07-roadmap.md](docs/07-roadmap.md); decisions live in
[docs/08-decisions.md](docs/08-decisions.md), balancing in [docs/04](docs/04-team-balancing.md).

## Release plan

We keep building until the owner organises the first real mix. When ten people sign up, we release
the MVP (M1-9) if it is ready; P0-6 (separate Production Supabase project) happens immediately
before the first real mix.

## Owner decisions (2026-10-06)

- **M4-5 (captain draft):** deferred.
- **UX batches 1–4:** done 2026-10-06, ahead of M3-3 and M4-7.
- **Next UX run: batch 5 (group page redesign).** Its two-part group page must be **one large
  panel/tile split internally**, not two separate columns with a gap between them. Discord profile
  links are approved for this batch.
- Then queue **M3-3 (head-to-head comparison)**, followed by **M4-7 (per-group balance settings)**.
- **P0-6 (separate Production Supabase project):** do this immediately before the first real mix.

## Owner (Artur)

- [ ] **S5 FACEIT Club:** Club exists and is linked to the group (2026-09-27); still to do: the private
      queue (D17: private Club queue) and, after the first mix, send the match room link(s) to the partner working with you.
- [ ] *(optional)* FACEIT developer terms: if you see a clause against storing match stats, tell the partner working with you (D20: FACEIT data policy).
- [ ] *(optional, for M4-6)* S4 browser test of the demo parser once the spike page exists.
- [x] Discord application + bot (D-1, done 2026-10-05; credentials in `.env.local` and Vercel).
- [ ] Reset the Discord bot token (shown in a session log 2026-10-05); update `.env.local` and Vercel.
- [ ] Set `FACEIT_WEBHOOK_SECRET` in Vercel; in FACEIT App Studio add a webhook to
      `https://YOUR_HOST/api/webhooks/faceit`, header `X-Mixer-Secret`, event `match_status_finished`,
      organizer of our Club (docs/06). Then one real Club match verifies D-3 auto-return, D-4 and S6.

- [x] **M1-5 race script:** `db-race-check.mjs` passed all six cases on 2026-10-06 (run by Claude;
      Codex's sandbox could not authorize to the Management API).
- [ ] **M1-3 (group roster):** have a pre-added roster member sign in through Steam on Production to
      verify first-login claim, refreshed identity, and no duplicate; also exercise the admin roster
      controls there.
- [ ] **M1-5 (mix lobby sign-ups):** with two real browser sessions on Production, create a disposable
      mix, join from the second session, verify the live participant update and join order, then
      remove the disposable mix.

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
- 2026-09-28: migrations through `20260928120000` applied; `db-migrate.mjs --verify` passed six SQL
  test files and publishable-key checks. The active `pg_cron` job checks due votes every minute.
  `db-race-check.mjs` passed the concurrent vote-move versus due-close case. Two browser tabs on
  the local app, reading the current Supabase project, received a test vote and the locked lineup
  live; the disposable mix and players were removed afterwards.

**Still to verify live:** generating variants with ten real FACEIT players; the admin re-roll,
approval, and swap flow in a browser; and live sign-up updates in two browsers. Artur confirmed the two
M1-6 (variant generation) decisions on 2026-09-28: neutral ELO 1400 when no player has sourced ELO,
  and a mix mean calculated only from players with sourced ELO.

**2026-09-28:** M1-8 (public read-only pages) adds a group directory, guest navigation and
guest-safe empty states; logged-out mobile pages were checked at 375 px. Artur narrowed the
per-group manual fallback ELO to 600–2500; migration `20260928120000` enforces the same range as
the form and server action. Neutral all-unsourced ELO remains 1400.

**2026-09-29:** M2-5 (how to play on a locked mix) links the group's FACEIT Club directly beside
the chosen lineup, and explains when no Club is linked. The post-match instruction asks players
to send room links or scores to an admin.

**2026-09-29:** M2-1 (map result schema) and the entry/display portion of M2-7 (manual map scores)
are implemented. Migrations through `20260929110000` are applied to the approved Supabase project;
`db-migrate.mjs --verify` passed seven SQL test files and publishable-key checks. Group admins can
enter any number of map scores for a locked mix in one transaction, with optional map names; the
played page shows public scores and explicitly says when player stats are absent. M2-7 remains
partial until a real admin browser flow is checked. M3-1 player profiles now include score-only maps
in win rates while leaving rating-based stats empty. `db-race-check.mjs` passed concurrent manual
result submissions: one wins and one map is stored. No locked or played mix currently exists in the
approved database, so the real browser flow cannot yet be checked against an actual evening.

**2026-09-29:** M2-2 (FACEIT evening import) is implemented for locked mixes: Club listing or player
history, ≥8/10 coverage, six-hour window, admin confirmation, per-map results and stats in one
transaction, and idempotent re-import. M2-3 (FACEIT-based Mixer Rating) stores a rating for each
imported player/map; manual score-only maps have no rating. M3-1 (player profile) shows live FACEIT
level/ELO, mix record, rated-map trend, map stats, and best teammates. Migrations through
`20260929130000` are applied; `db-migrate.mjs --verify` passed seven SQL files and publishable-key
checks. A public profile with four test maps (two manual, two FACEIT) rendered locally; test rows
were removed. A public historical FACEIT room and stats endpoint both returned HTTP 200. The
group's Club match listing currently has no matches. **Still needed:** a real 3+ map Club evening,
admin browser import, and the manual-result admin browser flow. Local played-page browser testing
of synthetic data hit a transient Supabase "JWT issued at future" response; this needs rechecking
with a real mix.

**2026-09-29:** Artur amended D25 (Popflash archive): all 71 old maps and 710 available player
stat lines were imported as 29 clearly marked archived mixes in `/g/skarpeciarze`. Two dates had a
lineup change and were split. Results remain `manual`, with `stats_origin = popflash` on maps that
carry historical lines. The importer is `scripts/import-popflash-archive.ts` and verifies counts;
it is safe to rerun. The 16 Dec 2024 showcase is a real three-map archived mix. M2-4 (multi-map
results) now has map tabs, summary, per-map and total scoreboards, original illustrative map
sketches, and a score-only lineup. A real five-map result and accurate licensed/own map previews
remain open.

**2026-09-29 later:** The group page now has a first all-time result summary and a five-map-minimum
Mixer Rating top five. Cancelled mixes are in history; history rows show evening and map scores and,
for the signed-in participant, own K/D and Mixer Rating. Ten awards using actually stored fields
appear on played mixes, with threshold tests; M2-8 remains partial because source fields and the
larger quip pool are pending. The result screen emphasizes the selected map's score and winner.
All 27 Skarpeciarze identities were refreshed from Steam; 25 available FACEIT links were attached
without replacing the Steam display names. Repeat with `scripts/refresh-group-identities.ts`.

**2026-09-30:** A played mix with manually entered scores can now gain FACEIT player stats later.
The admin reuses the existing FACEIT import panel; the database requires the same map count and
scores in chronological order, preserving `source = manual` and marking `stats_origin = faceit`.
Mismatches roll back the whole import; archived mixes cannot be enriched. Migration
`20260930100000` is applied to the approved Supabase project. `db-migrate.mjs --verify` passed
seven SQL files and publishable-key checks; `db-race-check.mjs` passed manual-vs-FACEIT concurrent
result submission. A real admin browser enrichment still needs a played mix with matching rooms.

**2026-10-06:** M2-6 (mix form M) is done. Generation now reads same-group Mixer Ratings from
played maps, including Popflash and enriched manual results; it uses each player's 10 newest ratings
and shrinks toward the group average with `k = 5` from the first rating. Snapshot inputs preserve the
history used for the explanation and re-roll. Weight remains 0.5; no migration or UI change.

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
- **Next tasks, in order:** finish the owner checks above and the remaining M1-6 (variant generation)
  real-player/admin browser checks; M1-7 (voting under D33: public votes and closing rules) and M1-8
  (public read-only pages) are implemented. Then continue with the 2026-10-06 queue above. P0-6
  (separate Production Supabase project) happens immediately before the first real mix. The CS 1.6
  backdrop uses a stable fixed layer and a cookie-backed preference.

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
