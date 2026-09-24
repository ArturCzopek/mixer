# Roadmap

## Phase 0: spikes (before writing the app)

| # | Question | How | Outcome decides |
|---|---|---|---|
| **S1** | How accurate is a **POV demo**? | Play a FACEIT match with `record pov_test` running, then download the **GOTV demo of the same match** from FACEIT. Parse both and compare stat by stat. | Which stats we trust for POV-sourced mixes; whether a backup recorder from the other team matters |
| **S3** | **FACEIT API** fields and limits | Call the endpoints for 2–3 group members | Form formula (K/D only vs K/D + ADR), 30-day filtering, storage terms |
| **S4** | **demoparser2 WASM** in a browser Web Worker | Minimal page: parse a FACEIT GOTV demo (~150 MB), measure time and memory | Browser parsing vs local Python script fallback |
| **S5** | Stat formulas are correct | Parse a FACEIT GOTV demo, compare K/D/A, ADR, HS%, KAST, multikills with the FACEIT match page | Confidence in `lib/demo` before the first mix |

~~S2: downloading private-match demos from the client~~. Dropped: we record ourselves.

**What I need from you for the spikes:**
- Any **FACEIT demo** (`.dem` or `.dem.zst`/`.gz`, as FACEIT provides it) plus the link to that match page. Covers S4 and S5.
- Ideally a **POV recording + the FACEIT demo of the same match**. Covers S1.
- A **FACEIT API key** (developers.faceit.com, server-side key) in a local `.env`. Covers S3.

## Test scenario: balancing backtest (after Phase 1 engine exists)

Provide FACEIT profiles + real lineups + results of recent mixes. The engine ranks the real split
among all 126 and shows what it would have proposed. Details: [team balancing](04-team-balancing.md#backtest-scenario-test-data-later).

## Phase 1: MVP (lobby, balancing, voting)

- [ ] Next.js + Supabase project, Vercel deploy, keep-alive cron
- [ ] Steam login, session cookie, admins bootstrapped via `ADMIN_STEAM_IDS` (owner + 1–2 people)
- [ ] Roster: admin adds players by SteamID / profile URL; Steam name/avatar; FACEIT link; admin removes players
- [ ] Mix: create, join/leave (hard cap 10, no waitlist), admin add/remove, live participant list
- [ ] Balancing engine (`lib/balance`) with unit tests; FACEIT ELO + 30-day FACEIT form (M = 0 for now)
- [ ] Variant generation UI: 3 variants, re-roll, publish
- [ ] Voting: live counts, admin proxy vote, auto-lock at 10/10, admin close, tie-break
- [ ] Locked lineup card (easy to screenshot / share)
- [ ] Public read-only pages for guests

## Phase 2: results & demo stats

- [ ] Manual result entry (map + score) as a fallback
- [ ] Demo upload → Web Worker parse → preview → save (stats + `match_payloads`)
- [ ] Match page (scoreboard, rounds timeline)
- [ ] Recorder (+ optional backup) on the mix page with a copy-paste command
- [ ] Mixer Rating 2; mix form term **M** switched on in balancing

## Phase 3: profiles & comparisons

- [ ] Player profile: mix aggregates, rating trend chart, maps, best teammates
- [ ] FACEIT / Premier tabs with live Leetify data + attribution (read-only, never stored)
- [ ] Source filter Mix / FACEIT / Premier
- [ ] Head-to-head compare page
- [ ] Leaderboards

## Phase 4: optional

- [ ] Mixer Rating 3 (swing + eco adjustment), recomputed from stored payloads
- [ ] Discord webhook: "Mix created", "Teams locked", "Scoreboard ready"
- [ ] Path B: DatHost + MatchZy integration
- [ ] Balancing calibration report (predicted vs actual results)

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

1. Is there a group Discord worth posting to (Phase 4)?
