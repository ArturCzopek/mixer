"use client";

import Link from "next/link";
import { useLang, useT } from "@/components/i18n";

export type RatingTrendPoint = {
  id: string;
  rating: number;
  title: string;
  dateLabel?: string;
  href?: string;
};

const CHART_TOP = 10;
const CHART_BOTTOM = 150;

export function RatingTrend({
  points,
  label,
  referenceValue = 1,
}: {
  points: RatingTrendPoint[];
  label: string;
  referenceValue?: number;
}) {
  const t = useT();
  const lang = useLang();
  const finitePoints = points.filter((point) => Number.isFinite(point.rating));
  if (!finitePoints.length) return null;

  const reference = Number.isFinite(referenceValue) ? referenceValue : 1;
  const ratings = finitePoints.map((point) => point.rating);
  const minimum = Math.min(...ratings);
  const maximum = Math.max(...ratings);
  const scale = Math.max(1, Math.abs(reference), ...ratings.map(Math.abs));
  const scaledReference = reference / scale;
  const scaledMinimum = minimum / scale;
  const scaledMaximum = maximum / scale;
  const range =
    Math.max(scaledMaximum, scaledReference) -
    Math.min(scaledMinimum, scaledReference);
  const padding = Math.max(
    range * 0.08,
    Math.abs(scaledReference) * 0.2,
    0.2 / scale,
  );
  const low = Math.min(scaledMinimum, scaledReference) - padding;
  const high = Math.max(scaledMaximum, scaledReference) + padding;
  const x = (index: number) =>
    finitePoints.length === 1
      ? 300
      : 26 + (index * 548) / (finitePoints.length - 1);
  const y = (value: number) =>
    CHART_TOP +
    ((high - value / scale) / (high - low)) * (CHART_BOTTOM - CHART_TOP);
  const path = finitePoints
    .map(
      (point, index) =>
        `${index ? "L" : "M"}${x(index).toFixed(1)},${y(point.rating).toFixed(1)}`,
    )
    .join(" ");
  const formatRating = new Intl.NumberFormat(
    lang === "pl" ? "pl-PL" : "en-GB",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  ).format;
  const firstDate = finitePoints[0].dateLabel?.trim();
  const lastDate = finitePoints[finitePoints.length - 1].dateLabel?.trim();
  const ticks = [{ value: maximum, label: t.profile.ratingTrendMax }];
  if (Math.abs(y(maximum) - y(minimum)) >= 18)
    ticks.push({ value: minimum, label: t.profile.ratingTrendMin });
  if (ticks.every((tick) => Math.abs(y(tick.value) - y(reference)) >= 18))
    ticks.push({
      value: reference,
      label: t.profile.ratingTrendReference("").trim(),
    });

  return (
    <figure className="w-full" aria-label={label}>
      <figcaption className="text-dim mb-1 flex items-center gap-1 text-[11px] tabular-nums">
        <span
          aria-hidden="true"
          className="border-dim w-4 shrink-0 border-t border-dashed"
        />
        {t.profile.ratingTrendReference(formatRating(reference))}
      </figcaption>
      <div className="grid grid-cols-[3rem_minmax(0,1fr)] gap-1">
        <div className="text-dim relative h-40 text-[11px] tabular-nums">
          {ticks.map((tick) => (
            <span
              key={tick.label}
              aria-label={`${tick.label} ${formatRating(tick.value)}`}
              className="absolute right-0 max-w-full -translate-y-1/2 truncate"
              style={{ top: `${(y(tick.value) / 160) * 100}%` }}
            >
              {formatRating(tick.value)}
            </span>
          ))}
        </div>
        <svg
          viewBox="0 0 600 160"
          role="img"
          aria-label={label}
          className="h-40 w-full"
          preserveAspectRatio="none"
        >
          <line
            x1="26"
            x2="574"
            y1={y(maximum)}
            y2={y(maximum)}
            stroke="var(--color-row)"
          />
          <line
            x1="26"
            x2="574"
            y1={y(reference)}
            y2={y(reference)}
            stroke="currentColor"
            className="text-dim"
            strokeDasharray="4 4"
          />
          <line
            x1="26"
            x2="574"
            y1={y(minimum)}
            y2={y(minimum)}
            stroke="var(--color-row)"
          />
          <path
            d={path}
            fill="none"
            stroke="var(--color-gold)"
            strokeWidth="2.5"
          />
          {finitePoints.map((point, index) => {
            const marker = (
              <>
                <title>{point.title}</title>
                <circle
                  cx={x(index)}
                  cy={y(point.rating)}
                  r="5"
                  fill="var(--color-gold)"
                />
              </>
            );

            return point.href ? (
              <Link
                key={point.id}
                href={point.href}
                aria-label={point.title}
                className="focus-visible:outline-gold focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {marker}
              </Link>
            ) : (
              <g key={point.id}>{marker}</g>
            );
          })}
        </svg>
      </div>
      {(firstDate || lastDate) && (
        <div className="text-dim mt-1 ml-13 flex justify-between gap-2 text-[11px]">
          <span className="min-w-0 truncate">{firstDate}</span>
          {finitePoints.length > 1 && (
            <span className="min-w-0 truncate text-right">{lastDate}</span>
          )}
        </div>
      )}
    </figure>
  );
}
