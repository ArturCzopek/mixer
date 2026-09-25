// Skill score S = wE·E + wF·F + wM·M + wA·A, all in FACEIT ELO points (docs/04-team-balancing.md §1).
// Every function returns the numbers behind its result, so the UI can explain S (D22).

import type { BalanceConfig } from "./config";

export type PreferredRole = "awp" | "rifle" | "any";

export interface FaceitMatchSample {
  /** ISO 8601 timestamp of when the match finished. */
  finishedAt: string;
  /** Per-match performance, see `faceitMatchRating`. */
  rating: number;
}

export interface PlayerInput {
  steamId: string;
  faceitElo: number | null;
  /** Admin-entered ELO, used when FACEIT ELO is missing. */
  manualSkillOverride?: number | null;
  /**
   * Recent FACEIT match history (e.g. the last 100–200 matches) used for form: 5v5, with damage
   * data, club matches excluded. Matches inside the form window are the "recent" sample; older
   * ones form the player's own baseline.
   */
  faceit?: { matches: FaceitMatchSample[] };
  /**
   * Finish times of everything the player played, for activity A: every FACEIT match (any mode,
   * club matches included) plus mix maps entered without FACEIT. Defaults to `faceit.matches`.
   */
  activity?: { playedAt: string[] };
  /** Mixer Rating per mix map, most recent first. */
  mixRatings?: number[];
  preferredRole?: PreferredRole;
}

export interface SkillContext {
  now: Date;
  /** Average Mixer Rating of all players over all mix maps; null before any mix data exists. */
  groupRating: number | null;
}

export interface FormExplanation {
  /** Final F after asymmetry and clamping. */
  F: number;
  /** The form window [from, to): the 30 days before the mix (balancing time), not before today. */
  windowFrom: string;
  windowTo: string;
  status: "ok" | "no-recent-matches" | "thin-baseline" | "invalid-baseline";
  /** Matches in the window (n). */
  matches: number;
  /** Matches before the window (the player's own baseline). */
  baselineMatches: number;
  windowRating: number | null;
  baselineRating: number | null;
  ratio: number | null;
  /** Ratio after shrinkage toward 1.0. */
  shrunkRatio: number | null;
  /** β · (ratio^ − 1), clamped to ±max. */
  raw: number;
  rawClamped: boolean;
  /** Which multiplier applied: `up` for raw ≥ 0, `down` for a slump. */
  direction: "up" | "down";
  /** m+(E) or m−(E) for this player's ELO. */
  multiplier: number;
  /** Final ±max clamp hit after the multiplier. */
  clamped: boolean;
}

export interface MixExplanation {
  M: number;
  status: "ok" | "no-maps" | "no-group-data";
  maps: number;
  playerRating: number | null;
  groupRating: number | null;
  shrunkRating: number | null;
  clamped: boolean;
}

export interface ActivityExplanation {
  A: number;
  status: "ok" | "no-data";
  /** Sessions (evenings) that ended inside the window. */
  sessions: number;
  windowDays: number;
  /** The activity window [from, to), anchored at the mix like the form window. */
  windowFrom: string;
  windowTo: string;
  lastPlayedAt: string | null;
}

