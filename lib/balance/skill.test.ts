import { describe, expect, it } from "vitest";

import { DEFAULT_BALANCE_CONFIG as CFG, resolveConfig } from "./config";
import { faceitMatchRating } from "./faceit-rating";
import {
  activity,
  faceitForm,
  formMultipliers,
  interpolate,
  mixForm,
  sessionEnds,
  skillScore,
  type PlayerInput,
} from "./skill";

const NOW = new Date("2026-09-24T12:00:00Z");
const daysAgo = (d: number) =>
  new Date(NOW.getTime() - d * 86_400_000).toISOString();

function withForm(
  count: number,
  rating: number,
  baseline = 1.0,
  age = 1,
  baselineCount = 30,
): PlayerInput {
  const sample = (finishedAt: string, r: number) => ({ finishedAt, rating: r });
  return {
    steamId: "76561197960000001",
    faceitElo: 1500,
    faceit: {
      matches: [
        ...Array.from({ length: count }, () => sample(daysAgo(age), rating)),
        ...Array.from({ length: baselineCount }, () =>
          sample(daysAgo(60), baseline),
        ),
      ],
    },
  };
}

// At 1500 ELO the good-form multiplier is 1.0, so F equals the raw value there.
const form = (p: PlayerInput, elo = 1500) => faceitForm(p, elo, NOW, CFG.form);

describe("faceitForm: raw F (docs/04 shrinkage examples)", () => {
  it("+30% rating over 20 matches gives raw +100", () => {
    const f = form(withForm(20, 1.3));
    expect(f.raw).toBeCloseTo(100);
    expect(f.shrunkRatio).toBeCloseTo(1.2);
    expect(f.F).toBeCloseTo(100);
  });

  it("+30% rating over 2 matches gives only raw +25", () => {
    expect(form(withForm(2, 1.3)).raw).toBeCloseTo(25);
  });

  it("no matches in the window gives 0", () => {
    expect(form(withForm(15, 2.0, 1.0, 31))).toMatchObject({
      F: 0,
      matches: 0,
      status: "no-recent-matches",
    });
  });

  it("recent matches form the window, older ones the baseline", () => {
    // 20 recent at 1.3 vs 30 older at 1.3: normal form, not +30%.
    const f = form(withForm(20, 1.3, 1.3));
    expect(f).toMatchObject({ matches: 20, baselineMatches: 30 });
    expect(f.windowRating).toBeCloseTo(1.3);
    expect(f.baselineRating).toBeCloseTo(1.3);
    expect(f.F).toBeCloseTo(0);
  });

  it("the window is the 30 days before the mix (`now`), not before today", () => {
    const f = form(withForm(20, 1.3));
    expect(f.windowTo).toBe(NOW.toISOString());
    expect(f.windowFrom).toBe(daysAgo(30));
    // Seen two weeks later, the same mix keeps its window: only `now` = mix time matters.
    const a = activity(withForm(3, 1.0), NOW, CFG.activity);
    expect([a.windowFrom, a.windowTo]).toEqual([
      daysAgo(30),
      NOW.toISOString(),
    ]);
  });

  it("ignores matches after `now`", () => {
    const p = withForm(20, 1.3);
    p.faceit!.matches.push({ finishedAt: daysAgo(-1), rating: 0.1 });
    expect(form(p).matches).toBe(20);
  });

  it("raw F is clamped to ±max before the multiplier", () => {
    const hot = form(withForm(100, 3.0));
    expect(hot).toMatchObject({ raw: 150, rawClamped: true, F: 150 });
    const cold = form(withForm(100, 0.1));
    expect(cold).toMatchObject({ raw: -150, rawClamped: true });
    expect(cold.F).toBeCloseTo(-67.5); // × m−(1500) = 0.45
  });

  it("is 0 without enough baseline matches before the window", () => {
    expect(form(withForm(20, 1.3, 1.0, 1, 9))).toMatchObject({
      F: 0,
      status: "thin-baseline",
    });
    expect(form(withForm(20, 1.3, 1.0, 1, 10)).F).toBeCloseTo(100);
  });
});

