// Scoring splits and picking diverse variants (docs/04-team-balancing.md §2, §4–§6).

import type { BalanceConfig, RuleConfig } from "./config";
import type { SkillBreakdown } from "./skill";
import { enumerateSplits, splitDistance, splitKey, TEAM_SIZE } from "./splits";

export type RuleName = keyof BalanceConfig["rules"];

export interface Penalty {
  rule: RuleName;
  /** Percentage points added to the cost. */
  pp: number;
}

export interface Variant {
  /** Mirror-independent split id, see `splitKey`. */
  key: string;
  /** Team with the highest-S player. Both teams are sorted by S descending. */
  teamA: SkillBreakdown[];
  teamB: SkillBreakdown[];
  avgA: number;
  avgB: number;
  /** avgA − avgB */
  gap: number;
  /** Probability that team A wins, 0..1. */
  winProbA: number;
  /** Imbalance in pp + soft-rule penalties. Lower is better. */
  cost: number;
  penalties: Penalty[];
  /** Whether the clear top/bottom duo is split; null when there is no such duo. */
  badges: {
    topPairSplit: boolean | null;
    bottomPairSplit: boolean | null;
  };
}

export interface GenerateVariantsInput {
  players: SkillBreakdown[];
  config: BalanceConfig;
  /** Both teams of the last mix's lineup; only used if it had the same 10 players. */
  previousSplit?: [string[], string[]];
  /** One team of each split already shown (re-roll); these are never proposed again. */
  excludedSplits?: string[][];
}

export interface GenerateVariantsResult {
  variants: Variant[];
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
export function rankPlayers(
  players: readonly SkillBreakdown[],
): SkillBreakdown[] {
  return [...players].sort(
    (a, b) =>
      b.S - a.S || (a.steamId < b.steamId ? -1 : a.steamId > b.steamId ? 1 : 0),
  );
}

const avg = (team: SkillBreakdown[]) =>
  team.reduce((s, p) => s + p.S, 0) / team.length;

export function generateVariants(
  input: GenerateVariantsInput,
): GenerateVariantsResult {
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

  const candidates: Variant[] = [];
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

    const topPairSplit = topPair && split(topPair);
    const bottomPairSplit = bottomPair && split(bottomPair);
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
    const cost =
      100 * Math.abs(winProbA - 0.5) + penalties.reduce((s, p) => s + p.pp, 0);

    candidates.push({
      key,
      teamA,
      teamB,
      avgA,
      avgB,
      gap: avgA - avgB,
      winProbA,
      cost,
      penalties,
      badges: {
        topPairSplit,
        bottomPairSplit,
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

  const { chosen, relaxed } = pickDiverse(
    candidates,
    config.variants,
    config.minDistance,
  );
  return { variants: chosen, candidateCount: candidates.length, relaxed };
}

/** Greedy: best first, then the next best far enough from all chosen; relax to ≥1 if needed. */
function pickDiverse(sorted: Variant[], count: number, minDistance: number) {
  const chosen: Variant[] = [];
  const ids = (v: Variant) => v.teamA.map((p) => p.steamId);
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
