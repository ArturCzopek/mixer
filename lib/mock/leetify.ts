// INVENTED sample values in the shape of Leetify's `GET /v3/profile` (docs/06), for the design
// preview only. Real Leetify data is fetched live by the server, shown as-is with the
// "Data Provided by Leetify" attribution, and never stored (CLAUDE.md, M3-2).

export interface LeetifySample {
  /** `rating.*`, Leetify's own names and scales. */
  rating: {
    aim: number;
    positioning: number;
    utility: number;
    clutch: number;
    opening: number;
  };
  /** `ranks.*` */
  ranks: { premier: number | null; faceit: number | null };
  /** `winrate` (0..1) and `total_matches` */
  winrate: number;
  totalMatches: number;
  privacyMode: boolean;
}

/** Deterministic made-up numbers per player, so the preview is stable. */
export function leetifySample(
  steamId: string,
  faceitLevel: number,
): LeetifySample {
  let h = 0;
  for (const c of steamId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const r = (min: number, max: number) => {
    h = (h * 1103515245 + 12345) >>> 0;
    return min + (((h >>> 8) % 1000) / 1000) * (max - min);
  };
  const skill = faceitLevel / 10;
  return {
    rating: {
      aim: Math.round(35 + 55 * skill + r(-8, 8)),
      positioning: Math.round(30 + 50 * skill + r(-10, 10)),
      utility: Math.round(25 + 50 * skill + r(-12, 12)),
      clutch: Math.round(r(-0.04, 0.16) * 100) / 100,
      opening: Math.round(r(-0.08, 0.08) * 100) / 100,
    },
    ranks: {
      premier: Math.round((6000 + 16000 * skill + r(-1500, 1500)) / 10) * 10,
      faceit: faceitLevel,
    },
    winrate: Math.round(r(0.44, 0.58) * 100) / 100,
    totalMatches: Math.round(r(300, 2400)),
    privacyMode: false,
  };
}
