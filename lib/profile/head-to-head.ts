import type { ProfileMap } from "./summary";

/** Shared group maps only; score-only maps count without inventing player stats. */
export function headToHead(a: ProfileMap[], b: ProfileMap[]) {
  const bByMatch = new Map(b.map((map) => [map.matchId, map]));
  const against = { maps: 0, aWins: 0, bWins: 0, draws: 0 };
  const together = { maps: 0, wins: 0, losses: 0, draws: 0 };
  const maps = a
    .flatMap((map) => {
      const other = bByMatch.get(map.matchId);
      if (!other) return [];
      const ownScore = map.team === "A" ? map.scoreA : map.scoreB;
      const opponentScore = map.team === "A" ? map.scoreB : map.scoreA;
      const outcomeA: "win" | "loss" | "draw" =
        ownScore > opponentScore
          ? "win"
          : ownScore < opponentScore
            ? "loss"
            : "draw";
      if (map.team === other.team) {
        together.maps++;
        if (outcomeA === "win") together.wins++;
        else if (outcomeA === "loss") together.losses++;
        else together.draws++;
      } else {
        against.maps++;
        if (outcomeA === "win") against.aWins++;
        else if (outcomeA === "loss") against.bWins++;
        else against.draws++;
      }
      return [
        {
          matchId: map.matchId,
          mixId: map.mixId,
          mixTitle: map.mixTitle,
          mapName: map.mapName ?? `#${map.mapNumber}`,
          mapNumber: map.mapNumber,
          playedAt: map.playedAt,
          scoreA: map.scoreA,
          scoreB: map.scoreB,
          teamA: map.team,
          teamB: other.team,
          outcomeA,
        },
      ];
    })
    .sort(
      (left, right) =>
        right.playedAt.localeCompare(left.playedAt) ||
        right.mapNumber - left.mapNumber,
    );
  return {
    sharedMaps: maps.length,
    sharedMixes: new Set(maps.map((map) => map.mixId)).size,
    against,
    together,
    maps,
  };
}

export type HeadToHead = ReturnType<typeof headToHead>;