/** Everything behind one player's S; stored in `mix_participants.skill_snapshot`. */
export interface SkillBreakdown {
  steamId: string;
  preferredRole: PreferredRole;
  /** Term values before weights. */
  E: number;
  F: number;
  M: number;
  A: number;
  /** Sum of `contributions`: whole ELO points. */
  S: number;
  eSource: "faceit" | "manual";
  weights: BalanceConfig["weights"];
  /** weight · term, each rounded to whole points; they add up to S exactly. */
  contributions: { E: number; F: number; M: number; A: number };
  form: FormExplanation;
  mix: MixExplanation;
  activity: ActivityExplanation;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const clamp = (x: number, max: number) => Math.min(max, Math.max(-max, x));
/** Whole ELO points, without a negative zero. */
const whole = (x: number) => Math.round(x) || 0;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Piecewise-linear interpolation through sorted points, flat outside the first and last. */
export function interpolate(x: number, points: [number, number][]): number {
  if (points.length === 0) throw new Error("No anchor points");
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    if (x <= x1) {
      const [x0, y0] = points[i - 1];
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return points[points.length - 1][1];
}

/** m+(E) and m−(E): form multipliers for a FACEIT ELO (D24 amended, docs/04 §1). */
export function formMultipliers(
  elo: number,
  asymmetry: BalanceConfig["form"]["asymmetry"],
): { up: number; down: number } {
  return {
    up: interpolate(
      elo,
      asymmetry.map((a) => [a.elo, a.up]),
    ),
    down: interpolate(
      elo,
      asymmetry.map((a) => [a.elo, a.down]),
    ),
  };
}

/**
 * F: FACEIT rating in the form window vs the player's own rating before it, shrunk toward 1.0
 * by the number of recent matches, then scaled by the multiplier for the player's ELO.
 */
export function faceitForm(
  player: PlayerInput,
  elo: number,
  now: Date,
  cfg: BalanceConfig["form"],
): FormExplanation {
  const from = now.getTime() - cfg.windowDays * DAY_MS;
  const window: number[] = [];
  const before: number[] = [];
  for (const m of player.faceit?.matches ?? []) {
    const t = Date.parse(m.finishedAt);
    if (t > now.getTime()) continue;
    (t >= from ? window : before).push(m.rating);
  }
  const n = window.length;
  const { up } = formMultipliers(elo, cfg.asymmetry);
  const empty: FormExplanation = {
    F: 0,
    windowFrom: new Date(from).toISOString(),
    windowTo: now.toISOString(),
    status: "ok",
    matches: n,
    baselineMatches: before.length,
    windowRating: n ? mean(window) : null,
    baselineRating: before.length ? mean(before) : null,
    ratio: null,
    shrunkRatio: null,
    raw: 0,
    rawClamped: false,
    direction: "up",
    multiplier: up,
    clamped: false,
  };
  if (n === 0) return { ...empty, status: "no-recent-matches" };
  if (before.length < cfg.minBaseline)
    return { ...empty, status: "thin-baseline" };
  const baseline = mean(before);
  if (baseline <= 0) return { ...empty, status: "invalid-baseline" };

  const ratio = mean(window) / baseline;
  const shrunk = (n * ratio + cfg.shrinkK * 1.0) / (n + cfg.shrinkK);
  const unclamped = cfg.beta * (shrunk - 1);
  const raw = clamp(unclamped, cfg.max);
  const direction = raw >= 0 ? "up" : "down";
  const multiplier = formMultipliers(elo, cfg.asymmetry)[direction];
  const scaled = raw * multiplier;
  const F = clamp(scaled, cfg.max);
  return {
    ...empty,
    F,
    ratio,
    shrunkRatio: shrunk,
    raw,
    rawClamped: raw !== unclamped,
    direction,
    multiplier,
    clamped: F !== scaled,
  };
}

/** Number of sessions: runs of matches less than `gapHours` apart. Returns their end times. */
export function sessionEnds(playedAt: number[], gapHours: number): number[] {
  const sorted = [...playedAt].sort((a, b) => a - b);
  const ends: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const last = i === sorted.length - 1;
    if (last || sorted[i + 1] - sorted[i] >= gapHours * HOUR_MS)
      ends.push(sorted[i]);
  }
  return ends;
}

/** A: activity (D26). Sessions that ended in the window, mapped through the anchor curve. */
export function activity(
  player: PlayerInput,
  now: Date,
  cfg: BalanceConfig["activity"],
): ActivityExplanation {
  const playedAt = (
    player.activity?.playedAt ??
    player.faceit?.matches.map((m) => m.finishedAt) ??
    []
  )
    .map(Date.parse)
    .filter((t) => t <= now.getTime());
  const from = now.getTime() - cfg.windowDays * DAY_MS;
  const window = {
    windowDays: cfg.windowDays,
    windowFrom: new Date(from).toISOString(),
    windowTo: now.toISOString(),
  };
  if (playedAt.length === 0)
    return {
      A: 0,
      status: "no-data",
      sessions: 0,
      ...window,
      lastPlayedAt: null,
    };

  const ends = sessionEnds(playedAt, cfg.sessionGapHours);
  const sessions = ends.filter((t) => t >= from).length;
  return {
    A: interpolate(
      sessions,
      cfg.anchors.map((a) => [a.sessions, a.value]),
    ),
    status: "ok",
    sessions,
    ...window,
    lastPlayedAt: new Date(ends[ends.length - 1]).toISOString(),
  };
}

/** M: Mixer Rating over the last N mix maps vs the group average, shrunk toward the group. */
export function mixForm(
  player: PlayerInput,
  groupRating: number | null,
  cfg: BalanceConfig["mix"],
): MixExplanation {
  const ratings = (player.mixRatings ?? []).slice(0, cfg.maps);
  const n = ratings.length;
  const base: MixExplanation = {
    M: 0,
    status: "ok",
    maps: n,
    playerRating: n ? mean(ratings) : null,
    groupRating,
    shrunkRating: null,
    clamped: false,
  };
  if (n === 0) return { ...base, status: "no-maps" };
  if (groupRating === null) return { ...base, status: "no-group-data" };

  const shrunk =
    (n * mean(ratings) + cfg.shrinkK * groupRating) / (n + cfg.shrinkK);
  const unclamped = cfg.gamma * (shrunk - groupRating);
  const M = clamp(unclamped, cfg.max);
  return { ...base, M, shrunkRating: shrunk, clamped: M !== unclamped };
}

export function skillScore(
  player: PlayerInput,
  ctx: SkillContext,
  config: BalanceConfig,
): SkillBreakdown {
  let E: number;
  let eSource: SkillBreakdown["eSource"];
  if (player.faceitElo != null) {
    E = player.faceitElo;
    eSource = "faceit";
  } else if (player.manualSkillOverride != null) {
    E = player.manualSkillOverride;
    eSource = "manual";
  } else {
    throw new Error(
      `Player ${player.steamId} has no FACEIT ELO and no manual skill override`,
    );
  }

  const form = faceitForm(player, E, ctx.now, config.form);
  const mix = mixForm(player, ctx.groupRating, config.mix);
  const act = activity(player, ctx.now, config.activity);
  const w = config.weights;
  const contributions = {
    E: whole(w.elo * E),
    F: whole(w.faceitForm * form.F),
    M: whole(w.mixForm * mix.M),
    A: whole(w.activity * act.A),
  };

  return {
    steamId: player.steamId,
    preferredRole: player.preferredRole ?? "any",
    E,
    F: form.F,
    M: mix.M,
    A: act.A,
    S: contributions.E + contributions.F + contributions.M + contributions.A,
    eSource,
    weights: { ...w },
    contributions,
    form,
    mix,
    activity: act,
  };
}
