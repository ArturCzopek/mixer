// Balancing config. Stored per mix in `mixes.balance_config` so results are reproducible.
// Defaults and meaning: docs/04-team-balancing.md.

export type RuleMode = "hard" | "soft" | "off";

export interface RuleConfig {
  mode: RuleMode;
  /** Penalty in percentage points when the rule is violated in `soft` mode. */
  weight: number;
}

export interface BalanceConfig {
  form: {
    windowDays: number;
    shrinkK: number;
    beta: number;
    max: number;
    /** Matches before the window needed for a baseline; fewer gives F = 0. */
    minBaseline: number;
  };
  mix: { maps: number; shrinkK: number; gamma: number; max: number };
  /**
   * A top (bottom) duo exists only when p1–p2 (p9–p10) are within `maxGap` of each other
   * and at least `minSeparation` away from p3 (p8). Only then do the pair rules apply.
   */
  outlierPair: { maxGap: number; minSeparation: number };
  rules: {
    topPair: RuleConfig;
    bottomPair: RuleConfig;
    awpSplit: RuleConfig;
    repeatSplit: RuleConfig;
  };
  variants: number;
  minDistance: number;
}

export const DEFAULT_BALANCE_CONFIG: BalanceConfig = {
  form: { windowDays: 30, shrinkK: 10, beta: 500, max: 150, minBaseline: 10 },
  mix: { maps: 10, shrinkK: 5, gamma: 1000, max: 200 },
  outlierPair: { maxGap: 100, minSeparation: 200 },
  rules: {
    topPair: { mode: "hard", weight: 3 },
    bottomPair: { mode: "hard", weight: 3 },
    awpSplit: { mode: "soft", weight: 2 },
    repeatSplit: { mode: "soft", weight: 2 },
  },
  variants: 3,
  minDistance: 2,
};

export type BalanceConfigOverrides = {
  form?: Partial<BalanceConfig["form"]>;
  mix?: Partial<BalanceConfig["mix"]>;
  outlierPair?: Partial<BalanceConfig["outlierPair"]>;
  rules?: { [K in keyof BalanceConfig["rules"]]?: Partial<RuleConfig> };
  variants?: number;
  minDistance?: number;
};

/** Fills a partial config (e.g. admin tweaks) with defaults. */
export function resolveConfig(
  overrides: BalanceConfigOverrides = {},
): BalanceConfig {
  const d = DEFAULT_BALANCE_CONFIG;
  const r = overrides.rules ?? {};
  return {
    form: { ...d.form, ...overrides.form },
    mix: { ...d.mix, ...overrides.mix },
    outlierPair: { ...d.outlierPair, ...overrides.outlierPair },
    rules: {
      topPair: { ...d.rules.topPair, ...r.topPair },
      bottomPair: { ...d.rules.bottomPair, ...r.bottomPair },
      awpSplit: { ...d.rules.awpSplit, ...r.awpSplit },
      repeatSplit: { ...d.rules.repeatSplit, ...r.repeatSplit },
    },
    variants: overrides.variants ?? d.variants,
    minDistance: overrides.minDistance ?? d.minDistance,
  };
}
