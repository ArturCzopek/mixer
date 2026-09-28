"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuthError } from "@/lib/auth/roles";
import { requireGroupRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/db/admin";
import { getPlayerBySteamId } from "@/lib/external/faceit";
import { getPlayerSummaries, resolveSteamInput } from "@/lib/external/steam";

export type RosterState =
  | {
      error:
        | "steam"
        | "notFound"
        | "steamUnavailable"
        | "closed"
        | "elo"
        | "unauthorized"
        | "forbidden"
        | "failed";
    }
  | { ok: true; faceitUnavailable?: boolean }
  | undefined;

function authError(error: unknown): RosterState {
  if (error instanceof AuthError)
    return { error: error.status === 401 ? "unauthorized" : "forbidden" };
  throw error;
}

/** Add a membership; Steam identity and profile are shared across groups (D18). */
export async function addRosterPlayer(
  groupId: string,
  _prev: RosterState,
  form: FormData,
): Promise<RosterState> {
  if (!z.uuid().safeParse(groupId).success) return { error: "forbidden" };
  let actorId: string;
  try {
    actorId = (await requireGroupRole(groupId, "admin")).playerId;
  } catch (error) {
    return authError(error);
  }
  const input = form.get("steam");
  if (typeof input !== "string" || !input.trim() || input.length > 256)
    return { error: "steam" };

  let profile;
  try {
    const steamId = await resolveSteamInput(input);
    if (!steamId) return { error: "steam" };
    profile = (await getPlayerSummaries([steamId]))[0];
    if (!profile) return { error: "notFound" };
  } catch {
    return { error: "steamUnavailable" };
  }

  // FACEIT is optional (D21). An outage must not erase a previously linked account.
  let faceitUnavailable = false;
  const faceit = await getPlayerBySteamId(profile.steamId).catch(() => {
    faceitUnavailable = true;
    return null;
  });
  const db = adminDb();
  const { data: player, error: playerError } = await db
    .from("players")
    .upsert(
      {
        steam_id: profile.steamId,
        display_name: profile.name,
        avatar_url: profile.avatarUrl,
        ...(faceit && {
          faceit_player_id: faceit.playerId,
          faceit_nickname: faceit.nickname,
        }),
      },
      { onConflict: "steam_id" },
    )
    .select("id")
    .single();
  if (playerError || !player) return { error: "failed" };

  // Ignore an existing membership so re-adding an active admin never demotes them or resets ELO.
  const { error: insertError } = await db.from("group_members").upsert(
    {
      group_id: groupId,
      player_id: player.id,
      added_by: actorId,
    },
    { onConflict: "group_id,player_id", ignoreDuplicates: true },
  );
  if (insertError) return { error: "failed" };
  // Reopening closed memberships is not defined by M1-3; never silently restore old admin rights.
  const { data: membership, error: memberError } = await db
    .from("group_members")
    .select("left_at")
    .eq("group_id", groupId)
    .eq("player_id", player.id)
    .single();
  if (memberError || !membership) return { error: "failed" };
  if (membership.left_at !== null) return { error: "closed" };
  revalidatePath("/", "layout");
  return { ok: true, faceitUnavailable };
}

/** Per-group fallback only; FACEIT ELO still takes precedence in the existing engine. */
export async function updateRosterElo(
  groupId: string,
  playerId: string,
  _prev: RosterState,
  form: FormData,
): Promise<RosterState> {
  if (
    !z.uuid().safeParse(groupId).success ||
    !z.uuid().safeParse(playerId).success
  )
    return { error: "forbidden" };
  try {
    await requireGroupRole(groupId, "admin");
  } catch (error) {
    return authError(error);
  }
  const raw = form.get("elo");
  if (typeof raw !== "string") return { error: "elo" };
  const value = raw.trim() === "" ? null : Number(raw);
  if (
    value !== null &&
    (!/^\d+$/.test(raw.trim()) ||
      !Number.isInteger(value) ||
      value < 600 ||
      value > 2500)
  )
    return { error: "elo" };
  const { data, error } = await adminDb()
    .from("group_members")
    .update({ manual_skill_override: value })
    .eq("group_id", groupId)
    .eq("player_id", playerId)
    .is("left_at", null)
    .select("player_id")
    .maybeSingle();
  if (error || !data) return { error: "failed" };
  revalidatePath("/", "layout");
  return { ok: true };
}
