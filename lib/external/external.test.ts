import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLifetimeStats,
  getMatchStats,
  getPlayerBySteamId,
  parseMatchStatsPage,
  toFormSamples,
  type FaceitMatchStat,
} from "./faceit";
import { ExternalApiError, type FetchLike } from "./http";
import {
  getPlayerSummaries,
  parseSteamInput,
  resolveSteamInput,
} from "./steam";
import roster from "@/db/seed/roster.json";

const FIXTURES = join(__dirname, "__fixtures__");
const fixture = (path: string): unknown =>
  JSON.parse(readFileSync(join(FIXTURES, path), "utf8"));
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const OWNER = "76561197993187687";
const OWNER_FACEIT_ID = "e881bc29-4d6a-43de-af4d-4a6994130c2d";

/** Fake fetch that records requested URLs and answers from a handler. */
function fakeFetch(handler: (url: URL) => Response) {
  const urls: URL[] = [];
  const fn: FetchLike = async (input) => {
    const url = new URL(input);
    urls.push(url);
    return handler(url);
  };
  return { fn, urls };
}

describe("parseSteamInput", () => {
  it.each([
    [OWNER, { steamId: OWNER }],
    [` ${OWNER} `, { steamId: OWNER }],
    [`https://steamcommunity.com/profiles/${OWNER}/`, { steamId: OWNER }],
    [`steamcommunity.com/profiles/${OWNER}`, { steamId: OWNER }],
    [
      "https://steamcommunity.com/id/gabelogannewell/",
      { vanity: "gabelogannewell" },
    ],
    [
      "http://www.steamcommunity.com/id/some_name?l=polish",
      { vanity: "some_name" },
    ],
    ["some-name", { vanity: "some-name" }],
  ])("%s", (input, expected) => {
    expect(parseSteamInput(input)).toEqual(expected);
  });

  it.each([
    "",
    "a",
    "https://steamcommunity.com/profiles/123",
    "https://example.com/id/x",
    "has space",
  ])("rejects %j", (input) => {
    expect(parseSteamInput(input)).toBeNull();
  });
});

