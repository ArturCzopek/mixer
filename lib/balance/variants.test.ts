import { describe, expect, it } from "vitest";

import { DEFAULT_BALANCE_CONFIG, resolveConfig } from "./config";
import type { PreferredRole } from "./skill";
import { enumerateSplits, splitDistance, splitKey } from "./splits";
import {
  generateVariants,
  rankPlayers,
  repeatedPairs,
  winProbability,
  type Variant,
} from "./variants";

const id = (n: number) => `7656119796000${String(n).padStart(4, "0")}`;

type P = { steamId: string; S: number; preferredRole: PreferredRole };

function player(n: number, S: number, extra: Partial<P> = {}): P {
  return { steamId: id(n), S, preferredRole: "any", ...extra };
}

// Evenly spread skill (150 apart): no clear top or bottom duo.
const ELOS = [2600, 2450, 2300, 2150, 2000, 1850, 1700, 1550, 1400, 1250];
const TEN = ELOS.map((s, i) => player(i + 1, s));
// Two clearly best (50 apart, 250 above p3) and two clearly worst players.
const DUO_ELOS = [2700, 2650, 2400, 2300, 2200, 2100, 2000, 1900, 1650, 1600];
const DUOS = DUO_ELOS.map((s, i) => player(i + 1, s));
const withElos = (elos: number[]) => elos.map((s, i) => player(i + 1, s));

const idsOf = (team: P[]) => team.map((p) => p.steamId);
const together = (v: Variant<P>, a: string, b: string) =>
  idsOf(v.teamA).includes(a) === idsOf(v.teamA).includes(b);

function allCandidates(players = TEN, config = DEFAULT_BALANCE_CONFIG) {
  return generateVariants({
    players,
    config: { ...config, variants: 200, minDistance: 0 },
  });
}

describe("winProbability", () => {
  it("is 50% for equal teams", () => {
    expect(winProbability(2000, 2000)).toBe(0.5);
  });

  it("a 25-point gap gives about 53.6% / 46.4%", () => {
    expect(winProbability(2025, 2000)).toBeCloseTo(0.536, 3);
    expect(winProbability(2000, 2025)).toBeCloseTo(0.464, 3);
  });
});

describe("splits", () => {
  const ids = TEN.map((p) => p.steamId);

  it("enumerates 126 distinct splits with the first player fixed in team A", () => {
    const splits = enumerateSplits(ids);
    expect(splits).toHaveLength(126);
    expect(new Set(splits.map(([a]) => splitKey(a, ids))).size).toBe(126);
    expect(
      splits.every(
        ([a, b]) => a[0] === ids[0] && a.length === 5 && b.length === 5,
      ),
    ).toBe(true);
  });

  it("splitKey is the same for both teams of a split (mirror)", () => {
    const [a, b] = enumerateSplits(ids)[17];
    expect(splitKey(a, ids)).toBe(splitKey(b, ids));
  });

  it("distance counts swaps and treats mirrors as equal", () => {
    const a = ids.slice(0, 5);
    const b = ids.slice(5);
    expect(splitDistance(a, a)).toBe(0);
    expect(splitDistance(a, b)).toBe(0); // mirror
    expect(splitDistance(a, [...ids.slice(0, 4), ids[5]])).toBe(1);
    expect(splitDistance(a, [...ids.slice(0, 3), ids[5], ids[6]])).toBe(2);
    expect(splitDistance(a, [ids[0], ...ids.slice(6, 10)])).toBe(1); // mirror of a 1-swap
  });
});

