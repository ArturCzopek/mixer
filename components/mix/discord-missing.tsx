"use client";

import Link from "next/link";
import { useT } from "@/components/i18n";
import { Badge, Well } from "@/components/vgui";

export function DiscordMissing({
  names,
  groupSlug,
}: {
  names: string[];
  groupSlug: string;
}) {
  const t = useT().groups.discordMissing;
  if (names.length === 0) return null;
  // Loud on purpose (players must link before the evening), but inside the system: a status well
  // with the hatch badge and the alert colour, not an assertive alert on every page load.
  return (
    <Well role="status" className="mt-2 px-2 py-1.5 text-[11px]">
      <Badge className="mr-1.5">Discord</Badge>
      <b className="text-alert">{t.title(names.length)}:</b>{" "}
      <b className="text-text">{names.join(", ")}</b>.{" "}
      <Link href={`/g/${groupSlug}#members`}>{t.roster}</Link>
    </Well>
  );
}
