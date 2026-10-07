import { describe, expect, it } from "vitest";
import {
  analyticsSummary,
  type AnalyticsMap,
  type AnalyticsStat,
} from "./analytics-summary";

const players = [
  { id: "a", steam_id: "100", display_name: "Alpha" },
  { id: "b", steam_id: "200", display_name: "Bravo" },
];
const mixes = [
  { id: "old", chosen_variant_id: "v1", archive_source: "popflash" },
  { id: "new", chosen_variant_id: "v2", archive_source: null },
];
const maps: AnalyticsMap[] = [
  {
    id: "old1",
    mix_id: "old",
    map_number: 1,
    map_name: "de_mirage",
    played_at: "2026-01-01T20:00:00Z",
    score_a: 13,
    score_b: 9,
    source: "manual",
    stats_origin: "popflash",
  },
  {
    id: "new1",
    mix_id: "new",
    map_number: 1,
    map_name: "Mirage",
    played_at: "2026-10-01T20:00:00Z",
    score_a: 8,
    score_b: 8,
    source: "manual",
    stats_origin: null,
  },
  {
    id: "new2",
    mix_id: "new",
    map_number: 2,
    map_name: "Nuke",
    played_at: "2026-10-06T20:00:00Z",
    score_a: 13,
    score_b: 7,
    source: "manual",
    stats_origin: "faceit",
  },
];
const base: AnalyticsStat = {
  match_id: "old1",
  player_id: "a",
  team: "A",
  kills: 20,
  deaths: 10,
  assists: 4,
  adr: 100,
  rounds: 22,
  rating: 1.5,
  hs_kills: null,
  first_kills: null,
  clutch_wins: null,
  utility_damage: null,
  enemies_flashed: null,
  multi_4k: null,
  multi_5k: null,
};
const stats: AnalyticsStat[] = [
  base,
  {
    ...base,
    match_id: "new2",
    kills: null,
    deaths: 0,
    assists: 5,
    adr: null,
    rounds: 20,
    rating: null,
  },
  {
    ...base,
    match_id: "new2",
    player_id: "b",
    kills: 0,
    deaths: 0,
    assists: 5,
    adr: null,
    rounds: 20,
    rating: null,
  },
];
const lineups = [
  { variant_id: "v1", player_id: "a", team: "A" as const },
  { variant_id: "v1", player_id: "b", team: "A" as const },
  { variant_id: "v2", player_id: "a", team: "A" as const },
  { variant_id: "v2", player_id: "b", team: "A" as const },
];
const participants = [
  { mix_id: "new", player_id: "b", created_at: "2026-10-01T10:00:00Z" },
  { mix_id: "new", player_id: "a", created_at: "2026-10-01T11:00:00Z" },
];
const summarize = (
  period: "all" | "30" = "all",
  archive: "all" | "current" | "archive" = "all",
) =>
  analyticsSummary(
    mixes,
    maps,
    stats,
    players,
    lineups,
    participants,
    { period, archive },
    new Date("2026-10-07T00:00:00Z"),
  );

describe("analyticsSummary", () => {
  it("filters whole evenings by latest map and archive source", () => {
    const recent = summarize("30");
    expect(recent.totals).toMatchObject({
      evenings: 1,
      maps: 2,
      scoreOnlyMaps: 1,
      archives: 0,
      current: 1,
      sources: { manual: 1, faceit: 1 },
    });
    expect(recent.mapPerformance.map((row) => row.name)).toEqual([
      "Mirage",
      "Nuke",
    ]);
    expect(summarize("all", "archive").totals).toMatchObject({
      evenings: 1,
      maps: 1,
      archives: 1,
      sources: { popflash: 1 },
    });
    expect(
      summarize().mapPerformance.find((row) => row.name === "Mirage")?.maps,
    ).toBe(2);
  });

  it("counts score-only outcomes without inventing metrics and keeps draws", () => {
    const recent = summarize("30");
    expect(
      recent.leaderboard.find((row) => row.playerId === "a"),
    ).toMatchObject({
      maps: 2,
      evenings: 1,
      wins: 1,
      draws: 1,
      ratedMaps: 0,
      rating: null,
      adr: null,
      kills: null,
      killsMaps: 0,
      deaths: 0,
      deathsMaps: 1,
      kd: null,
      kdMaps: 0,
    });
    expect(recent.teammatePairs).toMatchObject([
      { maps: 2, evenings: 1, wins: 1, draws: 1, eligible: false },
    ]);
    expect(
      recent.mapPerformance.find((row) => row.name === "Mirage"),
    ).toMatchObject({
      winsA: 0,
      winsB: 0,
      draws: 1,
      players: expect.arrayContaining([
        expect.objectContaining({ maps: 1, rating: null }),
      ]),
    });
  });

  it("weights observed rating by rounds and uses stable join order for award ties", () => {
    const all = summarize();
    expect(all.leaderboard.find((row) => row.playerId === "a")).toMatchObject({
      maps: 3,
      ratedMaps: 1,
      rating: 1.5,
      adrMaps: 1,
      adr: 100,
      kills: 20,
      killsMaps: 1,
      kd: 2,
      kdMaps: 1,
    });
    expect(
      all.awards.find((row) => row.key === "assistKing")?.leaders[0],
    ).toMatchObject({ playerId: "b", count: 1 });
  });

  it("marks pairs eligible at five recorded same-side maps", () => {
    const fiveMaps = Array.from({ length: 5 }, (_, index) => ({
      ...maps[1],
      id: `score${index}`,
      map_number: index + 1,
    }));
    const result = analyticsSummary(
      [mixes[1]],
      fiveMaps,
      [],
      players,
      lineups,
      participants,
      { period: "all", archive: "current" },
    );
    expect(result.teammatePairs).toMatchObject([
      { maps: 5, evenings: 1, eligible: true, draws: 5 },
    ]);
    expect(result.leaderboard[0]).toMatchObject({
      maps: 5,
      ratedMaps: 0,
      kdMaps: 0,
      rating: null,
    });
  });

  it("weights two observed maps by rounds and uses each map's recorded team", () => {
    const result = analyticsSummary(
      [mixes[1]],
      [maps[1], maps[2]],
      [
        {
          ...base,
          match_id: "new1",
          rounds: 10,
          rating: 2,
          adr: 100,
          team: "B",
        },
        {
          ...base,
          match_id: "new2",
          rounds: 30,
          rating: 1,
          adr: 50,
          team: "A",
        },
      ],
      players,
      lineups,
      participants,
      { period: "all", archive: "current" },
    );
    expect(result.leaderboard[0]).toMatchObject({
      maps: 2,
      draws: 1,
      wins: 1,
      rating: 1.25,
      adr: 62.5,
      ratedMaps: 2,
      adrMaps: 2,
    });
    expect(result.teammatePairs).toEqual([]);
  });

  it("excludes recorded outsiders from evening awards, matching the played page", () => {
    const outsider = {
      id: "outsider",
      steam_id: "300",
      display_name: "Outsider",
    };
    const result = analyticsSummary(
      [mixes[1]],
      [maps[2]],
      [{ ...base, match_id: "new2", player_id: outsider.id, assists: 20 }],
      [...players, outsider],
      lineups,
      participants,
      { period: "all", archive: "current" },
    );
    expect(result.leaderboard[0]).toMatchObject({
      playerId: outsider.id,
      assists: 20,
    });
    expect(result.awards).toEqual([]);
  });
});
