import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "@/lib/auth/roles";

const GROUP = "6f1b3c2a-8d4e-4f5a-9b6c-7d8e9f0a1b2c";
const GUILD = "123456789012345678";
const channels = [
  { id: "123456789012345671", name: "Lobby", type: 2, position: 0 },
  { id: "123456789012345672", name: "A", type: 2, position: 1 },
  { id: "123456789012345673", name: "B", type: 2, position: 2 },
  { id: "123456789012345674", name: "News", type: 0, position: 3 },
];
const auth = vi.hoisted(() => ({
  requireGroupRole: vi.fn(),
  requireSession: vi.fn(),
}));
const api = vi.hoisted(() => ({ guildChannels: vi.fn() }));
const db = vi.hoisted(() => ({
  writes: [] as unknown[],
  filters: [] as unknown[],
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => auth);
vi.mock("@/lib/discord/api", () => api);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/db/admin", () => ({
  adminDb: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: { slug: "crew", discord_guild_id: GUILD },
              error: null,
            }),
        }),
      }),
      update: (value: unknown) => {
        db.writes.push(value);
        const chain = {
          eq: (key: string, value: string) => {
            db.filters.push([key, value]);
            return chain;
          },
          select: () => chain,
          maybeSingle: () =>
            Promise.resolve({ data: { id: GROUP }, error: null }),
        };
        return chain;
      },
    }),
  }),
}));

const { redirect } = await import("next/navigation");
const { saveDiscordChannels, unlinkDiscordAccount } = await import("./actions");

function form(teamB = channels[2].id) {
  const data = new FormData();
  data.set("lobby", channels[0].id);
  data.set("teamA", channels[1].id);
  data.set("teamB", teamB);
  data.set("notification", channels[3].id);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  db.writes.length = 0;
  db.filters.length = 0;
  auth.requireGroupRole.mockResolvedValue({ playerId: "player" });
  auth.requireSession.mockResolvedValue({ playerId: "player" });
  api.guildChannels.mockResolvedValue(channels);
});

describe("Discord player unlink", () => {
  it("clears only the signed-in player's link and uses a local return path", async () => {
    await unlinkDiscordAccount("//other.test");
    expect(db.writes).toEqual([{ discord_user_id: null }]);
    expect(db.filters).toEqual([["id", "player"]]);
    expect(redirect).toHaveBeenCalledWith("/?discordAccount=unlinked");
  });
});

describe("Discord channel settings", () => {
  it("checks group admin before reading channels or writing", async () => {
    auth.requireGroupRole.mockRejectedValue(new AuthError(403, "no"));
    expect(await saveDiscordChannels(GROUP, undefined, form())).toEqual({
      error: "forbidden",
    });
    expect(api.guildChannels).not.toHaveBeenCalled();
    expect(db.writes).toEqual([]);
  });

  it("rejects tampered channel choices before writing", async () => {
    expect(await saveDiscordChannels(GROUP, undefined, form("999"))).toEqual({
      error: "channels",
    });
    expect(api.guildChannels).toHaveBeenCalledWith(GUILD);
    expect(db.writes).toEqual([]);
  });

  it("saves validated channel ids only for the still-connected guild", async () => {
    expect(await saveDiscordChannels(GROUP, undefined, form())).toEqual({
      ok: true,
    });
    expect(db.writes).toEqual([
      {
        discord_settings: {
          lobby_channel_id: channels[0].id,
          team_a_channel_id: channels[1].id,
          team_b_channel_id: channels[2].id,
          notification_channel_id: channels[3].id,
        },
      },
    ]);
    expect(db.filters).toEqual([
      ["id", GROUP],
      ["discord_guild_id", GUILD],
    ]);
  });
});
