import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_BALANCE_CONFIG } from "@/lib/balance";
import {
  getMatchStats as fetchFaceitStats,
  getPlayerBySteamId as fetchFaceitProfile,
  type FaceitPlayer,
} from "@/lib/external/faceit";
import type { FaceitSource, GenerationMember } from "./generation";

vi.mock("server-only", () => ({}));

const FIXTURES = join(__dirname, "../external/__fixtures__/faceit");
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const playerFiles = readdirSync(join(FIXTURES, "players"));
const steamIds = playerFiles.map((file) => file.replace(".json", "")).sort();
const member = (
  index: number,
  overrides: Partial<GenerationMember> = {},
): GenerationMember => ({
  playerId: `player-${index}`,
  steamId: steamIds[index],
  manualElo: null,
  preferredRole: "any",
  ...overrides,
});

function fixtureSource(): FaceitSource {
  const ids = new Map<string, string>();
  const fixtureFetch = async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/players")) {
      const steamId = url.searchParams.get("game_player_id")!;
      return json(
        JSON.parse(
          readFileSync(join(FIXTURES, "players", `${steamId}.json`), "utf8"),
        ),
      );
    }
    const faceitId = url.pathname.split("/")[4];
    const steamId = ids.get(faceitId)!;
    const body = JSON.parse(
      readFileSync(join(FIXTURES, "games-stats", `${steamId}.json`), "utf8"),
    ) as { items: unknown[] };
    const offset = Number(url.searchParams.get("offset"));
    const limit = Number(url.searchParams.get("limit"));
    return json({ items: body.items.slice(offset, offset + limit) });
  };
  return {
    async getPlayerBySteamId(steamId) {
      const profile = await fetchFaceitProfile(steamId, {
        apiKey: "fixture",
        fetch: fixtureFetch,
      });
      if (profile) ids.set(profile.playerId, steamId);
      return profile;
    },
    async getMatchStats(playerId, range) {
      return fetchFaceitStats(playerId, range, {
        apiKey: "fixture",
        fetch: fixtureFetch,
      });
    },
  };
}

function sourceWith(
  profiles: Record<string, FaceitPlayer | null>,
  failingForms: string[] = [],
): FaceitSource {
  return {
    getPlayerBySteamId: async (steamId) => profiles[steamId] ?? null,
    getMatchStats: async (playerId) => {
      if (failingForms.includes(playerId))
        throw new Error("FACEIT stats unavailable");
      return [];
    },
  };
}

const profile = (
  playerId: string,
  elo: number | null,
  level: number | null = 5,
) => ({
  playerId,
  elo,
  level,
  nickname: playerId,
  avatarUrl: null,
  profileUrl: "https://www.faceit.com/en/players/fixture",
});

describe("mix skill generation", () => {
  const now = new Date("2026-09-27T00:00:00.000Z");

  it("uses the recorded FACEIT profile and games-stats fixtures", async () => {
    const { skillSnapshots } = await import("./generation");
    const selected = member(steamIds.indexOf("76561197993187687"), {
      manualElo: 1200,
    });
    const result = await skillSnapshots([selected], {
      now,
      source: fixtureSource(),
    });
    const snapshot = result[`player-${steamIds.indexOf("76561197993187687")}`];
    expect(snapshot.input.faceitElo).toBe(1797);
    expect(snapshot.input.resolvedElo).toBe(1797);
    expect(snapshot.input.eloSource).toBe("faceit");
    expect(snapshot.input.faceitFormAvailable).toBe(true);
    expect(snapshot.input.faceit?.matches.length).toBeGreaterThan(0);
  });

  it("falls back from FACEIT ELO to the group manual override", async () => {
    const { skillSnapshots } = await import("./generation");
    const selected = member(0, { manualElo: 1620 });
    const result = await skillSnapshots([selected], {
      now,
      source: sourceWith({ [selected.steamId]: profile("profile-0", null) }),
    });
    expect(result[selected.playerId].input).toMatchObject({
      resolvedElo: 1620,
      eloSource: "group-manual",
    });
  });

  it("uses the mean of other sourced ELO values when both direct sources are missing", async () => {
    const { skillSnapshots } = await import("./generation");
    const faceit = member(0);
    const manual = member(1, { manualElo: 1800 });
    const missing = member(2);
    const result = await skillSnapshots([faceit, manual, missing], {
      now,
      source: sourceWith({
        [faceit.steamId]: profile("faceit-0", 1700),
        [manual.steamId]: null,
        [missing.steamId]: null,
      }),
    });
    expect(result[missing.playerId].input).toMatchObject({
      resolvedElo: 1750,
      eloSource: "mix-mean",
    });
  });

  it("uses the neutral default when no player has FACEIT or group ELO", async () => {
    const { skillSnapshots } = await import("./generation");
    const roster = [member(0), member(1), member(2)];
    const result = await skillSnapshots(roster, {
      now,
      source: sourceWith(
        Object.fromEntries(roster.map((p) => [p.steamId, null])),
      ),
    });
    expect(
      Object.values(result).map((snapshot) => [
        snapshot.input.resolvedElo,
        snapshot.input.eloSource,
      ]),
    ).toEqual(roster.map(() => [1500, "neutral-default"]));
  });

  it("records failed FACEIT form as unavailable and scores F as zero", async () => {
    const { skillSnapshots } = await import("./generation");
    const selected = member(3);
    const result = await skillSnapshots([selected], {
      now,
      source: sourceWith({ [selected.steamId]: profile("form-fails", 1750) }, [
        "form-fails",
      ]),
    });
    expect(result[selected.playerId].input.faceitFormAvailable).toBe(false);
    expect(result[selected.playerId].breakdown.contributions.F).toBe(0);
  });

  it("never repeats a split shown in an earlier generation", async () => {
    const { selectedVariants, skillSnapshots } = await import("./generation");
    const roster = steamIds.slice(0, 10).map((_, index) => member(index));
    const snapshots = await skillSnapshots(roster, {
      now,
      source: fixtureSource(),
    });
    const first = selectedVariants(snapshots, roster, DEFAULT_BALANCE_CONFIG);
    const shown = first.generationResult.variants.map((variant) =>
      variant.teamA.map((player) => player.steamId),
    );
    const reroll = selectedVariants(snapshots, roster, DEFAULT_BALANCE_CONFIG, {
      excludedSplits: shown,
    });
    const shownKeys = new Set(
      first.variants.map((variant) => variant.splitKey),
    );
    expect(
      reroll.variants.every((variant) => !shownKeys.has(variant.splitKey)),
    ).toBe(true);
  });
});
