import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/components/i18n";
import { MixView } from "@/components/mix/mix-view";
import { showcaseViewData } from "@/lib/showcase/evening";
import { DICTS, type Lang } from "@/lib/i18n/dict";
import type { MixViewData } from "./view";

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
});
