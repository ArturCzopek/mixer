"use client";

import { useT } from "@/components/i18n";
import { Well, Window } from "@/components/vgui";
import { cn } from "@/lib/utils";

export type LoadingKind = "groups" | "group" | "mix" | "profile";

export function LoadingPanel({ kind }: { kind: LoadingKind }) {
  const t = useT();
  const lines = kind === "groups" ? 3 : kind === "profile" ? 5 : 4;
  return (
    <main
      className={cn(
        "mx-auto w-full max-w-[1180px] flex-1 px-2 py-6",
        kind === "groups" && "max-w-[460px]",
      )}
    >
      <Window title={t.loading.routes[kind]}>
        <Well
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="text-dim mb-2 px-2 py-1.5 text-[11px]"
        >
          <span
            aria-hidden
            className="bg-gold mr-1.5 inline-block size-[7px]"
          />
          {t.loading.loading}
        </Well>
        <div aria-hidden className="flex flex-col gap-1">
          {Array.from({ length: lines }, (_, index) => (
            <div
              key={index}
              className="bevel bg-sheet flex h-9 items-center px-2"
            >
              <span
                className={`bg-hover block h-2 ${index % 2 ? "w-2/3" : "w-5/6"}`}
              />
            </div>
          ))}
        </div>
      </Window>
    </main>
  );
}
