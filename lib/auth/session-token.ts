// Session cookie content: a short HS256 JWT (jose) holding only who is logged in. Roles are never
// stored here; they are read from the database on every request (D18).

import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "mixer_session";
export const SESSION_DAYS = 30;

export interface SessionClaims {
  /** players.id */
  playerId: string;
  steamId: string;
}

const key = (secret: string) => {
  if (secret.length < 32)
    throw new Error("SESSION_SECRET must be at least 32 characters");
  return new TextEncoder().encode(secret);
};

export async function signSession(
  claims: SessionClaims,
  secret: string,
  now = new Date(),
): Promise<string> {
  const iat = Math.floor(now.getTime() / 1000);
  return new SignJWT({ steamId: claims.steamId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.playerId)
    .setIssuedAt(iat)
    .setExpirationTime(iat + SESSION_DAYS * 86_400)
    .sign(key(secret));
}

/** Claims of a valid, unexpired token; null for anything else (never throws). */
export async function readSession(
  token: string | undefined,
  secret: string,
  now = new Date(),
): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      algorithms: ["HS256"],
      currentDate: now,
    });
    if (typeof payload.sub !== "string" || typeof payload.steamId !== "string")
      return null;
    return { playerId: payload.sub, steamId: payload.steamId };
  } catch {
    return null;
  }
}
