import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  calls: [] as unknown[][],
  rows: [] as unknown[],
  error: null as { message: string } | null,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/admin", () => ({
  adminDb: () => ({
    from(table: string) {
      database.calls.push(["from", table]);
      const query = {
        select(selection: unknown) {
          database.calls.push(["select", selection]);
          return this;
        },
        eq(column: string, value: unknown) {
          database.calls.push(["eq", column, value]);
          return this;
        },
        order(column: string, options: unknown) {
          database.calls.push(["order", column, options]);
          return this;
        },
        range(from: number, to: number) {
          database.calls.push(["range", from, to]);
          return this;
        },
        returns() {
          return this;
        },
        then(
          resolve: (value: unknown) => unknown,
          reject?: (reason: unknown) => unknown,
        ) {
          return Promise.resolve({
            data: database.rows,
            error: database.error,
          }).then(resolve, reject);
        },
      };
      return query;
    },
  }),
}));

const { mixRatingHistory } = await import("./variant-service");

describe("mixRatingHistory", () => {
  beforeEach(() => {
    database.calls = [];
    database.rows = [
      {
        map_number: 2,
        played_at: "2026-09-20T20:00:00.000Z",
        stats: [
          { player_id: "rated", rating: "1.23" },
          { player_id: "missing", rating: null },
          { player_id: "invalid", rating: "NaN" },
        ],
      },
      {
        map_number: 1,
        played_at: "2026-09-19T20:00:00.000Z",
        stats: [],
      },
      {
        map_number: 1,
        played_at: "2026-09-18T20:00:00.000Z",
        stats: [{ player_id: "zero", rating: 0 }],
      },
    ];
    database.error = null;
  });

  it("reads only this group's played maps through explicit foreign keys", async () => {
    await expect(mixRatingHistory("group-1")).resolves.toEqual([
      {
        playerId: "rated",
        playedAt: "2026-09-20T20:00:00.000Z",
        mapNumber: 2,
        rating: 1.23,
      },
      {
        playerId: "zero",
        playedAt: "2026-09-18T20:00:00.000Z",
        mapNumber: 1,
        rating: 0,
      },
    ]);

    expect(database.calls).toContainEqual([
      "select",
      "map_number, played_at, mix:mixes!matches_mix_id_fkey!inner(group_id, status), stats:match_player_stats!match_player_stats_match_id_fkey(player_id, rating)",
    ]);
    expect(database.calls).toContainEqual(["eq", "mix.group_id", "group-1"]);
    expect(database.calls).toContainEqual(["eq", "mix.status", "played"]);
    expect(database.calls).toContainEqual(["range", 0, 999]);
  });

  it("reports query failures", async () => {
    database.error = { message: "database unavailable" };
    await expect(mixRatingHistory("group-1")).rejects.toThrow(
      "mixRatingHistory: database unavailable",
    );
  });
});
