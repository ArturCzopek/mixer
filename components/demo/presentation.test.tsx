import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "@/components/i18n";
import type { DemoPlayerStats } from "@/lib/demo/stats";
import { DICTS } from "@/lib/i18n/dict";
import { DemoPlayerDetails } from "./player-details";
import { groupDemoRounds, scoreThroughRound } from "./round-strip";
import type { DemoStoredData } from "@/lib/demo/payload";

type DemoRound = DemoStoredData["rounds"][number] & {
  sideByTeam?: Record<string, 2 | 3>;
};

function round(
  number: number,
  phase: DemoRound["phase"],
  winnerTeamId: string,
  sideByTeam?: Record<string, 2 | 3>,
): DemoRound {
  return {
    number,
    startTick: number * 100,
    endTick: number * 100 + 80,
    winnerTeamId,
    phase,
    opening: null,
    clutches: [],
    multikills: [],
    ...(sideByTeam ? { sideByTeam } : {}),
  };
}

describe("demo presentation round grouping", () => {
  it("splits phases at observed side changes and scores through the selected round", () => {
    const firstHalf = { A: 2, B: 3 } as const;
    const secondHalf = { A: 3, B: 2 } as const;
    const rounds = [
      round(1, "regulation", "A", firstHalf),
      round(2, "regulation", "B", firstHalf),
      round(3, "regulation", "A", firstHalf),
      round(4, "regulation", "B", secondHalf),
      round(5, "regulation", "A", secondHalf),
      round(6, "overtime", "B", secondHalf),
      round(7, "overtime", "A", secondHalf),
      round(8, "overtime", "B", firstHalf),
      round(9, "overtime", "A", firstHalf),
    ];

    expect(
      groupDemoRounds(rounds).map((section) => [
        section.phase,
        section.rounds.map((item) => item.number),
      ]),
    ).toEqual([
      ["regulation", [1, 2, 3]],
      ["regulation", [4, 5]],
      ["overtime", [6, 7]],
      ["overtime", [8, 9]],
    ]);
    expect(scoreThroughRound(rounds, 8)).toEqual({ a: 4, b: 4 });
  });

  it("keeps older metadata in one regulation and one overtime section", () => {
    const rounds = [
      round(1, "regulation", "A"),
      round(2, "regulation", "B"),
      round(3, "overtime", "A"),
      round(4, "overtime", "B"),
    ];

    expect(
      groupDemoRounds(rounds).map((section) => section.rounds.length),
    ).toEqual([2, 2]);
    expect(scoreThroughRound(rounds, 3)).toEqual({ a: 2, b: 1 });
  });
});

describe("demo player detail copy", () => {
  it.each(["en", "pl"] as const)(
    "uses localized labels and ordered values in %s",
    (lang) => {
      const stats = {
        headshotKills: 11,
        headshotPercent: 47.8,
        openingKills: 2,
        openingDeaths: 1,
        tradeKills: 4,
        tradedDeaths: 2,
        clutchWins: { 1: 0, 2: 0, 3: 0 },
        clutchAttempts: { 1: 0, 2: 1, 3: 2 },
        multikills: { 2: 3, 3: 1, 4: 0, 5: 0 },
        utilityDamage: 473,
        enemiesFlashed: 7,
        teammatesFlashed: 2,
        flashAssists: 0,
      } as unknown as DemoPlayerStats;
      const markup = renderToStaticMarkup(
        I18nProvider({
          lang,
          children: createElement(DemoPlayerDetails, {
            stats,
            playerName: "Player",
          }),
        }),
      );

      expect(markup).toContain(DICTS[lang].demo.details.combat);
      expect(markup).toContain(DICTS[lang].demo.details.openings);
      expect(markup).toContain("2 / 1");
      expect(markup).toContain(DICTS[lang].demo.details.clutches);
      expect(markup).toContain("0 / 3");
      if (lang === "pl")
        expect(markup).not.toMatch(
          /\bkills?\b|\bdeaths?\b|\bwins?\b|\battempts?\b/i,
        );
    },
  );
});
