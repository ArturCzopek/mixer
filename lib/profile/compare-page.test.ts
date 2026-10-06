import { beforeEach, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/components/profile/player-compare-view", () => ({
  PlayerCompareView: () => null,
}));
vi.mock("@/lib/groups/queries", () => ({ groupBySlug: vi.fn() }));
vi.mock("@/lib/profile/queries", () => ({ groupPlayerProfile: vi.fn() }));

import ComparePage from "@/app/g/[slug]/compare/page";
import { groupBySlug } from "@/lib/groups/queries";
import { groupPlayerProfile } from "./queries";

const a = "76561197993187687";
const b = "76561198012352866";
const group = {
  id: "group",
  slug: "crew",
  name: "Crew",
  faceitClubUrl: null,
  discordGuildId: null,
  members: [a, b].map((steamId) => ({
    playerId: steamId,
    steamId,
    displayName: steamId,
    avatarUrl: null,
    faceitNickname: null,
    discordUserId: null,
    manualElo: null,
    role: "member" as const,
    joinedAt: "2026-10-01T00:00:00Z",
  })),
};
const render = (query: Record<string, string | string[] | undefined> = {}) =>
  ComparePage({
    params: Promise.resolve({ slug: "crew" }),
    searchParams: Promise.resolve(query),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(groupBySlug).mockResolvedValue(group);
  vi.mocked(groupPlayerProfile).mockResolvedValue(null);
});

it("loads only distinct active group members and retains the chosen source", async () => {
  const page = await render({ a, b, source: "premier" });
  expect(groupPlayerProfile).toHaveBeenCalledTimes(2);
  expect(groupPlayerProfile).toHaveBeenCalledWith("group", a);
  expect(groupPlayerProfile).toHaveBeenCalledWith("group", b);
  expect(page.props).toMatchObject({
    selectedA: a,
    selectedB: b,
    source: "premier",
  });
});

it("does not fetch profiles for missing, duplicate, malformed or nonmember selections", async () => {
  for (const query of [
    {},
    { a, b: a },
    { a, b: "bad" },
    { a, b: "76561197960551471" },
    { a: [a, b], b },
  ]) {
    const page = await render(query);
    expect(page.props.profiles).toEqual([null, null]);
  }
  expect(groupPlayerProfile).not.toHaveBeenCalled();
  expect((await render({ a, b, source: "unknown" })).props.source).toBe("mix");
});

it("returns not found for an unknown group before fetching players", async () => {
  vi.mocked(groupBySlug).mockResolvedValue(null);
  await expect(render({ a, b })).rejects.toThrow("NOT_FOUND");
  expect(groupPlayerProfile).not.toHaveBeenCalled();
});
