import { describe, expect, it } from "vitest";
import {
  calculateDemoStats,
  summarizeDemoRounds,
  type DemoEvent,
  type DemoRound,
} from "./stats";

const players: DemoRound["players"] = [
  { steamid: "a", teamId: "A", side: 2, isAlive: true, health: 100 },
  { steamid: "b", teamId: "A", side: 2, isAlive: true, health: 100 },
  { steamid: "x", teamId: "B", side: 3, isAlive: true, health: 100 },
  { steamid: "y", teamId: "B", side: 3, isAlive: true, health: 100 },
];

function round(startTick = 0, endTick = 400, scoreEndTick = 450): DemoRound {
  return {
    startTick,
    endTick,
    scoreEndTick,
    winnerTeamId: "A",
    players: players.map((player) => ({ ...player })),
  };
}

function death(
  tick: number,
  attacker: string | null,
  user: string,
  assister: string | null = null,
): DemoEvent {
  return {
    event_name: "player_death",
    tick,
    attacker_steamid: attacker,
    user_steamid: user,
    assister_steamid: assister,
    assistedflash: Boolean(assister),
    headshot: false,
  };
}

function calculate(rounds: DemoRound[], events: DemoEvent[]) {
  return Object.fromEntries(
    calculateDemoStats({ tickRate: 64, rounds, events }).map((row) => [
      row.steamid,
      row,
    ]),
  );
}

