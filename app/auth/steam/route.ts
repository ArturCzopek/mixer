import { NextResponse, type NextRequest } from "next/server";
import { safeNext, steamLoginUrl } from "@/lib/auth/openid";

/** Starts the Steam login: redirect to Steam, which comes back to /auth/steam/callback. */
export function GET(request: NextRequest) {
  const origin = process.env.APP_URL || request.nextUrl.origin;
  const callback = new URL("/auth/steam/callback", origin);
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  if (next !== "/") callback.searchParams.set("next", next);
  return NextResponse.redirect(steamLoginUrl(callback.toString()));
}
