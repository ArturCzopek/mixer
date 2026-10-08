"use client";

import * as React from "react";
import { Well } from "@/components/vgui";
import { useT } from "@/components/i18n";
import type { DemoStoredData } from "@/lib/demo/payload";
import { cn } from "@/lib/utils";

type DemoRound = DemoStoredData["rounds"][number] & {
  sideByTeam?: Record<string, 2 | 3>;
};

export type DemoRoundSection = {
  phase: DemoRound["phase"];
  rounds: DemoRound[];
  sideSignature: string | null;
};

export function groupDemoRounds(rounds: DemoRound[]): DemoRoundSection[] {
  const sections: DemoRoundSection[] = [];
  for (const round of rounds) {
    const sideSignature = round.sideByTeam
      ? Object.entries(round.sideByTeam)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([team, side]) => `${team}:${side}`)
          .join("|")
      : null;
    const current = sections.at(-1);
    const sideChanged =
      current?.sideSignature &&
      sideSignature &&
      current.sideSignature !== sideSignature;
    if (!current || current.phase !== round.phase || sideChanged) {
      sections.push({
        phase: round.phase,
        rounds: [round],
        sideSignature,
      });
    } else {
      current.rounds.push(round);
      current.sideSignature ??= sideSignature;
    }
  }
  return sections;
}

export function scoreThroughRound(rounds: DemoRound[], roundNumber: number) {
  return rounds.reduce(
    (score, round) => {
      if (round.number <= roundNumber && round.winnerTeamId === "A") score.a++;
      if (round.number <= roundNumber && round.winnerTeamId === "B") score.b++;
      return score;
    },
    { a: 0, b: 0 },
  );
}

function sectionTitle(
  section: DemoRoundSection,
  samePhase: DemoRoundSection[],
  index: number,
  t: ReturnType<typeof useT>,
) {
  const phase =
    section.phase === "regulation"
      ? t.demo.details.regulation
      : section.phase === "overtime"
        ? t.demo.details.overtime
        : t.demo.details.roundsTitle;
  if (samePhase.length === 1) return phase;

  const observedSideChange =
    samePhase.length === 2 &&
    samePhase[0].sideSignature !== null &&
    samePhase[1].sideSignature !== null &&
    samePhase[0].sideSignature !== samePhase[1].sideSignature;
  if (observedSideChange && section.phase === "regulation")
    return `${phase} · ${index === 0 ? t.demo.details.firstHalf : t.demo.details.secondHalf}`;
  return `${phase} · ${t.demo.details.segment(index + 1)}`;
}

export function DemoRoundStrip({
  rounds,
  playerName,
}: {
  rounds: DemoRound[];
  playerName: (steamId: string) => string;
}) {
  const t = useT();
  const id = React.useId();
  const [selectedNumber, setSelectedNumber] = React.useState<number | null>(
    null,
  );
  if (!rounds.length) return null;

  const sections = groupDemoRounds(rounds);
  const selected =
    rounds.find((round) => round.number === selectedNumber) ?? rounds[0];
  const selectedSection = sections.find((section) =>
    section.rounds.includes(selected),
  )!;
  const samePhase = sections.filter(
    (section) => section.phase === selectedSection.phase,
  );
  const selectedSectionTitle = sectionTitle(
    selectedSection,
    samePhase,
    samePhase.indexOf(selectedSection),
    t,
  );
  const score = scoreThroughRound(rounds, selected.number);
  const detailId = `${id}-selected-round`;

  return (
    <section className="mt-2" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="text-dim mb-1 text-[11px]">
        {t.demo.details.roundsTitle}
      </h3>
      <Well className="p-1.5">
        <div className="space-y-2">
          {sections.map((section) => {
            const phaseSections = sections.filter(
              (item) => item.phase === section.phase,
            );
            const title = sectionTitle(
              section,
              phaseSections,
              phaseSections.indexOf(section),
              t,
            );
            const first = section.rounds[0].number;
            const last = section.rounds.at(-1)!.number;
            return (
              <div key={`${section.phase ?? "unknown"}-${first}`}>
                <h4 className="text-text mb-1 flex flex-wrap items-baseline justify-between gap-x-2 px-1 text-[11px] font-bold">
                  <span>{title}</span>
                  <span className="text-dim font-normal">
                    {t.demo.details.roundRange(first, last)}
                  </span>
                </h4>
                <ol className="bg-row grid grid-cols-6 gap-px p-px sm:grid-cols-12">
                  {section.rounds.map((round) => {
                    const isSelected = selected.number === round.number;
                    return (
                      <li key={round.number}>
                        <button
                          type="button"
                          aria-pressed={isSelected}
                          aria-controls={detailId}
                          aria-label={`${t.demo.details.round(round.number)} · ${t.played.teamWon(round.winnerTeamId)}`}
                          onClick={() => setSelectedNumber(round.number)}
                          className={cn(
                            "bg-well hover:bg-hover focus-visible:outline-gold flex h-11 w-full min-w-0 flex-col items-center justify-center text-[11px] focus-visible:outline-1 focus-visible:outline-offset-[-2px] focus-visible:outline-dotted",
                            isSelected &&
                              "bg-gold-deep hover:bg-gold-deep text-white",
                          )}
                        >
                          <span className="font-bold tabular-nums">
                            {round.number}
                          </span>
                          <span
                            className={cn(
                              "text-[10px] font-bold",
                              isSelected ? "text-white" : "text-gold",
                            )}
                          >
                            {round.winnerTeamId}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            );
          })}
        </div>
      </Well>

      <Well
        id={detailId}
        className="border-lo mt-1 border p-2 text-[11px]"
        aria-live="polite"
      >
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
          <div>
            <h4 className="font-bold">
              {t.demo.details.round(selected.number)} ·{" "}
              {t.played.teamWon(selected.winnerTeamId)}
            </h4>
            <p className="text-dim">{selectedSectionTitle}</p>
          </div>
          <b
            className="text-text tabular-nums"
            aria-label={`${t.lists.team("A")} ${score.a}, ${t.lists.team("B")} ${score.b}`}
          >
            <span className="text-dim">A </span>
            <span className="text-gold">{score.a}</span>
            <span className="text-dim"> : </span>
            <span className="text-gold">{score.b}</span>
            <span className="text-dim"> B</span>
          </b>
        </div>
        <div className="space-y-1.5">
          {selected.opening && (
            <div>
              <h5 className="text-dim font-bold">{t.demo.details.opening}</h5>
              <p>
                {t.demo.details.openingEvent(
                  playerName(selected.opening.killer),
                  playerName(selected.opening.victim),
                )}
              </p>
            </div>
          )}
          {!!selected.clutches.length && (
            <div>
              <h5 className="text-dim font-bold">{t.demo.details.clutch}</h5>
              <ul className="space-y-0.5">
                {selected.clutches.map((clutch, index) => (
                  <li key={index}>
                    {t.demo.details.clutchEvent(
                      playerName(clutch.steamid),
                      clutch.opponents,
                      clutch.won,
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!!selected.multikills.length && (
            <div>
              <h5 className="text-dim font-bold">
                {t.demo.details.multikills}
              </h5>
              <ul className="space-y-0.5">
                {selected.multikills.map((multikill, index) => (
                  <li key={index}>
                    {t.demo.details.multikillEvent(
                      playerName(multikill.steamid),
                      multikill.kills,
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!selected.opening &&
            !selected.clutches.length &&
            !selected.multikills.length && (
              <p className="text-dim">{t.demo.details.none}</p>
            )}
        </div>
      </Well>
    </section>
  );
}
