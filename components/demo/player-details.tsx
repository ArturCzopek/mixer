"use client";

import { useT } from "@/components/i18n";
import type { DemoPlayerStats } from "@/lib/demo/stats";

export function DemoPlayerDetails({
  stats,
  playerName,
}: {
  stats: DemoPlayerStats;
  playerName: string;
}) {
  const t = useT();
  const attempts = Object.values(stats.clutchAttempts).reduce(
    (sum, count) => sum + count,
    0,
  );
  const wins = Object.values(stats.clutchWins).reduce(
    (sum, count) => sum + count,
    0,
  );
  const multis = ([2, 3, 4, 5] as const)
    .map((count) => stats.multikills[count])
    .join(" / ");
  const sections = [
    {
      title: t.demo.details.combat,
      items: [
        [
          t.demo.details.headshots,
          `${stats.headshotKills} · ${stats.headshotPercent.toFixed(1)}%`,
        ],
        [
          t.demo.details.openings,
          `${stats.openingKills} / ${stats.openingDeaths}`,
        ],
        [t.demo.details.trades, `${stats.tradeKills} / ${stats.tradedDeaths}`],
      ],
    },
    {
      title: t.demo.details.clutchesAndMultikills,
      items: [
        [t.demo.details.clutches, `${wins} / ${attempts}`],
        [t.demo.details.multikills, multis],
      ],
    },
    {
      title: t.demo.details.utility,
      items: [
        [t.demo.details.utilityDamage, stats.utilityDamage.toFixed(0)],
        [t.demo.details.enemiesFlashed, stats.enemiesFlashed],
        [t.demo.details.teammatesFlashed, stats.teammatesFlashed],
        [t.demo.details.flashAssists, stats.flashAssists],
      ],
    },
  ] as const;

  return (
    <div role="group" aria-label={`${playerName} · ${t.demo.details.player}`}>
      {sections.map((section) => (
        <section
          key={section.title}
          className="border-row first:border-t-0 first:pt-0 [&+section]:mt-2 [&+section]:border-t [&+section]:pt-1"
        >
          <h4 className="text-text mb-0.5 font-bold">{section.title}</h4>
          <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5">
            {section.items.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-dim leading-snug">{label}</dt>
                <dd className="text-text text-right tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
