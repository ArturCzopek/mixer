"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { AuthError } from "@/lib/auth/roles";
import { requireGroupRole, requireSession } from "@/lib/auth/server";
import { adminDb } from "@/lib/db/admin";
import {
  initialVariantPlan,
  rerollVariantPlan,
  StaleVariantSetError,
} from "@/lib/mix/variant-service";

const MIX_STATUSES = [
  "open",
  "balancing",
  "voting",
  "locked",
  "played",
  "cancelled",
] as const;
export type MixStatus = (typeof MIX_STATUSES)[number];

export type MixActionError =
  | "title"
  | "full"
  | "notMember"
  | "notOpen"
  | "notFull"
  | "stale"
  | "noVariants"
  | "unauthorized"
  | "forbidden"
  | "failed";
export type MixActionState =
  { error: MixActionError } | { ok: true } | undefined;

const PG_UNIQUE = "23505";
const PG_FOREIGN_KEY = "23503";
const PG_CHECK = "23514";
const PG_STATE = "55000";
const uuid = z.uuid();

function authState(action: string, error: unknown): { error: MixActionError } {
  if (error instanceof AuthError)
    return { error: error.status === 401 ? "unauthorized" : "forbidden" };
  return logFailure(`${action} authorization`, error);
}

function logFailure(action: string, error: unknown): { error: "failed" } {
  console.error(`${action} failed`, error);
  return { error: "failed" };
}

async function dbCall<T>(
  action: string,
  query: () => PromiseLike<T>,
): Promise<{ ok: true; value: T } | { ok: false; state: { error: "failed" } }> {
  try {
    return { ok: true, value: await query() };
  } catch (error) {
    return { ok: false, state: logFailure(action, error) };
  }
}

interface MixTarget {
  group_id: string;
}

async function mixTarget(
  mixId: string,
): Promise<MixTarget | { error: MixActionError }> {
  const result = await dbCall("mix target lookup", () =>
    adminDb()
      .from("mixes")
      .select("group_id")
      .eq("id", mixId)
      .maybeSingle<MixTarget>(),
  );
  if (!result.ok) return result.state;
  if (result.value.error)
    return logFailure("mix target lookup", result.value.error);
  return result.value.data ?? { error: "forbidden" };
}

async function authorizedMix(
  action: string,
  mixId: string,
  role: "admin" | "member",
) {
  let session;
  try {
    session = await requireSession();
  } catch (error) {
    return authState(action, error);
  }

  const target = await mixTarget(mixId);
  if ("error" in target) return target;

  try {
    await requireGroupRole(target.group_id, role);
  } catch (error) {
    return authState(action, error);
  }
  return { session, groupId: target.group_id };
}

/** Group admins create a titled lobby. scheduled_at remains null in M1-5. */
export async function createMix(
  groupId: string,
  _prev: MixActionState,
  form: FormData,
): Promise<MixActionState> {
  if (!uuid.safeParse(groupId).success) return { error: "forbidden" };

  let session;
  try {
    session = await requireGroupRole(groupId, "admin");
  } catch (error) {
    return authState("createMix", error);
  }

  const rawTitle = form.get("title");
  const title = typeof rawTitle === "string" ? rawTitle.trim() : "";
  const titleLength = Array.from(title).length;
  if (titleLength < 2 || titleLength > 60) return { error: "title" };

  const groupResult = await dbCall("createMix group lookup", () =>
    adminDb()
      .from("groups")
      .select("slug")
      .eq("id", groupId)
      .maybeSingle<{ slug: string }>(),
  );
  if (!groupResult.ok) return groupResult.state;
  const { data: group, error: groupError } = groupResult.value;
  if (groupError) return logFailure("createMix group lookup", groupError);
  if (!group) return { error: "forbidden" };

  const insertResult = await dbCall("createMix", () =>
    adminDb()
      .from("mixes")
      .insert({ group_id: groupId, title, created_by: session.playerId })
      .select("id")
      .single<{ id: string }>(),
  );
  if (!insertResult.ok) return insertResult.state;
  const { data, error } = insertResult.value;
  if (error) {
    if (error.code === PG_CHECK) return { error: "title" };
    return logFailure("createMix", error);
  }
  if (!data) return logFailure("createMix returned no id", data);
  redirect(`/g/${group.slug}/m/${data.id}`);
}

