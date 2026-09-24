# Team balancing

Goal: from 10 participants, propose **3 different 5v5 splits** that are as even as possible, and
split the best pair and the worst pair across the two teams.

All logic lives in `lib/balance/` as pure, deterministic TypeScript functions with unit tests.
All weights are config (stored per mix in `mixes.balance_config`) so we can tune them after a few mixes.

## 1. Skill score per player

Everything is expressed in **FACEIT ELO points**, so the result stays readable ("this player counts as 2 150").

```
S = E + F + M
```

| Term | Meaning | Source |
|---|---|---|
| **E**: base | Current FACEIT ELO | FACEIT Data API. Fallback: `players.manual_skill_override` |
| **F**: FACEIT form | Recent FACEIT performance vs. the player's own baseline | FACEIT matches from the **last 30 days** |
| **M**: mix form | How the player performs **in our mixes** | Our own demo stats |

### F: recent FACEIT form

A time window, not a match count: people play very different amounts, so "last 20 matches" can mean
one week for one player and half a year for another.

```
window   = FACEIT matches finished in the last 30 days            (n = number of matches)
recent   = mean K/D over the window
baseline = lifetime K/D
ratio    = recent / baseline
ratio^   = (n · ratio + k · 1.0) / (n + k)                          # shrink toward "normal form", k = 10
F        = clamp( β · (ratio^ − 1), −F_max, +F_max )
```
Defaults: `β = 500`, `F_max = 150`, `k = 10`. The same +30% K/D form gives:
- over 20 matches: ratio^ = 1.20, so F = +100 ELO;
- over 2 matches: ratio^ = 1.05, so F = +25 ELO. A lucky evening counts little.
- 0 matches in 30 days gives F = 0 (ELO only).

K/D is the most reliably available per-match number in the FACEIT API. If ADR per match is
available, use `0.5·KD_ratio + 0.5·ADR_ratio` instead (decide during the FACEIT spike).

### M: mix form (our own rating)

Uses the mixer rating (HLTV 2.0-style, see [demo pipeline](05-demo-pipeline.md#rating)) from the
player's **last N = 10 mix maps**, shrunk toward the group average so one great map does not swing everything:

```
r̄_group = average rating of all players over all mix maps
r̂       = (n · r̄_player + k · r̄_group) / (n + k)      # n = maps played, k = 5
M       = clamp( γ · (r̂ − r̄_group), −M_max, +M_max )
```
Defaults: `γ = 1000`, `M_max = 200`. Example: after 10 maps at 1.15 when the group average is 1.00,
r̂ = 1.10, so M = +100 ELO. A player with no mix history gets M = 0.

**Cold start:** until we have ~3 mixes with demos, M ≈ 0 for everyone and balancing is effectively FACEIT-only.

## 2. Win probability

Team strength = average S of its 5 players. Standard Elo curve (FACEIT uses the same scale):

```
P(A wins) = 1 / (1 + 10^((S̄_B − S̄_A) / 400))
```
A 25-point average gap gives ≈ 53.6% / 46.4%.

## 3. Enumerate all splits

10 players give `C(10,5) / 2 = 126` distinct splits (player #1 is fixed in team A to remove mirrors).
We score every one of them, so no heuristics are needed.

## 4. Pairing rules

Sort players by S descending: `p1 … p10`. Pairs: `(p1,p2)`, `(p3,p4)`, `(p5,p6)`, `(p7,p8)`, `(p9,p10)`.

| Rule | Default mode | Effect |
|---|---|---|
| Best pair `(p1,p2)` on opposite teams | **hard** | Filters candidates |
| Worst pair `(p9,p10)` on opposite teams | **hard** | Filters candidates |
| Middle pairs split | soft, 0.5 pp each | Adds a penalty if a pair is together |
| AWP players on opposite teams (if ≥ 2 marked `awp`) | soft, 2 pp | Off by default in practice (only one dedicated AWPer) |
| Avoid repeating the last mix's split (same 10 players) | soft, 2 pp | |

With both hard rules, **40 of the 126 splits remain**. That is always feasible and still leaves
plenty of room for balance. Either rule can be switched to `soft` (default weight 3 pp) in config.

## 5. Cost function

```
cost = 100 · |P(A) − 0.5|          # imbalance in percentage points
     + Σ soft-rule penalties        # also in percentage points
```
Lower is better.

## 6. Picking 3 diverse variants

Two variants that differ by swapping a single pair of players are not a real choice. Definition:

```
distance(v1, v2) = number of players that must swap sides to turn v1 into v2 (mirrors considered) ∈ {1, 2}
```

Greedy selection:
1. Sort candidates by cost.
2. Take the best one.
3. Take the next best with `distance = 2` to **all** already chosen variants.
4. Repeat until 3 variants are chosen. If none qualifies, relax to `distance ≥ 1`.

**Re-roll:** exclude every previously shown split and run the same selection again.

## 7. What the UI shows per variant

- Team A / Team B lineups with each player's S (and a breakdown on hover: E / F / M).
- Average S per team, the gap, and the win probability.
- Badges: "Top pair split", "Bottom pair split", "Mid pairs split 3/3".
- Cost (for the admin; hidden from voters by default).

## 8. Snapshot

At generation time, each participant's inputs (E, F, M, S) are stored in
`mix_participants.skill_snapshot`, so a past mix can always explain why teams looked the way they did.

## Default config

```json
{
  "form": { "windowDays": 30, "shrinkK": 10, "beta": 500, "max": 150 },
  "mix":  { "maps": 10, "shrinkK": 5, "gamma": 1000, "max": 200 },
  "rules": {
    "topPair":    { "mode": "hard", "weight": 3 },
    "bottomPair": { "mode": "hard", "weight": 3 },
    "midPairs":   { "mode": "soft", "weight": 0.5 },
    "awpSplit":   { "mode": "soft", "weight": 2 },
    "repeatSplit":{ "mode": "soft", "weight": 2 }
  },
  "variants": 3,
  "minDistance": 2
}
```

## Backtest scenario (test data, later)

Take past mixes where we know the real lineups and results, plus the FACEIT profiles of the players:
1. Run the engine on those 10 players.
2. Compare: where do the real teams rank among the 126 splits? What win probability did the real
   split have, and did the favourite win?
3. Check whether the 3 proposed variants look sensible to the group.

Caveat: the FACEIT API returns **current** ELO, not ELO on the day of an old mix. Recent mixes
(last few weeks) are the most meaningful. For older ones we accept the error or enter the ELO manually.
Store scenarios as JSON fixtures in `lib/balance/__fixtures__/` so they become regression tests.

## Tuning later

After ~5 mixes with results, check calibration: did teams with P(A) > 55% actually win more often?
If mix results disagree with predictions, increase `gamma` (trust mix form more).
