import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/components/i18n";
import { RatingTrend, type RatingTrendPoint } from "./rating-trend";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

function render(
  points: RatingTrendPoint[],
  referenceValue = 1,
  lang: "en" | "pl" = "en",
) {
  return renderToStaticMarkup(
    <I18nProvider lang={lang}>
      <RatingTrend
        points={points}
        label="Rating over time"
        referenceValue={referenceValue}
      />
    </I18nProvider>,
  );
}

describe("RatingTrend", () => {
  it("labels values and dates with focusable, non-navigating points", () => {
    const html = render([
      {
        id: "old",
        rating: 0.72,
        title: "04 Oct 2026 · de_mirage · 13:8 · Mixer Rating 0.72",
        dateLabel: "04 Oct 2026",
      },
      {
        id: "new",
        rating: 1.31,
        title: "06 Oct 2026 · de_inferno · 13:11 · Mixer Rating 1.31",
        dateLabel: "06 Oct 2026",
      },
    ]);

    expect(html).toContain("Min 0.72");
    expect(html).toContain("Reference 1.00");
    expect(html).toContain("Max 1.31");
    expect(html).toContain("04 Oct 2026");
    expect(html).toContain("06 Oct 2026");
    expect(html).not.toContain("href=");
    expect(html.match(/tabindex="0"/g)).toHaveLength(2);
    expect(html).not.toContain("<title>");
    expect(html).toContain("de_mirage · 13:8 · Mixer Rating 0.72");
    expect(html).toContain("de_inferno · 13:11 · Mixer Rating 1.31");
    expect(html).toContain('stroke-dasharray="4 4"');
    expect(html).not.toContain("average");
  });

  it("uses zero as the Leetify reference and preserves signed raw ratings", () => {
    const html = render(
      [
        {
          id: "negative",
          rating: -1.2,
          title: "Leetify Rating −1.20",
        },
        {
          id: "positive",
          rating: 0.45,
          title: "Leetify Rating +0.45",
        },
      ],
      0,
      "pl",
    );

    expect(html).toContain("Min -1,20");
    expect(html).toContain("Odniesienie 0,00");
    expect(html).toContain("Maks. 0,45");
    expect(html).toContain("Leetify Rating −1.20");
    expect(html).toContain("Leetify Rating +0.45");
    expect(html).not.toContain("NaN");
  });

  it("renders a single extreme negative point without an invalid scale or repeated date", () => {
    const html = render(
      [
        {
          id: "only",
          rating: -Number.MAX_VALUE,
          title: "Extreme rating",
          dateLabel: "06 Oct 2026",
        },
        {
          id: "invalid",
          rating: Number.NaN,
          title: "Invalid rating",
        },
      ],
      0,
    );

    expect(html.match(/<circle/g)).toHaveLength(1);
    expect(html.match(/06 Oct 2026/g)).toHaveLength(1);
    expect(html).toContain("Reference 0.00");
    expect(html).toContain("-179,769,313,486,231,570");
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("Infinity");
  });

  it("renders nothing when there are no finite ratings", () => {
    expect(
      render([{ id: "invalid", rating: Number.NaN, title: "Invalid" }]),
    ).toBe("");
  });
});
