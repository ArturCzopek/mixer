// VGUI primitives: the 2003 Steam / CS 1.6 client grammar (bevels, wells, property-sheet tabs).
// Everything in the app is built from these; see the direction contract in .impeccable/surfaces/.

import * as React from "react";
import { cn } from "@/lib/utils";

export function Window({
  title,
  right,
  className,
  children,
}: {
  title: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("bevel bg-window", className)}>
      <header className="border-lo flex items-center gap-2 border-b px-2.5 py-1.5">
        <h1 className="text-text min-w-0 truncate text-[13px] font-bold">
          {title}
        </h1>
        {right && (
          <div className="text-gold ml-auto shrink-0 font-bold">{right}</div>
        )}
      </header>
      <div className="border-hi border-t p-2">{children}</div>
    </section>
  );
}

export { Tabs } from "./tabs";
export { BackgroundToggle } from "./background-toggle";

export function Well({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("sunk", className)} {...props} />;
}

/** Bevelled button that sinks while pressed, like the old client. */
export function VButton({
  primary,
  className,
  ...props
}: React.ComponentProps<"button"> & { primary?: boolean }) {
  return (
    <button
      className={cn(
        "bevel bg-sheet px-3 py-2.5 text-[13px] font-bold whitespace-nowrap select-none",
        "active:border-t-lo active:border-r-hi active:border-b-hi active:border-l-lo active:bg-window active:pt-[11px] active:pb-[9px]",
        "disabled:text-dim disabled:cursor-not-allowed disabled:[text-shadow:1px_1px_0_var(--vg-hi)]",
        primary ? "text-gold" : "text-text",
        className,
      )}
      {...props}
    />
  );
}

/** Tab body: the raised sheet under a Tabs row. */
export function Sheet({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="tabpanel"
      className={cn("bevel bg-sheet p-2", className)}
      {...props}
    />
  );
}

/** The one skill ramp: S is always this gold bar, scaled against the same max everywhere. */
export function SkillBar({
  value,
  max = 2300,
  min = 800,
  selected,
}: {
  value: number;
  max?: number;
  min?: number;
  selected?: boolean;
}) {
  const pct = Math.max(4, Math.min(100, ((value - min) / (max - min)) * 100));
  return (
    <div className="grid grid-cols-[1fr_2.6rem] items-center gap-1.5">
      <span className="bg-lo/40 h-[7px]">
        <i
          className={cn("block h-full", selected ? "bg-white" : "bg-gold")}
          style={{ width: `${pct}%` }}
        />
      </span>
      <b className="text-right">{value}</b>
    </div>
  );
}

export function Badge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "hatch text-gold inline-block px-1.5 py-0.5 text-[10px] font-bold tracking-[0.06em] uppercase",
        className,
      )}
      {...props}
    />
  );
}

/** Column header row of a server-browser style list. */
export function ListHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-lo bg-window text-dim flex border-b px-1.5 py-1 text-[10px] tracking-[0.06em] uppercase">
      {children}
    </div>
  );
}
