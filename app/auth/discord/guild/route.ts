import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireGroupRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/db/admin";
import { requireEnv } from "@/lib/env";
import {
  DISCORD_GUILD_COOKIE,
  discordAuthorizeUrl,
} from "@/lib/discord/connection";

/** A group admin authorizes the bot and their Discord server access in one flow. */
export async function GET(request: NextRequest) {
  const groupId = request.nextUrl.searchParams.get("group");
  if (!z.uuid().safeParse(groupId).success)
    return new Response("Invalid group", { status: 400 });
  let playerId: string;
  try {
    playerId = (await requireGroupRole(groupId!, "admin")).playerId;
  } catch {
    return new Response("Forbidden", { status: 403 });
  }
  const { data: group, error } = await adminDb()
    .from("groups")
    .select("id")
    .eq("id", groupId!)
    .maybeSingle();
  if (error || !group) return new Response("Group not found", { status: 404 });
  if (
    !process.env.DISCORD_CLIENT_ID ||
    !process.env.DISCORD_CLIENT_SECRET ||
    !process.env.DISCORD_BOT_TOKEN
  )
    return new Response("Discord is not configured", { status: 503 });

  const callback = new URL(
    "/auth/discord/guild/callback",
    process.env.APP_URL || request.nextUrl.origin,
  ).toString();
  const state = crypto.randomUUID();
  const response = NextResponse.redirect(
    discordAuthorizeUrl(requireEnv("DISCORD_CLIENT_ID"), callback, state),
  );
  response.cookies.set(
    DISCORD_GUILD_COOKIE,
    JSON.stringify({ nonce: state, groupId, playerId }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/auth/discord/guild",
      maxAge: 600,
    },
  );
  return response;
}
