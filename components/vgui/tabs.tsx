"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Tabs<T extends string | number>({
  items,
  value,
  onChange,
  label,
}: {
  items: { value: T; label: React.ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-0.5 px-1">
      {items.map((item) => {
        const on = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(item.value)}
            className={cn(
              "bevel relative top-px min-w-0 flex-1 truncate border-b-0 px-1 whitespace-nowrap",
              on
                ? "bg-sheet text-text z-10 pt-2 pb-1.5 font-bold"
                : "bg-window text-dim pt-1.5 pb-1",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