describe("form asymmetry by absolute ELO (D24 amended, docs/04 table)", () => {
  it("interpolates between anchors and is flat outside them", () => {
    const pts: [number, number][] = [
      [0, 10],
      [10, 20],
    ];
    expect(interpolate(-5, pts)).toBe(10);
    expect(interpolate(5, pts)).toBe(15);
    expect(interpolate(50, pts)).toBe(20);
  });

  it.each([
    [938, 1.5, 0.3],
    [1000, 1.5, 0.3],
    [1126, 1.374, 0.3378],
    [1500, 1.0, 0.45],
    [1797, 0.4654, 0.5391],
    [2000, 0.1, 0.6],
    [2189, 0.1, 0.6],
  ])("ELO %i: m+ %f, m− %f", (elo, up, down) => {
    const m = formMultipliers(elo, CFG.form.asymmetry);
    expect(m.up).toBeCloseTo(up, 4);
    expect(m.down).toBeCloseTo(down, 4);
  });

  // 10 matches at raw ratio r shrink to ratio^ = (r + 1) / 2 with k = 10.
  const at = (ratioHat: number, elo: number) =>
    form(withForm(10, 2 * ratioHat - 1), elo).F;

  it.each([
    // E, ratio^ 1.05, 1.10, 1.30, 0.90, 0.70
    [938, 37.5, 75, 150, -15, -45],
    [1126, 34.35, 68.7, 150, -16.89, -50.67],
    [1400, 27.5, 55, 150, -21, -63],
    [1500, 25, 50, 150, -22.5, -67.5],
    [1797, 11.635, 23.27, 69.81, -26.955, -80.865],
    [2189, 2.5, 5, 15, -30, -90],
  ])("ELO %i", (elo, f105, f110, f130, f090, f070) => {
    expect(at(1.05, elo)).toBeCloseTo(f105, 2);
    expect(at(1.1, elo)).toBeCloseTo(f110, 2);
    expect(at(1.3, elo)).toBeCloseTo(f130, 2);
    expect(at(0.9, elo)).toBeCloseTo(f090, 2);
    expect(at(0.7, elo)).toBeCloseTo(f070, 2);
  });

  it("above 2000: at most +15 from form, down to −90 in a slump", () => {
    expect(form(withForm(100, 3.0), 2100)).toMatchObject({
      F: 15,
      direction: "up",
      multiplier: 0.1,
    });
    expect(form(withForm(100, 0.1), 2100)).toMatchObject({
      F: -90,
      direction: "down",
      multiplier: 0.6,
    });
  });

  it("a weaker player in average-plus form gets a clear plus (+34)", () => {
    // 25 matches at a raw ratio of 1.07 shrink to 1.05.
    const f = form(withForm(25, 1.07), 1126);
    expect(f.shrunkRatio).toBeCloseTo(1.05);
    expect(f.F).toBeCloseTo(34.35, 1);
  });

  it("the final clamp caps a boosted weak player at ±max", () => {
    const f = form(withForm(20, 1.3), 938); // raw +100 × 1.5
    expect(f).toMatchObject({ F: 150, clamped: true, rawClamped: false });
  });
});

describe("activity A (D26, docs/04 examples)", () => {
  const at = (...ts: string[]): PlayerInput => ({
    steamId: "1",
    faceitElo: 1500,
    activity: { playedAt: ts },
  });
  const hoursAgo = (days: number, h: number) =>
    new Date(Date.parse(daysAgo(days)) - h * 3_600_000).toISOString();
  const cfg = CFG.activity;

  it("groups matches less than 6 h apart into one session", () => {
    const t = (h: number) => h * 3_600_000;
    expect(sessionEnds([t(0), t(1), t(2)], 6)).toEqual([t(2)]);
    expect(sessionEnds([t(0), t(1), t(8)], 6)).toEqual([t(1), t(8)]);
    expect(sessionEnds([], 6)).toEqual([]);
  });

  it("three matches on one evening three weeks ago: s = 1, A = −40", () => {
    const a = activity(
      at(hoursAgo(21, 0), hoursAgo(21, 1), hoursAgo(21, 2)),
      NOW,
      cfg,
    );
    expect(a).toMatchObject({ sessions: 1, A: -40, status: "ok" });
  });

  it("last match two months ago: s = 0, A = −60", () => {
    const a = activity(at(daysAgo(60), daysAgo(61)), NOW, cfg);
    expect(a).toMatchObject({ sessions: 0, A: -60 });
    expect(a.lastPlayedAt).toBe(daysAgo(60));
  });

  it("interpolates between anchors and is flat above the last one", () => {
    const sessions = (n: number) =>
      at(...Array.from({ length: n }, (_, i) => daysAgo(i * 3 + 1)));
    expect(activity(sessions(2), NOW, cfg).A).toBe(-20);
    expect(activity(sessions(3), NOW, cfg).A).toBe(0);
    expect(activity(sessions(4), NOW, cfg).A).toBeCloseTo(5);
    expect(activity(sessions(5), NOW, cfg).A).toBeCloseTo(10);
    expect(activity(sessions(6), NOW, cfg).A).toBe(15);
    expect(activity(sessions(8), NOW, cfg)).toMatchObject({
      sessions: 8,
      A: 15,
    });
  });

  it("no data at all gives 0, not a penalty (D21)", () => {
    expect(activity({ steamId: "1", faceitElo: null }, NOW, cfg)).toMatchObject(
      { A: 0, status: "no-data", lastPlayedAt: null },
    );
  });

  it("falls back to form matches when no activity list is given", () => {
    expect(activity(withForm(3, 1.0), NOW, cfg).sessions).toBe(1);
  });

  it("an explicit activity list wins (club matches count here, not in F)", () => {
    const p = { ...withForm(3, 1.0), activity: { playedAt: [] } };
    expect(activity(p, NOW, cfg).status).toBe("no-data");
  });

  it("ignores matches after `now`", () => {
    expect(activity(at(daysAgo(-1)), NOW, cfg).status).toBe("no-data");
  });
});

