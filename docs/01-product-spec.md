# Product spec

## Context

- A group of ~15 friends plays CS2 together. A few times a year (~10 mixes/year) we play a
  **10-man mix**: two teams of five, played on the group's private **FACEIT Club queue**
  (anti-cheat, map veto, stats API; D17). Captains pick the lineup voted in the app.
- Everyone has Leetify and most play FACEIT and Premier.
- Roles are not a constraint: one player is a dedicated AWP/IGL, everyone else plays rifles.
- Pain points today: splitting teams fairly takes long and feels arbitrary, and there is no record
  of how anyone performs *in the mixes themselves*: private matches do not show up on Leetify.

## Goals

1. Fair teams in under 2 minutes, with a transparent reason for why they are fair.
2. Everyone gets a say (voting), and nobody is blocked if they are not online (admin can act for them).
3. A persistent history of mix performance: per-match scoreboard, per-player profile, leaderboards.
4. Zero running cost.

## Non-goals

- Map veto / side pick (done by the FACEIT Club queue).
- Running or orchestrating game servers in v1 (considered as an optional later path, see
  [demo pipeline](05-demo-pipeline.md#path-b--own-server-dathost--matchzy)).
- Public product for other groups. It is built for one group; no multi-tenancy.

## Users & roles

| Role | Who | Can |
|---|---|---|
| **Admin** | Group owner + 1–2 trusted people (bootstrapped via `ADMIN_STEAM_IDS`) | Manage roster, create/close mixes, add/remove participants, cast/override on behalf of absent players, lock lineup, enter results, delete uploads |
| **Member** | Anyone on the roster who logged in with Steam | Join a mix, vote, upload demos, view everything |
| **Guest** | Anyone with the link, not logged in (or logged in but not on the roster) | Read-only view of mixes, match pages and profiles. The site is public. |

A roster player may exist **before** they ever log in (admin adds them by SteamID). Their first
Steam login claims that record automatically (matched on SteamID64).

## Features

### F1. Roster
- List of group players: Steam name, avatar, FACEIT nickname/level/ELO, preferred role (AWP / rifle).
- Admin adds a player by SteamID64, vanity URL, or profile link; the app resolves the name/avatar via Steam.
- FACEIT account linked automatically from SteamID (FACEIT API lookup); manual override possible.

### F2. Mix lobby
- Admin creates a mix (title, planned date/time).
- States: `open` → `balancing` → `voting` → `locked` → `played` (or `cancelled`).
- Members click **Join**; admin can add/remove anyone. **Hard cap of 10 participants, no waitlist.**
  When full, the Join button is disabled. The admin makes room by removing someone.
- Lobby updates in real time (who joined, who left).

### F3. Team balancing
- When 10 participants are in, admin clicks **Generate teams**.
- The app fetches fresh data and shows **3 variants**. Each variant shows:
  - both lineups, each player's skill score,
  - team averages, estimated win probability (e.g. 50.4% / 49.6%),
  - a note when a clear top or bottom duo (two players far from the rest) is split.
- Admin can re-roll (exclude shown variants) or tweak weights before publishing.
- Details: [team balancing](04-team-balancing.md).

### F4. Voting
- Only participants vote; one vote per player, changeable until voting closes.
- Live vote counts.
- Closes when **all 10 voted** or when **the admin closes it**. No time limit.
- Winner = most votes; tie → variant with the win probability closest to 50%; still tied → lower variant number.
- Admin can cast a vote on behalf of a participant (marked as "by admin").
- The chosen lineup is shown as a clean "Team A / Team B" card to share with the group.

### F5. Match result & demo upload
- After the match: enter the map + score manually (fallback), **or** upload the demo.
- Demo is parsed in the uploader's browser; only the extracted stats are sent to the server.
- The parsed player list is matched to participants by SteamID64; the app warns if players or teams do not match the locked lineup.
- One mix may have multiple maps (usually 1).

### F6. Match page (popflash-style scoreboard)
- Final score, per-half score, map.
- Per player: K / D / A, +/-, ADR, HS%, KAST, rating, entry kills/deaths, multikills (2k–5k),
  clutches (1vX won/attempted), utility damage, enemies flashed, flash assists, trade kills.
- Round timeline (who won each round, how: elimination / bomb / defuse / time).

### F7. Player profile
- Header: avatar, FACEIT level/ELO, number of mixes, mix win rate.
- **Source filter: Mix / FACEIT / Premier**
  - *Mix*: our own stats from demos (aggregates, trend chart of rating over mixes).
  - *FACEIT / Premier*: live data from external APIs, shown as-is with attribution (not stored, see [external APIs](06-external-apis.md)).
- Recent form, best maps, teammates they win most with.
- Compare two players side by side (later).

### F8. Leaderboards (later)
- Mix rating, ADR, K/D, win rate, clutches. Minimum N maps to qualify.

## User stories (MVP)

1. As an admin I add all group members to the roster by SteamID, so they show up before they log in.
2. As a member I log in with Steam and see my profile linked to the roster entry.
3. As an admin I create a mix; members join; I add the two who are not online.
4. As an admin I generate 3 balanced variants and publish them for voting.
5. As a participant I vote and see votes update live; the winning lineup is locked automatically.
6. As a participant I upload the demo after the match and everyone sees the scoreboard.
7. As a member I open my profile and see my mix stats over time.