describe("generateVariants: pairing rules", () => {
  it("without a clear duo, no pair rule applies (all 126 splits)", () => {
    const { candidateCount, variants } = allCandidates(TEN);
    expect(candidateCount).toBe(126);
    expect(variants[0].duos).toEqual({ top: null, bottom: null });
  });

  it("splits both clear duos: 40 of 126 splits remain, all valid", () => {
    const { candidateCount, variants } = allCandidates(DUOS);
    expect(candidateCount).toBe(40);
    for (const v of variants) {
      expect(together(v, id(1), id(2))).toBe(false);
      expect(together(v, id(9), id(10))).toBe(false);
      expect(v.duos).toEqual({
        top: { ids: [id(1), id(2)], mode: "hard", split: true },
        bottom: { ids: [id(9), id(10)], mode: "hard", split: true },
      });
    }
  });

  it("detects a duo at the exact thresholds (≤ 100 apart, ≥ 200 from the next)", () => {
    // p1–p2 = 100, p2–p3 = 200; bottom evenly spread.
    const top = withElos([
      2800, 2700, 2500, 2400, 2300, 2200, 2100, 2000, 1900, 1800,
    ]);
    expect(allCandidates(top).candidateCount).toBe(70);
  });

  it("no duo when the two are more than 100 apart", () => {
    const top = withElos([
      2801, 2700, 2500, 2400, 2300, 2200, 2100, 2000, 1900, 1800,
    ]);
    expect(allCandidates(top).candidateCount).toBe(126);
  });

  it("no duo when the gap to the next player is under 200", () => {
    const top = withElos([
      2800, 2700, 2501, 2400, 2300, 2200, 2100, 2000, 1900, 1800,
    ]);
    expect(allCandidates(top).candidateCount).toBe(126);
  });

  it("detects a bottom duo on its own", () => {
    const bottom = withElos([
      2500, 2400, 2300, 2200, 2100, 2000, 1900, 1800, 1550, 1500,
    ]);
    const { candidateCount, variants } = allCandidates(bottom);
    expect(candidateCount).toBe(70);
    expect(variants[0].duos).toEqual({
      top: null,
      bottom: { ids: [id(9), id(10)], mode: "hard", split: true },
    });
  });

  it("thresholds are configurable", () => {
    const config = resolveConfig({
      outlierPair: { maxGap: 150, minSeparation: 150 },
    });
    expect(allCandidates(TEN, config).candidateCount).toBe(40);
  });

  it("a soft top-pair rule keeps all splits and adds its weight as a penalty", () => {
    const config = resolveConfig({
      rules: { topPair: { mode: "soft", weight: 3 } },
    });
    const { candidateCount, variants } = allCandidates(DUOS, config);
    expect(candidateCount).toBe(70); // bottom pair still hard: 2 · C(7,3)
    const violating = variants.filter((v) => together(v, id(1), id(2)));
    expect(violating.length).toBe(30); // 70 − the 40 that split both pairs
    for (const v of violating) {
      expect(v.penalties).toContainEqual({ rule: "topPair", pp: 3 });
      expect(v.duos.top).toMatchObject({ mode: "soft", split: false });
      expect(v.cost).toBeCloseTo(100 * Math.abs(v.winProbA - 0.5) + 3);
    }
  });

  it("rules in 'off' mode have no effect", () => {
    const config = resolveConfig({
      rules: { topPair: { mode: "off" }, bottomPair: { mode: "off" } },
    });
    const { candidateCount, variants } = allCandidates(DUOS, config);
    expect(candidateCount).toBe(126);
    expect(variants.every((v) => v.penalties.length === 0)).toBe(true);
  });

  it("penalises two AWPers on the same team", () => {
    const players = TEN.map((p, i) =>
      i === 2 || i === 4 ? { ...p, preferredRole: "awp" as const } : p,
    );
    for (const v of allCandidates(players).variants) {
      const awpTogether = together(v, id(3), id(5));
      expect(v.penalties.some((p) => p.rule === "awpSplit")).toBe(awpTogether);
    }
  });

  it("ignores the AWP rule with a single AWPer", () => {
    const players = TEN.map((p, i) =>
      i === 2 ? { ...p, preferredRole: "awp" as const } : p,
    );
    expect(
      allCandidates(players).variants.some((v) =>
        v.penalties.some((p) => p.rule === "awpSplit"),
      ),
    ).toBe(false);
  });

  it("penalises repeating the last mix's split only for the same 10 players", () => {
    const best = generateVariants({
      players: DUOS,
      config: DEFAULT_BALANCE_CONFIG,
    }).variants[0];
    const previousSplit: [string[], string[]] = [
      idsOf(best.teamB),
      idsOf(best.teamA),
    ]; // mirrored
    const again = generateVariants({
      players: DUOS,
      config: DEFAULT_BALANCE_CONFIG,
      previousSplit,
    });
    expect(again.variants[0].key).not.toBe(best.key);

    const all = generateVariants({
      players: DUOS,
      config: { ...DEFAULT_BALANCE_CONFIG, variants: 40, minDistance: 0 },
      previousSplit,
    }).variants;
    expect(all.find((v) => v.key === best.key)?.penalties).toContainEqual({
      rule: "repeatSplit",
      pp: 2,
    });

    // Different roster: player 10 replaced, so the previous split does not apply.
    const other: [string[], string[]] = [
      previousSplit[0],
      [...previousSplit[1].slice(0, 4), id(99)],
    ];
    const unaffected = generateVariants({
      players: DUOS,
      config: DEFAULT_BALANCE_CONFIG,
      previousSplit: other,
    });
    expect(unaffected.variants[0].key).toBe(best.key);
  });
});

