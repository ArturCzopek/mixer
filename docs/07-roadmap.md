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
| [ ] **P0-2** 👤 | Accounts & keys: Supabase project, Vercel project linked to GitHub repo, Steam Web API key, FACEIT API key, Leetify API key | – | Keys set in Vercel env + cloud environment env; `.env.example` lists them all |
| [ ] **P0-3** | DB schema + migrations for Phase 1 tables (`players`, `mixes`, `mix_participants`, `variants`, `variant_players`, `votes`) + RLS select policies | P0-1, P0-2 | Migrations apply cleanly to Supabase; anon key can `select`, cannot write |
| [ ] **P0-4** | Deploy pipeline + keep-alive cron (`/api/cron/keepalive`, `CRON_SECRET`) | P0-1, P0-2 | Preview deploy per PR; cron visible in Vercel; endpoint returns 200 and hits DB |
| [ ] **S3** | FACEIT API spike: script calling the endpoints from [external APIs](06-external-apis.md#faceit-data-api-v4-balancing-source) for 2–3 members | P0-2 | Notes added to `docs/06` with exact fields for ELO, 30-day matches, per-match K/D (+ADR?), rate limits; recorded JSON fixtures saved in `lib/external/__fixtures__/` |
| [ ] **S4** *(parallel)* | demoparser2 WASM spike: minimal page parsing a FACEIT demo in a Web Worker | P0-1, 👤 demo file | Time + peak memory for a ~150 MB demo written in `docs/05`; D7 in decisions marked Accepted or switched to Python fallback |
| [ ] **S1** *(parallel)* | POV vs GOTV accuracy: parse both demos of the same FACEIT match, compare per stat | S4, 👤 POV + GOTV demo | Table in `docs/05` listing which stats are exact / approximate / missing in POV |

## Phase 1: MVP (roster → mix → balance → vote)

| ID | Task | Deps | Done when |
|---|---|---|---|
| [ ] **M1-1** | Steam OpenID login + session cookie (`jose`), logout, `ADMIN_STEAM_IDS` bootstrap, `getSession()` helper, admin guard | P0-3 | Log in with Steam on a preview deploy; admin flag correct; forged OpenID assertion rejected (unit test on verifier) |
| [ ] **M1-2** | External clients: `lib/external/steam.ts` (summaries, vanity), `faceit.ts` (player by SteamID, ELO, 30-day matches, lifetime) with caching | S3 | Unit tests against fixtures; typed with Zod |
| [ ] **M1-3** | Roster: admin adds player by SteamID64 / profile URL / vanity; auto-fill Steam name+avatar and FACEIT link; manual ELO override; deactivate player; first login claims record | M1-1, M1-2 | Adding by each input form works; a pre-added player logging in sees their own record, no duplicate |
| [ ] **M1-4** | Balancing engine `lib/balance` (pure TS): skill score E+F(+M=0), win prob, 126-split enumeration, hard/soft pair rules, cost, diverse top-3 selection, re-roll exclusion, config defaults | – *(can start right after P0-1)* | Unit tests cover: 40 candidates with both hard rules, distance function, tie handling, determinism, shrinkage examples from [docs/04](04-team-balancing.md) |
| [ ] **M1-5** | Mix lobby: create mix, join/leave, admin add/remove, hard cap 10 (DB-enforced), status machine `open→balancing→voting→locked→played/cancelled`, realtime participant list | M1-3 | Two browsers see joins live; 11th join is rejected even under race (DB constraint/transaction) |
| [ ] **M1-6** | Variant generation: server action fetches FACEIT data, computes S, stores `skill_snapshot`, creates 3 variants; admin preview, re-roll, publish; per-variant UI (lineups, S breakdown, win %, badges) | M1-4, M1-5 | Generating for 10 real players shows 3 distinct variants; snapshot stored; re-roll never repeats a shown split |
| [ ] **M1-7** | Voting: participants only, change vote until close, live counts, admin proxy vote (`cast_by`), auto-lock at 10/10, admin close, tie-break rule, locked lineup card | M1-6 | Realtime counts in two browsers; non-participant vote rejected; tie-break unit-tested; lock sets `chosen_variant_id` |
| [ ] **M1-8** | Public read-only pages: mixes list, mix page (any state), roster; nav, empty states, mobile layout | M1-7 | Logged-out user can view everything, sees no action buttons; works at 375 px width |
| [ ] **M1-9** 👤 | **Release MVP**: production deploy, owner adds roster, dry-run mix with the group | M1-8 | One real mix balanced + voted in the app |
| [ ] **T-1** *(parallel)* 👤 | Balancing backtest: fixtures from recent real mixes (FACEIT profiles, real lineups, results) → report where real split ranks | M1-4, 👤 data | Fixtures in `lib/balance/__fixtures__/` run as tests; short findings note in `docs/04` |

## Phase 2: results & demo stats

| ID | Task | Deps | Done when |
|---|---|---|---|
| [ ] **M2-1** | Schema: `matches`, `match_player_stats`, `rounds`, `match_payloads` | M1-9 | Migrations applied |
| [ ] **M2-2** | Manual result entry: map + score for a locked mix → `played` | M2-1 | Result shows on mix page; mix win/loss counted per player |
| [ ] **M2-3** | `lib/demo` (pure TS): events → rounds, K/D/A, ADR (HP-capped), HS%, KAST, openings, trades, multikills, clutches, utility, flashes, Mixer Rating 2; warmup/knife exclusion | S4, S1 | Unit tests on recorded parser output; matches FACEIT scoreboard for the S5 demo within agreed tolerance |
| [ ] **M2-4** | Upload flow: Web Worker parse → preview (unknown players, team mismatch, round coverage) → confirm → POST → Zod validate, dedupe hash, store stats + payload | M2-1, M2-3 | Uploading the same demo twice is rejected; mismatches are shown as warnings |
| [ ] **M2-5** | Match page: scoreboard (popflash-style), half scores, rounds timeline | M2-4 | Renders for a real demo; mobile OK |
| [ ] **M2-6** | Recorder assignment on mix page (recorder + optional backup, copy-paste `record mix_<n>`) | M1-7 | Shown on locked mixes |
| [ ] **M2-7** | Mix form term **M** in balancing (last 10 mix maps, shrinkage to group avg) | M2-4 | Engine tests updated; snapshot includes M |
| [ ] **M2-8** *(parallel)* | Python fallback script producing the identical payload (only if S4 says WASM is not viable) | S4 | Same JSON as the browser path for the test demo |

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
| [ ] **M4-1** | Mixer Rating 3 (swing table + eco adjustment), recompute from `match_payloads` | M2-4 |
| [ ] **M4-2** | Discord webhook notifications (waiting on the open question below) | M1-7 |
| [ ] **M4-3** | Balancing calibration report (predicted vs actual) | M2-2 + ~5 mixes |
| [ ] **M4-4** | Path B: DatHost + MatchZy integration | M2-4 |

## Critical path

```
P0-1 → P0-3 → M1-1 → M1-3 → M1-5 → M1-6 → M1-7 → M1-8 → M1-9 (MVP)
P0-1 → M1-4 ─────────────────────────┘
P0-2 → S3 → M1-2 → M1-3
S4 → S1 → M2-3 → M2-4 → M2-5 (stats)
```

**Unblocked right now (no owner input needed):** M1-4.
**Owner inputs that unblock the rest:** P0-2 (accounts & keys), demo files for S4/S1, backtest data for T-1.

## Resolved questions (2026-09-24)

| Question | Answer |
|---|---|
| Admins | Owner + 1–2 trusted people |
| Site visibility | Public, read-only for guests |
| Voting end | All 10 voted or admin closes; no time limit |
| More than 10 players | Hard cap 10, no waitlist; admin can remove people |
| Demo source | We record ourselves (POV); one recorder, optional backup |
| Leetify | Read-only display, never stored; balancing on FACEIT |

## Open questions

1. Is there a group Discord worth posting to (M4-2)?
