import { describe, expect, it } from "vitest";
import { DEFAULT_BALANCE_CONFIG } from "@/lib/balance";
import { loadBacktestData } from "./data";
import { realEloAt, type RealEloRow, EU_QUEUE, eloAt } from "./elo-history";
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

describe("ELO reconstruction", () => {
  const r = (finishedAt: string, won: boolean, competitionId = EU_QUEUE) => ({
    finishedAt,
    won,
    gameMode: "5v5",
    competitionId,
  });
  const results = [
    r("2024-01-01T20:00:00Z", true),
    r("2024-06-01T20:00:00Z", true),
    r("2024-06-02T20:00:00Z", true),
    r("2024-06-03T20:00:00Z", false),
    r("2024-06-04T20:00:00Z", true, "some-hub"), // hub matches do not move ELO
  ];

  it("undoes ±25 per queue match after the moment", () => {
    expect(eloAt(2000, results, new Date("2024-05-01T00:00:00Z"))).toEqual({
      elo: 1975, // 2000 − 25 − 25 + 25
      matchesWalkedBack: 3,
      rebuilt: true,
    });
    expect(eloAt(2000, results, new Date("2025-01-01T00:00:00Z")).elo).toBe(
      2000,
    );
  });

  it("keeps today's ELO for a player whose account did not exist yet", () => {
    expect(eloAt(1866, results, new Date("2023-06-01T00:00:00Z"))).toEqual({
      elo: 1866,
      matchesWalkedBack: 0,
      rebuilt: false,
    });
  });

  it("never goes below the FACEIT floor", () => {
    const first = r("2024-06-30T00:00:00Z", false);
    const wins = Array.from({ length: 100 }, (_, i) =>
      r(new Date(Date.UTC(2024, 6, 1 + i)).toISOString(), true),
    );
    expect(
      eloAt(500, [first, ...wins], new Date("2024-06-30T12:00:00Z")).elo,
    ).toBe(100);
  });
});

describe("realEloAt", () => {
  const rows: RealEloRow[] = [
    [Date.parse("2024-12-20T20:00:00Z") / 1000, 1520, 20, 1, null],
    [Date.parse("2024-12-10T20:00:00Z") / 1000, 1500, -25, 1, null],
  ];
  it("takes the ELO after the last match before the moment", () => {
    expect(realEloAt(rows, new Date("2024-12-15T00:00:00Z"))).toBe(1500);
  });
  it("uses the ELO before the first later match when nothing is earlier", () => {
    expect(realEloAt(rows, new Date("2024-12-01T00:00:00Z"))).toBe(1525);
  });
  it("is null without history", () => {
    expect(realEloAt([], new Date())).toBeNull();
  });
});
