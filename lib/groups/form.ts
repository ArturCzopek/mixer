// Group form fields (pure): what a group admin may type, checked on the server before any write.
// The same rules are DB constraints (db/migrations/20260924190000_groups.sql); these give a message.

import { z } from "zod";

export const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const FACEIT_URL = /^https:\/\/(www\.)?faceit\.com\//;
const CLUB_ID =
  /\/club\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

export type GroupField = "name" | "slug" | "faceitClub";

export interface GroupFields {
  name: string;
  faceitClubUrl: string | null;
  /** Parsed from the Club link when it has one (D17), used later to filter Club matches. */
  faceitClubId: string | null;
}

const text = (form: FormData, key: string) =>
  String(form.get(key) ?? "").trim();

const fields = z.object({
  name: z.string().min(2).max(60),
  slug: z.string().regex(SLUG),
  faceitClub: z.union([z.literal(""), z.string().regex(FACEIT_URL).max(300)]),
});

/** Returns the fields, or the first invalid one. The slug is checked only when creating (it never changes). */
export function parseGroupForm(
  form: FormData,
  withSlug: boolean,
):
  | { ok: true; value: GroupFields & { slug: string } }
  | { ok: false; field: GroupField } {
  const schema = withSlug ? fields : fields.omit({ slug: true });
  const res = schema.safeParse({
    name: text(form, "name"),
    slug: text(form, "slug").toLowerCase(),
    faceitClub: text(form, "faceitClub"),
  });
  if (!res.success)
    return {
      ok: false,
      field: res.error.issues[0].path[0] as GroupField,
    };
  const { faceitClub, name } = res.data;
  return {
    ok: true,
    value: {
      name,
      slug: text(form, "slug").toLowerCase(),
      faceitClubUrl: faceitClub || null,
      faceitClubId: CLUB_ID.exec(faceitClub)?.[1].toLowerCase() ?? null,
    },
  };
}
