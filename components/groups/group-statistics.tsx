import Link from "next/link";
import { VButton, Well, Window } from "@/components/vgui";
import type { Dict } from "@/lib/i18n/dict";
import type { groupAnalytics } from "@/lib/groups/analytics";
import type {
  ArchiveScope,
  Period,
  PlayerAnalytics,
} from "@/lib/groups/analytics-summary";
import type { ReactNode } from "react";

type Analytics = Awaited<ReturnType<typeof groupAnalytics>>;
type StatisticsCopy = Dict["groups"]["statistics"];

export type GroupStatisticsSort = "rating" | "adr" | "kd" | "winRate" | "maps";

const minimumSamples = 5;

function metricValue(
  player: PlayerAnalytics,
  sort: GroupStatisticsSort,
): number | null {
  return player[sort];
}

function metricSamples(
  player: PlayerAnalytics,
  sort: GroupStatisticsSort,
): number {
  switch (sort) {
    case "rating":
      return player.ratedMaps;
    case "adr":
      return player.adrMaps;
    case "kd":
      return player.kdMaps;
    case "winRate":
      return player.maps;
    case "maps":
      return player.maps;
  }
}

function sortedPlayers(players: PlayerAnalytics[], sort: GroupStatisticsSort) {
  return [...players]
    .map((player) => ({
      player,
      samples: metricSamples(player, sort),
      value: metricValue(player, sort),
    }))
    .map((row) => ({
      ...row,
      eligible: row.samples >= minimumSamples && row.value !== null,
    }))
    .sort(
      (a, b) =>
        Number(b.eligible) - Number(a.eligible) ||
        (b.value ?? -Infinity) - (a.value ?? -Infinity) ||
        b.samples - a.samples ||
        a.player.name.localeCompare(b.player.name) ||
        a.player.steamId.localeCompare(b.player.steamId),
    );
}

function number(value: number | null, digits = 2) {
  return value === null ? "—" : value.toFixed(digits);
}

