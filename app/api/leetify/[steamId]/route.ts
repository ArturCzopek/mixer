import {
  getLeetifyMatches,
  getLeetifyProfile,
  LEETIFY_PREMIER_SOURCE,
  toLeetifyMatches,
} from "@/lib/external/leetify";
import { getPlayerBySteamId } from "@/lib/external/faceit";
import { adminDb } from "@/lib/db/admin";

/**
 * Only players Mixer already knows: otherwise anyone could enumerate SteamIDs through our Leetify
 * and FACEIT keys and burn their rate limits (security audit 2026-11-07).
 */
async function knownPlayer(steamId: string): Promise<boolean> {
  const { data, error } = await adminDb()
    .from("players")
    .select("id")
    .eq("steam_id", steamId)
    .maybeSingle();
  if (error) throw new Error(`Leetify player lookup: ${error.message}`);
  return !!data;
}

export const revalidate = 300;

const steamIdPattern = /^[0-9]{17}$/;
const cachedHeaders = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
};

function json(body: unknown, status = 200, cached = status === 200) {
  return Response.json(body, {
    status,
    headers: cached ? cachedHeaders : { "Cache-Control": "no-store" },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ steamId: string }> },
) {
  const { steamId } = await params;
  if (!steamIdPattern.test(steamId))
    return json({ error: "invalid_steam_id" }, 400, false);

  const view = new URL(request.url).searchParams.get("view") ?? "profile";
  if (view !== "profile" && view !== "preview")
    return json({ error: "invalid_view" }, 400, false);

  try {
    if (!(await knownPlayer(steamId)))
      return json({ error: "not_found" }, 404, false);
    const profile = await getLeetifyProfile(steamId);
    if (!profile) return json({ error: "not_found" }, 404, false);
    const ranks =
      view === "profile"
        ? await getPlayerBySteamId(steamId)
            .then((faceit) => ({
              ...profile.ranks,
              faceit: faceit?.level ?? null,
              faceit_elo: faceit?.elo ?? null,
            }))
            .catch(() => ({
              ...profile.ranks,
              faceit: null,
              faceit_elo: null,
            }))
        : profile.ranks;
    if (profile.privacyMode) {
      return json({ privacyMode: true, matches: [], ranks });
    }

    const body = await getLeetifyMatches(steamId);
    const faceitMatches = toLeetifyMatches(body, steamId, "faceit");
    if (view === "preview") {
      const to = Date.now();
      const from = to - 30 * 86_400_000;
      return json({
        privacyMode: false,
        matches: faceitMatches.filter((match) => {
          const time = Date.parse(match.finishedAt);
          return time >= from && time < to;
        }),
      });
    }

    return json({
      privacyMode: false,
      ranks,
      faceitMatches,
      premierMatches: toLeetifyMatches(body, steamId, LEETIFY_PREMIER_SOURCE),
    });
  } catch (error) {
    console.error("Leetify route failed", error);
    return json({ error: "unavailable" }, 503, false);
  }
}
