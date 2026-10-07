"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useLang, useT } from "@/components/i18n";
import { Tabs, Well, Window } from "@/components/vgui";
import { LeetifyProfilePanel } from "@/components/leetify/profile-panel";
import { RatingTrend } from "@/components/profile/rating-trend";
import { MixProfileStats } from "@/components/profile/profile-stats";
import type { groupPlayerProfile } from "@/lib/profile/queries";

type Profile = NonNullable<Awaited<ReturnType<typeof groupPlayerProfile>>>;

export function PlayerProfileView({
  groupSlug,
  groupName,
  data,
}: {
  groupSlug: string;
  groupName: string;
  data: Profile;
}) {
  const t = useT();
  const lang = useLang();
  const [source, setSource] = useState<"mix" | "faceit" | "premier">("mix");
  const { player, faceit, summary } = data;
  const date = (value: string) =>
    new Intl.DateTimeFormat(lang === "pl" ? "pl-PL" : "en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Europe/Warsaw",
    }).format(new Date(value));
  const trendPoints = [...summary.trend]
    .reverse()
    .filter((point) => Number.isFinite(point.rating))
    .slice(-20)
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
    <main className="mx-auto w-full max-w-[1180px] flex-1 px-2 pb-12">
      <p className="text-dim mb-2 text-xs">
        <Link href={`/g/${groupSlug}`}>{groupName}</Link>{" "}
        <span aria-hidden>›</span> {t.profile.title}
      </p>
      <Window title={t.profile.title}>
        <div className="flex gap-3">
          <div className="flex items-start gap-3">
            {player.avatarUrl && (
              <Image
                src={player.avatarUrl}
                alt=""
                width={72}
                height={72}
                unoptimized
                className="bevel size-[72px] object-cover"
              />
            )}
            <div className="min-w-0">
              <h1 className="text-gold truncate text-xl font-bold">
                {player.name}
              </h1>
              <p className="text-dim text-xs">{player.steamId}</p>
              {faceit ? (
                <p className="mt-2 text-xs">
                  <a
                    href={faceit.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gold underline"
                  >
                    {t.profile.faceitProfile}
                  </a>
                </p>
              ) : (
                <p className="text-dim mt-2 text-xs">
                  {t.profile.faceitUnavailable}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="mt-3">
          <Tabs
            label={t.profile.source}
            value={source}
            onChange={setSource}
            items={[
              { value: "mix", label: t.profile.mixTab },
              { value: "faceit", label: t.profile.faceitTab },
              { value: "premier", label: t.profile.premierTab },
            ]}
          />
          {source === "mix" ? (
            <>
              <MixProfileStats
                summary={summary}
                ratings={trendPoints.map((point) => point.rating)}
              />
              {summary.mapCount === 0 ? (
                <Well className="text-dim p-4 text-sm">{t.profile.empty}</Well>
              ) : (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)]">
                  <div className="min-w-0">
                    <h2 className="text-gold mb-1 text-sm font-bold">
                      {t.profile.ratingTrend}
                    </h2>
                    <Well>
                      <p className="text-dim mb-1 px-1 text-[11px]">
                        {t.profile.ratingTrendCount(
                          trendPoints.length,
                          summary.trend.length,
                        )}
                      </p>
                      {trendPoints.length ? (
                        <RatingTrend
                          points={trendPoints}
                          label={t.profile.ratingTrend}
                        />
                      ) : (
                        <p className="text-dim p-3 text-xs">
                          {t.profile.noRatings}
                        </p>
                      )}
                    </Well>
                    <h2 className="text-gold mt-4 mb-1 text-sm font-bold">
                      {t.profile.mapHistory}
                    </h2>
                    <Well className="overflow-x-auto">
                      <table className="w-full min-w-[620px] text-left text-xs">
                        <thead className="bg-window text-dim">
                          <tr>
                            <th className="p-2">{t.profile.map}</th>
                            <th>{t.profile.score}</th>
                            <th>
                              <span className="sr-only">
                                {t.profile.result}
                              </span>
                            </th>
                            <th>K / D / A</th>
                            <th>ADR</th>
                            <th>{t.profile.rating}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary.maps.map((map) => (
                            <tr
                              key={map.matchId}
                              className="border-row border-t"
                            >
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
                                {map.faceitRoomUrl && (
                                  <a
                                    className="text-gold text-[11px] underline"
                                    href={map.faceitRoomUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    {t.played.faceitRoom}
                                  </a>
                                )}
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
                              <td>{map.stats?.adr?.toFixed(0) ?? "—"}</td>
                              <td>{map.stats?.rating?.toFixed(2) ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Well>
                  </div>
                  <div>
                    <h2 className="text-gold mb-1 text-sm font-bold">
                      {t.profile.bestTeammates}
                    </h2>
                    <Well className="divide-row divide-y text-xs">
                      {summary.bestTeammates.slice(0, 5).map((mate) => (
                        <div
                          key={mate.id}
                          className="flex items-center justify-between gap-2 p-2"
                        >
                          <Link
                            className="text-gold min-w-0 truncate underline"
                            href={`/g/${groupSlug}/p/${mate.steamId}`}
                          >
                            {mate.name}
                          </Link>
                          <span className="text-dim shrink-0">
                            {mate.wins}/{mate.maps} ·{" "}
                            {Math.round((mate.wins / mate.maps) * 100)}%
                          </span>
                        </div>
                      ))}
                    </Well>
                  </div>
                </div>
              )}
            </>
          ) : (
            <LeetifyProfilePanel
              key={player.steamId}
              steamId={player.steamId}
              name={player.name}
              source={source}
            />
          )}
        </div>
      </Window>
    </main>
  );
}
