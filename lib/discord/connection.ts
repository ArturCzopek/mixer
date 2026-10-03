import { z } from "zod";

export const DISCORD_GUILD_COOKIE = "mixer_discord_guild";
export const DISCORD_PLAYER_COOKIE = "mixer_discord_player";

// View Channel, Send Messages, Connect, Move Members.
export const BOT_PERMISSIONS = String(
  (1 << 10) | (1 << 11) | (1 << 20) | (1 << 24),
);

export interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  position: number;
}

export interface DiscordSettings {
  lobby_channel_id: string;
  team_a_channel_id: string;
  team_b_channel_id: string;
  notification_channel_id: string;
}

const guildState = z.object({
  nonce: z.uuid(),
  groupId: z.uuid(),
  playerId: z.uuid(),
});

const playerState = z.object({
  nonce: z.uuid(),
  playerId: z.uuid(),
  next: z.string().regex(/^\/(?!\/)[^\\]*$/),
});

export function readGuildState(
  cookie: string | undefined,
  state: string | null,
) {
  if (!cookie || !state) return null;
  try {
    const value = guildState.parse(JSON.parse(cookie));
    return value.nonce === state ? value : null;
  } catch {
    return null;
  }
}

export function readPlayerState(
  cookie: string | undefined,
  state: string | null,
) {
  if (!cookie || !state) return null;
  try {
    const value = playerState.parse(JSON.parse(cookie));
    return value.nonce === state ? value : null;
  } catch {
    return null;
  }
}

export function discordAuthorizeUrl(
  clientId: string,
  callback: string,
  state: string,
): string {
  const url = new URL("https://discord.com/oauth2/authorize");
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: "bot guilds",
    permissions: BOT_PERMISSIONS,
    redirect_uri: callback,
    state,
  }).toString();
  return url.toString();
}

export function discordPlayerAuthorizeUrl(
  clientId: string,
  callback: string,
  state: string,
): string {
  const url = new URL("https://discord.com/oauth2/authorize");
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: "identify",
    redirect_uri: callback,
    state,
  }).toString();
  return url.toString();
}

export function canManageDiscordGuild(
  guilds: { id: string; owner: boolean; permissions: string }[],
  guildId: string,
): boolean {
  const guild = guilds.find((item) => item.id === guildId);
  return (
    !!guild &&
    (guild.owner || (BigInt(guild.permissions) & BigInt(8 | 32)) !== BigInt(0))
  );
}

export function parseDiscordSettings(
  form: FormData,
  channels: DiscordChannel[],
): DiscordSettings | null {
  const ids = {
    lobby_channel_id: form.get("lobby"),
    team_a_channel_id: form.get("teamA"),
    team_b_channel_id: form.get("teamB"),
    notification_channel_id: form.get("notification"),
  };
  const voiceIds = [
    ids.lobby_channel_id,
    ids.team_a_channel_id,
    ids.team_b_channel_id,
  ];
  if (
    voiceIds.some(
      (id) =>
        typeof id !== "string" ||
        !channels.some((channel) => channel.id === id && channel.type === 2),
    ) ||
    new Set(voiceIds).size !== 3 ||
    typeof ids.notification_channel_id !== "string" ||
    !channels.some(
      (channel) =>
        channel.id === ids.notification_channel_id && channel.type === 0,
    )
  )
    return null;
  return ids as DiscordSettings;
}
