// Balancing config. Stored per mix in `mixes.balance_config` so results are reproducible.
// Defaults and meaning: docs/04-team-balancing.md.

export type RuleMode = "hard" | "soft" | "off";

export interface RuleConfig {
  mode: RuleMode;
  /** Penalty in percentage points when the rule is violated in `soft` mode. */
  weight: number;
}

/** Form multipliers at one FACEIT ELO (D24 amended): `up` scales good form, `down` a slump. */
export interface AsymmetryAnchor {
  elo: number;
  up: number;
  down: number;
}

/** Activity term A at a number of sessions in the window (D26). */
export interface ActivityAnchor {
  sessions: number;
  value: number;
}

export interface BalanceConfig {
  /** S = elo·E + faceitForm·F + mixForm·M + activity·A (D22, D24, D26). */
  weights: {
    elo: number;
    faceitForm: number;
    mixForm: number;
    activity: number;
  };
  form: {
    windowDays: number;
    shrinkK: number;
    beta: number;
    max: number;
    /** Matches before the window needed for a baseline; fewer gives F = 0. */
    minBaseline: number;
    /** Multipliers by absolute ELO, sorted by `elo`; linear between anchors, flat outside. */
    asymmetry: AsymmetryAnchor[];
  };
  activity: {
    windowDays: number;
    /** Matches closer than this belong to the same session (an evening). */
    sessionGapHours: number;
    /** Sorted by `sessions`; linear between anchors, flat outside. */
    anchors: ActivityAnchor[];
  };
  mix: {
    maps: number;
    shrinkK: number;
    gamma: number;
    max: number;
    /** Like `form.asymmetry`, for mix form (D32): same idea, tuned separately. */
    asymmetry: AsymmetryAnchor[];
  };
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
  weights: { elo: 1, faceitForm: 1, mixForm: 0.5, activity: 0.5 },
  form: {
    windowDays: 30,
    shrinkK: 10,
    beta: 500,
    max: 150,
    minBaseline: 10,
    asymmetry: [
      { elo: 1000, up: 1.5, down: 0.3 },
      { elo: 1500, up: 1.0, down: 0.45 },
      { elo: 2000, up: 0.1, down: 0.6 },
    ],
  },
  activity: {
    windowDays: 30,
    sessionGapHours: 6,
    anchors: [
      { sessions: 0, value: -60 },
      { sessions: 1, value: -40 },
      { sessions: 2, value: -20 },
      { sessions: 3, value: 0 },
      { sessions: 6, value: 15 },
    ],
  },
  mix: {
    maps: 10,
    shrinkK: 5,
    gamma: 1000,
    max: 200,
    asymmetry: [
      { elo: 1000, up: 1.5, down: 0.3 },
      { elo: 1500, up: 1.0, down: 0.45 },
      { elo: 2000, up: 0.1, down: 0.6 },
    ],
  },
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
  weights?: Partial<BalanceConfig["weights"]>;
  form?: Partial<BalanceConfig["form"]>;
  activity?: Partial<BalanceConfig["activity"]>;
  mix?: Partial<BalanceConfig["mix"]>;
  outlierPair?: Partial<BalanceConfig["outlierPair"]>;
  rules?: { [K in keyof BalanceConfig["rules"]]?: Partial<RuleConfig> };
  variants?: number;
  minDistance?: number;
};

/** Fills a partial config (e.g. admin tweaks) with defaults. Anchor lists are replaced, not merged. */
export function resolveConfig(
  overrides: BalanceConfigOverrides = {},
): BalanceConfig {
  const d = DEFAULT_BALANCE_CONFIG;
  const r = overrides.rules ?? {};
  return {
    weights: { ...d.weights, ...overrides.weights },
    form: { ...d.form, ...overrides.form },
    activity: { ...d.activity, ...overrides.activity },
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
