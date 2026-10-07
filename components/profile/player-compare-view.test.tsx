import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/components/i18n";
import { PlayerCompareView } from "@/components/profile/player-compare-view";
import { headToHead } from "@/lib/profile/head-to-head";
import { profileSummary, type ProfileMap } from "@/lib/profile/summary";
import type { groupPlayerProfile } from "@/lib/profile/queries";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

type Profile = NonNullable<Awaited<ReturnType<typeof groupPlayerProfile>>>;
const members = [
  { steamId: "76561197960551471", name: "Avery" },
  { steamId: "76561198000000002", name: "Blake" },
];

function map({
  matchId,
  team,
  scoreA,
  scoreB,
  mapName,
}: {
  matchId: string;
  team: "A" | "B";
  scoreA: number;
  scoreB: number;
  mapName: string;
}): ProfileMap {
  return {
    matchId,
    mixId: "mix-1",
    mixTitle: "Friday mix",
    mapNumber: 1,
    mapName,
    playedAt: "2026-10-01T20:00:00.000Z",
    scoreA,
    scoreB,
    team,
    stats: {
      kills: 20,
      deaths: 12,
      assists: 5,
      adr: 87.2,
      rounds: 20,
      rating: 1.12,
    },
    teammates: [],
  };
}

const mapsA = [
  map({
    matchId: "match-against",
    team: "A",
    scoreA: 13,
    scoreB: 7,
    mapName: "de_mirage",
  }),
  map({
    matchId: "match-together",
    team: "A",
    scoreA: 10,
    scoreB: 13,
    mapName: "de_inferno",
  }),
];
const mapsB = [
  map({
    matchId: "match-against",
    team: "B",
    scoreA: 13,
    scoreB: 7,
    mapName: "de_mirage",
  }),
  map({
    matchId: "match-together",
    team: "A",
    scoreA: 10,
    scoreB: 13,
    mapName: "de_inferno",
  }),
];

function profile(steamId: string, name: string, maps: ProfileMap[]): Profile {
  return {
    player: { steamId, name, avatarUrl: null },
    faceit: null,
    summary: profileSummary(maps),
  };
}

const profiles: [Profile, Profile] = [
  profile(members[0].steamId, "Avery", mapsA),
  profile(members[1].steamId, "Blake", mapsB),
];
const shared = headToHead(mapsA, mapsB);

function render(props: Partial<Parameters<typeof PlayerCompareView>[0]> = {}) {
  return renderToStaticMarkup(
    <I18nProvider lang="en">
      {createElement(PlayerCompareView, {
        groupSlug: "crew",
        groupName: "Crew",
        members,
        selectedA: "",
        selectedB: "",
        source: "mix",
        profiles: [null, null],
        headToHead: headToHead([], []),
        ...props,
      })}
    </I18nProvider>,
  );
}

describe("PlayerCompareView", () => {
  it("starts with two unselected member choices and keeps source in the GET form", () => {
    const html = render();
    expect(html).toContain('method="get"');
    expect(html).toContain('name="a"');
    expect(html).toContain('name="b"');
    expect(html).toContain('name="source"');
    expect(html).toContain("Choose two group members to see their comparison.");
    expect(html).toContain(
      "Choose two group members to compare their mix or Leetify history.",
    );
    expect(html).not.toContain("Friday mix");
  });

  it("asks for distinct valid members before rendering results", () => {
    const same = render({
      selectedA: members[0].steamId,
      selectedB: members[0].steamId,
    });
    expect(same).toContain("Choose two different players.");
    expect(same).not.toContain("Mixer Rating");

    const invalid = render({
      selectedA: "not-a-member",
      selectedB: members[1].steamId,
    });
    expect(invalid).toContain("Choose two current members of this group.");
    expect(invalid).not.toContain("Friday mix");

    const invalidSame = render({
      selectedA: "not-a-member",
      selectedB: "not-a-member",
    });
    expect(invalidSame).toContain("Choose two current members of this group.");

    const shortRoster = render({ members: [members[0]] });
    expect(shortRoster).toContain("This group needs at least two members");
  });

  it("shows both Mix summaries, linked trends, and distinct shared-map outcomes", () => {
    const html = render({
      selectedA: members[0].steamId,
      selectedB: members[1].steamId,
      profiles,
      headToHead: shared,
    });
    expect(html).toContain("Avery");
    expect(html).toContain("Blake");
    expect(html).toContain("Wins / losses / draws");
    expect(html).toContain("20 / 12 / 5");
    expect(html).toContain("87.2");
    expect(html).toContain("Average Mixer Rating · 2 maps");
    expect(html).toContain(">1.12</b>");
    expect(html).toContain('href="/g/crew/m/mix-1?match=match-against"');
    expect(html).toContain(
      'href="/g/crew/m/mix-1?match=match-against">Friday mix</a>',
    );
    expect(html).toContain("01 Oct 2026 · de_mirage</span>");
    expect(html).not.toContain(">01 Oct 2026</a>");
    expect(html).not.toContain(">de_mirage</a>");
    expect(html).toContain("2");
    expect(html).toContain("1</b>");
    expect(html).toContain("Against each other");
    expect(html).toContain("On the same team");
    expect(html).toContain("de_mirage");
    expect(html).toContain("de_inferno");
    expect(html).toContain("Avery: Team A");
    expect(html).toContain("Blake: Team B");
    expect(html).toContain("<th>Score</th>");
    expect(html).not.toContain("Score A:B");
    expect(html).toContain('<span class="sr-only">Result</span>');
  });

  it("renders separate attributed Leetify panels for FACEIT and Premier", () => {
    for (const source of ["faceit", "premier"] as const) {
      const html = render({
        selectedA: members[0].steamId,
        selectedB: members[1].steamId,
        source,
        profiles,
        headToHead: shared,
      });
      expect(html).toContain("Loading Leetify data...");
      expect(html.match(/Data Provided by Leetify/g)).toHaveLength(2);
      expect(html).toContain("Against each other");
      expect(html).not.toContain("Wins / losses / draws");
    }
  });
});
