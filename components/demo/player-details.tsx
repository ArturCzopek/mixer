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
  const items = [
    [
      t.demo.details.headshots,
      `${stats.headshotKills} · ${stats.headshotPercent.toFixed(1)}%`,
    ],
    [t.demo.details.openings, `${stats.openingKills} · ${stats.openingDeaths}`],
    [t.demo.details.trades, `${stats.tradeKills} · ${stats.tradedDeaths}`],
    [t.demo.details.clutches, `${wins} · ${attempts}`],
    [t.demo.details.multikills, multis],
    [t.demo.details.utilityDamage, stats.utilityDamage.toFixed(0)],
    [t.demo.details.enemiesFlashed, stats.enemiesFlashed],
    [t.demo.details.teammatesFlashed, stats.teammatesFlashed],
    [t.demo.details.flashAssists, stats.flashAssists],
  ] as const;

  return (
    <div role="group" aria-label={`${playerName} · ${t.demo.details.player}`}>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
        {items.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-dim leading-snug">{label}</dt>
            <dd className="text-text truncate tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
