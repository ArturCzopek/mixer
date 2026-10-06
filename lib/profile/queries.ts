import "server-only";

import { adminDb } from "@/lib/db/admin";
import { getPlayerBySteamId } from "@/lib/external/faceit";
import { profileSummary, type ProfileMap } from "./summary";

export async function groupPlayerProfile(groupId: string, steamId: string) {
  const { data: player, error: playerError } = await adminDb()
    .from("players")
    .select("id, steam_id, display_name, avatar_url")
    .eq("steam_id", steamId)
    .maybeSingle();
  if (playerError) throw playerError;
  if (!player) return null;
  const { data: joins, error: joinsError } = await adminDb()
    .from("mix_participants")
    .select("mix_id")
    .eq("player_id", player.id);
  if (joinsError) throw joinsError;
  const mixIds = (joins ?? []).map((join) => join.mix_id);
  const mixes = mixIds.length
    ? await adminDb()
        .from("mixes")
        .select("id, title, chosen_variant_id")
        .eq("group_id", groupId)
        .eq("status", "played")
        .in("id", mixIds)
    : { data: [], error: null };
  if (mixes.error) throw mixes.error;
  const playedMixes = (mixes.data ?? []).filter(
    (mix) => !!mix.chosen_variant_id,
  );
  const matchResult = playedMixes.length
    ? await adminDb()
        .from("matches")
        .select(
          "id, mix_id, map_number, map_name, played_at, score_a, score_b, faceit_match_id",
        )
        .in(
          "mix_id",
          playedMixes.map((mix) => mix.id),
        )
        .order("played_at", { ascending: false })
    : { data: [], error: null };
  if (matchResult.error) throw matchResult.error;
  const matches = matchResult.data ?? [];
  const variantIds = playedMixes.map((mix) => mix.chosen_variant_id!);
  const variantResult = variantIds.length
    ? await adminDb()
        .from("variant_players")
        .select("variant_id, player_id, team")
        .in("variant_id", variantIds)
    : { data: [], error: null };
  if (variantResult.error) throw variantResult.error;
  const variantPlayers = variantResult.data ?? [];
  const teammateIds = [...new Set(variantPlayers.map((row) => row.player_id))];
  const teammateResult = teammateIds.length
    ? await adminDb()
        .from("players")
        .select("id, steam_id, display_name")
        .in("id", teammateIds)
    : { data: [], error: null };
  if (teammateResult.error) throw teammateResult.error;
  const teammateNames = new Map(
    (teammateResult.data ?? []).map((mate) => [
      mate.id,
      {
        id: mate.id,
        steamId: mate.steam_id,
        name: mate.display_name ?? mate.steam_id,
      },
    ]),
  );
  const statsResult = matches.length
    ? await adminDb()
        .from("match_player_stats")
        .select("match_id, kills, deaths, assists, adr, rounds, rating")
        .eq("player_id", player.id)
        .in(
          "match_id",
          matches.map((match) => match.id),
        )
    : { data: [], error: null };
  if (statsResult.error) throw statsResult.error;
  const statsByMatch = new Map(
    (statsResult.data ?? []).map((stats) => [stats.match_id, stats]),
  );
  const mixById = new Map(playedMixes.map((mix) => [mix.id, mix]));
  const lines: ProfileMap[] = matches.flatMap((match) => {
    const mix = mixById.get(match.mix_id);
    const teamRow = variantPlayers.find(
      (row) =>
        row.variant_id === mix?.chosen_variant_id &&
        row.player_id === player.id,
    );
    if (!mix || !teamRow || (teamRow.team !== "A" && teamRow.team !== "B"))
      return [];
    const ownStats = statsByMatch.get(match.id);
    return [
      {
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
        team: teamRow.team as "A" | "B",
        stats: ownStats
          ? {
              kills: ownStats.kills,
              deaths: ownStats.deaths,
              assists: ownStats.assists,
              adr: ownStats.adr === null ? null : Number(ownStats.adr),
              rounds: ownStats.rounds,
              rating: ownStats.rating === null ? null : Number(ownStats.rating),
            }
          : null,
        teammates: variantPlayers.flatMap((row) =>
          row.variant_id === mix.chosen_variant_id &&
          row.team === teamRow.team &&
          row.player_id !== player.id &&
          teammateNames.has(row.player_id)
            ? [teammateNames.get(row.player_id)!]
            : [],
        ),
      },
    ];
  });
  const faceit = await getPlayerBySteamId(steamId).catch(() => null);
  return {
    player: {
      steamId: player.steam_id,
      name: player.display_name ?? player.steam_id,
      avatarUrl: player.avatar_url,
    },
    faceit: faceit
      ? {
          level: faceit.level,
          elo: faceit.elo,
          nickname: faceit.nickname,
          profileUrl: faceit.profileUrl,
        }
      : null,
    summary: profileSummary(lines),
  };
}
