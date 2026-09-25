import { describe, expect, it } from "vitest";
import { DEFAULT_BALANCE_CONFIG } from "@/lib/balance";
import { loadBacktestData } from "./data";
import { evaluate, fitScale, inputAt, lineRating } from "./evaluate";
import {
  brier,
  calibration,
  favouriteWinRate,
  logLoss,
  spearman,
} from "./metrics";

describe("metrics", () => {
  const coin = [
    { p: 0.5, y: 1 as const },
    { p: 0.5, y: 0 as const },
  ];

  it("a coin flip scores ln 2 and 0.25", () => {
    expect(logLoss(coin)).toBeCloseTo(Math.LN2);
    expect(brier(coin)).toBeCloseTo(0.25);
    expect(favouriteWinRate(coin).n).toBe(0);
  });

  it("rewards confident correct predictions", () => {
    const good = [
      { p: 0.8, y: 1 as const },
      { p: 0.3, y: 0 as const },
    ];
    expect(logLoss(good)).toBeLessThan(Math.LN2);
    expect(favouriteWinRate(good)).toEqual({ rate: 1, n: 2 });
  });

  it("buckets by the favourite's probability", () => {
    const b = calibration([
      { p: 0.52, y: 1 },
      { p: 0.35, y: 0 }, // favourite = team 2 at 65 %, won
    ]);
    expect(b[0]).toMatchObject({ n: 1, actual: 1 });
    expect(b[2]).toMatchObject({ n: 1, actual: 1 });
    expect(b[2].predicted).toBeCloseTo(0.65);
  });

  it("spearman: monotone = 1, reversed = −1, ties averaged", () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1);
    expect(spearman([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1);
    expect(spearman([1, 1, 2], [5, 5, 9])).toBeCloseTo(1);
  });
});

describe("replay on the recorded fixtures", () => {
  const data = loadBacktestData();

  it("never uses data from the map's own start or later", () => {
    const match = data.matches[40];
    const at = new Date(match.date);
    const earlier = data.matches.slice(0, 40);
    for (const line of match.players) {
      const id = data.steamIdOf.get(line.popflashId)!;
      const input = inputAt(id, at, data, earlier, 1400)!;
      for (const m of input.faceit!.matches)
        expect(Date.parse(m.finishedAt)).toBeLessThan(at.getTime());
      for (const t of input.activity!.playedAt)
        expect(Date.parse(t)).toBeLessThan(at.getTime());
      expect(input.mixRatings!.length).toBeLessThanOrEqual(40);
    }
  });

  it("rates a popflash line with Mixer Rating 2 (real KAST when present)", () => {
    const line = data.matches.at(-1)!.players[0];
    expect(lineRating(line)).toBeGreaterThan(0);
    expect(lineRating({ ...line, kast: 0 })).not.toBe(lineRating(line));
  });

  it("is deterministic and explains every S", () => {
    const a = evaluate(data, DEFAULT_BALANCE_CONFIG);
    const b = evaluate(data, DEFAULT_BALANCE_CONFIG);
    expect(a.maps.map((m) => m.pred.p)).toEqual(b.maps.map((m) => m.pred.p));
    expect(a.maps.length + a.skipped.length).toBe(data.matches.length);
    for (const m of a.maps) {
      for (const s of [...m.team1, ...m.team2]) {
        const c = s.contributions;
        expect(c.E + c.F + c.M + c.A).toBe(s.S);
      }
      expect(m.rank).toBeGreaterThanOrEqual(1);
      expect(m.bestImbalance).toBeLessThanOrEqual(m.imbalance + 1e-9);
    }
  });

  it("fits an Elo scale in range", () => {
    const { maps } = evaluate(data, DEFAULT_BALANCE_CONFIG);
    const { k } = fitScale(maps);
    expect(k).toBeGreaterThanOrEqual(0);
    expect(k).toBeLessThanOrEqual(3);
  });
});
