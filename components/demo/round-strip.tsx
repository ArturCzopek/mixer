"use client";

import * as React from "react";
import { Well } from "@/components/vgui";
import { useT } from "@/components/i18n";
import type { DemoStoredData } from "@/lib/demo/payload";
import { cn } from "@/lib/utils";

type DemoRound = DemoStoredData["rounds"][number];

export function DemoRoundStrip({
  rounds,
  playerName,
}: {
  rounds: DemoRound[];
  playerName: (steamId: string) => string;
}) {
  const t = useT();
  const id = React.useId();
  const [expanded, setExpanded] = React.useState<number | null>(null);
  if (!rounds.length) return null;

  return (
    <section className="mt-2" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="text-dim mb-1 text-[11px]">
        {t.demo.details.roundsTitle}
      </h3>
      <Well className="overflow-x-auto p-0">
        <ol className="flex w-max min-w-full">
          {rounds.map((round) => {
            const open = expanded === round.number;
            const roundId = `${id}-round-${round.number}`;
            const winner = round.winnerTeamId;
            return (
              <li
                key={round.number}
                className="border-row border-r last:border-r-0"
              >
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={roundId}
                  aria-label={`${t.demo.details.round(round.number)}${round.phase ? ` · ${round.phase === "regulation" ? t.demo.details.regulation : t.demo.details.overtime}` : ""} · ${t.played.teamWon(winner)}`}
                  onClick={() => setExpanded(open ? null : round.number)}
                  className={cn(
                    "hover:bg-hover focus-visible:outline-gold flex min-h-12 w-[92px] flex-col items-start justify-center px-2 py-1 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px]",
                    open && "bg-gold-deep text-white",
                  )}
                >
                  <span className="flex w-full items-center justify-between gap-1 text-[11px] font-bold">
                    <span className="flex min-w-0 items-center gap-1">
                      <span>{t.demo.details.round(round.number)}</span>
                      {round.phase && (
                        <span className="text-dim text-[9px] font-normal">
                          {round.phase === "regulation"
                            ? t.demo.details.regulationShort
                            : t.demo.details.overtimeShort}
                        </span>
                      )}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "text-[10px]",
                      open ? "text-white" : "text-gold",
                    )}
                  >
                    {t.demo.details.winnerFor(winner)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </Well>
      {rounds.map((round) => {
        const open = expanded === round.number;
        const roundId = `${id}-round-${round.number}`;
        const events: React.ReactNode[] = [];
        if (round.opening) {
          events.push(
            <li key="opening">
              {t.demo.details.openingEvent(
                playerName(round.opening.killer),
                playerName(round.opening.victim),
              )}
            </li>,
          );
        }
        for (const [index, clutch] of round.clutches.entries()) {
          events.push(
            <li key={`clutch-${index}`}>
              {t.demo.details.clutchEvent(
                playerName(clutch.steamid),
                clutch.opponents,
                clutch.won,
              )}
            </li>,
          );
        }
        for (const [index, multikill] of round.multikills.entries()) {
          events.push(
            <li key={`multi-${index}`}>
              {t.demo.details.multikillEvent(
                playerName(multikill.steamid),
                multikill.kills,
              )}
            </li>,
          );
        }
        return (
          <Well
            key={round.number}
            id={roundId}
            hidden={!open}
            className="border-lo mt-1 border p-2 text-[11px]"
          >
            <div className="text-dim mb-1 flex flex-wrap gap-x-2 gap-y-0.5">
              {round.phase && (
                <span>
                  {round.phase === "regulation"
                    ? t.demo.details.regulation
                    : t.demo.details.overtime}
                </span>
              )}
              <span>{t.played.teamWon(round.winnerTeamId)}</span>
            </div>
            {events.length ? (
              <ul className="space-y-0.5">{events}</ul>
            ) : (
              <p className="text-dim">{t.demo.details.none}</p>
            )}
          </Well>
        );
      })}
    </section>
  );
}
