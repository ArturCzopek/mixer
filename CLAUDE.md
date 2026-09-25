# mixer: project notes for Claude

CS2 10-man mix organizer for a ~15-person friend group; multi-group data model (groups, group admins, D18). Owner talks in Polish; **UI, code and docs are in English**.

**Work plan: `docs/07-roadmap.md`.** Owner actions and the next-session starting point: `TODO.md` (keep it updated). Pick the next unblocked task by ID, meet its "Done when", tick it off in the roadmap in the same PR.
Read `docs/` before making design changes. The decision log (`docs/08-decisions.md`) explains the constraints.

## Hard constraints

- Free tiers only (Vercel Hobby + Supabase free). Keep the daily keep-alive cron.
- **Leetify API data must never be stored, recalculated or renamed**, and must show "Data Provided by Leetify". Display only.
- Balancing uses FACEIT data (ELO + 30-day form rating, not K/D) + our own mix stats (`docs/04-team-balancing.md`).
- One database (Supabase Postgres); document-style data goes in `jsonb` (`match_payloads`), no second DB.
- Demos are never uploaded to our server: parse in the browser, send stats JSON only.
- Mixes are played on a private FACEIT Club queue (D17): no map veto in the app; stats come from the FACEIT API; demos are an optional manual extra.
- All DB writes go through server code with the service role; browsers only read realtime tables.

## Commands
`npm run dev` · `npm test` · `npm run lint` · `npm run typecheck` · `npm run format:check` · `npm run build`. Run all before pushing (CI runs the same).

## Conventions
- Next.js 16 App Router: check `node_modules/next/dist/docs/` before using APIs you're unsure of (see @AGENTS.md).
- Look: 2003 Steam / CS 1.6 **olive VGUI** (roadmap UI-0). Rules in `DESIGN.md`, product context in `PRODUCT.md`; build screens from `components/vgui/` (bevel, well, tabs, SkillBar), preview at `/design/mix`.
- UI: Tailwind v4 + shadcn/ui (`components/ui/`, `cn()` from `@/lib/utils`). Add components with `npm run ui:add -- <names>` (`ui.shadcn.com` is blocked in the cloud sandbox; the script pulls from GitHub).
- Push straight to `main` (no PRs needed). Keep CI green.

- `lib/balance` and `lib/demo` are pure TS with unit tests; keep them free of I/O.
- SteamID64 is always a `string`.
- Our rating is called **Mixer Rating**, never "HLTV rating".
