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
}

export function eloAt(
  eloNow: number,
  results: MatchResult[],
  at: Date,
  opts: { step?: number; queues?: string[] } = {},
): EloAt {
  const step = opts.step ?? ELO_STEP;
  const queues = new Set(opts.queues ?? [EU_QUEUE]);
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
  return { elo: Math.max(ELO_FLOOR, elo), matchesWalkedBack: n };
}
