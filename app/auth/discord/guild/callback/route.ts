import { NextResponse, type NextRequest } from "next/server";
import { requireGroupRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/db/admin";
import {
  botGuild,
  currentUserGuilds,
  exchangeDiscordCode,
} from "@/lib/discord/api";
import {
  canManageDiscordGuild,
  DISCORD_GUILD_COOKIE,
  readGuildState,
} from "@/lib/discord/connection";

/** Connect only a server that this admin manages and where our bot is installed. */
export async function GET(request: NextRequest) {
  const origin = process.env.APP_URL || request.nextUrl.origin;
  const state = readGuildState(
    request.cookies.get(DISCORD_GUILD_COOKIE)?.value,
    request.nextUrl.searchParams.get("state"),
  );
  let destination = "/g?discord=failed";
  if (state) {
    const { data } = await adminDb()
      .from("groups")
      .select("slug, discord_guild_id, discord_settings")
      .eq("id", state.groupId)
      .maybeSingle();
    if (data) {
      const path = `/g/${data.slug}`;
      destination = `${path}?discord=failed`;
      try {
        const admin = await requireGroupRole(state.groupId, "admin");
        const code = request.nextUrl.searchParams.get("code");
        const guildId = request.nextUrl.searchParams.get("guild_id");
        if (
          admin.playerId === state.playerId &&
          code &&
          guildId &&
          /^\d{17,20}$/.test(guildId)
        ) {
          const callback = new URL(
            "/auth/discord/guild/callback",
            origin,
          ).toString();
          const token = await exchangeDiscordCode(code, callback);
          const guilds = await currentUserGuilds(token);
          if (canManageDiscordGuild(guilds, guildId)) {
            await botGuild(guildId);
            const { error } = await adminDb()
              .from("groups")
              .update({
                discord_guild_id: guildId,
                discord_settings:
                  data.discord_guild_id === guildId
                    ? data.discord_settings
                    : {},
              })
              .eq("id", state.groupId);
            destination = error
              ? `${path}?discord=${error.code === "23505" ? "taken" : "failed"}`
              : `${path}?discord=connected`;
          } else {
            destination = `${path}?discord=forbidden`;
          }
        }
      } catch (error) {
        console.error("Discord server connection failed", error);
      }
    }
  }
  const response = NextResponse.redirect(new URL(destination, origin));
  response.cookies.set(DISCORD_GUILD_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/auth/discord/guild",
    maxAge: 0,
  });
  return response;
}
