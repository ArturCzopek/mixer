import type { Metadata } from "next";
import Link from "next/link";
import { MixView, type MixState } from "@/components/mix/mix-view";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Mix #14 · design preview · mixer" };

const STATES: MixState[] = ["lobby", "voting", "locked", "played"];

export default async function MixPreviewPage({
  searchParams,
}: PageProps<"/design/mix">) {
  const { state } = await searchParams;
  const current = STATES.includes(state as MixState)
    ? (state as MixState)
    : "voting";
  return (
    <>
      <div className="bg-lo text-dim flex items-center justify-center gap-1 px-2 py-1 text-[11px]">
        Preview:
        {STATES.map((s) => (
          <Link
            key={s}
            href={`?state=${s}`}
            className={cn(
              "px-1.5 py-0.5 no-underline",
              s === current
                ? "bg-window text-gold"
                : "text-dim hover:text-text",
            )}
          >
            {s}
          </Link>
        ))}
      </div>
      <MixView key={current} state={current} />
    </>
  );
}
