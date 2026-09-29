import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { adminDb } from "@/lib/db/admin";
import { LobbyRealtime } from "@/components/mix/lobby-realtime";
import { MixLobbyView } from "@/components/mix/lobby-view";
import { MixView } from "@/components/mix/mix-view";
import { hasGroupRole } from "@/lib/auth/roles";
import { getSession } from "@/lib/auth/server";
import { groupBySlug } from "@/lib/groups/queries";
import { groupMixes, mixLobby, mixVariantPage } from "@/lib/mix/queries";
import { mixVariantViewData } from "@/lib/mix/view";

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

  if (
    mix.status === "balancing" ||
    mix.status === "voting" ||
    mix.status === "locked" ||
    mix.status === "played"
  ) {
    const page = await mixVariantPage(mix.id, canManage);
    if (!page) notFound();
    const mixes = await groupMixes(group.id);
    const number = mixes.findIndex((item) => item.id === mix.id) + 1;
    const data = mixVariantViewData(page, {
      number,
      meSteamId:
        mix.participants.find(
          (participant) => participant.playerId === session?.playerId,
        )?.steamId ?? null,
      viewerIsAdmin: canManage,
      groupMembers: group.members,
    });
    data.faceitClubUrl = group.faceitClubUrl;
    if (mix.status === "played") {
      const { data: maps, error } = await adminDb()
        .from("matches")
        .select(
          "id, map_number, map_name, score_a, score_b, source, faceit_match_id, faceit_demo_url",
        )
        .eq("mix_id", mix.id)
        .order("map_number", { ascending: true });
      if (error) throw new Error(`Mix results: ${error.message}`);
      const matchIds = (maps ?? []).map((map) => map.id);
      const { data: storedStats, error: statsError } = matchIds.length
        ? await adminDb()
            .from("match_player_stats")
            .select(
              "match_id, player_id, team, kills, deaths, assists, adr, rounds, rating",
            )
            .in("match_id", matchIds)
        : { data: [], error: null };
      if (statsError) throw new Error(`Mix stats: ${statsError.message}`);
      const steamIds = new Map(
        page.participants.map((player) => [player.playerId, player.steamId]),
      );
      data.result = {
        maps: (maps ?? []).map((map) => ({
          map: map.map_name
            ? `${map.map_number}. ${map.map_name}`
            : `#${map.map_number}`,
          a: map.score_a,
          b: map.score_b,
          roomUrl: map.faceit_match_id
            ? `https://www.faceit.com/en/cs2/room/${encodeURIComponent(map.faceit_match_id)}`
            : null,
          demoUrl: map.faceit_demo_url,
          lines: (storedStats ?? []).flatMap((stat) => {
            const steamId = steamIds.get(stat.player_id);
            if (
              stat.match_id !== map.id ||
              !steamId ||
              !["A", "B"].includes(stat.team) ||
              stat.kills === null ||
              stat.deaths === null ||
              stat.assists === null ||
              stat.adr === null ||
              stat.rounds === null ||
              stat.rating === null
            )
              return [];
            return [
              {
                steamId,
                team: stat.team as "A" | "B",
                k: stat.kills,
                d: stat.deaths,
                a: stat.assists,
                adr: Number(stat.adr),
                rounds: stat.rounds,
                rating: Number(stat.rating),
              },
            ];
          }),
        })),
        source: maps?.every((map) => map.source === "manual")
          ? "manual"
          : "mixed",
      };
    }

    return (
      <>
        <LobbyRealtime mixId={mix.id} />
        <MixView state={mix.status} data={data} groupSlug={group.slug} />
      </>
    );
  }

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
