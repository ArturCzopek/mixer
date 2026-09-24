import { describe, expect, it } from "vitest";

import { DEFAULT_BALANCE_CONFIG as CFG, resolveConfig } from "./config";
import { faceitMatchRating } from "./faceit-rating";
import { faceitForm, mixForm, skillScore, type PlayerInput } from "./skill";

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
    faceitElo: 2000,
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

describe("faceitForm (docs/04 shrinkage examples)", () => {
  it("+30% rating over 20 matches gives +100 ELO", () => {
    expect(faceitForm(withForm(20, 1.3), NOW, CFG.form).F).toBeCloseTo(100);
  });

  it("+30% rating over 2 matches gives only +25 ELO", () => {
    expect(faceitForm(withForm(2, 1.3), NOW, CFG.form).F).toBeCloseTo(25);
  });

  it("no matches in the window gives 0", () => {
    const r = faceitForm(withForm(15, 2.0, 1.0, 31), NOW, CFG.form);
    expect(r).toEqual({ F: 0, matches: 0 });
  });

  it("recent matches form the window, older ones the baseline", () => {
    // 20 recent at 1.3 vs 30 older at 1.3: normal form, not +30%.
    expect(faceitForm(withForm(20, 1.3, 1.3), NOW, CFG.form)).toMatchObject({
      matches: 20,
    });
    expect(faceitForm(withForm(20, 1.3, 1.3), NOW, CFG.form).F).toBeCloseTo(0);
  });

  it("ignores matches after `now`", () => {
    const p = withForm(20, 1.3);
    p.faceit!.matches.push({ finishedAt: daysAgo(-1), rating: 0.1 });
    expect(faceitForm(p, NOW, CFG.form).matches).toBe(20);
  });

  it("is clamped to ±max", () => {
    expect(faceitForm(withForm(100, 3.0), NOW, CFG.form).F).toBe(150);
    expect(faceitForm(withForm(100, 0.1), NOW, CFG.form).F).toBe(-150);
  });

  it("is 0 without enough baseline matches before the window", () => {
    expect(faceitForm(withForm(20, 1.3, 1.0, 1, 9), NOW, CFG.form).F).toBe(0);
    expect(
      faceitForm(withForm(20, 1.3, 1.0, 1, 10), NOW, CFG.form).F,
    ).toBeCloseTo(100);
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
    expect(mixForm(player(Array(10).fill(1.15)), 1.0, CFG.mix).M).toBeCloseTo(
      100,
    );
  });

  it("uses only the last N maps (most recent first)", () => {
    const ratings = [...Array(10).fill(1.15), ...Array(10).fill(0.5)];
    expect(mixForm(player(ratings), 1.0, CFG.mix)).toMatchObject({ maps: 10 });
    expect(mixForm(player(ratings), 1.0, CFG.mix).M).toBeCloseTo(100);
  });

  it("is 0 with no mix history or no group data (cold start)", () => {
    expect(mixForm(player([]), 1.0, CFG.mix).M).toBe(0);
    expect(mixForm(player([1.5]), null, CFG.mix).M).toBe(0);
  });

  it("is clamped to ±max", () => {
    expect(mixForm(player(Array(10).fill(3)), 1.0, CFG.mix).M).toBe(200);
  });
});

describe("skillScore", () => {
  const ctx = { now: NOW, groupRating: 1.0 };

  it("sums E + F + M", () => {
    const p: PlayerInput = {
      ...withForm(20, 1.3),
      mixRatings: Array(10).fill(1.15),
    };
    const s = skillScore(p, ctx, CFG);
    expect(s.E).toBe(2000);
    expect(s.S).toBeCloseTo(2200);
    expect(s).toMatchObject({
      eSource: "faceit",
      formMatches: 20,
      mixMaps: 10,
    });
  });

  it("falls back to the manual override when FACEIT ELO is missing", () => {
    const s = skillScore(
      { steamId: "1", faceitElo: null, manualSkillOverride: 1500 },
      ctx,
      CFG,
    );
    expect(s).toMatchObject({ E: 1500, S: 1500, eSource: "manual" });
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
