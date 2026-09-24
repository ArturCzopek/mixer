// Skill score S = E + F + M, all in FACEIT ELO points (docs/04-team-balancing.md §1).

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
   * Recent FACEIT match history (e.g. the last 100–200 matches). Matches inside the form window
   * are the "recent" sample; older ones form the player's own baseline.
   */
  faceit?: { matches: FaceitMatchSample[] };
  /** Mixer Rating per mix map, most recent first. */
  mixRatings?: number[];
  preferredRole?: PreferredRole;
}

export interface SkillContext {
  now: Date;
  /** Average Mixer Rating of all players over all mix maps; null before any mix data exists. */
  groupRating: number | null;
}

/** Inputs and result stored in `mix_participants.skill_snapshot`. */
export interface SkillBreakdown {
  steamId: string;
  E: number;
  F: number;
  M: number;
  S: number;
  eSource: "faceit" | "manual";
  formMatches: number;
  mixMaps: number;
  preferredRole: PreferredRole;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const clamp = (x: number, max: number) => Math.min(max, Math.max(-max, x));
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * F: FACEIT rating in the form window vs the player's own rating before it,
 * shrunk toward 1.0 by the number of recent matches.
 */
export function faceitForm(
  player: PlayerInput,
  now: Date,
  cfg: BalanceConfig["form"],
): { F: number; matches: number } {
  const from = now.getTime() - cfg.windowDays * DAY_MS;
  const window: number[] = [];
  const before: number[] = [];
  for (const m of player.faceit?.matches ?? []) {
    const t = Date.parse(m.finishedAt);
    if (t > now.getTime()) continue;
    (t >= from ? window : before).push(m.rating);
  }
  const n = window.length;
  if (n === 0 || before.length < cfg.minBaseline) return { F: 0, matches: n };
  const baseline = mean(before);
  if (baseline <= 0) return { F: 0, matches: n };

  const ratio = mean(window) / baseline;
  const shrunk = (n * ratio + cfg.shrinkK * 1.0) / (n + cfg.shrinkK);
  return { F: clamp(cfg.beta * (shrunk - 1), cfg.max), matches: n };
}

/** M: Mixer Rating over the last N mix maps vs the group average, shrunk toward the group. */
export function mixForm(
  player: PlayerInput,
  groupRating: number | null,
  cfg: BalanceConfig["mix"],
): { M: number; maps: number } {
  const ratings = (player.mixRatings ?? []).slice(0, cfg.maps);
  const n = ratings.length;
  if (n === 0 || groupRating === null) return { M: 0, maps: n };

  const shrunk =
    (n * mean(ratings) + cfg.shrinkK * groupRating) / (n + cfg.shrinkK);
  return { M: clamp(cfg.gamma * (shrunk - groupRating), cfg.max), maps: n };
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

  const { F, matches } = faceitForm(player, ctx.now, config.form);
  const { M, maps } = mixForm(player, ctx.groupRating, config.mix);

  return {
    steamId: player.steamId,
    E,
    F,
    M,
    S: E + F + M,
    eSource,
    formMatches: matches,
    mixMaps: maps,
    preferredRole: player.preferredRole ?? "any",
  };
}
