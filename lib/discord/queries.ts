import "server-only";

import { adminDb } from "@/lib/db/admin";
import { botGuild, guildChannels } from "./api";
import type { DiscordSettings } from "./connection";

export async function groupDiscordConfig(groupId: string) {
  const { data, error } = await adminDb()
    .from("groups")
    .select("discord_guild_id, discord_settings")
    .eq("id", groupId)
    .single();
  if (error) throw new Error(`groupDiscordConfig: ${error.message}`);
  if (!data.discord_guild_id)
    return {
      guild: null,
      channels: [],
      settings: {} as Partial<DiscordSettings>,
      available: true,
    };
  try {
    const [guild, channels] = await Promise.all([
      botGuild(data.discord_guild_id),
      guildChannels(data.discord_guild_id),
    ]);
    return {
      guild,
      channels,
      settings: data.discord_settings as Partial<DiscordSettings>,
      available: true,
    };
  } catch {
    return {
      guild: { id: data.discord_guild_id, name: "Discord" },
      channels: [],
      settings: data.discord_settings as Partial<DiscordSettings>,
      available: false,
    };
  }
}
