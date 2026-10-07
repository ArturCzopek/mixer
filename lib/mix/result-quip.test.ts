import { expect, it } from "vitest";
import { resultQuip } from "./result-quip";

it("uses real scores for close games, stomps and split evenings", () => {
  expect(
    resultQuip([
      { a: 13, b: 11 },
      { a: 14, b: 16 },
    ]),
  ).toBe("closeGame");
  expect(resultQuip([{ a: 13, b: 3 }])).toBe("stomp");
  expect(
    resultQuip([
      { a: 13, b: 7 },
      { a: 8, b: 13 },
    ]),
  ).toBe("splitEvening");
  expect(resultQuip([{ a: 13, b: 8 }])).toBeNull();
  expect(resultQuip([])).toBeNull();
});
