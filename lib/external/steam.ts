// Steam Web API client (server only): player summaries and vanity URL resolution.
// docs/06-external-apis.md. SteamID64 is always a string.

import { z } from "zod";
import { requireEnv } from "@/lib/env";
import { getJson, type FetchLike } from "./http";

const API = "https://api.steampowered.com";
/** Names and avatars change rarely; an hour of caching is plenty. */
const REVALIDATE_S = 3600;
const MAX_IDS_PER_CALL = 100;

const STEAM_ID64 = /^7656119\d{10}$/;

export function isSteamId64(value: string): boolean {
  return STEAM_ID64.test(value);
}

export type SteamInput = { steamId: string } | { vanity: string };

/**
 * Parse what an admin pastes when adding a player: a SteamID64, a profile URL
 * (`/profiles/<id>` or `/id/<vanity>`) or a bare vanity name. Returns null if it is none of these.
 */
export function parseSteamInput(raw: string): SteamInput | null {
  const input = raw.trim();
  if (isSteamId64(input)) return { steamId: input };

  const url = input.match(
    /^(?:https?:\/\/)?(?:www\.)?steamcommunity\.com\/(profiles|id)\/([^/?#]+)\/?(?:[?#].*)?$/i,
  );
  if (url) {
    const [, kind, value] = url;
    if (kind.toLowerCase() === "profiles") {
      return isSteamId64(value) ? { steamId: value } : null;
    }
    return { vanity: decodeURIComponent(value) };
  }

  // Steam custom URLs: letters, digits, `_` and `-`, 2–32 chars.
  return /^[A-Za-z0-9_-]{2,32}$/.test(input) ? { vanity: input } : null;
}

const playerSummarySchema = z.object({
  steamid: z.string().regex(STEAM_ID64),
  personaname: z.string(),
  profileurl: z.string(),
  avatarfull: z.string(),
  /** 3 = public profile. */
  communityvisibilitystate: z.number(),
});

const summariesSchema = z.object({
  response: z.object({ players: z.array(playerSummarySchema) }),
});

export interface SteamProfile {
  steamId: string;
  name: string;
  avatarUrl: string;
  profileUrl: string;
  isPublic: boolean;
}

export interface SteamClientOptions {
  apiKey?: string;
  fetch?: FetchLike;
}

const apiKey = (opts: SteamClientOptions) =>
  opts.apiKey ?? requireEnv("STEAM_WEB_API_KEY");

/** Profiles for the given SteamIDs. Unknown IDs are simply missing from the result. */
export async function getPlayerSummaries(
  steamIds: string[],
  opts: SteamClientOptions = {},
): Promise<SteamProfile[]> {
  const ids = [...new Set(steamIds)];
  const bad = ids.find((id) => !isSteamId64(id));
  if (bad !== undefined) throw new Error(`Not a SteamID64: ${bad}`);

  const out: SteamProfile[] = [];
  for (let i = 0; i < ids.length; i += MAX_IDS_PER_CALL) {
    const chunk = ids.slice(i, i + MAX_IDS_PER_CALL);
    const url = `${API}/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey(opts)}&steamids=${chunk.join(",")}`;
    const data = await getJson(url, summariesSchema, {
      service: "steam",
      revalidate: REVALIDATE_S,
      fetch: opts.fetch,
    });
    for (const p of data.response.players) {
      out.push({
        steamId: p.steamid,
        name: p.personaname,
        avatarUrl: p.avatarfull,
        profileUrl: p.profileurl,
        isPublic: p.communityvisibilitystate === 3,
      });
    }
  }
  return out;
}

const vanitySchema = z.object({
  response: z.union([
    z.object({ success: z.literal(1), steamid: z.string().regex(STEAM_ID64) }),
    z.object({ success: z.number(), message: z.string().optional() }),
  ]),
});

/** SteamID64 for a custom profile URL name, or null if no profile uses it. */
export async function resolveVanityUrl(
  vanity: string,
  opts: SteamClientOptions = {},
): Promise<string | null> {
  const url = `${API}/ISteamUser/ResolveVanityURL/v1/?key=${apiKey(opts)}&vanityurl=${encodeURIComponent(vanity)}`;
  const data = await getJson(url, vanitySchema, {
    service: "steam",
    revalidate: REVALIDATE_S,
    fetch: opts.fetch,
  });
  return "steamid" in data.response ? data.response.steamid : null;
}

/** SteamID64 for anything `parseSteamInput` accepts; null if it cannot be resolved. */
export async function resolveSteamInput(
  raw: string,
  opts: SteamClientOptions = {},
): Promise<string | null> {
  const parsed = parseSteamInput(raw);
  if (!parsed) return null;
  if ("steamId" in parsed) return parsed.steamId;
  return resolveVanityUrl(parsed.vanity, opts);
}
