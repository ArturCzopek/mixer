"use server";

// Group writes (M1-G). Rule D36: every action authorizes first (session, then group role read from
// the DB), and invariants the UI cannot guarantee (creator is admin, a group keeps one admin) are
// enforced by the database in the same statement as the write.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AuthError } from "@/lib/auth/roles";
import { requireGroupRole, requireSession } from "@/lib/auth/server";
import { adminDb } from "@/lib/db/admin";
import { parseGroupForm, type GroupField } from "./form";

export type GroupError =
  | GroupField
  | "slugTaken"
  | "lastAdmin"
  | "unauthorized"
  | "forbidden"
  | "failed";
export type ActionState = { error: GroupError } | { ok: true } | undefined;

const PG_UNIQUE = "23505";
const PG_CHECK = "23514";

function authError(e: unknown): ActionState {
  if (e instanceof AuthError)
    return { error: e.status === 401 ? "unauthorized" : "forbidden" };
  throw e;
}

/** Any logged-in player creates a group and becomes its admin (DB trigger). */
export async function createGroup(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  let playerId: string;
  try {
    playerId = (await requireSession()).playerId;
  } catch (e) {
    return authError(e);
  }
  const parsed = parseGroupForm(form, true);
  if (!parsed.ok) return { error: parsed.field };
  const { name, slug, faceitClubUrl, faceitClubId } = parsed.value;
  const { error } = await adminDb().from("groups").insert({
    name,
    slug,
    faceit_club_url: faceitClubUrl,
    faceit_club_id: faceitClubId,
    created_by: playerId,
  });
  if (error) {
    if (error.code === PG_UNIQUE) return { error: "slugTaken" };
    console.error("createGroup failed", error);
    return { error: "failed" };
  }
  redirect(`/g/${slug}`);
}

/** Group admins edit the name and the FACEIT Club link (D21: it can be added later). */
export async function updateGroup(
  groupId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  if (!z.uuid().safeParse(groupId).success) return { error: "forbidden" };
  try {
    await requireGroupRole(groupId, "admin");
  } catch (e) {
    return authError(e);
  }
  const parsed = parseGroupForm(form, false);
  if (!parsed.ok) return { error: parsed.field };
  const { name, faceitClubUrl, faceitClubId } = parsed.value;
  const { error } = await adminDb()
    .from("groups")
    .update({
      name,
      faceit_club_url: faceitClubUrl,
      faceit_club_id: faceitClubId,
    })
    .eq("id", groupId);
  if (error) {
    console.error("updateGroup failed", error);
    return { error: "failed" };
  }
  revalidatePath("/g/[slug]", "page");
  return { ok: true };
}

export type MemberOp = "promote" | "demote" | "close";

/** Group admins promote/demote admins and close memberships (never deleted, D18). */
export async function changeMember(
  groupId: string,
  playerId: string,
  op: MemberOp,
): Promise<ActionState> {
  const args = z
    .object({
      groupId: z.uuid(),
      playerId: z.uuid(),
      op: z.enum(["promote", "demote", "close"]),
    })
    .safeParse({ groupId, playerId, op });
  if (!args.success) return { error: "forbidden" };
  try {
    await requireGroupRole(groupId, "admin");
  } catch (e) {
    return authError(e);
  }
  const patch =
    op === "close"
      ? { left_at: new Date().toISOString() }
      : { role: op === "promote" ? "admin" : "member" };
  const { error } = await adminDb()
    .from("group_members")
    .update(patch)
    .eq("group_id", groupId)
    .eq("player_id", playerId)
    .is("left_at", null);
  if (error) {
    if (error.code === PG_CHECK) return { error: "lastAdmin" };
    console.error("changeMember failed", error);
    return { error: "failed" };
  }
  revalidatePath("/g/[slug]", "page");
  return { ok: true };
}
