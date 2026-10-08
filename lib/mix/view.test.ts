import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/components/i18n";
import { MixView } from "@/components/mix/mix-view";
import { showcaseViewData } from "@/lib/showcase/evening";
import { DICTS, type Lang } from "@/lib/i18n/dict";
import {
  calculateDemoStats,
  summarizeDemoRounds,
  type DemoRound,
} from "@/lib/demo/stats";
import {
  mapResultSummary,
  totals,
  type MixViewData,
  type ViewLine,
} from "./view";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/discord/actions", () => ({ moveMixDiscordPlayers: vi.fn() }));
vi.mock("@/lib/demo/actions", () => ({ attachDemoToMatch: vi.fn() }));
vi.mock("@/lib/mix/actions", () => ({
  approveMixVariants: vi.fn(),
  castMixVote: vi.fn(),
  castProxyMixVote: vi.fn(),
  closeMixVoting: vi.fn(),
  generateMixVariants: vi.fn(),
  reopenMixVoting: vi.fn(),
  rerollMixVariants: vi.fn(),
  setMixStatus: vi.fn(),
  swapMixParticipant: vi.fn(),
  startMixMatch: vi.fn(),
}));

let data: MixViewData;
beforeAll(async () => {
  data = await showcaseViewData();
});

describe("multi-map results", () => {
  it.each(["en", "pl"] as const)(
    "shows demo details only for the selected map in %s",
    (lang) => {
      const player = data.players[0];
      const rounds: DemoRound[] = [
        {
          startTick: 0,
          endTick: 100,
          scoreEndTick: 101,
          winnerTeamId: "A",
          players: [
            {
              steamid: player.steamId,
              teamId: "A",
              side: 2,
              isAlive: true,
              health: 100,
            },
            {
              steamid: data.players[1].steamId,
              teamId: "B",
              side: 3,
              isAlive: true,
              health: 100,
            },
          ],
        },
      ];
      const stats = calculateDemoStats({ rounds, events: [], tickRate: 64 });
      const view: MixViewData = {
        ...data,
        result: {
          source: "demo",
          maps: [
            {
              map: "Mirage",
              a: 1,
              b: 0,
              statsOrigin: "demo",
              lines: [
                {
                  steamId: player.steamId,
                  team: "A",
                  k: 0,
                  a: 0,
                  d: 0,
                  rounds: 1,
                  adr: 0,
                  rating: 1,
                  kast: 100,
                  demo: stats[0],
                },
              ],
              demo: {
                version: 1,
                tickRate: 64,
                regulationRounds: 24,
                players: [
                  { steamid: player.steamId, name: player.name, teamId: "A" },
                ],
                rounds: summarizeDemoRounds({ rounds, events: [] }, 24),
                stats,
              },
            },
          ],
        },
      };
      const render = (initialPick: number) =>
        renderToStaticMarkup(
          I18nProvider({
            lang,
            children: createElement(MixView, {
              state: "played",
              data: view,
              initialPick,
            }),
          }),
        );
      const map = render(1);
      expect(map).toContain(DICTS[lang].demo.details.roundsTitle);
      expect(map).toContain(DICTS[lang].demo.details.utilityDamage);
      expect(map).toContain("100.0%");
      expect(render(0)).not.toContain(
        `aria-label="${DICTS[lang].demo.details.round(1)} ·`,
      );
      expect(render(0)).not.toContain(DICTS[lang].demo.details.utilityDamage);
    },
  );
  it("weights known KAST by rounds and leaves incomplete evening coverage empty", () => {
    const line: ViewLine = {
      team: "A",
      steamId: "p",
      k: 10,
      a: 2,
      d: 8,
      rounds: 20,
      adr: 80,
      rating: 1,
      kast: 80,
    };
    const first = { map: "Mirage", a: 13, b: 7, lines: [line] };
    const second = {
      map: "Nuke",
      a: 5,
      b: 5,
      lines: [{ ...line, rounds: 10, kast: 50 }],
    };
    expect(totals([first, second])[0]).toMatchObject({
      kast: 70,
      rounds: 30,
      demo: null,
    });
    expect(
      totals([first, { ...second, lines: [{ ...line, kast: undefined }] }])[0]
        .kast,
    ).toBeNull();
    expect(line.kast).toBe(80);
  });
  it("opens a requested map and falls back to the evening for an invalid pick", () => {
    const view: MixViewData = {
      ...data,
      showcase: undefined,
      result: {
        source: "manual",
        maps: [
          { map: "1. Mirage", a: 13, b: 8, lines: [] },
          { map: "2. Nuke", a: 7, b: 13, lines: [] },
        ],
      },
    };
    const render = (initialPick?: number) =>
      renderToStaticMarkup(
        I18nProvider({
          lang: "en",
          children: createElement(MixView, {
            state: "played",
            data: view,
            initialPick,
          }),
        }),
      );
    expect(render(2)).toMatch(
      /aria-selected="true"[^>]*>2\. Nuke · 7:13<\/button>/,
    );
    expect(render(2)).toContain("20 rounds");
    for (const html of [render(), render(99)]) {
      expect(html).toMatch(/aria-selected="true"[^>]*>All maps<\/button>/);
      expect(html).toContain("Evening result · 2 maps");
      expect(html).toContain("41 rounds");
    }
  });

  it("summarizes one and five score-only maps including a draw", () => {
    const one = [{ map: "Mirage", a: 13, b: 9, lines: [] }];
    expect(mapResultSummary(one)).toEqual({
      wonA: 1,
      wonB: 0,
      draws: 0,
      rounds: 22,
    });
    expect(
      mapResultSummary([
        ...one,
        { map: "Nuke", a: 10, b: 13, lines: [] },
        { map: "Anubis", a: 13, b: 13, lines: [] },
        { map: "Mirage", a: 16, b: 14, lines: [] },
        { map: "Ancient", a: 7, b: 13, lines: [] },
      ]),
    ).toEqual({ wonA: 2, wonB: 2, draws: 1, rounds: 121 });
  });

  it("renders five map tabs, scores, winner, and archive provenance", () => {
    const maps = [
      ...data.result.maps,
      { ...data.result.maps[0], map: "4. Mirage" },
      { ...data.result.maps[1], map: "5. Anubis" },
    ];
    const view: MixViewData = {
      ...data,
      showcase: undefined,
      archiveSource: "popflash",
      chosenVariantNumber: 1,
      result: { maps, source: "popflash" },
    };
    const html = renderToStaticMarkup(
      I18nProvider({
        lang: "en",
        children: createElement(MixView, { state: "played", data: view }),
      }),
    );
    expect(html.match(/role="tab"/g)).toHaveLength(6);
    expect(html).toContain("Team B won");
    expect(html).toContain("16:12");
    expect(html).toContain(DICTS.en.played.archiveNote("popflash"));
  });

  it("offers FACEIT enrichment only to an admin of a non-archived manual result", () => {
    const view: MixViewData = {
      ...data,
      showcase: undefined,
      archiveSource: null,
      viewerIsAdmin: true,
      chosenVariantNumber: 1,
      result: {
        maps: [{ map: "1. Mirage", a: 13, b: 7, lines: [] }],
        source: "manual",
      },
    };
    const render = (current: MixViewData) =>
      renderToStaticMarkup(
        I18nProvider({
          lang: "en",
          children: createElement(MixView, { state: "played", data: current }),
        }),
      );
    expect(render(view)).toContain(DICTS.en.admin.faceitEnrichHint);
    expect(render({ ...view, viewerIsAdmin: false })).not.toContain(
      DICTS.en.admin.faceitEnrichHint,
    );
    expect(render({ ...view, archiveSource: "popflash" })).not.toContain(
      DICTS.en.admin.faceitEnrichHint,
    );
  });
});

