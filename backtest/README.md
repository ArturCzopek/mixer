# Balancing backtest (T-1)

A side module that replays the balancing engine (`lib/balance`) on the group's real past maps and
checks how well the skill score S predicts who wins. It is **not** part of the app: nothing here is
imported by `app/` or `lib/`, and the data are test fixtures only (D25).

```
npm run backtest        # → backtest/REPORT.md (full numbers, regenerated every run)
npm test                # includes backtest/backtest.test.ts (metrics, no-leak checks)
```

## Data

| What | Where | How it was recorded |
|---|---|---|
| 71 popflash maps of our club (Jan–Dec 2024): map, score, both lineups, per-player K/A/D/ADR/KAST/openings/trades/flashes… | `lib/balance/__fixtures__/popflash/matches.json` | `scripts/backtest-data.mjs popflash` via the manual **Backtest data** workflow (popflash embeds the match JSON in the page, parser in `scripts/popflash-parse.mjs`) |
| Popflash account → SteamID64 (second accounts merged) | `lib/balance/__fixtures__/popflash/players.json` | owner, from profile pages (2026-09-25) |
| Every popflash player's FACEIT ELO **today** and FACEIT match stats Sep 2023 – Jan 2025 | `lib/balance/__fixtures__/backtest/faceit/*.json` | `scripts/backtest-data.mjs faceit` (Data API, 2-month slices) |

The cloud sandbox cannot reach popflash.site or open.faceit.com, hence the workflow
(Actions → Backtest data → step `popflash` / `faceit`, or `probe` to save raw pages for debugging).

## Method

For every popflash map, in date order:

