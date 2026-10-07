import type { ReactElement } from "react";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  groupBySlug: vi.fn(),
  groupAnalytics: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/groups/queries", () => ({ groupBySlug: mocks.groupBySlug }));
vi.mock("@/lib/groups/analytics", () => ({
  groupAnalytics: mocks.groupAnalytics,
}));
vi.mock("@/lib/i18n/server", async () => {
  const { DICTS } = await import("@/lib/i18n/dict");
  return { getDict: async () => DICTS.en };
});

import GroupStatisticsPage from "./page";

const group = { id: "group-id", slug: "crew", name: "Crew" };
const emptyAnalytics = {
  scope: { period: "all", archive: "all" },
  totals: {
    evenings: 0,
    maps: 0,
    scoreOnlyMaps: 0,
    archives: 0,
    current: 0,
    sources: { faceit: 0, popflash: 0, manual: 0, demo: 0 },
  },
  leaderboard: [],
  mapPerformance: [],
  teammatePairs: [],
  awards: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.groupBySlug.mockResolvedValue(group);
  mocks.groupAnalytics.mockResolvedValue(emptyAnalytics);
});

it("calls notFound for an unknown group", async () => {
  mocks.groupBySlug.mockResolvedValue(null);
  await expect(
    GroupStatisticsPage({
      params: Promise.resolve({ slug: "missing" }),
      searchParams: Promise.resolve({}),
    }),
  ).rejects.toThrow("NEXT_NOT_FOUND");
  expect(mocks.notFound).toHaveBeenCalledOnce();
  expect(mocks.groupAnalytics).not.toHaveBeenCalled();
});

it("defaults invalid and repeated query values to the safe all-time scope", async () => {
  const page = (await GroupStatisticsPage({
    params: Promise.resolve({ slug: "crew" }),
    searchParams: Promise.resolve({
      period: ["30", "365"],
      archive: "unknown",
      sort: ["adr", "kd"],
    }),
  })) as ReactElement<{ sort: string }>;

  expect(mocks.groupAnalytics).toHaveBeenCalledWith("group-id", {
    period: "all",
    archive: "all",
  });
  expect(page.props.sort).toBe("rating");
});

it("passes valid period and archive filters through to stored group analytics", async () => {
  await GroupStatisticsPage({
    params: Promise.resolve({ slug: "crew" }),
    searchParams: Promise.resolve({
      period: "90",
      archive: "current",
      sort: "adr",
    }),
  });

  expect(mocks.groupAnalytics).toHaveBeenCalledWith("group-id", {
    period: "90",
    archive: "current",
  });
});
