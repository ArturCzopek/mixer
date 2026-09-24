# mixer: project notes for Claude

CS2 10-man mix organizer for a ~15-person friend group. Owner talks in Polish; **UI, code and docs are in English**.

Read `docs/` before making design changes. The decision log (`docs/08-decisions.md`) explains the constraints.

## Hard constraints
- Free tiers only (Vercel Hobby + Supabase free). Keep the daily keep-alive cron.
- **Leetify API data must never be stored, recalculated or renamed**, and must show "Data Provided by Leetify". Display only.
- Balancing uses FACEIT data (ELO + 30-day form) + our own mix stats (`docs/04-team-balancing.md`).
- One database (Supabase Postgres); document-style data goes in `jsonb` (`match_payloads`), no second DB.
- Demos are never uploaded to our server: parse in the browser, send stats JSON only.
- No map veto (played on Valve Private Matchmaking).
- All DB writes go through server code with the service role; browsers only read realtime tables.

## Conventions
- `lib/balance` and `lib/demo` are pure TS with unit tests; keep them free of I/O.
- SteamID64 is always a `string`.
- Our rating is called **Mixer Rating**, never "HLTV rating".