function rate(value: number | null) {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function record(wins: number, losses: number, draws: number) {
  return `${wins}–${losses}–${draws}`;
}

function ProfileName({
  groupSlug,
  steamId,
  name,
  truncate = false,
}: {
  groupSlug: string;
  steamId: string;
  name: string;
  truncate?: boolean;
}) {
  const label = truncate ? (
    <span className="block max-w-[122px] truncate" title={name}>
      {name}
    </span>
  ) : (
    name
  );
  if (!steamId) return <span>{label}</span>;
  return (
    <Link
      href={`/g/${encodeURIComponent(groupSlug)}/p/${encodeURIComponent(steamId)}`}
      className="text-gold underline decoration-1 underline-offset-2 hover:text-white"
    >
      {label}
    </Link>
  );
}

function TableFrame({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="sunk overflow-x-auto" tabIndex={0} aria-label={label}>
      {children}
    </div>
  );
}

export function GroupStatisticsView({
  groupSlug,
  groupName,
  analytics,
  period,
  archive,
  sort,
  copy,
  awardLabels,
}: {
  groupSlug: string;
  groupName: string;
  analytics: Analytics;
  period: Period;
  archive: ArchiveScope;
  sort: GroupStatisticsSort;
  copy: StatisticsCopy;
  awardLabels: Dict["played"]["awardLabels"];
}) {
  const players = sortedPlayers(analytics.leaderboard, sort);
  let playerRank = 0;
  const pairs = [...analytics.teammatePairs].sort(
    (a, b) =>
      Number(b.eligible) - Number(a.eligible) ||
      b.winRate - a.winRate ||
      b.maps - a.maps ||
      a.players[0].name.localeCompare(b.players[0].name) ||
      a.players[1].name.localeCompare(b.players[1].name),
  );
  let pairRank = 0;
  const filterAction = `/g/${encodeURIComponent(groupSlug)}/stats`;

  return (
    <main className="mx-auto w-full max-w-[1180px] flex-1 px-2 py-6">
      <p className="text-dim mb-2 text-xs">
        <Link
          href={`/g/${encodeURIComponent(groupSlug)}`}
          className="underline decoration-1 underline-offset-2 hover:text-white"
        >
          {groupName}
        </Link>{" "}
        <span aria-hidden="true">›</span> {copy.title}
      </p>
      <Window title={copy.title}>
        <div className="space-y-2">
          <p className="text-dim text-[11px]">{copy.intro}</p>
          <form
            method="get"
            action={filterAction}
            className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
          >
            <label className="text-dim block text-xs" htmlFor="stats-period">
              {copy.period}
              <select
                id="stats-period"
                name="period"
                defaultValue={period}
                className="bevel bg-well text-text mt-1 block w-full px-2 py-1.5 text-xs"
              >
                {(["all", "30", "90", "365"] as const).map((option) => (
                  <option key={option} value={option}>
                    {copy.periodOptions[option]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-dim block text-xs" htmlFor="stats-archive">
              {copy.archiveScope}
              <select
                id="stats-archive"
                name="archive"
                defaultValue={archive}
                className="bevel bg-well text-text mt-1 block w-full px-2 py-1.5 text-xs"
              >
                {(["all", "current", "archive"] as const).map((option) => (
                  <option key={option} value={option}>
                    {copy.archiveOptions[option]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-dim block text-xs" htmlFor="stats-sort">
              {copy.sortBy}
              <select
                id="stats-sort"
                name="sort"
                defaultValue={sort}
                className="bevel bg-well text-text mt-1 block w-full px-2 py-1.5 text-xs"
              >
                {(["rating", "adr", "kd", "winRate", "maps"] as const).map(
                  (option) => (
                    <option key={option} value={option}>
                      {copy.sortOptions[option]}
                    </option>
                  ),
                )}
              </select>
            </label>
            <VButton primary type="submit" className="px-3 py-1.5 text-xs">
              {copy.apply}
            </VButton>
          </form>

          <Well
            role="status"
            className="flex flex-wrap items-center gap-x-4 gap-y-1 px-2 py-1.5 text-[11px]"
          >
            <span>
              <b className="text-gold">{analytics.totals.evenings}</b>{" "}
              {copy.evenings}
            </span>
            <span>
              <b className="text-gold">{analytics.totals.maps}</b> {copy.maps}
            </span>
            <span>
              <b className="text-gold">{analytics.totals.scoreOnlyMaps}</b>{" "}
              {copy.scoreOnlyMaps}
            </span>
            <span>
              <b className="text-gold">{analytics.totals.archives}</b>{" "}
              {copy.archives}
            </span>
          </Well>
          <p className="text-dim text-[10px]">
            {copy.sources}:{" "}
            {copy.sourceCounts(
              analytics.totals.sources.faceit,
              analytics.totals.sources.popflash,
              analytics.totals.sources.manual,
              analytics.totals.sources.demo,
            )}
          </p>
          <p className="text-dim text-[10px]">{copy.scoreOnlyNote}</p>
          <p className="text-dim text-[10px]">{copy.weightingNote}</p>

          <nav
            aria-label={copy.sections}
            className="border-lo flex flex-wrap gap-0.5 border-b pb-1"
          >
            {[
              ["leaderboard", copy.leaderboard],
              ["maps", copy.mapsTitle],
              ["pairs", copy.pairsTitle],
              ["awards", copy.awardsTitle],
            ].map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="bevel bg-window text-dim hover:bg-hover hover:text-text px-2 py-1 text-[11px]"
              >
                {label}
              </a>
            ))}
          </nav>

          <section id="leaderboard" aria-labelledby="leaderboard-title">
            <h2
              id="leaderboard-title"
              className="text-text mb-1 text-[13px] font-bold"
            >
              {copy.leaderboard}
            </h2>
            <p className="text-dim mb-1 text-[10px]">{copy.leaderboardNote}</p>
            {players.length === 0 ? (
              <Well className="text-dim px-2 py-2 text-[11px]">
                {analytics.totals.maps === 0 ? copy.emptyScope : copy.noPlayers}
              </Well>
            ) : (
              <TableFrame label={copy.leaderboard}>
                <table className="w-full min-w-[1040px] border-collapse text-left text-[11px]">
                  <thead className="bg-window text-dim text-[10px] tracking-[0.04em] uppercase">
                    <tr>
                      <th scope="col" className="px-2 py-1 font-normal">
                        {copy.rank}
                      </th>
                      <th
                        scope="col"
                        className="bg-window sticky left-0 z-20 w-[150px] max-w-[150px] min-w-[150px] px-2 py-1 font-normal"
                      >
                        {copy.player}
                      </th>
                      <th scope="col" className="px-2 py-1 font-normal">
                        {copy.appearances}
                      </th>
                      <th scope="col" className="px-2 py-1 font-normal">
                        {copy.rating}
                      </th>
                      <th scope="col" className="px-2 py-1 font-normal">
                        {copy.adr}
                      </th>
                      <th scope="col" className="px-2 py-1 font-normal">
                        {copy.kd}
                      </th>
                      <th scope="col" className="px-2 py-1 font-normal">
                        {copy.winRate}
                      </th>
                      <th scope="col" className="px-2 py-1 font-normal">
                        {copy.record}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map(({ player, eligible }) => {
                      if (eligible) playerRank++;
                      const rank = eligible ? playerRank : null;
                      return (
                        <tr
                          key={player.playerId}
                          className="border-row hover:bg-hover border-t"
                        >
                          <td className="text-dim px-2 py-1.5">
                            {rank ?? "—"}
                          </td>
                          <th
                            scope="row"
                            className="bg-well sticky left-0 z-10 w-[150px] max-w-[150px] min-w-[150px] px-2 py-1.5 font-normal"
                          >
                            <ProfileName
                              groupSlug={groupSlug}
                              steamId={player.steamId}
                              name={player.name}
                              truncate
                            />
                          </th>
                          <td className="px-2 py-1.5">
                            {player.maps} · {player.evenings}
                          </td>
                          <td className="px-2 py-1.5">
                            <b>{number(player.rating)}</b>
                            <span className="text-dim block text-[10px]">
                              {player.ratedMaps} {copy.ratedMaps}
                            </span>
                          </td>
                          <td className="px-2 py-1.5">
                            {number(player.adr, 1)}
                            <span className="text-dim block text-[10px]">
                              {player.adrMaps} {copy.adrMaps}
                            </span>
                          </td>
                          <td className="px-2 py-1.5">
                            {number(player.kd)}
                            <span className="text-dim block text-[10px]">
                              {player.kdMaps} {copy.kdMaps}
                            </span>
                          </td>
                          <td className="px-2 py-1.5">
                            {rate(player.winRate)}
                            <span className="text-dim block text-[10px]">
                              {player.maps} {copy.winRateMaps}
                            </span>
                          </td>
                          <td className="px-2 py-1.5">
                            {record(player.wins, player.losses, player.draws)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableFrame>
            )}
          </section>

          <details id="maps" className="border-row border-t pt-2">
            <summary className="bevel bg-window hover:bg-hover text-gold px-2 py-1.5 font-bold">
              {copy.mapsTitle}
            </summary>
            <div className="mt-2">
              {analytics.mapPerformance.length === 0 ? (
                <Well className="text-dim px-2 py-2 text-[11px]">
                  {copy.emptyScope}
                </Well>
              ) : (
                <TableFrame label={copy.mapsTitle}>
                  <table className="w-full min-w-[790px] border-collapse text-left text-[11px]">
                    <thead className="bg-window text-dim text-[10px] tracking-[0.04em] uppercase">
                      <tr>
                        <th scope="col" className="px-2 py-1 font-normal">
                          {copy.map}
                        </th>
                        <th scope="col" className="px-2 py-1 font-normal">
                          {copy.played}
                        </th>
                        <th scope="col" className="px-2 py-1 font-normal">
                          {copy.sharedEvenings}
                        </th>
                        <th scope="col" className="px-2 py-1 font-normal">
                          {copy.mapRecord}
                        </th>
                        <th scope="col" className="px-2 py-1 font-normal">
                          {copy.averageScore}
                        </th>
                        <th scope="col" className="px-2 py-1 font-normal">
                          {copy.player}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.mapPerformance.map((map) => (
                        <tr
                          key={map.name}
                          className="border-row border-t align-top"
                        >
                          <th scope="row" className="px-2 py-1.5 font-bold">
                            {map.name || copy.unnamedMap}
                          </th>
                          <td className="px-2 py-1.5">{map.maps}</td>
                          <td className="px-2 py-1.5">{map.evenings}</td>
                          <td className="px-2 py-1.5">
                            {map.winsA}–{map.draws}–{map.winsB}
                          </td>
                          <td className="px-2 py-1.5">
                            {number(map.scoreA / map.maps, 1)}:
                            {number(map.scoreB / map.maps, 1)}
                          </td>
                          <td className="px-2 py-1.5">
                            <details>
                              <summary className="text-gold underline decoration-1 underline-offset-2">
                                {copy.playerDetails(map.players.length)}
                              </summary>
                              {map.players.length === 0 ? (
                                <p className="text-dim mt-1">
                                  {copy.noMapPlayers}
                                </p>
                              ) : (
                                <div className="mt-1 min-w-[440px]">
                                  <table className="w-full border-collapse text-[10px]">
                                    <thead className="text-dim bg-window">
                                      <tr>
                                        <th
                                          scope="col"
                                          className="px-1.5 py-1 font-normal"
                                        >
                                          {copy.player}
                                        </th>
                                        <th
                                          scope="col"
                                          className="px-1.5 py-1 font-normal"
                                        >
                                          {copy.rating} · {copy.ratedMaps}
                                        </th>
                                        <th
                                          scope="col"
                                          className="px-1.5 py-1 font-normal"
                                        >
                                          {copy.adr} · {copy.adrMaps}
                                        </th>
                                        <th
                                          scope="col"
                                          className="px-1.5 py-1 font-normal"
                                        >
                                          {copy.kd} · {copy.kdMaps}
                                        </th>
                                        <th
                                          scope="col"
                                          className="px-1.5 py-1 font-normal"
                                        >
                                          {copy.record}
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {map.players.map((player) => (
                                        <tr
                                          key={player.playerId}
                                          className="border-row border-t"
                                        >
                                          <th
                                            scope="row"
                                            className="px-1.5 py-1 font-normal"
                                          >
                                            <ProfileName
                                              groupSlug={groupSlug}
                                              steamId={player.steamId}
                                              name={player.name}
                                            />
                                          </th>
                                          <td className="px-1.5 py-1">
                                            {number(player.rating)} (
                                            {player.ratedMaps})
                                          </td>
                                          <td className="px-1.5 py-1">
                                            {number(player.adr, 1)} (
                                            {player.adrMaps})
                                          </td>
                                          <td className="px-1.5 py-1">
                                            {number(player.kd)} ({player.kdMaps}
                                            )
                                          </td>
                                          <td className="px-1.5 py-1">
                                            {record(
                                              player.wins,
                                              player.losses,
                                              player.draws,
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </details>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableFrame>
              )}
            </div>
          </details>

          <details id="pairs" className="border-row border-t pt-2">
            <summary className="bevel bg-window hover:bg-hover text-gold px-2 py-1.5 font-bold">
              {copy.pairsTitle}
            </summary>
            <div className="mt-2">
              <p className="text-dim mb-1 text-[10px]">{copy.pairsNote}</p>
              {pairs.length === 0 ? (
                <Well className="text-dim px-2 py-2 text-[11px]">
                  {copy.noPairs}
                </Well>
              ) : (
                <TableFrame label={copy.pairsTitle}>
                  <table className="w-full min-w-[760px] border-collapse text-left text-[11px]">
                    <thead className="bg-window text-dim text-[10px] tracking-[0.04em] uppercase">
                      <tr>
                        <th scope="col" className="px-2 py-1 font-normal">
                          {copy.rank}
                        </th>
                        <th scope="col" className="px-2 py-1 font-normal">
                          {copy.pair}
                        </th>
                        <th scope="col" className="px-2 py-1 font-normal">
                          {copy.sharedMaps}
                        </th>
                        <th scope="col" className="px-2 py-1 font-normal">
                          {copy.sharedEvenings}
                        </th>
                        <th scope="col" className="px-2 py-1 font-normal">
                          {copy.pairRecord}
                        </th>
                        <th scope="col" className="px-2 py-1 font-normal">
                          {copy.pairWinRate}
                        </th>
                        <th scope="col" className="px-2 py-1 font-normal">
                          {copy.sample}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pairs.map((pair) => {
                        if (pair.eligible) pairRank++;
                        return (
                          <tr
                            key={`${pair.players[0].playerId}:${pair.players[1].playerId}`}
                            className="border-row border-t"
                          >
                            <td className="text-dim px-2 py-1.5">
                              {pair.eligible ? pairRank : "—"}
                            </td>
                            <th scope="row" className="px-2 py-1.5 font-normal">
                              <ProfileName
                                groupSlug={groupSlug}
                                steamId={pair.players[0].steamId}
                                name={pair.players[0].name}
                              />
                              <span className="text-dim"> · </span>
                              <ProfileName
                                groupSlug={groupSlug}
                                steamId={pair.players[1].steamId}
                                name={pair.players[1].name}
                              />
                            </th>
                            <td className="px-2 py-1.5">{pair.maps}</td>
                            <td className="px-2 py-1.5">{pair.evenings}</td>
                            <td className="px-2 py-1.5">
                              {record(pair.wins, pair.losses, pair.draws)}
                            </td>
                            <td className="px-2 py-1.5">
                              {rate(pair.winRate)}
                            </td>
                            <td className="px-2 py-1.5">
                              {pair.eligible
                                ? copy.eligible
                                : copy.belowMinimum}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </TableFrame>
              )}
            </div>
          </details>

          <details id="awards" className="border-row border-t pt-2">
            <summary className="bevel bg-window hover:bg-hover text-gold px-2 py-1.5 font-bold">
              {copy.awardsTitle}
            </summary>
            <div className="mt-2">
              {analytics.awards.length === 0 ? (
                <Well className="text-dim px-2 py-2 text-[11px]">
                  {copy.noAwards}
                </Well>
              ) : (
                <TableFrame label={copy.awardsTitle}>
                  <table className="w-full min-w-[600px] border-collapse text-left text-[11px]">
                    <thead className="bg-window text-dim text-[10px] tracking-[0.04em] uppercase">
                      <tr>
                        <th scope="col" className="px-2 py-1 font-normal">
                          {copy.award}
                        </th>
                        <th scope="col" className="px-2 py-1 font-normal">
                          {copy.awardCount}
                        </th>
                        <th scope="col" className="px-2 py-1 font-normal">
                          {copy.awardLeaders}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.awards.map((award) => (
                        <tr key={award.key} className="border-row border-t">
                          <th scope="row" className="px-2 py-1.5 font-normal">
                            {awardLabels[award.key][0]}
                          </th>
                          <td className="px-2 py-1.5">{award.total}</td>
                          <td className="px-2 py-1.5">
                            <span className="flex flex-wrap gap-x-3 gap-y-1">
                              {award.leaders.map((leader) => (
                                <span key={leader.playerId}>
                                  <ProfileName
                                    groupSlug={groupSlug}
                                    steamId={leader.steamId}
                                    name={leader.name}
                                  />{" "}
                                  <span className="text-dim">
                                    ×{leader.count}
                                  </span>
                                </span>
                              ))}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableFrame>
              )}
            </div>
          </details>
        </div>
      </Window>
    </main>
  );
}
