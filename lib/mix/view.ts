// Plain, serializable data behind the mix page (components/mix/mix-view.tsx). Built on the server:
// the showcase from lib/showcase/, later the database (M1-5..M1-7).

import type { BalanceConfig, SkillBreakdown, Variant } from "@/lib/balance";
import type { LeetifyMatch } from "@/lib/external/leetify";
import type { GroupMember } from "@/lib/groups/queries";
import type { SkillSnapshotInput } from "./generation";
import type { MixVariantPage } from "./queries";

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
  /** Original inputs and source labels captured with each skill snapshot. */
  skillInputs?: Record<string, SkillSnapshotInput>;
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
  /** Current unpublished generation on the admin balancing page. */
  generation?: number;
  /** Active group members not already in the mix, for 1:1 swaps. */
  swapCandidates?: { playerId: string; name: string }[];
  /** Current players who can be selected as the outgoing side of a swap. */
  swapLeavers?: { playerId: string; name: string }[];
  /** Server-recorded lineup changes. */
  swapLog?: { fromName: string; toName: string; byName: string; at: string }[];
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

interface VariantDetails {
  key: string;
  gap: number;
  imbalance: number;
  cost: number;
  penalties: Variant["penalties"];
  rank: number;
  duos: Variant["duos"];
  repeatedPairs: number | null;
  labels: Variant["labels"];
  candidateCount: number;
  relaxed: boolean;
  alwaysTogether: [string, string][];
}

function skillSnapshot(value: unknown): {
  input: SkillSnapshotInput;
  breakdown: SkillBreakdown;
} | null {
  if (!value || typeof value !== "object") return null;
  const snapshot = value as { input?: unknown; breakdown?: unknown };
  if (!snapshot.input || typeof snapshot.input !== "object") return null;
  if (!snapshot.breakdown || typeof snapshot.breakdown !== "object")
    return null;
  return snapshot as { input: SkillSnapshotInput; breakdown: SkillBreakdown };
}

