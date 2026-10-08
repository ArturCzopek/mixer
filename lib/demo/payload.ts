import { z } from "zod";
import {
  calculateDemoStats,
  summarizeDemoRounds,
  type DemoEvent,
  type DemoPlayerStats,
  type DemoRound,
  type DemoRoundSummary,
} from "./stats";
import type { DemoPlayerSnapshot } from "./prepare";

const steamId = z.string().regex(/^7656119\d{10}$/);
const eventActor = z.union([steamId, z.literal("0")]);
const nonnegative = z.number().int().min(0);
const player = z.object({
  steamid: steamId,
  name: z.string().max(100),
  teamId: z.string().min(1).max(100),
});
const round = z.object({
  startTick: nonnegative,
  endTick: nonnegative,
  scoreEndTick: nonnegative,
  winnerTeamId: z.string().min(1).max(100),
  players: z
    .array(
      z.object({
        steamid: steamId,
        teamId: z.string().min(1).max(100),
        side: z.union([z.literal(2), z.literal(3)]),
        isAlive: z.boolean(),
        health: nonnegative.max(100),
      }),
    )
    .length(10),
});
const event = z.object({
  event_name: z.enum([
    "player_death",
    "player_hurt",
    "player_blind",
    "other_death",
  ]),
  tick: nonnegative,
  attacker_steamid: eventActor.nullish(),
  user_steamid: eventActor.nullish(),
  assister_steamid: eventActor.nullish(),
  assistedflash: z.boolean().optional(),
  headshot: z.boolean().optional(),
  dmg_health: nonnegative.optional(),
  health: nonnegative.optional(),
  weapon: z.string().max(100).optional(),
  blind_duration: z.number().min(0).optional(),
  penetrated: nonnegative.optional(),
  thrusmoke: z.boolean().optional(),
  noscope: z.boolean().optional(),
  attackerblind: z.boolean().optional(),
  attackerinair: z.boolean().optional(),
  othertype: z.string().max(80).optional(),
});
const snapshot = z.object({
  steamid: steamId,
  tick: nonnegative,
  team_num: z.union([z.literal(2), z.literal(3)]),
  is_alive: z.boolean(),
  health: nonnegative.max(100),
});
const controller = z.object({
  steamid: steamId,
  kills: nonnegative,
  deaths: nonnegative,
  assists: nonnegative,
  damage: nonnegative,
});

export const demoImportSchema = z
  .object({
    version: z.literal(1),
    demoHash: z.string().regex(/^[0-9a-f]{64}$/),
    mapName: z.string().trim().min(1).max(60),
    tickRate: z.number().positive().max(1024),
    regulationRounds: z.number().int().min(1).max(60).nullable(),
    players: z.array(player).length(10),
    rounds: z.array(round).min(1).max(100),
    events: z.array(event).max(100000),
    endSnapshots: z.array(snapshot).min(10).max(1280),
    controller: z.array(controller).length(10),
  })
  .superRefine((value, context) => {
    for (const [index, e] of value.events.entries()) {
      if (
        e.event_name === "player_death" &&
        (e.headshot === undefined ||
          e.assistedflash === undefined ||
          e.penetrated === undefined ||
          e.thrusmoke === undefined ||
          e.noscope === undefined ||
          e.attackerblind === undefined ||
          e.attackerinair === undefined ||
          !e.weapon)
      )
        context.addIssue({
          code: "custom",
          message: "Incomplete death metadata",
          path: ["events", index],
        });
      if (e.event_name === "player_hurt" && !e.weapon)
        context.addIssue({
          code: "custom",
          message: "Missing hurt weapon",
          path: ["events", index],
        });
      if (e.event_name === "other_death" && !e.othertype)
        context.addIssue({
          code: "custom",
          message: "Missing other death type",
          path: ["events", index],
        });
    }
  });

export type DemoImportPayload = Omit<
  z.infer<typeof demoImportSchema>,
  "rounds" | "events" | "endSnapshots"
