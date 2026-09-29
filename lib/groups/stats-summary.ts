export interface GroupMapRow {
  id: string;
  mix_id: string;
  map_name: string | null;
  map_number: number;
  score_a: number;
  score_b: number;
  source: string;
  stats_origin: string | null;
}

export function groupMixResults(
  maps: GroupMapRow[],
  stats: GroupStatRow[],
  viewerId: string | null,
) {
  const personal = new Map<string, GroupStatRow>();
  if (viewerId)
    for (const row of stats)
      if (row.player_id === viewerId) personal.set(row.match_id, row);
  const results = new Map<
    string,
    {
      wonA: number;
      wonB: number;
      draws: number;
      maps: { name: string; a: number; b: number }[];
      own: {
        kills: number;
        deaths: number;
        ratingTotal: number;
        ratingRounds: number;
      } | null;
    }
  >();
  for (const map of [...maps].sort((a, b) => a.map_number - b.map_number)) {
    const result = results.get(map.mix_id) ?? {
      wonA: 0,
      wonB: 0,
      draws: 0,
      maps: [],
      own: null,
    };
    if (map.score_a > map.score_b) result.wonA++;
    if (map.score_b > map.score_a) result.wonB++;
    if (map.score_a === map.score_b) result.draws++;
    result.maps.push({
      name: map.map_name ?? `#${map.map_number}`,
      a: map.score_a,
      b: map.score_b,
    });
    const row = personal.get(map.id);
    if (row) {
      const own = result.own ?? {
        kills: 0,
        deaths: 0,
        ratingTotal: 0,
        ratingRounds: 0,
      };
      own.kills += row.kills ?? 0;
      own.deaths += row.deaths ?? 0;
      if (row.rating !== null && row.rounds && row.rounds > 0) {
        own.ratingTotal += Number(row.rating) * row.rounds;
        own.ratingRounds += row.rounds;
      }
      result.own = own;
    }
    results.set(map.mix_id, result);
  }
  return Object.fromEntries(
    [...results].map(([mixId, result]) => [
      mixId,
      {
        ...result,
        own: result.own && {
          kills: result.own.kills,
          deaths: result.own.deaths,
          rating: result.own.ratingRounds
            ? result.own.ratingTotal / result.own.ratingRounds
            : null,
        },
      },
    ]),
  );
}

export interface GroupStatRow {
  match_id: string;
  player_id: string;
  team: "A" | "B";
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  adr: number | null;
  rounds: number | null;
  rating: number | null;
}

export interface GroupPlayerRow {
  id: string;
  steam_id: string;
  display_name: string | null;
}

export function groupStatsSummary(
  mixes: { id: string }[],
  maps: GroupMapRow[],
  stats: GroupStatRow[],
  players: GroupPlayerRow[],
) {
  const mapById = new Map(maps.map((map) => [map.id, map]));
  const playerById = new Map(players.map((player) => [player.id, player]));
  const sources = { popflash: 0, faceit: 0, demo: 0, manual: 0 };
  for (const map of maps) {
    const source = map.stats_origin === "popflash" ? "popflash" : map.source;
    if (source in sources) sources[source as keyof typeof sources]++;
  }
  const rows = new Map<
    string,
    {
      steamId: string;
      name: string;
      maps: number;
      wins: number;
      losses: number;
      draws: number;
      kills: number;
      deaths: number;
      assists: number;
      adrTotal: number;
      adrRounds: number;
      ratingTotal: number;
      ratingRounds: number;
      ratedMaps: number;
    }
  >();
  for (const stat of stats) {
    const map = mapById.get(stat.match_id);
    const player = playerById.get(stat.player_id);
    if (!map || !player) continue;
    const row = rows.get(player.id) ?? {
      steamId: player.steam_id,
      name: player.display_name ?? player.steam_id,
      maps: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      adrTotal: 0,
      adrRounds: 0,
      ratingTotal: 0,
      ratingRounds: 0,
      ratedMaps: 0,
    };
    row.maps++;
    const own = stat.team === "A" ? map.score_a : map.score_b;
    const other = stat.team === "A" ? map.score_b : map.score_a;
    if (own > other) row.wins++;
    else if (own < other) row.losses++;
    else row.draws++;
    row.kills += stat.kills ?? 0;
    row.deaths += stat.deaths ?? 0;
    row.assists += stat.assists ?? 0;
    if (stat.rounds && stat.rounds > 0) {
      if (stat.adr !== null) {
        row.adrTotal += Number(stat.adr) * stat.rounds;
        row.adrRounds += stat.rounds;
      }
      if (stat.rating !== null) {
        row.ratingTotal += Number(stat.rating) * stat.rounds;
        row.ratingRounds += stat.rounds;
        row.ratedMaps++;
      }
    }
    rows.set(player.id, row);
  }
  return {
    mixes: mixes.length,
    maps: maps.length,
    players: rows.size,
    sources,
    leaderboard: [...rows.values()]
      .map((row) => ({
        steamId: row.steamId,
        name: row.name,
        maps: row.maps,
        wins: row.wins,
        losses: row.losses,
        draws: row.draws,
        kills: row.kills,
        deaths: row.deaths,
        assists: row.assists,
        adr: row.adrRounds ? row.adrTotal / row.adrRounds : null,
        rating: row.ratingRounds ? row.ratingTotal / row.ratingRounds : null,
        ratedMaps: row.ratedMaps,
      }))
      .sort(
        (a, b) =>
          (b.rating ?? -1) - (a.rating ?? -1) ||
          b.ratedMaps - a.ratedMaps ||
          a.name.localeCompare(b.name),
      ),
  };
}
