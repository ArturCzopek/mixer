import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getProfile: vi.fn(),
  getMatches: vi.fn(),
}));

vi.mock("@/lib/external/leetify", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/external/leetify")>();
  return {
    ...actual,
    getLeetifyProfile: api.getProfile,
    getLeetifyMatches: api.getMatches,
  };
});

import { GET } from "./route";

const steamId = "76561197960551471";
const match = (overrides: Record<string, unknown> = {}) => ({
  finished_at: "2026-10-01T20:00:00.000Z",
  data_source: "faceit",
  map_name: "de_mirage",
  team_scores: [
    { team_number: 2, score: 13 },
    { team_number: 3, score: 8 },
  ],
  stats: [
    {
      steam64_id: steamId,
      initial_team_number: 2,
      leetify_rating: 0.0234,
      total_kills: 20,
      total_assists: 4,
      total_deaths: 10,
    },
  ],
  ...overrides,
});

function request(view: string) {
  return new Request(`https://mixer.test/api/leetify/${steamId}?view=${view}`);
}

const context = (id = steamId) => ({
  params: Promise.resolve({ steamId: id }),
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-06T12:00:00Z"));
  api.getProfile.mockReset().mockResolvedValue({
    privacyMode: false,
    ranks: { faceit: 10, faceit_elo: 2169, premier: 18693 },
  });
  api.getMatches.mockReset().mockResolvedValue([
    match(),
    match({ finished_at: "2026-09-01T20:00:00.000Z" }),
    match({
      data_source: "matchmaking",
      finished_at: "2026-10-02T20:00:00.000Z",
    }),
  ]);
});
afterEach(() => vi.useRealTimers());

describe("Leetify route", () => {
  it("rejects invalid Steam IDs before calling Leetify", async () => {
    const response = await GET(request("preview"), context("123"));
    expect(response.status).toBe(400);
    expect(api.getProfile).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns source-filtered live profile data with a five-minute HTTP cache", async () => {
    const response = await GET(request("profile"), context());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("s-maxage=300");
    await expect(response.json()).resolves.toMatchObject({
      privacyMode: false,
      ranks: { faceit: 10, faceit_elo: 2169, premier: 18693 },
      faceitMatches: [expect.objectContaining({ dataSource: "faceit" })],
      premierMatches: [expect.objectContaining({ dataSource: "matchmaking" })],
    });
  });

  it("returns only last-30-day FACEIT matches for the preview", async () => {
    const response = await GET(request("preview"), context());
    await expect(response.json()).resolves.toMatchObject({
      privacyMode: false,
      matches: [
        {
          finishedAt: "2026-10-01T20:00:00.000Z",
          dataSource: "faceit",
          map: "de_mirage",
          score: [13, 8],
          leetifyRating: 2.34,
          kad: [20, 4, 10],
        },
      ],
    });
  });

  it("returns private profile state without fetching match history", async () => {
    api.getProfile.mockResolvedValueOnce({ privacyMode: true, ranks: {} });
    const response = await GET(request("preview"), context());
    await expect(response.json()).resolves.toEqual({
      privacyMode: true,
      matches: [],
      ranks: {},
    });
    expect(api.getMatches).not.toHaveBeenCalled();
  });

  it("does not expose upstream error details", async () => {
    api.getProfile.mockRejectedValueOnce(new Error("secret upstream detail"));
    const response = await GET(request("profile"), context());
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "unavailable" });
  });
});
