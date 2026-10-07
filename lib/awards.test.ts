import { describe, expect, it } from "vitest";
import { matchAwards, type AwardKey, type AwardStat } from "./awards";

const empty: AwardStat = {
  steamId: "one",
  rounds: 20,
  kills: null,
  deaths: null,
  assists: null,
  adr: null,
  firstKills: null,
  clutchWins: null,
  utilityDamage: null,
  enemiesFlashed: null,
  multi4: null,
  multi5: null,
};

describe("matchAwards", () => {
  it.each<{
    key: AwardKey;
    field: keyof AwardStat;
    pass: number;
    fail: number;
  }>([
    { key: "cannonFodder", field: "deaths", pass: 16, fail: 15 },
    { key: "pacifist", field: "adr", pass: 54, fail: 55 },
    { key: "assistKing", field: "assists", pass: 5, fail: 4 },
    { key: "tourist", field: "kills", pass: 8, fail: 9 },
    { key: "doorOpener", field: "firstKills", pass: 5, fail: 4 },
    { key: "clutchMinister", field: "clutchWins", pass: 2, fail: 1 },
    { key: "grenadier", field: "utilityDamage", pass: 250, fail: 249 },
    { key: "sunglasses", field: "enemiesFlashed", pass: 15, fail: 14 },
    { key: "exterminator", field: "multi5", pass: 1, fail: 0 },
    { key: "soClose", field: "multi4", pass: 2, fail: 1 },
  ])(
    "$key fires at its threshold but not below",
    ({ key, field, pass, fail }) => {
      expect(
        matchAwards([{ ...empty, [field]: pass }], ["one"]).some(
          (a) => a.key === key,
        ),
      ).toBe(true);
      expect(
        matchAwards([{ ...empty, [field]: fail }], ["one"]).some(
          (a) => a.key === key,
        ),
      ).toBe(false);
    },
  );

  it("uses join order for ties and does not infer missing stats from zero", () => {
    expect(
      matchAwards(
        [
          { ...empty, firstKills: 5, steamId: "one" },
          { ...empty, firstKills: 5, steamId: "two" },
        ],
        ["two", "one"],
      ),
    ).toContainEqual({ key: "doorOpener", steamId: "two", value: 5 });
    expect(matchAwards([empty], ["one"])).toEqual([]);
  });

  it("awards headshot extremes only with at least 15 observed kills", () => {
    const awards = (kills: number, headshotKills: number) =>
      matchAwards([{ ...empty, kills, headshotKills }], ["one"]);
    expect(awards(20, 13)).toContainEqual({
      key: "headhunter",
      steamId: "one",
      value: 65,
    });
    expect(awards(20, 12).some((award) => award.key === "headhunter")).toBe(
      false,
    );
    expect(awards(20, 5)).toContainEqual({
      key: "sprayAndPray",
      steamId: "one",
      value: 25,
    });
    expect(awards(20, 6).some((award) => award.key === "sprayAndPray")).toBe(
      false,
    );
    expect(awards(14, 10).some((award) => award.key === "headhunter")).toBe(
      false,
    );
    expect(awards(14, 3).some((award) => award.key === "sprayAndPray")).toBe(
      false,
    );
  });

  it("uses complete evening headshot counts and skips partial or invalid counts", () => {
    const lines = [
      { ...empty, kills: 10, headshotKills: 7 },
      { ...empty, kills: 10, headshotKills: 6 },
    ];
    expect(matchAwards(lines, ["one"])).toContainEqual({
      key: "headhunter",
      steamId: "one",
      value: 65,
    });
    expect(
      matchAwards(
        [{ ...lines[0], headshotKills: null }, lines[1]],
        ["one"],
      ).some(
        (award) => award.key === "headhunter" || award.key === "sprayAndPray",
      ),
    ).toBe(false);
    expect(
      matchAwards([{ ...empty, kills: 20, headshotKills: 21 }], ["one"]).some(
        (award) => award.key === "headhunter",
      ),
    ).toBe(false);
  });

  it("chooses the losing map's top fragger only with a five-round loss and complete team stats", () => {
    const map = (scoreA: number, kills: (number | null)[]) => [
      ...kills.map((value, index) => ({
        ...empty,
        steamId: String(index),
        matchId: "map-1",
        team: "A" as const,
        scoreA,
        scoreB: 16,
        kills: value,
      })),
      {
        ...empty,
        steamId: "winner",
        matchId: "map-1",
        team: "B" as const,
        scoreA,
        scoreB: 16,
        kills: 40,
      },
    ];
    const order = ["1", "0", "2", "3", "4", "winner"];
    expect(matchAwards(map(11, [20, 20, 8, 7, 6]), order)).toContainEqual({
      key: "loneWolf",
      steamId: "1",
      value: 20,
    });
    for (const lines of [
      map(12, [20, 20, 8, 7, 6]),
      map(11, [20, null, 8, 7, 6]),
      map(11, [20, 8, 7, 6]),
      map(11, [20, 8, 7, 6, 5]).map((line) => ({
        ...line,
        matchId: undefined,
      })),
    ])
      expect(
        matchAwards(lines, order).some((award) => award.key === "loneWolf"),
      ).toBe(false);
  });

  it("limits each player to two awards and the evening to six", () => {
    const winners = Array.from({ length: 10 }, (_, index) => ({
      ...empty,
      steamId: String(index),
      kills: 20,
      headshotKills: 20,
      deaths: 30 - index,
      assists: 10 - index,
      firstKills: 10 - index,
      clutchWins: 10 - index,
      utilityDamage: 500 - index,
      enemiesFlashed: 30 - index,
    }));
    const awards = matchAwards(
      winners,
      winners.map((w) => w.steamId),
    );
    expect(awards.length).toBeLessThanOrEqual(6);
    for (const player of winners)
      expect(
        awards.filter((award) => award.steamId === player.steamId).length,
      ).toBeLessThanOrEqual(2);
  });
});
