// Scoring splits and picking diverse variants (docs/04-team-balancing.md §2, §4–§6).

import type { BalanceConfig, RuleConfig, RuleMode } from "./config";
import type { SkillBreakdown } from "./skill";
import { enumerateSplits, splitDistance, splitKey, TEAM_SIZE } from "./splits";

export type RuleName = keyof BalanceConfig["rules"];

export interface Penalty {
  rule: RuleName;
  /** Percentage points added to the cost. */
  pp: number;
}

/** What the engine needs from a player; a full `SkillBreakdown` in practice. */
export type RankedPlayer = Pick<
  SkillBreakdown,
  "steamId" | "S" | "preferredRole"
>;

/** A clear top or bottom duo (docs/04 §4) and whether this variant splits it. */
export interface DuoStatus {
  ids: [string, string];
  mode: RuleMode;
  split: boolean;
}

export interface Variant<P extends RankedPlayer = SkillBreakdown> {
  /** Mirror-independent split id, see `splitKey`. */
  key: string;
  /** Team with the highest-S player. Both teams are sorted by S descending. */
  teamA: P[];
  teamB: P[];
  avgA: number;
  avgB: number;
  /** avgA − avgB */
  gap: number;
  /** Probability that team A wins, 0..1. */
  winProbA: number;
  /** 100 · |winProbA − 0.5|, in percentage points. */
  imbalance: number;
  /** imbalance + Σ penalties. Lower is better. */
  cost: number;
  /** Soft-rule penalties in pp (hard rules filter candidates instead). */
  penalties: Penalty[];
  /** 1-based position among all candidates sorted by cost. */
  rank: number;
  /** Clear duos and whether this split separates them; null when there is no such duo. */
  duos: { top: DuoStatus | null; bottom: DuoStatus | null };
}

export interface GenerateVariantsInput<
  P extends RankedPlayer = SkillBreakdown,
> {
  players: P[];
  config: BalanceConfig;
  /** Both teams of the last mix's lineup; only used if it had the same 10 players. */
  previousSplit?: [string[], string[]];
  /** One team of each split already shown (re-roll); these are never proposed again. */
  excludedSplits?: string[][];
}

export interface GenerateVariantsResult<
  P extends RankedPlayer = SkillBreakdown,
> {
  variants: Variant<P>[];
  /** Splits left after hard rules and exclusions (40 with default rules). */
  candidateCount: number;
  /** True if `minDistance` had to be relaxed to fill all variants. */
  relaxed: boolean;
}

const EPSILON = 1e-9;

/** Elo win probability of a team with average `avgA` against `avgB`. */
export function winProbability(avgA: number, avgB: number): number {
  return 1 / (1 + 10 ** ((avgB - avgA) / 400));
}

/** Players sorted by S descending; ties broken by SteamID so the order is deterministic. */
export function rankPlayers<P extends RankedPlayer>(
  players: readonly P[],
): P[] {
  return [...players].sort(
    (a, b) =>
      b.S - a.S || (a.steamId < b.steamId ? -1 : a.steamId > b.steamId ? 1 : 0),
  );
}

const avg = (team: RankedPlayer[]) =>
  team.reduce((s, p) => s + p.S, 0) / team.length;

