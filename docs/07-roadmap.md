# Roadmap

How to use this plan:
- Work **top to bottom**. Each task has an ID, dependencies, and a **Done when** check.
- One task ≈ one PR / one session. Tick the box and note the PR when finished.
- 👤 = needs the owner (accounts, keys, files, decisions). Everything else Claude can do alone.
- Tasks marked *(parallel)* do not block the main line and can be picked up anytime after their deps.

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done

---

## Phase 0: setup & spikes

| ID | Task | Deps | Done when |
|---|---|---|---|
| [x] **P0-1** | Scaffold: Next.js (App Router, TS, strict), Tailwind, shadcn/ui, ESLint/Prettier, Vitest, `lib/` + `app/` layout from [architecture](02-architecture.md#repository-layout-planned), `.env.example` | – | `npm run build`, `npm test` and `npm run lint` pass; README has "run locally" steps |
| [~] **P0-2** 👤 | Accounts & keys: Supabase project, Vercel project linked to GitHub repo, Steam Web API key, FACEIT API key, Leetify API key | – | Keys set in Vercel env + cloud environment env; `.env.example` lists them all |
| [x] **P0-3** | DB schema + migrations for Phase 1 tables (`players`, `mixes`, `mix_participants`, `variants`, `variant_players`, `votes`) + RLS select policies | P0-1, P0-2 | Migrations apply cleanly to Supabase; anon key can `select`, cannot write |
| [x] **P0-5** | Groups in the schema (D18): `groups`, `group_members` (admin/member, closed not deleted), mixes per group, only active members join, FACEIT Club link + Discord server on the group | P0-3 | Migration applied by `DB migrate`; checks in `db/tests/phase1.sql` pass |
| [ ] **P0-4** | Deploy pipeline + keep-alive cron (`/api/cron/keepalive`, `CRON_SECRET`) | P0-1, P0-2 | Preview deploy per PR; cron visible in Vercel; endpoint returns 200 and hits DB |
| [x] **S3** | FACEIT API spike: script calling the endpoints from [external APIs](06-external-apis.md#faceit-data-api-v4-balancing-source) for 2–3 members | P0-2 | Notes added to `docs/06` with exact fields for ELO, 30-day matches, per-match K/D (+ADR?), rate limits; recorded JSON fixtures saved in `lib/external/__fixtures__/` |
| [ ] **S5** 👤 | FACEIT Club spike: owner creates a free private Club + queue, checks team-formation options (can we set our lineup?), plays one mix; Claude reads the match via Data API (`/matches/{id}`, `/matches/{id}/stats`, club/hub matches list) | S3 | Answers for the open rows in [docs/05 Path C](05-demo-pipeline.md#path-c-faceit-club-queue-chosen-d17); D17 Accepted or Rejected |
| [ ] **S4** *(optional, for M4-6; native parse done, see docs/05 "First parse test")* | demoparser2 WASM spike: minimal page parsing a FACEIT demo in a Web Worker | P0-1, 👤 demo file | Time + peak memory for a ~150 MB demo written in `docs/05`; D7 in decisions marked Accepted or switched to Python fallback |
| [ ] **S1** *(optional, only for demo extras M4-6)* | POV vs GOTV accuracy: parse both demos of the same FACEIT match, compare per stat | S4, 👤 POV + GOTV demo | Table in `docs/05` listing which stats are exact / approximate / missing in POV |

## Phase 1: MVP (roster → mix → balance → vote)

| ID | Task | Deps | Done when |
|---|---|---|---|
| [x] **UI-0** | Visual world: 2003 Steam / CS 1.6 **olive VGUI** (owner pick from 3 mocks in `.impeccable/mocks/`); tokens in `app/globals.css`, primitives `components/vgui/`, mix page in all 4 states at `/design/mix` (mock data, no logic); `PRODUCT.md`, `DESIGN.md` | – | Mix page preview renders at 375 px and desktop; text contrast ≥ 4.5:1 |
| [ ] **M1-1** | Steam OpenID login + session cookie (`jose`), logout, `ADMIN_STEAM_IDS` bootstrap of `is_site_admin`, `getSession()` helper, guards `requireSiteAdmin()` / `requireGroupRole(groupId, 'admin'\|'member')` | P0-5 | Log in with Steam on a preview deploy; site admin flag correct; group role read from DB per request; forged OpenID assertion rejected (unit test on verifier) |
| [x] **M1-2** | External clients: `lib/external/steam.ts` (summaries, vanity, input parsing), `faceit.ts` (player by SteamID, ELO, match stats with ms paging, form samples, lifetime) with caching (Next data cache: Steam 1 h, FACEIT 10 min) | S3 | Unit tests against fixtures; typed with Zod |
| [ ] **M1-G** | Groups UI (generic: any group; ours is only seeded): any logged-in player creates a group (name, slug, optional **FACEIT Club link**), becomes its admin; group page; admins promote/demote admins, close memberships; group switcher in the nav; seed our group from `db/seed/roster.json` | M1-1 | Group created from the UI with a FACEIT link; a non-admin cannot manage it (server check); our 12 players seeded |
| [ ] **M1-3** | Roster (per group): group admin adds player by SteamID64 / profile URL / vanity; auto-fill Steam name+avatar and FACEIT link; manual ELO override; deactivate player; first login claims record | M1-G, M1-2 | Adding by each input form works; a pre-added player logging in sees their own record, no duplicate |
| [x] **M1-4** | Balancing engine `lib/balance` (pure TS): skill score E+F(+M=0), win prob, 126-split enumeration, hard/soft pair rules, cost, diverse top-3 selection, re-roll exclusion, config defaults | – *(can start right after P0-1)* | Unit tests cover: 40 candidates with both hard rules, distance function, tie handling, determinism, shrinkage examples from [docs/04](04-team-balancing.md) |
| [ ] **M1-4b** | Balancing explanation (D22): engine returns *why* for every number: per player E (source: FACEIT / manual override), F internals (matches in window, window vs baseline rating, ratio, shrunk ratio, clamped?), M internals (maps, shrinkage); per variant cost split into imbalance pp + each rule's penalty; per-factor weights `weights.{elo,faceitForm,mixForm}` (defaults 1 / 1 / 0.5) in `BalanceConfig`; **form asymmetry by lobby strength** (`form.asymmetry`, D24) | M1-4 | Unit tests assert the explanation adds up to S and to the cost; weights change S as documented in docs/04 |
| [ ] **M1-5** | Mix lobby (per group): **group admin** (or site admin) creates a mix, join/leave, admin add/remove, hard cap 10 (DB-enforced), status machine `open→balancing→voting→locked→played/cancelled`, realtime participant list | M1-3 | Two browsers see joins live; 11th join is rejected even under race (DB constraint/transaction) |
| [ ] **M1-6** | Variant generation: server action fetches FACEIT data, computes S, stores `skill_snapshot`, creates 3 variants; admin preview, re-roll, publish; per-variant UI (lineups, S breakdown, win %, badges) + **"How was this calculated?" panel** visible to everyone (E / F / M per player with the M1-4b details, cost breakdown, config used) | M1-4b, M1-5 | Generating for 10 real players shows 3 distinct variants; snapshot stored; re-roll never repeats a shown split |
| [ ] **M1-7** | Voting: participants only, change vote until close, live counts, admin proxy vote (`cast_by`), auto-lock at 10/10, admin close, tie-break rule, locked lineup card | M1-6 | Realtime counts in two browsers; non-participant vote rejected; tie-break unit-tested; lock sets `chosen_variant_id` |
| [ ] **M1-8** | Public read-only pages: mixes list, mix page (any state), roster; nav, empty states, mobile layout | M1-7 | Logged-out user can view everything, sees no action buttons; works at 375 px width |
| [ ] **P0-6** | Separate **prod** Supabase project (the current one stays as dev): create it, run migrations, point Vercel Production env at it and Preview/local at dev; `DB migrate` workflow migrates both (dev on push, prod on push to main after dev succeeds) | P0-4 | Prod project has all migrations; a preview deploy never touches prod data |
| [ ] **M1-9** 👤 | **Release MVP**: production deploy, owner adds roster, dry-run mix with the group | M1-8, P0-6 | One real mix balanced + voted in the app |
| [ ] **T-1** *(parallel)* | Balancing backtest: fixtures from real mixes (FACEIT profiles, real lineups, results) → report where real split ranks. Data source: our old **popflash** club (`popflash.site/-/skarpeciarze-i-pantofle/matches`, 71 maps Oct–Dec 2024, per map lineups + K/A/D/ADR/KAST/FK/FD, see T-2). Assumption (owner, 2026-09-25): everyone's ELO then = FACEIT ELO now | M1-4, T-2 | Fixtures in `lib/balance/__fixtures__/` run as tests; short findings note in `docs/04` |
| [ ] **T-2** *(parallel)* | Popflash history export: one-off local script (polite, ~80 pages) → `lib/balance/__fixtures__/popflash/*.json` (map, score, date, both lineups with per-player stats); player → SteamID64 mapping already in `popflash/players.json` (27 players, from profile pages; second accounts via `mergeInto`) | – | JSON for all 71 matches; players resolved through `players.json`. **Tests only (D25):** never imported into any database; players may be added to the group, match history may not |

## Phase 2: results & stats (FACEIT-first, see D17)

Mixes are played on a private **FACEIT Club queue**. Stats come from the FACEIT Data API per map;
demos are an optional extra (any group member can upload one, parsed in the browser).

| ID | Task | Deps | Done when |
|---|---|---|---|
| [ ] **M2-1** | Schema: `matches` (one per map, `source` faceit/manual/demo, `faceit_match_id` null), `match_player_stats` (optional per match), `match_payloads` (raw FACEIT/demo JSON) | M1-9 | Migrations applied; a match with only a score is valid |
| [ ] **M2-7** | **Manual results** (no FACEIT, D21): group admin enters maps + scores for a locked mix (map optional), mix → `played`; player stats stay empty or come later (FACEIT import / demo upload M4-6) | M2-1 | A mix played without FACEIT gets a result; profiles and win rates count it, rating-based stats skip it |
| [ ] **M2-2** | FACEIT match import (groups with a FACEIT Club; club matches listed via `groups.faceit_club_id` or pasted room link): admin pastes the FACEIT room link(s) of a locked mix → fetch `/matches/{id}` + `/matches/{id}/stats` → per-player per-map stats; map players to roster; warn if FACEIT teams differ from the voted lineup; mix → `played` | M2-1, S3 | Importing the room of a real mix stores all maps; re-import is idempotent; lineup mismatch shown |
| [ ] **M2-3** | Mixer Rating from FACEIT stats (`lib/balance/faceit-rating.ts` shape, KAST fixed until demo extras exist); maps without player stats get no rating | M2-2 | Unit tests; rating stored per player per map |
| [ ] **M2-4** | Match page: scoreboard (popflash-style) per map, mix summary (maps won, per-player totals) | M2-3 | Renders for a real mix; mobile OK |
| [ ] **M2-5** | Mix page "how to play": the group's FACEIT Club link (`groups.faceit_club_url`) + the voted lineup; captains pick exactly that lineup | M1-7 | Shown on locked mixes |
| [ ] **M2-6** | Mix form term **M** in balancing (last 10 mix maps, shrinkage to group avg) | M2-3 | Engine tests updated; snapshot includes M |

## Phase 3: profiles & comparisons

| ID | Task | Deps | Done when |
|---|---|---|---|
| [ ] **M3-1** | Player profile: header (FACEIT level/ELO live), mix aggregates, Mixer Rating trend chart, per-map stats, best teammates | M2-5 | Profile renders for a player with ≥ 1 mix and with 0 mixes |
| [ ] **M3-2** | Leetify client + FACEIT / Premier tabs (live, never stored, metrics shown as-is, "Data Provided by Leetify" logo) | M3-1, P0-2 | Filter Mix / FACEIT / Premier works; no Leetify data in DB (checked in review) |
| [ ] **M3-3** | Head-to-head compare page | M3-1 | Two players side by side for a chosen source |
| [ ] **M3-4** | Leaderboards with minimum-maps threshold | M3-1 | Sortable by rating, ADR, K/D, win rate, clutches |

## Phase 4: optional

| ID | Task | Deps |
|---|---|---|
| [ ] **M4-1** | Mixer Rating 3 (swing table + eco adjustment), recompute from `match_payloads` | M4-6 |
| [ ] **M4-3** | Balancing calibration report (predicted vs actual) | M2-3 + ~5 mixes |
| [ ] **M4-4** | Path B: DatHost + MatchZy integration (only if FACEIT stops working for us) | M2-2 |
| [ ] **M4-5** | **Captain draft** as an alternative to balanced variants: admin picks 2 captains → quick rock-paper-scissors mini-game (realtime) decides first pick → captains draft players in the app (1-2-2-2-2-1) → lineup locked **for the whole evening** (all maps of the mix) | M1-7 |
| [ ] **M4-7** | Per-group balancing settings: `groups.balance_config` overrides the site defaults (weights of E / F / M, form window, duo rules); group admin edits them with a live preview on a past mix; each mix still stores the config it used | M1-6 |
| [ ] **M4-6** | Demo extras: any group member uploads the FACEIT demo manually → `lib/demo` (pure TS, browser Web Worker) computes KAST, openings, trades, clutches, utility, flashes; full Mixer Rating 2 replaces the KAST-fixed one for that map. Pitfalls in docs/05 "First parse test" | M2-3, S4 |

## Phase 5: Discord (per group, D19)

A group links its Discord server; a bot (one app for the whole site) moves players between voice
channels. Moving uses Discord's REST API only (`PATCH /guilds/{guild}/members/{user}` with `channel_id`,
bot permission **Move Members**), so it works from serverless functions without a gateway connection.
A player must already be connected to a voice channel of that server to be moved.

| ID | Task | Deps | Done when |
|---|---|---|---|
| [ ] **S6** | Spike: FACEIT webhooks for our Club (App Studio subscription for club/hub matches: `match_status_ready` / `match_status_finished`?), latency; Discord bot move from a Vercel function | S5, P0-4 | Notes in `docs/06`: which events we get for club matches; one test move works |
| [ ] **D-1** 👤 | Discord app + bot (site-wide `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID/SECRET`); group admin connects the server (bot invite link with Move Members + Send Messages), picks lobby / team A / team B voice channels and a text channel → `groups.discord_guild_id`, `discord_settings` | M1-G | Our server linked, channels saved |
| [ ] **D-2** | Players link Discord (OAuth2 `identify`) → `players.discord_user_id`; group roster shows who is linked | D-1 | Link / unlink works; unlinked players listed on the mix page |
| [ ] **D-3** | **Voice moves:** match start → team A / team B players moved to their channels; match end → everyone back to the lobby. Triggers: admin buttons on the locked mix (always) + automatic from FACEIT webhooks when S6 confirms club events | D-2, M1-7 | Real mix: both moves work; players not in voice are reported, not errors |
| [ ] **D-4** | Discord notifications in the group's text channel (mix created, lineup locked, results) | D-1, M1-7 | Messages posted for a real mix |

## Critical path

```
P0-1 → P0-3 → P0-5 → M1-1 → M1-G → M1-3 → M1-5 → M1-6 → M1-7 → M1-8 → M1-9 (MVP)
P0-1 → M1-4 → M1-4b ─────────────────┘
P0-4 → P0-6 (prod Supabase) → M1-9
P0-2 → S3 → M1-2 → M1-3
M1-9 → M2-1 → M2-7 (manual results) → M2-2 → M2-3 → M2-4 (stats from FACEIT)
```

**Unblocked right now (no owner input needed):** M1-4b, T-2, M1-1 (Steam login; preview deploy needs the Vercel env vars), P0-4.
**Where keys live:** GitHub Actions secrets (used by the `API spike` / `DB migrate` workflows) and Vercel. The cloud sandbox has none and cannot reach `open.faceit.com` (Cloudflare challenge), so live FACEIT calls always go through a workflow or a deploy.
**Owner inputs that unblock the rest:** FACEIT Club + one mix (S5), confirming the popflash → Steam mapping (T-2).

## Resolved questions (2026-09-24)

| Question | Answer |
|---|---|
| Admins | Per group: creator + people they promote; site admin = owner. Group admins create mixes (not only the site admin) |
| Site visibility | Public, read-only for guests |
| Voting end | All 10 voted or admin closes; no time limit |
| More than 10 players | Hard cap 10, no waitlist; admin can remove people |
| Demo source | ~~POV recording~~ → FACEIT: stats from the API, demos uploaded manually by any group member as an optional extra (D17, D23) |
| Leetify | Read-only display, never stored; balancing on FACEIT |
| Discord | Yes, the group has a Discord server; bot per group with voice moves at match start/end (Phase 5, D19) |
| Several groups | Yes (2026-09-24): groups with their own admins, members, mixes, FACEIT Club link and Discord (D18) |
| Jawor | = Steam `jawOla.exe` / FACEIT `jawOla21` (owner confirmed) |
| Team picking | Balanced variants + vote now; captain draft with a rock-paper-scissors mini-game later (M4-5) |
| Balancing transparency | Every variant shows how it was calculated (M1-4b, M1-6); per-group weights later (M4-7, D22) |
| Old mixes | popflash club history → backtest fixtures (T-2, T-1) |
| Initial roster | 12 SteamID64s in `db/seed/roster.json` (2026-09-24) |

## Open questions

1. ~~Is there a group Discord worth posting to?~~ Yes (Phase 5).
3. Private groups (hidden from guests)? Not now: browsers read with the publishable key and public RLS; private groups would need Supabase-signed JWTs per player or server-proxied realtime.
2. ~~Valve PM or FACEIT?~~ FACEIT Club queue (D17, 2026-09-24). The FACEIT room in the 2026-09-20 fixture was a random public match used only as a test demo.
