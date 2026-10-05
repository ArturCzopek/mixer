import { describe, expect, it } from "vitest";
import { mixNoticeText } from "./messages";

describe("mixNoticeText", () => {
  it("announces a new mix with its link", () => {
    expect(
      mixNoticeText("created", { title: "Friday", url: "https://x/m/1" }),
    ).toBe("🆕 New mix: **Friday**. Sign up on Mixer.\nhttps://x/m/1");
  });

  it("lists both teams when the lineup locks", () => {
    expect(
      mixNoticeText("locked", {
        title: "Friday",
        url: null,
        teamA: ["a", "b"],
        teamB: ["c"],
      }),
    ).toBe("🔒 Lineup locked: **Friday**\nTeam A: a, b\nTeam B: c");
  });

  it("lists map scores, naming unnamed maps by number", () => {
    expect(
      mixNoticeText("played", {
        title: "Friday",
        url: null,
        maps: [
          { mapName: "Mirage", scoreA: 13, scoreB: 9 },
          { mapName: null, scoreA: 11, scoreB: 13 },
        ],
      }),
    ).toBe("🏁 Results: **Friday**\nMirage: 13:9\nMap 2: 11:13");
  });
});
