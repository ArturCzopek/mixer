"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuthError } from "@/lib/auth/roles";
import { requireGroupRole, requireSession } from "@/lib/auth/server";
import { mixerRating2 } from "@/lib/balance/faceit-rating";
import { adminDb } from "@/lib/db/admin";
import { buildDemoStoredData, validateDemoImportPayload } from "./payload";

type Result = { ok: true } | { error: string };
const uuid = z.uuid();

/** Attach one browser-parsed replay to its already recorded map. The binary never leaves the browser. */
export async function attachDemoToMatch(
  matchId: string,
  input: unknown,
): Promise<Result> {
  try {
    return await attachDemoToMatchInternal(matchId, input);
  } catch (error) {
    console.error("Demo attach failed", error);
    return { error: "failed" };
  }
}

async function attachDemoToMatchInternal(
  matchId: string,
  input: unknown,
): Promise<Result> {
  let actor;
  try {
    actor = await requireSession();
  } catch (error) {
    return { error: error instanceof AuthError ? "unauthorized" : "failed" };
  }
  if (!uuid.safeParse(matchId).success) return { error: "invalid" };
  let payload;
  try {
    payload = validateDemoImportPayload(input);
  } catch {
    return { error: "invalid" };
  }
  const db = adminDb();
  const { data: match, error: matchError } = await db
    .from("matches")
    .select("id, mix_id")
    .eq("id", matchId)
    .maybeSingle();
  if (matchError) return { error: "failed" };
  if (!match?.mix_id) return { error: "invalid" };
  const { data: mix, error: mixError } = await db
    .from("mixes")
    .select("id, group_id, status, chosen_variant_id")
    .eq("id", match.mix_id)
    .maybeSingle();
  if (mixError) return { error: "failed" };
  if (!mix || mix.status !== "played") return { error: "invalid" };
  try {
    await requireGroupRole(mix.group_id, "member");
  } catch (error) {
    return { error: error instanceof AuthError ? "forbidden" : "failed" };
  }

  const { data: existing, error: existingError } = await db
    .from("match_player_stats")
    .select("player_id, team")
    .eq("match_id", matchId);
  if (existingError) return { error: "failed" };
  if (existing?.length && existing.length !== 10) return { error: "roster" };
  let lineup = existing;
  if (lineup?.length !== 10 && mix.chosen_variant_id) {
    const fallback = await db
      .from("variant_players")
      .select("player_id, team")
      .eq("variant_id", mix.chosen_variant_id);
    if (fallback.error) return { error: "failed" };
    lineup = fallback.data;
  }
  if (!lineup || lineup.length !== 10) return { error: "roster" };
  const { data: identities, error: identitiesError } = await db
    .from("players")
    .select("id, steam_id")
    .in(
      "id",
      lineup.map((p) => p.player_id),
    );
  if (identitiesError || !identities || identities.length !== 10)
    return { error: "roster" };
  const byId = new Map(identities.map((p) => [p.id, p.steam_id]));
  const bySteam = new Map(payload.players.map((p) => [p.steamid, p.teamId]));
  const teamIds = new Map<"A" | "B", string>();
  for (const slot of lineup) {
    const steam = byId.get(slot.player_id);
    const demoTeam = steam && bySteam.get(steam);
    if (!steam || !demoTeam || (slot.team !== "A" && slot.team !== "B"))
      return { error: "roster" };
    const team = slot.team as "A" | "B";
    if (teamIds.has(team) && teamIds.get(team) !== demoTeam)
      return { error: "roster" };
    teamIds.set(team, demoTeam);
  }
  if (teamIds.size !== 2 || teamIds.get("A") === teamIds.get("B"))
    return { error: "roster" };

  let stored;
  try {
    stored = buildDemoStoredData(payload);
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message.includes("controller")
          ? "controller"
          : "invalid",
    };
  }

  const scoreA = payload.rounds.filter(
    (round) => round.winnerTeamId === teamIds.get("A"),
  ).length;
  const scoreB = payload.rounds.length - scoreA;
  const idBySteam = new Map(identities.map((p) => [p.steam_id, p.id]));
  const rows = stored.stats.map((stat) => ({
    playerId: idBySteam.get(stat.steamid),
    steamid: stat.steamid,
    team: stat.teamId === teamIds.get("A") ? "A" : "B",
    kills: stat.kills,
    deaths: stat.deaths,
    assists: stat.assists,
    damage: stat.enemyDamage,
    rounds: stat.roundsPlayed,
    adr: stat.adr,
    rating: mixerRating2({
      kills: stat.kills,
      deaths: stat.deaths,
      assists: stat.assists,
      rounds: stat.roundsPlayed,
      adr: stat.adr,
      kastPct: stat.kastPercent,
    }),
    headshots: stat.headshotKills,
    kastRounds: stat.kastRounds,
    openingKills: stat.openingKills,
    openingDeaths: stat.openingDeaths,
    tradeKills: stat.tradeKills,
    tradedDeaths: stat.tradedDeaths,
    multi2: stat.multikills[2],
    multi3: stat.multikills[3],
    multi4: stat.multikills[4],
    multi5: stat.multikills[5],
    clutchAttempts: Object.values(stat.clutchAttempts).reduce(
      (a, b) => a + b,
      0,
    ),
    clutchWins: Object.values(stat.clutchWins).reduce((a, b) => a + b, 0),
    utilityDamage: stat.utilityDamage,
    enemiesFlashed: stat.enemiesFlashed,
    flashAssists: stat.flashAssists,
    raw: stat,
  }));
  const { error } = await db.rpc("attach_demo_to_match", {
    p_match_id: matchId,
    p_actor_id: actor.playerId,
    p_demo_hash: payload.demoHash,
    p_map_name: payload.mapName,
    p_score_a: scoreA,
    p_score_b: scoreB,
    p_rows: rows,
    p_payload: { ...stored, evidence: payload },
  });
  if (error) {
    if (["23505", "23514", "55000", "42501"].includes(error.code))
      return { error: error.code === "42501" ? "forbidden" : "mismatch" };
    console.error("Demo attach failed", error);
    return { error: "failed" };
  }
  revalidatePath("/g/[slug]/m/[mixId]", "page");
  revalidatePath("/g/[slug]", "page");
  revalidatePath("/g/[slug]/stats", "page");
  revalidatePath("/g/[slug]/p/[steamId]", "page");
  revalidatePath("/g/[slug]/compare", "page");
  return { ok: true };
}