export async function joinMix(mixId: string): Promise<MixActionState> {
  if (!uuid.safeParse(mixId).success) return { error: "forbidden" };
  const auth = await authorizedMix("joinMix", mixId, "member");
  if ("error" in auth) return auth;

  const lookup = await dbCall("joinMix participant lookup", () =>
    adminDb()
      .from("mix_participants")
      .select("player_id")
      .eq("mix_id", mixId)
      .eq("player_id", auth.session.playerId)
      .maybeSingle(),
  );
  if (!lookup.ok) return lookup.state;
  const { data: existing, error: lookupError } = lookup.value;
  if (lookupError) return logFailure("joinMix participant lookup", lookupError);
  if (existing) return { ok: true };

  const insert = await dbCall("joinMix", () =>
    adminDb().from("mix_participants").insert({
      mix_id: mixId,
      player_id: auth.session.playerId,
      added_by: auth.session.playerId,
    }),
  );
  if (!insert.ok) return insert.state;
  const { error } = insert.value;
  if (!error || error.code === PG_UNIQUE) return { ok: true };
  if (error.code === PG_CHECK) return { error: "full" };
  if (error.code === PG_FOREIGN_KEY) return { error: "notMember" };
  if (error.code === PG_STATE) return { error: "notOpen" };
  return logFailure("joinMix", error);
}

export async function leaveMix(mixId: string): Promise<MixActionState> {
  if (!uuid.safeParse(mixId).success) return { error: "forbidden" };
  let session;
  try {
    session = await requireSession();
  } catch (error) {
    return authState("leaveMix", error);
  }
  const target = await mixTarget(mixId);
  if ("error" in target) return target;

  const deletion = await dbCall("leaveMix", () =>
    adminDb()
      .from("mix_participants")
      .delete()
      .eq("mix_id", mixId)
      .eq("player_id", session.playerId),
  );
  if (!deletion.ok) return deletion.state;
  const { error } = deletion.value;
  if (!error) return { ok: true };
  if (error.code === PG_STATE) return { error: "notOpen" };
  return logFailure("leaveMix", error);
}

export async function addParticipant(
  mixId: string,
  playerId: string,
): Promise<MixActionState> {
  if (!uuid.safeParse(mixId).success || !uuid.safeParse(playerId).success)
    return { error: "forbidden" };
  const auth = await authorizedMix("addParticipant", mixId, "admin");
  if ("error" in auth) return auth;

  const insert = await dbCall("addParticipant", () =>
    adminDb().from("mix_participants").insert({
      mix_id: mixId,
      player_id: playerId,
      added_by: auth.session.playerId,
    }),
  );
  if (!insert.ok) return insert.state;
  const { error } = insert.value;
  if (!error || error.code === PG_UNIQUE) return { ok: true };
  if (error.code === PG_CHECK) return { error: "full" };
  if (error.code === PG_FOREIGN_KEY) return { error: "notMember" };
  if (error.code === PG_STATE) return { error: "notOpen" };
  return logFailure("addParticipant", error);
}

export async function removeParticipant(
  mixId: string,
  playerId: string,
): Promise<MixActionState> {
  if (!uuid.safeParse(mixId).success || !uuid.safeParse(playerId).success)
    return { error: "forbidden" };
  const auth = await authorizedMix("removeParticipant", mixId, "admin");
  if ("error" in auth) return auth;

  const deletion = await dbCall("removeParticipant", () =>
    adminDb()
      .from("mix_participants")
      .delete()
      .eq("mix_id", mixId)
      .eq("player_id", playerId),
  );
  if (!deletion.ok) return deletion.state;
  const { error } = deletion.value;
  if (!error) return { ok: true };
  if (error.code === PG_STATE) return { error: "notOpen" };
  return logFailure("removeParticipant", error);
}

export async function setMixStatus(
  mixId: string,
  expectedStatus: MixStatus,
  nextStatus: "balancing" | "open" | "cancelled",
): Promise<MixActionState> {
  const args = z
    .object({
      mixId: z.uuid(),
      expectedStatus: z.enum(MIX_STATUSES),
      nextStatus: z.enum(["balancing", "open", "cancelled"]),
    })
    .safeParse({ mixId, expectedStatus, nextStatus });
  if (!args.success) return { error: "forbidden" };

  const validTransition =
    (expectedStatus === "open" &&
      ["balancing", "cancelled"].includes(nextStatus)) ||
    (expectedStatus === "balancing" &&
      ["open", "cancelled"].includes(nextStatus));
  if (!validTransition) return { error: "forbidden" };

  const auth = await authorizedMix("setMixStatus", mixId, "admin");
  if ("error" in auth) return auth;

  const update = await dbCall("setMixStatus", () =>
    adminDb()
      .from("mixes")
      .update({ status: nextStatus })
      .eq("id", mixId)
      .eq("status", expectedStatus)
      .select("id")
      .maybeSingle(),
  );
  if (!update.ok) return update.state;
  const { data, error } = update.value;
  if (error) {
    if (error.code === PG_STATE) return { error: "stale" };
    if (
      error.code === PG_CHECK &&
      expectedStatus === "open" &&
      nextStatus === "balancing"
    )
      return { error: "notFull" };
    return logFailure("setMixStatus", error);
  }
  return data ? { ok: true } : { error: "stale" };
}

