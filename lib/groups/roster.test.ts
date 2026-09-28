import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "@/lib/auth/roles";
import { parseSteamInput } from "@/lib/external/steam";

const auth = vi.hoisted(() => ({ requireGroupRole: vi.fn() }));
const external = vi.hoisted(() => ({
  summaries: vi.fn(),
  vanity: vi.fn(),
  faceit: vi.fn(),
}));
const db = vi.hoisted(() => ({
  from: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  is: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
  maybeSingle: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => auth);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/external/faceit", () => ({
  getPlayerBySteamId: external.faceit,
}));
// Use the real input resolver, including real vanity parsing, with fixture HTTP responses.
vi.mock("@/lib/external/http", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/external/http")>()),
  getJson: (url: string) =>
    url.includes("ResolveVanityURL")
      ? external.vanity(url)
      : external.summaries(url),
}));
vi.mock("@/lib/db/admin", () => ({ adminDb: () => db }));
const { addRosterPlayer, updateRosterElo } = await import("./roster");
const GROUP = "6f1b3c2a-8d4e-4f5a-9b6c-7d8e9f0a1b2c";
const PLAYER = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const STEAM = "76561197960551471";
const form = (key: string, value: string) => {
  const f = new FormData();
  f.set(key, value);
  return f;
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("STEAM_WEB_API_KEY", "fixture-key");
  auth.requireGroupRole.mockResolvedValue({ playerId: PLAYER });
  external.summaries.mockResolvedValue({
    response: {
      players: [
        {
          steamid: STEAM,
          personaname: "Player",
          avatarfull: "https://avatars.steamstatic.com/test.jpg",
          profileurl: `https://steamcommunity.com/profiles/${STEAM}`,
          communityvisibilitystate: 3,
        },
      ],
    },
  });
  external.vanity.mockResolvedValue({
    response: { success: 1, steamid: STEAM },
  });
  external.faceit.mockResolvedValue({
    playerId: "faceit-id",
    nickname: "Player",
  });
  db.from.mockReturnValue(db);
  db.select.mockReturnValue(db);
  db.eq.mockReturnValue(db);
  db.is.mockReturnValue(db);
  db.update.mockReturnValue(db);
  db.upsert.mockReturnValueOnce(db).mockResolvedValue({ error: null });
  db.single
    .mockResolvedValueOnce({ data: { id: PLAYER }, error: null })
    .mockResolvedValue({ data: { left_at: null }, error: null });
  db.maybeSingle.mockResolvedValue({
    data: { player_id: PLAYER },
    error: null,
  });
});