describe("calculateDemoStats", () => {
  it("derives demo award counters without counting friendly kills as highlights", () => {
    const special = {
      ...death(30, "a", "x"),
      weapon: "knife_butterfly",
      penetrated: 1,
      thrusmoke: true,
      attackerblind: true,
      attackerinair: true,
      noscope: true,
    };
    const result = calculate(
      [round()],
      [
        {
          event_name: "player_hurt",
          tick: 1,
          attacker_steamid: "a",
          user_steamid: "b",
          dmg_health: 9,
          health: 90,
          weapon: "ak47",
        },
        {
          event_name: "player_hurt",
          tick: 2,
          attacker_steamid: "a",
          user_steamid: "a",
          dmg_health: 50,
          health: 50,
          weapon: "hegrenade",
        },
        {
          event_name: "player_blind",
          tick: 3,
          attacker_steamid: "a",
          user_steamid: "b",
          blind_duration: 1,
        },
        {
          event_name: "player_blind",
          tick: 4,
          attacker_steamid: "a",
          user_steamid: "b",
          blind_duration: 1.01,
        },
        {
          event_name: "other_death",
          tick: 5,
          attacker_steamid: "a",
          othertype: "chicken",
        },
        {
          event_name: "other_death",
          tick: 6,
          attacker_steamid: "a",
          othertype: "prop_dynamic",
        },
        special,
        { ...death(40, "a", "y"), weapon: "taser" },
        { ...death(50, "b", "b"), weapon: "hegrenade", thrusmoke: true },
      ],
    );
    expect(result.a).toMatchObject({
      friendlyDamage: 10,
      selfDamage: 50,
      friendlyFlashes: 1,
      teammatesFlashed: 2,
      chickenKills: 1,
      knifeKills: 1,
      taserKills: 1,
      wallbangKills: 1,
      smokeKills: 1,
      blindKills: 1,
      airKills: 1,
      noScopeKills: 1,
    });
    expect(result.b).toMatchObject({ suicides: 1, smokeKills: 0 });
  });

  it("summarizes live rounds and marks overtime only from observed regulation length", () => {
    const rounds = [round(0, 100, 150), round(150, 250, 300)];
    const events = [
      death(10, "x", "b"),
      death(20, "a", "x"),
      death(30, "a", "y"),
      death(110, "a", "b"),
    ];
    const summary = summarizeDemoRounds({ rounds, events }, 1);
    expect(summary[0]).toMatchObject({
      number: 1,
      winnerTeamId: "A",
      phase: "regulation",
      opening: { killer: "x", victim: "b" },
      multikills: [{ steamid: "a", kills: 2 }],
    });
    expect(summary[0].clutches).toContainEqual({
      steamid: "a",
      opponents: 2,
      won: true,
    });
    expect(summary[1].phase).toBe("overtime");
    expect(
      summarizeDemoRounds({ rounds, events }, null).every(
        (row) => row.phase === null,
      ),
    ).toBe(true);
    const losing = round();
    losing.winnerTeamId = "B";
    expect(calculate([losing], []).a.savedLostRounds).toBe(1);
  });
  it("uses HP deltas for damage, including one-point parser rounding, overkill and friendly damage", () => {
    const result = calculate(
      [round()],
      [
        {
          event_name: "player_hurt",
          tick: 10,
          attacker_steamid: "a",
          user_steamid: "x",
          dmg_health: 9,
          health: 90,
          weapon: "ak47",
        },
        {
          event_name: "player_hurt",
          tick: 11,
          attacker_steamid: "x",
          user_steamid: "x",
          dmg_health: 10,
          health: 80,
          weapon: "ak47",
        },
        {
          event_name: "player_hurt",
          tick: 12,
          attacker_steamid: "y",
          user_steamid: "x",
          dmg_health: 20,
          health: 60,
          weapon: "ak47",
        },
        {
          event_name: "player_hurt",
          tick: 13,
          attacker_steamid: "b",
          user_steamid: "x",
          dmg_health: 200,
          health: 0,
          weapon: "hegrenade",
        },
      ],
    );
    expect(result.a.enemyDamage).toBe(10);
    expect(result.b.enemyDamage).toBe(60);
    expect(result.b.utilityDamage).toBe(60);
    expect(result.x.enemyDamage).toBe(0);
    expect(result.y.enemyDamage).toBe(0);
    expect(result.b.adr).toBe(60);
  });

  it("isolates rounds across side swaps and counts openings, trades, KAST and clutches", () => {
    const first = round();
    const second = round(450, 900, 950);
    second.winnerTeamId = "B";
    second.players = second.players.map((player) => ({
      ...player,
      side: player.side === 2 ? 3 : 2,
    }));
    const result = calculate(
      [first, second],
      [
        death(10, "x", "b"), // a becomes 1v2
        death(20, "a", "x", "b"), // a posthumous assist is still valid
        death(25, "a", "y"),
        death(460, "y", "a"),
        death(780, "b", "y"), // exactly five seconds later
        death(800, null, "b"), // world death after the trade
      ],
    );
    expect(result.a.kills).toBe(2);
    expect(result.a.kpr).toBe(1);
    expect(result.a.deaths).toBe(1);
    expect(result.a.dpr).toBe(0.5);
    expect(result.a.openingKills).toBe(0);
    expect(result.a.clutchAttempts[2]).toBe(1);
    expect(result.a.clutchWins[2]).toBe(1);
    expect(result.a.kastRounds).toBe(2);
    expect(result.a.multikills[2]).toBe(1);
    expect(result.b.tradeKills).toBe(1);
    expect(result.a.tradedDeaths).toBe(1);
    expect(result.b.kastRounds).toBe(2);
    expect(result.b.assists).toBe(1);
    expect(result.b.apr).toBe(0.5);
    expect(result.y.openingKills).toBe(1);
    expect(result.y.tradedDeaths).toBe(0);
    expect(result.x.openingKills).toBe(1);
  });

  it("counts post-round kills in KDA but excludes them from openings, trades and KAST", () => {
    const result = calculate(
      [round(0, 100, 200)],
      [
        {
          event_name: "player_hurt",
          tick: 110,
          attacker_steamid: "a",
          user_steamid: "x",
          dmg_health: 20,
          health: 80,
        },
        death(120, "a", "x"),
      ],
    );
    expect(result.a.kills).toBe(1);
    expect(result.a.enemyDamage).toBe(20);
    expect(result.x.deaths).toBe(1);
    expect(result.a.openingKills).toBe(0);
    expect(result.x.openingDeaths).toBe(0);
    expect(result.a.tradeKills).toBe(0);
    expect(result.x.kastRounds).toBe(1); // alive when the round ended
  });

  it("counts a trade at five seconds, but never across rounds or after round_end", () => {
    const first = round(0, 330, 350);
    const second = round(350, 750, 800);
    const result = calculate(
      [first, second],
      [
        death(10, "x", "a"),
        death(330, "b", "x"),
        death(351, "x", "a"),
        death(671, "b", "x"),
      ],
    );
    expect(result.b.tradeKills).toBe(2);
    expect(result.a.tradedDeaths).toBe(2);
    const tooLate = calculate(
      [round()],
      [death(10, "x", "a"), death(331, "b", "x")],
    );
    expect(tooLate.b.tradeKills).toBe(0);
    expect(tooLate.a.tradedDeaths).toBe(0);
    const afterEnd = calculate(
      [round(0, 100, 450)],
      [death(90, "x", "a"), death(120, "b", "x")],
    );
    expect(afterEnd.b.tradeKills).toBe(0);
    const acrossRounds = calculate(
      [round(0, 330, 350), round(350, 750, 800)],
      [death(320, "x", "a"), death(351, "b", "x")],
    );
    expect(acrossRounds.b.tradeKills).toBe(0);
    expect(acrossRounds.a.tradedDeaths).toBe(0);
  });

  it("excludes team kills, suicides and world kills from kills, but counts deaths", () => {
    const losingRound = round();
    losingRound.winnerTeamId = "B";
    const result = calculate(
      [losingRound],
      [death(10, "a", "b"), death(20, "x", "x"), death(30, null, "y")],
    );
    expect(result.a.kills).toBe(0);
    expect(result.b.deaths).toBe(1);
    expect(result.x.kills).toBe(0);
    expect(result.x.deaths).toBe(1);
    expect(result.y.deaths).toBe(1);
    expect(result.a.clutchAttempts[2]).toBe(1);
    expect(result.a.clutchWins[2]).toBeUndefined();
  });

  it("awards a planted-bomb clutch when the last player dies but their team wins", () => {
    const result = calculate(
      [round()],
      [death(10, "x", "b"), death(20, "y", "a")],
    );
    expect(result.a.clutchAttempts[2]).toBe(1);
    expect(result.a.clutchWins[2]).toBe(1);
    expect(result.a.kastRounds).toBe(0);
  });

  it("counts flash assists and enemy flashes only above half a second", () => {
    const result = calculate(
      [round()],
      [
        {
          event_name: "player_blind",
          tick: 1,
          attacker_steamid: "b",
          user_steamid: "x",
          blind_duration: 0.5,
        },
        {
          event_name: "player_blind",
          tick: 2,
          attacker_steamid: "b",
          user_steamid: "x",
          blind_duration: 0.51,
        },
        {
          event_name: "player_blind",
          tick: 3,
          attacker_steamid: "b",
          user_steamid: "a",
          blind_duration: 1,
        },
        {
          event_name: "player_blind",
          tick: 3,
          attacker_steamid: "b",
          user_steamid: "b",
          blind_duration: 1,
        },
        death(4, "a", "x", "b"),
      ],
    );
    expect(result.b.enemiesFlashed).toBe(1);
    expect(result.b.teammatesFlashed).toBe(1);
    expect(result.b.assists).toBe(1);
    expect(result.b.flashAssists).toBe(1);
    expect(result.b.kastRounds).toBe(1);
    expect(result.a.headshotPercent).toBe(0);
  });

  it("rejects incomplete roster, event fields and invalid tick rate", () => {
    const incomplete = round(450, 900, 950);
    incomplete.players.pop();
    expect(() => calculate([round(), incomplete], [])).toThrow(
      "Incomplete round roster",
    );
    expect(() =>
      calculate(
        [round()],
        [{ event_name: "player_death", tick: 1, user_steamid: "a" }],
      ),
    ).toThrow("Missing death flags");
    expect(() =>
      calculateDemoStats({ tickRate: 0, rounds: [round()], events: [] }),
    ).toThrow("Invalid tickRate");
    expect(() =>
      calculate(
        [round(0, 100, 200)],
        [death(110, "a", "x"), death(120, "b", "x")],
      ),
    ).toThrow("Duplicate death");
  });
});
