export interface ProfileMap {
  matchId: string;
  mixId: string;
  mixTitle: string;
  mapNumber: number;
  mapName: string | null;
  playedAt: string;
  scoreA: number;
  scoreB: number;
  faceitRoomUrl?: string | null;
  team: "A" | "B";
  stats: {
    kills: number | null;
    deaths: number | null;
    assists: number | null;
    adr: number | null;
    rounds: number | null;
    rating: number | null;
  } | null;
  teammates: { id: string; name: string; steamId: string }[];
}

export function profileSummary(maps: ProfileMap[]) {
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let kills = 0;
  let deaths = 0;
  let assists = 0;
  let ratedRounds = 0;
  let adrRounds = 0;
  let ratingSum = 0;
  let adrSum = 0;
  const mates = new Map<
    string,
    { id: string; name: string; steamId: string; maps: number; wins: number }
  >();
  const outcomes = maps.map((map) => {
    const ours = map.team === "A" ? map.scoreA : map.scoreB;
    const theirs = map.team === "A" ? map.scoreB : map.scoreA;
    const outcome: "win" | "loss" | "draw" =
      ours > theirs ? "win" : ours < theirs ? "loss" : "draw";
    if (outcome === "win") wins++;
    else if (outcome === "loss") losses++;
    else draws++;
    for (const teammate of map.teammates) {
      const item = mates.get(teammate.id) ?? { ...teammate, maps: 0, wins: 0 };
      item.maps++;
      if (outcome === "win") item.wins++;
      mates.set(teammate.id, item);
    }
    const s = map.stats;
    if (s) {
      kills += s.kills ?? 0;
      deaths += s.deaths ?? 0;
      assists += s.assists ?? 0;
      if (s.rounds !== null && s.rounds > 0) {
        if (s.rating !== null) {
          ratedRounds += s.rounds;
          ratingSum += s.rating * s.rounds;
        }
        if (s.adr !== null) {
          adrRounds += s.rounds;
          adrSum += s.adr * s.rounds;
        }
      }
    }
    return { ...map, outcome };
  });
  const rated = outcomes.filter(
    (map) => map.stats?.rating !== null && map.stats?.rating !== undefined,
  );
  return {
    maps: outcomes,
    mapCount: maps.length,
    wins,
    losses,
    draws,
    winRate: maps.length ? wins / maps.length : null,
    kills,
    deaths,
    assists,
    rating: ratedRounds ? ratingSum / ratedRounds : null,
    adr: adrRounds ? adrSum / adrRounds : null,
    ratedMaps: rated.length,
    trend: rated.map((map) => ({
      id: map.matchId,
      at: map.playedAt,
      mixId: map.mixId,
      map: map.mapName ?? `#${map.mapNumber}`,
      scoreA: map.scoreA,
      scoreB: map.scoreB,
      faceitRoomUrl: map.faceitRoomUrl ?? null,
      rating: map.stats!.rating!,
    })),
    bestTeammates: [...mates.values()].sort(
      (a, b) =>
        b.wins / b.maps - a.wins / a.maps ||
        b.maps - a.maps ||
        a.name.localeCompare(b.name),
    ),
  };
}
