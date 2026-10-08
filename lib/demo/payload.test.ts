import { describe, expect, it } from "vitest";
import { validateDemoImportPayload } from "./payload";

const players = Array.from({ length: 10 }, (_, i) => ({
  steamid: `7656119000000000${i}`,
  name: `Player ${i}`,
  teamId: i < 5 ? "one" : "two",
}));
const roundPlayers = players.map((p, i) => ({
  steamid: p.steamid,
  teamId: p.teamId,
  side: i < 5 ? 2 : 3,
  isAlive: true,
  health: 100,
}));
const valid = {
  version: 1,
  demoHash: "a".repeat(64),
  mapName: "de_mirage",
  tickRate: 64,
  regulationRounds: 24,
  players,
  rounds: [
    {
      startTick: 100,
      endTick: 200,
      scoreEndTick: 201,
      winnerTeamId: "one",
      players: roundPlayers,
    },
  ],
  events: [],
  endSnapshots: players.map((p, i) => ({
    steamid: p.steamid,
    tick: 200,
    team_num: i < 5 ? 2 : 3,
    is_alive: true,
    health: 100,
  })),
  controller: players.map((p) => ({
    steamid: p.steamid,
    kills: 0,
    deaths: 0,
    assists: 0,
    damage: 0,
  })),
};

describe("demo import boundary", () => {
  it("accepts a bounded complete replay", () => {
    expect(validateDemoImportPayload(valid).demoHash).toBe("a".repeat(64));
  });

  it("rejects duplicate identities and incomplete end evidence", () => {
    expect(() =>
      validateDemoImportPayload({
        ...valid,
        players: [valid.players[0], ...valid.players.slice(0, 9)],
      }),
    ).toThrow();
    expect(() =>
      validateDemoImportPayload({
        ...valid,
        endSnapshots: valid.endSnapshots.slice(1),
      }),
    ).toThrow();
  });

  it("rejects missing death coverage even when the client claims a living survivor", () => {
    const snapshots = valid.endSnapshots.map((row, i) =>
      i ? row : { ...row, is_alive: false, health: 0 },
    );
    expect(() =>
      validateDemoImportPayload({ ...valid, endSnapshots: snapshots }),
    ).toThrow("Incomplete round death coverage");
  });

  it("requires observed metadata for demo-only kill awards", () => {
    const death = {
      event_name: "player_death",
      tick: 150,
      attacker_steamid: players[1].steamid,
      user_steamid: players[5].steamid,
      assistedflash: false,
      headshot: false,
      weapon: "ak47",
    };
    expect(() =>
      validateDemoImportPayload({ ...valid, events: [death] }),
    ).toThrow();
  });
});