/** Convert the private server query into the same view contract used by the showcase. */
export function mixVariantViewData(
  page: MixVariantPage,
  options: {
    number: number;
    meSteamId: string | null;
    viewerIsAdmin: boolean;
    groupMembers: Pick<GroupMember, "playerId" | "steamId" | "displayName">[];
  },
): MixViewData {
  const snapshots = new Map<
    string,
    { input: SkillSnapshotInput; breakdown: SkillBreakdown }
  >();
  for (const participant of page.participants) {
    const snapshot = skillSnapshot(participant.snapshot);
    if (snapshot) snapshots.set(participant.steamId, snapshot);
  }
  const players: ViewPlayer[] = page.participants.map((participant) => ({
    steamId: participant.steamId,
    name: participant.displayName ?? participant.steamId,
    avatar: participant.avatarUrl,
    level: snapshots.get(participant.steamId)?.input.swapInheritedFrom
      ? 0
      : (snapshots.get(participant.steamId)?.input.faceitLevel ?? 0),
  }));
  const breakdowns = Object.fromEntries(
    [...snapshots].map(([steamId, snapshot]) => [steamId, snapshot.breakdown]),
  );
  const skillInputs = Object.fromEntries(
    [...snapshots].map(([steamId, snapshot]) => [steamId, snapshot.input]),
  );
  const byId = new Map(page.participants.map((p) => [p.playerId, p.steamId]));
  const fromTeam = (team: { playerId: string; steamId: string }[]) =>
    team
      .map((player) => {
        const breakdown = breakdowns[player.steamId];
        if (!breakdown)
          throw new Error(`Missing skill snapshot for ${player.steamId}`);
        return breakdown;
      })
      .sort((a, b) => b.S - a.S || a.steamId.localeCompare(b.steamId));
  const variants: ViewVariant[] = page.variants.map((variant) => {
    const details = variant.details as Partial<VariantDetails> | null;
    const engine: Variant = {
      key: details?.key ?? variant.splitKey ?? String(variant.number),
      teamA: fromTeam(variant.teamA),
      teamB: fromTeam(variant.teamB),
      avgA: variant.teamAScore,
      avgB: variant.teamBScore,
      gap: details?.gap ?? variant.teamAScore - variant.teamBScore,
      winProbA: variant.winProbA,
      imbalance: details?.imbalance ?? 100 * Math.abs(variant.winProbA - 0.5),
      cost: details?.cost ?? variant.penalty,
      penalties: details?.penalties ?? [],
      rank: details?.rank ?? variant.number,
      duos: details?.duos ?? { top: null, bottom: null },
      repeatedPairs: details?.repeatedPairs ?? null,
      labels: details?.labels ?? [],
    };
    const voters = page.votes
      .filter((vote) => vote.variantId === variant.id)
      .map((vote) => vote.voterSteamId);
    return {
      number: variant.number,
      teamA: variant.teamA.map((p) => p.steamId),
      teamB: variant.teamB.map((p) => p.steamId),
      votes: voters.length,
      voters,
      engine,
    };
  });
  const participantIds = players.map((player) => player.steamId);
  const voted = new Set(page.votes.map((vote) => vote.voterSteamId));
  const meId =
    options.meSteamId && participantIds.includes(options.meSteamId)
      ? options.meSteamId
      : (participantIds[0] ?? "");
  const waitingForId = participantIds.find((id) => !voted.has(id)) ?? meId;
  const mixAt =
    Object.values(breakdowns)[0]?.form.windowTo ??
    page.mix.scheduledAt ??
    page.mix.createdAt;
  const swapRecords = Array.isArray(page.swapLog) ? page.swapLog : [];
  const swapNames = new Map<string, string>();
  for (const participant of page.participants)
    swapNames.set(
      participant.playerId,
      participant.displayName ?? participant.steamId,
    );
  for (const member of options.groupMembers)
    swapNames.set(member.playerId, member.displayName ?? member.steamId);
  const swapLog = swapRecords.flatMap((record) => {
    if (!record || typeof record !== "object") return [];
    const r = record as {
      from?: string;
      fromName?: string;
      to?: string;
      toName?: string;
      by?: string;
      byName?: string;
      at?: string;
    };
    if (!r.from || !r.to || !r.by || !r.at) return [];
    return [
      {
        fromName: r.fromName ?? swapNames.get(r.from) ?? String(r.from),
        toName: r.toName ?? swapNames.get(r.to) ?? String(r.to),
        byName: r.byName ?? swapNames.get(r.by) ?? String(r.by),
        at: r.at,
      },
    ];
  });
  const generation = variants.length
    ? Math.max(...page.variants.map((variant) => variant.generation))
    : undefined;
  const candidateCount = Number(
    (page.variants[0]?.details as Partial<VariantDetails> | null)
      ?.candidateCount ?? 0,
  );
  const alwaysTogether =
    (page.variants[0]?.details as Partial<VariantDetails> | null)
      ?.alwaysTogether ?? [];
  const config = page.balanceConfig as BalanceConfig;

  return {
    mix: {
      id: page.mix.id,
      number: options.number,
      group: page.groupName,
      meId,
      waitingForId,
    },
    mixAt,
    players,
    breakdowns,
    skillInputs,
    config,
    candidateCount,
    variants,
    participants: page.participants.map((participant) => ({
      steamId: participant.steamId,
      joinedAt: new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Warsaw",
      }).format(new Date(participant.createdAt)),
    })),
    lobbyCount: players.length,
    alwaysTogether,
    viewerIsAdmin: options.viewerIsAdmin,
    generation,
    swapCandidates: options.viewerIsAdmin
      ? options.groupMembers
          .filter((member) => !byId.has(member.playerId))
          .map((member) => ({
            playerId: member.playerId,
            name: member.displayName ?? member.steamId,
          }))
      : [],
    swapLeavers: page.participants.map((participant) => ({
      playerId: participant.playerId,
      name: participant.displayName ?? participant.steamId,
    })),
    swapLog,
    result: { maps: [], source: "faceit" },
    leetify: null,
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
