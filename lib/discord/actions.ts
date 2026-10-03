"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNext } from "@/lib/auth/openid";
import { requireGroupRole, requireSession } from "@/lib/auth/server";
import { adminDb } from "@/lib/db/admin";
import { guildChannels, moveDiscordMember } from "./api";
import { parseDiscordSettings, type DiscordSettings } from "./connection";

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

export type DiscordMoveState =
  | { error: "forbidden" | "mix" | "channels" | "failed" }
  | {
      moved: string[];
      notConnected: string[];
      unlinked: string[];
      failed: string[];
    }
  | undefined;

/** An admin moves the currently chosen lineup, never a team list sent by the browser. */
export async function moveMixDiscordPlayers(
  mixId: string,
  _previous: DiscordMoveState,
  form: FormData,
): Promise<DiscordMoveState> {
  const target = form.get("target");
  if (
    !z.uuid().safeParse(mixId).success ||
    (target !== "teams" && target !== "lobby")
  )
    return { error: "mix" };

  const { data: mix, error: mixError } = await adminDb()
    .from("mixes")
    .select("group_id, status, chosen_variant_id")
    .eq("id", mixId)
    .maybeSingle();
  if (mixError || !mix) return { error: "mix" };
  try {
    await requireGroupRole(mix.group_id, "admin");
  } catch {
    return { error: "forbidden" };
  }
  if (
    !mix.chosen_variant_id ||
    (target === "teams" && mix.status !== "locked") ||
    (target === "lobby" && mix.status !== "locked" && mix.status !== "played")
  )
    return { error: "mix" };

  const { data: group, error: groupError } = await adminDb()
    .from("groups")
    .select("discord_guild_id, discord_settings")
    .eq("id", mix.group_id)
    .maybeSingle();
  if (groupError || !group?.discord_guild_id) return { error: "channels" };
  try {
    const channels = await guildChannels(group.discord_guild_id);
    const settings = group.discord_settings as Partial<DiscordSettings> | null;
    const lobby = settings?.lobby_channel_id;
    const teamA = settings?.team_a_channel_id;
    const teamB = settings?.team_b_channel_id;
    if (
      !lobby ||
      !teamA ||
      !teamB ||
      new Set([lobby, teamA, teamB]).size !== 3 ||
      [lobby, teamA, teamB].some(
        (id) =>
          !channels.some((channel) => channel.id === id && channel.type === 2),
      )
    )
      return { error: "channels" };

    const { data: lineup, error: lineupError } = await adminDb()
      .from("variant_players")
      .select(
        "team, player:players!variant_players_player_id_fkey(display_name, steam_id, discord_user_id)",
      )
      .eq("variant_id", mix.chosen_variant_id)
      .returns<
        {
          team: "A" | "B";
          player: {
            display_name: string | null;
            steam_id: string;
            discord_user_id: string | null;
          };
        }[]
      >();
    if (
      lineupError ||
      !lineup ||
      lineup.length !== 10 ||
      lineup.filter((entry) => entry.team === "A").length !== 5 ||
      lineup.filter((entry) => entry.team === "B").length !== 5
    )
      return { error: "mix" };

    const result = {
      moved: [] as string[],
      notConnected: [] as string[],
      unlinked: [] as string[],
      failed: [] as string[],
    };
    for (const { team, player } of lineup) {
      const name = player.display_name ?? player.steam_id;
      if (!player.discord_user_id) {
        result.unlinked.push(name);
        continue;
      }
      try {
        const channel =
          target === "lobby" ? lobby : team === "A" ? teamA : teamB;
        const outcome = await moveDiscordMember(
          group.discord_guild_id,
          player.discord_user_id,
          channel,
        );
        result[outcome === "moved" ? "moved" : "notConnected"].push(name);
      } catch (error) {
        console.error("Discord voice move failed", error);
        result.failed.push(name);
      }
    }
    return result;
  } catch (error) {
    console.error("Discord voice setup failed", error);
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
