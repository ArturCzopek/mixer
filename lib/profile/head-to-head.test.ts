import { expect, it } from "vitest";
import { headToHead } from "./head-to-head";
import type { ProfileMap } from "./summary";

const base: ProfileMap = {
  matchId: "map-1",
  mixId: "mix-1",
  mixTitle: "Friday",
  mapNumber: 1,
  mapName: null,
  playedAt: "2026-10-01T20:00:00Z",
  scoreA: 13,
  scoreB: 8,
  team: "B",
  stats: null,
  teammates: [],
};

it("counts opponent wins from each player's side, including score-only maps and draws", () => {
  const a: ProfileMap[] = [
    base,
    { ...base, matchId: "map-2", mapNumber: 2, scoreA: 5, scoreB: 13 },
    { ...base, matchId: "map-3", mapNumber: 3, scoreA: 12, scoreB: 12 },
    { ...base, matchId: "unshared", mixId: "another-mix" },
  ];
  const b = a.slice(0, 3).map((map) => ({ ...map, team: "A" as const }));
  const result = headToHead(a, b);
  expect(result).toMatchObject({
    sharedMaps: 3,
    sharedMixes: 1,
    against: { maps: 3, aWins: 1, bWins: 1, draws: 1 },
    together: { maps: 0, wins: 0, losses: 0, draws: 0 },
  });
  expect(result.maps.map((map) => map.matchId)).toEqual([
    "map-3",
    "map-2",
    "map-1",
  ]);
  expect(result.maps[2]).toMatchObject({
    mapName: "#1",
    teamA: "B",
    teamB: "A",
    outcomeA: "loss",
  });
  expect(headToHead(b, a).maps[2].outcomeA).toBe("win");
});

it("separates teammate outcomes and counts distinct evenings without mutating inputs", () => {
  const a: ProfileMap[] = [
    base,
    {
      ...base,
      matchId: "map-2",
      mixId: "mix-2",
      scoreA: 5,
      scoreB: 13,
      playedAt: "2026-10-02T20:00:00Z",
    },
    { ...base, matchId: "map-3", mixId: "mix-2", scoreA: 12, scoreB: 12 },
  ];
  const b = [...a].reverse();
  const result = headToHead(a, b);
  expect(result).toMatchObject({
    sharedMaps: 3,
    sharedMixes: 2,
    against: { maps: 0, aWins: 0, bWins: 0, draws: 0 },
    together: { maps: 3, wins: 1, losses: 1, draws: 1 },
  });
  expect(result.maps[0].matchId).toBe("map-2");
  expect(a[0].matchId).toBe("map-1");
  expect(b[0].matchId).toBe("map-3");
  expect(headToHead(a, [])).toMatchObject({
    sharedMaps: 0,
    sharedMixes: 0,
    maps: [],
  });
});
