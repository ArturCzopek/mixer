import "server-only";

import { resolveConfig, type BalanceConfig } from "@/lib/balance";
import { adminDb } from "@/lib/db/admin";
import { mixGenerationData, type MixGenerationData } from "@/lib/mix/queries";
import {
  selectedVariants,
  skillSnapshots,
  type SkillSnapshot,
} from "./generation";

export class StaleVariantSetError extends Error {}

interface PreviousVariantRow {
  chosen_variant_id: string;
}

interface PreviousTeamRow {
  team: "A" | "B";
  player: { steam_id: string };
}

async function previousSplit(
  groupId: string,
  mixId: string,
): Promise<[string[], string[]] | undefined> {
  const { data: previous, error } = await adminDb()
    .from("mixes")
    .select("chosen_variant_id")
    .eq("group_id", groupId)
    .neq("id", mixId)
    .not("chosen_variant_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<PreviousVariantRow>();
  if (error) throw new Error(`previousSplit mix: ${error.message}`);
  if (!previous?.chosen_variant_id) return undefined;

  const { data: players, error: playersError } = await adminDb()
    .from("variant_players")
    .select("team, player:players!variant_players_player_id_fkey(steam_id)")
    .eq("variant_id", previous.chosen_variant_id)
    .returns<PreviousTeamRow[]>();
  if (playersError)
    throw new Error(`previousSplit players: ${playersError.message}`);
  const a = players
    .filter((player) => player.team === "A")
    .map((p) => p.player.steam_id);
  const b = players
    .filter((player) => player.team === "B")
    .map((p) => p.player.steam_id);
  return a.length === 5 && b.length === 5 ? [a, b] : undefined;
}

function assertBalancing(
  mix: MixGenerationData | null,
): asserts mix is MixGenerationData {
  if (!mix) throw new StaleVariantSetError("Mix no longer exists");
  if (mix.status !== "balancing")
    throw new StaleVariantSetError("Mix is no longer balancing");
  if (mix.participants.length !== 10)
    throw new Error("Expected exactly ten mix participants");
}

export async function initialVariantPlan(mixId: string) {
  const mix = await mixGenerationData(mixId);
  assertBalancing(mix);
  if (mix.variants.length > 0)
    throw new StaleVariantSetError(
      "Variants already exist; refresh the mix page",
    );

  const config = resolveConfig();
  const at = mix.scheduledAt ? new Date(mix.scheduledAt) : new Date();
  const [snapshots, previous] = await Promise.all([
    skillSnapshots(mix.participants, {
      now: at,
      clubId: mix.clubId,
      config,
    }),
    previousSplit(mix.groupId, mix.id),
  ]);
  const selected = selectedVariants(snapshots, mix.participants, config, {
    previousSplit: previous,
  });
  return {
    balanceConfig: config,
    snapshots: Object.entries(snapshots).map(([playerId, snapshot]) => ({
      playerId,
      snapshot,
    })),
    variants: selected.variants,
  };
}

const isSkillSnapshot = (value: SkillSnapshot | null): value is SkillSnapshot =>
  !!value && !!value.input && !!value.breakdown;

function currentConfig(value: unknown): BalanceConfig {
  return resolveConfig((value ?? {}) as Parameters<typeof resolveConfig>[0]);
}

export async function rerollVariantPlan(
  mixId: string,
  expectedGeneration: number,
) {
  const mix = await mixGenerationData(mixId);
  assertBalancing(mix);
  const generation = Math.max(
    0,
    ...mix.variants.map((variant) => variant.generation),
  );
  const current = mix.variants.filter(
    (variant) =>
      variant.generation === generation && variant.rejectedAt === null,
  );
  if (
    generation !== expectedGeneration ||
    current.length !== 3 ||
    current.some((v) => v.isPublished)
  )
    throw new StaleVariantSetError(
      "Variant set changed; refresh before re-rolling",
    );

  const snapshots = Object.fromEntries(
    mix.participants.map((participant) => [
      participant.playerId,
      participant.snapshot,
    ]),
  );
  if (
    mix.participants.some(
      (participant) => !isSkillSnapshot(participant.snapshot),
    )
  )
    throw new Error(
      "A skill snapshot is missing; generate the first variant set again",
    );

  const config = currentConfig(mix.balanceConfig);
  const previous = await previousSplit(mix.groupId, mix.id);
  const selected = selectedVariants(
    snapshots as Record<string, SkillSnapshot>,
    mix.participants,
    config,
    {
      previousSplit: previous,
      excludedSplits: mix.variants.map((variant) => variant.teamA),
    },
  );
  return { variants: selected.variants };
}
