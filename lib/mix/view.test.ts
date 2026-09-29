import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/components/i18n";
import { MixView } from "@/components/mix/mix-view";
import { showcaseViewData } from "@/lib/showcase/evening";
import { DICTS, type Lang } from "@/lib/i18n/dict";
import { mapResultSummary, type MixViewData } from "./view";

vi.mock("@/lib/external/leetify", () => ({
  getFaceitMatches: vi.fn().mockResolvedValue(null),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
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

  it("renders five map tabs, illustrative previews, and archive provenance", () => {
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
    expect(html.match(/Illustrative map sketch/g)).toHaveLength(5);
    expect(html).toContain(DICTS.en.played.archiveNote("popflash"));
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