describe("generateVariants: selection", () => {
  it("returns 3 variants, best first, pairwise distance 2", () => {
    const { variants, relaxed } = generateVariants({
      players: TEN,
      config: DEFAULT_BALANCE_CONFIG,
    });
    expect(variants).toHaveLength(3);
    expect(relaxed).toBe(false);
    const cheapest = allCandidates().variants[0];
    expect(variants[0].key).toBe(cheapest.key);
    for (let i = 0; i < 3; i++)
      for (let j = i + 1; j < 3; j++)
        expect(
          splitDistance(idsOf(variants[i].teamA), idsOf(variants[j].teamA)),
        ).toBe(2);
  });

  it("sorts by cost and puts the top player in team A, teams sorted by S", () => {
    const { variants } = allCandidates();
    for (let i = 1; i < variants.length; i++) {
      expect(variants[i].cost).toBeGreaterThanOrEqual(
        variants[i - 1].cost - 1e-9,
      );
    }
    for (const v of variants) {
      expect(v.teamA[0].steamId).toBe(id(1));
      expect(v.teamA.map((p) => p.S)).toEqual(
        [...v.teamA.map((p) => p.S)].sort((a, b) => b - a),
      );
      expect(v.gap).toBeCloseTo(v.avgA - v.avgB);
    }
  });

  it("is deterministic regardless of input order", () => {
    const a = generateVariants({
      players: TEN,
      config: DEFAULT_BALANCE_CONFIG,
    });
    const shuffled = [
      TEN[7],
      TEN[2],
      TEN[9],
      TEN[0],
      TEN[5],
      TEN[1],
      TEN[8],
      TEN[4],
      TEN[6],
      TEN[3],
    ];
    const b = generateVariants({
      players: shuffled,
      config: DEFAULT_BALANCE_CONFIG,
    });
    expect(b.variants.map((v) => v.key)).toEqual(a.variants.map((v) => v.key));
  });

  it("handles ties: equal S is ranked by SteamID and results stay deterministic", () => {
    const equal = TEN.map((p) => ({ ...p, S: 2000, E: 2000 }));
    expect(rankPlayers([...equal].reverse()).map((p) => p.steamId)).toEqual(
      TEN.map((p) => p.steamId),
    );
    const r1 = generateVariants({
      players: equal,
      config: DEFAULT_BALANCE_CONFIG,
    });
    const r2 = generateVariants({
      players: [...equal].reverse(),
      config: DEFAULT_BALANCE_CONFIG,
    });
    expect(r1.variants).toHaveLength(3);
    expect(r1.variants.map((v) => v.key)).toEqual(
      r2.variants.map((v) => v.key),
    );
    // Every split is 50/50 and no duo exists: order falls back to the split key.
    expect(r1.variants[0].winProbA).toBe(0.5);
    expect(r1.variants[0].duos.top).toBeNull();
  });

  it("re-roll never repeats a shown split, until candidates run out", () => {
    const shown: string[][] = [];
    const seen = new Set<string>();
    for (let round = 0; round < 20; round++) {
      const { variants } = generateVariants({
        players: DUOS,
        config: DEFAULT_BALANCE_CONFIG,
        excludedSplits: shown,
      });
      for (const v of variants) {
        expect(seen.has(v.key)).toBe(false);
        seen.add(v.key);
        shown.push(idsOf(v.teamA));
      }
      if (variants.length === 0) break;
    }
    expect(seen.size).toBe(40);
  });

  it("relaxes the distance rule when too few distant candidates remain", () => {
    const { variants, relaxed } = generateVariants({
      players: DUOS,
      config: { ...DEFAULT_BALANCE_CONFIG, variants: 10 },
    });
    expect(variants).toHaveLength(10);
    expect(relaxed).toBe(true);
  });

  it("rejects anything other than 10 distinct players", () => {
    expect(() =>
      generateVariants({
        players: TEN.slice(0, 9),
        config: DEFAULT_BALANCE_CONFIG,
      }),
    ).toThrow();
    const dup = [...TEN.slice(0, 9), TEN[0]];
    expect(() =>
      generateVariants({ players: dup, config: DEFAULT_BALANCE_CONFIG }),
    ).toThrow();
  });
});

