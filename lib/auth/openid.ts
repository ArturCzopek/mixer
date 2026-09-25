// Steam login: OpenID 2.0 (Steam has no OAuth for third parties, D2). Pure apart from the injected
// fetch, so the verifier is unit-tested against forged and malformed assertions.

import type { FetchLike } from "@/lib/external/http";

export const STEAM_OPENID = "https://steamcommunity.com/openid/login";
const NS = "http://specs.openid.net/auth/2.0";
const IDENTIFIER_SELECT = "http://specs.openid.net/auth/2.0/identifier_select";
const CLAIMED_ID = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;
const REQUIRED_SIGNED = [
  "op_endpoint",
  "claimed_id",
  "identity",
  "return_to",
  "response_nonce",
  "assoc_handle",
];
/** How old a response nonce may be (replays after this are rejected even if Steam would accept). */
const NONCE_MAX_AGE_MS = 5 * 60 * 1000;

/** Where to send the browser to log in; Steam comes back to `returnTo`. */
export function steamLoginUrl(returnTo: string): string {
  const realm = new URL(returnTo).origin;
  const params = new URLSearchParams({
    "openid.ns": NS,
    "openid.mode": "checkid_setup",
    "openid.return_to": returnTo,
    "openid.realm": realm,
    "openid.identity": IDENTIFIER_SELECT,
    "openid.claimed_id": IDENTIFIER_SELECT,
  });
  return `${STEAM_OPENID}?${params}`;
}

export class OpenIdError extends Error {
  constructor(message: string) {
    super(`Steam login rejected: ${message}`);
    this.name = "OpenIdError";
  }
}

/**
 * Verifies Steam's positive assertion (the query of the callback request) and returns the SteamID64.
 * Local checks first (mode, endpoint, return URL, claimed id, signed fields, nonce age), then Steam
 * itself confirms the signature with `check_authentication`. Throws `OpenIdError` otherwise.
 */
export async function verifySteamAssertion(
  callbackUrl: string,
  opts: { fetch?: FetchLike; now?: Date } = {},
): Promise<string> {
  const url = new URL(callbackUrl);
  const q = url.searchParams;
  const get = (k: string) => q.get(`openid.${k}`);

  if (get("ns") !== NS) throw new OpenIdError("wrong namespace");
  if (get("mode") !== "id_res") throw new OpenIdError(`mode ${get("mode")}`);
  if (get("op_endpoint") !== STEAM_OPENID)
    throw new OpenIdError("not signed by Steam's endpoint");

  // return_to must be this very callback (same origin + path), or the assertion was made for someone else.
  const returnTo = get("return_to");
  if (!returnTo) throw new OpenIdError("no return_to");
  const rt = new URL(returnTo);
  if (rt.origin !== url.origin || rt.pathname !== url.pathname)
    throw new OpenIdError("return_to does not match this callback");
  for (const [k, v] of rt.searchParams)
    if (q.get(k) !== v) throw new OpenIdError("return_to query mismatch");

  const claimed = get("claimed_id") ?? "";
  const match = CLAIMED_ID.exec(claimed);
  if (!match || get("identity") !== claimed)
    throw new OpenIdError("claimed id is not a Steam profile");

  const signed = (get("signed") ?? "").split(",");
  const missing = REQUIRED_SIGNED.filter((f) => !signed.includes(f));
  if (missing.length) throw new OpenIdError(`unsigned: ${missing.join(",")}`);

  const nonce = get("response_nonce") ?? "";
  const issued = Date.parse(nonce.slice(0, 20));
  const now = (opts.now ?? new Date()).getTime();
  if (!Number.isFinite(issued) || Math.abs(now - issued) > NONCE_MAX_AGE_MS)
    throw new OpenIdError("stale or malformed nonce");

  // Ask Steam to confirm the signature (stateless mode): same fields, mode switched.
  const body = new URLSearchParams();
  for (const [k, v] of q) if (k.startsWith("openid.")) body.set(k, v);
  body.set("openid.mode", "check_authentication");
  const res = await (opts.fetch ?? fetch)(STEAM_OPENID, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(10_000),
  });
  const text = res.ok ? await res.text() : "";
  if (!/^is_valid:true$/m.test(text))
    throw new OpenIdError("Steam did not confirm the signature");
  return match[1];
}

/** Only same-site relative paths may be used as a post-login redirect. */
export function safeNext(next: string | null | undefined): string {
  return next && /^\/(?!\/)[^\\]*$/.test(next) ? next : "/";
}
