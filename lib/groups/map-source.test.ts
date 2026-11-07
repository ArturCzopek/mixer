import { describe, expect, it } from "vitest";
import { countMapSources } from "./map-source";

describe("countMapSources", () => {
  it("counts enriched maps by their stats origin", () => {
    expect(
      countMapSources([
        { source: "manual", stats_origin: null },
        { source: "manual", stats_origin: "demo" },
        { source: "manual", stats_origin: "faceit" },
        { source: "faceit", stats_origin: "faceit" },
        { source: "manual", stats_origin: "popflash" },
      ]),
    ).toEqual({ manual: 1, demo: 1, faceit: 2, popflash: 1 });
  });
});
