/** Awards use only observed fields. Missing source stats never count as zero. */
export interface AwardStat {
  steamId: string;
  rounds: number | null;
  kills: number | null;
  headshotKills?: number | null;
  deaths: number | null;
  assists: number | null;
  adr: number | null;
  firstKills: number | null;
  clutchWins: number | null;
  utilityDamage: number | null;
  enemiesFlashed: number | null;
  multi4: number | null;
  multi5: number | null;
  matchId?: string;
  team?: "A" | "B";
  scoreA?: number;
  scoreB?: number;
}

export type AwardKey =
  | "cannonFodder"
  | "pacifist"
  | "assistKing"
  | "tourist"
  | "headhunter"
  | "sprayAndPray"
  | "doorOpener"
  | "clutchMinister"
  | "grenadier"
  | "sunglasses"
  | "exterminator"
  | "soClose"
  | "loneWolf";

export interface MatchAward {
  key: AwardKey;
  steamId: string;
  value: number;
}

const sum = (a: number | null, b: number | null) =>
  a === null || b === null ? null : a + b;

export function matchAwards(
  lines: AwardStat[],
  joinOrder: string[],
): MatchAward[] {
  const byPlayer = new Map<string, AwardStat & { adrTotal: number | null }>();
  for (const line of lines) {
    const previous = byPlayer.get(line.steamId);
    const adrTotal =
      line.adr === null || line.rounds === null ? null : line.adr * line.rounds;
    if (!previous) {
      byPlayer.set(line.steamId, { ...line, adrTotal });
      continue;
    }
    byPlayer.set(line.steamId, {
      steamId: line.steamId,
      rounds: sum(previous.rounds, line.rounds),
      kills: sum(previous.kills, line.kills),
      headshotKills: sum(
        previous.headshotKills ?? null,
        line.headshotKills ?? null,
      ),
      deaths: sum(previous.deaths, line.deaths),
      assists: sum(previous.assists, line.assists),
      adr: null,
      adrTotal: sum(previous.adrTotal, adrTotal),
      firstKills: sum(previous.firstKills, line.firstKills),
      clutchWins: sum(previous.clutchWins, line.clutchWins),
      utilityDamage: sum(previous.utilityDamage, line.utilityDamage),
      enemiesFlashed: sum(previous.enemiesFlashed, line.enemiesFlashed),
      multi4: sum(previous.multi4, line.multi4),
      multi5: sum(previous.multi5, line.multi5),
    });
  }
  const players = [...byPlayer.values()].map((row) => ({
    ...row,
    adr:
      row.adrTotal !== null && row.rounds && row.rounds > 0
        ? row.adrTotal / row.rounds
        : null,
  }));
  const order = new Map(joinOrder.map((steamId, index) => [steamId, index]));
  const candidates: (MatchAward & { severity: number; order: number })[] = [];
  function award(
    key: AwardKey,
    metric: (line: AwardStat) => number | null,
    passes: (value: number, line: AwardStat) => boolean,
    severity: (value: number) => number,
  ) {
    const eligible = players
      .flatMap((line) => {
        const value = metric(line);
        return value !== null && passes(value, line) ? [{ line, value }] : [];
      })
      .sort(
        (a, b) =>
          severity(b.value) - severity(a.value) ||
          (order.get(a.line.steamId) ?? Infinity) -
            (order.get(b.line.steamId) ?? Infinity),
      );
    const winner = eligible[0];
    if (winner)
      candidates.push({
        key,
        steamId: winner.line.steamId,
        value: winner.value,
        severity: severity(winner.value),
        order: order.get(winner.line.steamId) ?? Infinity,
      });
  }
  const perRound = (value: number | null, line: AwardStat) =>
    value !== null && line.rounds && line.rounds > 0
      ? value / line.rounds
      : null;
  award(
    "cannonFodder",
    (line) => perRound(line.deaths, line),
    (v) => v >= 0.8,
    (v) => v / 0.8,
  );
  award(
    "pacifist",
    (line) => line.adr,
    (v) => v < 55,
    (v) => 55 / Math.max(v, 1),
  );
  award(
    "assistKing",
    (line) => perRound(line.assists, line),
    (v) => v >= 0.25,
    (v) => v / 0.25,
  );
  award(
    "tourist",
    (line) => perRound(line.kills, line),
    (v) => v < 0.45,
    (v) => 0.45 / Math.max(v, 0.01),
  );
  const headshotPercent = (line: AwardStat) =>
    line.kills !== null &&
    line.kills >= 15 &&
    line.headshotKills != null &&
    Number.isFinite(line.kills) &&
    Number.isFinite(line.headshotKills) &&
    line.headshotKills >= 0 &&
    line.headshotKills <= line.kills
      ? (100 * line.headshotKills) / line.kills
      : null;
  award(
    "headhunter",
    headshotPercent,
    (v) => v >= 65,
    (v) => v / 65,
  );
  award(
    "sprayAndPray",
    headshotPercent,
    (v) => v <= 25,
    (v) => 25 / Math.max(v, 0.01),
  );
  award(
    "doorOpener",
    (line) => line.firstKills,
    (v) => v >= 5,
    (v) => v / 5,
  );
  award(
    "clutchMinister",
    (line) => line.clutchWins,
    (v) => v >= 2,
    (v) => v / 2,
  );
  award(
    "grenadier",
    (line) => line.utilityDamage,
    (v) => v >= 250,
    (v) => v / 250,
  );
  award(
    "sunglasses",
    (line) => line.enemiesFlashed,
    (v) => v >= 15,
    (v) => v / 15,
  );
  award(
    "exterminator",
    (line) => line.multi5,
    (v) => v >= 1,
    (v) => v,
  );
  award(
    "soClose",
    (line) => line.multi4,
    (v) => v >= 2,
    (v) => v / 2,
  );

  const byMatch = new Map<string, AwardStat[]>();
  for (const line of lines) {
    if (!line.matchId) continue;
    const map = byMatch.get(line.matchId) ?? [];
    map.push(line);
    byMatch.set(line.matchId, map);
  }
  const loneWolves = [...byMatch.values()].flatMap((map) => {
    const { scoreA, scoreB } = map[0];
    if (
      scoreA === undefined ||
      scoreB === undefined ||
      !Number.isFinite(scoreA) ||
      !Number.isFinite(scoreB) ||
      Math.abs(scoreA - scoreB) < 5 ||
      map.some((line) => line.scoreA !== scoreA || line.scoreB !== scoreB)
    )
      return [];
    const losingTeam = scoreA < scoreB ? "A" : "B";
    const losers = map.filter((line) => line.team === losingTeam);
    if (
      losers.length !== 5 ||
      new Set(losers.map((line) => line.steamId)).size !== 5 ||
      losers.some((line) => line.kills === null || !Number.isFinite(line.kills))
    )
      return [];
    const topKills = Math.max(...losers.map((line) => line.kills!));
    const top = losers
      .filter((line) => line.kills === topKills)
      .sort(
        (a, b) =>
          (order.get(a.steamId) ?? Infinity) -
          (order.get(b.steamId) ?? Infinity),
      )[0];
    return [
      {
        steamId: top.steamId,
        value: topKills,
        severity: Math.abs(scoreA - scoreB) / 5,
      },
    ];
  });
  loneWolves.sort(
    (a, b) =>
      b.severity - a.severity ||
      (order.get(a.steamId) ?? Infinity) - (order.get(b.steamId) ?? Infinity),
  );
  if (loneWolves[0])
    candidates.push({
      key: "loneWolf",
      ...loneWolves[0],
      order: order.get(loneWolves[0].steamId) ?? Infinity,
    });

  const counts = new Map<string, number>();
  return candidates
    .sort((a, b) => b.severity - a.severity || a.order - b.order)
    .filter((candidate) => {
      const count = counts.get(candidate.steamId) ?? 0;
      if (count >= 2) return false;
      counts.set(candidate.steamId, count + 1);
      return true;
    })
    .slice(0, 6)
    .map(({ key, steamId, value }) => ({ key, steamId, value }));
}
