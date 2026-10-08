import { expect, it } from "vitest";
import type { DemoImportPayload } from "@/lib/demo/payload";
import { validateDemoForMatch, type DemoMatchPlayer } from "./validation";

const players: DemoMatchPlayer[] = Array.from({ length: 10 }, (_, index) => ({
  steamId: `7656119796026572${index}`,
  team: index < 5 ? "A" : "B",
}));

function payload(
  overrides: Partial<DemoImportPayload> = {},
): DemoImportPayload {
  const roster = players.map((player, index) => ({
    steamid: player.steamId,
    name: `Player ${index + 1}`,
    teamId: player.team === "A" ? "demo-a" : "demo-b",
  }));
  const teamId = (team: "A" | "B") => (team === "A" ? "demo-a" : "demo-b");
  const rounds = ["A", "A", "A", "B", "B"].map((team, index) => ({
    startTick: index * 100,
    endTick: index * 100 + 80,
    scoreEndTick: index * 100 + 100,
    winnerTeamId: teamId(team as "A" | "B"),
    players: roster.map((player, playerIndex) => ({
      steamid: player.steamid,
      teamId: player.teamId,
      side: playerIndex < 5 ? (2 as const) : (3 as const),
      isAlive: true,
      health: 100,
    })),
  }));
  return {
    version: 1,
    demoHash: "a".repeat(64),
    mapName: "de_mirage",
    tickRate: 64,
    regulationRounds: null,
    players: roster,
    rounds,
    events: [],
    endSnapshots: [],
    controller: roster.map((player) => ({
      steamid: player.steamid,
      kills: 0,
      deaths: 0,
      assists: 0,
      damage: 0,
    })),
    ...overrides,
  };
}

const target = {
  mapName: "1. Mirage",
  scoreA: 3,
  scoreB: 2,
  players,
};

it("accepts a matching map, exact lineup, teams, and result", () => {
  const result = validateDemoForMatch(payload(), target);
  expect(result.valid).toBe(true);
  if (result.valid) {
    expect(result.teamById.get("demo-a")).toBe("A");
    expect(result.teamById.get("demo-b")).toBe("B");
  }
});

it("can fill an unnamed manual map only when its roster and score match", () => {
  expect(
    validateDemoForMatch(payload(), { ...target, mapName: "" }).valid,
  ).toBe(true);
  expect(
    validateDemoForMatch(payload(), { ...target, mapName: "", scoreA: 4 }),
  ).toMatchObject({ valid: false, reason: "score" });
});

it("rejects a different map, a swapped teammate, or a different score", () => {
  expect(
    validateDemoForMatch(payload({ mapName: "de_nuke" }), target),
  ).toMatchObject({ valid: false, reason: "map" });

  const changedRoster = players.map((player, index) =>
    index === 0 ? { ...player, steamId: "76561197960265999" } : player,
  );
  expect(
    validateDemoForMatch(payload(), { ...target, players: changedRoster }),
  ).toEqual({ valid: false, reason: "roster" });
  expect(
    validateDemoForMatch(payload(), { ...target, scoreA: 2, scoreB: 3 }),
  ).toMatchObject({ valid: false, reason: "score", score: { a: 3, b: 2 } });
});
