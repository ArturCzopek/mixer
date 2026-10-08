import { describe, expect, it } from "vitest";
import { demoAwardFields, normalizeStoredDemo } from "./view";

const steam = (index: number) => `7656119${String(index).padStart(10, "0")}`;
const teams = new Map<string, "A" | "B">(
  Array.from({ length: 10 }, (_, i) => [steam(i), i < 5 ? "A" : "B"]),
);
const stat = (i: number) => ({
  steamid: steam(i),
  teamId: i < 5 ? "2" : "3",
  roundsPlayed: 1,
  kills: 0,
  deaths: 0,
  assists: 0,
  kpr: 0,
  dpr: 0,
  apr: 0,
  enemyDamage: 0,
  adr: 0,
  headshotKills: 0,
  headshotPercent: 0,
  openingKills: 0,
  openingDeaths: 0,
  tradeKills: 0,
  tradedDeaths: 0,
  kastRounds: 1,
  kastPercent: 100,
  multikills: { 2: 0, 3: 0, 4: 0, 5: 0 },
  clutchAttempts: {},
  clutchWins: {},
  utilityDamage: 0,
  enemiesFlashed: 0,
  teammatesFlashed: 0,
  flashAssists: 0,
  friendlyFlashes: 0,
  friendlyDamage: 0,
  selfDamage: 0,
  suicides: 0,
  chickenKills: 0,
  knifeKills: 0,
  taserKills: 0,
  wallbangKills: 0,
  smokeKills: 0,
  blindKills: 0,
  airKills: 0,
  noScopeKills: 0,
  savedLostRounds: 0,
});
const payload = {
  version: 1,
  tickRate: 64,
  regulationRounds: 24,
  players: Array.from({ length: 10 }, (_, i) => ({
    steamid: steam(i),
    name: `Player ${i}`,
    teamId: i < 5 ? "2" : "3",
  })),
  stats: Array.from({ length: 10 }, (_, i) => stat(i)),
  rounds: [
    {
      number: 1,
      startTick: 1,
      endTick: 100,
      winnerTeamId: "3",
      phase: "regulation",
      opening: { killer: steam(5), victim: steam(0) },
      clutches: [],
      multikills: [],
    },
  ],
  evidence: { events: [{ tick: 2, weapon: "ak47" }] },
  _previous: { secret: "prior import" },
};

describe("normalizeStoredDemo", () => {
  it("normalizes teams and sends only bounded presentation data", () => {
    const result = normalizeStoredDemo(payload, teams);
    expect(result?.players[0].teamId).toBe("A");
    expect(result?.stats[5].teamId).toBe("B");
    expect(result?.rounds[0].winnerTeamId).toBe("B");
    expect(result?.rounds[0].opening).toEqual(payload.rounds[0].opening);
    expect(result).not.toHaveProperty("evidence");
    expect(result).not.toHaveProperty("_previous");
  });

  it("rejects legacy or inconsistent data", () => {
    expect(normalizeStoredDemo({ version: 1, evidence: {} }, teams)).toBeNull();
    expect(
      normalizeStoredDemo(
        { ...payload, rounds: [{ ...payload.rounds[0], winnerTeamId: "9" }] },
        teams,
      ),
    ).toBeNull();
    expect(
      normalizeStoredDemo({ ...payload, stats: payload.stats.slice(1) }, teams),
    ).toBeNull();
  });
});

it("keeps missing award metrics unknown and preserves observed zero", () => {
  expect(demoAwardFields({ friendlyDamage: 0, tradeKills: 2 })).toMatchObject({
    friendlyDamage: 0,
    tradeKills: 2,
    selfDamage: null,
  });
  expect(
    demoAwardFields({ _previous: { chickenKills: 5 } }).chickenKills,
  ).toBeNull();
});
