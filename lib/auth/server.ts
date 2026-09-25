import "server-only";

// Session and role checks for server components, server actions and route handlers.
// The cookie only says who you are; admin flags and group roles are read from the DB per request.

import { cache } from "react";
import { cookies } from "next/headers";
import { adminDb } from "@/lib/db/admin";
import { requireEnv } from "@/lib/env";
import { getPlayerSummaries } from "@/lib/external/steam";
import {
  AuthError,
  hasGroupRole,
  parseAdminIds,
  type GroupRole,
} from "./roles";
import {
  readSession,
  SESSION_COOKIE,
  SESSION_DAYS,
  signSession,
} from "./session-token";

export interface Session {
  playerId: string;
  steamId: string;
  displayName: string | null;
  avatarUrl: string | null;
  isSiteAdmin: boolean;
}

/** The logged-in player, or null. Memoised per request. */
export const getSession = cache(async (): Promise<Session | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const claims = await readSession(token, requireEnv("SESSION_SECRET"));
  if (!claims) return null;
  const { data } = await adminDb()
    .from("players")
    .select("id, steam_id, display_name, avatar_url, is_site_admin")
    .eq("id", claims.playerId)
    .maybeSingle();
  if (!data || data.steam_id !== claims.steamId) return null;
  return {
    playerId: data.id,
    steamId: data.steam_id,
    displayName: data.display_name,
    avatarUrl: data.avatar_url,
    isSiteAdmin: data.is_site_admin,
  };
});

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new AuthError(401, "Log in with Steam first");
  return s;
}

export async function requireSiteAdmin(): Promise<Session> {
  const s = await requireSession();
  if (!s.isSiteAdmin) throw new AuthError(403, "Site admins only");
  return s;
}

/** Throws unless the player is an active member (or admin) of the group; site admins always pass. */
export async function requireGroupRole(
  groupId: string,
  role: GroupRole,
): Promise<Session> {
  const s = await requireSession();
  if (s.isSiteAdmin) return s;
  const { data } = await adminDb()
    .from("group_members")
    .select("role, left_at")
    .eq("group_id", groupId)
    .eq("player_id", s.playerId)
    .maybeSingle();
  const membership = data ? { role: data.role, leftAt: data.left_at } : null;
  if (!hasGroupRole(membership, role, false))
    throw new AuthError(403, `Group ${role}s only`);
  return s;
}

/**
 * After a verified Steam login: create the player or claim the record a group admin added earlier
 * (same SteamID64, no duplicate), refresh name/avatar, bootstrap `ADMIN_STEAM_IDS` as site admins.
 * Returns the signed session token for the cookie.
 */
export async function logIn(steamId: string): Promise<string> {
  const profile = await getPlayerSummaries([steamId])
    .then((p) => p[0])
    .catch(() => undefined); // login must not fail because the Steam Web API is down
  const bootstrapAdmin = parseAdminIds(process.env.ADMIN_STEAM_IDS).has(
    steamId,
  );
  const { data, error } = await adminDb()
    .from("players")
    .upsert(
      {
        steam_id: steamId,
        ...(profile && {
          display_name: profile.name,
          avatar_url: profile.avatarUrl,
        }),
        last_login_at: new Date().toISOString(),
        ...(bootstrapAdmin && { is_site_admin: true }),
      },
      { onConflict: "steam_id" },
    )
    .select("id")
    .single();
  if (error || !data)
    throw new Error(`Could not save player: ${error?.message}`);
  return signSession(
    { playerId: data.id, steamId },
    requireEnv("SESSION_SECRET"),
  );
}

export const sessionCookie = {
  name: SESSION_COOKIE,
  options: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  },
};
