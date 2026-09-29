import { ASSUMED_KAST, mixerRating2 } from "@/lib/balance";
import type { PopflashMatch, PopflashPlayer } from "@/backtest/data";

export interface ArchiveMap {
  id: string;
  at: string;
  name: string;
  scoreA: number;
  scoreB: number;
  lines: {
    steamId: string;
    team: "A" | "B";
    rating: number;
    raw: PopflashMatch["players"][number];
  }[];
}

export interface ArchiveEvening {
  key: string;
  title: string;
  at: string;
  teamA: string[];
  teamB: string[];
  maps: ArchiveMap[];
}

const same = (a: string[], b: string[]) => a.join() === b.join();

export function popflashArchive(
  matches: PopflashMatch[],
  players: PopflashPlayer[],
): { evenings: ArchiveEvening[]; names: Map<string, string> } {
  const steamByPopflash = new Map(
    players.map((player) => [
      player.popflashId,
      player.mergeInto ?? player.steamId,
    ]),
  );
  const names = new Map(
    players
      .filter((player) => !player.mergeInto)
      .map((player) => [
        player.steamId,
        player.who ?? player.faceitNickname ?? player.name,
      ]),
  );
  const steam = (id: string) => {
    const value = steamByPopflash.get(id);
    if (!value) throw new Error(`Unmapped Popflash player ${id}`);
    return value;
  };
  const evenings: ArchiveEvening[] = [];
  const dayParts = new Map<string, number>();
  for (const match of [...matches].sort((a, b) =>
    a.date.localeCompare(b.date),
  )) {
    const day = match.date.slice(0, 10);
    const team1 = match.players
      .filter((line) => line.team === 1)
      .map((line) => steam(line.popflashId))
      .sort();
    const team2 = match.players
      .filter((line) => line.team === 2)
      .map((line) => steam(line.popflashId))
      .sort();
    if (
      team1.length !== 5 ||
      team2.length !== 5 ||
      new Set([...team1, ...team2]).size !== 10
    )
      throw new Error(`Invalid ten-player lineup in Popflash map ${match.id}`);
    let evening = evenings.at(-1);
    if (
      !evening ||
      !evening.key.startsWith(`popflash:${day}:`) ||
      !(
        (same(team1, evening.teamA) && same(team2, evening.teamB)) ||
        (same(team1, evening.teamB) && same(team2, evening.teamA))
      )
    ) {
      const part = (dayParts.get(day) ?? 0) + 1;
      dayParts.set(day, part);
      evening = {
        key: `popflash:${day}:${part}`,
        title: `Popflash · ${day}${part > 1 ? ` · part ${part}` : ""}`,
        at: match.date,
        teamA: team1,
        teamB: team2,
        maps: [],
      };
      evenings.push(evening);
    }
    const aIsTeam1 = same(team1, evening.teamA);
    evening.maps.push({
      id: match.id,
      at: match.date,
      name: mapName(match.map),
      scoreA: aIsTeam1 ? match.score1 : match.score2,
      scoreB: aIsTeam1 ? match.score2 : match.score1,
      lines: match.players.map((line) => ({
        steamId: steam(line.popflashId),
        team: (line.team === (aIsTeam1 ? 1 : 2) ? "A" : "B") as "A" | "B",
        rating:
          Math.round(
            mixerRating2({
              kills: line.kills,
              deaths: line.deaths,
              assists: line.assists,
              rounds: line.rounds,
              adr: line.adr,
              kastPct: line.kast
                ? (100 * line.kast) / line.rounds
                : ASSUMED_KAST,
            }) * 1000,
          ) / 1000,
        raw: line,
      })),
    });
  }
  return { evenings, names };
}

function mapName(value: string) {
  if (value.includes("cache")) return "Cache";
  if (value.includes("cbble")) return "Cobblestone";
  return value
    .replace(/^de_/, "")
    .replace(/^./, (letter) => letter.toUpperCase());
}
