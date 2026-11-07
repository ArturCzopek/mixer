import { NextResponse, type NextRequest } from "next/server";
import { getSession, revokeSessions, sessionCookie } from "@/lib/auth/server";

/**
 * POST only, so a link or an image on another site cannot log you out. Logging out revokes the
 * player's sessions on every device: the cookie is a stateless JWT, so clearing it here alone would
 * leave a copied token valid until it expires.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (session) await revokeSessions(session);
  } catch (error) {
    console.error("Session revocation failed", error);
  }
  const res = NextResponse.redirect(new URL("/", request.nextUrl.origin), 303);
  res.cookies.set(sessionCookie.name, "", {
    ...sessionCookie.options,
    maxAge: 0,
  });
  return res;
}
