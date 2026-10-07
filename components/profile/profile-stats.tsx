"use client";

import { useT } from "@/components/i18n";
import { Well } from "@/components/vgui";
import type { profileSummary } from "@/lib/profile/summary";

export function ProfileStats({
  items,
}: {
  items: { label: string; value: string | number }[];
}) {
  return (
    <Well className="mb-2 grid grid-cols-2 gap-x-3 gap-y-2 p-3 text-xs sm:grid-cols-3">
      {items.map(({ label, value }) => (
        <div key={label} className="min-w-0">
          <span className="text-dim block">{label}</span>
          <b className="text-gold text-lg tabular-nums">{value}</b>
        </div>
      ))}
    </Well>
  );
}

export function MixProfileStats({
  summary,
  ratings,
}: {
  summary: ReturnType<typeof profileSummary>;
  ratings: number[];
}) {
  const t = useT();
  const finite = ratings.filter(Number.isFinite);
  const average = finite.length
    ? finite.reduce((sum, value) => sum + value, 0) / finite.length
    : null;
  return (
    <ProfileStats
      items={[
        { label: t.profile.maps, value: summary.mapCount },
        {
          label: t.profile.record,
          value: `${summary.wins} / ${summary.losses} / ${summary.draws}`,
        },
        {
          label: t.profile.winRate,
          value:
            summary.winRate === null
              ? "—"
              : `${Math.round(summary.winRate * 100)}%`,
        },
        { label: t.profile.rating, value: summary.rating?.toFixed(2) ?? "—" },
        {
          label: t.profile.ratingTrendAverage(finite.length),
          value: average?.toFixed(2) ?? "—",
        },
        { label: t.profile.adr, value: summary.adr?.toFixed(1) ?? "—" },
        {
          label: t.profile.kda,
          value: summary.ratedMaps
            ? `${summary.kills} / ${summary.deaths} / ${summary.assists}`
            : "—",
        },
        {
          label: t.profile.ratedMaps,
          value: `${summary.ratedMaps} / ${summary.mapCount}`,
        },
      ]}
    />
  );
}
