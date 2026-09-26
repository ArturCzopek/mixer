// Leetify Public API client (server only). DISPLAY ONLY: Leetify data is fetched live on every
// request, never cached, stored, recalculated or renamed, and always shown with
// "Data Provided by Leetify" (CLAUDE.md, docs/06). Header `_leetify_key` (Bearer returns 401).

import { z } from "zod";
import { requireEnv } from "@/lib/env";
import { getJson, type FetchLike } from "./http";

const API = "https://api-public.cs-prod.leetify.com/v3";

/** One FACEIT match as the Leetify card shows it. */
export interface LeetifyMatch {
  /** `finished_at` */
  finishedAt: string;
  /** `data_source` (the card keeps only "faceit") */
  dataSource: "faceit";
  /** `map_name` */
  map: string;
  /** The player's team rounds : the other team's, from `team_scores`. */
  score: [number, number];
  /**
   * The player's `leetify_rating` in Leetify's own display format (the API's 0.0123 is shown by
   * Leetify as +1.23): formatting only, the number itself is Leetify's.
   */
  leetifyRating: number;
}

const matchSchema = z.object({
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
    }),
  ),
});

export interface LeetifyClientOptions {
  apiKey?: string;
  fetch?: FetchLike;
}

/** The player's FACEIT matches in [from, to), newest first, as Leetify reports them. */
export function toFaceitMatches(
  body: unknown,
  steamId: string,
  range: { from: Date; to: Date },
): LeetifyMatch[] {
  const out: LeetifyMatch[] = [];
  for (const m of z.array(matchSchema).parse(body)) {
    const t = Date.parse(m.finished_at);
    if (m.data_source !== "faceit") continue;
    if (t < range.from.getTime() || t >= range.to.getTime()) continue;
    const me = m.stats.find((s) => s.steam64_id === steamId);
    if (!me || me.leetify_rating === null) continue;
    const ours = m.team_scores.find(
      (s) => s.team_number === me.initial_team_number,
    );
    const theirs = m.team_scores.find(
      (s) => s.team_number !== me.initial_team_number,
    );
    if (!ours || !theirs) continue;
    out.push({
      finishedAt: new Date(t).toISOString(),
      dataSource: "faceit",
      map: m.map_name,
      score: [ours.score, theirs.score],
      leetifyRating: Math.round(me.leetify_rating * 10000) / 100,
    });
  }
  return out.sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
}

/** Live, uncached. Returns null when Leetify does not know the player (404). */
export async function getFaceitMatches(
  steamId: string,
  range: { from: Date; to: Date },
  opts: LeetifyClientOptions = {},
): Promise<LeetifyMatch[] | null> {
  const body = await getJson(
    `${API}/profile/matches?steam64_id=${encodeURIComponent(steamId)}`,
    z.unknown(),
    {
      service: "leetify",
      headers: { _leetify_key: opts.apiKey ?? requireEnv("LEETIFY_API_KEY") },
      revalidate: 0,
      fetch: opts.fetch,
      allowNotFound: true,
    },
  );
  return body === null ? null : toFaceitMatches(body, steamId, range);
}