describe("faceitMatchRating", () => {
  it("matches the docs/05 sanity check (≈ 1.12)", () => {
    // KPR 0.70, DPR 0.65, APR 0.15, ADR 80 over 20 rounds (KAST assumed 72).
    const r = faceitMatchRating({
      kills: 14,
      deaths: 13,
      assists: 3,
      rounds: 20,
      adr: 80,
    });
    expect(r).toBeCloseTo(1.12, 2);
  });

  it("rewards impact, not only K/D", () => {
    const base = { kills: 20, deaths: 20, assists: 4, rounds: 24 };
    expect(faceitMatchRating({ ...base, adr: 110 })).toBeGreaterThan(
      faceitMatchRating({ ...base, adr: 70 }),
    );
  });
});

describe("mixForm (docs/04 shrinkage example)", () => {
  const player = (ratings: number[]): PlayerInput => ({
    steamId: "76561197960000001",
    faceitElo: 2000,
    mixRatings: ratings,
  });

  it("10 maps at 1.15 vs group 1.00 gives +100 ELO", () => {
    const m = mixForm(player(Array(10).fill(1.15)), 1.0, CFG.mix);
    expect(m.M).toBeCloseTo(100);
    expect(m.shrunkRating).toBeCloseTo(1.1);
  });

  it("uses only the last N maps (most recent first)", () => {
    const ratings = [...Array(10).fill(1.15), ...Array(10).fill(0.5)];
    expect(mixForm(player(ratings), 1.0, CFG.mix)).toMatchObject({ maps: 10 });
    expect(mixForm(player(ratings), 1.0, CFG.mix).M).toBeCloseTo(100);
  });

  it("is 0 with no mix history or no group data (cold start)", () => {
    expect(mixForm(player([]), 1.0, CFG.mix)).toMatchObject({
      M: 0,
      status: "no-maps",
    });
    expect(mixForm(player([1.5]), null, CFG.mix)).toMatchObject({
      M: 0,
      status: "no-group-data",
    });
  });

  it("is clamped to ±max", () => {
    expect(mixForm(player(Array(10).fill(3)), 1.0, CFG.mix)).toMatchObject({
      M: 200,
      clamped: true,
    });
  });
});

describe("skillScore", () => {
  const ctx = { now: NOW, groupRating: 1.0 };
  const full = (): PlayerInput => ({
    ...withForm(20, 1.3),
    mixRatings: Array(10).fill(1.15),
  });

  it("S = E + F + 0.5·M + 0.5·A with default weights, contributions add up", () => {
    // E 1500, F +100 (m+ = 1 at 1500), M +100 × 0.5, A: 20 matches on one day = 1 session.
    const s = skillScore(full(), ctx, CFG);
    expect(s).toMatchObject({ E: 1500, eSource: "faceit", A: -40 });
    expect(s.F).toBeCloseTo(100);
    expect(s.M).toBeCloseTo(100);
    expect(s.contributions).toEqual({ E: 1500, F: 100, M: 50, A: -20 });
    expect(s.S).toBe(1630);
    const c = s.contributions;
    expect(c.E + c.F + c.M + c.A).toBe(s.S);
    expect(s.weights).toEqual(CFG.weights);
  });

  it("a strong player's hot month adds little (asymmetry)", () => {
    const s = skillScore({ ...full(), faceitElo: 2100 }, ctx, CFG);
    expect(s.form.multiplier).toBe(0.1);
    expect(s.contributions.F).toBe(10);
  });

  it("weights change S as documented (0 switches a term off)", () => {
    const cfg = resolveConfig({
      weights: { faceitForm: 0.5, mixForm: 1, activity: 0 },
    });
    const s = skillScore(full(), ctx, cfg);
    expect(s.contributions).toEqual({ E: 1500, F: 50, M: 100, A: 0 });
    expect(s.S).toBe(1650);
    // The term itself is still explained, only its weight is 0.
    expect(s.A).toBe(-40);
  });

  it("every contribution is a whole number and they always sum to S", () => {
    for (const elo of [938, 1126, 1797, 2189]) {
      const s = skillScore({ ...withForm(7, 1.11), faceitElo: elo }, ctx, CFG);
      const c = s.contributions;
      for (const v of Object.values(c)) expect(Number.isInteger(v)).toBe(true);
      expect(c.E + c.F + c.M + c.A).toBe(s.S);
    }
  });

  it("falls back to the manual override when FACEIT ELO is missing", () => {
    const s = skillScore(
      { steamId: "1", faceitElo: null, manualSkillOverride: 1500 },
      ctx,
      CFG,
    );
    expect(s).toMatchObject({ E: 1500, S: 1500, eSource: "manual", A: 0 });
    expect(s.activity.status).toBe("no-data");
  });

  it("throws when there is no ELO at all", () => {
    expect(() =>
      skillScore({ steamId: "1", faceitElo: null }, ctx, CFG),
    ).toThrow(/no FACEIT ELO/);
  });

  it("respects config overrides", () => {
    const cfg = resolveConfig({ form: { beta: 0 } });
    expect(skillScore(withForm(20, 1.3), ctx, cfg).F).toBe(0);
  });
});
