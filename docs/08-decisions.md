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

## D8. Demo source: Valve Private MM first (Path A), own server optional (Path B), Superseded by D17
*Update 2026-09-24:* within Path A we record POV ourselves (A2); downloading from the client (A1) is not assumed.
We keep queueing on Valve servers (free, no setup). POV recording is the guaranteed fallback.
DatHost + MatchZy remains an option if forgetting to record or POV accuracy becomes a problem.

## D9. No map veto in the app, Accepted (reason updated by D17)
With FACEIT the Club queue runs the map veto. (Original reason: in Private Matchmaking the map is chosen in-game (after the recent CS2 update the client picks from
the remaining pool). A veto in the app would not be binding.)

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

## D14. One recorder, optional backup, Superseded by D17
One POV recording is enough. The backup only protects against the recorder crashing or reconnecting
(recording stops). No private-match demo download is assumed.

## D15. Pair rule only for a clear duo, Accepted
Owner feedback (2026-09-24): splitting "best with 2nd best" and "worst with 2nd worst" is not a
general rule. It applies only when two players clearly stand out: within 100 of each other and at
least 200 away from the next player (S, ELO points). Middle-pair penalties were removed. See
[team balancing](04-team-balancing.md#4-pairing-rules).

## D16. FACEIT match rating instead of K/D for FACEIT form, Accepted
K/D ignores damage and impact. F uses a per-match rating in the Mixer Rating 2 shape built from
FACEIT stats (KAST fixed), compared with the player's own older matches.

## D17. Mixes are played on a private FACEIT Club queue, Accepted (2026-09-24)
Everyone has FACEIT; it brings anti-cheat, map veto and a demo + stats API for every match.
- **Stats:** FACEIT Data API per map (`/matches/{id}/stats`) is the primary source. No recorder.
- **Demos:** optional extra; the owner downloads them from the match room and uploads manually
  (parsed in the browser, never stored on our server). Automatic download (Downloads API) not needed.
- **Teams:** our app balances + the group votes; in the FACEIT lobby the captains pick exactly the
  voted lineup (group agreement). The app warns if FACEIT teams differ. In-app captain draft later (M4-5).
- Still to verify in S5: club matches vs main FACEIT ELO (matters for form F: exclude club matches
  from F if they show up in history), and club match stats via the Data API.
See [demo pipeline](05-demo-pipeline.md#path-c-faceit-club-queue-chosen-d17).

## D18. Several groups in one app, Accepted (2026-09-24)
Built for our group first, but other friend groups may use it. Modelled now, while the tables are
empty, instead of retrofitting `group_id` later.
- `groups` (name, slug, FACEIT Club link, Discord server) and `group_members` (`admin` / `member`).
  Mixes belong to a group; only **active** members of that group can join (DB-enforced).
- A player is one Steam identity across groups. `players.is_site_admin` is the platform admin;
  group roles are checked per request in server code (not stored in the session cookie).
- Membership is closed (`left_at`), never deleted, so history keeps resolving. The fallback ELO
  (`manual_skill_override`) is per group.
- Everything stays publicly readable (D2). Private groups would need per-player Supabase JWTs or
  server-proxied realtime: not planned.

## D19. Discord: one site-wide bot, per-group server link, REST-only voice moves, Accepted (2026-09-24)
Owner wants players moved to team voice channels when a match starts and back to the lobby when it
ends. Discord's REST API can move a member who is already in voice (`PATCH /guilds/{guild}/members/{user}`
with `channel_id`, permission Move Members), so no always-on gateway process is needed (fits D1).
Players link their Discord account once (OAuth2 `identify`). Triggers: admin buttons always;
automatic via FACEIT webhooks only if club match events are available (spike S6).

## D20. FACEIT Data API terms, Accepted with a caveat (2026-09-24)
The FACEIT developer terms page (docs.faceit.com) is not reachable from the sandbox; web search found
no clause against storing data. Known limits: 20 requests/s per key (response headers, S3) and a
reported 10 000 requests/hour (429 until the next full hour). What we store is small and derived:
the ELO/form snapshot at balancing time and per-map stats of our own mixes, fetched by a server key
that only reads public data. Short caches (minutes) for everything else. If FACEIT terms or FACEIT
support object, we can drop stored FACEIT stats and keep only our own results (manual fallback, M2-3).

## D21. FACEIT is the preferred source, never a requirement, Accepted (2026-09-24)
Owner: mixes of a group should ideally be played on that group's FACEIT Club and synced from it,
but a group may have no FACEIT Club, and a mix may have no FACEIT room or no data at all.
- `groups.faceit_club_url` is optional (asked for at group creation, can be added later).
- Every mix can get a **manual result** (maps + scores); player stats per map are optional and can
  come from a FACEIT import or a manually uploaded demo (M4-6), in any order.
- Balancing does not depend on it: E falls back to `group_members.manual_skill_override`, F is 0
  without FACEIT history, M uses only maps that have player stats.
- Seed data for our own group (`db/seed/roster.json`) is just the first group, loaded in M1-G.

## D22. Balancing is explainable, weights configurable per group later, Accepted (2026-09-25)
Owner: the algorithm is a first version; players must see how each variant was calculated, and the
weight of each factor should be adjustable later, ideally per group.
- Now (M1-4b, M1-6): the engine returns the full reasoning (E source, F window vs baseline, shrinkage,
  clamping, M, cost split per rule) and the variant page shows it to everyone. `skill_snapshot` and
  `mixes.balance_config` keep it reproducible.
- `BalanceConfig.weights` (`elo`, `faceitForm`, `mixForm`, default 1): `S = wE·E + wF·F + wM·M`.
- Later (M4-7): `groups.balance_config` overrides site defaults; mixes copy the resolved config.

## D23. Roles for mixes and demos, Accepted (2026-09-25)
- Group admins (and the site admin) create and manage mixes of their group.
- Any active group member can upload a demo for a mix of that group (parsed in their browser, D6);
  group admins can delete uploads. Earlier notes saying "the owner uploads" mean "a member uploads".

## D24. Form weighs more than mix form, and asymmetrically by strength, Accepted (2026-09-25)
Owner: mix form M gets the smallest weight, recent FACEIT form F more; a strong player in form gets
little extra ELO but a slump costs more, and a weaker player with even average-plus form gets extra
ELO (holding your own among stronger players is a lot), with a smaller penalty for a slump.
- Defaults `weights = { elo: 1, faceitForm: 1, mixForm: 0.5 }`.
- `F` is scaled by `1 ∓ a·p` where `p` is the player's ELO position in tonight's lobby (−1 … +1),
  `a = form.asymmetry = 0.5` (docs/04 §1). Implemented in M1-4b, shown in the explanation panel.
- Form uses our own FACEIT match rating, **not Leetify**: Leetify data must never be stored or
  recalculated (hard constraint), and FACEIT per-match stats are already fetched (M1-2).

## D25. Popflash history is test data only, Accepted (2026-09-25)
The group's popflash matches (Oct–Dec 2024) are used only as test fixtures (`lib/balance/__fixtures__/`)
for the balancing backtest (T-1, T-2). They are never imported into the dev or prod database. The
players themselves may be members of the group; their old match history is not.
