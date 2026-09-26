"use client";

// Language context for client components, plus the flag toggle. The choice lives in the
// `mixer.lang` cookie (1 year) so the server renders the right language on the next request.

import * as React from "react";
import { useRouter } from "next/navigation";
import { DICTS, LANG_COOKIE, type Dict, type Lang } from "@/lib/i18n/dict";
import { cn } from "@/lib/utils";

const LangContext = React.createContext<Lang>("en");

export function I18nProvider({
  lang,
  children,
}: {
  lang: Lang;
  children: React.ReactNode;
}) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export const useLang = () => React.useContext(LangContext);
export const useT = (): Dict => DICTS[useLang()];

function FlagPL() {
  return (
    <svg viewBox="0 0 16 10" aria-hidden className="block h-[10px] w-4">
      <rect width="16" height="5" fill="#fff" />
      <rect y="5" width="16" height="5" fill="#dc143c" />
    </svg>
  );
}

function FlagGB() {
  return (
    <svg viewBox="0 0 60 30" aria-hidden className="block h-[10px] w-5">
      <clipPath id="gb-clip">
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path
        d="M0,0 L60,30 M60,0 L0,30"
        clipPath="url(#gb-clip)"
        stroke="#C8102E"
        strokeWidth="4"
      />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}

/** Remembers the language for a year; the server reads it on the next render. */
function saveLang(lang: Lang) {
  document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
}

/** Two flags; the active one is sunk like a pressed VGUI button. */
export function LanguageToggle({ className }: { className?: string }) {
  const lang = useLang();
  const t = useT();
  const router = useRouter();
  const set = (next: Lang) => {
    if (next === lang) return;
    saveLang(next);
    router.refresh();
  };
  return (
    <div
      role="group"
      aria-label={t.prefs.language}
      className={cn("flex shrink-0 items-center gap-0.5", className)}
    >
      {(
        [
          ["en", t.prefs.english, <FlagGB key="gb" />],
          ["pl", t.prefs.polish, <FlagPL key="pl" />],
        ] as const
      ).map(([code, label, flag]) => (
        <button
          key={code}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={lang === code}
          onClick={() => set(code)}
          className={cn(
            "p-[3px]",
            lang === code
              ? "sunk"
              : "bevel bg-window hover:bg-hover opacity-70 hover:opacity-100",
          )}
        >
          {flag}
        </button>
      ))}
    </div>
  );
}
