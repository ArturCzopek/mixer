import "server-only";

import { adminDb } from "@/lib/db/admin";
import {
  groupMixResults,
  groupStatsSummary,
  type GroupMapRow,
  type GroupPlayerRow,
  type GroupStatRow,
} from "./stats-summary";

/** All-time group results, including the clearly identified historical archive. */
export async function groupStats(groupId: string, viewerId: string | null) {
  const mixes: { id: string }[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await adminDb()
      .from("mixes")
      .select("id")
      .eq("group_id", groupId)
      .eq("status", "played")
      .order("id")
      .range(offset, offset + 999);
    if (error) throw error;
    mixes.push(...data);
    if (data.length < 1000) break;
  }
  if (!mixes.length)
    return { ...groupStatsSummary([], [], [], []), mixResults: {} };

  const maps: GroupMapRow[] = [];
  for (let i = 0; i < mixes.length; i += 50) {
    const ids = mixes.slice(i, i + 50).map((mix) => mix.id);
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await adminDb()
        .from("matches")
        .select(
          "id, mix_id, map_name, map_number, score_a, score_b, source, stats_origin",
        )
        .in("mix_id", ids)
        .order("id")
        .range(offset, offset + 999)
        .returns<GroupMapRow[]>();
      if (error) throw error;
      maps.push(...data);
      if (data.length < 1000) break;
    }
  }

  const stats: GroupStatRow[] = [];
  for (let i = 0; i < maps.length; i += 50) {
    const ids = maps.slice(i, i + 50).map((map) => map.id);
    const { data, error } = await adminDb()
      .from("match_player_stats")
      .select(
        "match_id, player_id, team, kills, deaths, assists, adr, rounds, rating",
      )
      .in("match_id", ids)
      .returns<GroupStatRow[]>();
    if (error) throw error;
    stats.push(...data);
  }
  const players: GroupPlayerRow[] = [];
  const playerIds = [...new Set(stats.map((stat) => stat.player_id))];
  for (let i = 0; i < playerIds.length; i += 100) {
    const { data, error } = await adminDb()
      .from("players")
      .select("id, steam_id, display_name")
      .in("id", playerIds.slice(i, i + 100))
      .returns<GroupPlayerRow[]>();
    if (error) throw error;
    players.push(...data);
  }
  return {
    ...groupStatsSummary(mixes, maps, stats, players),
    mixResults: groupMixResults(maps, stats, viewerId),
  };
}
