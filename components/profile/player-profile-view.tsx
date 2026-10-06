"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useLang, useT } from "@/components/i18n";
import { Tabs, Well, Window } from "@/components/vgui";
import { LeetifyProfilePanel } from "@/components/leetify/profile-panel";
import type { groupPlayerProfile } from "@/lib/profile/queries";

type Profile = NonNullable<Awaited<ReturnType<typeof groupPlayerProfile>>>;

function RatingTrend({ points }: { points: Profile["summary"]["trend"] }) {
  const t = useT();
  if (!points.length)
    return <p className="text-dim p-3 text-xs">{t.profile.noRatings}</p>;
  const chronological = [...points].reverse().slice(-20);
  const values = chronological.map((point) => point.rating);
  const low = Math.min(...values, 0.8) - 0.08;
  const high = Math.max(...values, 1.2) + 0.08;
  const x = (index: number) =>
    chronological.length === 1
      ? 300
      : 26 + (index * 548) / (chronological.length - 1);
  const y = (value: number) => 132 - ((value - low) / (high - low)) * 116;
  const path = chronological
    .map(
      (point, index) =>
        `${index ? "L" : "M"}${x(index).toFixed(1)},${y(point.rating).toFixed(1)}`,
    )
    .join(" ");
  return (
    <svg
      viewBox="0 0 600 150"
      role="img"
      aria-label={t.profile.ratingTrend}
      className="h-36 w-full"
      preserveAspectRatio="none"
    >
      <line
        x1="26"
        x2="574"
        y1={y(1)}
        y2={y(1)}
        stroke="currentColor"
        className="text-dim"
        strokeDasharray="3 5"
        opacity="0.55"
      />
      <path d={path} fill="none" stroke="var(--color-gold)" strokeWidth="2.5" />
      {chronological.map((point, index) => (
        <circle
          key={point.id}
          cx={x(index)}
          cy={y(point.rating)}
          r="3.5"
          fill="var(--color-gold)"
        >
          <title>{`${point.at.slice(0, 10)} ·${point.rating.toFixed(2)}`}</title>
        </circle>
      ))}
    </svg>
  );
}

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
  return (
    <main className="mx-auto w-full max-w-[1180px] flex-1 px-2 pb-12">
      <p className="text-dim mb-2 text-xs">
        <Link href={`/g/${groupSlug}`}>{groupName}</Link>{" "}
        <span aria-hidden>›</span> {t.profile.title}
      </p>
      <Window title={t.profile.title}>
        <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_minmax(0,2fr)]">
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
                  {t.profile.faceitLevel}: <b>{faceit.level ?? "—"}</b> · ELO:{" "}
                  <b>{faceit.elo ?? "—"}</b>
                  <br />
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
          <Well className="grid grid-cols-2 gap-x-3 gap-y-2 p-3 text-xs sm:grid-cols-4">
            <div>
              <span className="text-dim block">{t.profile.maps}</span>
              <b className="text-gold text-lg">{summary.mapCount}</b>
            </div>
            <div>
              <span className="text-dim block">{t.profile.winRate}</span>
              <b className="text-gold text-lg">
                {summary.winRate === null
                  ? "—"
                  : `${Math.round(summary.winRate * 100)}%`}
              </b>
            </div>
            <div>
              <span className="text-dim block">{t.profile.record}</span>
              <b>
                {summary.wins} / {summary.losses} / {summary.draws}
              </b>
            </div>
            <div>
              <span className="text-dim block">{t.profile.rating}</span>
              <b>{summary.rating === null ? "—" : summary.rating.toFixed(2)}</b>
            </div>
            <div>
              <span className="text-dim block">K / D / A</span>
              <b>
                {summary.ratedMaps
                  ? `${summary.kills} / ${summary.deaths} / ${summary.assists}`
                  : "—"}
              </b>
            </div>
            <div>
              <span className="text-dim block">ADR</span>
              <b>{summary.adr === null ? "—" : summary.adr.toFixed(1)}</b>
            </div>
            <div className="col-span-2">
              <span className="text-dim block">{t.profile.ratedMaps}</span>
              <b>
                {summary.ratedMaps} / {summary.mapCount}
              </b>
            </div>
          </Well>
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
            summary.mapCount === 0 ? (
              <Well className="text-dim p-4 text-sm">{t.profile.empty}</Well>
            ) : (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)]">
                <div className="min-w-0">
                  <h2 className="text-gold mb-1 text-sm font-bold">
                    {t.profile.ratingTrend}
                  </h2>
                  <Well>
                    <RatingTrend points={summary.trend} />
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
                          <th>{t.profile.result}</th>
                          <th>K / D / A</th>
                          <th>ADR</th>
                          <th>{t.profile.rating}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.maps.map((map) => (
                          <tr key={map.matchId} className="border-row border-t">
                            <td className="p-2">
                              <Link
                                className="text-gold underline"
                                href={`/g/${groupSlug}/m/${map.mixId}`}
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
            )
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
