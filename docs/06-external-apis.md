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

→ **Spike S3**: confirm exact response fields for per-match K/D, ADR and result; whether the stats
endpoint accepts `from`/`to` directly; rate limits; and the FACEIT API terms on storing snapshots
(we store ELO and form per mix in `skill_snapshot`).

Why FACEIT directly and not via Leetify: Leetify's terms forbid storing or recalculating their data
(see below). A balancing snapshot is exactly that.

## Leetify Public API: display only

- Docs: https://api-public-docs.cs-prod.leetify.com/ · Base URL `https://api-public.cs-prod.leetify.com`
- Header `Authorization: Bearer <LEETIFY_API_KEY>` (or `_leetify_key`). Key: https://leetify.com/app/developer
- Validate key: `GET /api-key/validate`

| Endpoint | Returns |
|---|---|
| `GET /v3/profile?steam64_id=…` | `ranks` (leetify, premier, faceit, faceit_elo, wingman, renown, competitive[]), `rating` (aim, positioning, utility, clutch, opening, ct_leetify, t_leetify), `stats`, `recent_matches[]` (with `data_source`, `outcome`, `map_name`, `leetify_rating`…), `recent_teammates`, `winrate`, `total_matches`, `privacy_mode` |
| `GET /v3/profile/matches?steam64_id=…` | Match history: `data_source`, `map_name`, `team_scores`, per-player `stats` (K/D, ADR data, trades, flashes, multikills, leetify_rating…) |
| `GET /v2/matches/{gameId}` | Single match details |
| `GET /v2/matches/{dataSource}/{dataSourceId}` | Match by source ID (e.g. `faceit`, `matchmaking`) |

We use it for the profile tabs **FACEIT** and **Premier**, by filtering match history on `data_source`.

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

## Caching

| Data | TTL |
|---|---|
| Steam names / avatars | 24 h (stored in `players`, refreshed on login and daily) |
| FACEIT ELO / form | 10 min cache; snapshot stored when teams are generated |
| Leetify profile / matches | 5–10 min HTTP cache only, never persisted |
