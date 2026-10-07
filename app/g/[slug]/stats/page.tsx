import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  GroupStatisticsView,
  type GroupStatisticsSort,
} from "@/components/groups/group-statistics";
import { getDict } from "@/lib/i18n/server";
import { groupAnalytics } from "@/lib/groups/analytics";
import type { ArchiveScope, Period } from "@/lib/groups/analytics-summary";
import { groupBySlug } from "@/lib/groups/queries";

type SearchValue = string | string[] | undefined;

function parseChoice<T extends string>(
  value: SearchValue,
  choices: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && choices.includes(value as T)
    ? (value as T)
    : fallback;
}

const periods: readonly Period[] = ["all", "30", "90", "365"];
const archives: readonly ArchiveScope[] = ["all", "current", "archive"];
const sortOptions: readonly GroupStatisticsSort[] = [
  "rating",
  "adr",
  "kd",
  "winRate",
  "maps",
];

export async function generateMetadata({
  params,
}: PageProps<"/g/[slug]/stats">): Promise<Metadata> {
  const [group, t] = await Promise.all([
    groupBySlug((await params).slug),
    getDict(),
  ]);
  return {
    title: `${group?.name ?? "Group"} · ${t.groups.statistics.title} · mixer`,
  };
}

export default async function GroupStatisticsPage({
  params,
  searchParams,
}: PageProps<"/g/[slug]/stats">) {
  const [{ slug }, query, t] = await Promise.all([
    params,
    searchParams,
    getDict(),
  ]);
  const group = await groupBySlug(slug);
  if (!group) notFound();

  const period = parseChoice(query.period, periods, "all");
  const archive = parseChoice(query.archive, archives, "all");
  const sort = parseChoice(query.sort, sortOptions, "rating");
  const analytics = await groupAnalytics(group.id, { period, archive });

  return (
    <GroupStatisticsView
      groupSlug={group.slug}
      groupName={group.name}
      analytics={analytics}
      period={period}
      archive={archive}
      sort={sort}
      copy={t.groups.statistics}
      awardLabels={t.played.awardLabels}
    />
  );
}