describe("generateVariants: explanation (M1-4b)", () => {
  it("cost is exactly imbalance + the listed penalties", () => {
    const config = resolveConfig({
      rules: { topPair: { mode: "soft", weight: 3 } },
    });
    const { variants } = allCandidates(DUOS, config);
    for (const v of variants) {
      expect(v.imbalance).toBeCloseTo(100 * Math.abs(v.winProbA - 0.5));
      expect(v.cost).toBe(
        v.imbalance + v.penalties.reduce((s, p) => s + p.pp, 0),
      );
    }
  });

  it("rank is the position among all candidates by cost", () => {
    const all = allCandidates(TEN);
    expect(all.variants.map((v) => v.rank)).toEqual(
      all.variants.map((_, i) => i + 1),
    );
    const { variants } = generateVariants({
      players: TEN,
      config: DEFAULT_BALANCE_CONFIG,
    });
    expect(variants[0].rank).toBe(1);
    for (const v of variants)
      expect(all.variants.find((c) => c.key === v.key)!.rank).toBe(v.rank);
  });
});

describe("variant labels (D28)", () => {
  const ids = TEN.map((p) => p.steamId);
  it("marks the single most even variant", () => {
    const uneven = withElos([
      2610, 2433, 2298, 2175, 2011, 1873, 1702, 1566, 1411, 1239,
    ]);
    const { variants } = generateVariants({
      players: uneven,
      config: DEFAULT_BALANCE_CONFIG,
    });
    const even = variants.filter((v) => v.labels.includes("most-even"));
    expect(even).toHaveLength(1);
    expect(even[0].imbalance).toBe(
      Math.min(...variants.map((v) => v.imbalance)),
    );
  });

  it("no label on a tie (evenly spread skill: several 50/50 splits)", () => {
    const { variants } = generateVariants({
      players: TEN,
      config: DEFAULT_BALANCE_CONFIG,
    });
    expect(variants.some((v) => v.labels.includes("most-even"))).toBe(false);
  });

  it("no 'fresh' label without a previous mix", () => {
    const { variants } = generateVariants({
      players: TEN,
      config: DEFAULT_BALANCE_CONFIG,
    });
    expect(variants.every((v) => v.repeatedPairs === null)).toBe(true);
    expect(variants.some((v) => v.labels.includes("fresh"))).toBe(false);
  });

  it("counts repeated teammate pairs, also for a different roster", () => {
    // Previous mix: ids 0–4 vs 5–9 → 20 teammate pairs.
    const prev: [string[], string[]] = [ids.slice(0, 5), ids.slice(5)];
    expect(repeatedPairs(ids.slice(0, 5), ids.slice(5), prev)).toBe(20);
    // One swap: each team keeps 4 old mates (6 pairs each) plus one player from the other side.
    const a = [...ids.slice(0, 4), ids[5]];
    const b = [ids[4], ...ids.slice(6)];
    expect(repeatedPairs(a, b, prev)).toBe(12);
    // Unknown players (not in the previous mix) never count.
    expect(repeatedPairs(["x", "y"], ["z"], prev)).toBe(0);
  });

  it("labels the variant that repeats the fewest pairs as fresh", () => {
    const previous: [string[], string[]] = [
      [ids[0], ids[3], ids[4], ids[7], ids[8]],
      [ids[1], ids[2], ids[5], ids[6], ids[9]],
    ];
    const { variants } = generateVariants({
      players: TEN,
      config: DEFAULT_BALANCE_CONFIG,
      previousSplit: previous,
    });
    const fresh = variants.filter((v) => v.labels.includes("fresh"));
    const min = Math.min(...variants.map((v) => v.repeatedPairs!));
    if (variants.filter((v) => v.repeatedPairs === min).length === 1) {
      expect(fresh).toHaveLength(1);
      expect(fresh[0].repeatedPairs).toBe(min);
    } else {
      expect(fresh).toHaveLength(0);
    }
  });
});
