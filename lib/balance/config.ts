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
  rules: {
    topPair: RuleConfig;
    bottomPair: RuleConfig;
    midPairs: RuleConfig;
    awpSplit: RuleConfig;
    repeatSplit: RuleConfig;
  };
  variants: number;
  minDistance: number;
}

export const DEFAULT_BALANCE_CONFIG: BalanceConfig = {
  form: { windowDays: 30, shrinkK: 10, beta: 500, max: 150, minBaseline: 10 },
  mix: { maps: 10, shrinkK: 5, gamma: 1000, max: 200 },
  rules: {
    topPair: { mode: "hard", weight: 3 },
    bottomPair: { mode: "hard", weight: 3 },
    midPairs: { mode: "soft", weight: 0.5 },
    awpSplit: { mode: "soft", weight: 2 },
    repeatSplit: { mode: "soft", weight: 2 },
  },
  variants: 3,
  minDistance: 2,
};

export type BalanceConfigOverrides = {
  form?: Partial<BalanceConfig["form"]>;
  mix?: Partial<BalanceConfig["mix"]>;
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
    rules: {
      topPair: { ...d.rules.topPair, ...r.topPair },
      bottomPair: { ...d.rules.bottomPair, ...r.bottomPair },
      midPairs: { ...d.rules.midPairs, ...r.midPairs },
      awpSplit: { ...d.rules.awpSplit, ...r.awpSplit },
      repeatSplit: { ...d.rules.repeatSplit, ...r.repeatSplit },
    },
    variants: overrides.variants ?? d.variants,
    minDistance: overrides.minDistance ?? d.minDistance,
  };
}
