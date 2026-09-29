/** Awards use only observed fields. Missing source stats never count as zero. */
export interface AwardStat {
  steamId: string;
  rounds: number | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  adr: number | null;
  firstKills: number | null;
  clutchWins: number | null;
  utilityDamage: number | null;
  enemiesFlashed: number | null;
  multi4: number | null;
  multi5: number | null;
}

export type AwardKey =
  | "cannonFodder"
  | "pacifist"
  | "assistKing"
  | "tourist"
  | "doorOpener"
  | "clutchMinister"
  | "grenadier"
  | "sunglasses"
  | "exterminator"
  | "soClose";

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
