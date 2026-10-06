import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/components/i18n";
import { LeetifyProfilePanel } from "./profile-panel";
import { LeetifyPreviewCard } from "./preview-card";
import { LeetifyAttribution, LeetifyMatchTable } from "./match-table";
import { PlayerProfileView } from "@/components/profile/player-profile-view";
import type { LeetifyMatch } from "@/lib/external/leetify";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

const matches: LeetifyMatch[] = [
  {
    finishedAt: "2026-10-01T20:00:00.000Z",
    dataSource: "faceit",
    map: "de_mirage",
    score: [13, 8],
    leetifyRating: 2.34,
    kad: [20, 4, 10],
  },
  {
    finishedAt: "2026-09-30T20:00:00.000Z",
    dataSource: "matchmaking",
    map: "de_dust2",
    score: [7, 13],
    leetifyRating: -1.2,
    kad: [11, 2, 16],
  },
];

function render(child: ReactNode) {
  return renderToStaticMarkup(<I18nProvider lang="en">{child}</I18nProvider>);
}

describe("Leetify views", () => {
  it("renders each supplied match field and the required attribution", () => {
    const html = render(
      createElement(
        "div",
        null,
        createElement(LeetifyMatchTable, { matches }),
        createElement(LeetifyAttribution),
      ),
    );
    expect(html).toContain("de_mirage");
    expect(html).toContain("13:8");
    expect(html).toContain("20/4/10");
    expect(html).toContain("+2.34");
    expect(html).toContain("Data Provided by Leetify");
    expect(html).toContain('href="https://leetify.com/"');
  });

  it("shows VGUI pending panels for profile tabs and player previews", () => {
    const profile = render(
      createElement(LeetifyProfilePanel, {
        steamId: "76561197960551471",
        name: "Player",
        source: "faceit",
      }),
    );
    const preview = render(
      createElement(LeetifyPreviewCard, {
        player: { steamId: "76561197960551471", name: "Player" },
      }),
    );
    expect(profile).toContain("Loading Leetify data...");
    expect(profile).toContain("Data Provided by Leetify");
    expect(preview).toContain("Loading Leetify data...");
    expect(preview).toContain("Leetify · Player · FACEIT, last 30 days");
  });

  it("offers Mix, FACEIT, and Premier tabs on the player profile", () => {
    const data = {
      player: { steamId: "76561197960551471", name: "Player", avatarUrl: null },
      faceit: null,
      summary: {
        mapCount: 0,
        winRate: null,
        wins: 0,
        losses: 0,
        draws: 0,
        rating: null,
        ratedMaps: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
        adr: null,
        trend: [],
        maps: [],
        bestTeammates: [],
      },
    } as unknown as Parameters<typeof PlayerProfileView>[0]["data"];
    const html = render(
      createElement(PlayerProfileView, {
        groupSlug: "crew",
        groupName: "Crew",
        data,
      }),
    );
    expect(html).toContain("Mix");
    expect(html).toContain("FACEIT");
    expect(html).toContain("Premier");
  });
});
