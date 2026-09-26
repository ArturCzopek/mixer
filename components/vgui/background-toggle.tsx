"use client";

// Optional CS 1.6 backdrop behind the windows. Off by default; the choice is a per-browser
// convenience (localStorage), so it may come back empty and the page must work without it.

import * as React from "react";
import { useT } from "@/components/i18n";
import { cn } from "@/lib/utils";

const KEY = "mixer.background";
const EVENT = "mixer-background";

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "cs16";
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function BackgroundToggle({ className }: { className?: string }) {
  const t = useT();
  const on = React.useSyncExternalStore(subscribe, read, () => false);

  React.useEffect(() => {
    if (on) document.documentElement.dataset.bg = "cs16";
    else delete document.documentElement.dataset.bg;
  }, [on]);

  const toggle = () => {
    try {
      if (on) window.localStorage.removeItem(KEY);
      else window.localStorage.setItem(KEY, "cs16");
    } catch {
      // Storage blocked: the toggle simply does not persist.
    }
    window.dispatchEvent(new Event(EVENT));
  };

  return (
    <label
      className={cn(
        "text-dim flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] whitespace-nowrap select-none",
        className,
      )}
    >
      <input
        type="checkbox"
        checked={on}
        onChange={toggle}
        className="sunk checked:bg-gold-deep size-3.5 appearance-none"
      />
      <span className="sm:hidden">{t.prefs.backdropShort}</span>
      <span className="hidden sm:inline">{t.prefs.backdrop}</span>
    </label>
  );
}
