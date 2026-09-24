// 5v5 split enumeration and comparison (docs/04-team-balancing.md §3, §6).

export const TEAM_SIZE = 5;

/**
 * All C(10,5)/2 = 126 splits of 10 ids into two teams of 5. `ids[0]` is always in the first
 * team, which removes mirrored duplicates. Order follows the input order (deterministic).
 */
export function enumerateSplits(
  ids: readonly string[],
): [string[], string[]][] {
  if (ids.length !== TEAM_SIZE * 2) {
    throw new Error(`Expected ${TEAM_SIZE * 2} players, got ${ids.length}`);
  }
  const result: [string[], string[]][] = [];
  const pick = (start: number, chosen: number[]) => {
    if (chosen.length === TEAM_SIZE) {
      const inA = new Set(chosen);
      result.push([
        chosen.map((i) => ids[i]),
        ids.filter((_, i) => !inA.has(i)),
      ]);
      return;
    }
    for (let i = start; i < ids.length; i++) pick(i + 1, [...chosen, i]);
  };
  pick(1, [0]);
  return result;
}

/**
 * Mirror-independent identity of a split: the team holding the smallest SteamID, sorted.
 * Works for any team of the split, e.g. a stored lineup or a previously shown variant.
 */
export function splitKey(
  team: readonly string[],
  allIds: readonly string[],
): string {
  const smallest = [...allIds].sort()[0];
  const side = team.includes(smallest)
    ? [...team]
    : allIds.filter((id) => !team.includes(id));
  return side.sort().join(",");
}

/**
 * Number of player swaps needed to turn one split into the other, mirrors considered.
 * For 5v5 this is 0 (same split), 1 or 2.
 */
export function splitDistance(
  teamA1: readonly string[],
  teamA2: readonly string[],
): number {
  const inA2 = new Set(teamA2);
  const moved = teamA1.filter((id) => !inA2.has(id)).length;
  return Math.min(moved, TEAM_SIZE - moved);
}