1. **Rebuild each player's inputs as of the map's start** (`inputAt`, nothing from that moment on
   leaks in):
   - **E** = FACEIT ELO today (owner's assumption: ELO then ≈ ELO now; see caveats).
   - **F** = the engine's form term from FACEIT 5v5 matches finished before the map.
   - **M** = the engine's mix form from the player's earlier popflash maps, each rated with
     Mixer Rating 2 using popflash's real KAST (72 % when popflash did not compute it). The group
     average is taken over all earlier popflash lines.
   - **A** = activity from FACEIT matches plus earlier popflash maps (a popflash evening counts as a
     session, like a mix will, D26).
2. **Score the real lineup** with a model config: P(team 1 wins) = Elo curve on the teams' average S.
3. **Compare with the result.** Draws are skipped. Maps with a player who has no FACEIT account are
   skipped in the main table and included in a second table with a flat manual ELO of 1400.
4. **Models** compared (`models()` in `evaluate.ts`): E only; E + F (symmetric / asymmetric);
   E + A; E + F + A; E + F + 0.5·M without A; E + F + 0.5·M + A; the default E + F + 0.5·M + 0.5·A
   (D30); M at weight 1; E + 0.5·M; F at weight 2.
5. **E today vs E rebuilt:** the same models with E rebuilt for the map's date
   (`elo-history.ts`: walk back from today's ELO, ±25 per later EU-queue match; players whose
   FACEIT account did not exist yet keep today's ELO).

Metrics (`metrics.ts`):

- **Log-loss** (main score) and **Brier**: how good the probabilities are; coin flip = 0.693 / 0.25.
- **Favourite won**: share of maps won by the team with the higher average S.
- **Δ vs E only** with a 90 % bootstrap interval (2000 resamples of maps, fixed seed) and
  **P(better)**: how often the model beats ELO alone on a resample. With ~40–60 maps only
  differences whose interval excludes 0 mean anything.
- **Best k**: the Elo scale that would have fitted best (k < 1 = our probabilities are too confident).
- **Calibration**: predicted vs actual win rate of the favourite, in buckets.
- **How even were the real teams**: imbalance of the real popflash lineup vs the engine's best split
  for the same ten players, and the real lineup's rank among all 126 splits.
- **S ↔ rating**: rank correlation between S and Mixer Rating, per map and per player.

## Caveats

- **ELO today for games in 2024.** E carries information from the future (who improved since), and
  it makes F and A hard to judge: both exist to correct a *stale* ELO, but today's ELO is not stale
  for 2024. A fair test of F and A needs the ELO at the time of each map, which the FACEIT Data API
  does not provide (see "Next steps").
- **In 2024 the group barely played FACEIT** (Jan–Mar: almost no FACEIT matches; 303 of 420
  player-maps had no FACEIT match in the 30 days before). F was 0 for most players most of the time.
- **Small sample:** 42 maps with every player on FACEIT (64 with the manual 1400), 20 evenings.
- **Popflash teams were not balanced by any algorithm**, so they are much less even than what the engine proposes;
  that makes prediction easier than it will be in the app, where every variant is close to 50 : 50.
- Our Mixer Rating 2 averages ≈ 1.07 on these maps; popflash's own "HLTV" column is a different
  formula (≈ 0.86 on average). M only compares players with the group average, so the offset does not
  matter.

## Findings (2026-09-25)

Numbers in [REPORT.md](REPORT.md).

1. **FACEIT ELO carries most of the signal.** Even ELO measured two years later picks the winner of
   64 % of the maps (72 % with the manual 1400 for the two players without FACEIT). The best-fitting
   Elo scale is k ≈ 0.8–0.9: our win chances are slightly too confident, not wrong.
2. **Mix form M is the only extra term that helps on independent data.** E + F + 0.5·M (no A) and
   E + 0.5·M are the best models; with more maps (manual ELO table) M at weight 1 is best. M also
   catches the people ELO misjudges in *our* games: jawor (ELO 1510, Mixer Rating 1.33, 64 % wins),
   CRACKH3AD (1582, 1.29) play above their ELO; lukasek_ (1866, 1.00, 29 % wins) plays below it.
3. **F cannot be judged on this data** (too few FACEIT matches around the maps, ELO from the future).
   Symmetric vs asymmetric F makes no measurable difference here.
4. **A made predictions slightly worse** (E + A vs E: +0.007 log-loss, 90 % interval above 0;
   P(better) 3 %). Most likely an artefact of today's ELO (a player who was inactive in 2024 but
   plays now already has a "fresh" ELO), but it is the one clear negative result.
5. **The real popflash teams were far from even:** on average a 67 : 33 favourite (17 pp imbalance);
   the engine's best split for the same ten players averages 0.6 pp. Balancing has a lot to fix.

Suggestions (owner decides; defaults unchanged):

- Keep E and the Elo curve; revisit k after ~5 app mixes (M4-3).
- Keep M; consider weight 1 once we have our own mix stats (M2-6).
- Put A at weight 0.5 (or halve its minus) until it can be tested on our own mixes, where ELO at the
  time is stored in `skill_snapshot` and the test becomes fair.
- Re-run this backtest after every ~5 mixes on the app's own data (snapshots + results).

### ELO rebuilt from results (2026-09-25)

Rebuilding 2024 ELO from match results is **worse than using today's ELO** (E only: log-loss 0.694
vs 0.634, the favourite won 55 % vs 64 %; mean difference 183 ELO). Walking back 300–800 matches with
a flat ±25 drifts far (stan comes out at 1070 in Dec 2024, fontek at 1564), because FACEIT's real
change per match depends on the teams' ELO gap. So: **keep today's ELO for this backtest**; a fair
test of F and A needs the real ELO per match (FACEIT site API, local only, see Next steps) or our
own mixes, where `skill_snapshot` stores E at balancing time.

## Next steps

- **ELO at the time of a map.** (a) From now on the app stores E per mix in `skill_snapshot`, which
  makes future backtests exact. (b) Rebuilt from results: tried, too noisy (above). (c) FACEIT's site
  API (`api.faceit.com/stats/v1/stats/time/users/{id}/games/cs2`) has ELO per match; GitHub runners
  are blocked there, so try it **locally**, keep the data out of git (owner: temporary use is fine),
  then plug it into `inputAt` instead of `eloAt`. Leetify cannot help: it keeps ~100 recent matches
  (from 2026-07) and no ELO per match.
- Awards (M2-8) can be tried on the same popflash data (it has team flashes, wallbangs, no-scopes,
  clutches).
