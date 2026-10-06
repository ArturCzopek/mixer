import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlayerCompareView } from "@/components/profile/player-compare-view";
import { groupBySlug } from "@/lib/groups/queries";
import { groupPlayerProfile } from "@/lib/profile/queries";
import { headToHead } from "@/lib/profile/head-to-head";

export const metadata: Metadata = { title: "Compare players · mixer" };

export default async function PlayerComparePage({
  params,
  searchParams,
}: PageProps<"/g/[slug]/compare">) {
  const { slug } = await params;
  const query = await searchParams;
  const group = await groupBySlug(slug);
  if (!group) notFound();
  const selectedA = typeof query.a === "string" ? query.a : "";
  const selectedB = typeof query.b === "string" ? query.b : "";
  const source =
    query.source === "faceit" || query.source === "premier"
      ? query.source
      : "mix";
  const members = group.members.map((member) => ({
    steamId: member.steamId,
    name: member.displayName ?? member.steamId,
  }));
  const validPair =
    selectedA !== selectedB &&
    [selectedA, selectedB].every(
      (id) =>
        /^[0-9]{17}$/.test(id) &&
        members.some((member) => member.steamId === id),
    );
  const profiles = validPair
    ? await Promise.all([
        groupPlayerProfile(group.id, selectedA),
        groupPlayerProfile(group.id, selectedB),
      ])
    : ([null, null] as const);
  return (
    <PlayerCompareView
      groupSlug={group.slug}
      groupName={group.name}
      members={members}
      selectedA={selectedA}
      selectedB={selectedB}
      source={source}
      profiles={[profiles[0], profiles[1]]}
      headToHead={headToHead(
        profiles[0]?.summary.maps ?? [],
        profiles[1]?.summary.maps ?? [],
      )}
    />
  );
}
