# Group statistics

- Route: `/g/[slug]/stats`.
- Mode: Operate / Read; inspect the group's own played mixes after an evening.
- Direction: extend the existing olive VGUI world in DESIGN.md. One shared window,
  compact native filters, tabular numbers, underlined profile links and horizontally
  scrollable tables on phones. No replacement visual identity.
- Owner scope: full sortable player leaderboard, per-map performance, teammate pairs
  and award totals, approved 2026-10-07. Data is stored group Mix history only.
- Priority: player table first; map, pair and award detail follows with clear headings.
  Link from the group result summary rather than crowding the lobby/member view.
- Controls: period and archive scope are shareable GET filters; sorting preserves scope.
- Trust: show sample counts and ranking eligibility; missing data is absent, not zero.
  Score-only maps count outcomes when lineup is known. Weight ADR and Mixer Rating by
  their available rounds. Pair records describe shared same-team maps, not causation.
  Awards sum the existing capped per-evening engine output, not every threshold hit.
- Verify: empty recent scope, historical all-time data, alternate sort, EN/PL,
  desktop and 375 px layout, profile links and filter navigation.
