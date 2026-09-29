import "server-only";

import { adminDb } from "@/lib/db/admin";
import {
  getFaceitRoom,
  getFaceitRoomStats,
  getHistoryMatchIds,
  getHubMatchIds,
  getPlayerBySteamId,
} from "@/lib/external/faceit";
import {
  faceitCandidates,
  type FaceitCandidate,
  type FaceitRoom,
} from "./faceit-candidates";
import { faceitImportMap } from "./faceit-import";
import { mixVariantPage } from "./queries";

/** Find plausible rooms. The admin still confirms every import. */
export async function findMixFaceitCandidates(
  mixId: string,
  extraIds: string[] = [],
): Promise<FaceitCandidate[]> {
  const { data: mix, error: mixError } = await adminDb()
    .from("mixes")
    .select("id, group_id, status, locked_at, chosen_variant_id")
    .eq("id", mixId)
    .single();
  if (mixError) throw mixError;
  if (mix.status !== "locked" || !mix.locked_at || !mix.chosen_variant_id)
    throw new Error("Mix is not locked");
  const page = await mixVariantPage(mixId, false);
  const chosen = page?.variants.find(
    (variant) => variant.id === mix.chosen_variant_id,
  );
  if (!page || !chosen) throw new Error("Chosen lineup is missing");
  const [
    { data: group, error: groupError },
    { data: nextMix, error: nextError },
    { data: players, error: playerError },
  ] = await Promise.all([
    adminDb()
      .from("groups")
      .select("faceit_club_id")
      .eq("id", mix.group_id)
      .single(),
    adminDb()
      .from("mixes")
      .select("locked_at")
      .eq("group_id", mix.group_id)
      .gt("locked_at", mix.locked_at)
      .order("locked_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    adminDb()
      .from("players")
      .select("id, steam_id, faceit_player_id")
      .in(
        "id",
        page.participants.map((participant) => participant.playerId),
      ),
  ]);
  if (groupError) throw groupError;
  if (nextError) throw nextError;
  if (playerError) throw playerError;
  const from = new Date(mix.locked_at);
  const to = nextMix?.locked_at ? new Date(nextMix.locked_at) : new Date();
  let clubIds: string[] = [];
  if (group.faceit_club_id) {
    try {
      clubIds = await getHubMatchIds(group.faceit_club_id, from, to);
    } catch {
      /* Private or unavailable Club listing: use player histories. */
    }
  }
  let historyIds: string[] = [];
  if (!clubIds.length) {
    const faceitIds = await Promise.all(
      (players ?? []).map(
        async (player) =>
          player.faceit_player_id ??
          (await getPlayerBySteamId(player.steam_id))?.playerId ??
          null,
      ),
    );
    const histories = await Promise.all(
      faceitIds
        .filter((id): id is string => !!id)
        .map((id) => getHistoryMatchIds(id, from, to)),
    );
    historyIds = histories.flat();
  }
  const ids = [...new Set([...clubIds, ...historyIds, ...extraIds])];
  const rooms: FaceitRoom[] = [];
  for (const id of ids) {
    const room = await getFaceitRoom(id);
    rooms.push({
      id: room.match_id,
      startedAt: new Date(room.started_at * 1000).toISOString(),
      status: room.status,
      competitionId: room.competition_id ?? null,
      bestOf: room.best_of,
      faction1: room.teams.faction1.roster.flatMap((player) =>
        player.game_player_id ? [player.game_player_id] : [],
      ),
      faction2: room.teams.faction2.roster.flatMap((player) =>
        player.game_player_id ? [player.game_player_id] : [],
      ),
      map: null,
      score1: room.results?.score?.faction1 ?? null,
      score2: room.results?.score?.faction2 ?? null,
      roomUrl: `https://www.faceit.com/en/cs2/room/${encodeURIComponent(id)}`,
    });
  }
  const candidates = faceitCandidates(rooms, {
    lockedAt: mix.locked_at,
    nextLockedAt: nextMix?.locked_at,
    clubId: group.faceit_club_id,
    teamA: chosen.teamA.map((player) => player.steamId),
    teamB: chosen.teamB.map((player) => player.steamId),
  });
  for (const candidate of candidates) {
    const stats = await getFaceitRoomStats(candidate.id);
    const map = stats.rounds[0]?.round_stats.Map;
    candidate.map = typeof map === "string" ? map : null;
  }
  return candidates;
}

/** Re-fetch confirmed rooms and derive only our own players' per-map numbers. */
export async function faceitImportPlan(
  mixId: string,
  ids: string[],
  extraIds: string[] = [],
) {
  const candidates = await findMixFaceitCandidates(mixId, extraIds);
  const selected = ids.map((id) =>
    candidates.find((candidate) => candidate.id === id),
  );
  if (
    !ids.length ||
    new Set(ids).size !== ids.length ||
    selected.some(
      (candidate) => !candidate || candidate.teamAIsFaction1 === null,
    )
  )
    throw new Error(
      "Selected FACEIT rooms are missing or have ambiguous teams",
    );
  const page = await mixVariantPage(mixId, false);
  if (!page) throw new Error("Mix is missing");
  const playerIds = new Map(
    page.participants.map((player) => [player.steamId, player.playerId]),
  );
  const maps = [];
  for (const candidate of selected as FaceitCandidate[]) {
    const [room, response] = await Promise.all([
      getFaceitRoom(candidate.id),
      getFaceitRoomStats(candidate.id),
    ]);
    maps.push(faceitImportMap(candidate, room, response, playerIds));
  }
  return maps.sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
}
