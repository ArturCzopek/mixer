import { matchAwards, type AwardKey, type AwardStat } from "@/lib/awards";

export type Period = "all" | "30" | "90" | "365";
export type ArchiveScope = "all" | "current" | "archive";
export interface AnalyticsOptions {
  period: Period;
  archive: ArchiveScope;
}
export interface AnalyticsMix {
  id: string;
  chosen_variant_id: string | null;
  archive_source: string | null;
}
export interface AnalyticsMap {
  id: string;
  mix_id: string;
  map_number: number;
  map_name: string | null;
  played_at: string;
  score_a: number;
  score_b: number;
  source: string;
  stats_origin: string | null;
}
export interface AnalyticsStat {
  match_id: string;
  player_id: string;
  team: "A" | "B";
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  adr: number | null;
  rounds: number | null;
  rating: number | null;
  hs_kills: number | null;
  first_kills: number | null;
  entry_attempts: number | null;
  entry_wins: number | null;
  clutch_attempts: number | null;
  flashes_thrown: number | null;
  flashes_successful: number | null;
  sniper_kills: number | null;
  mvps: number | null;
  clutch_wins: number | null;
  utility_damage: number | null;
  enemies_flashed: number | null;
  multi_4k: number | null;
  multi_5k: number | null;
}
export interface AnalyticsPlayer {
  id: string;
  steam_id: string;
  display_name: string | null;
}
export interface AnalyticsLineup {
  variant_id: string;
  player_id: string;
  team: "A" | "B";
}
export interface AnalyticsParticipant {
  mix_id: string;
  player_id: string;
  created_at: string;
}

type Person = { playerId: string; steamId: string; name: string };
export type PlayerAnalytics = Person & {
  maps: number;
  evenings: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number | null;
  ratedMaps: number;
  rating: number | null;
  adr: number | null;
  adrMaps: number;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  killsMaps: number;
  deathsMaps: number;
  assistsMaps: number;
  kd: number | null;
  kdMaps: number;
};

type Acc = Person & {
  mixIds: Set<string>;
  maps: number;
  wins: number;
  losses: number;
  draws: number;
  ratedMaps: number;
  ratingTotal: number;
  ratingRounds: number;
  adrMaps: number;
  adrTotal: number;
  adrRounds: number;
  kills: number;
  deaths: number;
  assists: number;
  killsMaps: number;
  deathsMaps: number;
  assistsMaps: number;
  kdKills: number;
  kdDeaths: number;
  kdMaps: number;
};

function playerRows(accs: Map<string, Acc>): PlayerAnalytics[] {
  return [...accs.values()]
    .map((a) => ({
      playerId: a.playerId,
      steamId: a.steamId,
      name: a.name,
      maps: a.maps,
      evenings: a.mixIds.size,
      wins: a.wins,
      losses: a.losses,
      draws: a.draws,
      winRate: a.maps ? a.wins / a.maps : null,
      ratedMaps: a.ratedMaps,
      rating: a.ratingRounds ? a.ratingTotal / a.ratingRounds : null,
      adr: a.adrRounds ? a.adrTotal / a.adrRounds : null,
      adrMaps: a.adrMaps,
      kills: a.killsMaps ? a.kills : null,
      deaths: a.deathsMaps ? a.deaths : null,
      assists: a.assistsMaps ? a.assists : null,
      killsMaps: a.killsMaps,
      deathsMaps: a.deathsMaps,
      assistsMaps: a.assistsMaps,
      kd: a.kdMaps && a.kdDeaths > 0 ? a.kdKills / a.kdDeaths : null,
      kdMaps: a.kdMaps,
    }))
    .sort(
      (a, b) =>
        (b.rating ?? -1) - (a.rating ?? -1) ||
        b.ratedMaps - a.ratedMaps ||
        a.name.localeCompare(b.name) ||
        a.steamId.localeCompare(b.steamId),
    );
}

