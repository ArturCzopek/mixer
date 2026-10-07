"use client";

import Link from "next/link";
import { useLang, useT } from "@/components/i18n";
import { LeetifyProfilePanel } from "@/components/leetify/profile-panel";
import { MixProfileStats } from "@/components/profile/profile-stats";
import {
  RatingTrend,
  type RatingTrendPoint,
} from "@/components/profile/rating-trend";
import { VButton, Well, Window } from "@/components/vgui";
import type { HeadToHead } from "@/lib/profile/head-to-head";
import type { groupPlayerProfile } from "@/lib/profile/queries";

type Profile = NonNullable<Awaited<ReturnType<typeof groupPlayerProfile>>>;
type Source = "mix" | "faceit" | "premier";

export function PlayerCompareView({
  groupSlug,
  groupName,
  members,
  selectedA,
  selectedB,
  source,
  profiles,
  headToHead,
}: {
  groupSlug: string;
  groupName: string;
  members: { steamId: string; name: string }[];
  selectedA: string;
  selectedB: string;
  source: Source;
  profiles: [Profile | null, Profile | null];
  headToHead: HeadToHead;
}) {
  const t = useT();
  const lang = useLang();
  const memberA = members.find((member) => member.steamId === selectedA);
  const memberB = members.find((member) => member.steamId === selectedB);
  const validPair = !!memberA && !!memberB && selectedA !== selectedB;
  const date = (value: string) =>
    new Intl.DateTimeFormat(lang === "pl" ? "pl-PL" : "en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Europe/Warsaw",
    }).format(new Date(value));

  let guidance: string | null = null;
  if (members.length < 2) guidance = t.profile.needsTwoMembers;
  else if ((selectedA && !memberA) || (selectedB && !memberB))
    guidance = t.profile.chooseGroupMembers;
  else if (selectedA && selectedA === selectedB)
    guidance = t.profile.chooseDifferentPlayers;
  else if (!selectedA || !selectedB) guidance = t.profile.chooseBothPlayers;
  else if (!profiles[0] || !profiles[1])
    guidance = t.profile.profileUnavailable;

  return (
    <main className="mx-auto w-full max-w-[1180px] flex-1 px-2 pb-12">
      <p className="text-dim mb-2 text-xs">
        <Link href={`/g/${groupSlug}`}>{groupName}</Link>{" "}
        <span aria-hidden>›</span> {t.profile.compareTitle}
      </p>
      <Window title={t.profile.compareTitle}>
        <form
          method="get"
          action={`/g/${encodeURIComponent(groupSlug)}/compare`}
          className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(130px,0.8fr)_auto]"
        >
          <label className="text-dim block text-xs" htmlFor="compare-player-a">
            {t.profile.playerA}
            <select
              id="compare-player-a"
              name="a"
              defaultValue={selectedA}
              className="bevel bg-well text-text focus-visible:outline-gold mt-1 block w-full px-2 py-1.5 text-xs focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <option value="">{t.profile.selectPlayer}</option>
              {members.map((member) => (
                <option key={member.steamId} value={member.steamId}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-dim block text-xs" htmlFor="compare-player-b">
            {t.profile.playerB}
            <select
              id="compare-player-b"
              name="b"
              defaultValue={selectedB}
              className="bevel bg-well text-text focus-visible:outline-gold mt-1 block w-full px-2 py-1.5 text-xs focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <option value="">{t.profile.selectPlayer}</option>
              {members.map((member) => (
                <option key={member.steamId} value={member.steamId}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-dim block text-xs" htmlFor="compare-source">
            {t.profile.source}
            <select
              id="compare-source"
              name="source"
              defaultValue={source}
              className="bevel bg-well text-text focus-visible:outline-gold mt-1 block w-full px-2 py-1.5 text-xs focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <option value="mix">{t.profile.mixTab}</option>
              <option value="faceit">{t.profile.faceitTab}</option>
              <option value="premier">{t.profile.premierTab}</option>
            </select>
          </label>
          <VButton primary type="submit" className="py-1.5 text-xs">
            {t.profile.compareAction}
          </VButton>
        </form>

        {!validPair || guidance ? (
          <Well role="status" className="text-dim mt-3 px-3 py-3 text-xs">
            <p>{guidance ?? t.profile.chooseBothPlayers}</p>
            {members.length >= 2 && !selectedA && !selectedB && (
              <p className="mt-1">{t.profile.choosePlayers}</p>
            )}
          </Well>
        ) : (
          <>
            {source === "mix" ? (
              <div className="mt-3 grid min-w-0 gap-3 md:grid-cols-2">
                {profiles.map((profile, index) =>
                  profile ? (
                    <MixProfileColumn
                      key={profile.player.steamId}
                      profile={profile}
                      groupSlug={groupSlug}
                      date={date}
                      index={index}
                    />
                  ) : null,
                )}
              </div>
            ) : (
              <div className="mt-3 grid min-w-0 gap-3 md:grid-cols-2">
                {profiles.flatMap((profile, index) => {
                  if (!profile) return [];
                  return (
                    <section key={profile.player.steamId} className="min-w-0">
                      <PlayerHeading
                        groupSlug={groupSlug}
                        profile={profile}
                        fallbackName={profile.player.steamId}
                        label={
                          index === 0 ? t.profile.playerA : t.profile.playerB
                        }
                      />
                      <LeetifyProfilePanel
                        steamId={profile.player.steamId}
                        name={profile.player.name}
                        source={source}
                      />
                    </section>
                  );
                })}
              </div>
            )}

            <HeadToHeadSection
              data={headToHead}
              playerA={profiles[0]!.player.name}
              playerB={profiles[1]!.player.name}
              groupSlug={groupSlug}
              date={date}
            />
          </>
        )}
      </Window>
    </main>
  );
}

function PlayerHeading({
  groupSlug,
  profile,
  fallbackName,
  label,
}: {
  groupSlug: string;
  profile: Profile;
  fallbackName: string;
  label: string;
}) {
  return (
    <header className="border-lo mb-2 flex items-baseline justify-between gap-2 border-b pb-1">
      <h2 className="text-gold min-w-0 truncate text-sm font-bold">
        <Link
          href={`/g/${groupSlug}/p/${encodeURIComponent(profile.player.steamId)}`}
          className="underline decoration-1 underline-offset-2"
        >
          {profile.player.name || fallbackName}
        </Link>
      </h2>
      <span className="text-dim shrink-0 text-[11px]">{label}</span>
    </header>
  );
}

function MixProfileColumn({
  profile,
  groupSlug,
  date,
  index,
}: {
  profile: Profile;
  groupSlug: string;
  date: (value: string) => string;
  index: number;
}) {
  const t = useT();
  const { summary } = profile;
  const trendPoints: RatingTrendPoint[] = [...summary.trend]
    .filter((point) => Number.isFinite(point.rating))
    .slice(0, 20)
    .reverse()
    .map((point) => ({
      id: point.id,
      rating: point.rating,
      dateLabel: date(point.at),
      title: t.profile.ratingPoint(
        date(point.at),
        point.map,
        `${point.scoreA}:${point.scoreB}`,
        point.rating.toFixed(2),
      ),
      href: `/g/${groupSlug}/m/${point.mixId}?match=${encodeURIComponent(point.id)}`,
    }));
  return (
    <section className="min-w-0">
      <PlayerHeading
        groupSlug={groupSlug}
        profile={profile}
        fallbackName={profile.player.steamId}
        label={index === 0 ? t.profile.playerA : t.profile.playerB}
      />
      <MixProfileStats
        summary={summary}
        ratings={trendPoints.map((point) => point.rating)}
      />
      <h3 className="text-gold mt-3 mb-1 text-xs font-bold">
        {t.profile.ratingTrend}
      </h3>
      <Well className="px-2 py-1.5">
        <p className="text-dim mb-1 px-1 text-[11px]">
          {t.profile.ratingTrendCount(trendPoints.length, summary.trend.length)}
        </p>
        {trendPoints.length ? (
          <RatingTrend points={trendPoints} label={t.profile.ratingTrend} />
        ) : (
          <p className="text-dim px-1 py-2 text-[11px]">
            {t.profile.noRatings}
          </p>
        )}
      </Well>
      <h3 className="text-gold mt-3 mb-1 text-xs font-bold">
        {t.profile.mapHistory}
      </h3>
      {summary.maps.length ? (
        <Well className="max-h-[32rem] overflow-auto">
          <table className="w-full min-w-[500px] text-left text-xs tabular-nums">
            <thead className="bg-window text-dim sticky top-0">
              <tr>
                <th className="p-2">{t.profile.map}</th>
                <th>{t.profile.score}</th>
                <th>
                  <span className="sr-only">{t.profile.result}</span>
                </th>
                <th>{t.profile.kda}</th>
                <th>{t.profile.adr}</th>
                <th>{t.profile.rating}</th>
              </tr>
            </thead>
            <tbody>
              {summary.maps.slice(0, 20).map((map) => (
                <tr key={map.matchId} className="border-row border-t">
                  <td className="p-2">
                    <Link
                      className="text-gold underline"
                      href={`/g/${groupSlug}/m/${map.mixId}?match=${encodeURIComponent(map.matchId)}`}
                    >
                      {map.mixTitle}
                    </Link>
                    <span className="text-dim block">
                      {date(map.playedAt)} ·{" "}
                      {map.mapName ?? `#${map.mapNumber}`}
                    </span>
                  </td>
                  <td>
                    {map.scoreA}:{map.scoreB}
                  </td>
                  <td
                    className={
                      map.outcome === "win"
                        ? "text-win"
                        : map.outcome === "loss"
                          ? "text-loss"
                          : "text-dim"
                    }
                  >
                    {t.profile.outcome[map.outcome]}
                  </td>
                  <td>
                    {map.stats?.kills === null || !map.stats
                      ? "—"
                      : `${map.stats.kills} / ${map.stats.deaths ?? "—"} / ${map.stats.assists ?? "—"}`}
                  </td>
                  <td>{map.stats?.adr?.toFixed(1) ?? "—"}</td>
                  <td>{map.stats?.rating?.toFixed(2) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Well>
      ) : (
        <Well className="text-dim px-3 py-3 text-[11px]">
          {t.profile.empty}
        </Well>
      )}
    </section>
  );
}

function HeadToHeadSection({
  data,
  playerA,
  playerB,
  groupSlug,
  date,
}: {
  data: HeadToHead;
  playerA: string;
  playerB: string;
  groupSlug: string;
  date: (value: string) => string;
}) {
  const t = useT();
  const maps = data.maps.slice(0, 20);

  return (
    <section className="mt-4">
      <h2 className="text-gold mb-1 text-sm font-bold">
        {t.profile.sharedHistory}
      </h2>
      <Well className="p-2">
        <div className="border-row grid grid-cols-2 gap-x-3 gap-y-2 border-b pb-2 sm:grid-cols-4">
          <div>
            <span className="text-dim block text-[11px]">
              {t.profile.sharedMaps}
            </span>
            <b className="text-gold text-base tabular-nums">
              {data.sharedMaps}
            </b>
          </div>
          <div>
            <span className="text-dim block text-[11px]">
              {t.profile.sharedEvenings}
            </span>
            <b className="text-gold text-base tabular-nums">
              {data.sharedMixes}
            </b>
          </div>
          <div>
            <span className="text-dim block text-[11px]">
              {t.profile.againstEachOther}
            </span>
            <b className="tabular-nums">
              {data.against.maps} {t.profile.maps.toLowerCase()}
            </b>
            <span className="text-dim block text-[11px]">
              {playerA}: {data.against.aWins} {t.profile.wins.toLowerCase()} ·{" "}
              {playerB}: {data.against.bWins} {t.profile.wins.toLowerCase()} ·{" "}
              {data.against.draws} {t.profile.draws.toLowerCase()}
            </span>
          </div>
          <div>
            <span className="text-dim block text-[11px]">
              {t.profile.onSameTeam}
            </span>
            <b className="tabular-nums">
              {data.together.maps} {t.profile.maps.toLowerCase()}
            </b>
            <span className="text-dim block text-[11px]">
              {data.together.wins} {t.profile.wins.toLowerCase()} ·{" "}
              {data.together.losses} {t.profile.losses.toLowerCase()} ·{" "}
              {data.together.draws} {t.profile.draws.toLowerCase()}
            </span>
          </div>
        </div>
        <h3 className="text-gold mt-2 mb-1 text-xs font-bold">
          {t.profile.sharedMapHistory}
        </h3>
        {maps.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-xs tabular-nums">
              <thead className="bg-window text-dim">
                <tr>
                  <th className="p-2">{t.profile.map}</th>
                  <th>{t.profile.score}</th>
                  <th>{t.profile.team}</th>
                  <th>{t.profile.resultForPlayer(playerA)}</th>
                </tr>
              </thead>
              <tbody>
                {maps.map((map) => (
                  <tr key={map.matchId} className="border-row border-t">
                    <td className="p-2">
                      <Link
                        className="text-gold underline"
                        href={`/g/${groupSlug}/m/${map.mixId}?match=${encodeURIComponent(map.matchId)}`}
                      >
                        {map.mixTitle}
                      </Link>
                      <span className="text-dim block">
                        {date(map.playedAt)} · {map.mapName}
                      </span>
                    </td>
                    <td>
                      {map.scoreA}:{map.scoreB}
                    </td>
                    <td>
                      {playerA}:{" "}
                      {map.teamA === "A" ? t.profile.teamA : t.profile.teamB}
                      <span className="text-dim"> · </span>
                      {playerB}:{" "}
                      {map.teamB === "A" ? t.profile.teamA : t.profile.teamB}
                    </td>
                    <td
                      className={
                        map.outcomeA === "win"
                          ? "text-win"
                          : map.outcomeA === "loss"
                            ? "text-loss"
                            : "text-dim"
                      }
                    >
                      {t.profile.outcome[map.outcomeA]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-dim px-1 py-2 text-[11px]">
            {t.profile.noSharedMaps}
          </p>
        )}
      </Well>
    </section>
  );
}
