# Team balancing

Goal: from 10 participants, propose **3 different 5v5 splits** that are as even as possible, and
split a clear top or bottom duo (if there is one) across the two teams.

All logic lives in `lib/balance/` as pure, deterministic TypeScript functions with unit tests.
All weights are config (stored per mix in `mixes.balance_config`) so we can tune them after a few mixes.

## 1. Skill score per player

Everything is expressed in **FACEIT ELO points**, so the result stays readable ("this player counts as 2 150").

```
S = wE·E + wF·F + wM·M        # weights from config, all 1 by default (D22)
```

| Term | Meaning | Source |
|---|---|---|
| **E**: base | Current FACEIT ELO | FACEIT Data API. Fallback: `players.manual_skill_override` |
| **F**: FACEIT form | Recent FACEIT performance vs. the player's own baseline | FACEIT matches from the **last 30 days** |
| **M**: mix form | How the player performs **in our mixes** | Our own demo stats |

### F: recent FACEIT form

A time window, not a match count: people play very different amounts, so "last 20 matches" can mean
one week for one player and half a year for another.

The per-match number is a **FACEIT match rating**, not K/D: K/D ignores damage and impact
(owner feedback: rating/impact matters more). It has the same shape as Mixer Rating 2
([demo pipeline](05-demo-pipeline.md#rating)) built from FACEIT per-match stats (KPR, DPR, APR →
Impact, ADR); FACEIT does not report KAST, so it is fixed at 72 %. Code: `lib/balance/faceit-rating.ts`.

```
history  = the player's recent FACEIT matches (e.g. last 100–200), each with a match rating
window   = matches finished in the last 30 days                   (n = number of matches)
before   = older matches in the history                            (the player's own baseline)
ratio    = mean(window) / mean(before)
ratio^   = (n · ratio + k · 1.0) / (n + k)                          # shrink toward "normal form", k = 10
F        = clamp( β · (ratio^ − 1), −F_max, +F_max )
```
Defaults: `β = 500`, `F_max = 150`, `k = 10`, `minBaseline = 10`. The same +30% rating form gives:
- over 20 matches: ratio^ = 1.20, so F = +100 ELO;
- over 2 matches: ratio^ = 1.05, so F = +25 ELO. A lucky evening counts little.
- 0 matches in 30 days, or fewer than 10 older matches for a baseline, gives F = 0 (ELO only).

The FACEIT client must fetch enough history to have a baseline before the window (paginate if all
of the last 100 matches fall inside 30 days). Exact FACEIT field names are confirmed in spike S3.

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

Pairs are **not** a general constraint. The only pair rule is for a **clear duo**: two players who
are close to each other and far from everyone else, e.g. two much stronger (or weaker) players who
would decide the game if they played together.

Sort players by S descending: `p1 … p10`.

```
top duo    exists if  S1 − S2 ≤ 100  and  S2 − S3 ≥ 200
bottom duo exists if  S9 − S10 ≤ 100 and  S8 − S9 ≥ 200
```
(thresholds in `outlierPair`: `maxGap = 100`, `minSeparation = 200`; S already includes form.)

| Rule | Default mode | Effect |
|---|---|---|
| Top duo on opposite teams (only if it exists) | **hard** | Filters candidates |
| Bottom duo on opposite teams (only if it exists) | **hard** | Filters candidates |
| AWP players on opposite teams (if ≥ 2 marked `awp`) | soft, 2 pp | Off by default in practice (only one dedicated AWPer) |
| Avoid repeating the last mix's split (same 10 players) | soft, 2 pp | |

Candidates left: 126 with no duo, 70 with one duo, 40 with both. Always feasible.
Either duo rule can be switched to `soft` (default weight 3 pp) or `off` in config.

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
- Badges (only when a clear duo exists): "Top duo split", "Bottom duo split".
- Cost (for the admin; hidden from voters by default).
- **"How was this calculated?"** (everyone, D22): per player E and its source (FACEIT / manual), F with
  the matches in the window, window vs baseline rating, ratio, shrunk ratio and whether it hit the clamp,
  M with its maps and shrinkage; per variant the cost split into imbalance pp and each rule's penalty;
  the config (weights) used. Engine side: M1-4b.

## 8. Snapshot

At generation time, each participant's inputs (E, F, M, S) are stored in
`mix_participants.skill_snapshot`, so a past mix can always explain why teams looked the way they did.

## Default config

```json
{
  "weights": { "elo": 1, "faceitForm": 1, "mixForm": 1 },
  "form": { "windowDays": 30, "shrinkK": 10, "beta": 500, "max": 150, "minBaseline": 10 },
  "mix":  { "maps": 10, "shrinkK": 5, "gamma": 1000, "max": 200 },
  "outlierPair": { "maxGap": 100, "minSeparation": 200 },
  "rules": {
    "topPair":    { "mode": "hard", "weight": 3 },
    "bottomPair": { "mode": "hard", "weight": 3 },
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
