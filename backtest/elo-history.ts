// Rebuilds a player's FACEIT ELO at a past moment (pure). The Data API has no ELO per match, only
// today's ELO and every match result, so we walk back from today: undo +25 for each queue win and
// −25 for each queue loss after that moment. FACEIT's real change is ~±10…40 depending on the
// teams' ELO gap, so the error grows with the number of matches walked back (see README).

export interface MatchResult {
  finishedAt: string;
  won: boolean;
  gameMode: string;
  competitionId: string | null;
}

/** FACEIT "Europe 5v5 Queue": the only competition of ours that moves the main ELO. */
export const EU_QUEUE = "f4148ddd-bce8-41b8-9131-ee83afcdd6dd";
export const ELO_STEP = 25;
/** FACEIT does not go below this. */
export const ELO_FLOOR = 100;

export interface EloAt {
  elo: number;
  /** Queue matches undone between `at` and today: the uncertainty grows with it. */
  matchesWalkedBack: number;
  /**
   * False when the player had no FACEIT match before `at` (account made later): walking back would
   * only reach the starting ELO of a new account, so `elo` is today's value instead.
   */
  rebuilt: boolean;
}

export function eloAt(
  eloNow: number,
  results: MatchResult[],
  at: Date,
  opts: { step?: number; queues?: string[] } = {},
): EloAt {
  const step = opts.step ?? ELO_STEP;
  const queues = new Set(opts.queues ?? [EU_QUEUE]);
  if (!results.some((r) => Date.parse(r.finishedAt) <= at.getTime()))
    return { elo: eloNow, matchesWalkedBack: 0, rebuilt: false };
  let elo = eloNow;
  let n = 0;
  for (const r of results) {
    if (Date.parse(r.finishedAt) <= at.getTime()) continue;
    if (
      r.gameMode !== "5v5" ||
      !r.competitionId ||
      !queues.has(r.competitionId)
    )
      continue;
    elo -= r.won ? step : -step;
    n++;
  }
  return { elo: Math.max(ELO_FLOOR, elo), matchesWalkedBack: n, rebuilt: true };
}

/**
 * One FACEIT match from the site's history (local-only data, backtest/.local/): finish time in
 * seconds, ELO after the match, the change it made (null when unknown).
 */
export type RealEloRow = [
  t: number,
  eloAfter: number,
  delta: number | null,
  fiveVsFive: 0 | 1,
  competition: string | null,
];

/**
 * The player's real FACEIT ELO just before `at`: ELO after the last match before it, or, when the
 * history starts later, ELO before the first match after it. Null without any row.
 */
export function realEloAt(rows: RealEloRow[], at: Date): number | null {
  const t = at.getTime() / 1000;
  let before: RealEloRow | null = null;
  let after: RealEloRow | null = null;
  for (const r of rows) {
    if (r[0] < t) {
      if (!before || r[0] > before[0]) before = r;
    } else if (!after || r[0] < after[0]) after = r;
  }
  if (before) return before[1];
  if (after) return after[1] - (after[2] ?? 0);
  return null;
}
