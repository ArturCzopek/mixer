"use client";

// Optional CS 1.6 backdrop behind the windows. Off by default; the choice is a per-browser
// preference stored in a cookie, so the server-rendered checkbox matches the visible backdrop.

import * as React from "react";
import { useT } from "@/components/i18n";
import { cn } from "@/lib/utils";

const KEY = "mixer.background";
const EVENT = "mixer-background";

function read(): boolean {
  try {
    return document.cookie.split("; ").includes(`${KEY}=cs16`);
  } catch {
    return document.documentElement.dataset.bg === "cs16";
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

export function BackgroundToggle({
  className,
  initialOn,
}: {
  className?: string;
  initialOn: boolean;
}) {
  const t = useT();
  const on = React.useSyncExternalStore(subscribe, read, () => initialOn);

  React.useEffect(() => {
    if (read()) document.documentElement.dataset.bg = "cs16";
    else delete document.documentElement.dataset.bg;
  }, [on]);

  const toggle = () => {
    document.cookie = `${KEY}=${on ? "off" : "cs16"}; Max-Age=31536000; Path=/; SameSite=Lax`;
    try {
      if (on) window.localStorage.removeItem(KEY);
      else window.localStorage.setItem(KEY, "cs16");
    } catch {
      // The cookie remains the source of truth when localStorage is blocked.
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
