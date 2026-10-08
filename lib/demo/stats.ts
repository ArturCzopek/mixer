/** Stable teams and start-of-round health are supplied by the replay adapter. */
export type DemoRoundPlayer = {
  steamid: string;
  teamId: string;
  side: 2 | 3;
  isAlive: boolean;
  health: number;
};

export type DemoRound = {
  startTick: number;
  endTick: number;
  /** Exclusive scoreboard boundary, usually the next round_start tick. */
  scoreEndTick: number;
  winnerTeamId: string;
  players: DemoRoundPlayer[];
};

export type DemoEvent = {
  event_name: "player_death" | "player_hurt" | "player_blind";
  tick: number;
  attacker_steamid?: string | null;
  user_steamid?: string | null;
  assister_steamid?: string | null;
  assistedflash?: boolean;
  headshot?: boolean;
  dmg_health?: number;
  health?: number;
  weapon?: string;
  blind_duration?: number;
};

export type DemoPlayerStats = {
  steamid: string;
  teamId: string;
  roundsPlayed: number;
  kills: number;
  deaths: number;
  assists: number;
  kpr: number;
  dpr: number;
  apr: number;
  enemyDamage: number;
  adr: number;
  headshotKills: number;
  headshotPercent: number;
  openingKills: number;
  openingDeaths: number;
  tradeKills: number;
  tradedDeaths: number;
  kastRounds: number;
  kastPercent: number;
  multikills: { 2: number; 3: number; 4: number; 5: number };
  clutchAttempts: Record<number, number>;
  clutchWins: Record<number, number>;
  utilityDamage: number;
  enemiesFlashed: number;
  teammatesFlashed: number;
  flashAssists: number;
};

type MutableStats = DemoPlayerStats;

const utilityWeapons = new Set([
  "hegrenade",
  "inferno",
  "molotov",
  "incgrenade",
]);

function integer(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error(`Invalid ${label}`);
}

function identity(value: string | null | undefined): string | undefined {
  return value && value !== "0" ? value : undefined;
}

function requirePlayer(
  id: string | undefined,
  roster: Map<string, DemoRoundPlayer>,
  label: string,
) {
  if (!id) throw new Error(`Missing ${label}`);
  const player = roster.get(id);
  if (!player) throw new Error(`Unknown ${label}: ${id}`);
  return player;
}

