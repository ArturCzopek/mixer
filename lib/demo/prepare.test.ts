import { describe, expect, it } from "vitest";
import {
  prepareDemoRounds,
  type DemoPlayerSnapshot,
  type DemoTimelineEvent,
} from "./prepare";
import type { DemoEvent } from "./stats";

function replay() {
  const timeline: DemoTimelineEvent[] = [
    { event_name: "round_announce_match_start", tick: 1 },
    { event_name: "round_freeze_end", tick: 2 },
    { event_name: "round_end", tick: 5, winner: "CT" },
    { event_name: "round_announce_match_start", tick: 10 },
    { event_name: "round_freeze_end", tick: 10 },
    { event_name: "round_end", tick: 20, winner: "T" },
    { event_name: "round_start", tick: 25 },
    { event_name: "round_freeze_end", tick: 30 },
    { event_name: "round_end", tick: 40, winner: "CT" },
  ];
  const snapshots: DemoPlayerSnapshot[] = [10, 20, 30, 40].flatMap((tick) => [
    {
      steamid: "a",
      tick,
      team_num: tick < 30 ? 2 : 3,
      is_alive: true,
      health: 100,
    },
    {
      steamid: "b",
      tick,
      team_num: tick < 30 ? 3 : 2,
      is_alive: tick !== 20,
      health: tick === 20 ? 0 : 100,
    },
  ]);
  const events: DemoEvent[] = [
    {
      event_name: "player_death",
      tick: 15,
      user_steamid: "b",
      attacker_steamid: "a",
      headshot: false,
      assistedflash: false,
    },
  ];
  return {
    players: [
      { steamid: "a", teamId: "A" },
      { steamid: "b", teamId: "B" },
    ],
    timeline,
    snapshots,
    events,
  };
}

describe("prepareDemoRounds", () => {
  it("excludes knife/restart rounds and includes freeze on the live-start tick", () => {
    const rounds = prepareDemoRounds(replay());
    expect(rounds).toHaveLength(2);
    expect(rounds[0]).toMatchObject({
      startTick: 10,
      endTick: 20,
      scoreEndTick: 25,
      winnerTeamId: "A",
    });
  });

  it("maps winners from actual side snapshots even when round counters are unavailable", () => {
    const rounds = prepareDemoRounds(replay());
    expect(rounds.map((round) => round.winnerTeamId)).toEqual(["A", "A"]);
    expect(rounds[1].players[0].side).toBe(3);
  });

  it("keeps post-round combat inside the scoreboard boundary", () => {
    const input = replay();
    input.events.push({
      event_name: "player_hurt",
      tick: 45,
      user_steamid: "a",
      health: 90,
      dmg_health: 10,
    });
    expect(prepareDemoRounds(input)[1].scoreEndTick).toBe(46);
  });

  it("rejects missing start or end snapshots and duplicate identities", () => {
    const input = replay();
    input.snapshots = input.snapshots.filter(
      (row) => !(row.tick === 10 && row.steamid === "b"),
    );
    expect(() => prepareDemoRounds(input)).toThrow(
      "Incomplete player snapshot",
    );
    const missingEnd = replay();
    missingEnd.snapshots = missingEnd.snapshots.filter(
      (row) => row.tick !== 20,
    );
    expect(() => prepareDemoRounds(missingEnd)).toThrow(
      "Incomplete player snapshot",
    );
    const duplicate = replay();
    duplicate.players.push(duplicate.players[0]);
    expect(() => prepareDemoRounds(duplicate)).toThrow("Invalid replay roster");
  });

  it("rejects incomplete death events instead of inventing survival or KAST", () => {
    const input = replay();
    input.events = [];
    expect(() => prepareDemoRounds(input)).toThrow("Incomplete death coverage");
  });

  it("rejects duplicate deaths", () => {
    const input = replay();
    input.events.push(input.events[0]);
    expect(() => prepareDemoRounds(input)).toThrow("Invalid death coverage");
  });

  it("rejects missing boundaries and an unfinished last round", () => {
    const input = replay();
    input.timeline = input.timeline.filter(
      (event) => event.event_name !== "round_start",
    );
    expect(() => prepareDemoRounds(input)).toThrow(
      "Missing next round boundary",
    );
    const unfinished = replay();
    unfinished.timeline.push({ event_name: "round_freeze_end", tick: 50 });
    expect(() => prepareDemoRounds(unfinished)).toThrow(
      "unfinished live round",
    );
  });

  it("rejects unknown winners, split teams, and invalid snapshot health", () => {
    const input = replay();
    input.timeline.find((event) => event.tick === 20)!.winner = null;
    expect(() => prepareDemoRounds(input)).toThrow("Invalid winner");
    const invalid = replay();
    invalid.snapshots[0].health = 0;
    expect(() => prepareDemoRounds(invalid)).toThrow("Invalid player snapshot");
    const split = replay();
    split.players.push({ steamid: "c", teamId: "A" });
    split.snapshots.push(
      ...[10, 20, 30, 40].map((tick) => ({
        steamid: "c",
        tick,
        team_num: tick < 30 ? 3 : 2,
        is_alive: true,
        health: 100,
      })),
    );
    expect(() => prepareDemoRounds(split)).toThrow("Split team");
  });
});
