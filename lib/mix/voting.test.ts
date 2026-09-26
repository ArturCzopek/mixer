import { describe, expect, it } from "vitest";
import { votingOutcome } from "./voting";

const v = (...votes: number[]) =>
  votes.map((n, i) => ({ number: i + 1, votes: n }));

describe("votingOutcome", () => {
  it("the variant with most votes wins", () => {
    expect(votingOutcome(v(2, 5, 3), "mix-1")).toEqual({
      winner: 2,
      tied: [2],
    });
  });

  it("breaks a tie among the top variants only, the same way every time", () => {
    const a = votingOutcome(v(4, 4, 2), "mix-7");
    expect([1, 2]).toContain(a.winner);
    expect(a.tied).toEqual([1, 2]);
    expect(votingOutcome(v(4, 4, 2), "mix-7")).toEqual(a);
  });

  it("different mixes can break the same tie differently", () => {
    const winners = new Set(
      Array.from(
        { length: 20 },
        (_, i) => votingOutcome(v(3, 3, 3), `mix-${i}`).winner,
      ),
    );
    expect(winners.size).toBeGreaterThan(1);
  });
});
