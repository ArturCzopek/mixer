import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "@/lib/auth/roles";

const MIX = "6f1b3c2a-8d4e-4f5a-9b6c-7d8e9f0a1b2c";
const GROUP = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const VARIANT = "01a0f127-b17e-74b2-9453-49e525e62598";
const GUILD = "123456789012345678";
const ids = ["123456789012345671", "123456789012345672", "123456789012345673"];
const auth = vi.hoisted(() => ({
  requireGroupRole: vi.fn(),
  requireSession: vi.fn(),
}));
const api = vi.hoisted(() => ({
  guildChannels: vi.fn(),
  moveDiscordMember: vi.fn(),
}));
const db = vi.hoisted(() => ({
  mix: { group_id: "", status: "locked", chosen_variant_id: "" },
  group: {
    discord_guild_id: "",
    discord_settings: {} as Record<string, string>,
  },
  lineup: [] as {
    team: "A" | "B";
    player: {
      display_name: string;
      steam_id: string;
      discord_user_id: string | null;
    };
  }[],
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => auth);
vi.mock("@/lib/discord/api", () => api);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/db/admin", () => ({
  adminDb: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: table === "mixes" ? db.mix : db.group,
              error: null,
            }),
          returns: () => Promise.resolve({ data: db.lineup, error: null }),
        }),
      }),
    }),
  }),
}));

const { moveMixDiscordPlayers } = await import("./actions");
function form(target: string) {
  const value = new FormData();
  value.set("target", target);
  return value;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(db.mix, {
    group_id: GROUP,
    status: "locked",
    chosen_variant_id: VARIANT,
  });
  Object.assign(db.group, {
    discord_guild_id: GUILD,
    discord_settings: {
      lobby_channel_id: ids[0],
      team_a_channel_id: ids[1],
      team_b_channel_id: ids[2],
    },
  });
  db.lineup = Array.from({ length: 10 }, (_, index) => ({
    team: index < 5 ? "A" : "B",
    player: {
      display_name: `Player ${index}`,
      steam_id: String(index),
      discord_user_id: `12345678901234568${index}`,
    },
  }));
  auth.requireGroupRole.mockResolvedValue({ playerId: "admin" });
  api.guildChannels.mockResolvedValue(ids.map((id) => ({ id, type: 2 })));
  api.moveDiscordMember.mockResolvedValue("moved");
});

describe("manual Discord voice moves", () => {
  it("rejects a non-admin before reading settings or moving anyone", async () => {
    auth.requireGroupRole.mockRejectedValue(new AuthError(403, "no"));
    expect(await moveMixDiscordPlayers(MIX, undefined, form("teams"))).toEqual({
      error: "forbidden",
    });
    expect(api.guildChannels).not.toHaveBeenCalled();
    expect(api.moveDiscordMember).not.toHaveBeenCalled();
  });

  it("uses the chosen variant's teams, reporting unlinked and offline players", async () => {
    db.lineup[0].player.discord_user_id = null;
    api.moveDiscordMember.mockImplementation(
      async (_guild: string, user: string) =>
        user.endsWith("1") ? "not_connected" : "moved",
    );
    const result = await moveMixDiscordPlayers(MIX, undefined, form("teams"));
    expect(result).toEqual({
      moved: [
        "Player 2",
        "Player 3",
        "Player 4",
        "Player 5",
        "Player 6",
        "Player 7",
        "Player 8",
        "Player 9",
      ],
      notConnected: ["Player 1"],
      unlinked: ["Player 0"],
      failed: [],
    });
    expect(api.moveDiscordMember).toHaveBeenCalledWith(
      GUILD,
      "123456789012345681",
      ids[1],
    );
    expect(api.moveDiscordMember).toHaveBeenCalledWith(
      GUILD,
      "123456789012345685",
      ids[2],
    );
  });

  it("returns the lineup to the lobby even after the mix is played", async () => {
    db.mix.status = "played";
    const result = await moveMixDiscordPlayers(MIX, undefined, form("lobby"));
    expect(result && "moved" in result && result.moved).toHaveLength(10);
    expect(api.moveDiscordMember).toHaveBeenCalledTimes(10);
    expect(
      api.moveDiscordMember.mock.calls.every((call) => call[2] === ids[0]),
    ).toBe(true);
  });

  it("rejects stale channels and an invalid lineup before moving anyone", async () => {
    db.group.discord_settings.team_b_channel_id = "123456789012345699";
    expect(await moveMixDiscordPlayers(MIX, undefined, form("teams"))).toEqual({
      error: "channels",
    });
    db.group.discord_settings.team_b_channel_id = ids[2];
    db.lineup.pop();
    expect(await moveMixDiscordPlayers(MIX, undefined, form("teams"))).toEqual({
      error: "mix",
    });
    expect(api.moveDiscordMember).not.toHaveBeenCalled();
  });
});
