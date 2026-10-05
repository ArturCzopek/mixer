import "server-only";

import { adminDb } from "@/lib/db/admin";
import { guildChannels, moveDiscordMember } from "./api";
import type { DiscordSettings } from "./connection";

export type DiscordMoveState =
  | { error: "forbidden" | "mix" | "channels" | "failed" }
  | {
      moved: string[];
      notConnected: string[];
      unlinked: string[];
      failed: string[];
    }
  | undefined;

/** Moves a mix's chosen 5v5 lineup to the team channels or back to the lobby. Callers authorize. */
export async function moveMixLineup(
  groupId: string,
  variantId: string,
  target: "teams" | "lobby",
): Promise<DiscordMoveState> {
  const { data: group, error: groupError } = await adminDb()
    .from("groups")
    .select("discord_guild_id, discord_settings")
    .eq("id", groupId)
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
      .eq("variant_id", variantId)
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
