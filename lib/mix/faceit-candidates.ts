/** Pure FACEIT room selection for one locked mix evening (D27). */
export interface FaceitRoom {
  id: string;
  startedAt: string;
  status: string;
  competitionId: string | null;
  bestOf: number;
  faction1: string[];
  faction2: string[];
  map: string | null;
  score1: number | null;
  score2: number | null;
  roomUrl: string;
}

export interface FaceitCandidate extends FaceitRoom {
  coverage: number;
  /** Null means both orientations match equally well; admin must choose. */
  teamAIsFaction1: boolean | null;
  lineupMismatch: string[];
}

/** Accept a FACEIT room link or its public match ID, never an arbitrary URL. */
export function faceitRoomId(input: string): string | null {
  const value = input.trim();
  if (/^1-[0-9a-f-]{36}$/i.test(value)) return value;
  try {
    const url = new URL(value);
    if (
      !["www.faceit.com", "faceit.com"].includes(url.hostname) ||
      url.protocol !== "https:"
    )
      return null;
    const id = /\/cs2\/room\/(1-[0-9a-f-]{36})\/?$/i.exec(url.pathname)?.[1];
    return id ?? null;
  } catch {
    return null;
  }
}

export function faceitCandidates(
  rooms: FaceitRoom[],
  options: {
    lockedAt: string;
    nextLockedAt?: string | null;
    clubId?: string | null;
    teamA: string[];
    teamB: string[];
  },
): FaceitCandidate[] {
  const teamA = new Set(options.teamA);
  const teamB = new Set(options.teamB);
  const roster = new Set([...teamA, ...teamB]);
  const start = Date.parse(options.lockedAt);
  const end = options.nextLockedAt
    ? Date.parse(options.nextLockedAt)
    : Infinity;
  const seen = new Set<string>();
  const eligible = rooms
    .filter((room) => {
      const at = Date.parse(room.startedAt);
      if (!Number.isFinite(at) || at < start || at >= end) return false;
      if (room.status !== "FINISHED") return false;
      if (room.bestOf !== 1) return false;
      if (options.clubId && room.competitionId !== options.clubId) return false;
      return (
        new Set(
          [...room.faction1, ...room.faction2].filter((id) => roster.has(id)),
        ).size >= 8
      );
    })
    .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
  const first = eligible[0] ? Date.parse(eligible[0].startedAt) : Infinity;
  return eligible.flatMap((room) => {
    if (
      Date.parse(room.startedAt) > first + 6 * 60 * 60_000 ||
      seen.has(room.id)
    )
      return [];
    seen.add(room.id);
    const normal =
      room.faction1.filter((id) => teamA.has(id)).length +
      room.faction2.filter((id) => teamB.has(id)).length;
    const flipped =
      room.faction1.filter((id) => teamB.has(id)).length +
      room.faction2.filter((id) => teamA.has(id)).length;
    const teamAIsFaction1 = normal === flipped ? null : normal > flipped;
    const expected1 =
      teamAIsFaction1 === null ? null : teamAIsFaction1 ? teamA : teamB;
    const expected2 =
      teamAIsFaction1 === null ? null : teamAIsFaction1 ? teamB : teamA;
    const lineupMismatch = [
      ...room.faction1.filter((id) => !expected1?.has(id)),
      ...room.faction2.filter((id) => !expected2?.has(id)),
      ...[...roster].filter(
        (id) => !room.faction1.includes(id) && !room.faction2.includes(id),
      ),
    ];
    return [
      {
        ...room,
        coverage: new Set(
          [...room.faction1, ...room.faction2].filter((id) => roster.has(id)),
        ).size,
        teamAIsFaction1,
        lineupMismatch,
      },
    ];
  });
}
