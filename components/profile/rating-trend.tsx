import Link from "next/link";

export type RatingTrendPoint = {
  id: string;
  rating: number;
  title: string;
  href?: string;
};

export function RatingTrend({
  points,
  label,
  referenceValue = 1,
}: {
  points: RatingTrendPoint[];
  label: string;
  referenceValue?: number;
}) {
  if (!points.length) return null;

  const values = points.map((point) => point.rating);
  const referenceRange = Math.max(0.1, Math.abs(referenceValue) * 0.2);
  const low = Math.min(...values, referenceValue - referenceRange) - 0.08;
  const high = Math.max(...values, referenceValue + referenceRange) + 0.08;
  const x = (index: number) =>
    points.length === 1 ? 300 : 26 + (index * 548) / (points.length - 1);
  const y = (value: number) => 132 - ((value - low) / (high - low)) * 116;
  const path = points
    .map(
      (point, index) =>
        `${index ? "L" : "M"}${x(index).toFixed(1)},${y(point.rating).toFixed(1)}`,
    )
    .join(" ");

  return (
    <svg
      viewBox="0 0 600 150"
      role="img"
      aria-label={label}
      className="h-36 w-full"
      preserveAspectRatio="none"
    >
      <line
        x1="26"
        x2="574"
        y1={y(referenceValue)}
        y2={y(referenceValue)}
        stroke="currentColor"
        className="text-dim"
        strokeDasharray="3 5"
        opacity="0.55"
      />
      <path d={path} fill="none" stroke="var(--color-gold)" strokeWidth="2.5" />
      {points.map((point, index) => {
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
  );
}
