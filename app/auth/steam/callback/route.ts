import { NextResponse, type NextRequest } from "next/server";
import { OpenIdError, safeNext, verifySteamAssertion } from "@/lib/auth/openid";
import { logIn, sessionCookie } from "@/lib/auth/server";

/** Steam sends the browser back here with a signed assertion. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  // Behind a proxy the request URL may carry an internal origin; Steam signed the public one.
  if (process.env.APP_URL) {
    const pub = new URL(process.env.APP_URL);
    url.protocol = pub.protocol;
    url.host = pub.host;
  }
  const next = safeNext(url.searchParams.get("next"));
  try {
    const steamId = await verifySteamAssertion(url.toString());
    const token = await logIn(steamId);
    const res = NextResponse.redirect(new URL(next, url.origin));
    res.cookies.set(sessionCookie.name, token, sessionCookie.options);
    return res;
  } catch (e) {
    if (!(e instanceof OpenIdError)) console.error("Steam login failed", e);
    return NextResponse.redirect(new URL("/?login=failed", url.origin));
  }
}
