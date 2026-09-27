import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { LobbyRealtime } from "@/components/mix/lobby-realtime";
import { MixLobbyView } from "@/components/mix/lobby-view";
import { hasGroupRole } from "@/lib/auth/roles";
import { getSession } from "@/lib/auth/server";
import { groupBySlug } from "@/lib/groups/queries";
import { mixLobby } from "@/lib/mix/queries";

export async function generateMetadata({
  params,
}: PageProps<"/g/[slug]/m/[mixId]">): Promise<Metadata> {
  const { slug, mixId } = await params;
  if (!z.uuid().safeParse(mixId).success) return { title: "Mix · mixer" };
  const [group, mix] = await Promise.all([groupBySlug(slug), mixLobby(mixId)]);
  return {
    title:
      group && mix?.groupId === group.id
        ? `${mix.title} · ${group.name} · mixer`
        : "Mix · mixer",
  };
}

/** Public lobby. The server decides who can see each action; every action checks again. */
export default async function MixLobbyPage({
  params,
}: PageProps<"/g/[slug]/m/[mixId]">) {
  const { slug, mixId } = await params;
  if (!z.uuid().safeParse(mixId).success) notFound();

  const [group, mix, session] = await Promise.all([
    groupBySlug(slug),
    mixLobby(mixId),
    getSession(),
  ]);
  if (!group || !mix || mix.groupId !== group.id) notFound();

  const membership = group.members.find(
    (member) => member.playerId === session?.playerId,
  );
  const canManage = hasGroupRole(
    membership ? { role: membership.role, leftAt: null } : null,
    "admin",
    session?.isSiteAdmin ?? false,
  );
  const joined = new Set(
    mix.participants.map((participant) => participant.playerId),
  );

  return (
    <>
      <LobbyRealtime mixId={mix.id} />
      <MixLobbyView
        groupSlug={group.slug}
        groupName={group.name}
        mix={mix}
        viewerId={session?.playerId ?? null}
        isMember={membership !== undefined}
        canManage={canManage}
        candidates={group.members
          .filter((member) => !joined.has(member.playerId))
          .map((member) => ({
            playerId: member.playerId,
            name: member.displayName ?? member.steamId,
          }))}
      />
    </>
  );
}