> & {
  rounds: DemoRound[];
  events: DemoEvent[];
  endSnapshots: DemoPlayerSnapshot[];
};

export type { DemoRoundSummary } from "./stats";
export type DemoStoredData = {
  version: 1;
  tickRate: number;
  regulationRounds: number | null;
  players: DemoImportPayload["players"];
  rounds: DemoRoundSummary[];
  stats: DemoPlayerStats[];
  /** Validated JSON input retained so a later formula can be recalculated without another demo. */
  evidence?: DemoImportPayload;
};

/** Bound before parsing so a forged action request cannot allocate an unbounded event tree. */
export function validateDemoImportPayload(input: unknown): DemoImportPayload {
  if (JSON.stringify(input).length > 900_000)
    throw new Error("Demo data is too large");
  const payload = demoImportSchema.parse(input) as DemoImportPayload;
  const ids = payload.players.map((p) => p.steamid);
  const teams = new Set(payload.players.map((p) => p.teamId));
  if (
    new Set(ids).size !== 10 ||
    teams.size !== 2 ||
    [...teams].some(
      (team) => payload.players.filter((p) => p.teamId === team).length !== 5,
    )
  )
    throw new Error("Demo must contain two five-player teams");
  if (
    new Set(payload.controller.map((p) => p.steamid)).size !== 10 ||
    payload.controller.some((p) => !ids.includes(p.steamid))
  )
    throw new Error("Controller roster differs from demo roster");
  if (
    payload.events.some((e, i) => i > 0 && e.tick < payload.events[i - 1].tick)
  )
    throw new Error("Demo events are not sorted");
  const roster = new Map(payload.players.map((p) => [p.steamid, p.teamId]));
  for (const round of payload.rounds) {
    if (
      new Set(round.players.map((p) => p.steamid)).size !== 10 ||
      round.players.some((p) => roster.get(p.steamid) !== p.teamId) ||
      !teams.has(round.winnerTeamId)
    )
      throw new Error("Round roster differs from demo roster");
    const end = payload.endSnapshots.filter((s) => s.tick === round.endTick);
    const startById = new Map(round.players.map((p) => [p.steamid, p]));
    if (
      end.length !== 10 ||
      new Set(end.map((s) => s.steamid)).size !== 10 ||
      end.some(
        (s) =>
          !roster.has(s.steamid) ||
          startById.get(s.steamid)?.side !== s.team_num ||
          s.is_alive !== s.health > 0,
      )
    )
      throw new Error("Missing round-end player evidence");
    const alive = new Set(
      round.players.filter((p) => p.isAlive).map((p) => p.steamid),
    );
    for (const death of payload.events.filter(
      (e) =>
        e.event_name === "player_death" &&
        e.tick >= round.startTick &&
        e.tick <= round.endTick,
    )) {
      if (!death.user_steamid || !alive.delete(death.user_steamid))
        throw new Error("Invalid round death coverage");
    }
    if (end.some((s) => alive.has(s.steamid) !== s.is_alive))
      throw new Error("Incomplete round death coverage");
  }
  return payload;
}

/** Recalculate every stored field from checked event evidence and controller parity. */
export function buildDemoStoredData(
  payload: DemoImportPayload,
): DemoStoredData {
  const stats = calculateDemoStats(payload);
  if (stats.length !== 10) throw new Error("Incomplete demo statistics");
  const controller = new Map(
    payload.controller.map((row) => [row.steamid, row]),
  );
  if (
    stats.some((stat) => {
      const row = controller.get(stat.steamid);
      return (
        !row ||
        row.kills !== stat.kills ||
        row.deaths !== stat.deaths ||
        row.assists !== stat.assists ||
        row.damage !== stat.enemyDamage
      );
    })
  )
    throw new Error("Demo controller totals differ from event statistics");
  return {
    version: 1,
    tickRate: payload.tickRate,
    regulationRounds: payload.regulationRounds,
    players: payload.players,
    rounds: summarizeDemoRounds(payload, payload.regulationRounds),
    stats,
  };
}