/** Computes event-derived match stats; rejects gaps that would require guessing KAST or survival. */
export function calculateDemoStats(input: {
  tickRate: number;
  rounds: DemoRound[];
  events: DemoEvent[];
}): DemoPlayerStats[] {
  if (!Number.isFinite(input.tickRate) || input.tickRate <= 0)
    throw new Error("Invalid tickRate");
  if (input.rounds.length === 0) throw new Error("No completed rounds");

  const stats = new Map<string, MutableStats>();
  let previousScoreEnd = -1;
  let firstRoster: Set<string> | undefined;
  const stableTeams = new Map<string, string>();

  for (const round of input.rounds) {
    integer(round.startTick, "startTick");
    integer(round.endTick, "endTick");
    integer(round.scoreEndTick, "scoreEndTick");
    if (
      round.startTick < previousScoreEnd ||
      round.endTick < round.startTick ||
      round.scoreEndTick <= round.endTick
    ) {
      throw new Error("Overlapping or incomplete round boundaries");
    }
    previousScoreEnd = round.scoreEndTick;
    if (!round.players.length) throw new Error("Missing round roster");
    const roster = new Map<string, DemoRoundPlayer>();
    const sideByTeam = new Map<string, number>();
    for (const player of round.players) {
      if (!player.steamid || !player.teamId || roster.has(player.steamid))
        throw new Error("Invalid round roster");
      if (
        (player.side !== 2 && player.side !== 3) ||
        typeof player.isAlive !== "boolean"
      )
        throw new Error("Invalid round player state");
      integer(player.health, "start health");
      if (
        player.health > 100 ||
        (player.isAlive && player.health === 0) ||
        (!player.isAlive && player.health !== 0)
      ) {
        throw new Error("Invalid start health/alive state");
      }
      if (
        sideByTeam.has(player.teamId) &&
        sideByTeam.get(player.teamId) !== player.side
      )
        throw new Error("Inconsistent round sides");
      sideByTeam.set(player.teamId, player.side);
      if (
        stableTeams.has(player.steamid) &&
        stableTeams.get(player.steamid) !== player.teamId
      )
        throw new Error("Player changed stable team");
      stableTeams.set(player.steamid, player.teamId);
      roster.set(player.steamid, player);
      if (!stats.has(player.steamid)) {
        stats.set(player.steamid, {
          steamid: player.steamid,
          teamId: player.teamId,
          roundsPlayed: 0,
          kills: 0,
          deaths: 0,
          assists: 0,
          kpr: 0,
          dpr: 0,
          apr: 0,
          enemyDamage: 0,
          adr: 0,
          headshotKills: 0,
          headshotPercent: 0,
          openingKills: 0,
          openingDeaths: 0,
          tradeKills: 0,
          tradedDeaths: 0,
          kastRounds: 0,
          kastPercent: 0,
          multikills: { 2: 0, 3: 0, 4: 0, 5: 0 },
          clutchAttempts: {},
          clutchWins: {},
          utilityDamage: 0,
          enemiesFlashed: 0,
          teammatesFlashed: 0,
          flashAssists: 0,
        });
      }
    }
    if (
      sideByTeam.size !== 2 ||
      new Set(sideByTeam.values()).size !== 2 ||
      !sideByTeam.has(round.winnerTeamId)
    ) {
      throw new Error("Invalid winner or team sides");
    }
    const currentRoster = new Set(roster.keys());
    if (
      firstRoster &&
      (firstRoster.size !== currentRoster.size ||
        [...firstRoster].some((id) => !currentRoster.has(id)))
    ) {
      throw new Error("Incomplete round roster");
    }
    firstRoster ??= currentRoster;
  }

  let previousTick = -1;
  for (const event of input.events) {
    integer(event.tick, "event tick");
    if (event.tick < previousTick)
      throw new Error("Events must be ordered by tick");
    previousTick = event.tick;
  }

  let eventIndex = 0;
  for (const round of input.rounds) {
    while (
      eventIndex < input.events.length &&
      input.events[eventIndex].tick < round.startTick
    )
      eventIndex++;
    const roster = new Map(
      round.players.map((player) => [player.steamid, player]),
    );
    const health = new Map(
      round.players.map((player) => [player.steamid, player.health]),
    );
    const alive = new Set(
      round.players
        .filter((player) => player.isAlive)
        .map((player) => player.steamid),
    );
    const scoreboardAlive = new Set(alive);
    const kast = new Set<string>();
    const roundKills = new Map<string, number>();
    const traded = new Set<string>();
    const clutch = new Map<string, number>();
    const pendingDeaths: { victim: string; killer: string; tick: number }[] =
      [];
    let opened = false;

    const checkClutch = () => {
      for (const player of round.players) {
        if (!alive.has(player.steamid) || clutch.has(player.steamid)) continue;
        const friends = round.players.filter(
          (other) => alive.has(other.steamid) && other.teamId === player.teamId,
        );
        const enemies = round.players.filter(
          (other) => alive.has(other.steamid) && other.teamId !== player.teamId,
        );
        if (friends.length === 1 && enemies.length > 0)
          clutch.set(player.steamid, enemies.length);
      }
    };
    checkClutch();

    while (
      eventIndex < input.events.length &&
      input.events[eventIndex].tick < round.scoreEndTick
    ) {
      const event = input.events[eventIndex++];
      const live = event.tick <= round.endTick;
      const victimId = identity(event.user_steamid);
      const attackerId = identity(event.attacker_steamid);

      if (event.event_name === "player_hurt") {
        const victim = requirePlayer(victimId, roster, "hurt victim");
        if (event.dmg_health === undefined || event.health === undefined)
          throw new Error("Missing hurt damage/health");
        integer(event.dmg_health, "dmg_health");
        integer(event.health, "hurt health");
        if (event.health > 100) throw new Error("Invalid hurt health");
        const before = health.get(victim.steamid)!;
        if (event.health > before)
          throw new Error("Health increased within a round");
        health.set(victim.steamid, event.health);
        if (!attackerId) continue;
        const attacker = requirePlayer(attackerId, roster, "hurt attacker");
        if (attacker.teamId === victim.teamId) continue;
        // CS2 can round dmg_health one point below the authoritative health change.
        const amount = before - event.health;
        stats.get(attackerId)!.enemyDamage += amount;
        if (utilityWeapons.has(event.weapon ?? ""))
          stats.get(attackerId)!.utilityDamage += amount;
      } else if (event.event_name === "player_blind") {
        const victim = requirePlayer(victimId, roster, "blind victim");
        if (
          event.blind_duration === undefined ||
          !Number.isFinite(event.blind_duration) ||
          event.blind_duration < 0
        ) {
          throw new Error("Missing or invalid blind duration");
        }
        if (!attackerId) continue;
        const attacker = requirePlayer(attackerId, roster, "blind attacker");
        if (event.blind_duration > 0.5 && attackerId !== victim.steamid) {
          const field =
            attacker.teamId === victim.teamId
              ? "teammatesFlashed"
              : "enemiesFlashed";
          stats.get(attackerId)![field]++;
        }
      } else if (event.event_name === "player_death") {
        const victim = requirePlayer(victimId, roster, "death victim");
        if (
          typeof event.headshot !== "boolean" ||
          typeof event.assistedflash !== "boolean"
        )
          throw new Error("Missing death flags");
        const attacker = attackerId
          ? requirePlayer(attackerId, roster, "death attacker")
          : undefined;
        const assisterId = identity(event.assister_steamid);
        const assister = assisterId
          ? requirePlayer(assisterId, roster, "death assister")
          : undefined;
        const enemyKill = attacker && attacker.teamId !== victim.teamId;
        const validAssist =
          enemyKill &&
          assister &&
          assister.teamId === attacker.teamId &&
          assisterId !== attackerId;
        if (!scoreboardAlive.delete(victim.steamid))
          throw new Error("Duplicate death or missing alive state");
        health.set(victim.steamid, 0);
        stats.get(victim.steamid)!.deaths++;
        if (enemyKill) {
          stats.get(attackerId!)!.kills++;
          if (event.headshot) stats.get(attackerId!)!.headshotKills++;
          if (validAssist) {
            stats.get(assisterId!)!.assists++;
            if (event.assistedflash) stats.get(assisterId!)!.flashAssists++;
          }
        }
        if (!live) continue;
        alive.delete(victim.steamid);
        if (enemyKill) {
          kast.add(attackerId!);
          roundKills.set(attackerId!, (roundKills.get(attackerId!) ?? 0) + 1);
          if (validAssist) kast.add(assisterId!);
          if (!opened) {
            stats.get(attackerId!)!.openingKills++;
            stats.get(victim.steamid)!.openingDeaths++;
            opened = true;
          }
          let tradedAnyone = false;
          for (const pending of pendingDeaths) {
            if (
              pending.killer === victim.steamid &&
              roster.get(pending.victim)!.teamId === attacker.teamId &&
              event.tick - pending.tick <= input.tickRate * 5
            ) {
              traded.add(pending.victim);
              tradedAnyone = true;
            }
          }
          if (tradedAnyone) stats.get(attackerId!)!.tradeKills++;
          pendingDeaths.push({
            victim: victim.steamid,
            killer: attackerId!,
            tick: event.tick,
          });
        }
        checkClutch();
      }
    }

    for (const player of round.players) {
      const result = stats.get(player.steamid)!;
      result.roundsPlayed++;
      if (
        alive.has(player.steamid) ||
        kast.has(player.steamid) ||
        traded.has(player.steamid)
      )
        result.kastRounds++;
      if (traded.has(player.steamid)) result.tradedDeaths++;
      const kills = roundKills.get(player.steamid) ?? 0;
      if (kills >= 2) result.multikills[Math.min(kills, 5) as 2 | 3 | 4 | 5]++;
      const opponents = clutch.get(player.steamid);
      if (opponents !== undefined) {
        result.clutchAttempts[opponents] =
          (result.clutchAttempts[opponents] ?? 0) + 1;
        if (round.winnerTeamId === player.teamId) {
          result.clutchWins[opponents] =
            (result.clutchWins[opponents] ?? 0) + 1;
        }
      }
    }
  }

  return [...stats.values()].map((result) => ({
    ...result,
    kpr: result.kills / result.roundsPlayed,
    dpr: result.deaths / result.roundsPlayed,
    apr: result.assists / result.roundsPlayed,
    adr: result.enemyDamage / result.roundsPlayed,
    headshotPercent: result.kills
      ? (100 * result.headshotKills) / result.kills
      : 0,
    kastPercent: (100 * result.kastRounds) / result.roundsPlayed,
  }));
}
