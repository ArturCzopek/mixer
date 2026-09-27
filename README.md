# mixer

A small web app for our CS2 friend group (~15 players) to run **10-man mixes**: pick 10 players,
get 3 balanced 5v5 team proposals, vote on one in real time, and track everyone's
performance across mixes (popflash-style stats from demos).

> Status: **early development** — project scaffold in place; work follows the [roadmap](docs/07-roadmap.md).

## What it does (target)

1. **Roster** — everyone in the group logs in with Steam; the admin can also add players manually
   (by SteamID / profile URL) before they ever log in.
2. **Mix lobby** — admin creates a mix, players join (or the admin adds them) until there are 10.
3. **Team balancing** — the app pulls each player's FACEIT ELO + recent form + mix performance and
   proposes **3 different, balanced 5v5 splits** with an estimated win probability.
4. **Voting** — participants vote in real time; the most-voted split is the lineup.
5. **Result & stats** — after the match the admin pastes the FACEIT room link; the app pulls
   per-player stats from the FACEIT API (demos can be added for extra stats) (K/D, ADR, KAST, HLTV-style rating, entries, clutches, utility…).
6. **Profiles** — per-player pages with stats filterable by source (Mix / FACEIT / Premier) and
   head-to-head comparisons.

Mixes are played on our private **FACEIT Club queue**, which handles servers, anti-cheat and map veto.
The app does the balancing and voting, and pulls per-map stats from the FACEIT API afterwards.

## Documentation

| Doc                                         | Contents                                                    |
| ------------------------------------------- | ----------------------------------------------------------- |
| [Product spec](docs/01-product-spec.md)     | Goals, users, features, user stories, out of scope          |
| [Architecture](docs/02-architecture.md)     | Stack, components, auth, realtime, hosting limits           |
| [Data model](docs/03-data-model.md)         | Database tables and relations                               |
| [Team balancing](docs/04-team-balancing.md) | Skill score, form, pairing constraints, 3-variant selection |
| [Demo pipeline](docs/05-demo-pipeline.md)   | Getting demos (2 paths), parsing, stat formulas             |
| [External APIs](docs/06-external-apis.md)   | Steam, FACEIT, Leetify — endpoints and usage rules          |
| [Roadmap](docs/07-roadmap.md)               | Phases, spikes to run first, open questions                 |
| [Decisions](docs/08-decisions.md)           | Decision log (why X and not Y)                              |

## Run locally

Requires Node.js 22+.

```bash
npm ci
cp .env.example .env.local   # fill in keys (see comments in the file)
npm run dev                  # http://localhost:3000
```

Only the Supabase URL and publishable key are browser-safe; keep the other environment keys server-side.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm test` | Unit tests (Vitest, `lib/**/*.test.ts`) |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate Next route types + `tsc` |
| `npm run format` | Prettier (write) |
| `npm run format:check` | Check formatting without writing |

CI runs format check, lint, typecheck, tests and build on every PR.

## Deployment and keep-alive

The existing Vercel Git integration builds previews for pull requests and Production from `main`.
`vercel.json` schedules `GET /api/cron/keepalive` daily at 05:00 UTC. Set a random `CRON_SECRET`
in the Vercel Production environment before deploying; Vercel sends it as a bearer token.
The endpoint performs a small, uncached database read, returns `200 {"ok":true}` on success,
`401` without the correct secret (including when the variable is unset), and `503` when the DB
is unavailable. It never returns database rows. No new tables or migrations are needed.

After deployment, check the cron in Vercel Project → Settings → Cron Jobs and run it once;
verify the function log returns 200. Cron jobs run on Production only, so previews and local
development do not run the schedule. This and the bearer header follow the
[Vercel cron setup](https://vercel.com/docs/cron-jobs/quickstart) and
[cron management guide](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

## Group roster

On `/g/<slug>`, group admins can add a player by SteamID64, Steam profile URL or vanity name.
Steam fills the name and avatar; FACEIT is linked when available. Repeating an add is safe:
it refreshes the profile without changing an active member's role or fallback ELO. If FACEIT
is temporarily unavailable, adding still succeeds with a warning; repeat the add to retry.
Closed memberships stay closed; a membership-reopening policy is outside M1-3.

Fallback ELO is an optional integer from 100 to 5000, scoped to the group and used only when
FACEIT ELO is missing. Clearing the field removes it. Remove closes membership without deleting
history; the existing last-admin protection still applies. The first Steam login claims the
same player identity, preserving group membership. Guests see the roster without edit controls.

UI is built from the VGUI primitives in `components/vgui/` (Tailwind v4, rules in `DESIGN.md`).

## Stack

Next.js (TypeScript) on Vercel · Supabase (Postgres + Realtime) · Steam OpenID login ·
`demoparser2` (WASM, parsed in the browser) · FACEIT Data API · Leetify Public API.
Everything on free tiers.
