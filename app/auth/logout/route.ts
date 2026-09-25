import { NextResponse, type NextRequest } from "next/server";
import { sessionCookie } from "@/lib/auth/server";

/** POST only, so a link or an image on another site cannot log you out. */
export function POST(request: NextRequest) {
  const res = NextResponse.redirect(new URL("/", request.nextUrl.origin), 303);
  res.cookies.set(sessionCookie.name, "", {
    ...sessionCookie.options,
    maxAge: 0,
  });
  return res;
}
