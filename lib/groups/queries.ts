import "server-only";

// Group reads for server components. Groups and members are public (D2, D18).

import { adminDb } from "@/lib/db/admin";
import type { GroupRole } from "@/lib/auth/roles";

export interface GroupLink {
  slug: string;
  name: string;
}

export interface GroupMember {
  playerId: string;
  steamId: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: GroupRole;
  joinedAt: string;
}

export interface GroupPage extends GroupLink {
  id: string;
  faceitClubUrl: string | null;
  /** Active members only, admins first, then by join date. */
  members: GroupMember[];
}

interface GroupRow {
  id: string;
  slug: string;
  name: string;
  faceit_club_url: string | null;
  group_members: {
    role: GroupRole;
    joined_at: string;
    left_at: string | null;
    player: {
      id: string;
      steam_id: string;
      display_name: string | null;
      avatar_url: string | null;
    };
  }[];
}

/** Groups the player is an active member of, for the switcher. */
export async function myGroups(playerId: string): Promise<GroupLink[]> {
  const { data, error } = await adminDb()
    .from("group_members")
    .select("group:groups(slug, name)")
    .eq("player_id", playerId)
    .is("left_at", null)
    .returns<{ group: GroupLink }[]>();
  if (error) throw new Error(`myGroups: ${error.message}`);
  return data.map((r) => r.group).sort((a, b) => a.name.localeCompare(b.name));
}

export async function groupBySlug(slug: string): Promise<GroupPage | null> {
  const { data, error } = await adminDb()
    .from("groups")
    .select(
      "id, slug, name, faceit_club_url, group_members(role, joined_at, left_at, player:players!group_members_player_id_fkey(id, steam_id, display_name, avatar_url))",
    )
    .eq("slug", slug)
    .maybeSingle<GroupRow>();
  if (error) throw new Error(`groupBySlug: ${error.message}`);
  if (!data) return null;
  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    faceitClubUrl: data.faceit_club_url,
    members: data.group_members
      .filter((m) => m.left_at === null)
      .map((m) => ({
        playerId: m.player.id,
        steamId: m.player.steam_id,
        displayName: m.player.display_name,
        avatarUrl: m.player.avatar_url,
        role: m.role,
        joinedAt: m.joined_at,
      }))
      .sort(
        (a, b) =>
          Number(b.role === "admin") - Number(a.role === "admin") ||
          a.joinedAt.localeCompare(b.joinedAt),
      ),
  };
}
