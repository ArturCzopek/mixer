import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth/openid";
import { requireSession } from "@/lib/auth/server";
import {
  DISCORD_PLAYER_COOKIE,
  discordPlayerAuthorizeUrl,
} from "@/lib/discord/connection";
import { requireEnv } from "@/lib/env";

/** A signed-in Steam player starts linking their own Discord account. */
export async function GET(request: NextRequest) {
  let playerId: string;
  try {
    playerId = (await requireSession()).playerId;
  } catch {
    return new Response("Sign in with Steam first", { status: 401 });
  }
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET)
    return new Response("Discord is not configured", { status: 503 });

  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const callback = new URL(
    "/auth/discord/player/callback",
    process.env.APP_URL || request.nextUrl.origin,
  ).toString();
  const state = crypto.randomUUID();
  const response = NextResponse.redirect(
    discordPlayerAuthorizeUrl(requireEnv("DISCORD_CLIENT_ID"), callback, state),
  );
  response.cookies.set(
    DISCORD_PLAYER_COOKIE,
    JSON.stringify({ nonce: state, playerId, next }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/auth/discord/player",
      maxAge: 600,
    },
  );
  return response;
}
