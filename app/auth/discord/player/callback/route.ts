import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { adminDb } from "@/lib/db/admin";
import { currentDiscordUser, exchangeDiscordCode } from "@/lib/discord/api";
import {
  DISCORD_PLAYER_COOKIE,
  readPlayerState,
} from "@/lib/discord/connection";

/** Store only Discord's verified user ID on the player from the matching Steam session. */
export async function GET(request: NextRequest) {
  const origin = process.env.APP_URL || request.nextUrl.origin;
  const state = readPlayerState(
    request.cookies.get(DISCORD_PLAYER_COOKIE)?.value,
    request.nextUrl.searchParams.get("state"),
  );
  const destination = new URL(state?.next ?? "/g", origin);
  let result = "failed";
  if (state) {
    try {
      const session = await requireSession();
      const code = request.nextUrl.searchParams.get("code");
      if (session.playerId === state.playerId && code) {
        const callback = new URL(
          "/auth/discord/player/callback",
          origin,
        ).toString();
        const token = await exchangeDiscordCode(code, callback);
        const user = await currentDiscordUser(token);
        const { data, error } = await adminDb()
          .from("players")
          .update({ discord_user_id: user.id })
          .eq("id", state.playerId)
          .select("id")
          .maybeSingle();
        result =
          error?.code === "23505"
            ? "alreadyUsed"
            : error || !data
              ? "failed"
              : "linked";
      }
    } catch (error) {
      console.error("Discord player link failed", error);
    }
  }
  destination.searchParams.set("discordAccount", result);
  const response = NextResponse.redirect(destination);
  response.cookies.set(DISCORD_PLAYER_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/auth/discord/player",
    maxAge: 0,
  });
  return response;
}
