import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GroupForm } from "@/components/groups/group-form";
import { MemberActions } from "@/components/groups/member-actions";
import { AddRosterPlayer, RosterElo } from "@/components/groups/roster-form";
import { CreateMixForm } from "@/components/mix/lobby-view";
import { Badge, ListHead, Well, Window } from "@/components/vgui";
import { hasGroupRole } from "@/lib/auth/roles";
import { getSession } from "@/lib/auth/server";
import { updateGroup } from "@/lib/groups/actions";
import { groupBySlug } from "@/lib/groups/queries";
import { groupMixes } from "@/lib/mix/queries";
import { getDict } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/g/[slug]">): Promise<Metadata> {
  const group = await groupBySlug((await params).slug);
  return { title: `${group?.name ?? "Group"} · mixer` };
}

/** Public group page (D2); admin controls only render for admins and are re-checked on the server. */
export default async function GroupPage({ params }: PageProps<"/g/[slug]">) {
  const [group, session, t] = await Promise.all([
    groupBySlug((await params).slug),
    getSession(),
    getDict(),
  ]);
  if (!group) notFound();
  const mixes = await groupMixes(group.id);
  const me = group.members.find((m) => m.playerId === session?.playerId);
  const canManage = hasGroupRole(
    me ? { role: me.role, leftAt: null } : null,
    "admin",
    session?.isSiteAdmin ?? false,
  );
  return (
    <main className="mx-auto w-full max-w-[460px] px-2 py-6">
      <Window title={group.name}>
        <p className="mb-2 text-[11px]">
          <span className="text-dim">{t.groups.club}: </span>
          {group.faceitClubUrl ? (
            <a
              href={group.faceitClubUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {group.faceitClubUrl.replace(/^https:\/\/(www\.)?/, "")}
            </a>
          ) : (
            <span className="text-dim">{t.groups.noClub}</span>
          )}
        </p>

        <Well className="mb-2">
          <ListHead>
            <span className="flex-1">{t.lobby.mixList}</span>
            <span>{t.lobby.playersColumn}</span>
          </ListHead>
          {mixes.length === 0 ? (
            <p className="text-dim px-1.5 py-2 text-[11px]">
              {t.lobby.noMixes}
            </p>
          ) : (
            mixes.map((mix) => (
              <Link
                key={mix.id}
                href={`/g/${group.slug}/m/${mix.id}`}
                className="border-row text-text hover:bg-hover flex items-center gap-2 border-b px-1.5 py-2 last:border-b-0"
              >
                <span className="min-w-0 flex-1 truncate font-bold">
                  {mix.title}
                </span>
                <span className="text-gold shrink-0 text-[11px] font-bold">
                  {t.lobby.playersOf10(mix.participantCount)}
                </span>
                <span className="text-dim w-20 shrink-0 text-right text-[11px]">
                  {t.lobby.status[mix.status]}
                </span>
              </Link>
            ))
          )}
        </Well>
        {canManage && (
          <section className="mb-3">
            <h2 className="text-text mb-1 text-[13px] font-bold">
              {t.lobby.newMix}
            </h2>
            <CreateMixForm groupId={group.id} />
          </section>
        )}

        <Well className="mb-2">
          <ListHead>
            <span className="flex-1">
              {t.groups.members(group.members.length)}
            </span>
          </ListHead>
          {group.members.length === 0 && (
            <p className="text-dim px-1.5 py-2 text-[11px]">
              {t.groups.noMembers}
            </p>
          )}
          {group.members.map((m) => {
            const name = m.displayName ?? m.steamId;
            return (
              <div
                key={m.playerId}
                className="border-row border-b px-1.5 py-2 last:border-b-0"
              >
                <div className="flex items-center gap-2">
                  {m.avatarUrl ? (
                    <Image
                      src={m.avatarUrl}
                      alt=""
                      width={18}
                      height={18}
                      unoptimized
                      className="border-lo border"
                    />
                  ) : (
                    <span className="border-lo bg-row size-[18px] border" />
                  )}
                  <a
                    href={`https://steamcommunity.com/profiles/${m.steamId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-text min-w-0 flex-1 truncate no-underline"
                  >
                    {name}
                  </a>
                  {m.role === "admin" && <Badge>{t.groups.admin}</Badge>}
                </div>
                <div className="text-dim mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                  {m.faceitNickname ? (
                    <a
                      href={`https://www.faceit.com/en/players/${encodeURIComponent(m.faceitNickname)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      FACEIT · {m.faceitNickname}
                    </a>
                  ) : (
                    <span>{t.roster.noFaceit}</span>
                  )}
                  <span>
                    {t.roster.fallbackElo}: {m.manualElo ?? "—"}
                  </span>
                </div>
                {canManage && (
                  <>
                    <RosterElo
                      groupId={group.id}
                      playerId={m.playerId}
                      name={name}
                      value={m.manualElo}
                    />
                    <div className="mt-2">
                      <MemberActions
                        groupId={group.id}
                        playerId={m.playerId}
                        name={name}
                        isAdmin={m.role === "admin"}
                      />
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </Well>

        {canManage && <AddRosterPlayer groupId={group.id} />}

        {canManage && (
          <details className="mb-2">
            <summary className="text-gold mb-1 cursor-pointer font-bold">
              {t.groups.settings}
            </summary>
            <GroupForm
              action={updateGroup.bind(null, group.id)}
              withSlug={false}
              defaults={{ name: group.name, faceitClub: group.faceitClubUrl }}
              submit={t.groups.save}
            />
          </details>
        )}

        <p className="text-dim">
          <Link href="/">{t.groups.home}</Link>
        </p>
      </Window>
    </main>
  );
}
