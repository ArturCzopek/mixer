import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const GROUP = "6f1b3c2a-8d4e-4f5a-9b6c-7d8e9f0a1b2c";
const PLAYER = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const NONCE = "01a0f127-b17e-74b2-9453-49e525e62598";
const GUILD = "123456789012345678";

const auth = vi.hoisted(() => ({ requireGroupRole: vi.fn() }));
const discord = vi.hoisted(() => ({
  exchangeDiscordCode: vi.fn(),
  currentUserGuilds: vi.fn(),
  botGuild: vi.fn(),
}));
const db = vi.hoisted(() => ({
  writes: [] as unknown[],
  read: {
    data: {
      slug: "crew",
      discord_guild_id: null as string | null,
      discord_settings: {} as Record<string, string>,
    },
    error: null,
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => auth);
vi.mock("@/lib/discord/api", () => discord);
vi.mock("@/lib/db/admin", () => ({
  adminDb: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve(db.read) }),
      }),
      update: (value: unknown) => {
        db.writes.push(value);
        return { eq: () => Promise.resolve({ error: null }) };
      },
    }),
  }),
}));

const { GET } = await import("@/app/auth/discord/guild/callback/route");

function request(state = NONCE, playerId = PLAYER): NextRequest {
  const url = new URL("https://mixer.test/auth/discord/guild/callback");
  url.searchParams.set("state", state);
  url.searchParams.set("code", "code-from-discord");
  url.searchParams.set("guild_id", GUILD);
  const cookie = JSON.stringify({ nonce: NONCE, groupId: GROUP, playerId });
  return {
    nextUrl: url,
    cookies: { get: () => ({ value: cookie }) },
  } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  db.writes.length = 0;
  db.read.data.discord_guild_id = null;
  db.read.data.discord_settings = {};
  auth.requireGroupRole.mockResolvedValue({ playerId: PLAYER });
  discord.exchangeDiscordCode.mockResolvedValue("access-token");
  discord.currentUserGuilds.mockResolvedValue([
    { id: GUILD, owner: false, permissions: "32" },
  ]);
  discord.botGuild.mockResolvedValue({ id: GUILD, name: "Crew" });
});

describe("Discord guild OAuth callback", () => {
  it("rejects an unmatched state before exchanging a code", async () => {
    const response = await GET(request("wrong"));
    expect(response.headers.get("location")).toBe(
      "https://mixer.test/g?discord=failed",
    );
    expect(discord.exchangeDiscordCode).not.toHaveBeenCalled();
    expect(db.writes).toEqual([]);
  });

  it("rejects a changed Steam session or Discord account without Manage Server", async () => {
    await GET(request(NONCE, "7759c21a-1111-4111-8111-111111111111"));
    expect(discord.exchangeDiscordCode).not.toHaveBeenCalled();
    discord.currentUserGuilds.mockResolvedValue([
      { id: GUILD, owner: false, permissions: "0" },
    ]);
    const response = await GET(request());
    expect(response.headers.get("location")).toBe(
      "https://mixer.test/g/crew?discord=forbidden",
    );
    expect(discord.botGuild).not.toHaveBeenCalled();
    expect(db.writes).toEqual([]);
  });

  it("links a managed guild only after confirming bot membership", async () => {
    const response = await GET(request());
    expect(discord.botGuild).toHaveBeenCalledWith(GUILD);
    expect(db.writes).toEqual([
      { discord_guild_id: GUILD, discord_settings: {} },
    ]);
    expect(response.headers.get("location")).toBe(
      "https://mixer.test/g/crew?discord=connected",
    );
    expect(response.cookies.get("mixer_discord_guild")?.value).toBe("");
  });

  it("keeps channel settings when the same server is reauthorized", async () => {
    db.read.data.discord_guild_id = GUILD;
    db.read.data.discord_settings = { lobby_channel_id: "saved" };
    await GET(request());
    expect(db.writes).toEqual([
      {
        discord_guild_id: GUILD,
        discord_settings: { lobby_channel_id: "saved" },
      },
    ]);
  });
});