describe("roster writes", () => {
  it.each([401, 403] as const)(
    "rejects %s before external lookups or DB writes",
    async (status) => {
      auth.requireGroupRole.mockRejectedValue(new AuthError(status, "denied"));
      const error = status === 401 ? "unauthorized" : "forbidden";
      expect(
        await addRosterPlayer(GROUP, undefined, form("steam", STEAM)),
      ).toEqual({ error });
      expect(
        await updateRosterElo(GROUP, PLAYER, undefined, form("elo", "1000")),
      ).toEqual({ error });
      expect(external.summaries).not.toHaveBeenCalled();
      expect(external.faceit).not.toHaveBeenCalled();
      expect(db.from).not.toHaveBeenCalled();
    },
  );
  it.each([
    STEAM,
    `https://steamcommunity.com/profiles/${STEAM}`,
    "https://steamcommunity.com/id/player",
    "player",
  ])(
    "adds %s by unique Steam identity without resetting roles or ELO",
    async (input) => {
      expect(
        await addRosterPlayer(GROUP, undefined, form("steam", input)),
      ).toEqual({ ok: true, faceitUnavailable: false });
      expect(auth.requireGroupRole).toHaveBeenCalledWith(GROUP, "admin");
      expect(db.upsert).toHaveBeenNthCalledWith(
        1,
        {
          steam_id: STEAM,
          display_name: "Player",
          avatar_url: "https://avatars.steamstatic.com/test.jpg",
          faceit_player_id: "faceit-id",
          faceit_nickname: "Player",
        },
        { onConflict: "steam_id" },
      );
      expect(db.upsert).toHaveBeenNthCalledWith(
        2,
        { group_id: GROUP, player_id: PLAYER, added_by: PLAYER },
        { onConflict: "group_id,player_id", ignoreDuplicates: true },
      );
      expect(db.update).not.toHaveBeenCalled();
    },
  );
  it("keeps FACEIT optional and never overwrites an old link on failure", async () => {
    external.faceit.mockRejectedValue(new Error("offline"));
    expect(
      await addRosterPlayer(GROUP, undefined, form("steam", STEAM)),
    ).toEqual({ ok: true, faceitUnavailable: true });
    expect(db.upsert.mock.calls[0][0]).not.toHaveProperty("faceit_player_id");
  });
  it("accepts players without a FACEIT account", async () => {
    external.faceit.mockResolvedValue(null);
    expect(
      await addRosterPlayer(GROUP, undefined, form("steam", STEAM)),
    ).toEqual({ ok: true, faceitUnavailable: false });
  });
  it("does not revive a closed membership or its former admin rights", async () => {
    db.single
      .mockReset()
      .mockResolvedValueOnce({ data: { id: PLAYER }, error: null })
      .mockResolvedValue({ data: { left_at: "2026-09-20" }, error: null });
    expect(
      await addRosterPlayer(GROUP, undefined, form("steam", STEAM)),
    ).toEqual({ error: "closed" });
    expect(db.update).not.toHaveBeenCalled();
  });
  it.each([
    "https://evil.example/profile",
    "https://steamcommunity.com/id/%E0%A4%A",
    "https://steamcommunity.com/id/a%2Fb",
    "",
  ])("rejects invalid input %s without throwing or writing", async (input) => {
    expect(parseSteamInput(input)).toBeNull();
    expect(
      await addRosterPlayer(GROUP, undefined, form("steam", input)),
    ).toEqual({ error: "steam" });
    expect(db.from).not.toHaveBeenCalled();
  });
  it("does not create an identity when Steam cannot find the player", async () => {
    external.summaries.mockResolvedValue({ response: { players: [] } });
    expect(
      await addRosterPlayer(GROUP, undefined, form("steam", STEAM)),
    ).toEqual({ error: "notFound" });
    expect(db.from).not.toHaveBeenCalled();
  });
  it("allows retrying after Steam or database failures", async () => {
    external.summaries.mockRejectedValueOnce(new Error("offline"));
    expect(
      await addRosterPlayer(GROUP, undefined, form("steam", STEAM)),
    ).toEqual({ error: "steamUnavailable" });
    expect(db.from).not.toHaveBeenCalled();
    db.single
      .mockReset()
      .mockResolvedValue({ error: { code: "23505" }, data: null });
    expect(
      await addRosterPlayer(GROUP, undefined, form("steam", STEAM)),
    ).toEqual({ error: "failed" });
    expect(db.upsert).toHaveBeenCalledTimes(1);
  });
  it.each(["600", "2500", "1250", ""])(
    "saves fallback ELO %s only on the active membership of this group",
    async (elo) => {
      expect(
        await updateRosterElo(GROUP, PLAYER, undefined, form("elo", elo)),
      ).toEqual({ ok: true });
      expect(db.from).toHaveBeenCalledWith("group_members");
      expect(db.update).toHaveBeenCalledWith({
        manual_skill_override: elo ? Number(elo) : null,
      });
      expect(db.eq.mock.calls).toEqual([
        ["group_id", GROUP],
        ["player_id", PLAYER],
      ]);
      expect(db.is).toHaveBeenCalledWith("left_at", null);
    },
  );
  it.each(["599", "2501", "100.5", "NaN", "1e3", "0x100"])(
    "rejects invalid ELO %s",
    async (elo) => {
      expect(
        await updateRosterElo(GROUP, PLAYER, undefined, form("elo", elo)),
      ).toEqual({ error: "elo" });
      expect(db.from).not.toHaveBeenCalled();
    },
  );
  it("reports a missing/closed membership instead of pretending to save", async () => {
    db.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(
      await updateRosterElo(GROUP, PLAYER, undefined, form("elo", "1500")),
    ).toEqual({ error: "failed" });
  });
  it("rejects tampered bound IDs", async () => {
    expect(
      await addRosterPlayer("bad", undefined, form("steam", STEAM)),
    ).toEqual({ error: "forbidden" });
    expect(
      await updateRosterElo(GROUP, "bad", undefined, form("elo", "1000")),
    ).toEqual({ error: "forbidden" });
    expect(auth.requireGroupRole).not.toHaveBeenCalled();
  });
});