export function generateVariants<P extends RankedPlayer>(
  input: GenerateVariantsInput<P>,
): GenerateVariantsResult<P> {
  const { config } = input;
  const ranked = rankPlayers(input.players);
  const ids = ranked.map((p) => p.steamId);
  if (new Set(ids).size !== TEAM_SIZE * 2) {
    throw new Error(
      `Expected ${TEAM_SIZE * 2} distinct players, got ${input.players.length}`,
    );
  }
  const byId = new Map(ranked.map((p) => [p.steamId, p]));

  // Two clearly best / two clearly worst players (docs/04 §4); null when there is no such duo.
  const S = ranked.map((p) => p.S);
  const { maxGap, minSeparation } = config.outlierPair;
  const topPair =
    S[0] - S[1] <= maxGap && S[1] - S[2] >= minSeparation
      ? ([ids[0], ids[1]] as const)
      : null;
  const bottomPair =
    S[8] - S[9] <= maxGap && S[7] - S[8] >= minSeparation
      ? ([ids[8], ids[9]] as const)
      : null;

  const awpers = ranked
    .filter((p) => p.preferredRole === "awp")
    .map((p) => p.steamId);
  const excluded = new Set(
    (input.excludedSplits ?? []).map((t) => splitKey(t, ids)),
  );
  const previous =
    input.previousSplit && isSameRoster(input.previousSplit, ids)
      ? splitKey(input.previousSplit[0], ids)
      : null;

  const candidates: Variant<P>[] = [];
  for (const [aIds, bIds] of enumerateSplits(ids)) {
    const key = splitKey(aIds, ids);
    if (excluded.has(key)) continue;

    const inA = new Set(aIds);
    const split = (pair: readonly [string, string]) =>
      inA.has(pair[0]) !== inA.has(pair[1]);
    const penalties: Penalty[] = [];
    // Returns false if a hard rule rejects the split.
    const check = (
      rule: RuleName,
      cfg: RuleConfig,
      violated: boolean,
      times = 1,
    ) => {
      if (!violated || cfg.mode === "off") return true;
      if (cfg.mode === "hard") return false;
      penalties.push({ rule, pp: cfg.weight * times });
      return true;
    };

    const topPairSplit = topPair ? split(topPair) : null;
    const bottomPairSplit = bottomPair ? split(bottomPair) : null;
    const awpInA = awpers.filter((id) => inA.has(id)).length;
    const awpUneven =
      awpers.length >= 2 && Math.abs(2 * awpInA - awpers.length) > 1;

    const ok =
      check("topPair", config.rules.topPair, topPairSplit === false) &&
      check("bottomPair", config.rules.bottomPair, bottomPairSplit === false) &&
      check("awpSplit", config.rules.awpSplit, awpUneven) &&
      check("repeatSplit", config.rules.repeatSplit, key === previous);
    if (!ok) continue;

    // aIds holds the top-ranked player (enumeration fixes ids[0] in the first team).
    const teamA = aIds.map((id) => byId.get(id)!);
    const teamB = bIds.map((id) => byId.get(id)!);
    const [avgA, avgB] = [avg(teamA), avg(teamB)];
    const winProbA = winProbability(avgA, avgB);
    const imbalance = 100 * Math.abs(winProbA - 0.5);
    const cost = imbalance + penalties.reduce((s, p) => s + p.pp, 0);
    const duo = (
      pair: readonly [string, string] | null,
      splitNow: boolean | null,
      cfg: RuleConfig,
    ): DuoStatus | null =>
      pair && { ids: [pair[0], pair[1]], mode: cfg.mode, split: !!splitNow };

    candidates.push({
      key,
      teamA,
      teamB,
      avgA,
      avgB,
      gap: avgA - avgB,
      winProbA,
      imbalance,
      cost,
      penalties,
      rank: 0,
      duos: {
        top: duo(topPair, topPairSplit, config.rules.topPair),
        bottom: duo(bottomPair, bottomPairSplit, config.rules.bottomPair),
      },
    });
  }

  candidates.sort((a, b) =>
    Math.abs(a.cost - b.cost) > EPSILON
      ? a.cost - b.cost
      : a.key < b.key
        ? -1
        : 1,
  );
  candidates.forEach((c, i) => (c.rank = i + 1));

  const { chosen, relaxed } = pickDiverse(
    candidates,
    config.variants,
    config.minDistance,
  );
  return { variants: chosen, candidateCount: candidates.length, relaxed };
}

/** Greedy: best first, then the next best far enough from all chosen; relax to ≥1 if needed. */
function pickDiverse<P extends RankedPlayer>(
  sorted: Variant<P>[],
  count: number,
  minDistance: number,
) {
  const chosen: Variant<P>[] = [];
  const ids = (v: Variant<P>) => v.teamA.map((p) => p.steamId);
  const fill = (distance: number) => {
    for (const c of sorted) {
      if (chosen.length >= count) return;
      if (chosen.includes(c)) continue;
      if (chosen.every((v) => splitDistance(ids(v), ids(c)) >= distance))
        chosen.push(c);
    }
  };
  fill(minDistance);
  const strict = chosen.length;
  if (strict < count && minDistance > 1) fill(1);
  return { chosen, relaxed: chosen.length > strict };
}

function isSameRoster([a, b]: [string[], string[]], ids: readonly string[]) {
  const all = new Set([...a, ...b]);
  return (
    a.length === TEAM_SIZE &&
    all.size === ids.length &&
    ids.every((id) => all.has(id))
  );
}
