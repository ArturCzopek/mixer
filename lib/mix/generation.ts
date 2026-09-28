import "server-only";

import {
  DEFAULT_BALANCE_CONFIG,
  generateVariants,
  skillScore,
  type BalanceConfig,
  type FaceitMatchSample,
  type PlayerInput,
  type SkillBreakdown,
  type Variant,
} from "@/lib/balance";
import {
  getMatchStats,
  getPlayerBySteamId,
  toFormSamples,
  type FaceitMatchStat,
  type FaceitPlayer,
} from "@/lib/external/faceit";

export type EloSource =
  "faceit" | "group-manual" | "mix-mean" | "neutral-default" | "swap-slot";

export interface GenerationMember {
  playerId: string;
  steamId: string;
  manualElo: number | null;
  preferredRole: PlayerInput["preferredRole"];
}

export interface SkillSnapshotInput extends PlayerInput {
  resolvedElo: number;
  eloSource: EloSource;
  faceitLevel: number | null;
  faceitFormAvailable: boolean;
  swapInheritedFrom: string | null;
}

export interface SkillSnapshot {
  input: SkillSnapshotInput;
  breakdown: SkillBreakdown;
}

export interface FaceitSource {
  getPlayerBySteamId(steamId: string): Promise<FaceitPlayer | null>;
  getMatchStats(
    playerId: string,
    range: { maxItems?: number },
  ): Promise<FaceitMatchStat[]>;
}

const faceit: FaceitSource = { getPlayerBySteamId, getMatchStats };
const mean = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

/** Fetch independently so one FACEIT failure never prevents a mix from being balanced. */
export async function skillSnapshots(
  members: GenerationMember[],
  options: {
    now: Date;
    clubId?: string | null;
    config?: BalanceConfig;
    source?: FaceitSource;
  },
): Promise<Record<string, SkillSnapshot>> {
  const config = options.config ?? DEFAULT_BALANCE_CONFIG;
  const source = options.source ?? faceit;
  const loaded = await Promise.all(
    members.map(async (member) => {
      let profile: FaceitPlayer | null = null;
      try {
        profile = await source.getPlayerBySteamId(member.steamId);
      } catch {
        // FACEIT is optional; the ELO fallback below and an unavailable-form note are stored.
      }

      let stats: FaceitMatchStat[] = [];
      let faceitFormAvailable = false;
      if (profile?.playerId) {
        try {
          stats = await source.getMatchStats(profile.playerId, {
            maxItems: 200,
          });
          faceitFormAvailable = true;
        } catch {
          // The engine receives no form samples, which means F = 0.
        }
      }
      const excludeCompetitionIds = options.clubId ? [options.clubId] : [];
      const samples = faceitFormAvailable
        ? toFormSamples(stats, { excludeCompetitionIds })
        : [];
      return {
        member,
        faceitElo: profile?.elo ?? null,
        faceitLevel: profile?.level ?? null,
        faceitFormAvailable,
        samples,
        playedAt: stats.map((match) => match.finishedAt),
      };
    }),
  );

  const snapshots: Record<string, SkillSnapshot> = {};

  for (const item of loaded) {
    const { member, faceitElo, faceitLevel, faceitFormAvailable, samples } =
      item;
    const otherKnown = loaded
      .filter((other) => other.member.playerId !== member.playerId)
      .map(
        ({ member: otherMember, faceitElo: otherElo }) =>
          otherElo ?? otherMember.manualElo,
      )
      .filter((elo): elo is number => elo !== null);

    let resolvedElo: number;
    let eloSource: EloSource;
    if (faceitElo !== null) {
      resolvedElo = faceitElo;
      eloSource = "faceit";
    } else if (member.manualElo !== null) {
      resolvedElo = member.manualElo;
      eloSource = "group-manual";
    } else if (otherKnown.length > 0) {
      resolvedElo = mean(otherKnown);
      eloSource = "mix-mean";
    } else {
      // Artur's neutral seed for a roster without sourced ELO.
      resolvedElo = 1400;
      eloSource = "neutral-default";
    }

    const input: SkillSnapshotInput = {
      steamId: member.steamId,
      faceitElo,
      manualSkillOverride: member.manualElo,
      faceit: { matches: samples satisfies FaceitMatchSample[] },
      activity: { playedAt: item.playedAt },
      mixRatings: [],
      preferredRole: member.preferredRole,
      resolvedElo,
      eloSource,
      faceitLevel,
      faceitFormAvailable,
      swapInheritedFrom: null,
    };
    const breakdown = skillScore(
      {
        ...input,
        manualSkillOverride:
          faceitElo === null && member.manualElo === null
            ? resolvedElo
            : member.manualElo,
      },
      { now: options.now, groupRating: null },
      config,
    );
    snapshots[member.playerId] = { input, breakdown };
  }
  return snapshots;
}

