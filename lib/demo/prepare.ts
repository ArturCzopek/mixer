import type { DemoEvent, DemoRound, DemoRoundPlayer } from "./stats";

export type DemoTimelineEvent = {
  event_name: string;
  tick: number;
  winner?: string | null;
};

export type DemoPlayerIdentity = { steamid: string; teamId: string };
export type DemoPlayerSnapshot = {
  steamid: string;
  tick: number;
  team_num: number;
  is_alive: boolean;
  health: number;
};

/** Adapts a complete replay, using observed sides rather than a halftime/OT formula. */
export function prepareDemoRounds(input: {
  players: DemoPlayerIdentity[];
  timeline: DemoTimelineEvent[];
  snapshots: DemoPlayerSnapshot[];
  events: DemoEvent[];
}): DemoRound[] {
  const identities = new Map(
    input.players.map((player) => [player.steamid, player.teamId]),
  );
  if (
    !identities.size ||
    identities.size !== input.players.length ||
    input.players.some((player) => !player.steamid || !player.teamId) ||
    new Set(identities.values()).size !== 2
  ) {
    throw new Error("Invalid replay roster");
  }
  for (const event of [...input.timeline, ...input.events]) {
    if (!Number.isSafeInteger(event.tick) || event.tick < 0)
      throw new Error("Invalid replay tick");
  }
  const starts = input.timeline.filter(
    (event) => event.event_name === "round_announce_match_start",
  );
  if (!starts.length) throw new Error("Missing live match start");
  const liveTick = Math.max(...starts.map((event) => event.tick));
  const timeline = [...input.timeline].sort((a, b) => a.tick - b.tick);
  const ends = timeline.filter(
    (event) => event.event_name === "round_end" && event.tick > liveTick,
  );
  if (!ends.length) throw new Error("No completed live rounds");
  const lastTick = Math.max(
    ...timeline.map((event) => event.tick),
    ...input.events.map((event) => event.tick),
  );

  function snapshot(tick: number): DemoRoundPlayer[] {
    const rows = input.snapshots.filter(
      (row) => row.tick === tick && identities.has(row.steamid),
    );
    if (
      rows.length !== identities.size ||
      new Set(rows.map((row) => row.steamid)).size !== identities.size
    ) {
      throw new Error(`Incomplete player snapshot at tick ${tick}`);
    }
    return rows.map((row) => {
      if (
        (row.team_num !== 2 && row.team_num !== 3) ||
        typeof row.is_alive !== "boolean" ||
        !Number.isSafeInteger(row.health) ||
        row.health < 0 ||
        row.health > 100 ||
        row.is_alive !== row.health > 0
      )
        throw new Error(`Invalid player snapshot at tick ${tick}`);
      return {
        steamid: row.steamid,
        teamId: identities.get(row.steamid)!,
        side: row.team_num,
        isAlive: row.is_alive,
        health: row.health,
      };
    });
  }

  const rounds = ends.map((end, index): DemoRound => {
    const previousEnd = index ? ends[index - 1].tick : liveTick - 1;
    const freeze = timeline
      .filter(
        (event) =>
          event.event_name === "round_freeze_end" &&
          event.tick > previousEnd &&
          event.tick <= end.tick,
      )
      .at(-1);
    if (!freeze)
      throw new Error(`Missing live round start before tick ${end.tick}`);
    const players = snapshot(freeze.tick);
    const winnerSide =
      end.winner === "T" ? 2 : end.winner === "CT" ? 3 : undefined;
    const winners = players.filter((player) => player.side === winnerSide);
    const winnerTeams = new Set(winners.map((player) => player.teamId));
    if (winnerTeams.size !== 1)
      throw new Error(`Invalid winner at tick ${end.tick}`);
    const sides = new Map<string, number>();
    for (const player of players) {
      if (
        sides.has(player.teamId) &&
        sides.get(player.teamId) !== player.side
      ) {
        throw new Error(`Split team at tick ${freeze.tick}`);
      }
      sides.set(player.teamId, player.side);
    }
    if (new Set(sides.values()).size !== 2)
      throw new Error(`Invalid team sides at tick ${freeze.tick}`);

    const nextStart = timeline.find(
      (event) => event.event_name === "round_start" && event.tick > end.tick,
    );
    if (
      index < ends.length - 1 &&
      (!nextStart || nextStart.tick > ends[index + 1].tick)
    ) {
      throw new Error(`Missing next round boundary after tick ${end.tick}`);
    }
    const scoreEndTick = nextStart?.tick ?? lastTick + 1;
    const alive = new Set(
      players
        .filter((player) => player.isAlive)
        .map((player) => player.steamid),
    );
    for (const event of input.events) {
      if (
        event.tick < freeze.tick ||
        event.tick > end.tick ||
        event.event_name !== "player_death"
      )
        continue;
      if (!event.user_steamid || !alive.delete(event.user_steamid)) {
        throw new Error(`Invalid death coverage at tick ${event.tick}`);
      }
    }
    for (const player of snapshot(end.tick)) {
      if (alive.has(player.steamid) !== player.isAlive) {
        throw new Error(`Incomplete death coverage at tick ${end.tick}`);
      }
    }
    return {
      startTick: freeze.tick,
      endTick: end.tick,
      scoreEndTick,
      winnerTeamId: [...winnerTeams][0],
      players,
    };
  });
  if (
    timeline.some(
      (event) =>
        event.event_name === "round_freeze_end" &&
        event.tick > ends.at(-1)!.tick,
    )
  ) {
    throw new Error("Replay contains an unfinished live round");
  }
  return rounds;
}
