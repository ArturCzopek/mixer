import "server-only";

import { adminDb } from "@/lib/db/admin";
import {
  analyticsSummary,
  type AnalyticsLineup,
  type AnalyticsMap,
  type AnalyticsMix,
  type AnalyticsOptions,
  type AnalyticsParticipant,
  type AnalyticsPlayer,
  type AnalyticsStat,
} from "./analytics-summary";

async function related<T>(
  table: string,
  columns: string,
  field: string,
  ids: string[],
  tieField?: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; i < ids.length; i += 50)
    for (let offset = 0; ; offset += 1000) {
      let query = adminDb()
        .from(table)
        .select(columns)
        .in(field, ids.slice(i, i + 50))
        .order(field);
      if (tieField) query = query.order(tieField);
      const { data, error } = await query.range(offset, offset + 999);
      if (error) throw error;
      rows.push(...(data as T[]));
      if (data.length < 1000) break;
    }
  return rows;
}

/** Stored results from played Mixes in one group. Archive and period filters are applied by evening. */
export async function groupAnalytics(
  groupId: string,
  options: AnalyticsOptions,
) {
  const mixes: AnalyticsMix[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await adminDb()
      .from("mixes")
      .select("id, chosen_variant_id, archive_source")
      .eq("group_id", groupId)
      .eq("status", "played")
      .order("id")
      .range(offset, offset + 999)
      .returns<AnalyticsMix[]>();
    if (error) throw error;
    mixes.push(...data);
    if (data.length < 1000) break;
  }
  const [maps, lineups, participants] = await Promise.all([
    related<AnalyticsMap>(
      "matches",
      "id, mix_id, map_number, map_name, played_at, score_a, score_b, source, stats_origin",
      "mix_id",
      mixes.map((mix) => mix.id),
      "id",
    ),
    related<AnalyticsLineup>(
      "variant_players",
      "variant_id, player_id, team",
      "variant_id",
      mixes.flatMap((mix) =>
        mix.chosen_variant_id ? [mix.chosen_variant_id] : [],
      ),
      "player_id",
    ),
    related<AnalyticsParticipant>(
      "mix_participants",
      "mix_id, player_id, created_at",
      "mix_id",
      mixes.map((mix) => mix.id),
      "player_id",
    ),
  ]);
  const stats = await related<AnalyticsStat>(
    "match_player_stats",
    "match_id, player_id, team, kills, deaths, assists, adr, rounds, rating, hs_kills, first_kills, clutch_wins, utility_damage, enemies_flashed, multi_4k, multi_5k",
    "match_id",
    maps.map((map) => map.id),
    "player_id",
  );
  const players = await related<AnalyticsPlayer>(
    "players",
    "id, steam_id, display_name",
    "id",
    [
      ...new Set(
        [...stats, ...lineups, ...participants].map((row) => row.player_id),
      ),
    ],
  );
  return analyticsSummary(
    mixes,
    maps,
    stats,
    players,
    lineups,
    participants,
    options,
  );
}
