// Leetify Public API client (server only). DISPLAY ONLY: cached for five minutes in Next's HTTP
// cache, never stored, recalculated or renamed, and always shown with the required attribution.

import { z } from "zod";
import { requireEnv } from "@/lib/env";
import { getJson, type FetchLike } from "./http";

const API = "https://api-public.cs-prod.leetify.com/v3";
export const LEETIFY_REVALIDATE_S = 300;
export const LEETIFY_PREMIER_SOURCE = "matchmaking" as const;

export type LeetifyDataSource = "faceit" | typeof LEETIFY_PREMIER_SOURCE;

/** One match in the API's team-relative score and Leetify display scale. */
export interface LeetifyMatch {
  finishedAt: string;
  dataSource: LeetifyDataSource;
  matchUrl?: string | null;
  map: string;
  score: [number, number];
  leetifyRating: number | null;
  kad: [number, number, number];
}

const profileSchema = z.object({
  // The live API sends "public" (seen 2026-10-06); older docs show a boolean. Anything else is private.
  privacy_mode: z.union([z.boolean(), z.string()]),
  ranks: z.object({
    faceit: z.number().nullable().optional(),
    faceit_elo: z.number().nullable().optional(),
    premier: z.number().nullable().optional(),
  }),
});

const matchSchema = z.object({
  id: z.string().nullable().optional(),
  finished_at: z.string(),
  data_source: z.string(),
  map_name: z.string(),
  team_scores: z.array(
    z.object({ team_number: z.number(), score: z.number() }),
  ),
  stats: z.array(
    z.object({
      steam64_id: z.string(),
      initial_team_number: z.number(),
      leetify_rating: z.number().nullable(),
      total_kills: z.number(),
      total_assists: z.number(),
      total_deaths: z.number(),
    }),
  ),
});

export interface LeetifyProfile {
  privacyMode: boolean;
  ranks: {
    faceit?: number | null;
    faceit_elo?: number | null;
    premier?: number | null;
  };
}

export interface LeetifyClientOptions {
  apiKey?: string;
  fetch?: FetchLike;
}

export async function getLeetifyProfile(
  steamId: string,
  opts: LeetifyClientOptions = {},
): Promise<LeetifyProfile | null> {
  const body = await getJson(
    `${API}/profile?steam64_id=${encodeURIComponent(steamId)}`,
    profileSchema,
    {
      service: "leetify",
      headers: { _leetify_key: opts.apiKey ?? requireEnv("LEETIFY_API_KEY") },
      revalidate: LEETIFY_REVALIDATE_S,
      fetch: opts.fetch,
      allowNotFound: true,
    },
  );
  return (
    body && {
      privacyMode:
        body.privacy_mode !== false && body.privacy_mode !== "public",
      ranks: body.ranks,
    }
  );
}

/** API match history, with the player's team first and Leetify's displayed rating scale. */
export function toLeetifyMatches(
  body: unknown,
  steamId: string,
  source: LeetifyDataSource,
): LeetifyMatch[] {
  const out: LeetifyMatch[] = [];
  for (const match of z.array(matchSchema).parse(body ?? [])) {
    if (match.data_source !== source) continue;
    const time = Date.parse(match.finished_at);
    if (!Number.isFinite(time)) continue;
    const player = match.stats.find((stat) => stat.steam64_id === steamId);
    if (!player) continue;
    const ours = match.team_scores.find(
      (team) => team.team_number === player.initial_team_number,
    );
    const theirs = match.team_scores.find(
      (team) => team.team_number !== player.initial_team_number,
    );
    if (!ours || !theirs) continue;
    out.push({
      finishedAt: new Date(time).toISOString(),
      dataSource: source,
      matchUrl:
        match.id &&
        /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(match.id)
          ? `https://leetify.com/app/match-details/${match.id}`
          : null,
      map: match.map_name,
      score: [ours.score, theirs.score],
      leetifyRating:
        player.leetify_rating === null
          ? null
          : Math.round(player.leetify_rating * 10000) / 100,
      kad: [player.total_kills, player.total_assists, player.total_deaths],
    });
  }
  return out.sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
}

export function toFaceitMatches(
  body: unknown,
  steamId: string,
  range: { from: Date; to: Date },
): LeetifyMatch[] {
  return toLeetifyMatches(body, steamId, "faceit").filter((match) => {
    const time = Date.parse(match.finishedAt);
    return time >= range.from.getTime() && time < range.to.getTime();
  });
}

export async function getLeetifyMatches(
  steamId: string,
  opts: LeetifyClientOptions = {},
): Promise<unknown | null> {
  return getJson(
    `${API}/profile/matches?steam64_id=${encodeURIComponent(steamId)}`,
    z.unknown(),
    {
      service: "leetify",
      headers: { _leetify_key: opts.apiKey ?? requireEnv("LEETIFY_API_KEY") },
      revalidate: LEETIFY_REVALIDATE_S,
      fetch: opts.fetch,
      allowNotFound: true,
    },
  );
}

/** Last-30-day FACEIT preview for existing server-rendered callers. */
export async function getFaceitMatches(
  steamId: string,
  range: { from: Date; to: Date },
  opts: LeetifyClientOptions = {},
): Promise<LeetifyMatch[] | null> {
  const body = await getLeetifyMatches(steamId, opts);
  return toFaceitMatches(body, steamId, range);
}
