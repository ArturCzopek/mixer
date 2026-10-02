"use client";

import Link from "next/link";
import { useT } from "@/components/i18n";
import { Well } from "@/components/vgui";

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
    <Well className="text-dim mt-2 px-2 py-1.5 text-[11px]">
      <b className="text-text">{t.title(names.length)}:</b> {names.join(", ")}.{" "}
      <Link href={`/g/${groupSlug}#members`}>{t.roster}</Link>
    </Well>
  );
}