async function variantRpc(
  action: string,
  name: string,
  args: Record<string, unknown>,
): Promise<MixActionState> {
  const result = await dbCall(action, () => adminDb().rpc(name, args));
  if (!result.ok) return result.state;
  if (result.value.error) {
    if (result.value.error.code === PG_STATE) return { error: "stale" };
    if (result.value.error.code === PG_CHECK) return { error: "noVariants" };
    if (
      action === "swapMixParticipant" &&
      result.value.error.code === PG_FOREIGN_KEY
    )
      return { error: "notMember" };
    return logFailure(action, result.value.error);
  }
  return { ok: true };
}

function generationError(action: string, error: unknown): MixActionState {
  if (error instanceof StaleVariantSetError) return { error: "stale" };
  return logFailure(action, error);
}

/** Fetches participant inputs and stores the first unpublished three-variant set. */
export async function generateMixVariants(
  mixId: string,
): Promise<MixActionState> {
  if (!uuid.safeParse(mixId).success) return { error: "forbidden" };
  const auth = await authorizedMix("generateMixVariants", mixId, "admin");
  if ("error" in auth) return auth;

  try {
    const plan = await initialVariantPlan(mixId);
    return variantRpc("generateMixVariants", "create_mix_variant_set", {
      p_mix_id: mixId,
      p_balance_config: plan.balanceConfig,
      p_snapshots: plan.snapshots,
      p_variants: plan.variants,
    });
  } catch (error) {
    return generationError("generateMixVariants", error);
  }
}

/** Marks the current set rejected and creates the next numbered set from its saved snapshots. */
export async function rerollMixVariants(
  mixId: string,
  expectedGeneration: number,
): Promise<MixActionState> {
  if (
    !uuid.safeParse(mixId).success ||
    !Number.isSafeInteger(expectedGeneration) ||
    expectedGeneration < 1
  )
    return { error: "forbidden" };
  const auth = await authorizedMix("rerollMixVariants", mixId, "admin");
  if ("error" in auth) return auth;

  try {
    const plan = await rerollVariantPlan(mixId, expectedGeneration);
    return variantRpc("rerollMixVariants", "reroll_mix_variant_set", {
      p_mix_id: mixId,
      p_expected_generation: expectedGeneration,
      p_variants: plan.variants,
    });
  } catch (error) {
    return generationError("rerollMixVariants", error);
  }
}

/** Atomically publishes the shown set and transitions the mix to voting. */
export async function approveMixVariants(
  mixId: string,
  expectedGeneration: number,
): Promise<MixActionState> {
  if (
    !uuid.safeParse(mixId).success ||
    !Number.isSafeInteger(expectedGeneration) ||
    expectedGeneration < 1
  )
    return { error: "forbidden" };
  const auth = await authorizedMix("approveMixVariants", mixId, "admin");
  if ("error" in auth) return auth;
  return variantRpc("approveMixVariants", "approve_mix_variant_set", {
    p_mix_id: mixId,
    p_expected_generation: expectedGeneration,
  });
}

/** Replace one mix participant with an active group member while keeping the same team slots. */
export async function swapMixParticipant(
  mixId: string,
  leavingPlayerId: string,
  joiningPlayerId: string,
): Promise<MixActionState> {
  if (
    !uuid.safeParse(mixId).success ||
    !uuid.safeParse(leavingPlayerId).success ||
    !uuid.safeParse(joiningPlayerId).success ||
    leavingPlayerId === joiningPlayerId
  )
    return { error: "forbidden" };
  const auth = await authorizedMix("swapMixParticipant", mixId, "admin");
  if ("error" in auth) return auth;
  const result = await variantRpc(
    "swapMixParticipant",
    "swap_mix_participant",
    {
      p_mix_id: mixId,
      p_leaving_player_id: leavingPlayerId,
      p_joining_player_id: joiningPlayerId,
      p_admin_id: auth.session.playerId,
    },
  );
  return result;
}
