import { describe, expect, it } from "vitest";
import { groupMixResults, groupStatsSummary } from "./stats-summary";

describe("groupStatsSummary", () => {
  it("separates provenance and weights available ratings by rounds", () => {
    const result = groupStatsSummary(
      [{ id: "mix" }],
      [
        {
          id: "one",
          mix_id: "mix",
          map_name: "Mirage",
          map_number: 1,
          score_a: 13,
          score_b: 8,
          source: "manual",
          stats_origin: "popflash",
        },
        {
          id: "two",
          mix_id: "mix",
          map_name: "Nuke",
          map_number: 2,
          score_a: 4,
          score_b: 13,
          source: "faceit",
          stats_origin: null,
        },
        {
          id: "three",
          mix_id: "mix",
          map_name: null,
          map_number: 3,
          score_a: 13,
          score_b: 9,
          source: "manual",
          stats_origin: null,
        },
      ],
      [
        {
          match_id: "one",
          player_id: "p",
          team: "A",
          kills: 20,
          deaths: 10,
          assists: 5,
          adr: 100,
          rounds: 21,
          rating: 1.5,
        },
        {
          match_id: "two",
          player_id: "p",
          team: "A",
          kills: 10,
          deaths: 20,
          assists: 2,
          adr: 50,
          rounds: 17,
          rating: 0.5,
        },
      ],
      [{ id: "p", steam_id: "steam", display_name: "Player" }],
    );
    expect(result).toMatchObject({
      mixes: 1,
      maps: 3,
      players: 1,
      sources: { popflash: 1, faceit: 1, manual: 1, demo: 0 },
    });
    expect(result.leaderboard[0]).toMatchObject({
      maps: 2,
      wins: 1,
      losses: 1,
      kills: 30,
      deaths: 30,
      adr: (2100 + 850) / 38,
      rating: (31.5 + 8.5) / 38,
    });
  });
});

describe("groupMixResults", () => {
  it("shows the evening score and only the viewer's recorded lines", () => {
    const maps = [
      {
        id: "a",
        mix_id: "mix",
        map_name: "Mirage",
        map_number: 1,
        score_a: 10,
        score_b: 13,
        source: "manual",
        stats_origin: "popflash",
      },
      {
        id: "b",
        mix_id: "mix",
        map_name: "Nuke",
        map_number: 2,
        score_a: 16,
        score_b: 12,
        source: "manual",
        stats_origin: "popflash",
      },
    ];
    const stats = [
      {
        match_id: "a",
        player_id: "me",
        team: "A" as const,
        kills: 10,
        deaths: 15,
        assists: 4,
        adr: 70,
        rounds: 23,
        rating: 0.8,
      },
      {
        match_id: "b",
        player_id: "me",
        team: "A" as const,
        kills: 25,
        deaths: 13,
        assists: 6,
        adr: 90,
        rounds: 28,
        rating: 1.3,
      },
      {
        match_id: "a",
        player_id: "other",
        team: "B" as const,
        kills: 30,
        deaths: 10,
        assists: 2,
        adr: 120,
        rounds: 23,
        rating: 1.6,
      },
    ];
    expect(groupMixResults(maps, stats, "me").mix).toMatchObject({
      wonA: 1,
      wonB: 1,
      draws: 0,
      maps: [
        { name: "Mirage", a: 10, b: 13 },
        { name: "Nuke", a: 16, b: 12 },
      ],
      own: { kills: 35, deaths: 28, rating: (0.8 * 23 + 1.3 * 28) / 51 },
    });
    expect(groupMixResults(maps, stats, null).mix.own).toBeNull();
  });
});
