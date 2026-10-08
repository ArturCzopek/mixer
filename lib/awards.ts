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
  entryAttempts?: number | null;
  entryWins?: number | null;
  clutchAttempts?: number | null;
  clutchWins: number | null;
  utilityDamage: number | null;
  enemiesFlashed: number | null;
  flashesThrown?: number | null;
  flashesSuccessful?: number | null;
  sniperKills?: number | null;
  mvps?: number | null;
  multi4: number | null;
  multi5: number | null;
  friendlyFlashes?: number | null;
  friendlyDamage?: number | null;
  selfDamage?: number | null;
  suicides?: number | null;
  chickenKills?: number | null;
  knifeKills?: number | null;
  taserKills?: number | null;
  wallbangKills?: number | null;
  smokeKills?: number | null;
  blindKills?: number | null;
  airKills?: number | null;
  noScopeKills?: number | null;
  tradeKills?: number | null;
  savedLostRounds?: number | null;
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
  | "kamikaze"
  | "doorOpener"
  | "clutchMinister"
  | "clutchOrKick"
  | "grenadier"
  | "sunglasses"
  | "flashBangWhiff"
  | "scopeAddict"
  | "exterminator"
  | "soClose"
  | "loneWolf"
  | "mvpHoarder"
  | "friendlyFlasher"
  | "friendlyFireEnthusiast"
  | "selfDestruct"
  | "chickenHunter"
  | "knifeCollector"
  | "zeusEnthusiast"
  | "xRay"
  | "smokeCriminal"
  | "blindFury"
  | "airJordan"
  | "noScopeArtist"
  | "baitMaster"
  | "saveArtist";

