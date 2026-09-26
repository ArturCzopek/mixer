// FACEIT Data API v4 client (server only). Field names, units and limits: docs/06-external-apis.md
// "Spike S3 findings". Stat values arrive as strings; games-stats `from`/`to` are milliseconds.
// FACEIT is optional (D21): every lookup can come back empty and callers must cope.

import { z } from "zod";
import { requireEnv } from "@/lib/env";
import { faceitMatchRating, type FaceitMatchSample } from "@/lib/balance";
import { getJson, type FetchLike } from "./http";

const API = "https://open.faceit.com/data/v4";
/** ELO and recent matches change during a match evening; 10 minutes (docs/06). */
const REVALIDATE_S = 600;
const PAGE_SIZE = 100;

/** Numeric string such as `"104.2"`; rejects empty strings instead of coercing them to 0. */
const num = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/)
  .transform(Number);

export interface FaceitClientOptions {
  apiKey?: string;
  fetch?: FetchLike;
}

const auth = (opts: FaceitClientOptions) => ({
  Authorization: `Bearer ${opts.apiKey ?? requireEnv("FACEIT_API_KEY")}`,
});

// --- player -----------------------------------------------------------------------------------

const playerSchema = z.object({
  player_id: z.string(),
  nickname: z.string(),
  avatar: z.string(),
  faceit_url: z.string(),
  steam_id_64: z.string().optional(),
  games: z.object({
    cs2: z
      .object({
        game_player_id: z.string(),
        faceit_elo: z.number(),
        skill_level: z.number(),
      })
      .optional(),
  }),
});

export interface FaceitPlayer {
  playerId: string;
  nickname: string;
  avatarUrl: string | null;
  profileUrl: string;
  /** null when the account has no CS2 ELO. */
  elo: number | null;
  level: number | null;
}

/** The FACEIT account linked to a SteamID, or null if there is none. */
export async function getPlayerBySteamId(
  steamId: string,
  opts: FaceitClientOptions = {},
): Promise<FaceitPlayer | null> {
  const p = await getJson(
    `${API}/players?game=cs2&game_player_id=${encodeURIComponent(steamId)}`,
    playerSchema,
    {
      service: "faceit",
      headers: auth(opts),
      revalidate: REVALIDATE_S,
      fetch: opts.fetch,
      allowNotFound: true,
    },
  );
  if (!p) return null;
  const cs2 = p.games.cs2;
  return {
    playerId: p.player_id,
    nickname: p.nickname,
    avatarUrl: p.avatar || null,
    profileUrl: p.faceit_url.replace("{lang}", "en"),
    elo: cs2 && cs2.faceit_elo > 0 ? cs2.faceit_elo : null,
    level: cs2 && cs2.skill_level > 0 ? cs2.skill_level : null,
  };
}

// --- per-match stats (form F) -----------------------------------------------------------------

const matchStatSchema = z.object({
  stats: z.object({
    "Match Id": z.string(),
    "Match Finished At": z.number(),
    Map: z.string(),
    "Game Mode": z.string(),
    "Competition Id": z.string().optional(),
    Kills: num,
    Deaths: num,
    Assists: num,
    Rounds: num,
    Result: z.enum(["0", "1"]),
    // Missing on some 2023 – early 2024 matches (S3).
    ADR: num.optional(),
  }),
});

const matchStatsPageSchema = z.object({ items: z.array(matchStatSchema) });

export interface FaceitMatchStat {
  matchId: string;
  /** ISO 8601. */
  finishedAt: string;
  map: string;
  gameMode: string;
  competitionId: string | null;
  kills: number;
  deaths: number;
  assists: number;
  rounds: number;
  /** null for old matches without damage data. */
  adr: number | null;
  won: boolean;
}

export function toMatchStat(
  item: z.infer<typeof matchStatSchema>,
): FaceitMatchStat {
  const s = item.stats;
  return {
    matchId: s["Match Id"],
    finishedAt: new Date(s["Match Finished At"]).toISOString(),
    map: s.Map,
    gameMode: s["Game Mode"],
    competitionId: s["Competition Id"] ?? null,
    kills: s.Kills,
    deaths: s.Deaths,
    assists: s.Assists,
    rounds: s.Rounds,
    adr: s.ADR ?? null,
    won: s.Result === "1",
  };
}

export function parseMatchStatsPage(body: unknown): FaceitMatchStat[] {
  return matchStatsPageSchema.parse(body).items.map(toMatchStat);
}

/**
 * The player's CS2 matches (one item per map), newest first, finished between `from` and `to`.
 * Stops after `maxItems` (docs/04 uses the last ~100–200 as history for F).
 */
export async function getMatchStats(
  playerId: string,
  range: { from?: Date; to?: Date; maxItems?: number },
  opts: FaceitClientOptions = {},
): Promise<FaceitMatchStat[]> {
  const maxItems = range.maxItems ?? 200;
  const out: FaceitMatchStat[] = [];
  for (let offset = 0; offset < maxItems; offset += PAGE_SIZE) {
    const limit = Math.min(PAGE_SIZE, maxItems - offset);
    const params = new URLSearchParams({
      offset: String(offset),
      limit: String(limit),
    });
    // Milliseconds here, unlike /history (seconds): seconds silently return 0 items.
    if (range.from) params.set("from", String(range.from.getTime()));
    if (range.to) params.set("to", String(range.to.getTime()));
    const page = await getJson(
      `${API}/players/${encodeURIComponent(playerId)}/games/cs2/stats?${params}`,
      matchStatsPageSchema,
      {
        service: "faceit",
        headers: auth(opts),
        revalidate: REVALIDATE_S,
        fetch: opts.fetch,
      },
    );
    out.push(...page.items.map(toMatchStat));
    if (page.items.length < limit) break;
  }
  return out;
}

/**
 * Samples for form F: 5v5 matches with damage data, minus our own club matches
 * (mixes must not count as FACEIT form, docs/06).
 */
export function toFormSamples(
  stats: FaceitMatchStat[],
  opts: { excludeCompetitionIds?: string[] } = {},
): FaceitMatchSample[] {
  const excluded = new Set(opts.excludeCompetitionIds ?? []);
  return stats
    .filter(
      (m) =>
        m.gameMode === "5v5" &&
        m.adr !== null &&
        m.rounds > 0 &&
        !(m.competitionId && excluded.has(m.competitionId)),
    )
    .map((m) => ({
      finishedAt: m.finishedAt,
      rating: faceitMatchRating({
        kills: m.kills,
        deaths: m.deaths,
        assists: m.assists,
        rounds: m.rounds,
        adr: m.adr!,
      }),
    }));
}