describe("approved variants (D37)", () => {
  it.each(["en", "pl"] as const)(
    "shows voting controls without re-roll in %s",
    (lang: Lang) => {
      for (const state of ["voting", "locked"] as const) {
        const html = renderToStaticMarkup(
          I18nProvider({
            lang,
            children: createElement(MixView, {
              state,
              data: { ...data, viewerIsAdmin: true },
            }),
          }),
        );
        expect(html).toContain(
          state === "voting"
            ? DICTS[lang].admin.close
            : DICTS[lang].admin.reopen,
        );
        expect(html).not.toMatch(/Re-roll|Losuj nowe warianty/);
      }
    },
  );
});

describe("mix page profile and score cues", () => {
  const render = (
    view: MixViewData,
    state: "voting" | "locked" | "played",
    groupSlug?: string,
  ) =>
    renderToStaticMarkup(
      I18nProvider({
        lang: "en",
        children: createElement(MixView, { state, data: view, groupSlug }),
      }),
    );

  it("labels the balance score separately from lineup ELO", () => {
    const html = render(data, "voting");
    expect(html).toContain("Balance score S");
    expect(html).toContain("ELO at lineup");
    expect(html).not.toContain("live from FACEIT");
  });

  it("links lineup names to their group Mixer profiles", () => {
    const html = render(data, "locked", "crew");
    const player = data.players[0];
    expect(html).toContain(`href="/g/crew/p/${player.steamId}"`);
    expect(html).toContain(`>${player.name}</a>`);
  });

  it("colors each map's winner gold and loser pale and shows available ADR", () => {
    const line = data.result.maps[0].lines[0];
    const view: MixViewData = {
      ...data,
      showcase: undefined,
      archiveSource: null,
      chosenVariantNumber: 1,
      result: {
        source: "faceit",
        maps: [
          { map: "de_mirage", a: 13, b: 8, lines: [line] },
          { map: "de_nuke", a: 7, b: 13, lines: [line] },
        ],
      },
    };
    const html = render(view, "played", "crew");
    expect(html).toMatch(
      /class="text-gold">13<\/span><span class="text-dim">:<\/span><span class="text-text">8/,
    );
    expect(html).toMatch(
      /class="text-text">7<\/span><span class="text-dim">:<\/span><span class="text-gold">13/,
    );
    expect(html).toContain(">ADR</span>");
    expect(html).toContain(line.adr.toFixed(0));
  });
});

