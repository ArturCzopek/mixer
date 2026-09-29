import { describe, expect, it } from "vitest";
import {
  faceitCandidates,
  faceitRoomId,
  type FaceitRoom,
} from "./faceit-candidates";

const teamA = ["a1", "a2", "a3", "a4", "a5"];
const teamB = ["b1", "b2", "b3", "b4", "b5"];
const room = (
  id: string,
  minutes: number,
  overrides: Partial<FaceitRoom> = {},
): FaceitRoom => ({
  id,
  startedAt: new Date(
    Date.parse("2026-09-29T20:00:00Z") + minutes * 60_000,
  ).toISOString(),
  status: "FINISHED",
  competitionId: "club",
  bestOf: 1,
  faction1: teamA,
  faction2: teamB,
  map: "de_mirage",
  score1: 13,
  score2: 7,
  roomUrl: `https://www.faceit.com/en/cs2/room/${id}`,
  ...overrides,
});

describe("FACEIT evening candidates", () => {
  it("accepts only FACEIT CS2 room links", () => {
    const id = "1-1cb5b18b-6856-42a9-bf3c-561c0737b52f";
    expect(faceitRoomId(`https://www.faceit.com/en/cs2/room/${id}`)).toBe(id);
    expect(faceitRoomId(id)).toBe(id);
    expect(faceitRoomId(`https://evil.example/en/cs2/room/${id}`)).toBeNull();
  });
  const options = {
    lockedAt: "2026-09-29T19:00:00Z",
    nextLockedAt: "2026-09-30T01:00:00Z",
    clubId: "club",
    teamA,
    teamB,
  };

  it("accepts finished rooms in order, including one substitute and a flipped faction", () => {
    const result = faceitCandidates(
      [
        room("second", 40, {
          faction1: teamB,
          faction2: [...teamA.slice(0, 4), "sub"],
        }),
        room("first", 0),
        room("first", 0),
      ],
      options,
    );
    expect(result.map((m) => m.id)).toEqual(["first", "second"]);
    expect(result[1]).toMatchObject({ coverage: 9, teamAIsFaction1: false });
    expect(result[1].lineupMismatch).toContain("sub");
    expect(result[1].lineupMismatch).toContain("a5");
  });

  it("rejects seven players, a late room, the next evening, other competitions and unfinished rooms", () => {
    const result = faceitCandidates(
      [
        room("valid", 0),
        room("seven", 20, {
          faction1: teamA.slice(0, 4),
          faction2: teamB.slice(0, 3),
        }),
        room("late", 421),
        room("next", 900),
        room("other", 30, { competitionId: "other" }),
        room("live", 40, { status: "ONGOING" }),
        room("series", 50, { bestOf: 3 }),
        room("before", -120),
      ],
      { ...options, nextLockedAt: "2026-09-30T10:00:00Z" },
    );
    expect(result.map((m) => m.id)).toEqual(["valid"]);
  });

  it("reports ambiguous faction mapping and falls back without a Club id", () => {
    const result = faceitCandidates(
      [
        room("tie", 0, {
          competitionId: "queue",
          faction1: ["a1", "a2", "b1", "b2", "sub"],
          faction2: ["a3", "a4", "b3", "b4", "sub2"],
        }),
      ],
      { ...options, clubId: null },
    );
    expect(result[0]).toMatchObject({ coverage: 8, teamAIsFaction1: null });
  });
});