describe("steam client", () => {
  it("maps the recorded player summaries for the whole roster", async () => {
    const { fn, urls } = fakeFetch(() =>
      json(fixture("steam/player-summaries.json")),
    );
    const profiles = await getPlayerSummaries(roster.players, {
      apiKey: "k",
      fetch: fn,
    });
    expect(urls).toHaveLength(1);
    expect(urls[0].searchParams.get("steamids")?.split(",")).toHaveLength(12);
    expect(profiles.map((p) => p.steamId).sort()).toEqual(
      [...roster.players].sort(),
    );
    const owner = profiles.find((p) => p.steamId === OWNER)!;
    expect(owner.name).toBe("katus `iksdel0l~");
    expect(owner.avatarUrl).toMatch(/^https:\/\/avatars\.steamstatic\.com\//);
  });

  it("rejects non-SteamID64 input before calling Steam", async () => {
    const { fn, urls } = fakeFetch(() => json({}));
    await expect(
      getPlayerSummaries(["123"], { apiKey: "k", fetch: fn }),
    ).rejects.toThrow("SteamID64");
    expect(urls).toHaveLength(0);
  });

  it("resolves vanity names, null when Steam has no match", async () => {
    const { fn } = fakeFetch((url) =>
      json(
        fixture(
          url.searchParams.get("vanityurl") === "gabelogannewell"
            ? "steam/resolve-vanity-found.json"
            : "steam/resolve-vanity-missing.json",
        ),
      ),
    );
    const opts = { apiKey: "k", fetch: fn };
    expect(
      await resolveSteamInput(
        "https://steamcommunity.com/id/gabelogannewell",
        opts,
      ),
    ).toBe("76561197960287930");
    expect(await resolveSteamInput("nobody-here", opts)).toBeNull();
    expect(await resolveSteamInput(OWNER, opts)).toBe(OWNER);
    expect(await resolveSteamInput("not a steam thing!", opts)).toBeNull();
  });

  it("does not put the API key in error messages", async () => {
    const { fn } = fakeFetch(() => json({ nope: true }));
    const err = await getPlayerSummaries([OWNER], {
      apiKey: "SECRET",
      fetch: fn,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(ExternalApiError);
    expect(String(err.message)).not.toContain("SECRET");
  });
});

describe("faceit client", () => {
  it("parses every recorded player", async () => {
    const files = readdirSync(join(FIXTURES, "faceit/players"));
    expect(files).toHaveLength(12);
    for (const file of files) {
      const p = await getPlayerBySteamId(file.replace(".json", ""), {
        apiKey: "k",
        fetch: async () => json(fixture(`faceit/players/${file}`)),
      });
      expect(p?.elo).toBeGreaterThan(0);
    }
  });

  it("maps the owner's player and sends the bearer key", async () => {
    const { fn, urls } = fakeFetch(() =>
      json(fixture(`faceit/players/${OWNER}.json`)),
    );
    const seen: RequestInit[] = [];
    const player = await getPlayerBySteamId(OWNER, {
      apiKey: "k",
      fetch: async (input, init) => {
        seen.push(init!);
        return fn(input, init);
      },
    });
    expect(urls[0].searchParams.get("game_player_id")).toBe(OWNER);
    expect((seen[0].headers as Record<string, string>).Authorization).toBe(
      "Bearer k",
    );
    expect(player).toMatchObject({
      playerId: OWNER_FACEIT_ID,
      nickname: "czopo",
      level: 9,
    });
    expect(player!.profileUrl).not.toContain("{lang}");
  });

  it("returns null for a SteamID without a FACEIT account (404)", async () => {
    const p = await getPlayerBySteamId("76561190000000000", {
      apiKey: "k",
      fetch: async () => json({ errors: [] }, 404),
    });
    expect(p).toBeNull();
  });

  it("throws a typed error on other failures", async () => {
    const err = await getPlayerBySteamId(OWNER, {
      apiKey: "k",
      fetch: async () => json({}, 429),
    }).catch((e) => e);
    expect(err).toBeInstanceOf(ExternalApiError);
    expect(err.status).toBe(429);
  });

  it("parses all recorded games-stats pages; strings become numbers", () => {
    let total = 0;
    let withoutAdr = 0;
    for (const file of readdirSync(join(FIXTURES, "faceit/games-stats"))) {
      const stats = parseMatchStatsPage(fixture(`faceit/games-stats/${file}`));
      total += stats.length;
      withoutAdr += stats.filter((s) => s.adr === null).length;
      for (const s of stats) {
        expect(typeof s.kills).toBe("number");
        expect(Number.isNaN(Date.parse(s.finishedAt))).toBe(false);
      }
    }
    expect(total).toBeGreaterThan(500);
    expect(withoutAdr).toBeLessThan(total / 10);
  });

  it("paginates games-stats with millisecond from/to", async () => {
    const page = fixture(`faceit/games-stats/${OWNER}.json`) as {
      items: unknown[];
    };
    const { fn, urls } = fakeFetch((url) => {
      const offset = Number(url.searchParams.get("offset"));
      const limit = Number(url.searchParams.get("limit"));
      return json({ items: page.items.slice(offset, offset + limit) });
    });
    const from = new Date("2026-08-26T00:00:00Z");
    const to = new Date("2026-09-25T00:00:00Z");
    const stats = await getMatchStats(
      OWNER_FACEIT_ID,
      { from, to, maxItems: 150 },
      { apiKey: "k", fetch: fn },
    );
    expect(urls[0].searchParams.get("from")).toBe(String(from.getTime()));
    expect(urls[0].searchParams.get("to")).toBe(String(to.getTime()));
    expect(urls[0].searchParams.get("limit")).toBe("100");
    expect(stats.length).toBe(Math.min(150, page.items.length));
    if (page.items.length > 100)
      expect(urls[1].searchParams.get("limit")).toBe("50");
  });

  it("builds form samples: 5v5 with ADR only, club matches excluded", () => {
    const base: FaceitMatchStat = {
      matchId: "m",
      finishedAt: "2026-09-20T20:00:00.000Z",
      map: "de_nuke",
      gameMode: "5v5",
      competitionId: "queue",
      kills: 20,
      deaths: 15,
      assists: 5,
      rounds: 24,
      adr: 85,
      won: true,
    };
    const samples = toFormSamples(
      [
        base,
        { ...base, matchId: "wingman", gameMode: "2v2" },
        { ...base, matchId: "old", adr: null },
        { ...base, matchId: "club", competitionId: "our-club" },
      ],
      { excludeCompetitionIds: ["our-club"] },
    );
    expect(samples).toHaveLength(1);
    expect(samples[0].finishedAt).toBe(base.finishedAt);
    expect(samples[0].rating).toBeGreaterThan(1);
  });

  it("maps lifetime stats", async () => {
    const life = await getLifetimeStats(OWNER_FACEIT_ID, {
      apiKey: "k",
      fetch: async () => json(fixture(`faceit/lifetime/${OWNER}.json`)),
    });
    expect(life).toMatchObject({ matches: 995, winRatePct: 51 });
    expect(life!.adr).toBeCloseTo(83.72);
  });
});
