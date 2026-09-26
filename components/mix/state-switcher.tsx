"use client";

import * as React from "react";
import { MixView, type MixState } from "@/components/mix/mix-view";
import type { MixViewData } from "@/lib/mix/view";
import { cn } from "@/lib/utils";

const MIX_STATES: MixState[] = ["lobby", "voting", "locked", "played"];

/**
 * Mix page of a preview with a thin strip above it to flip between the mix states. Switching is
 * client-side (the URL follows via `history.replaceState`), so the server data (live Leetify) is
 * fetched once per page load, not once per click.
 */
export function SwitchableMix({
  initial,
  fallback,
  data,
  label,
  names,
}: {
  initial: unknown;
  fallback: MixState;
  data: MixViewData;
  label: string;
  names?: Partial<Record<MixState, string>>;
}) {
  const [current, setCurrent] = React.useState<MixState>(
    MIX_STATES.includes(initial as MixState) ? (initial as MixState) : fallback,
  );
  const pick = (s: MixState) => {
    setCurrent(s);
    window.history.replaceState(null, "", `?state=${s}`);
  };
  return (
    <>
      <div className="bg-lo text-dim flex items-center justify-center gap-1 px-2 py-1 text-[11px]">
        {label}
        {MIX_STATES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => pick(s)}
            className={cn(
              "cursor-pointer px-1.5 py-0.5",
              s === current
                ? "bg-window text-gold"
                : "text-dim hover:text-text",
            )}
          >
            {names?.[s] ?? s}
          </button>
        ))}
      </div>
      <MixView key={current} state={current} data={data} />
    </>
  );
}
