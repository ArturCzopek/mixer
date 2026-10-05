import { z } from "zod";

/**
 * FACEIT App Studio webhook body. Only the fields we use; the payload shape for match events is
 * not in the public docs (S6), so everything past `event` is optional and checked against our data.
 */
const webhook = z.object({
  event: z.string(),
  payload: z
    .object({
      id: z.string().optional(),
      entity: z.object({ id: z.string().optional() }).optional(),
      teams: z
        .array(
          z.object({
            roster: z
              .array(
                z.object({
                  id: z.string().optional(),
                  game_id: z.string().optional(),
                }),
              )
              .optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

export interface FinishedMatch {
  matchId: string;
  /** Hub or Club the room belongs to, when the payload names it. */
  entityId: string | null;
  /** FACEIT player ids and SteamID64s of everyone in the room. */
  players: Set<string>;
}

/** Returns the finished match, or null for any other event or an unusable body. */
export function finishedMatch(body: unknown): FinishedMatch | null {
  const parsed = webhook.safeParse(body);
  if (!parsed.success || parsed.data.event !== "match_status_finished")
    return null;
  const matchId = parsed.data.payload?.id;
  if (!matchId) return null;
  const players = new Set<string>();
  for (const team of parsed.data.payload?.teams ?? [])
    for (const player of team.roster ?? []) {
      if (player.id) players.add(player.id);
      if (player.game_id) players.add(player.game_id);
    }
  return {
    matchId,
    entityId: parsed.data.payload?.entity?.id ?? null,
    players,
  };
}

export interface LineupMix {
  id: string;
  /** The group's FACEIT Club id, if linked. */
  clubId: string | null;
  /** Each lineup player's identifiers: SteamID64 and FACEIT player id when known. */
  lineup: string[][];
}

/**
 * The mix whose chosen lineup played this room: at least 8 of its 10 players are in the room
 * (a late swap or a stand-in must not block the return) and, when both sides name it, in the
 * group's own Club, so the same friends in another hub never trigger it. Null when none or several
 * qualify.
 */
export function mixForMatch(
  match: FinishedMatch,
  mixes: LineupMix[],
): string | null {
  const hits = mixes.filter(
    (mix) =>
      (!match.entityId || !mix.clubId || match.entityId === mix.clubId) &&
      mix.lineup.filter((ids) => ids.some((id) => match.players.has(id)))
        .length >= 8,
  );
  return hits.length === 1 ? hits[0].id : null;
}
