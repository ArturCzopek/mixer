import { z } from "zod";
import type { AwardStat } from "@/lib/awards";
import type { DemoStoredData } from "./payload";

const team = z.string().min(1).max(100);
const steamid = z.string().regex(/^7656119\d{10}$/);
const count = z.number().finite().min(0);
const player = z.object({ steamid, name: z.string().max(100), teamId: team });
const playerStats = z.object({
  steamid,
  teamId: team,
  roundsPlayed: count,
  kills: count,
  deaths: count,
  assists: count,
  kpr: count,
  dpr: count,
  apr: count,
  enemyDamage: count,
  adr: count,
  headshotKills: count,
  headshotPercent: count,
  openingKills: count,
  openingDeaths: count,
  tradeKills: count,
  tradedDeaths: count,
  kastRounds: count,
  kastPercent: count,
  multikills: z.object({ 2: count, 3: count, 4: count, 5: count }),
  clutchAttempts: z.record(z.string(), count),
  clutchWins: z.record(z.string(), count),
  utilityDamage: count,
  enemiesFlashed: count,
  teammatesFlashed: count,
  flashAssists: count,
  friendlyFlashes: count,
  friendlyDamage: count,
  selfDamage: count,
  suicides: count,
  chickenKills: count,
  knifeKills: count,
  taserKills: count,
  wallbangKills: count,
  smokeKills: count,
  blindKills: count,
  airKills: count,
  noScopeKills: count,
  savedLostRounds: count,
});
const round = z.object({
  number: z.number().int().min(1).max(100),
  startTick: count,
  endTick: count,
  winnerTeamId: team,
  phase: z.enum(["regulation", "overtime"]).nullable(),
  opening: z.object({ killer: steamid, victim: steamid }).nullable(),
  clutches: z
    .array(z.object({ steamid, opponents: count, won: z.boolean() }))
    .max(10),
  multikills: z.array(z.object({ steamid, kills: count })).max(10),
});
const stored = z.object({
  version: z.literal(1),
  tickRate: z.number().positive().max(1024),
  regulationRounds: z.number().int().min(1).max(60).nullable(),
  players: z.array(player).length(10),
  rounds: z.array(round).min(1).max(100),
  stats: z.array(playerStats).length(10),
});

/** Project only presentation fields; stored event evidence and earlier payloads stay server-side. */
export function normalizeStoredDemo(
  raw: unknown,
  teamsBySteam: Map<string, "A" | "B">,
): DemoStoredData | null {
  const parsed = stored.safeParse(raw);
  if (!parsed.success || teamsBySteam.size !== 10) return null;
  const value = parsed.data;
  if (
    new Set(value.players.map((p) => p.steamid)).size !== 10 ||
    new Set(value.stats.map((p) => p.steamid)).size !== 10 ||
    [...teamsBySteam.values()].filter((team) => team === "A").length !== 5 ||
    [...teamsBySteam.values()].filter((team) => team === "B").length !== 5 ||
    value.players.some((p) => !teamsBySteam.has(p.steamid)) ||
    value.stats.some((p) => !teamsBySteam.has(p.steamid))
  )
    return null;
  const nativeTeams = new Map<string, "A" | "B">();
  for (const p of value.players) {
    const mapped = teamsBySteam.get(p.steamid)!;
    if (nativeTeams.has(p.teamId) && nativeTeams.get(p.teamId) !== mapped)
      return null;
    nativeTeams.set(p.teamId, mapped);
  }
  if (
    nativeTeams.size !== 2 ||
    new Set(nativeTeams.values()).size !== 2 ||
    value.stats.some(
      (p) => nativeTeams.get(p.teamId) !== teamsBySteam.get(p.steamid),
    ) ||
    value.rounds.some((r) => !nativeTeams.has(r.winnerTeamId))
  )
    return null;
  return {
    version: 1,
    tickRate: value.tickRate,
    regulationRounds: value.regulationRounds,
    players: value.players.map((p) => ({
      ...p,
      teamId: teamsBySteam.get(p.steamid)!,
    })),
    rounds: value.rounds.map((r) => ({
      ...r,
      winnerTeamId: nativeTeams.get(r.winnerTeamId)!,
    })),
    stats: value.stats.map((p) => ({
      ...p,
      teamId: teamsBySteam.get(p.steamid)!,
    })),
  };
}

const demoAwardKeys = [
  "friendlyFlashes",
  "friendlyDamage",
  "selfDamage",
  "suicides",
  "chickenKills",
  "knifeKills",
  "taserKills",
  "wallbangKills",
  "smokeKills",
  "blindKills",
  "airKills",
  "noScopeKills",
  "tradeKills",
  "savedLostRounds",
] as const;

/** A missing raw metric is unknown, not an observed zero. */
export function demoAwardFields(raw: unknown): Partial<AwardStat> {
  const record =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  return Object.fromEntries(
    demoAwardKeys.map((key) => [
      key,
      typeof record[key] === "number" &&
      Number.isFinite(record[key]) &&
      record[key] >= 0
        ? record[key]
        : null,
    ]),
  ) as Partial<AwardStat>;
}
