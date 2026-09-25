// Replays the balancing engine on past popflash maps (pure, no I/O). For every map: rebuild each
// player's inputs as of the map's start (FACEIT history before that moment, earlier popflash maps as
// "mix form"), score the real lineup with a model config and compare with the actual result.

import {
  ASSUMED_KAST,
  faceitMatchRating,
  generateVariants,
  mixerRating2,
  resolveConfig,
  skillScore,
  splitKey,
  winProbability,
  type BalanceConfig,
  type BalanceConfigOverrides,
  type PlayerInput,
  type SkillBreakdown,
} from "@/lib/balance";
import type {
  BacktestData,
  FaceitRecord,
  PopflashLine,
  PopflashMatch,
} from "./data";
import { spearman, type Prediction } from "./metrics";

export interface Model {
  id: string;
  name: string;
  config: BalanceConfig;
}

const off = { mode: "off" as const, weight: 0 };
const SYMMETRIC = [{ elo: 0, up: 1, down: 1 }];

/** Model variants compared in the report; `full` is the current default config. */
export function models(): Model[] {
  const m = (id: string, name: string, o: BalanceConfigOverrides): Model => ({
    id,
    name,
    config: resolveConfig(o),
  });
  const w = (f: number, mix: number, a: number) => ({
    weights: { elo: 1, faceitForm: f, mixForm: mix, activity: a },
  });
  return [
    m("elo", "E only", w(0, 0, 0)),
    m("f-sym", "E + F, symmetric", {
      ...w(1, 0, 0),
      form: { asymmetry: SYMMETRIC },
    }),
    m("f-asym", "E + F, asymmetric (D24)", w(1, 0, 0)),
    m("e-a", "E + A", w(0, 0, 1)),
    m("f-a", "E + F + A", w(1, 0, 1)),
    m("no-a", "E + F + 0.5·M (no A)", w(1, 0.5, 0)),
    m("full", "E + F + 0.5·M + A (default)", w(1, 0.5, 1)),
    m("m1", "E + F + 1·M + A", w(1, 1, 1)),
    m("e-m", "E + 0.5·M", w(0, 0.5, 0)),
    m("f2", "E + 2·F (asym) + 0.5·M + A", w(2, 0.5, 1)),
  ];
}

export interface MapEval {
  match: PopflashMatch;
  team1: SkillBreakdown[];
  team2: SkillBreakdown[];
  /** avg S team 1 − team 2 */
  gap: number;
  pred: Prediction;
  /** Rounds won by team 1 minus team 2. */
  roundDiff: number;
  /** 100·|P − 0.5| of the real lineup. */
  imbalance: number;
  /** Position of the real lineup among the 126 splits by imbalance (1 = most even). */
  rank: number;
  /** Imbalance of the most even split the engine could have proposed. */
  bestImbalance: number;
  /** Spearman(S, Mixer Rating on this map) over the 10 players. */
  skillVsRating: number;
  ratings: Map<string, number>;
}

export interface EvaluateResult {
  maps: MapEval[];
  skipped: { id: string; reason: string }[];
}

/** Mixer Rating 2 of one popflash line, with popflash's KAST (rounds) when present. */
export function lineRating(l: PopflashLine): number {
  // Popflash reports KAST as rounds; 0 means "not computed" (older matches), so assume 72 %.
  const kastPct = l.kast ? (100 * l.kast) / l.rounds : ASSUMED_KAST;
  return mixerRating2({
    kills: l.kills,
    deaths: l.deaths,
    assists: l.assists,
    rounds: l.rounds,
    adr: l.adr,
    kastPct,
  });
}

/** Engine input for one player as of `at` (nothing from `at` onwards leaks in). */
export function inputAt(
  steamId: string,
  at: Date,
  data: BacktestData,
  earlier: PopflashMatch[],
  fallbackElo: number | null = null,
): PlayerInput | null {
  const h = data.faceit.get(steamId) ?? {
    eloNow: null,
    stats: [] as FaceitRecord[],
  };
  if (h.eloNow === null && fallbackElo === null) return null;
  const t = at.getTime();
  const before = h.stats.filter((s) => Date.parse(s.finishedAt) < t);
  const form = before
    .filter((s) => s.gameMode === "5v5" && s.adr !== null && s.rounds > 0)
    .map((s) => ({
      finishedAt: s.finishedAt,
      rating: faceitMatchRating({ ...s, adr: s.adr! }),
    }));
  const mine = earlier
    .map((m) => ({
      m,
      line: m.players.find((l) => data.steamIdOf.get(l.popflashId) === steamId),
    }))
    .filter((x) => x.line && x.line.rounds > 0)
    .reverse(); // most recent first
  return {
    steamId,
    faceitElo: h.eloNow,
    // Like a group admin's manual ELO for someone without FACEIT (D21).
    manualSkillOverride: fallbackElo,
    faceit: { matches: form },
    activity: {
      playedAt: [
        ...before.map((s) => s.finishedAt),
        ...mine.map((x) =>
          new Date(Date.parse(x.m.date) + 45 * 60_000).toISOString(),
        ),
      ],
    },
    mixRatings: mine.map((x) => lineRating(x.line!)),
  };
}