function addPlayer(
  accs: Map<string, Acc>,
  person: Person,
  map: AnalyticsMap,
  team: "A" | "B",
  stat?: AnalyticsStat,
) {
  const a = accs.get(person.playerId) ?? {
    ...person,
    mixIds: new Set<string>(),
    maps: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    ratedMaps: 0,
    ratingTotal: 0,
    ratingRounds: 0,
    adrMaps: 0,
    adrTotal: 0,
    adrRounds: 0,
    kills: 0,
    deaths: 0,
    assists: 0,
    killsMaps: 0,
    deathsMaps: 0,
    assistsMaps: 0,
    kdKills: 0,
    kdDeaths: 0,
    kdMaps: 0,
  };
  a.maps++;
  a.mixIds.add(map.mix_id);
  const own = team === "A" ? map.score_a : map.score_b;
  const other = team === "A" ? map.score_b : map.score_a;
  if (own > other) a.wins++;
  else if (own < other) a.losses++;
  else a.draws++;
  if (stat) {
    for (const field of ["kills", "deaths", "assists"] as const)
      if (stat[field] !== null) {
        a[field] += stat[field];
        a[`${field}Maps`]++;
      }
    if (stat.kills !== null && stat.deaths !== null) {
      a.kdKills += stat.kills;
      a.kdDeaths += stat.deaths;
      a.kdMaps++;
    }
    if (stat.rounds !== null && stat.rounds > 0) {
      if (stat.rating !== null) {
        a.ratingTotal += Number(stat.rating) * stat.rounds;
        a.ratingRounds += stat.rounds;
        a.ratedMaps++;
      }
      if (stat.adr !== null) {
        a.adrTotal += Number(stat.adr) * stat.rounds;
        a.adrRounds += stat.rounds;
        a.adrMaps++;
      }
    }
  }
  accs.set(person.playerId, a);
}

