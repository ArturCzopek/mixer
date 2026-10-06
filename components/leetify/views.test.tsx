import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/components/i18n";
import { LeetifyProfilePanel, LeetifyRatingChart } from "./profile-panel";
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

  it("shows only the latest 20 raw matches and plots raw Leetify Ratings", () => {
    const history = Array.from({ length: 22 }, (_, index) => ({
      ...matches[0],
      finishedAt: new Date(
        Date.parse("2026-10-06T20:00:00.000Z") - index * 86_400_000,
      ).toISOString(),
      map: `map-${index}`,
      score: [13, index] as [number, number],
      leetifyRating: index === 1 ? -0.45 : index === 2 ? null : 0.12,
    }));
    const html = render(
      createElement(
        "div",
        null,
        createElement(LeetifyRatingChart, { matches: history }),
        createElement(LeetifyMatchTable, { matches: history }),
      ),
    );
    expect(html.match(/<circle/g)).toHaveLength(20);
    expect(html.match(/<tr/g)).toHaveLength(21);
    expect(html).toContain("map-0");
    expect(html).toContain("13:0");
    expect(html).toContain("Leetify Rating +0.12");
    expect(html).toContain('class="px-2 text-right text-gold"');
    expect(html).toContain('class="px-2 text-right text-text"');
    expect(html).not.toContain("map-20");
    expect(html.toLowerCase()).not.toContain("average");
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

  it("labels current FACEIT ELO and links the latest 20 Mixer Rating points", () => {
    const trend = Array.from({ length: 22 }, (_, index) => ({
      id: `match-${index}`,
      at: new Date(
        Date.parse("2026-10-06T20:00:00.000Z") - index * 86_400_000,
      ).toISOString(),
      mixId: `mix-${index}`,
      map: "de_mirage",
      scoreA: 13,
      scoreB: 8,
      faceitRoomUrl: null,
      rating: 1 + index / 100,
    }));
    const data = {
      player: {
        steamId: "76561197960551471",
        name: "Player",
        avatarUrl: null,
      },
      faceit: {
        level: 9,
        elo: 1600,
        nickname: "player",
        profileUrl: "https://www.faceit.com/en/players/player",
      },
      summary: {
        mapCount: 22,
        winRate: 0.5,
        wins: 11,
        losses: 11,
        draws: 0,
        rating: 1.1,
        ratedMaps: 22,
        kills: 0,
        deaths: 0,
        assists: 0,
        adr: null,
        trend,
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
    expect(html).toContain("Current FACEIT ELO");
    expect(html).toContain("20 of 22 rated maps");
    expect(html.match(/<circle/g)).toHaveLength(20);
    expect(html).toContain('href="/g/crew/m/mix-0"');
    expect(html).not.toContain('href="/g/crew/m/mix-20"');
    expect(html).toContain("de_mirage · 13:8 · Mixer Rating 1.00");
  });

  it("shows FACEIT ADR and room links on mix maps only when those fields exist", () => {
    const map = {
      matchId: "match-1",
      mixId: "mix-1",
      mixTitle: "Friday mix",
      mapNumber: 1,
      mapName: "de_inferno",
      playedAt: "2026-10-01T20:00:00.000Z",
      scoreA: 13,
      scoreB: 6,
      team: "A" as const,
      faceitRoomUrl: "https://www.faceit.com/en/cs2/room/1-room",
      outcome: "win" as const,
      teammates: [],
      stats: {
        kills: 21,
        deaths: 8,
        assists: 5,
        adr: 98.4,
        rounds: 19,
        rating: 1.2,
      },
    };
    const profile = {
      player: {
        steamId: "76561197960551471",
        name: "Player",
        avatarUrl: null,
      },
      faceit: null,
      summary: {
        mapCount: 1,
        winRate: 1,
        wins: 1,
        losses: 0,
        draws: 0,
        rating: 1.2,
        ratedMaps: 1,
        kills: 21,
        deaths: 8,
        assists: 5,
        adr: 98.4,
        trend: [],
        maps: [map],
        bestTeammates: [],
      },
    } as unknown as Parameters<typeof PlayerProfileView>[0]["data"];
    const html = render(
      createElement(PlayerProfileView, {
        groupSlug: "crew",
        groupName: "Crew",
        data: profile,
      }),
    );
    expect(html).toContain('href="https://www.faceit.com/en/cs2/room/1-room"');
    expect(html).toContain("Open FACEIT room");
    expect(html).toContain(">98</td>");

    const withoutExternalData = render(
      createElement(PlayerProfileView, {
        groupSlug: "crew",
        groupName: "Crew",
        data: {
          ...profile,
          summary: {
            ...profile.summary,
            maps: [
              {
                ...map,
                faceitRoomUrl: null,
                stats: { ...map.stats, adr: null },
              },
            ],
          },
        },
      }),
    );
    expect(withoutExternalData).not.toContain("Open FACEIT room");
    expect(withoutExternalData).not.toContain(">98</td>");
  });
});
