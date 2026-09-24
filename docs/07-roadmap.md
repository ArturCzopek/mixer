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
| [~] **P0-3** | DB schema + migrations for Phase 1 tables (`players`, `mixes`, `mix_participants`, `variants`, `variant_players`, `votes`) + RLS select policies | P0-1, P0-2 | Migrations apply cleanly to Supabase; anon key can `select`, cannot write |
| [ ] **P0-4** | Deploy pipeline + keep-alive cron (`/api/cron/keepalive`, `CRON_SECRET`) | P0-1, P0-2 | Preview deploy per PR; cron visible in Vercel; endpoint returns 200 and hits DB |
| [x] **S3** | FACEIT API spike: script calling the endpoints from [external APIs](06-external-apis.md#faceit-data-api-v4-balancing-source) for 2–3 members | P0-2 | Notes added to `docs/06` with exact fields for ELO, 30-day matches, per-match K/D (+ADR?), rate limits; recorded JSON fixtures saved in `lib/external/__fixtures__/` |
| [ ] **S5** 👤 | FACEIT Club spike: owner creates a free private Club + queue, checks team-formation options (can we set our lineup?), plays one mix; Claude reads the match via Data API (`/matches/{id}`, `/matches/{id}/stats`, club/hub matches list) | S3 | Answers for the open rows in [docs/05 Path C](05-demo-pipeline.md#path-c-faceit-club-queue-chosen-d17); D17 Accepted or Rejected |
| [ ] **S4** *(optional, for M4-6; native parse done, see docs/05 "First parse test")* | demoparser2 WASM spike: minimal page parsing a FACEIT demo in a Web Worker | P0-1, 👤 demo file | Time + peak memory for a ~150 MB demo written in `docs/05`; D7 in decisions marked Accepted or switched to Python fallback |
| [ ] **S1** *(optional, only for demo extras M4-6)* | POV vs GOTV accuracy: parse both demos of the same FACEIT match, compare per stat | S4, 👤 POV + GOTV demo | Table in `docs/05` listing which stats are exact / approximate / missing in POV |

## Phase 1: MVP (roster → mix → balance → vote)

| ID | Task | Deps | Done when |
|---|---|---|---|
| [ ] **M1-1** | Steam OpenID login + session cookie (`jose`), logout, `ADMIN_STEAM_IDS` bootstrap, `getSession()` helper, admin guard | P0-3 | Log in with Steam on a preview deploy; admin flag correct; forged OpenID assertion rejected (unit test on verifier) |
| [ ] **M1-2** | External clients: `lib/external/steam.ts` (summaries, vanity), `faceit.ts` (player by SteamID, ELO, 30-day matches, lifetime) with caching | S3 | Unit tests against fixtures; typed with Zod |
| [ ] **M1-3** | Roster: admin adds player by SteamID64 / profile URL / vanity; auto-fill Steam name+avatar and FACEIT link; manual ELO override; deactivate player; first login claims record | M1-1, M1-2 | Adding by each input form works; a pre-added player logging in sees their own record, no duplicate |
| [x] **M1-4** | Balancing engine `lib/balance` (pure TS): skill score E+F(+M=0), win prob, 126-split enumeration, hard/soft pair rules, cost, diverse top-3 selection, re-roll exclusion, config defaults | – *(can start right after P0-1)* | Unit tests cover: 40 candidates with both hard rules, distance function, tie handling, determinism, shrinkage examples from [docs/04](04-team-balancing.md) |
| [ ] **M1-5** | Mix lobby: create mix, join/leave, admin add/remove, hard cap 10 (DB-enforced), status machine `open→balancing→voting→locked→played/cancelled`, realtime participant list | M1-3 | Two browsers see joins live; 11th join is rejected even under race (DB constraint/transaction) |
| [ ] **M1-6** | Variant generation: server action fetches FACEIT data, computes S, stores `skill_snapshot`, creates 3 variants; admin preview, re-roll, publish; per-variant UI (lineups, S breakdown, win %, badges) | M1-4, M1-5 | Generating for 10 real players shows 3 distinct variants; snapshot stored; re-roll never repeats a shown split |
| [ ] **M1-7** | Voting: participants only, change vote until close, live counts, admin proxy vote (`cast_by`), auto-lock at 10/10, admin close, tie-break rule, locked lineup card | M1-6 | Realtime counts in two browsers; non-participant vote rejected; tie-break unit-tested; lock sets `chosen_variant_id` |
| [ ] **M1-8** | Public read-only pages: mixes list, mix page (any state), roster; nav, empty states, mobile layout | M1-7 | Logged-out user can view everything, sees no action buttons; works at 375 px width |
| [ ] **M1-9** 👤 | **Release MVP**: production deploy, owner adds roster, dry-run mix with the group | M1-8 | One real mix balanced + voted in the app |
| [ ] **T-1** *(parallel)* 👤 | Balancing backtest: fixtures from recent real mixes (FACEIT profiles, real lineups, results) → report where real split ranks | M1-4, 👤 data | Fixtures in `lib/balance/__fixtures__/` run as tests; short findings note in `docs/04` |

## Phase 2: results & stats (FACEIT-first, see D17)

Mixes are played on a private **FACEIT Club queue**. Stats come from the FACEIT Data API per map;
demos are an optional extra (owner uploads them manually, parsed in the browser).

| ID | Task | Deps | Done when |
|---|---|---|---|
| [ ] **M2-1** | Schema: `matches` (one per map, `faceit_match_id`), `match_player_stats`, `match_payloads` (raw FACEIT/demo JSON) | M1-9 | Migrations applied |
| [ ] **M2-2** | FACEIT match import: admin pastes the FACEIT room link(s) of a locked mix → fetch `/matches/{id}` + `/matches/{id}/stats` → per-player per-map stats; map players to roster; warn if FACEIT teams differ from the voted lineup; mix → `played` | M2-1, S3 | Importing the room of a real mix stores all maps; re-import is idempotent; lineup mismatch shown |
| [ ] **M2-3** | Mixer Rating from FACEIT stats (`lib/balance/faceit-rating.ts` shape, KAST fixed until demo extras exist) + manual result fallback (map + score) if FACEIT data is missing | M2-2 | Unit tests; rating stored per player per map |
| [ ] **M2-4** | Match page: scoreboard (popflash-style) per map, mix summary (maps won, per-player totals) | M2-3 | Renders for a real mix; mobile OK |
| [ ] **M2-5** | Mix page "how to play": FACEIT Club queue link + the voted lineup; captains pick exactly that lineup | M1-7 | Shown on locked mixes |
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
| [ ] **M4-2** | Discord webhook notifications (mix created, lineup locked, results) | M1-7 |
| [ ] **M4-3** | Balancing calibration report (predicted vs actual) | M2-3 + ~5 mixes |
| [ ] **M4-4** | Path B: DatHost + MatchZy integration (only if FACEIT stops working for us) | M2-2 |
| [ ] **M4-5** | **Captain draft** as an alternative to balanced variants: admin picks 2 captains → quick rock-paper-scissors mini-game (realtime) decides first pick → captains draft players in the app (1-2-2-2-2-1) → lineup locked **for the whole evening** (all maps of the mix) | M1-7 |
| [ ] **M4-6** | Demo extras: owner uploads the FACEIT demo manually → `lib/demo` (pure TS, browser Web Worker) computes KAST, openings, trades, clutches, utility, flashes; full Mixer Rating 2 replaces the KAST-fixed one for that map. Pitfalls in docs/05 "First parse test" | M2-3, S4 |

## Critical path

```
P0-1 → P0-3 → M1-1 → M1-3 → M1-5 → M1-6 → M1-7 → M1-8 → M1-9 (MVP)
P0-1 → M1-4 ─────────────────────────┘
P0-2 → S3 → M1-2 → M1-3
M1-9 → M2-1 → M2-2 → M2-3 → M2-4 (stats from FACEIT)
```

**Unblocked right now (no owner input needed):** P0-3 (migrations via the `DB migrate` workflow, keys are in GitHub secrets), M1-2 (fixtures recorded in S3).
**Where keys live:** GitHub Actions secrets (used by the `API spike` / `DB migrate` workflows) and Vercel. The cloud sandbox has none and cannot reach `open.faceit.com` (Cloudflare challenge), so live FACEIT calls always go through a workflow or a deploy.
**Owner inputs that unblock the rest:** FACEIT Club + one mix (S5), backtest data for T-1.

## Resolved questions (2026-09-24)

| Question | Answer |
|---|---|
| Admins | Owner + 1–2 trusted people |
| Site visibility | Public, read-only for guests |
| Voting end | All 10 voted or admin closes; no time limit |
| More than 10 players | Hard cap 10, no waitlist; admin can remove people |
| Demo source | ~~POV recording~~ → FACEIT: stats from the API, demos uploaded manually by the owner as an optional extra (D17) |
| Leetify | Read-only display, never stored; balancing on FACEIT |
| Discord | Yes, the group has a Discord server; integrate later (E4) |
| Team picking | Balanced variants + vote now; captain draft with a rock-paper-scissors mini-game later (M4-5) |
| Initial roster | 12 SteamID64s in `db/seed/roster.json` (2026-09-24) |

## Open questions

1. ~~Is there a group Discord worth posting to (M4-2)?~~ Yes.
2. ~~Valve PM or FACEIT?~~ FACEIT Club queue (D17, 2026-09-24). The FACEIT room in the 2026-09-20 fixture was a random public match used only as a test demo.
