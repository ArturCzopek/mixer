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
npm install
cp .env.example .env.local   # fill in keys (see comments in the file)
npm run dev                  # http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm test` | Unit tests (Vitest, `lib/**/*.test.ts`) |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate Next route types + `tsc` |
| `npm run format` | Prettier (write) |

CI runs format check, lint, typecheck, tests and build on every PR.

UI is built from the VGUI primitives in `components/vgui/` (Tailwind v4, rules in `DESIGN.md`).

## Stack

Next.js (TypeScript) on Vercel · Supabase (Postgres + Realtime) · Steam OpenID login ·
`demoparser2` (WASM, parsed in the browser) · FACEIT Data API · Leetify Public API.
Everything on free tiers.
