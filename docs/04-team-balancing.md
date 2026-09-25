# Team balancing

Goal: from 10 participants, propose **3 different 5v5 splits** that are as even as possible, and
split a clear top or bottom duo (if there is one) across the two teams.

All logic lives in `lib/balance/` as pure, deterministic TypeScript functions with unit tests.
All weights are config (stored per mix in `mixes.balance_config`) so we can tune them after a few mixes.

## 1. Skill score per player

Everything is expressed in **FACEIT ELO points**, so the result stays readable ("this player counts as 2 150").

```
S = wE·E + wF·F + wM·M + wA·A     # weights from config (D22): wE = 1, wF = 1, wM = 0.5 (D24), wA = 0.5 (D30)
```

| Term | Meaning | Source |
|---|---|---|
| **E**: base | Current FACEIT ELO | FACEIT Data API. Fallback: `group_members.manual_skill_override` |
| **F**: FACEIT form | Recent FACEIT performance vs. the player's own baseline, scaled by ELO (asymmetry) | FACEIT matches from the **last 30 days** |
| **M**: mix form | How the player performs **in our mixes** | Our own mix stats (FACEIT import or demo) |
| **A**: activity | Rust penalty / small bonus for regular play | Sessions in the last 30 days (FACEIT history + mix maps) |

The engine returns every intermediate number with S (M1-4b, `SkillBreakdown` in `lib/balance/skill.ts`),
and the "How was this calculated?" panel shows each term as its own line: value, weight, contribution.
Each contribution `w·term` is rounded to whole ELO points and **S is their sum**, so the panel always
adds up exactly. A weight of 0 switches a term off (it is still explained).

### F: recent FACEIT form

**"Last 30 days" always means the 30 days before the mix** (D30), not before today: the engine's
`now` is the balancing time, the explanation shows the window's dates, and a mix viewed later keeps
its numbers. The same holds for A and for the Leetify card.

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
F_raw    = clamp( β · (ratio^ − 1), −F_max, +F_max )                # then scaled by ELO, below
```
Defaults: `β = 500`, `F_max = 150`, `k = 10`, `minBaseline = 10`. The same +30% rating form gives
(F_raw, before the asymmetry below):
- over 20 matches: ratio^ = 1.20, so F_raw = +100 ELO;
- over 2 matches: ratio^ = 1.05, so F_raw = +25 ELO. A lucky evening counts little.
- 0 matches in 30 days, or fewer than 10 older matches for a baseline, gives F = 0 (ELO only).

**Asymmetry by absolute ELO (D24, amended).** Form counts differently for strong and weak players.
A strong player in good form gets only a small boost (they are already near their ceiling), but a slump
costs them more; a weaker player with even average-plus form gets a bigger boost (holding your own
among stronger players is worth more), and a slump costs them less. The scale is the player's own
FACEIT ELO, **not** their position in tonight's lobby, so the same player is treated the same way
every evening.

```
F_raw = clamp( β · (ratio^ − 1), −F_max, +F_max )
m+(E), m−(E) = linear interpolation between config anchors, flat outside them
F     = clamp( m+(E) · F_raw, −F_max, +F_max )   if F_raw ≥ 0
F     = clamp( m−(E) · F_raw, −F_max, +F_max )   if F_raw < 0
```

Anchors (`form.asymmetry`):

| E (FACEIT ELO) | m+ | m− |
|---|---|---|
| ≤ 1000 | 1.5 | 0.30 |
| 1500 | 1.0 | 0.45 |
| ≥ 2000 | 0.1 | 0.60 |

Resulting F for a few ELOs (β = 500, F_max = 150; ratio^ is the ratio **after** shrinkage):

| E | m+ | m− | ratio^ 1.05 (F_raw +25) | 1.10 (+50) | 1.30 (+150) | 0.90 (−50) | 0.70 (−150) |
|---|---|---|---|---|---|---|---|
| 938 (lowest of our roster) | 1.500 | 0.300 | **+37.5** | +75 | +150 | −15 | −45 |
| 1126 | 1.374 | 0.338 | **+34.4** | +68.7 | +150 | −16.9 | −50.7 |
| 1400 | 1.100 | 0.420 | +27.5 | +55 | +150 | −21 | −63 |
| 1500 | 1.000 | 0.450 | +25 | +50 | +150 | −22.5 | −67.5 |
| 1797 | 0.465 | 0.539 | +11.6 | +23.3 | +69.8 | −27 | −80.9 |
| 2189 (highest) | 0.100 | 0.600 | +2.5 | +5 | **+15** | −30 | **−90** |

So a player above 2000 gets at most +15 from form and loses up to −90; a player around 1100 with an
average-plus month (ratio^ 1.05, e.g. 25 matches at a raw ratio of 1.07) gets a clear +34.

The FACEIT client must fetch enough history to have a baseline before the window (paginate if all
of the last 100 matches fall inside 30 days). Exact FACEIT field names are confirmed in spike S3.

### A: activity (D26)

FACEIT ELO is frozen while a player is not playing, so for an inactive player it overstates how good
they are tonight. A is a separate term (not a damper on F: F already fades to 0 with few matches
through shrinkage, and F = 0 still means "full ELO").

```
playedAt = finish times of every FACEIT match in the history (any mode, club matches included)
           + mix maps entered in the app without FACEIT
