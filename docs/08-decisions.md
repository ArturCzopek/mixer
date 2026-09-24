# Decision log

Short records of *why*. Newest at the bottom. Status: Accepted / Proposed / Superseded.

## D1. Hosted on free tiers (Vercel + Supabase), not self-hosted, Accepted
~10 mixes/year and ~15 users. Paying for or maintaining a server is not justified.
Consequence: design around free-tier limits (inactivity pause, 4.5 MB request bodies). See [architecture](02-architecture.md#free-tier-constraints-to-design-around).

## D2. Steam OpenID + own session cookie; writes via server, public realtime reads, Accepted
Steam has no OAuth2 for third parties. Instead of bridging Steam identities into Supabase Auth,
the server owns all writes (service role) and checks permissions in TypeScript. Browsers only
*read* realtime tables through RLS `select` policies. Simpler, one place for authorization.

## D3. Realtime: Supabase Realtime, not Kafka, Accepted
Kafka was considered for live voting. Rejected because:
- Kafka is a server-to-server log. Browsers cannot talk to it directly, so we would still need a
  WebSocket layer in front of it.
- It needs an always-on broker (JVM/containers), which conflicts with free, serverless hosting and "nothing to maintain".
- Our load is ~10 people clicking a few times. A database with change notifications is enough.

Supabase Realtime streams Postgres changes over WebSockets and is already part of our DB.

## D4. Balancing on FACEIT ELO + FACEIT form + mix form, Accepted
Group preference: FACEIT ELO reflects skill better than Premier. Recent form adjusts it, and
performance in our own mixes matters most once we have data. All in ELO units for readability. See [team balancing](04-team-balancing.md).

## D5. Leetify for display only, Accepted
Leetify API terms: no storing, no recalculating, no renaming metrics, attribution required.
So Leetify cannot feed stored balancing snapshots or our rating. It powers the FACEIT/Premier tabs on profiles, live.

## D6. Our own demo parsing instead of uploading demos to Leetify, Accepted
Leetify manual uploads are Pro-only, visible only to the uploader, not counted in profiles, and
there is no public upload API. Parsing ourselves with demoparser2 gives the whole group shared stats.

## D7. Parse demos in the browser (WASM), Proposed (pending spike S4)
Avoids upload size limits and storage costs; only ~50 KB of stats reach the server.
Fallback: Python CLI with the same output format.

## D8. Demo source: Valve Private MM first (Path A), own server optional (Path B), Accepted
*Update 2026-09-24:* within Path A we record POV ourselves (A2); downloading from the client (A1) is not assumed.
We keep queueing on Valve servers (free, no setup). POV recording is the guaranteed fallback.
DatHost + MatchZy remains an option if forgetting to record or POV accuracy becomes a problem.

## D9. No map veto, Accepted
In Private Matchmaking the map is chosen in-game (after the recent CS2 update the client picks from
the remaining pool). A veto in the app would not be binding.

## D10. English UI, Polish conversation, Accepted
UI text and code in English.

## D11. "Mixer Rating" instead of "HLTV rating", Accepted
HLTV published the *structure* of Rating 3.0 (six sub-ratings incl. Round Swing and eco adjustment),
but not the exact weights or their win-probability model. v1 uses a known approximation of Rating 2.0 (Mixer Rating 2),
and v2 follows the 3.0 structure with our own simplified models (Mixer Rating 3). The name is our own to
avoid implying it is the official number.

## D12. Mix analysis data: Postgres with jsonb, not a separate document DB, Accepted
Considered: a document database (e.g. MongoDB) for parsed matches. Rejected because:
- Our data is relational at the core: players ↔ mixes ↔ matches ↔ stats. Profiles and leaderboards are joins and aggregates, which SQL does well.
- Postgres `jsonb` gives the document part anyway: the full parser output lives in `match_payloads.payload`, is queryable, and needs no schema migration when we add fields.
- A second database means a second free tier to keep alive, a second connection and no joins across them.

## D13. FACEIT form over the last 30 days, not the last N matches, Accepted
Players play very different volumes. A time window reflects "current form" consistently. Shrinkage
toward baseline handles players with few matches. See [team balancing](04-team-balancing.md#f-recent-faceit-form).

## D14. One recorder, optional backup, Accepted
One POV recording is enough. The backup only protects against the recorder crashing or reconnecting
(recording stops). No private-match demo download is assumed.
