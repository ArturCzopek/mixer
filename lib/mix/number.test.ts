import { describe, expect, it } from "vitest";
import { mixNumber } from "./number";

describe("mixNumber", () => {
  const mixes = [{ id: "c" }, { id: "b" }, { id: "a" }];

  it("counts from the oldest mix", () => {
    expect(mixNumber(mixes, "a")).toBe(1);
    expect(mixNumber(mixes, "c")).toBe(3);
  });

  it("keeps a mix's number when a newer one is created", () => {
    expect(mixNumber([{ id: "d" }, ...mixes], "b")).toBe(2);
  });

  it("treats an unlisted mix as the next one", () => {
    expect(mixNumber(mixes, "x")).toBe(4);
  });
});
