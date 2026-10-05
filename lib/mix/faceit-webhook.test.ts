import { describe, expect, it } from "vitest";
import { finishedMatch, mixForMatch } from "./faceit-webhook";

const steam = (n: number) => `765611980000000${String(n).padStart(2, "0")}`;
const roster = (from: number, to: number) =>
  Array.from({ length: to - from }, (_, i) => ({
    id: `faceit-${from + i}`,
    game_id: steam(from + i),
  }));
const body = (event: string, players = roster(0, 10)) => ({
  transaction_id: "t",
  event,
  payload: {
    id: "1-66c23f96-3866-4a8d-ad47-f9dc8cfd96f5",
    teams: [{ roster: players.slice(0, 5) }, { roster: players.slice(5) }],
  },
});
const lineup = (from: number) =>
  Array.from({ length: 10 }, (_, i) => [steam(from + i)]);

describe("finishedMatch", () => {
  it("reads the match id and every roster identifier", () => {
    const match = finishedMatch(body("match_status_finished"));
    expect(match?.matchId).toBe("1-66c23f96-3866-4a8d-ad47-f9dc8cfd96f5");
    expect(match?.players.has(steam(9))).toBe(true);
    expect(match?.players.has("faceit-0")).toBe(true);
  });

  it("ignores other events and malformed bodies", () => {
    expect(finishedMatch(body("match_status_ready"))).toBeNull();
    expect(finishedMatch({ event: "match_status_finished" })).toBeNull();
    expect(finishedMatch("nope")).toBeNull();
  });
});

describe("mixForMatch", () => {
  const match = finishedMatch(body("match_status_finished"))!;

  it("picks the mix whose lineup played, tolerating two stand-ins", () => {
    expect(
      mixForMatch(match, [
        { id: "other", lineup: lineup(20) },
        { id: "ours", lineup: lineup(2) },
      ]),
    ).toBe("ours");
  });

  it("matches by FACEIT id when the Steam id is unknown", () => {
    const byFaceit = Array.from({ length: 10 }, (_, i) => [`faceit-${i}`]);
    expect(mixForMatch(match, [{ id: "ours", lineup: byFaceit }])).toBe("ours");
  });

  it("refuses when fewer than 8 match or the room fits two mixes", () => {
    expect(mixForMatch(match, [{ id: "x", lineup: lineup(3) }])).toBeNull();
    expect(
      mixForMatch(match, [
        { id: "a", lineup: lineup(0) },
        { id: "b", lineup: lineup(1) },
      ]),
    ).toBeNull();
  });
});
