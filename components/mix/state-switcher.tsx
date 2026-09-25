import Link from "next/link";
import type { MixState } from "@/components/mix/mix-view";
import { cn } from "@/lib/utils";

export const MIX_STATES: MixState[] = ["lobby", "voting", "locked", "played"];

export function parseMixState(value: unknown, fallback: MixState): MixState {
  return MIX_STATES.includes(value as MixState)
    ? (value as MixState)
    : fallback;
}

/** Thin strip above the page to flip between the mix states of a preview. */
export function StateSwitcher({
  label,
  current,
  names,
}: {
  label: string;
  current: MixState;
  names?: Partial<Record<MixState, string>>;
}) {
  return (
    <div className="bg-lo text-dim flex items-center justify-center gap-1 px-2 py-1 text-[11px]">
      {label}
      {MIX_STATES.map((s) => (
        <Link
          key={s}
          href={`?state=${s}`}
          className={cn(
            "px-1.5 py-0.5 no-underline",
            s === current ? "bg-window text-gold" : "text-dim hover:text-text",
          )}
        >
          {names?.[s] ?? s}
        </Link>
      ))}
    </div>
  );
}
