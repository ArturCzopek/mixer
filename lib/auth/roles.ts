// Role rules (pure). Site admin = players.is_site_admin; group roles from active group_members rows.

export type GroupRole = "admin" | "member";

export interface Membership {
  role: GroupRole;
  /** Closed memberships (left_at set) grant nothing. */
  leftAt: string | null;
}

export class AuthError extends Error {
  constructor(
    readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/** Does this player have at least `required` in the group? Site admins pass every group check. */
export function hasGroupRole(
  membership: Membership | null,
  required: GroupRole,
  isSiteAdmin: boolean,
): boolean {
  if (isSiteAdmin) return true;
  if (!membership || membership.leftAt !== null) return false;
  return required === "member" || membership.role === "admin";
}

/** SteamIDs from `ADMIN_STEAM_IDS` (comma or whitespace separated). */
export function parseAdminIds(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "").split(/[\s,]+/).filter((id) => /^\d{17}$/.test(id)),
  );
}
