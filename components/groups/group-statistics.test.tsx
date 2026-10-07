import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DICTS } from "@/lib/i18n/dict";
import type { groupAnalytics } from "@/lib/groups/analytics";
import type { PlayerAnalytics } from "@/lib/groups/analytics-summary";
import { GroupStatisticsView } from "./group-statistics";

type Analytics = Awaited<ReturnType<typeof groupAnalytics>>;

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  }) => createElement("a", { href, ...props }, children),
}));

const copy = DICTS.en.groups.statistics;

function player(
  overrides: Partial<PlayerAnalytics> &
    Pick<PlayerAnalytics, "playerId" | "name" | "steamId">,
): PlayerAnalytics {
  return {
    maps: 0,
    evenings: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    winRate: null,
    ratedMaps: 0,
    rating: null,
    adr: null,
    adrMaps: 0,
    kills: null,
    deaths: null,
    assists: null,
    killsMaps: 0,
    deathsMaps: 0,
    assistsMaps: 0,
    kd: null,
    kdMaps: 0,
    ...overrides,
  };
}

function analytics(overrides: Partial<Analytics> = {}): Analytics {
  return {
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
    ...overrides,
  };
}

function render({
  data = analytics(),
  period = "all",
  archive = "all",
  sort = "rating",
}: {
  data?: Analytics;
  period?: "all" | "30" | "90" | "365";
  archive?: "all" | "current" | "archive";
  sort?: "rating" | "adr" | "kd" | "winRate" | "maps";
} = {}) {
  return renderToStaticMarkup(
    createElement(GroupStatisticsView, {
      groupSlug: "crew",
      groupName: "Crew",
      analytics: data,
      period,
      archive,
      sort,
      copy,
      awardLabels: DICTS.en.played.awardLabels,
    }),
  );
}

describe("group statistics view", () => {
  it("shows clear empty states for a recent scope without records", () => {
    const html = render({ period: "30" });
    expect(html).toContain("No played maps in this scope.");
    expect(html).toContain("No teammate pair records in this scope.");
    expect(html).toContain("No awards recorded in this scope.");
    expect(html).toContain('name="period"');
    expect(html).toContain('value="30" selected=""');
  });

  it("ranks five-sample players first while keeping lower-sample data visible", () => {
    const html = render({
      data: analytics({
        leaderboard: [
          player({
            playerId: "few",
            steamId: "76561198000000001",
            name: "Four maps",
            maps: 4,
            ratedMaps: 4,
            rating: 1.8,
          }),
          player({
            playerId: "enough",
            steamId: "76561198000000002",
            name: "Five maps",
            maps: 5,
            ratedMaps: 5,
            rating: 1.2,
          }),
        ],
      }),
    });
    expect(html.indexOf("Five maps")).toBeLessThan(html.indexOf("Four maps"));
    expect(html).toContain("4 rated maps");
    expect(html).toContain("1.80");
    expect(html).toContain("5 rated maps");
    expect(html).toContain('href="/g/crew/p/76561198000000001"');
  });

  it("keeps the selected period and archive scope in the GET sort form", () => {
    const html = render({ period: "90", archive: "archive", sort: "adr" });
    expect(html).toContain('method="get"');
    expect(html).toContain('action="/g/crew/stats"');
    expect(html).toContain('name="period"');
    expect(html).toContain('value="90" selected=""');
    expect(html).toContain('name="archive"');
    expect(html).toContain('value="archive" selected=""');
    expect(html).toContain('name="sort"');
    expect(html).toContain('value="adr" selected=""');
  });
});
