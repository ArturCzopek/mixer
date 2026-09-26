// INVENTED sample values in the shape of Leetify's `GET /v3/profile/matches` (docs/06), for the
// design preview only. Real Leetify data is fetched live by the server, filtered to FACEIT matches
// of the last 30 days, shown as-is with the "Data Provided by Leetify" attribution, and never
// stored (CLAUDE.md, M3-2). No averages or other scores are computed from it.

import type { LeetifyMatch } from "@/lib/external/leetify";

export type LeetifyMatchSample = LeetifyMatch;

const MAPS = [
  "de_mirage",
  "de_inferno",
  "de_nuke",
  "de_anubis",
  "de_ancient",
  "de_dust2",
  "de_train",
];

/**
 * Deterministic made-up FACEIT matches of the last 30 days: `count` matches over `sessions`
 * evenings (the same numbers the preview's form F uses), better ratings when `trend` > 1.
 */
export function leetifySample(
  steamId: string,
  count: number,
  sessions: number,
  trend: number,
  now: Date,
): LeetifyMatchSample[] {
  let h = 0;
  for (const c of steamId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const r = () => {
    h = (h * 1103515245 + 12345) >>> 0;
    return ((h >>> 8) % 1000) / 1000;
  };
  const bias = (trend - 1) * 12;
  return Array.from({ length: count }, (_, i): LeetifyMatchSample => {
    const day = (i % Math.max(1, sessions)) * 2 + 1;
    const rating = Math.round((bias + (r() - 0.5) * 6) * 100) / 100;
    const won = r() < 0.5 + rating / 12;
    const lost = Math.floor(r() * 11) + 2;
    return {
      finishedAt: new Date(
        now.getTime() - day * 86_400_000 - (i % 3) * 3_600_000,
      ).toISOString(),
      dataSource: "faceit",
      map: MAPS[Math.floor(r() * MAPS.length)],
      score: won ? [13, lost] : [lost, 13],
      leetifyRating: rating,
    };
  }).sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
}
