import {
  getLeetifyMatches,
  getLeetifyProfile,
  LEETIFY_PREMIER_SOURCE,
  toLeetifyMatches,
} from "@/lib/external/leetify";

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
    const profile = await getLeetifyProfile(steamId);
    if (!profile) return json({ error: "not_found" }, 404, false);
    if (profile.privacyMode) {
      return json({ privacyMode: true, matches: [], ranks: profile.ranks });
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
      ranks: profile.ranks,
      faceitMatches,
      premierMatches: toLeetifyMatches(body, steamId, LEETIFY_PREMIER_SOURCE),
    });
  } catch (error) {
    console.error("Leetify route failed", error);
    return json({ error: "unavailable" }, 503, false);
  }
}
