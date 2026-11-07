"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Ids that tie a Tabs row to its Sheet (`aria-controls` / `aria-labelledby`). */
export const tabIds = (base: string, value: string | number) => ({
  tab: `${base}-tab-${value}`,
  panel: `${base}-panel`,
});

/**
 * Property-sheet tabs with the WAI-ARIA tabs pattern: one tab in the tab order (roving
 * tabindex), arrow keys / Home / End move and select, instant switch.
 */
export function Tabs<T extends string | number>({
  items,
  value,
  onChange,
  label,
  idBase,
}: {
  items: { value: T; label: React.ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  /** Pass the same base to the panel via `tabIds` to link tab and panel. */
  idBase?: string;
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const move = (index: number) => {
    const next = (index + items.length) % items.length;
    onChange(items[next].value);
    refs.current[next]?.focus();
  };
  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const key = event.key;
    if (key === "ArrowRight") move(index + 1);
    else if (key === "ArrowLeft") move(index - 1);
    else if (key === "Home") move(0);
    else if (key === "End") move(items.length - 1);
    else return;
    event.preventDefault();
  };
  return (
    <div role="tablist" aria-label={label} className="flex gap-0.5">
      {items.map((item, index) => {
        const on = item.value === value;
        const ids = idBase ? tabIds(idBase, item.value) : null;
        return (
          <button
            key={item.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            id={ids?.tab}
            aria-controls={ids?.panel}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "bevel relative top-px min-w-0 flex-1 truncate border-b-0 px-1 whitespace-nowrap",
              on
                ? "bg-sheet text-text z-10 pt-2.5 pb-2 font-bold"
                : "bg-window text-dim hover:bg-hover hover:text-text pt-2 pb-1.5",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