describe("production voting view", () => {
  const render = (view: MixViewData, state: "voting" | "locked") =>
    renderToStaticMarkup(
      I18nProvider({
        lang: "en",
        children: createElement(MixView, { state, data: view }),
      }),
    );

  it("shows public votes and a vote button only to a participant", () => {
    const view: MixViewData = {
      ...data,
      showcase: undefined,
      viewerIsAdmin: false,
      viewerCanVote: true,
      variants: data.variants.map((variant, index) => ({
        ...variant,
        id: `00000000-0000-4000-8000-00000000000${index + 1}`,
        votes: 0,
        voters: [],
      })),
    };
    const participant = render(view, "voting");
    expect(participant).toContain(DICTS.en.tally.publicNotVoted);
    expect(participant).toContain(DICTS.en.actions.vote(1));
    expect(render({ ...view, viewerCanVote: false }, "voting")).not.toContain(
      DICTS.en.actions.vote(1),
    );
  });

  it("uses the stored winner for the locked lineup", () => {
    const view: MixViewData = {
      ...data,
      showcase: undefined,
      viewerIsAdmin: true,
      chosenVariantNumber: 3,
      votingTied: [2, 3],
      winningVotes: 4,
    };
    const html = render(view, "locked");
    expect(html).toContain(DICTS.en.locked.won(3));
    expect(html).toContain(DICTS.en.admin.reopen);
    expect(html).toContain(DICTS.en.admin.startMatch);
  });

  it("links the real group's FACEIT Club beside the chosen lineup", () => {
    const view: MixViewData = {
      ...data,
      showcase: undefined,
      viewerIsAdmin: false,
      faceitClubUrl: "https://www.faceit.com/en/club/test/parties",
    };
    const html = render(view, "locked");
    expect(html).toContain(
      'href="https://www.faceit.com/en/club/test/parties"',
    );
    expect(html).toContain("FACEIT Club and join its queue");
    expect(html).not.toContain(DICTS.en.admin.reopen);
    expect(render({ ...view, faceitClubUrl: null }, "locked")).toContain(
      DICTS.en.locked.noClub,
    );
  });
});

describe("advanced award values", () => {
  it.each(["en", "pl"] as const)(
    "renders percentages and observed counts in %s",
    (lang) => {
      const view: MixViewData = {
        ...data,
        result: {
          source: "faceit",
          maps: [{ map: "Mirage", a: 13, b: 7, lines: [] }],
          awards: [
            { key: "kamikaze", steamId: data.players[0].steamId, value: 0.2 },
            {
              key: "flashBangWhiff",
              steamId: data.players[0].steamId,
              value: 0.1,
            },
            {
              key: "scopeAddict",
              steamId: data.players[0].steamId,
              value: 0.5,
            },
            { key: "clutchOrKick", steamId: data.players[0].steamId, value: 3 },
            { key: "mvpHoarder", steamId: data.players[0].steamId, value: 4 },
          ],
        },
      };
      const html = renderToStaticMarkup(
        I18nProvider({
          lang,
          children: createElement(MixView, { state: "played", data: view }),
        }),
      );
      for (const [key, value] of [
        ["kamikaze", "20.0"],
        ["flashBangWhiff", "10.0"],
        ["scopeAddict", "50.0"],
        ["clutchOrKick", "3"],
        ["mvpHoarder", "4"],
      ] as const) {
        expect(html).toContain(DICTS[lang].played.awardLabels[key][0]);
        expect(html).toContain(
          value + " " + DICTS[lang].played.awardLabels[key][1],
        );
      }
    },
  );
});
