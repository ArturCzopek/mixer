import { beforeEach, expect, it, vi } from "vitest";
import { readSession } from "./session-token";

const db = vi.hoisted(() => ({
  from: vi.fn(),
  upsert: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
}));
const steam = vi.hoisted(() => ({ getPlayerSummaries: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/db/admin", () => ({ adminDb: () => db }));
vi.mock("@/lib/external/steam", () => steam);
const { logIn } = await import("./server");
const STEAM = "76561197960551471";
const PLAYER = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const SECRET = "test-only-session-secret-at-least-32-characters";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SESSION_SECRET", SECRET);
  vi.stubEnv("ADMIN_STEAM_IDS", "");
  db.from.mockReturnValue(db);
  db.upsert.mockReturnValue(db);
  db.select.mockReturnValue(db);
  db.single.mockResolvedValue({ data: { id: PLAYER }, error: null });
  steam.getPlayerSummaries.mockResolvedValue([
    { name: "Refreshed", avatarUrl: "https://avatars.steamstatic.com/new.jpg" },
  ]);
});

it("claims an admin-added Steam identity and signs a session for its existing player id", async () => {
  const token = await logIn(STEAM);
  expect(db.from).toHaveBeenCalledWith("players");
  expect(db.upsert).toHaveBeenCalledWith(
    {
      steam_id: STEAM,
      display_name: "Refreshed",
      avatar_url: "https://avatars.steamstatic.com/new.jpg",
      last_login_at: expect.any(String),
    },
    { onConflict: "steam_id" },
  );
  const session = await readSession(token, SECRET);
  expect(session).toMatchObject({ playerId: PLAYER, steamId: STEAM });
  // No membership write, generated player id, privilege reset or FACEIT link overwrite.
  expect(db.from).toHaveBeenCalledTimes(1);
});

it("keeps an existing profile and allows claiming it when Steam summaries are unavailable", async () => {
  steam.getPlayerSummaries.mockRejectedValue(new Error("offline"));
  expect(await readSession(await logIn(STEAM), SECRET)).toMatchObject({
    playerId: PLAYER,
  });
  expect(db.upsert.mock.calls[0][0]).not.toHaveProperty("display_name");
  expect(db.upsert.mock.calls[0][0]).not.toHaveProperty("avatar_url");
});
