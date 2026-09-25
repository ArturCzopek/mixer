# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Players** in a friend group (~15 people for the first group, "Skarpeciarze i pantofle") who play
  CS2 10-man mixes together. Mostly on a **phone during the day**: sign up for tonight's mix, vote
  for a lineup, check results and stats away from the PC.
- **Group admins**: create and run mixes (add/remove players, publish variants, lock the lineup,
  enter results). Same people as players, with more buttons.
- **Guests**: anyone with a link sees everything read-only (the site is public).

Several groups can use one instance (D18); each has its own admins, members and mixes.

## Product Purpose

Turn "who's playing tonight and how do we split teams" into a fair, fast, transparent ritual:
players join a mix (hard cap 10), the app proposes 3 balanced 5v5 variants, everyone votes, the
lineup locks, and after the match the results and stats land on the mix page and player profiles.
Success = teams feel fair, nobody argues about the split, and people come back to look at stats.

## Positioning

A private tool for one friend group's own mixes, not a public matchmaking service. Balancing
explains itself: every variant shows exactly how each player's skill score was computed (FACEIT
ELO, recent FACEIT form, form in our own mixes) so the split is trusted, not argued about.

## Operating Context

- Mixes are played on the group's private FACEIT Club queue (preferred) or anywhere with manual
  results (FACEIT is optional, D21). Voice comms on the group's Discord (bot moves players later, D19).
- Rhythm: a mix evening every week or two; sign-ups and voting happen during the day on phones,
  results and stat-browsing after the match.
- History: the group's older matches on popflash.site (Oct–Dec 2024) are used as backtest data.

## Capabilities and Constraints

- Roles: site admin, group admin, member, guest (docs/01-product-spec.md). Login with Steam only;
  the FACEIT account is linked automatically from the SteamID.
- Mix states: `open → balancing → voting → locked → played / cancelled`; realtime lobby and votes.
- Terminology: **mix** (an evening, one or more maps), **variant** (a proposed 5v5 split),
  **Mixer Rating** (our rating; never call it "HLTV rating").
- Leetify data is display-only and must show "Data Provided by Leetify".
- Free tiers only (Vercel Hobby, Supabase free). UI copy in English.

## Brand Commitments

- Name "mixer" is a working name; no logo, colors or visual assets exist yet (free hand).
- Voice: relaxed, in-group humor in the spirit of the group's name ("Skarpeciarze i pantofle",
  roughly "sock guys and slippers"), but data and actions stay unambiguous.

## Evidence on Hand

- Real roster: 12 SteamIDs (`db/seed/roster.json`) with recorded Steam/FACEIT data in
  `lib/external/__fixtures__/` (names, avatars, ELO 938–2189, levels 4–10).
- 71 real past maps with lineups and per-player stats on popflash (mapping in
  `lib/balance/__fixtures__/popflash/players.json`).
- No testimonials, logos or marketing claims; do not invent them.

## Product Principles

1. **Fairness you can see.** Every number that decides a team is inspectable by every player.
2. **Phone first, one thumb.** Joining and voting take seconds on a phone.
3. **Never assume FACEIT.** A mix with only a typed-in score is a first-class mix.
4. **Our crew, our jokes.** Personality lives in copy and small moments, never at the cost of clarity.
