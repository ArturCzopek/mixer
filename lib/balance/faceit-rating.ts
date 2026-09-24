// Per-match performance from FACEIT match stats, used for FACEIT form (F).
// Same shape as Mixer Rating 2 (docs/05-demo-pipeline.md#rating), but FACEIT does not report
// KAST, so it is fixed at a typical value. Only ever compared with the same player's own
// FACEIT matches (a ratio), never with Mixer Rating.

export interface FaceitMatchStats {
  kills: number;
  deaths: number;
  assists: number;
  rounds: number;
  adr: number;
}

/** Typical KAST %, stands in for the value FACEIT does not provide. */
export const ASSUMED_KAST = 72;

export function faceitMatchRating(s: FaceitMatchStats): number {
  if (s.rounds <= 0) throw new Error("rounds must be > 0");
  const kpr = s.kills / s.rounds;
  const dpr = s.deaths / s.rounds;
  const apr = s.assists / s.rounds;
  const impact = 2.13 * kpr + 0.42 * apr - 0.41;
  return (
    0.0073 * ASSUMED_KAST +
    0.3591 * kpr -
    0.5329 * dpr +
    0.2372 * impact +
    0.0032 * s.adr +
    0.1587
  );
}
