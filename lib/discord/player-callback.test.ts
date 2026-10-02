import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const PLAYER = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const NONCE = "01a0f127-b17e-74b2-9453-49e525e62598";
const DISCORD_USER = "123456789012345678";

const auth = vi.hoisted(() => ({ requireSession: vi.fn() }));
const discord = vi.hoisted(() => ({
  exchangeDiscordCode: vi.fn(),
  currentDiscordUser: vi.fn(),
}));
const db = vi.hoisted(() => ({
  writes: [] as unknown[],
  filters: [] as unknown[],
  response: {
    data: { id: "player" } as { id: string } | null,
    error: null as { code: string } | null,
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => auth);
vi.mock("@/lib/discord/api", () => discord);
vi.mock("@/lib/db/admin", () => ({
  adminDb: () => ({
    from: () => ({
      update: (value: unknown) => {
        db.writes.push(value);
        const chain = {
          eq: (key: string, value: string) => {
            db.filters.push([key, value]);
            return chain;
          },
          select: () => chain,
          maybeSingle: () => Promise.resolve(db.response),
        };
        return chain;
      },
    }),
  }),
}));

const { GET } = await import("@/app/auth/discord/player/callback/route");

function request(state = NONCE, playerId = PLAYER): NextRequest {
  const url = new URL("https://mixer.test/auth/discord/player/callback");
  url.searchParams.set("state", state);
  url.searchParams.set("code", "code-from-discord");
  const cookie = JSON.stringify({
    nonce: NONCE,
    playerId,
    next: "/g/crew#members",
  });
  return {
    nextUrl: url,
    cookies: { get: () => ({ value: cookie }) },
  } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  db.writes.length = 0;
  db.filters.length = 0;
  db.response = { data: { id: "player" }, error: null };
  auth.requireSession.mockResolvedValue({ playerId: PLAYER });
  discord.exchangeDiscordCode.mockResolvedValue("access-token");
  discord.currentDiscordUser.mockResolvedValue({ id: DISCORD_USER });
});

describe("Discord player OAuth callback", () => {
  it("rejects a changed state or Steam session before exchanging a code", async () => {
    await GET(request("wrong"));
    expect(discord.exchangeDiscordCode).not.toHaveBeenCalled();
    await GET(request(NONCE, "7759c21a-1111-4111-8111-111111111111"));
    expect(discord.exchangeDiscordCode).not.toHaveBeenCalled();
    expect(db.writes).toEqual([]);
  });

  it("stores the verified Discord ID only for the signed-in player", async () => {
    const response = await GET(request());
    expect(db.writes).toEqual([{ discord_user_id: DISCORD_USER }]);
    expect(db.filters).toEqual([["id", PLAYER]]);
    expect(response.headers.get("location")).toBe(
      "https://mixer.test/g/crew?discordAccount=linked#members",
    );
    expect(response.cookies.get("mixer_discord_player")?.value).toBe("");
  });

  it("reports an account already linked to another player", async () => {
    db.response = { data: null, error: { code: "23505" } };
    const response = await GET(request());
    expect(response.headers.get("location")).toBe(
      "https://mixer.test/g/crew?discordAccount=alreadyUsed#members",
    );
  });
});
