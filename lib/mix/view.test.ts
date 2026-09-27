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
