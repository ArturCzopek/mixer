"use client";

import Link from "next/link";
import { useT } from "@/components/i18n";

export function DiscordMissing({
  names,
  groupSlug,
}: {
  names: string[];
  groupSlug: string;
}) {
  const t = useT().groups.discordMissing;
  if (names.length === 0) return null;
  return (
    <div
      role="alert"
      className="border-loss text-text mt-2 border-2 px-2 py-1.5 text-[12px]"
    >
      <b className="text-loss">⚠ {t.title(names.length)}:</b>{" "}
      <b>{names.join(", ")}</b>.{" "}
      <Link href={`/g/${groupSlug}#members`}>{t.roster}</Link>
    </div>
  );
}
