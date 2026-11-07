import type { ProfileMap } from "./summary";

type Team = "A" | "B";
const isTeam = (team: string | null | undefined): team is Team =>
  team === "A" || team === "B";

export interface LineMix {
  id: string;
  title: string;
  chosen_variant_id: string | null;
}
export interface LineMatch {
  id: string;
  mix_id: string;
  map_number: number;
  map_name: string | null;
  played_at: string;
  score_a: number;
  score_b: number;
  faceit_match_id: string | null;
}
export interface LineVariantPlayer {
  variant_id: string;
  player_id: string;
  team: string;
}
export interface LineStats {
  match_id: string;
  player_id: string;
  team: string | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  adr: number | string | null;
  rounds: number | null;
  rating: number | string | null;
}
export interface LineMate {
  id: string;
  steamId: string;
  name: string;
}

/**
 * One profile line per map the player played. The side comes from the recorded stats when the
 * map has them (a FACEIT import can differ from the voted lineup), and from the chosen variant
 * only for score-only maps, the same rule the group stats use.
 */
export function profileLines(input: {
  playerId: string;
  mixes: LineMix[];
  matches: LineMatch[];
  variantPlayers: LineVariantPlayer[];
  stats: LineStats[];
  mates: Map<string, LineMate>;
}): ProfileMap[] {
  const mixById = new Map(input.mixes.map((mix) => [mix.id, mix]));
  const statsByMatch = new Map<string, LineStats[]>();
  for (const row of input.stats) {
    const rows = statsByMatch.get(row.match_id) ?? [];
    rows.push(row);
    statsByMatch.set(row.match_id, rows);
  }
  return input.matches.flatMap((match) => {
    const mix = mixById.get(match.mix_id);
    if (!mix) return [];
    const mapStats = statsByMatch.get(match.id) ?? [];
    const own = mapStats.find((row) => row.player_id === input.playerId);
    const lineup = input.variantPlayers.filter(
      (row) => row.variant_id === mix.chosen_variant_id,
    );
    const statsTeam = own && isTeam(own.team) ? own.team : null;
    const variantTeam = lineup.find(
      (row) => row.player_id === input.playerId,
    )?.team;
    const team = statsTeam ?? (isTeam(variantTeam) ? variantTeam : null);
    if (!team) return [];
    const mateIds = statsTeam
      ? mapStats.filter((row) => row.team === team).map((row) => row.player_id)
      : lineup.filter((row) => row.team === team).map((row) => row.player_id);
    const line: ProfileMap = {
      matchId: match.id,
      mixId: mix.id,
      mixTitle: mix.title,
      mapNumber: match.map_number,
      mapName: match.map_name,
      playedAt: match.played_at,
      scoreA: match.score_a,
      scoreB: match.score_b,
      faceitRoomUrl: match.faceit_match_id
        ? `https://www.faceit.com/en/cs2/room/${encodeURIComponent(match.faceit_match_id)}`
        : null,
      team,
      stats: own
        ? {
            kills: own.kills,
            deaths: own.deaths,
            assists: own.assists,
            adr: own.adr === null ? null : Number(own.adr),
            rounds: own.rounds,
            rating: own.rating === null ? null : Number(own.rating),
          }
        : null,
      teammates: mateIds.flatMap((id) =>
        id !== input.playerId && input.mates.has(id)
          ? [input.mates.get(id)!]
          : [],
      ),
    };
    return [line];
  });
}
