import "server-only";

import { cache } from "react";
import { adminDb } from "@/lib/db/admin";
import { getPlayerBySteamId } from "@/lib/external/faceit";
import { profileLines } from "./lines";
import { profileSummary } from "./summary";

// Deduplicated per request: generateMetadata and the page both build the profile.
export const groupPlayerProfile = cache(groupPlayerProfileUncached);

async function groupPlayerProfileUncached(groupId: string, steamId: string) {
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
        // Manual results share one played_at per evening; keep the map order stable.
        .order("map_number", { ascending: false })
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
  // Every player's stats on these maps: the recorded side decides the team and the teammates.
  const statsResult = matches.length
    ? await adminDb()
        .from("match_player_stats")
        .select(
          "match_id, player_id, team, kills, deaths, assists, adr, rounds, rating",
        )
        .in(
          "match_id",
          matches.map((match) => match.id),
        )
    : { data: [], error: null };
  if (statsResult.error) throw statsResult.error;
  const stats = statsResult.data ?? [];
  const teammateIds = [
    ...new Set([
      ...variantPlayers.map((row) => row.player_id),
      ...stats.map((row) => row.player_id),
    ]),
  ];
  const teammateResult = teammateIds.length
    ? await adminDb()
        .from("players")
        .select("id, steam_id, display_name")
        .in("id", teammateIds)
    : { data: [], error: null };
  if (teammateResult.error) throw teammateResult.error;
  const mates = new Map(
    (teammateResult.data ?? []).map((mate) => [
      mate.id,
      {
        id: mate.id,
        steamId: mate.steam_id,
        name: mate.display_name ?? mate.steam_id,
      },
    ]),
  );
  const lines = profileLines({
    playerId: player.id,
    mixes: playedMixes,
    matches,
    variantPlayers,
    stats,
    mates,
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
