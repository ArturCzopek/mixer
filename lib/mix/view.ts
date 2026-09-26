// Plain, serializable data behind the mix page (components/mix/mix-view.tsx). Built on the server:
// the showcase from lib/showcase/, later the database (M1-5..M1-7).

import type { BalanceConfig, SkillBreakdown, Variant } from "@/lib/balance";
import type { LeetifyMatch } from "@/lib/external/leetify";

export interface ViewPlayer {
  steamId: string;
  name: string;
  avatar: string | null;
  /** FACEIT level (1–10); 0 when unknown. */
  level: number;
}

export interface ViewVariant {
  number: number;
  teamA: string[];
  teamB: string[];
  votes: number;
  /** Who voted for this variant, in vote order. Votes are public (owner, 2026-09-25). */
  voters: string[];
  /** The engine's variant: averages, win chance, cost split, labels. */
  engine: Variant;
}

export interface ViewLine {
  steamId: string;
  team: "A" | "B";
  k: number;
  a: number;
  d: number;
  adr: number;
  rounds: number;
  /** Mixer Rating of the line. */
  rating: number;
}

export interface ViewMap {
  map: string;
  a: number;
  b: number;
  lines: ViewLine[];
}

export interface MixViewData {
  mix: {
    /** Mix id; also seeds the tie-break between equally voted variants (D33). */
    id: string;
    number: number;
    group: string;
    meId: string;
    /** Who has not voted yet (voting state). */
    waitingForId: string;
  };
  /** Start of the mix; every "last 30 days" window ends here (D30). */
  mixAt: string;
  players: ViewPlayer[];
  breakdowns: Record<string, SkillBreakdown>;
  config: BalanceConfig;
  /** Splits left after hard rules, for "rank x of n". */
  candidateCount: number;
  variants: ViewVariant[];
  /** Everyone in join order (D28); `joinedAt` is local time on mix day. */
  participants: { steamId: string; joinedAt: string }[];
  /** How many of `participants` are in the lobby state (everyone before `me`). */
  lobbyCount: number;
  /** Pairs who are teammates in every proposed variant (ideally none, D33). */
  alwaysTogether: [string, string][];
  /** The viewer is an admin of the mix's group (shows the admin panel). */
  viewerIsAdmin: boolean;
  result: { maps: ViewMap[]; source: string };
  /**
   * Live Leetify preview per player (FACEIT matches in `window`, never stored); a player's entry is
   * null when Leetify could not be reached or does not know them. Null hides the card.
   */
  leetify: {
    window: { from: string; to: string; live: boolean };
    matches: Record<string, LeetifyMatch[] | null>;
  } | null;
  /** Set on the showcase page (its title and notes come from the dictionary). */
  showcase?: {
    /** The lineup they really played that evening, for comparison with the voted variant. */
    real: {
      teamA: string[];
      teamB: string[];
      avgA: number;
      avgB: number;
      winProbA: number;
      /** Rank among all 126 splits by evenness. */
      rank: number;
    };
  };
}

/** Sums each player's lines over all maps (ADR and rating weighted by rounds). */
export function totals(maps: ViewMap[]): ViewLine[] {
  const byId = new Map<string, ViewLine>();
  for (const line of maps.flatMap((m) => m.lines)) {
    const t = byId.get(line.steamId);
    if (!t) {
      byId.set(line.steamId, { ...line });
      continue;
    }
    const rounds = t.rounds + line.rounds;
    t.adr = (t.adr * t.rounds + line.adr * line.rounds) / rounds;
    t.rating = (t.rating * t.rounds + line.rating * line.rounds) / rounds;
    t.k += line.k;
    t.a += line.a;
    t.d += line.d;
    t.rounds = rounds;
  }
  return [...byId.values()];
}

/**
 * Made-up votes for previews: everyone except `waitingForId` votes, in join order, filling the
 * variants with `counts` (e.g. [4, 3, 2]).
 */
export function previewVoters(
  participantIds: string[],
  waitingForId: string,
  counts: number[],
): string[][] {
  const voters = participantIds.filter((id) => id !== waitingForId);
  let i = 0;
  return counts.map((n) => voters.slice(i, (i += n)));
}
