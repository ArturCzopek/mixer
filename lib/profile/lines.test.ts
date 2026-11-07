import { describe, expect, it } from "vitest";
import { profileLines, type LineStats } from "./lines";

const mix = { id: "m1", title: "Mix", chosen_variant_id: "v1" };
const match = (id: string, mapNumber: number) => ({
  id,
  mix_id: "m1",
  map_number: mapNumber,
  map_name: "Mirage",
  played_at: "2026-10-13T20:00:00Z",
  score_a: 13,
  score_b: 7,
  faceit_match_id: null,
});
// Voted lineup: me + ally on A, rival on B.
const variantPlayers = [
  { variant_id: "v1", player_id: "me", team: "A" },
  { variant_id: "v1", player_id: "ally", team: "A" },
  { variant_id: "v1", player_id: "rival", team: "B" },
];
const stat = (playerId: string, team: string): LineStats => ({
  match_id: "x1",
  player_id: playerId,
  team,
  kills: 10,
  deaths: 8,
  assists: 2,
  adr: "80.5",
  rounds: 20,
  rating: "1.1",
});
const mates = new Map(
  ["me", "ally", "rival"].map((id) => [
    id,
    { id, steamId: `s-${id}`, name: id },
  ]),
);

describe("profileLines", () => {
  it("uses the recorded side when the evening's sides differ from the vote", () => {
    // On the night me and rival swapped sides.
    const [line] = profileLines({
      playerId: "me",
      mixes: [mix],
      matches: [match("x1", 1)],
      variantPlayers,
      stats: [stat("me", "B"), stat("ally", "A"), stat("rival", "B")],
      mates,
    });
    expect(line.team).toBe("B");
    expect(line.teammates.map((m) => m.id)).toEqual(["rival"]);
    expect(line.stats).toMatchObject({ kills: 10, adr: 80.5, rating: 1.1 });
  });

  it("falls back to the voted lineup on score-only maps", () => {
    const [line] = profileLines({
      playerId: "me",
      mixes: [mix],
      matches: [match("x2", 2)],
      variantPlayers,
      stats: [],
      mates,
    });
    expect(line.team).toBe("A");
    expect(line.teammates.map((m) => m.id)).toEqual(["ally"]);
    expect(line.stats).toBeNull();
  });

  it("keeps a player who is only in the recorded stats", () => {
    const lines = profileLines({
      playerId: "standin",
      mixes: [mix],
      matches: [match("x1", 1)],
      variantPlayers,
      stats: [stat("standin", "A"), stat("ally", "A")],
      mates,
    });
    expect(lines).toHaveLength(1);
    expect(lines[0].team).toBe("A");
  });
});