export function evaluate(
  data: BacktestData,
  config: BalanceConfig,
  opts: { fallbackElo?: number } = {},
): EvaluateResult {
  const maps: MapEval[] = [];
  const skipped: EvaluateResult["skipped"] = [];
  for (let i = 0; i < data.matches.length; i++) {
    const match = data.matches[i];
    const earlier = data.matches.slice(0, i);
    const at = new Date(match.date);
    const lines = match.players.filter((l) => l.rounds > 0);
    const ids = lines.map((l) => data.steamIdOf.get(l.popflashId));
    if (
      lines.length !== 10 ||
      ids.some((id) => !id) ||
      new Set(ids).size !== 10
    ) {
      skipped.push({
        id: match.id,
        reason: `not a clean 5v5 of known players (${lines.length})`,
      });
      continue;
    }
    if (match.winner !== 1 && match.winner !== 2) {
      skipped.push({ id: match.id, reason: "no winner" });
      continue;
    }
    const prior = earlier.flatMap((m) =>
      m.players.filter((l) => l.rounds > 0).map(lineRating),
    );
    const groupRating = prior.length
      ? prior.reduce((a, b) => a + b, 0) / prior.length
      : null;
    const inputs = ids.map((id) =>
      inputAt(id!, at, data, earlier, opts.fallbackElo ?? null),
    );
    const missing = ids.filter((_, k) => !inputs[k]);
    if (missing.length) {
      skipped.push({
        id: match.id,
        reason: `no FACEIT ELO: ${missing.map((id) => data.nameOf.get(id!) ?? id).join(", ")}`,
      });
      continue;
    }
    const skills = inputs.map((inp) =>
      skillScore(
        inp!,
        { now: new Date(at.getTime() - 1), groupRating },
        config,
      ),
    );
    const bySide = (side: number) =>
      skills.filter((_, k) => lines[k].team === side);
    const [team1, team2] = [bySide(1), bySide(2)];
    if (team1.length !== 5) {
      skipped.push({ id: match.id, reason: "uneven teams" });
      continue;
    }
    const avg = (t: SkillBreakdown[]) =>
      t.reduce((s, p) => s + p.S, 0) / t.length;
    const p = winProbability(avg(team1), avg(team2));

    // Every split of these 10 players by imbalance only (no duo rules), to place the real lineup.
    const all = generateVariants({
      players: skills,
      config: {
        ...config,
        variants: 126,
        minDistance: 0,
        rules: {
          topPair: off,
          bottomPair: off,
          awpSplit: off,
          repeatSplit: off,
        },
      },
    }).variants;
    const allIds = skills.map((s) => s.steamId);
    const key = splitKey(
      team1.map((s) => s.steamId),
      allIds,
    );
    const real = all.find((v) => v.key === key)!;
    const ratings = new Map(
      lines.map((l, k) => [ids[k]!, lineRating(l)] as const),
    );
    maps.push({
      match,
      team1,
      team2,
      gap: avg(team1) - avg(team2),
      pred: { p, y: match.winner === 1 ? 1 : 0 },
      roundDiff: match.score1 - match.score2,
      imbalance: real.imbalance,
      rank: real.rank,
      bestImbalance: all[0].imbalance,
      skillVsRating: spearman(
        skills.map((s) => s.S),
        skills.map((s) => ratings.get(s.steamId)!),
      ),
      ratings,
    });
  }
  return { maps, skipped };
}

/** Best Elo scale k for P = 1 / (1 + 10^(−k·gap/400)) by log-loss (grid search, k ∈ [0, 3]). */
export function fitScale(maps: MapEval[]): { k: number; logLoss: number } {
  let best = { k: 1, logLoss: Infinity };
  for (let k = 0; k <= 3.0001; k += 0.05) {
    const ll =
      maps.reduce((s, m) => {
        const p = 1 / (1 + 10 ** ((-k * m.gap) / 400));
        const q = Math.min(1 - 1e-6, Math.max(1e-6, m.pred.y ? p : 1 - p));
        return s - Math.log(q);
      }, 0) / maps.length;
    if (ll < best.logLoss) best = { k: Math.round(k * 100) / 100, logLoss: ll };
  }
  return best;
}
