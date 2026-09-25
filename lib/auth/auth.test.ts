import { describe, expect, it } from "vitest";
import {
  OpenIdError,
  safeNext,
  STEAM_OPENID,
  steamLoginUrl,
  verifySteamAssertion,
} from "./openid";
import { AuthError, hasGroupRole, parseAdminIds } from "./roles";
import { readSession, signSession } from "./session-token";

const CALLBACK = "https://mixer.example/auth/steam/callback";
const NOW = new Date("2026-09-25T12:00:00Z");
const STEAM_ID = "76561197993187687";

/** A positive assertion as Steam would send it back (fields as in the OpenID 2.0 spec). */
function assertion(
  over: Record<string, string | null> = {},
  callback = CALLBACK,
) {
  const claimed = `https://steamcommunity.com/openid/id/${STEAM_ID}`;
  const fields: Record<string, string | null> = {
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "id_res",
    "openid.op_endpoint": STEAM_OPENID,
    "openid.claimed_id": claimed,
    "openid.identity": claimed,
    "openid.return_to": callback,
    "openid.response_nonce": "2026-09-25T11:59:30ZabcDEF123",
    "openid.assoc_handle": "1234567890",
    "openid.signed":
      "signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle",
    "openid.sig": "c2lnbmF0dXJl",
    ...over,
  };
  const url = new URL(callback);
  for (const [k, v] of Object.entries(fields))
    if (v !== null) url.searchParams.set(k, v);
  return url.toString();
}

/** Fake Steam check_authentication endpoint; records the request body. */
function steam(valid: boolean) {
  const calls: { url: string; body: URLSearchParams }[] = [];
  const fetch = async (url: string, init?: RequestInit) => {
    calls.push({ url, body: new URLSearchParams(String(init?.body)) });
    return new Response(
      `ns:http://specs.openid.net/auth/2.0\nis_valid:${valid}\n`,
    );
  };
  return { fetch, calls };
}

describe("Steam OpenID", () => {
  it("builds the login redirect with our callback as return_to and realm", () => {
    const u = new URL(steamLoginUrl(`${CALLBACK}?next=%2Fg%2Fx`));
    expect(u.origin + u.pathname).toBe(STEAM_OPENID);
    expect(u.searchParams.get("openid.mode")).toBe("checkid_setup");
    expect(u.searchParams.get("openid.return_to")).toBe(
      `${CALLBACK}?next=%2Fg%2Fx`,
    );
    expect(u.searchParams.get("openid.realm")).toBe("https://mixer.example");
  });

  it("accepts a valid assertion confirmed by Steam and returns the SteamID64", async () => {
    const s = steam(true);
    await expect(
      verifySteamAssertion(assertion(), { fetch: s.fetch, now: NOW }),
    ).resolves.toBe(STEAM_ID);
    expect(s.calls[0].url).toBe(STEAM_OPENID);
    expect(s.calls[0].body.get("openid.mode")).toBe("check_authentication");
    expect(s.calls[0].body.get("openid.sig")).toBe("c2lnbmF0dXJl");
  });

  it("rejects a forged assertion that Steam does not confirm", async () => {
    const s = steam(false);
    await expect(
      verifySteamAssertion(assertion(), { fetch: s.fetch, now: NOW }),
    ).rejects.toThrow(OpenIdError);
  });

  it.each([
    [
      "another OpenID provider",
      { "openid.op_endpoint": "https://evil.example/openid" },
    ],
    [
      "a claimed id outside Steam",
      {
        "openid.claimed_id": "https://evil.example/openid/id/76561197993187687",
        "openid.identity": "https://evil.example/openid/id/76561197993187687",
      },
    ],
    [
      "identity ≠ claimed id",
      {
        "openid.identity":
          "https://steamcommunity.com/openid/id/76561197960000001",
      },
    ],
    [
      "an assertion made for another site",
      { "openid.return_to": "https://evil.example/auth/steam/callback" },
    ],
    [
      "unsigned return_to",
      {
        "openid.signed":
          "signed,op_endpoint,claimed_id,identity,response_nonce,assoc_handle",
      },
    ],
    [
      "a stale nonce (replay)",
      { "openid.response_nonce": "2026-09-25T11:40:00Zold" },
    ],
    ["a cancelled login", { "openid.mode": "cancel" }],
    ["no namespace", { "openid.ns": null }],
  ])("rejects %s without asking Steam", async (_, over) => {
    const s = steam(true);
    await expect(
      verifySteamAssertion(assertion(over), { fetch: s.fetch, now: NOW }),
    ).rejects.toThrow(OpenIdError);
    expect(s.calls).toHaveLength(0);
  });

  it("rejects a tampered query parameter of return_to", async () => {
    const withNext = `${CALLBACK}?next=%2Fa`;
    const url = new URL(assertion({}, withNext));
    url.searchParams.set("next", "/b");
    await expect(
      verifySteamAssertion(url.toString(), {
        fetch: steam(true).fetch,
        now: NOW,
      }),
    ).rejects.toThrow(/query mismatch/);
  });

  it("only allows relative post-login redirects", () => {
    expect(safeNext("/g/skarpeciarze")).toBe("/g/skarpeciarze");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext("/\\evil.example")).toBe("/");
    expect(safeNext(null)).toBe("/");
  });
});

describe("session token", () => {
  const SECRET = "x".repeat(44);
  const claims = {
    playerId: "4b0d5a0e-0000-4000-8000-000000000001",
    steamId: STEAM_ID,
  };

  it("round-trips the claims", async () => {
    const t = await signSession(claims, SECRET, NOW);
    await expect(readSession(t, SECRET, NOW)).resolves.toEqual(claims);
  });

  it("rejects a token signed with another secret, a tampered one and an expired one", async () => {
    const t = await signSession(claims, SECRET, NOW);
    await expect(readSession(t, "y".repeat(44), NOW)).resolves.toBeNull();
    await expect(
      readSession(`${t.slice(0, -2)}xx`, SECRET, NOW),
    ).resolves.toBeNull();
    const later = new Date(NOW.getTime() + 31 * 86_400_000);
    await expect(readSession(t, SECRET, later)).resolves.toBeNull();
    await expect(readSession(undefined, SECRET, NOW)).resolves.toBeNull();
  });

  it("refuses a short secret", async () => {
    await expect(signSession(claims, "short", NOW)).rejects.toThrow(
      /SESSION_SECRET/,
    );
  });
});

describe("roles", () => {
  const active = (role: "admin" | "member") => ({ role, leftAt: null });

  it("members and admins pass member checks, only admins pass admin checks", () => {
    expect(hasGroupRole(active("member"), "member", false)).toBe(true);
    expect(hasGroupRole(active("member"), "admin", false)).toBe(false);
    expect(hasGroupRole(active("admin"), "admin", false)).toBe(true);
  });

  it("closed memberships and non-members get nothing; site admins get everything", () => {
    expect(
      hasGroupRole({ role: "admin", leftAt: "2026-01-01" }, "member", false),
    ).toBe(false);
    expect(hasGroupRole(null, "member", false)).toBe(false);
    expect(hasGroupRole(null, "admin", true)).toBe(true);
  });

  it("parses ADMIN_STEAM_IDS", () => {
    expect([
      ...parseAdminIds("76561197993187687, 123,\n76561198004643533"),
    ]).toEqual(["76561197993187687", "76561198004643533"]);
    expect(parseAdminIds(undefined).size).toBe(0);
  });

  it("AuthError carries the HTTP status", () => {
    expect(new AuthError(403, "no").status).toBe(403);
  });
});
