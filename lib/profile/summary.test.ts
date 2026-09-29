import { expect, it } from "vitest";
import { profileSummary, type ProfileMap } from "./summary";

const base: ProfileMap = {
  matchId: "m1",
  mixId: "mix",
  mixTitle: "Friday",
  mapNumber: 1,
  mapName: null,
  playedAt: "2026-09-29T20:00:00Z",
  scoreA: 13,
  scoreB: 7,
  team: "A",
  stats: null,
  teammates: [{ id: "mate", name: "Mate", steamId: "steam" }],
};

it("counts score-only maps in wins without inventing a rating", () => {
  const result = profileSummary([base]);
  expect(result).toMatchObject({
    mapCount: 1,
    wins: 1,
    ratedMaps: 0,
    rating: null,
    winRate: 1,
  });
  expect(result.bestTeammates[0]).toMatchObject({
    id: "mate",
    maps: 1,
    wins: 1,
  });
  expect(profileSummary([])).toMatchObject({
    mapCount: 0,
    winRate: null,
    rating: null,
  });
});

it("weights rated maps by rounds while all maps count toward win rate", () => {
  const result = profileSummary([
    base,
    {
      ...base,
      matchId: "m2",
      mapNumber: 2,
      scoreA: 5,
      scoreB: 13,
      stats: {
        kills: 10,
        deaths: 15,
        assists: 2,
        adr: 80,
        rounds: 18,
        rating: 0.9,
      },
    },
    {
      ...base,
      matchId: "m3",
      mapNumber: 3,
      stats: {
        kills: 22,
        deaths: 12,
        assists: 5,
        adr: 100,
        rounds: 26,
        rating: 1.2,
      },
    },
  ]);
  expect(result).toMatchObject({
    mapCount: 3,
    wins: 2,
    losses: 1,
    ratedMaps: 2,
    kills: 32,
  });
  expect(result.rating).toBeCloseTo((0.9 * 18 + 1.2 * 26) / 44);
  expect(result.winRate).toBeCloseTo(2 / 3);
});

it("keeps rating when FACEIT has no ADR for a map", () => {
  const result = profileSummary([
    {
      ...base,
      stats: {
        kills: 12,
        deaths: 8,
        assists: null,
        adr: null,
        rounds: 20,
        rating: 1.2,
      },
    },
  ]);
  expect(result.rating).toBe(1.2);
  expect(result.adr).toBeNull();
});