export interface MatchAward {
  key: AwardKey;
  steamId: string;
  value: number;
  metric?: "damage" | "suicides";
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
      entryAttempts: sum(
        previous.entryAttempts ?? null,
        line.entryAttempts ?? null,
      ),
      entryWins: sum(previous.entryWins ?? null, line.entryWins ?? null),
      clutchAttempts: sum(
        previous.clutchAttempts ?? null,
        line.clutchAttempts ?? null,
      ),
      clutchWins: sum(previous.clutchWins, line.clutchWins),
      utilityDamage: sum(previous.utilityDamage, line.utilityDamage),
      enemiesFlashed: sum(previous.enemiesFlashed, line.enemiesFlashed),
      flashesThrown: sum(
        previous.flashesThrown ?? null,
        line.flashesThrown ?? null,
      ),
      flashesSuccessful: sum(
        previous.flashesSuccessful ?? null,
        line.flashesSuccessful ?? null,
      ),
      sniperKills: sum(previous.sniperKills ?? null, line.sniperKills ?? null),
      mvps: sum(previous.mvps ?? null, line.mvps ?? null),
      multi4: sum(previous.multi4, line.multi4),
      multi5: sum(previous.multi5, line.multi5),
      friendlyFlashes: sum(
        previous.friendlyFlashes ?? null,
        line.friendlyFlashes ?? null,
      ),
      friendlyDamage: sum(
        previous.friendlyDamage ?? null,
        line.friendlyDamage ?? null,
      ),
      selfDamage: sum(previous.selfDamage ?? null, line.selfDamage ?? null),
      suicides: sum(previous.suicides ?? null, line.suicides ?? null),
      chickenKills: sum(
        previous.chickenKills ?? null,
        line.chickenKills ?? null,
      ),
      knifeKills: sum(previous.knifeKills ?? null, line.knifeKills ?? null),
      taserKills: sum(previous.taserKills ?? null, line.taserKills ?? null),
      wallbangKills: sum(
        previous.wallbangKills ?? null,
        line.wallbangKills ?? null,
      ),
      smokeKills: sum(previous.smokeKills ?? null, line.smokeKills ?? null),
      blindKills: sum(previous.blindKills ?? null, line.blindKills ?? null),
      airKills: sum(previous.airKills ?? null, line.airKills ?? null),
      noScopeKills: sum(
        previous.noScopeKills ?? null,
        line.noScopeKills ?? null,
      ),
      tradeKills: sum(previous.tradeKills ?? null, line.tradeKills ?? null),
      savedLostRounds: sum(
        previous.savedLostRounds ?? null,
        line.savedLostRounds ?? null,
      ),
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
  const observedCount = (value: number | null | undefined) =>
    value != null && Number.isFinite(value) && value >= 0 ? value : null;
  const share = (
    numerator: number | null | undefined,
    denominator: number | null | undefined,
    minimum: number,
  ) =>
    numerator != null &&
    denominator != null &&
    Number.isFinite(numerator) &&
    Number.isFinite(denominator) &&
    denominator >= minimum &&
    numerator >= 0 &&
    numerator <= denominator
      ? numerator / denominator
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
    "kamikaze",
    (line) => share(line.entryWins, line.entryAttempts, 5),
    (v) => v <= 0.3,
    (v) => 0.3 / Math.max(v, 0.001),
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
    "clutchOrKick",
    (line) =>
      line.clutchAttempts != null &&
      Number.isFinite(line.clutchAttempts) &&
      line.clutchWins === 0
        ? line.clutchAttempts
        : null,
    (v) => v >= 3,
    (v) => v / 3,
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
    "flashBangWhiff",
    (line) => share(line.flashesSuccessful, line.flashesThrown, 10),
    (v) => v <= 0.3,
    (v) => 0.3 / Math.max(v, 0.001),
  );
  award(
    "scopeAddict",
    (line) => share(line.sniperKills, line.kills, 10),
    (v) => v >= 0.4,
    (v) => v / 0.4,
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
  award(
    "mvpHoarder",
    (line) =>
      share(line.mvps, line.rounds, 1) === null ? null : (line.mvps ?? null),
    (v, line) => line.rounds !== null && v / line.rounds >= 0.2,
    (v) => v,
  );
  for (const [key, field, threshold] of [
    ["friendlyFlasher", "friendlyFlashes", 5],
    ["friendlyFireEnthusiast", "friendlyDamage", 100],
    ["chickenHunter", "chickenKills", 1],
    ["knifeCollector", "knifeKills", 1],
    ["zeusEnthusiast", "taserKills", 1],
    ["xRay", "wallbangKills", 3],
    ["smokeCriminal", "smokeKills", 3],
    ["blindFury", "blindKills", 1],
    ["airJordan", "airKills", 1],
    ["noScopeArtist", "noScopeKills", 1],
    ["saveArtist", "savedLostRounds", 5],
  ] as const)
    award(
      key,
      (line) => observedCount(line[field]),
      (v) => v >= threshold,
      (v) => v / threshold,
    );
  award(
    "baitMaster",
    (line) => share(line.tradeKills, line.kills, 10),
    (v) => v >= 0.4,
    (v) => v / 0.4,
  );

  const selfDestruct = players
    .flatMap((line) => {
      const damage = observedCount(line.selfDamage);
      const suicides = observedCount(line.suicides);
      const damageSeverity = damage !== null && damage >= 50 ? damage / 50 : 0;
      const suicideSeverity = suicides !== null && suicides >= 1 ? suicides : 0;
      if (!damageSeverity && !suicideSeverity) return [];
      const metric: NonNullable<MatchAward["metric"]> =
        damageSeverity >= suicideSeverity ? "damage" : "suicides";
      return [
        {
          key: "selfDestruct" as const,
          steamId: line.steamId,
          value: metric === "damage" ? damage! : suicides!,
          metric,
          severity: Math.max(damageSeverity, suicideSeverity),
          order: order.get(line.steamId) ?? Infinity,
        },
      ];
    })
    .sort((a, b) => b.severity - a.severity || a.order - b.order)[0];
  if (selfDestruct) candidates.push(selfDestruct);

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
    .map(({ key, steamId, value, metric }) => ({
      key,
      steamId,
      value,
      ...(metric ? { metric } : {}),
    }));
}
