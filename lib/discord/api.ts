import "server-only";

import { z } from "zod";
import { requireEnv } from "@/lib/env";
import type { DiscordChannel } from "./connection";

const API = "https://discord.com/api/v10";
const snowflake = z.string().regex(/^\d{17,20}$/);
const guild = z.object({ id: snowflake, name: z.string() });
const userGuild = z.object({
  id: snowflake,
  owner: z.boolean(),
  permissions: z.string(),
});
const channel = z.object({
  id: snowflake,
  name: z.string(),
  type: z.number(),
  position: z.number(),
});

async function discordJson(path: string, token: string, bot = false) {
  const response = await fetch(`${API}${path}`, {
    headers: { Authorization: `${bot ? "Bot" : "Bearer"} ${token}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Discord API ${response.status}`);
  return response.json();
}

export async function exchangeDiscordCode(code: string, callback: string) {
  const response = await fetch(`${API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireEnv("DISCORD_CLIENT_ID"),
      client_secret: requireEnv("DISCORD_CLIENT_SECRET"),
      grant_type: "authorization_code",
      code,
      redirect_uri: callback,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Discord OAuth ${response.status}`);
  return z.object({ access_token: z.string() }).parse(await response.json())
    .access_token;
}

export async function currentUserGuilds(token: string) {
  return z
    .array(userGuild)
    .parse(await discordJson("/users/@me/guilds", token));
}

export async function botGuild(guildId: string) {
  return guild.parse(
    await discordJson(
      `/guilds/${guildId}`,
      requireEnv("DISCORD_BOT_TOKEN"),
      true,
    ),
  );
}

export async function guildChannels(
  guildId: string,
): Promise<DiscordChannel[]> {
  return z
    .array(channel)
    .parse(
      await discordJson(
        `/guilds/${guildId}/channels`,
        requireEnv("DISCORD_BOT_TOKEN"),
        true,
      ),
    )
    .filter((item) => item.type === 0 || item.type === 2)
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
}