session  = a run of matches where consecutive ones finished < 6 h apart (sessionGapHours)
s        = sessions that ended in the last 30 days (windowDays)
A        = linear interpolation of s between config anchors, flat outside them
```

Anchors (`activity.anchors`):

| sessions in 30 days | 0 | 1 | 2 | 3 | 4 | 5 | ≥ 6 |
|---|---|---|---|---|---|---|---|
| A | **−60** | −40 | −20 | 0 | +5 | +10 | **+15** |

(Owner, 2026-09-25: three sessions a month is "normal", not playing at all costs at most −60.)

Examples:
- Played three matches on one evening three weeks ago and nothing since: s = 1, A = −40.
- Last FACEIT match two months ago: s = 0, A = −60 (and F = 0, no matches in the window).
- Plays twice a week (8 sessions): A = +15. Regular play also shows in F, so the bonus stays small.
- No FACEIT history and no mix maps: A = 0, shown as "no activity data" (D21).

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

- Team A / Team B lineups with each player's S (and a breakdown on tap: E / F / M / A). In variant
  tabs teams are sorted by S; in the lobby and the locked lineup players are listed in **join order**
  (D28).
- Average S per team, the gap, and the win probability.
- No duo badges (D28). When a clear duo exists, the explanation panel says that it is split and why.
- Cost (for the admin; hidden from voters by default).
- **"How was this calculated?"** (everyone, D22): per player E and its source (FACEIT / manual), F with
  the matches in the window, window vs baseline rating, ratio, shrunk ratio, raw F, the asymmetry
  multiplier for their ELO and whether it hit a clamp, M with its maps and shrinkage, A with the
  sessions counted; each term's weight and contribution to S; per variant the cost split into
  imbalance pp and each rule's penalty; the config (weights) used. Engine side: M1-4b.

## 8. Snapshot

At generation time, each participant's inputs and explanation (E, F, M, A, S with all intermediate
numbers) are stored in
`mix_participants.skill_snapshot`, so a past mix can always explain why teams looked the way they did.

## Default config

```json
{
  "weights": { "elo": 1, "faceitForm": 1, "mixForm": 0.5, "activity": 0.5 },
  "form": {
    "windowDays": 30, "shrinkK": 10, "beta": 500, "max": 150, "minBaseline": 10,
    "asymmetry": [
      { "elo": 1000, "up": 1.5, "down": 0.3 },
      { "elo": 1500, "up": 1.0, "down": 0.45 },
      { "elo": 2000, "up": 0.1, "down": 0.6 }
    ]
  },
  "activity": {
    "windowDays": 30, "sessionGapHours": 6,
    "anchors": [
      { "sessions": 0, "value": -60 },
      { "sessions": 1, "value": -40 },
      { "sessions": 2, "value": -20 },
      { "sessions": 3, "value": 0 },
      { "sessions": 6, "value": 15 }
    ]
  },
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

Per-group overrides and on/off switches per term (E / F / M / A) come later (M4-7).

## Backtest findings (T-1, 2026-09-25)

Module `backtest/` (method, caveats, numbers: `backtest/README.md`, `backtest/REPORT.md`), 42–64
popflash maps from 2024. Short version: FACEIT ELO carries most of the signal (the favourite won
64–72 %), mix form M is the only extra term that helps, F cannot be judged on 2024 data (the group
barely played FACEIT then and E is today's ELO), and A made predictions slightly worse (probably an
artefact of today's ELO). Real popflash teams were on average a 67 : 33 favourite; the engine's best
split for the same players is ~50.3 : 49.7. Defaults unchanged until the owner decides (weight of A,
weight of M).

## Backtest scenario (test data, later)

Source for our group: the popflash history (T-2), **test fixtures only** (D25), never imported into the app database.


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