/** A period selects whole evenings by their latest map, preserving evening awards. */
export function analyticsSummary(
  mixes: AnalyticsMix[],
  maps: AnalyticsMap[],
  stats: AnalyticsStat[],
  players: AnalyticsPlayer[],
  lineups: AnalyticsLineup[],
  participants: AnalyticsParticipant[],
  options: AnalyticsOptions,
  now = new Date(),
) {
  const latest = new Map<string, number>();
  for (const map of maps) {
    const at = Date.parse(map.played_at);
    if (Number.isFinite(at))
      latest.set(map.mix_id, Math.max(latest.get(map.mix_id) ?? 0, at));
  }
  const cutoff =
    options.period === "all"
      ? -Infinity
      : now.getTime() - Number(options.period) * 86400_000;
  const selected = mixes.filter(
    (mix) =>
      latest.has(mix.id) &&
      latest.get(mix.id)! >= cutoff &&
      (options.archive === "all" ||
        (options.archive === "archive") === (mix.archive_source !== null)),
  );
  const mixIds = new Set(selected.map((mix) => mix.id));
  const selectedMaps = maps.filter((map) => mixIds.has(map.mix_id));
  const mapById = new Map(selectedMaps.map((map) => [map.id, map]));
  const playerById = new Map(
    players.map((p) => [
      p.id,
      {
        playerId: p.id,
        steamId: p.steam_id,
        name: p.display_name ?? p.steam_id,
      },
    ]),
  );
  const statsByMap = new Map<string, AnalyticsStat[]>();
  for (const stat of stats) {
    if (!mapById.has(stat.match_id)) continue;
    const list = statsByMap.get(stat.match_id) ?? [];
    list.push(stat);
    statsByMap.set(stat.match_id, list);
  }
  const lineupByVariant = new Map<string, AnalyticsLineup[]>();
  for (const line of lineups) {
    const list = lineupByVariant.get(line.variant_id) ?? [];
    list.push(line);
    lineupByVariant.set(line.variant_id, list);
  }
  const mixById = new Map(selected.map((mix) => [mix.id, mix]));
  const participantIds = new Map<string, Set<string>>();
  for (const participant of participants) {
    const ids = participantIds.get(participant.mix_id) ?? new Set<string>();
    ids.add(participant.player_id);
    participantIds.set(participant.mix_id, ids);
  }
  const leaderAcc = new Map<string, Acc>();
  const mapGroups = new Map<
    string,
    {
      name: string;
      maps: number;
      mixIds: Set<string>;
      scoreA: number;
      scoreB: number;
      winsA: number;
      winsB: number;
      draws: number;
      players: Map<string, Acc>;
    }
  >();
  const pairGroups = new Map<
    string,
    {
      players: [Person, Person];
      maps: number;
      mixIds: Set<string>;
      wins: number;
      losses: number;
      draws: number;
    }
  >();
  const awardLines = new Map<string, AwardStat[]>();
  for (const map of selectedMaps) {
    const rawName = map.map_name?.trim().replace(/^de_/i, "") || "";
    const key = rawName.toLocaleLowerCase("en");
    const name = rawName ? rawName[0].toUpperCase() + rawName.slice(1) : "";
    const group = mapGroups.get(key) ?? {
      name,
      maps: 0,
      mixIds: new Set<string>(),
      scoreA: 0,
      scoreB: 0,
      winsA: 0,
      winsB: 0,
      draws: 0,
      players: new Map<string, Acc>(),
    };
    group.maps++;
    group.mixIds.add(map.mix_id);
    group.scoreA += map.score_a;
    group.scoreB += map.score_b;
    if (map.score_a > map.score_b) group.winsA++;
    else if (map.score_b > map.score_a) group.winsB++;
    else group.draws++;
    mapGroups.set(key, group);
    const stored = statsByMap.get(map.id) ?? [];
    // A chosen lineup is reliable for score-only maps. Recorded stats own the team on every other map.
    const rows: { player_id: string; team: "A" | "B"; stat?: AnalyticsStat }[] =
      stored.length
        ? stored.map((stat) => ({
            player_id: stat.player_id,
            team: stat.team,
            stat,
          }))
        : (
            lineupByVariant.get(
              mixById.get(map.mix_id)?.chosen_variant_id ?? "",
            ) ?? []
          ).map((line) => ({ player_id: line.player_id, team: line.team }));
    const sides = { A: [] as Person[], B: [] as Person[] };
    for (const row of rows) {
      const person = playerById.get(row.player_id);
      if (!person || (row.team !== "A" && row.team !== "B")) continue;
      sides[row.team].push(person);
      const stat = row.stat;
      addPlayer(leaderAcc, person, map, row.team, stat);
      addPlayer(group.players, person, map, row.team, stat);
      if (stat && participantIds.get(map.mix_id)?.has(stat.player_id)) {
        const lines = awardLines.get(map.mix_id) ?? [];
        lines.push({
          steamId: person.steamId,
          rounds: stat.rounds,
          kills: stat.kills,
          deaths: stat.deaths,
          assists: stat.assists,
          adr: stat.adr === null ? null : Number(stat.adr),
          headshotKills: stat.hs_kills,
          firstKills: stat.first_kills,
          entryAttempts: stat.entry_attempts,
          entryWins: stat.entry_wins,
          clutchAttempts: stat.clutch_attempts,
          flashesThrown: stat.flashes_thrown,
          flashesSuccessful: stat.flashes_successful,
          sniperKills: stat.sniper_kills,
          mvps: stat.mvps,
          clutchWins: stat.clutch_wins,
          utilityDamage: stat.utility_damage,
          enemiesFlashed: stat.enemies_flashed,
          multi4: stat.multi_4k,
          multi5: stat.multi_5k,
          matchId: map.id,
          team: stat.team,
          scoreA: map.score_a,
          scoreB: map.score_b,
        });
        awardLines.set(map.mix_id, lines);
      }
    }
    for (const team of ["A", "B"] as const)
      for (let i = 0; i < sides[team].length; i++)
        for (let j = i + 1; j < sides[team].length; j++) {
          const people = [sides[team][i], sides[team][j]].sort((a, b) =>
            a.steamId.localeCompare(b.steamId),
          ) as [Person, Person];
          const key = `${people[0].playerId}:${people[1].playerId}`;
          const pair = pairGroups.get(key) ?? {
            players: people,
            maps: 0,
            mixIds: new Set<string>(),
            wins: 0,
            losses: 0,
            draws: 0,
          };
          pair.maps++;
          pair.mixIds.add(map.mix_id);
          const own = team === "A" ? map.score_a : map.score_b;
          const other = team === "A" ? map.score_b : map.score_a;
          if (own > other) pair.wins++;
          else if (own < other) pair.losses++;
          else pair.draws++;
          pairGroups.set(key, pair);
        }
  }
  const orderByMix = new Map<string, string[]>();
  for (const p of [...participants].sort(
    (a, b) =>
      a.created_at.localeCompare(b.created_at) ||
      a.player_id.localeCompare(b.player_id),
  )) {
    const steamId = playerById.get(p.player_id)?.steamId;
    if (steamId && mixIds.has(p.mix_id))
      orderByMix.set(p.mix_id, [...(orderByMix.get(p.mix_id) ?? []), steamId]);
  }
  const awards = new Map<AwardKey, Map<string, number>>();
  for (const mix of selected)
    for (const award of matchAwards(
      awardLines.get(mix.id) ?? [],
      orderByMix.get(mix.id) ?? [],
    )) {
      const counts = awards.get(award.key) ?? new Map<string, number>();
      counts.set(award.steamId, (counts.get(award.steamId) ?? 0) + 1);
      awards.set(award.key, counts);
    }
  const personBySteam = new Map(
    [...playerById.values()].map((p) => [p.steamId, p]),
  );
  return {
    scope: options,
    totals: {
      evenings: selected.length,
      maps: selectedMaps.length,
      scoreOnlyMaps: selectedMaps.filter(
        (map) => !statsByMap.get(map.id)?.length,
      ).length,
      archives: selected.filter((mix) => mix.archive_source !== null).length,
      current: selected.filter((mix) => mix.archive_source === null).length,
      sources: selectedMaps.reduce(
        (counts, map) => {
          const source = map.stats_origin ?? map.source;
          if (source in counts) counts[source as keyof typeof counts]++;
          return counts;
        },
        { faceit: 0, popflash: 0, manual: 0, demo: 0 },
      ),
    },
    leaderboard: playerRows(leaderAcc),
    mapPerformance: [...mapGroups.values()]
      .map((g) => ({
        name: g.name,
        maps: g.maps,
        evenings: g.mixIds.size,
        scoreA: g.scoreA,
        scoreB: g.scoreB,
        winsA: g.winsA,
        winsB: g.winsB,
        draws: g.draws,
        players: playerRows(g.players),
      }))
      .sort((a, b) => b.maps - a.maps || a.name.localeCompare(b.name)),
    teammatePairs: [...pairGroups.values()]
      .map((p) => ({
        players: p.players,
        maps: p.maps,
        evenings: p.mixIds.size,
        wins: p.wins,
        losses: p.losses,
        draws: p.draws,
        winRate: p.wins / p.maps,
        eligible: p.maps >= 5,
      }))
      .sort(
        (a, b) =>
          Number(b.eligible) - Number(a.eligible) ||
          b.winRate - a.winRate ||
          b.maps - a.maps ||
          a.players[0].name.localeCompare(b.players[0].name) ||
          a.players[1].name.localeCompare(b.players[1].name),
      ),
    awards: [...awards]
      .map(([key, counts]) => ({
        key,
        total: [...counts.values()].reduce((a, b) => a + b, 0),
        leaders: [...counts]
          .flatMap(([steamId, count]) => {
            const person = personBySteam.get(steamId);
            return person ? [{ ...person, count }] : [];
          })
          .sort(
            (a, b) =>
              b.count - a.count ||
              a.name.localeCompare(b.name) ||
              a.steamId.localeCompare(b.steamId),
          ),
      }))
      .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key)),
  };
}
