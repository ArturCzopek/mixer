import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlayerProfileView } from "@/components/profile/player-profile-view";
import { groupBySlug } from "@/lib/groups/queries";
import { groupPlayerProfile } from "@/lib/profile/queries";

const steamIdPattern = /^[0-9]{17}$/;

export async function generateMetadata({
  params,
}: PageProps<"/g/[slug]/p/[steamId]">): Promise<Metadata> {
  const { slug, steamId } = await params;
  if (!steamIdPattern.test(steamId)) return { title: "Player · mixer" };
  const group = await groupBySlug(slug);
  const profile = group ? await groupPlayerProfile(group.id, steamId) : null;
  return {
    title:
      group && profile
        ? `${profile.player.name} · ${group.name} · mixer`
        : "Player · mixer",
  };
}

export default async function PlayerProfilePage({
  params,
}: PageProps<"/g/[slug]/p/[steamId]">) {
  const { slug, steamId } = await params;
  if (!steamIdPattern.test(steamId)) notFound();
  const group = await groupBySlug(slug);
  if (!group) notFound();
  const profile = await groupPlayerProfile(group.id, steamId);
  if (
    !profile ||
    (!group.members.some((member) => member.steamId === steamId) &&
      profile.summary.mapCount === 0)
  )
    notFound();
  return (
    <PlayerProfileView
      groupSlug={group.slug}
      groupName={group.name}
      data={profile}
    />
  );
}
