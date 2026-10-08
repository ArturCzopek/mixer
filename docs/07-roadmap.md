# Roadmap

How to use this plan:
- Work **top to bottom**. Each task has an ID, dependencies, and a **Done when** check.
- One task ≈ one PR / one session. Tick the box and note the PR when finished.
- 👤 = needs the owner (accounts, keys, files, decisions). Codex or Claude can handle the other tasks.
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
| [x] **P0-4** | Deploy pipeline + keep-alive cron (/api/cron/keepalive, CRON_SECRET) | P0-1, P0-2 | Cron visible in Vercel; endpoint returns 200 and hits DB. **Done 2026-10-06:** Artur ran the Production cron manually and confirmed HTTP 200 in function logs. Preview deploy per PR was obsolete because the team pushes straight to main.
| [x] **S3** | FACEIT API spike: script calling the endpoints from [external APIs](06-external-apis.md#faceit-data-api-v4-balancing-source) for 2–3 members | P0-2 | Notes added to `docs/06` with exact fields for ELO, 30-day matches, per-match K/D (+ADR?), rate limits; recorded JSON fixtures saved in `lib/external/__fixtures__/` |
| [ ] **S5** 👤 | FACEIT Club spike: owner creates a free private Club + queue, checks team-formation options (can we set our lineup?), plays one mix; Claude reads the match via Data API (`/matches/{id}`, `/matches/{id}/stats`, club/hub matches list) | S3 | Answers for the open rows in [docs/05 Path C](05-demo-pipeline.md#path-c-faceit-club-queue-chosen-d17); D17 Accepted or Rejected |
| [ ] **S4** *(optional, for M4-6; native parse done, see docs/05 "First parse test")* | demoparser2 WASM spike: minimal page parsing a FACEIT demo in a Web Worker | P0-1, 👤 demo file | Time + peak memory for a ~150 MB demo written in `docs/05`; D7 in decisions marked Accepted or switched to Python fallback |
| [ ] **S1** *(optional, only for demo extras M4-6)* | POV vs GOTV accuracy: parse both demos of the same FACEIT match, compare per stat | S4, 👤 POV + GOTV demo | Table in `docs/05` listing which stats are exact / approximate / missing in POV |

## Phase 1: MVP (roster → mix → balance → vote)

| ID | Task | Deps | Done when |
|---|---|---|---|
| [x] **UI-0** | Visual world: 2003 Steam / CS 1.6 **olive VGUI** (owner pick from 3 mocks in `.impeccable/mocks/`); tokens in `app/globals.css`, primitives `components/vgui/`, mix page in all 4 states at `/design/mix` (mock data, no logic); `PRODUCT.md`, `DESIGN.md` | – | Mix page preview renders at 375 px and desktop; text contrast ≥ 4.5:1 |
| [x] **UI-1** | Mix page data-driven (`lib/mix/view.ts`, one `MixView` for preview and showcase), desktop layout, fixed-height explanation / Leetify / labels, optional CS 1.6 backdrop, **showcase `/demo`** of the real evening 16.12.2024 (D31) | UI-0 | `/demo` shows lobby, voting, lineup and result from real data; page height does not change when switching players or variants |
| [x] **UI-2** | Owner feedback round: public vote lists, move-vote button, voting outcome with seeded tie-break and admin panel (D33), pair spread in the engine (D33), live Leetify client + card (`lib/external/leetify.ts`), Polish UI toggle (`lib/i18n`, D34), backdrop remembered on every page, `/design/mix` removed (D35) | UI-1 | `/demo` in EN and PL; tie shows "drawn at random"; no Leetify data stored in the database (D41 allows a five-minute server cache) |
| [x] **M1-1** | Steam OpenID login + session cookie (`jose`), logout, `ADMIN_STEAM_IDS` bootstrap of `is_site_admin`, `getSession()` helper, guards `requireSiteAdmin()` / `requireGroupRole(groupId, 'admin'\|'member')` | P0-5 | Log in with Steam on a preview deploy; site admin flag correct; group role read from DB per request; forged OpenID assertion rejected (unit test on verifier). **Code done 2026-09-25** (`lib/auth/`, `/auth/steam`, `/auth/steam/callback`, `/auth/logout`; 20 unit tests incl. forged assertions); local login verified 2026-09-25 (players row, site admin); **Production login verified 2026-09-26** on `mixer-gray.vercel.app` (the env vars had been saved empty, re-entered) |
| [x] **M1-2** | External clients: `lib/external/steam.ts` (summaries, vanity, input parsing), `faceit.ts` (player by SteamID, ELO, match stats with ms paging, form samples; lifetime client dropped 2026-09-26, unused by balancing) with caching (Next data cache: Steam 1 h, FACEIT 10 min) | S3 | Unit tests against fixtures; typed with Zod |
| [x] **M1-G** | Groups UI (generic: any group; ours is only seeded): any logged-in player creates a group (name, slug, optional **FACEIT Club link**), becomes its admin; group page; admins promote/demote admins, close memberships; group switcher in the nav; seed our group from `db/seed/roster.json` | M1-1 | Group created from the UI with a FACEIT link; a non-admin cannot manage it (server check); our 12 players seeded |
| [~] **M1-3** | Roster (per group): group admin adds player by SteamID64 / profile URL / vanity; auto-fill Steam name+avatar and FACEIT link; manual ELO override; deactivate player; first login claims record | M1-G, M1-2 | Adding by each input form works; a pre-added player logging in sees their own record, no duplicate. **Code done 2026-09-27:** EN/PL controls, per-group fallback ELO, membership closure, optional FACEIT with retry, idempotent adds and login-claim regression tests; closed memberships are not reopened implicitly. **Deploy check 2026-10-06:** Production `/g/skarpeciarze` returned HTTP 200 and rendered 12 unique roster Steam profiles. First-login claim and signed-in roster controls still need a Steam session. |
| [x] **M1-4** | Balancing engine `lib/balance` (pure TS): skill score E+F(+M=0), win prob, 126-split enumeration, hard/soft pair rules, cost, diverse top-3 selection, re-roll exclusion, config defaults | – *(can start right after P0-1)* | Unit tests cover: 40 candidates with both hard rules, distance function, tie handling, determinism, shrinkage examples from [docs/04](04-team-balancing.md) |
| [x] **M1-4b** | Balancing explanation (D22): engine returns *why* for every number: per player E (source: FACEIT / manual override), F internals (matches in window, window vs baseline rating, ratio, shrunk ratio, raw F, asymmetry multiplier, clamped?), M internals (maps, shrinkage), **A activity** (sessions in 30 days, D26); per variant cost split into imbalance pp + each rule's penalty + duo status; per-factor weights `weights.{elo,faceitForm,mixForm,activity}` (defaults 1 / 1 / 0.5 / 1) in `BalanceConfig`; **form asymmetry by absolute ELO** (`form.asymmetry` anchors, D24 amended); design preview uses the engine | M1-4 | Unit tests assert the explanation adds up to S and to the cost; weights change S as documented in docs/04; the docs/04 asymmetry and activity examples are tests |
| [~] **M1-5** | Mix lobby (per group): **group admin** (or site admin) creates a mix, join/leave, admin add/remove, hard cap 10 (DB-enforced), staged status transitions, realtime participant list in **join order** (D28) | M1-3 | Two browsers see joins live; 11th join is rejected even under race (DB constraint/transaction). **Code done 2026-09-27; Supabase join/closure race passed 2026-09-27. Retried 2026-10-06:** `node --env-file=.env.local scripts/db-race-check.mjs` was denied by the Supabase Management API (`FGA Authentication Error: Unauthorized`) before fixture creation, so this retry made no database changes and verified no races. The two-browser lobby check remains. |
| [~] **M1-6** | Variant generation: authorized server actions fetch FACEIT ELO + form, resolve documented fallbacks (D40), compute S with the unchanged engine, store `skill_snapshot` + `balance_config`, and create 3 private variants; admin preview, re-roll only while balancing, and atomic approval to publish (D37); one locked 1:1 swap function preserves every team slot and stored score, removes the leaver's vote and records the change (D39); variant UI reuses the showcase (teams sorted by S, breakdown, win %, D28 labels and public "How was this calculated?") | M1-4b, M1-5 | **Code done 2026-09-27; migration verification and approve-vs-re-roll race passed on Supabase 2026-09-27.** Remaining: generate/approve with ten real FACEIT players and check the admin re-roll/approve/swap flow in a browser. Neutral all-unsourced ELO is 1400 (Artur, 2026-09-28). |
| [x] **M1-7** | Voting (D33: **votes are public**, voting again moves the vote, **no auto-close on the 10th vote**: admin closes, or 60 min after the last vote once all ten voted; admin can reopen until the match starts; ties drawn with a seed = mix id, `lib/mix/voting.ts`): participants only, change vote until close, live counts, admin proxy vote (`cast_by`), delayed auto-close, admin close, tie-break rule, locked lineup card (each team in join order, D28) | M1-6 | **Done 2026-09-28:** Supabase migration and SQL assertions pass; two browser tabs received vote and lock updates live; non-participant/proxy rejection, vote movement, deadline, reopening and seeded tie tested; locking sets `chosen_variant_id` and retains the approved set. |
| [x] **M1-8** | Public read-only pages: mixes list, mix page (any state), roster; nav, empty states, mobile layout | M1-7 | **Done 2026-09-28:** public group directory at `/g`, group mix list and roster, guest mix views, guest-safe empty states, and navigation verified logged out at 375 px. No action buttons for guests. |
| [ ] **P0-6** | Separate **prod** Supabase project (the current one stays as dev): create it, run migrations, point Vercel Production env at it and Preview/local at dev; `DB migrate` workflow migrates both (dev on push, prod on push to main after dev succeeds) | P0-4 | Prod project has all migrations; a preview deploy never touches prod data |
| [ ] **M1-9** 👤 | **Release MVP**: production deploy, owner adds roster, dry-run mix with the group | M1-8, P0-6 | One real mix balanced + voted in the app |
| [x] **T-1** *(parallel)* | Balancing backtest: fixtures from real mixes (FACEIT profiles, real lineups, results) → report where real split ranks. Data source: our old **popflash** club (`popflash.site/-/skarpeciarze-i-pantofle/matches`, 71 maps Oct–Dec 2024, per map lineups + K/A/D/ADR/KAST/FK/FD, see T-2). Assumption (owner, 2026-09-25): everyone's ELO then = FACEIT ELO now | M1-4, T-2 | Fixtures in `lib/balance/__fixtures__/` run as tests; short findings note in `docs/04`. **Done:** module `backtest/` (`npm run backtest`, method in `backtest/README.md`), findings in docs/04 |

| [x] **T-2** *(parallel)* | Popflash history export: `scripts/backtest-data.mjs popflash` via the **Backtest data** workflow (popflash blocks the sandbox) → `lib/balance/__fixtures__/popflash/*.json` (map, score, date, both lineups with per-player stats); player → SteamID64 mapping already in `popflash/players.json` (27 players, from profile pages; second accounts via `mergeInto`) | – | JSON for all 71 matches; players resolved through `players.json`. Artur later authorized a separate group archive import (D25 amendment); backtests still read fixtures. |

## Phase 2: results & stats (FACEIT-first, see D17)

Mixes are played on a private **FACEIT Club queue**. Stats come from the FACEIT Data API per map;
demos are an optional extra (any group member can upload one, parsed in the browser).

| ID | Task | Deps | Done when |
|---|---|---|---|
| [x] **M2-1** | Schema: `matches` (one per map, `source` faceit/manual/demo, `faceit_match_id` null), `match_player_stats` (optional per match), `match_payloads` (raw FACEIT/demo JSON) | M1-9 | **Done 2026-09-29:** migrations applied; score-only maps pass SQL tests and publishable-key checks. |
| [~] **M2-7** | **Manual results** (no FACEIT, D21): group admin enters **any number of maps** + scores for a locked mix (map optional), mix → `played`; player stats stay empty or come later (FACEIT import / demo upload M4-6) | M2-1 | **Code and database done 2026-09-29:** atomic admin entry and public map scores; SQL tests cover authorization, rollback, and duplicate submission. **2026-09-30:** a later FACEIT import enriches manual maps only when count and scores match in order, keeping the manual score source; live migration and SQL race checks pass. Player profiles count score-only maps in win rates without assigning a rating. Real admin browser entry and enrichment still need verification. |
| [~] **M2-2** | FACEIT evening import (D27, [docs/05](05-demo-pipeline.md#assembling-a-mix-evening-d27-m2-2)): every map is its own room; "Find matches" on a locked mix lists candidates (Club matches via `groups.faceit_club_id`, fallback: participants' `/history` since `locked_at`), filtered to started after the lock, within 6 h of the first, ≥ 8 of 10 participants; admin confirms / unticks / adds a room link → `/matches/{id}` + `/matches/{id}/stats` per room → one `matches` row per map, per-player stats; factions mapped to A/B by majority; warn on lineup mismatch; `demo_url` kept as a link only; mix → `played`. Candidate filter is a pure function with unit tests on fixtures | M2-1, S3, S5 | **Code and database done 2026-09-29:** filtering tests, live FACEIT API sample, atomic and idempotent SQL import tests pass. A real 3+ map Club evening and admin browser import still need verification. |
| [x] **M2-3** | Mixer Rating from FACEIT stats (`lib/balance/faceit-rating.ts` shape, KAST fixed until demo extras exist); maps without player stats get no rating | M2-2 | **Done 2026-09-29:** FACEIT fixture tests cover per-map rating; SQL import stores it per player, while score-only maps have no stat row. |
| [~] **M2-4** | Mix results for **N maps** (owner 2026-09-25: room for more stats per player and a **map preview image** per map; images must be our own or licensed, not ripped Valve assets): summary (maps won, score chip per map), tabs "All maps" + one per map, popflash-style scoreboard per map and totals over all maps (design: `/design/mix?state=played`, 5 maps) | M2-3 | **Code 2026-09-29:** map tabs, score summary, per-map and total scoreboards, original illustrative map sketches, and score-only lineup; five-map rendering test. Real archived one- and four-map mixes are available for browser checks. A real five-map evening and a licensed/own accurate map preview remain open. |
| [x] **M2-5** | Mix page "how to play": the group's FACEIT Club link (`groups.faceit_club_url`) + the voted lineup; captains pick exactly that lineup | M1-7 | **Done 2026-09-29:** locked mixes link to their group's FACEIT Club beside the chosen lineup; an unlinked group gets an honest fallback. Guest rendering and mobile layout checked. |
| [x] **M2-6** | Mix form term **M** in balancing (last 10 mix maps, shrinkage to group avg) | M2-3 | **Done 2026-10-06:** generation uses numeric Mixer Ratings from all played maps in the same group, including Popflash and enriched manual maps; score-only maps and missing ratings are skipped. Each player uses their latest 10 ratings, the group average uses all earlier numeric group ratings, and shrinkage `k = 5` applies from the first rating. Snapshot stores both inputs; re-roll reuses it. M remains weight 0.5; no formula or schema change. |
| [ ] **M2-9** | **Live evening tracker** (D29): `matches.status` `ongoing`/`finished`; FACEIT webhook endpoint `/api/webhooks/faceit` (secret header) when S6 confirms club events, else a 60 s poll from open mix pages through a shared 60 s server cache; evening timeline on the locked mix page (live map, room link, finished maps with scores), each finished map imported with the M2-2 filter; admin "Map started" / "Close evening" buttons; Realtime to all viewers | M2-2, S6 | During a real evening two browsers see map 2 go live and map 1's score appear without reloading; no FACEIT calls when nobody has the page open |
| [~] **M2-8** | **Match awards** (Worms-style, D28) + a **pool of situational quips** (who carried from low on paper, who was only strong on paper, comebacks, stomps, overtime; the page picks the line that fits): pure `lib/awards` computes per-evening awards from stored per-map stats; available FACEIT/Popflash fields now, demo-only awards once M4-6 parses a demo; at most 2 awards per player per evening, max 6 shown, ties → the more extreme value relative to the threshold, then join order; list below | M2-3 | **Partial 2026-10-08:** all eighteen API/stored-field award types are implemented. Both FACEIT result RPCs persist advanced entry/clutch/flash/sniper/MVP counts; played pages and group totals consume them. Missing fields exclude awards; max two/player and six/evening. Three score-based quips cover close maps, stomps and split evenings; larger situational coverage remains. Demo awards require M4-6. Live migration and SQL verification passed; no stored FACEIT history currently needs backfill. |

### M2-8 award list

Evaluated over the whole evening (all maps summed, rates per round over the rounds each player
played). An award goes to the single best player on its stat, **only if** that player also clears
the threshold. Names are UI copy (English), tone per PRODUCT.md.

**From stored FACEIT stats, or historical Popflash fields where present** (`match_player_stats`):

| Award | Stat | Threshold |
|---|---|---|
| Cannon Fodder | most deaths | DPR ≥ 0.80 |
| Pacifist | lowest ADR | ADR < 55 |
| Assist King | most assists | ≥ 0.25 assists per round |
| Tourist | fewest kills | KPR < 0.45 |
| Headhunter | highest HS% | HS% ≥ 65 with ≥ 15 kills |
| Spray and Pray | lowest HS% | HS% ≤ 25 with ≥ 15 kills |
| Kamikaze | lowest entry win rate | ≥ 5 entry attempts and ≤ 30 % won |
| Door Opener | most first kills | ≥ 5 first kills |
| Clutch Minister | most 1vX wins (1v1 + 1v2) | ≥ 2 won |
| Clutch or Kick | most 1vX attempts without a win | ≥ 3 attempts, 0 won |
| Grenadier | most utility damage | ≥ 250 |
| Sunglasses Salesman | most enemies flashed | ≥ 15 |
| Flash Bang Whiff | worst flash success rate | ≥ 10 flashes thrown and ≤ 30 % successful |
| Scope Addict | highest share of sniper kills | ≥ 40 % of kills, ≥ 10 kills |
| Exterminator | aces (5k) | ≥ 1 |
| So Close | most 4k rounds | ≥ 2 |
| Lone Wolf | top fragger of a team that lost the map | lost by ≥ 5 rounds |
| MVP Hoarder | most MVPs | ≥ 0.2 MVPs per round |

**Demo only** (M4-6, from `match_payloads`):

| Award | Stat (demo events) | Threshold |
|---|---|---|
| Friendly Flasher | teammates blinded (`player_blind` on own team, duration > 1 s) | ≥ 5 |
| Friendly Fire Enthusiast | damage to teammates (`player_hurt`, same team) | ≥ 100 |
| Self-Destruct | own damage from own grenades, or a suicide | ≥ 50 damage or ≥ 1 suicide |
| Chicken Hunter | chickens killed (`other_death`, `othertype = chicken`) | ≥ 1 |
| Knife Collector | knife kills | ≥ 1 |
| Zeus Enthusiast | taser kills | ≥ 1 |
| X-Ray | wallbang kills (`penetrated > 0`) | ≥ 3 |
| Smoke Criminal | kills through smoke (`thrusmoke`) | ≥ 3 |
| Blind Fury | kills while blind (`attackerblind`) | ≥ 1 |
| Air Jordan | kills while airborne (`attackerinair`) | ≥ 1 |
| No-Scope Artist | no-scope kills (`noscope`) | ≥ 1 |
| Bait Master | share of kills that are trade kills | ≥ 40 %, ≥ 10 kills |
| Save Artist | survived rounds the team lost | ≥ 5 |
| Wasted Nades | HE grenades thrown that hit nobody | ≥ 5 |

## Phase 3: profiles & comparisons

| ID | Task | Deps | Done when |
|---|---|---|---|
| [x] **M3-1** | Player profile: header (FACEIT level/ELO live), mix aggregates, Mixer Rating trend chart, per-map stats, best teammates | M2-5 | **Done 2026-09-29:** empty and four-map profiles rendered locally against the approved Supabase project; score-only maps contribute to wins, not rating. Test data removed afterwards. |
| [x] **M3-2** | Leetify client + Mix / FACEIT / Premier profile tabs and lobby/variant preview card. Live, five-minute server HTTP cache, data shown as-is with Data Provided by Leetify attribution; preview shows only last-30-day FACEIT matches with W/L, date, map, score, K/A/D and Leetify Rating. Private profiles say so. Never stored or used in balancing/Mixer Rating. | M3-1, P0-2 | Done 2026-10-06: profile tabs and preview use /api/leetify/[steamId]; tests cover source filtering, response caching and VGUI views.
| [x] **M3-3** | Head-to-head compare page | M3-1 | **Done 2026-10-06:** public `/g/[slug]/compare`, linked from the roster; two distinct active members, shareable source/player selection, side-by-side Mix/FACEIT/Premier profiles (stacked on mobile). Shared mix maps/evenings, opponent and teammate records, and linked shared map history; score-only maps count without invented statistics. Leetify remains raw display-only with attribution. Focused aggregation, route validation and view tests; real local desktop/mobile comparison and both external sources checked. |
| [x] **M3-4** | Leaderboards with minimum-maps threshold | M3-1 | **Done 2026-10-07 (D44):** public `/g/[slug]/stats`, linked from the group summary; full player ranking sorted by Mixer Rating, ADR, K/D, win rate or maps, with observed samples and a five-map threshold. Period/archive filters, expandable per-map group/player performance, actual teammate pairs and existing award totals with recipient counts. Only stored played group Mixes; score-only results do not fabricate metrics. |

**Owner-approved UX follow-up (2026-10-06):** Batches 1–5 are complete before M3-3 and M4-7: header profile entry and distinct balance/ELO labels; profile Mixer Rating chart with 20-map cap, tooltips and mix links; raw last-20 Leetify Rating charts with attribution and no computed Leetify statistics; available FACEIT ADR/room links, mix profile links and verified score colors; group page in one shared VGUI window with an internal responsive split, active-mix-aware creation, collapsible leaders and linked Discord profiles. The group page exception is documented in [DESIGN.md](../DESIGN.md).

**Owner profile follow-up (2026-10-07, D42):** date and map links to concrete match details,
separately labelled arithmetic means over the displayed source/window (excluding missing ratings),
FACEIT level/ELO from FACEIT directly, and roster shortcuts comparing the viewer with another member.
This amends the previous no-computed-Leetify-statistics UI choice; original per-match ratings and
the balancing algorithm are unchanged.

## Phase 4: optional

| ID | Task | Deps |
|---|---|---|
| [ ] **M4-1** | Mixer Rating 3 (swing table + eco adjustment), recompute from `match_payloads` | M4-6 |
| [ ] **M4-3** | Balancing calibration report (predicted vs actual) | M2-3 + ~5 mixes |
| [ ] **M4-4** | Path B: DatHost + MatchZy integration (only if FACEIT stops working for us) | M2-2 |
| [ ] **M4-5** | **Captain draft** as an alternative to balanced variants: admin picks 2 captains → quick rock-paper-scissors mini-game (realtime) decides first pick → captains draft players in the app (1-2-2-2-2-1) → lineup locked **for the whole evening** (all maps of the mix) | M1-7 |
| [ ] **M4-7** | Per-group balancing settings: `groups.balance_config` overrides the site defaults: **on/off switch and weight per term E / F / M / A**, form window, asymmetry anchors, activity anchors, duo rules; group admin edits them with a live preview on a past mix; each mix still stores the config it used | M1-6 |
| [ ] **M4-6** | Demo extras: any group member uploads the FACEIT demo manually → `lib/demo` (pure TS, browser Web Worker) computes KAST, openings, trades, clutches, utility, flashes; full Mixer Rating 2 replaces the KAST-fixed one for that map. Pitfalls in docs/05 "First parse test" | M2-3, S4 |

## Phase 5: Discord (per group, D19)

A group links its Discord server; a bot (one app for the whole site) moves players between voice
channels. Moving uses Discord's REST API only (`PATCH /guilds/{guild}/members/{user}` with `channel_id`,
bot permission **Move Members**), so it works from serverless functions without a gateway connection.
A player must already be connected to a voice channel of that server to be moved.

| ID | Task | Deps | Done when |
|---|---|---|---|
| [~] **S6** | Spike: FACEIT webhooks for our Club, delivery latency, live score, Club match listing, and Discord move from a deployed function | S5, P0-4 | **Research 2026-10-02:** published events cover ready/finished but not the knife round; the linked Club ID returns HTTP 200 from the hub match list (empty, no queue match yet). Club webhook delivery and live score remain unverified. See [docs/06](06-external-apis.md#faceit-live-match-signals-s6-desk-research-2026-10-02). Done after one real Club match and one test move. |
| [x] **D-1** 👤 | Discord app + bot (site-wide `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID/SECRET`); group admin connects the server (bot invite with View Channels, Move Members + Send Messages), picks lobby / team A / team B voice channels and a text channel → `groups.discord_guild_id`, `discord_settings` | M1-G | **Code 2026-09-30:** OAuth connection checks the Discord user's Manage Server permission and bot membership; channel selection validates against live server channels. Owner verified on the real server 2026-10-05. |
| [x] **D-2** | Players link Discord (OAuth2 `identify`) → `players.discord_user_id`; group roster shows who is linked | D-1 | **Code 2026-10-02:** link / unlink and unlinked mix participants implemented. Owner verified live OAuth 2026-10-05. |
| [~] **D-3** | **Voice moves:** after the knife round, before the first live round → team A / team B channels; match end → lobby. Admin buttons on the locked mix always; automatic start only if S6 finds a reliable pre-round signal (the published FACEIT webhooks have none). Automatic return may use a verified Club `match_status_finished` event | D-2, M1-7, S6 | Manual buttons and per-player reporting implemented 2026-10-03; owner moved players on the real server 2026-10-05 (controls hide 12 h after the match and on archived mixes). **Code 2026-10-05:** `/api/webhooks/faceit` returns the lineup to the lobby on `match_status_finished` (secret header, ≥8 of 10 lineup players in the room, once per FACEIT match); payload fields from a FACEIT forum example, unverified. Real 10-player mix and Club finish hook remain; automatic timing must be measured before enabling. |
| [~] **D-4** | Discord notifications in the group's text channel (mix created, lineup locked, results) | D-1, M1-7 | Messages posted for a real mix. **Code 2026-10-05:** one English message per mix and event (`mixes.discord_notices` claims it, mentions disabled); lock also posts on the first page view after a pg_cron auto-close. Real-mix check remains. |

## Critical path

```
P0-1 → P0-3 → P0-5 → M1-1 → M1-G → M1-3 → M1-5 → M1-6 → M1-7 → M1-8 → M1-9 (MVP)
P0-1 → M1-4 → M1-4b ─────────────────┘
P0-4 → P0-6 (prod Supabase) → M1-9
P0-2 → S3 → M1-2 → M1-3
M1-9 → M2-1 → M2-7 (manual results) → M2-2 → M2-3 → M2-4 (stats from FACEIT)
```

**Next in order (status 2026-10-06):** UX batches 1–5, shared profile charts and M3-3 (head-to-head comparison) are complete. Owner update 2026-10-07: M2-8 (more awards), richer source statistics and S4 / M4-6 (demo feasibility / extras) are next. M4-7 (balance settings) is deferred; M2-9 (live tracking) is low priority. Database separation and the first real mix wait. Production checks confirmed the public roster page and the keep-alive route. P0-4 is complete after Artur's manual cron run returned HTTP 200 in function logs. `db-race-check.mjs` passed all six cases on 2026-10-06 (one earlier run failed its first case on request timing, not the cap). The Steam first-login check and two-browser lobby check remain open; see [TODO.md](../TODO.md). M1-G is complete.
**Where keys live:** GitHub Actions secrets (used by the `API spike` / `DB migrate` workflows) and Vercel. The cloud sandbox has none and cannot reach `open.faceit.com` (Cloudflare challenge), so live FACEIT calls always go through a workflow or a deploy.
**Owner inputs that unblock the rest:** FACEIT Club + one mix (S5) and the separate production database (P0-6). T-2 is complete.

## Resolved questions (2026-09-24)

| Question | Answer |
|---|---|
| Admins | Per group: creator + people they promote; site admin = owner. Group admins create mixes (not only the site admin) |
| Site visibility | Public, read-only for guests |
| Voting end | Admin closes, or 60 min after the last vote once all ten voted; votes can move and admin can reopen before play (D33 supersedes the original answer) |
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
