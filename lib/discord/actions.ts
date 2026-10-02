"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNext } from "@/lib/auth/openid";
import { requireGroupRole, requireSession } from "@/lib/auth/server";
import { adminDb } from "@/lib/db/admin";
import { guildChannels } from "./api";
import { parseDiscordSettings } from "./connection";

export type DiscordActionState =
  | { error: "forbidden" | "channels" | "disconnected" | "failed" }
  | { ok: true }
  | undefined;

export async function saveDiscordChannels(
  groupId: string,
  _previous: DiscordActionState,
  form: FormData,
): Promise<DiscordActionState> {
  if (!z.uuid().safeParse(groupId).success) return { error: "forbidden" };
  try {
    await requireGroupRole(groupId, "admin");
  } catch {
    return { error: "forbidden" };
  }
  const { data: group, error: readError } = await adminDb()
    .from("groups")
    .select("slug, discord_guild_id")
    .eq("id", groupId)
    .maybeSingle();
  if (readError || !group) return { error: "failed" };
  if (!group.discord_guild_id) return { error: "disconnected" };
  try {
    const channels = await guildChannels(group.discord_guild_id);
    const settings = parseDiscordSettings(form, channels);
    if (!settings) return { error: "channels" };
    const { data, error } = await adminDb()
      .from("groups")
      .update({ discord_settings: settings })
      .eq("id", groupId)
      .eq("discord_guild_id", group.discord_guild_id)
      .select("id")
      .maybeSingle();
    if (error || !data) return { error: "failed" };
    revalidatePath(`/g/${group.slug}`);
    return { ok: true };
  } catch (error) {
    console.error("Saving Discord channels failed", error);
    return { error: "failed" };
  }
}

/** A player may unlink only their own Discord account. */
export async function unlinkDiscordAccount(nextPath: string) {
  const player = await requireSession();
  const next = safeNext(nextPath);
  const { error } = await adminDb()
    .from("players")
    .update({ discord_user_id: null })
    .eq("id", player.playerId);
  const destination = new URL(next, "https://mixer.local");
  destination.searchParams.set("discordAccount", error ? "failed" : "unlinked");
  if (!error) revalidatePath(destination.pathname);
  redirect(destination.pathname + destination.search + destination.hash);
}
