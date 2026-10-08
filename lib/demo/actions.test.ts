import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({
  requireSession: vi.fn(),
  requireGroupRole: vi.fn(),
}));
vi.mock("@/lib/db/admin", () => ({ adminDb: vi.fn() }));
vi.mock("./stats", () => ({
  calculateDemoStats: vi.fn(),
  summarizeDemoRounds: vi.fn(() => []),
}));

import { requireSession, requireGroupRole } from "@/lib/auth/server";
import { AuthError } from "@/lib/auth/roles";
import { adminDb } from "@/lib/db/admin";
import { calculateDemoStats } from "./stats";
import { attachDemoToMatch } from "./actions";

const ids = Array.from({ length: 10 }, (_, i) => `7656119000000000${i}`);
const players = ids.map((steamid, i) => ({
  steamid,
  name: `P${i}`,
  teamId: i < 5 ? "one" : "two",
}));
const uuid = (i: number) =>
  `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
const lineup = ids.map((_, i) => ({
  player_id: uuid(i + 1),
  team: i < 5 ? "A" : "B",
}));
const payload = {
  version: 1,
  demoHash: "a".repeat(64),
  mapName: "de_mirage",
  tickRate: 64,
  regulationRounds: 24,
  players,
  rounds: [
    {
      startTick: 1,
      endTick: 2,
      scoreEndTick: 3,
      winnerTeamId: "one",
      players: players.map((p, i) => ({
        steamid: p.steamid,
        teamId: p.teamId,
        side: i < 5 ? 2 : 3,
        isAlive: true,
        health: 100,
      })),
    },
  ],
  events: [],
  endSnapshots: players.map((p, i) => ({
    steamid: p.steamid,
    tick: 2,
    team_num: i < 5 ? 2 : 3,
    is_alive: true,
    health: 100,
  })),
  controller: ids.map((steamid) => ({
    steamid,
    kills: 0,
    deaths: 0,
    assists: 0,
    damage: 0,
  })),
};
const stats = players.map((p) => ({
  steamid: p.steamid,
  teamId: p.teamId,
  kills: 0,
  deaths: 0,
  assists: 0,
  enemyDamage: 0,
  roundsPlayed: 1,
  adr: 0,
  kastPercent: 100,
  headshotKills: 0,
  kastRounds: 1,
  openingKills: 0,
  openingDeaths: 0,
  tradeKills: 0,
  tradedDeaths: 0,
  multikills: { 2: 0, 3: 0, 4: 0, 5: 0 },
  clutchAttempts: {},
  clutchWins: {},
  utilityDamage: 0,
  enemiesFlashed: 0,
  flashAssists: 0,
}));

function table(data: unknown) {
  const query = {
    select: () => query,
    eq: () => query,
    in: () => query,
    maybeSingle: async () => ({ data, error: null }),
    then: (resolve: (result: { data: unknown; error: null }) => unknown) =>
      resolve({ data, error: null }),
  };
  return query;
}

describe("attachDemoToMatch", () => {
  const rpc = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSession).mockResolvedValue({
      playerId: uuid(99),
    } as never);
    vi.mocked(requireGroupRole).mockResolvedValue({
      playerId: uuid(99),
    } as never);
    vi.mocked(calculateDemoStats).mockReturnValue(stats as never);
    rpc.mockResolvedValue({ error: null });
    vi.mocked(adminDb).mockReturnValue({
      from: (name: string) =>
        table(
          name === "matches"
            ? { id: uuid(80), mix_id: uuid(81) }
            : name === "mixes"
              ? {
                  id: uuid(81),
                  group_id: uuid(82),
                  status: "played",
                  chosen_variant_id: uuid(83),
                }
              : name === "variant_players" || name === "match_player_stats"
                ? lineup
                : ids.map((steam_id, i) => ({ id: uuid(i + 1), steam_id })),
        ),
      rpc,
    } as never);
  });

  it("requires a session before looking up a map", async () => {
    vi.mocked(requireSession).mockRejectedValue(new AuthError(401, "login"));
    expect(await attachDemoToMatch(uuid(80), payload)).toEqual({
      error: "unauthorized",
    });
    expect(adminDb).not.toHaveBeenCalled();
  });

  it("rejects a nonmember before any write", async () => {
    vi.mocked(requireGroupRole).mockRejectedValue(new AuthError(403, "member"));
    expect(await attachDemoToMatch(uuid(80), payload)).toEqual({
      error: "forbidden",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects controller disagreement before the RPC", async () => {
    const mismatched = {
      ...payload,
      controller: payload.controller.map((row, i) =>
        i ? row : { ...row, kills: 1 },
      ),
    };
    expect(await attachDemoToMatch(uuid(80), mismatched)).toEqual({
      error: "controller",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("submits derived score and stats atomically", async () => {
    expect(await attachDemoToMatch(uuid(80), payload)).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith(
      "attach_demo_to_match",
      expect.objectContaining({
        p_score_a: 1,
        p_score_b: 0,
        p_demo_hash: "a".repeat(64),
        p_actor_id: uuid(99),
        p_payload: expect.objectContaining({
          evidence: expect.objectContaining({
            demoHash: "a".repeat(64),
            events: [],
            endSnapshots: payload.endSnapshots,
          }),
        }),
      }),
    );
  });

  it("returns a safe failure when the database throws", async () => {
    vi.mocked(adminDb).mockImplementation(() => {
      throw new Error("network detail");
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await attachDemoToMatch(uuid(80), payload)).toEqual({
      error: "failed",
    });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
