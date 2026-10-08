import type { DemoImportPayload } from "@/lib/demo/payload";

export type DemoMatchSide = "A" | "B";
export type DemoMatchPlayer = { steamId: string; team: DemoMatchSide };

export type DemoMatchValidation =
  | {
      valid: true;
      teamById: Map<string, DemoMatchSide>;
      score: { a: number; b: number };
    }
  | {
      valid: false;
      reason: "map" | "roster" | "score";
      teamById?: Map<string, DemoMatchSide>;
      score?: { a: number; b: number };
    };

function canonicalMapName(value: string) {
  return value
    .trim()
    .replace(/^\d+\.\s*/, "")
    .toLocaleLowerCase("en")
    .replace(/^de_/, "");
}

/** Confirms that the parsed demo is the selected played map and its saved lineup/result. */
export function validateDemoForMatch(
  payload: DemoImportPayload,
  target: {
    mapName: string;
    scoreA: number;
    scoreB: number;
    players: DemoMatchPlayer[];
  },
): DemoMatchValidation {
  const mapMatches =
    !target.mapName ||
    canonicalMapName(payload.mapName) === canonicalMapName(target.mapName);

  const expected = new Map(
    target.players.map(({ steamId, team }) => [steamId, team]),
  );
  const payloadIds = payload.players.map((player) => player.steamid);
  if (
    expected.size !== 10 ||
    target.players.length !== 10 ||
    target.players.some((player) => !player.steamId || !player.team) ||
    new Set(payloadIds).size !== 10 ||
    payloadIds.some((steamId) => !expected.has(steamId))
  ) {
    return { valid: false, reason: "roster" };
  }

  const teamById = new Map<string, DemoMatchSide>();
  for (const player of payload.players) {
    const expectedTeam = expected.get(player.steamid)!;
    if (!player.teamId) return { valid: false, reason: "roster" };
    const assignedTeam = teamById.get(player.teamId);
    if (assignedTeam && assignedTeam !== expectedTeam) {
      return { valid: false, reason: "roster" };
    }
    teamById.set(player.teamId, expectedTeam);
  }
  const teamCounts = new Map<DemoMatchSide, number>([
    ["A", 0],
    ["B", 0],
  ]);
  for (const team of expected.values()) {
    teamCounts.set(team, (teamCounts.get(team) ?? 0) + 1);
  }
  if (
    teamById.size !== 2 ||
    teamCounts.get("A") !== 5 ||
    teamCounts.get("B") !== 5
  ) {
    return { valid: false, reason: "roster" };
  }

  let scoreA = 0;
  let scoreB = 0;
  for (const round of payload.rounds) {
    const winner = teamById.get(round.winnerTeamId);
    if (!winner) return { valid: false, reason: "roster" };
    if (winner === "A") scoreA++;
    else scoreB++;
  }
  const score = { a: scoreA, b: scoreB };
  if (!mapMatches) {
    return { valid: false, reason: "map", teamById, score };
  }
  if (scoreA !== target.scoreA || scoreB !== target.scoreB) {
    return {
      valid: false,
      reason: "score",
      teamById,
      score,
    };
  }

  return { valid: true, teamById, score };
}
