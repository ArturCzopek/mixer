import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GroupForm } from "@/components/groups/group-form";
import { DiscordSettings } from "@/components/groups/discord-settings";
import { MemberActions } from "@/components/groups/member-actions";
import { AddRosterPlayer, RosterElo } from "@/components/groups/roster-form";
import { CreateMixForm } from "@/components/mix/lobby-view";
import { Badge, ListHead, Well, Window } from "@/components/vgui";
import { hasGroupRole } from "@/lib/auth/roles";
import { getSession } from "@/lib/auth/server";
import {
  saveDiscordChannels,
  unlinkDiscordAccount,
} from "@/lib/discord/actions";
import { groupDiscordConfig } from "@/lib/discord/queries";
import { updateGroup } from "@/lib/groups/actions";
import { groupBySlug } from "@/lib/groups/queries";
import { groupStats } from "@/lib/groups/stats";
import { groupMixes } from "@/lib/mix/queries";
import { getDict } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/g/[slug]">): Promise<Metadata> {
  const group = await groupBySlug((await params).slug);
  return { title: `${group?.name ?? "Group"} · mixer` };
}

/** Public group page (D2); admin controls only render for admins and are re-checked on the server. */
export default async function GroupPage({
  params,
  searchParams,
}: PageProps<"/g/[slug]">) {
  const [group, session, t] = await Promise.all([
    groupBySlug((await params).slug),
    getSession(),
    getDict(),
  ]);
  if (!group) notFound();
  const [mixes, stats] = await Promise.all([
    groupMixes(group.id),
    groupStats(group.id, session?.playerId ?? null),
  ]);
  const archivedMixes = mixes.filter(
    (mix) =>
      mix.archiveSource ||
      mix.status === "played" ||
      mix.status === "cancelled",
  );
  const currentMixes = mixes.filter((mix) => !archivedMixes.includes(mix));
  const leaders = stats.leaderboard
    .filter((row) => row.ratedMaps >= 5)
    .slice(0, 5);
  const me = group.members.find((m) => m.playerId === session?.playerId);
  const canManage = hasGroupRole(
    me ? { role: me.role, leftAt: null } : null,
    "admin",
    session?.isSiteAdmin ?? false,
  );
  const discordConfigured = !!(
    process.env.DISCORD_CLIENT_ID &&
    process.env.DISCORD_CLIENT_SECRET &&
    process.env.DISCORD_BOT_TOKEN
  );
  const discord =
    canManage && discordConfigured ? await groupDiscordConfig(group.id) : null;
  const { discord: discordResult, discordAccount: discordAccountResult } =
    await searchParams;
  const discordPlayerConfigured = !!(
    process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET
  );
  const accountNext = `/g/${group.slug}#members`;
  const mixRow = (mix: (typeof mixes)[number]) => {
    const historical = archivedMixes.includes(mix);
    const result = stats.mixResults[mix.id];
    return (
      <Link
        key={mix.id}
        href={`/g/${group.slug}/m/${mix.id}`}
        className="border-row text-text hover:bg-hover block border-b px-1.5 py-2 last:border-b-0"
      >
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate font-bold">{mix.title}</span>
          {!historical && (
            <span className="text-gold shrink-0 text-[11px] font-bold">
              {t.lobby.playersOf10(mix.participantCount)}
            </span>
          )}
          <span className="text-dim shrink-0 text-right text-[11px]">
            {t.lobby.status[mix.status]}
          </span>
        </span>
        {historical && (
          <span className="text-dim mt-1 flex flex-wrap gap-x-2 text-[11px]">
            {result ? (
              <>
                <b className="text-gold">
                  {t.groups.mixResult(result.wonA, result.wonB, result.draws)}
                </b>
                <span>
                  {result.maps
                    .map((map) => `${map.name} ${map.a}:${map.b}`)
                    .join(" · ")}
                </span>
                {result.own && (
                  <span className="text-text">
                    {t.groups.ownResult(
                      result.own.kills,
                      result.own.deaths,
                      result.own.rating?.toFixed(2) ?? "—",
                    )}
                  </span>
                )}
              </>
            ) : (
              t.groups.cancelledMix
            )}
          </span>
        )}
      </Link>
    );
  };
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
          {currentMixes.length === 0 ? (
            <p className="text-dim px-1.5 py-2 text-[11px]">
              {t.groups.noCurrentMixes}
            </p>
          ) : (
            currentMixes.map(mixRow)
          )}
        </Well>
        <Well className="mb-2">
          <ListHead>{t.groups.statsTitle}</ListHead>
          <div className="grid grid-cols-3 gap-1 px-1.5 py-2 text-center">
            {(
              [
                [stats.mixes, t.groups.statsMixes],
                [stats.maps, t.groups.statsMaps],
                [stats.players, t.groups.statsPlayers],
              ] as const
            ).map(([value, label]) => (
              <div key={label}>
                <b className="text-gold block text-[24px] leading-none">
                  {value}
                </b>
                <span className="text-dim text-[10px]">{label}</span>
              </div>
            ))}
          </div>
          <p className="text-dim border-row border-t px-1.5 py-1 text-[11px]">
            {t.groups.statsSources(
              stats.sources.popflash,
              stats.sources.faceit,
              stats.sources.manual,
              stats.sources.demo,
            )}
          </p>
          <ListHead>{t.groups.statsLeaders}</ListHead>
          {leaders.length === 0 ? (
            <p className="text-dim px-1.5 py-2 text-[11px]">
              {t.groups.statsEmpty}
            </p>
          ) : (
            leaders.map((row, index) => (
              <Link
                key={row.steamId}
                href={`/g/${group.slug}/p/${row.steamId}`}
                className="border-row hover:bg-hover flex items-center gap-2 border-b px-1.5 py-1.5 last:border-b-0"
              >
                <span className="text-dim w-4 shrink-0 text-[11px]">
                  {index + 1}.
                </span>
                <span className="min-w-0 flex-1">
                  <b className="text-text block truncate">{row.name}</b>
                  <span className="text-dim text-[10px]">
                    {row.maps} {t.groups.statsMaps} · {row.wins}–{row.losses}{" "}
                    W–L · K/D{" "}
                    {row.deaths ? (row.kills / row.deaths).toFixed(2) : "—"} ·
                    ADR {row.adr?.toFixed(0) ?? "—"}
                  </span>
                </span>
                <b className="text-gold shrink-0">{row.rating!.toFixed(2)}</b>
              </Link>
            ))
          )}
          <p className="text-dim border-row border-t px-1.5 py-1 text-[10px]">
            {t.groups.statsMinimum}
          </p>
        </Well>
        {archivedMixes.length > 0 && (
          <details className="mb-2">
            <summary className="bevel bg-window hover:bg-hover text-gold px-2 py-1.5 font-bold">
              {t.groups.archiveMixes(archivedMixes.length)}
            </summary>
            <Well>{archivedMixes.map(mixRow)}</Well>
          </details>
        )}
        {canManage && (
          <section className="mb-3">
            <h2 className="text-text mb-1 text-[13px] font-bold">
              {t.lobby.newMix}
            </h2>
            <CreateMixForm groupId={group.id} />
          </section>
        )}

        {session &&
          typeof discordAccountResult === "string" &&
          discordAccountResult in t.groups.discordAccount.result && (
            <Well
              role="status"
              className="text-dim mb-2 px-2 py-1.5 text-[11px]"
            >
              {
                t.groups.discordAccount.result[
                  discordAccountResult as keyof typeof t.groups.discordAccount.result
                ]
              }
            </Well>
          )}

        <Well id="members" className="mb-2">
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
                  <Link
                    href={`/g/${group.slug}/p/${m.steamId}`}
                    className="text-text min-w-0 flex-1 truncate no-underline"
                  >
                    {name}
                  </Link>
                  {m.role === "admin" && <Badge>{t.groups.admin}</Badge>}
                </div>
                <div className="text-dim mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                  <a
                    href={`https://steamcommunity.com/profiles/${m.steamId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Steam
                  </a>
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
                  <span>
                    {m.discordUserId
                      ? t.groups.discordAccount.linked
                      : t.groups.discordAccount.unlinked}
                  </span>
                  {m.playerId === session?.playerId &&
                    discordPlayerConfigured && (
                      <a
                        href={`/auth/discord/player?next=${encodeURIComponent(accountNext)}`}
                      >
                        {m.discordUserId
                          ? t.groups.discordAccount.change
                          : t.groups.discordAccount.connect}
                      </a>
                    )}
                  {m.playerId === session?.playerId && m.discordUserId && (
                    <form action={unlinkDiscordAccount.bind(null, accountNext)}>
                      <button type="submit" className="text-gold underline">
                        {t.groups.discordAccount.disconnect}
                      </button>
                    </form>
                  )}
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
          <details className="mb-2" open={typeof discordResult === "string"}>
            <summary className="text-gold mb-1 cursor-pointer font-bold">
              {t.groups.settings}
            </summary>
            <GroupForm
              action={updateGroup.bind(null, group.id)}
              withSlug={false}
              defaults={{ name: group.name, faceitClub: group.faceitClubUrl }}
              submit={t.groups.save}
            />
            <DiscordSettings
              groupId={group.id}
              guild={discord?.guild ?? null}
              channels={discord?.channels ?? []}
              settings={discord?.settings ?? {}}
              available={discord?.available ?? false}
              configured={discordConfigured}
              result={
                typeof discordResult === "string" ? discordResult : undefined
              }
              action={saveDiscordChannels.bind(null, group.id)}
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