export interface VariantRpcRow {
  splitKey: string;
  teamA: string[];
  teamB: string[];
  avgA: number;
  avgB: number;
  winProbA: number;
  penalty: number;
  details: Omit<Variant, "teamA" | "teamB" | "avgA" | "avgB" | "winProbA"> & {
    candidateCount: number;
    relaxed: boolean;
    alwaysTogether: [string, string][];
  };
}

export function variantSet(
  players: SkillBreakdown[],
  playerIds: Record<string, string>,
  config: BalanceConfig,
  options: {
    previousSplit?: [string[], string[]];
    excludedSplits?: string[][];
  } = {},
): {
  variants: VariantRpcRow[];
  candidateCount: number;
  generationResult: ReturnType<typeof generateVariants>;
} {
  const generationResult = generateVariants({
    players,
    config,
    previousSplit: options.previousSplit,
    excludedSplits: options.excludedSplits,
  });
  if (generationResult.variants.length !== 3)
    throw new Error(
      "The balance engine could not produce three distinct variants",
    );

  return {
    candidateCount: generationResult.candidateCount,
    generationResult,
    variants: generationResult.variants.map((variant) => {
      const details = {
        key: variant.key,
        gap: variant.gap,
        imbalance: variant.imbalance,
        cost: variant.cost,
        penalties: variant.penalties,
        rank: variant.rank,
        duos: variant.duos,
        repeatedPairs: variant.repeatedPairs,
        labels: variant.labels,
        candidateCount: generationResult.candidateCount,
        relaxed: generationResult.relaxed,
        alwaysTogether: generationResult.alwaysTogether,
      };
      return {
        splitKey: variant.key,
        teamA: variant.teamA.map((player) => {
          const id = playerIds[player.steamId];
          if (!id)
            throw new Error(`Missing database player for ${player.steamId}`);
          return id;
        }),
        teamB: variant.teamB.map((player) => {
          const id = playerIds[player.steamId];
          if (!id)
            throw new Error(`Missing database player for ${player.steamId}`);
          return id;
        }),
        avgA: variant.avgA,
        avgB: variant.avgB,
        winProbA: variant.winProbA,
        penalty: variant.penalties.reduce(
          (sum, penalty) => sum + penalty.pp,
          0,
        ),
        details,
      };
    }),
  };
}

export function selectedVariants(
  snapshots: Record<string, SkillSnapshot>,
  members: GenerationMember[],
  config: BalanceConfig,
  options: {
    previousSplit?: [string[], string[]];
    excludedSplits?: string[][];
  } = {},
) {
  const playerIds = Object.fromEntries(
    members.map((member) => [member.steamId, member.playerId]),
  );
  return variantSet(
    members.map((member) => {
      const snapshot = snapshots[member.playerId];
      if (!snapshot)
        throw new Error(`Missing skill snapshot for ${member.playerId}`);
      return snapshot.breakdown;
    }),
    playerIds,
    config,
    options,
  );
}
