import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GroupForm } from "@/components/groups/group-form";
import { GroupSwitcher } from "@/components/groups/group-switcher";
import { MemberActions } from "@/components/groups/member-actions";
import { LanguageToggle } from "@/components/i18n";
import { Badge, ListHead, Well, Window } from "@/components/vgui";
import { hasGroupRole } from "@/lib/auth/roles";
import { getSession } from "@/lib/auth/server";
import { updateGroup } from "@/lib/groups/actions";
import { groupBySlug } from "@/lib/groups/queries";
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
  const me = group.members.find((m) => m.playerId === session?.playerId);
  const canManage = hasGroupRole(
    me ? { role: me.role, leftAt: null } : null,
    "admin",
    session?.isSiteAdmin ?? false,
  );
  return (
    <main className="mx-auto w-full max-w-[460px] px-2 py-6">
      <Window
        title={group.name}
        right={
          <span className="flex items-center gap-2">
            <GroupSwitcher session={session} current={group.slug} t={t} />
            <LanguageToggle />
          </span>
        }
      >
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
            <span className="flex-1">
              {t.groups.members(group.members.length)}
            </span>
          </ListHead>
          {group.members.map((m) => {
            const name = m.displayName ?? m.steamId;
            return (
              <div
                key={m.playerId}
                className="border-row flex items-center gap-2 border-b px-1.5 py-1 last:border-b-0"
              >
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
                {canManage && (
                  <MemberActions
                    groupId={group.id}
                    playerId={m.playerId}
                    name={name}
                    isAdmin={m.role === "admin"}
                  />
                )}
              </div>
            );
          })}
        </Well>

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
