import { faceitMatchRating } from "@/lib/balance";
import type { FaceitMapStats, FaceitRoomDetail } from "@/lib/external/faceit";
import type { FaceitCandidate } from "./faceit-candidates";

const numeric = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};

/** A confirmed FACEIT BO1 room becomes one map in the voted A/B lineup. */
export function faceitImportMap(
  candidate: FaceitCandidate,
  room: FaceitRoomDetail,
  response: FaceitMapStats,
  playerIds: Map<string, string>,
) {
  if (candidate.teamAIsFaction1 === null || response.rounds.length !== 1)
    throw new Error("Cannot map FACEIT room to one A/B map");
  const round = response.rounds[0];
  const scores = new Map(
    round.teams.map((team) => [
      team.team_id,
      numeric(team.team_stats["Final Score"]),
    ]),
  );
  const score1 = scores.get(room.teams.faction1.faction_id);
  const score2 = scores.get(room.teams.faction2.faction_id);
  if (
    score1 === null ||
    score1 === undefined ||
    score2 === null ||
    score2 === undefined
  )
    throw new Error("FACEIT room scores are missing");
  const faceitToSteam = new Map(
    [...room.teams.faction1.roster, ...room.teams.faction2.roster].flatMap(
      (player) =>
        player.game_player_id
          ? [[player.player_id, player.game_player_id] as const]
          : [],
    ),
  );
  const stats = round.teams.flatMap((team) => {
    const faction =
      team.team_id === room.teams.faction1.faction_id
        ? 1
        : team.team_id === room.teams.faction2.faction_id
          ? 2
          : null;
    if (!faction) throw new Error("FACEIT stats faction is unknown");
    const side = (faction === 1) === candidate.teamAIsFaction1 ? "A" : "B";
    return team.players.flatMap((entry) => {
      const playerId = playerIds.get(faceitToSteam.get(entry.player_id) ?? "");
      if (!playerId) return [];
      const s = entry.player_stats;
      const kills = numeric(s.Kills);
      const deaths = numeric(s.Deaths);
      const assists = numeric(s.Assists);
      const rounds = numeric(round.round_stats.Rounds);
      const adr = numeric(s.ADR);
      return [
        {
          playerId,
          team: side,
          kills,
          deaths,
          assists,
          damage: numeric(s.Damage),
          rounds,
          adr,
          rating:
            kills !== null &&
            deaths !== null &&
            assists !== null &&
            rounds !== null &&
            rounds > 0 &&
            adr !== null
              ? faceitMatchRating({ kills, deaths, assists, rounds, adr })
              : null,
          headshots: numeric(s.Headshots),
          firstKills: numeric(s["First Kills"]),
          doubleKills: numeric(s["Double Kills"]),
          tripleKills: numeric(s["Triple Kills"]),
          quadroKills: numeric(s["Quadro Kills"]),
          pentaKills: numeric(s["Penta Kills"]),
          utilityDamage: numeric(s["Utility Damage"]),
          enemiesFlashed: numeric(s["Enemies Flashed"]),
        },
      ];
    });
  });
  return {
    faceitId: candidate.id,
    startedAt: candidate.startedAt,
    mapName:
      typeof round.round_stats.Map === "string" ? round.round_stats.Map : "",
    scoreA: candidate.teamAIsFaction1 ? score1 : score2,
    scoreB: candidate.teamAIsFaction1 ? score2 : score1,
    demoUrl: room.demo_url?.find((url) => url.startsWith("https://")) ?? null,
    stats,
  };
}
