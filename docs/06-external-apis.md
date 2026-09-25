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
| Lifetime stats (baseline) | `GET /players/{player_id}/stats/cs2` |

### Spike S3 findings (2026-09-24)

Recorded by `scripts/faceit-spike.mjs` via the manual **API spike** GitHub workflow (the cloud sandbox
cannot reach `open.faceit.com`: Cloudflare answers with a bot challenge; FACEIT docs are blocked too).
Fixtures: `lib/external/__fixtures__/faceit/{players,history,games-stats,lifetime,matches}/`, report with
all statuses, headers and field paths: `lib/external/__fixtures__/spike-report.json`.

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
the lobby / variant, profile header) with Leetify's own `ranks` (Premier, FACEIT), `rating` (aim,
positioning, utility, clutch, opening) and `winrate`, exactly as named and scaled by Leetify, with the
"Data Provided by Leetify" logo. Fetched by a server route with a 5–10 min HTTP cache, never written to
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

## Discord (Phase 5, D19)

One site-wide bot. Env: `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`.

| Purpose | Endpoint |
|---|---|
| Link a player | OAuth2 `identify` → `GET https://discord.com/api/users/@me` → `players.discord_user_id` |
| Add bot to a group's server | `https://discord.com/oauth2/authorize?client_id=…&scope=bot&permissions=…` (Move Members + Send Messages) |
| List voice channels | `GET /guilds/{guild_id}/channels` (type 2 = voice) |
| Move a player | `PATCH /guilds/{guild_id}/members/{user_id}` `{ "channel_id": "…" }` (only if already in voice) |
| Post a message | `POST /channels/{channel_id}/messages` |

## Caching

| Data | TTL |
|---|---|
| Steam names / avatars | 24 h (stored in `players`, refreshed on login and daily) |
| FACEIT ELO / form | 10 min cache; snapshot stored when teams are generated |
| Leetify profile / matches | 5–10 min HTTP cache only, never persisted |
