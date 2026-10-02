# External APIs

All calls run server-side. Keys live in env vars and are never exposed to the browser.

## Steam

| Purpose | Endpoint |
|---|---|
| Login | OpenID 2.0: `https://steamcommunity.com/openid/login` (verify with `openid.mode=check_authentication`) |
| Name / avatar | `GET https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=…&steamids=…` (up to 100 IDs per call) |
| Vanity URL → SteamID64 | `GET https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=…&vanityurl=…` |

Key: https://steamcommunity.com/dev/apikey

## FACEIT Data API v4: balancing source

Base URL `https://open.faceit.com/data/v4`, header `Authorization: Bearer <FACEIT_API_KEY>`
(server-side key from https://developers.faceit.com).

| Purpose | Endpoint |
|---|---|
| SteamID → FACEIT player | `GET /players?game=cs2&game_player_id={steam64}` |
| ELO + level | `GET /players/{player_id}` → `games.cs2.faceit_elo`, `games.cs2.skill_level` |
| Matches in the last 30 days | `GET /players/{player_id}/history?game=cs2&from={unix now−30d}&to={unix now}&limit=100` |
| Per-match stats (form) | `GET /players/{player_id}/games/cs2/stats?limit=100`, filtered to the 30-day window (or `/matches/{match_id}/stats` per match) |
| Lifetime stats (not used by the client or balancing) | `GET /players/{player_id}/stats/cs2` |

### Spike S3 findings (2026-09-24)

Recorded by `scripts/faceit-spike.mjs` via the manual **API spike** GitHub workflow (the cloud sandbox
cannot reach `open.faceit.com`: Cloudflare answers with a bot challenge; FACEIT docs are blocked too).
Fixtures: `lib/external/__fixtures__/faceit/{players,games-stats,matches}/`, report with
all statuses, headers and field paths: `lib/external/__fixtures__/spike-report.json`.

The `history/` and `lifetime/` recordings (12 players each) were removed on 2026-09-26: no test or
client reads them. To get them back, restore the last recording from git:
`git checkout ebe9ecc -- lib/external/__fixtures__/faceit/history lib/external/__fixtures__/faceit/lifetime`,
or re-run the **API spike** workflow, which records fresh copies and commits them.

- **All 12 roster SteamIDs have a FACEIT CS2 account** (ELO 938–2189, levels 4–10).
- **Stat values are strings** (`"104.2"`, `"18"`); parse with Zod `z.coerce.number()`. Only
  `Match Finished At` (games stats) and `started_at`/`finished_at` (history, match) are numbers.
- **Rate limit:** `RateLimit-Limit: 20, 20;w=1` → **20 requests per second** per key (header name
  `gateway-open-faceit-ratelimit`). No hourly quota was visible in headers; a 10 000/hour limit
  (429 until the next full hour) is reported by FACEIT's developer forum (D20). A balancing run for 10
  players is ~30 calls, so no batching tricks are needed; keep a 10 min cache anyway.
- **Time units differ:** `/history` takes `from`/`to` in **seconds**; `/games/cs2/stats` takes
  `from`/`to` in **milliseconds** (seconds silently return 0 items). Both paginate with `offset` +
  `limit` (max 100); `offset=100` works on both.

| Need | Endpoint → field |
|---|---|
| FACEIT player from SteamID | `GET /players?game=cs2&game_player_id={steam64}` → `player_id`, `nickname`, `avatar`, `faceit_url` (`{lang}` placeholder), `games.cs2.faceit_elo`, `games.cs2.skill_level`, `steam_id_64` |
| ELO + level | same response (no second call needed) |
| Per-match stats for form F | `GET /players/{id}/games/cs2/stats?from={ms}&to={ms}&limit=100` → `items[].stats`: `Kills`, `Deaths`, `Assists`, `ADR`, `Damage`, `Rounds`, `Result` (`"1"`/`"0"`), `Map`, `Match Id`, `Competition Id`, `Game Mode`, `Match Finished At` (ms), `Headshots %`, `K/D Ratio`, multi-kills. **No KAST** (hence `ASSUMED_KAST`). One item per map |
| Match list in a window | `GET /players/{id}/history?game=cs2&from={s}&to={s}&limit=100` → `items[]`: `match_id`, `competition_type` (`matchmaking`…), `competition_name` (`Europe 5v5 Queue`), `competition_id`, `finished_at`, `results`, both teams' players with `game_player_id` (SteamID64) |
| Lifetime baseline | `GET /players/{id}/stats/cs2` → `lifetime` (`Matches`, `Win Rate %`, `ADR`, `Average K/D Ratio`, `Entry Rate`, utility/flash/1vX rates, `Recent Results`) and per-map `segments[]` |
| Match room (M2-2) | `GET /matches/{id}` → `teams.faction{1,2}.roster[]` (`player_id`, `game_player_id` = SteamID64), `results`, `detailed_results[]`, `best_of`, `demo_url[]`, `competition_*`, `calculate_elo`, `status` (`FINISHED`) |
| Match stats per map (M2-2) | `GET /matches/{id}/stats` → `rounds[]` (one per map): `round_stats` (`Map`, `Score`, `Rounds`, `Winner`), `teams[].team_stats` (`Final Score`, halves, `Team Win`), `teams[].players[].player_stats`: `Kills`, `Deaths`, `Assists`, `ADR`, `Damage`, `Headshots`, `First Kills`, `Entry Count`/`Entry Wins`, `1v1Count`/`1v1Wins`, `1v2Count`/`1v2Wins`, `Clutch Kills`, `Utility Damage`, `Enemies Flashed`, `Flash Count`/`Flash Successes`, `Sniper Kills`, multi-kills, `MVPs`. No KAST, no trades, no rounds played per player (use the map's `Rounds`) |

Notes for the client (M1-2) and form F:
- Filter F to `Game Mode = 5v5` and, once the Club exists, exclude the Club's `Competition Id`
  (all 30-day history matches of the roster today are `matchmaking` / `Europe 5v5 Queue`).
- Some old items (2023–early 2024, 24 of 1 168 recorded) have **no `ADR`/`Damage`**: skip them in F.
- 30-day match counts vary a lot (2 to 52): shrinkage (k = 10) matters; one player has only 68
  matches in total, below a 100-item page.
- **Terms on storing:** the FACEIT developer terms page could not be read from the sandbox
  (docs.faceit.com blocked). We store only derived numbers (ELO, form, per-map stats of our own
  mixes), not bulk FACEIT data; owner to confirm in the Developer Portal (TODO.md).

### Mix evenings: several rooms per mix (D27)

- Each map of a Club evening is its own room (`best_of = 1`). The app lists candidate rooms (Club
  match list, or the participants' `/history` since the lock), filters them (≥ 8 of 10 participants,
  within 6 h, after `locked_at`) and imports the ones the admin confirms: `/matches/{id}` +
  `/matches/{id}/stats` per room. Full rules: [demo pipeline](05-demo-pipeline.md#assembling-a-mix-evening-d27-m2-2).
- `demo_url[]` in `/matches/{id}` points at `https://demos-europe-central.backblaze.faceit-cdn.net/cs2/{match_id}-1-1.dem.zst`
  (zstd). The server never downloads it; the browser shows it as a link (D27). Signed URLs need the
  Downloads API (not requested).
- Stats used for match awards (M2-8) all come from `/matches/{id}/stats` (`Kills`, `Deaths`,
  `Assists`, `ADR`, `Headshots %`, `First Kills`, `Entry Count`/`Entry Wins`, `1v1`/`1v2` counts and
  wins, `Utility Damage`, `Enemies Flashed`, `Flash Count`/`Flash Successes`, `Sniper Kills`,
  multi-kills, `MVPs`). We store them per map in `match_player_stats` (our own mixes only, D20).

Why FACEIT directly and not via Leetify: Leetify's terms forbid storing or recalculating their data
(see below). A balancing snapshot is exactly that.

## Leetify Public API: display only

- Docs: https://api-public-docs.cs-prod.leetify.com/ · Base URL `https://api-public.cs-prod.leetify.com`
- Header **`_leetify_key: <LEETIFY_API_KEY>`**. Key: https://leetify.com/app/developer
  (S3, 2026-09-24: our key validates with `_leetify_key` (200) but `Authorization: Bearer` returns 401.)
- Validate key: `GET /api-key/validate`

| Endpoint | Returns |
|---|---|
| `GET /v3/profile?steam64_id=…` | `ranks` (leetify, premier, faceit, faceit_elo, wingman, renown, competitive[]), `rating` (aim, positioning, utility, clutch, opening, ct_leetify, t_leetify), `stats`, `recent_matches[]` (with `data_source`, `outcome`, `map_name`, `leetify_rating`…), `recent_teammates`, `winrate`, `total_matches`, `privacy_mode` |
| `GET /v3/profile/matches?steam64_id=…` | Match history: `data_source`, `map_name`, `team_scores`, per-player `stats` (K/D, ADR data, trades, flashes, multikills, leetify_rating…) |
| `GET /v2/matches/{gameId}` | Single match details |
| `GET /v2/matches/{dataSource}/{dataSourceId}` | Match by source ID (e.g. `faceit`, `matchmaking`) |

We use it for the profile tabs **FACEIT** and **Premier**, by filtering match history on `data_source`,
and for the **Leetify preview** (M3-2): a small card fetched live when someone opens a player (tap in
the lobby / variant, profile header). Owner (2026-09-25): **FACEIT matches of the last 30 days only**
(`/v3/profile/matches`, `data_source = "faceit"`, `finished_at` within 30 days): per match the date,
map, score and the player's **Leetify Rating** exactly as Leetify shows it, plus the count of matches
and wins. No profile-wide numbers (aim, positioning…) and no averages or other scores computed from
Leetify data (their terms forbid recalculating). With the "Data Provided by Leetify" logo. Fetched by a server route with `cache: "no-store"`, never written to
the database, never an input to balancing. `privacy_mode` on → the card says the profile is private.

### Leetify developer guidelines: hard rules for us

From https://leetify.com/blog/leetify-api-developer-guidelines/:
1. Show the **"Data Provided by Leetify"** logo (linking to https://leetify.com/) on every page that shows Leetify data.
   Never imply the app is affiliated with or endorsed by Leetify. Do not use "Leetify" in the app name.
2. **Do not modify metrics**: same names, same scales, same display format (Aim is "Aim: 95", not "95%").
   No recalculated scores.
3. **Do not store data** from the API: fetch at request time. Short-lived HTTP caching (minutes) is fine;
   no database tables for Leetify data.

Consequences for the design:
- Leetify numbers are never an input to our stored `skill_snapshot` and never mixed with our Mixer Rating.
- Profile "FACEIT" and "Premier" tabs render Leetify data as-is in a clearly labelled section.
- Our own mix stats use our own metric names (Mixer Rating, ADR, KAST…) and never reuse Leetify metric names for different calculations.

## FACEIT live match signals (S6 desk research, 2026-10-02)

This is documentation research plus read-only API checks, not a live match verification. The owner has linked a Club to a Mixer group but has not played a match in its queue yet. Sources: [FACEIT webhook events](https://docs.faceit.com/docs/webhooks/), [Data API v4](https://docs.faceit.com/docs/data-api/data/), [match lifecycle](https://game-docs.faceit.com/match-lifecycle/match-lifecycle-events/), and [CS2 captain / knife round](https://support.faceit.com/hc/en-us/articles/10014497052444-What-to-do-as-a-team-captain-in-a-CS2-lobby).

| Desired signal | Published capability | Decision for Mixer |
|---|---|---|
| Room created / server ready | App Studio exposes `match_object_created`, `match_status_configuring`, and `match_status_ready` webhooks for Organizer, User, and Game subscriptions. `ready` means the game server is ready, not that the knife round has ended. | Can announce a room or ask players to join; never use `ready` to move them after the knife round. Club delivery and payload still need a live test. |
| Knife round ended / live play began | The published webhook event list has no knife-round, round-end, side-choice, or `match_status_ongoing` event. The game-integration docs distinguish `Match Ready` from `Match Started`, but those server-to-server game events are not App Studio webhooks available to this app. Polling a match's `ONGOING` status has an unverified relation to the knife round and first live round. | No reliable FACEIT-only trigger for voice moves exactly after the knife round. Keep an admin "Move teams" button; do not infer the moment from a timer, `ready`, or `ONGOING` until measured. |
| Match finished | App Studio lists `match_status_finished` (also aborted and cancelled). `/matches/{id}` includes `status`, `finished_at`, result, room teams and IDs; `/matches/{id}/stats` returns match stats. | Automatic return to the Discord lobby and a result notification are plausible after a verified Club webhook, with an idempotent handler and a manual fallback. Delivery latency, payload, and Club coverage remain unmeasured. |
| Find live Club matches | Data API documents `/hubs/{hub_id}/matches?type=ongoing` and `/matches/{id}`. The linked Club URL ID returned HTTP 200 from that hub endpoint for both `ongoing` and `past` (empty lists, as no Club queue match has been played). `search/clans` returned the same Club ID and its separate `organizer_id`. | The existing candidate finder can use this Club ID with the documented hub endpoint. Confirm actual Club match appearance and timestamps during the first queue match. Player history is a completed-match fallback, not a proven live feed. |
| Live round score | Match-detail schema has generic status/start/result fields but no documented round number, knife result, or guaranteed in-progress score. Match stats schema does not promise live updates. | Treat live round score as unavailable until measured against a running Club match. |

Read-only check on 2026-10-02: linked Club `44ba2a59-0d90-4087-8d6c-0ebae2d3e47a` returned HTTP 200 and zero items from `/hubs/{id}/matches?type=ongoing` and `type=past`; `search/clans?name=skarpeciarze&game=cs2` returned that Club ID with `organizer_id=e881bc29-4d6a-43de-af4d-4a6994130c2d`. No match payload was available to inspect. App Studio permits Organizer subscriptions for a static list of other organizer GUIDs, with some private fields possibly hidden; it does not explicitly state that a Club's internal queue generates those events for the Club's organizer ID. An App Studio owner must subscribe to that organizer and record one callback from a real match. The webhook configuration supports a custom authentication header. The public documentation does not give a delivery latency or retry guarantee for these events.

**Field test to finish S6:** (1) play one match in the linked Club queue; record match ID and `competition_id`; (2) subscribe to room-created, ready, finished, aborted and cancelled events for the recorded organizer ID and capture redacted timestamps/payload keys; (3) query the Club's hub match list and `/matches/{id}` before ready, after the knife round and at finish; (4) compare FACEIT room teams to the voted lineup and verify Discord move/return from a deployed function. Never log API keys, webhook secrets or player tokens.

Discord messages for **our own** mix creation and lineup lock can be sent from Mixer actions independently of FACEIT. Only FACEIT room/score/result notifications depend on the field test.

## Discord (Phase 5, D19)

One site-wide bot. Env: `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`.

| Purpose | Endpoint |
|---|---|
| Link a player | OAuth2 `identify` → `GET https://discord.com/api/users/@me` → `players.discord_user_id` |
| Add bot to a group's server | OAuth2 code grant with `bot guilds`, state cookie, and bot permissions View Channel + Send Messages + Move Members; callback checks the user's Manage Server permission and bot membership before saving the guild id |
| List voice channels | `GET /guilds/{guild_id}/channels` (type 2 = voice) |
| Move a player | `PATCH /guilds/{guild_id}/members/{user_id}` `{ "channel_id": "…" }` (only if already in voice) |
| Post a message | `POST /channels/{channel_id}/messages` |

## Caching

| Data | TTL |
|---|---|
| Steam names / avatars | 1 h fetch cache; stored in `players` and refreshed on login (no daily refresh job yet) |
| FACEIT ELO / form | 10 min fetch cache; per-mix snapshot storage is planned |
| Leetify profile / matches | No fetch cache (`no-store`); never persisted |
