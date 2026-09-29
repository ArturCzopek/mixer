import "server-only";

import { adminDb } from "@/lib/db/admin";
import { myGroups, type GroupLink } from "@/lib/groups/queries";
import type { MixStatus } from "./actions";
import type { GenerationMember, SkillSnapshot } from "./generation";

export interface HomeOpenMix {
  id: string;
  title: string;
  groupSlug: string;
  groupName: string;
  participantCount: number;
  viewerJoined: boolean;
}

export interface HomeInProgressMix {
  id: string;
  title: string;
  groupSlug: string;
  groupName: string;
  status: "balancing" | "voting" | "locked";
}

export interface HomeMixes {
  groups: GroupLink[];
  openSignups: HomeOpenMix[];
  inProgress: HomeInProgressMix[];
}

export interface HomeMixRow {
  id: string;
  title: string;
  status: MixStatus;
  group: { slug: string; name: string };
  mix_participants: { player_id: string }[];
}

const IN_PROGRESS_STATUSES = ["balancing", "voting", "locked"] as const;

export function mapHomeMixes(rows: HomeMixRow[], playerId: string) {
  return {
    openSignups: rows
      .filter((mix) => mix.status === "open")
      .map((mix) => ({
        id: mix.id,
        title: mix.title,
        groupSlug: mix.group.slug,
        groupName: mix.group.name,
        participantCount: mix.mix_participants.length,
        viewerJoined: mix.mix_participants.some(
          (participant) => participant.player_id === playerId,
        ),
      })),
    inProgress: rows
      .filter(
        (mix): mix is HomeMixRow & { status: HomeInProgressMix["status"] } =>
          IN_PROGRESS_STATUSES.includes(
            mix.status as HomeInProgressMix["status"],
          ),
      )
      .map((mix) => ({
        id: mix.id,
        title: mix.title,
        groupSlug: mix.group.slug,
        groupName: mix.group.name,
        status: mix.status,
      })),
  };
}

async function openMixRows(groupIds: string[]): Promise<HomeMixRow[]> {
  if (groupIds.length === 0) return [];
  const { data, error } = await adminDb()
    .from("mixes")
    .select(
      "id, title, status, group:groups!mixes_group_id_fkey(slug, name), mix_participants!mix_participants_mix_id_fkey(player_id)",
    )
    .in("group_id", groupIds)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .returns<HomeMixRow[]>();
  if (error) throw new Error(`homeMixes open sign-ups: ${error.message}`);
  return data;
}

async function inProgressMixRows(playerId: string): Promise<HomeMixRow[]> {
  const { data, error } = await adminDb()
    .from("mixes")
    .select(
      "id, title, status, group:groups!mixes_group_id_fkey(slug, name), mix_participants!mix_participants_mix_id_fkey!inner(player_id)",
    )
    .in("status", IN_PROGRESS_STATUSES)
    .eq("mix_participants.player_id", playerId)
    .order("created_at", { ascending: false })
    .returns<HomeMixRow[]>();
  if (error) throw new Error(`homeMixes in-progress mixes: ${error.message}`);
  return data;
}

/** The home page's signed-in lists, scoped to the viewer's active groups and participation. */
export async function homeMixes(playerId: string): Promise<HomeMixes> {
  const groups = await myGroups(playerId);
  const [openRows, progressRows] = await Promise.all([
    openMixRows(groups.map((group) => group.id)),
    inProgressMixRows(playerId),
  ]);
  return { groups, ...mapHomeMixes([...openRows, ...progressRows], playerId) };
}

export interface GroupMix {
  id: string;
  title: string;
  status: MixStatus;
  createdAt: string;
  participantCount: number;
}

export interface LobbyParticipant {
  playerId: string;
  displayName: string | null;
  steamId: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface MixLobby {
  id: string;
  groupId: string;
  title: string;
  status: MixStatus;
  createdAt: string;
  scheduledAt: string | null;
  participants: LobbyParticipant[];
}

interface GroupMixRow {
  id: string;
  title: string;
  status: MixStatus;
  created_at: string;
  mix_participants: { player_id: string }[];
}

interface MixRow {
  id: string;
  group_id: string;
  title: string;
  status: MixStatus;
  created_at: string;
  scheduled_at: string | null;
}

interface ParticipantRow {
  player_id: string;
  created_at: string;
  player: {
    display_name: string | null;
    steam_id: string;
    avatar_url: string | null;
  };
}

export async function groupMixes(groupId: string): Promise<GroupMix[]> {
  const { data, error } = await adminDb()
    .from("mixes")
    .select(
      "id, title, status, created_at, mix_participants!mix_participants_mix_id_fkey(player_id)",
    )
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .returns<GroupMixRow[]>();
  if (error) throw new Error(`groupMixes: ${error.message}`);
  return data.map((mix) => ({
    id: mix.id,
    title: mix.title,
    status: mix.status,
    createdAt: mix.created_at,
    participantCount: mix.mix_participants.length,
  }));
}

export async function mixLobby(mixId: string): Promise<MixLobby | null> {
  const { data: mix, error: mixError } = await adminDb()
    .from("mixes")
    .select("id, group_id, title, status, created_at, scheduled_at")
    .eq("id", mixId)
    .maybeSingle<MixRow>();
  if (mixError) throw new Error(`mixLobby: ${mixError.message}`);
  if (!mix) return null;

  const { data: participants, error: participantsError } = await adminDb()
    .from("mix_participants")
    .select(
      "player_id, created_at, player:players!mix_participants_player_id_fkey(display_name, steam_id, avatar_url)",
    )
    .eq("mix_id", mixId)
    .order("created_at", { ascending: true })
    .order("player_id", { ascending: true })
    .returns<ParticipantRow[]>();
  if (participantsError)
    throw new Error(`mixLobby participants: ${participantsError.message}`);

  return {
    id: mix.id,
    groupId: mix.group_id,
    title: mix.title,
    status: mix.status,
    createdAt: mix.created_at,
    scheduledAt: mix.scheduled_at,
    participants: participants.map((participant) => ({
      playerId: participant.player_id,
      displayName: participant.player.display_name,
      steamId: participant.player.steam_id,
      avatarUrl: participant.player.avatar_url,
      createdAt: participant.created_at,
    })),
  };
}

interface GenerationMixRow {
  id: string;
  group_id: string;
  status: MixStatus;
  scheduled_at: string | null;
  created_at: string;
  balance_config: unknown;
  group: { faceit_club_id: string | null };
}

interface GenerationParticipantRow {
  player_id: string;
  manual_skill_override: number | null;
  skill_snapshot: SkillSnapshot | null;
  player: {
    steam_id: string;
    preferred_role: GenerationMember["preferredRole"];
  };
}

interface GenerationVariantRow {
  id: string;
  number: number;
  generation: number;
  rejected_at: string | null;
  is_published: boolean;
  split_key: string | null;
  variant_players: {
    team: "A" | "B";
    player: { steam_id: string };
  }[];
}

export interface MixGenerationData {
  id: string;
  groupId: string;
  status: MixStatus;
  scheduledAt: string | null;
  createdAt: string;
  balanceConfig: unknown;
  clubId: string | null;
  participants: (GenerationMember & { snapshot: SkillSnapshot | null })[];
  variants: {
    id: string;
    number: number;
    generation: number;
    rejectedAt: string | null;
    isPublished: boolean;
    splitKey: string | null;
    teamA: string[];
    teamB: string[];
  }[];
}

/** Private server-side inputs used only by the authorized generation actions. */
export async function mixGenerationData(
  mixId: string,
): Promise<MixGenerationData | null> {
  const { data: mix, error: mixError } = await adminDb()
    .from("mixes")
    .select(
      "id, group_id, status, scheduled_at, created_at, balance_config, group:groups!mixes_group_id_fkey(faceit_club_id)",
    )
    .eq("id", mixId)
    .maybeSingle<GenerationMixRow>();
  if (mixError) throw new Error(`mixGenerationData mix: ${mixError.message}`);
  if (!mix) return null;

  const [participantResult, variantsResult] = await Promise.all([
    adminDb()
      .from("mix_participants")
      .select(
        "player_id, skill_snapshot, player:players!mix_participants_player_id_fkey(steam_id, preferred_role), group_member:group_members!mix_participants_member_fk(manual_skill_override)",
      )
      .eq("mix_id", mixId)
      .order("created_at", { ascending: true })
      .order("player_id", { ascending: true })
      .returns<
        (Omit<GenerationParticipantRow, "manual_skill_override"> & {
          group_member: { manual_skill_override: number | null };
        })[]
      >(),
    adminDb()
      .from("variants")
      .select(
        "id, number, generation, rejected_at, is_published, split_key, variant_players!variant_players_variant_id_fkey(team, player:players!variant_players_player_id_fkey(steam_id))",
      )
      .eq("mix_id", mixId)
      .order("number", { ascending: true })
      .returns<GenerationVariantRow[]>(),
  ]);
  if (participantResult.error)
    throw new Error(
      `mixGenerationData participants: ${participantResult.error.message}`,
    );
  if (variantsResult.error)
    throw new Error(
      `mixGenerationData variants: ${variantsResult.error.message}`,
    );

  return {
    id: mix.id,
    groupId: mix.group_id,
    status: mix.status,
    scheduledAt: mix.scheduled_at,
    createdAt: mix.created_at,
    balanceConfig: mix.balance_config,
    clubId: mix.group.faceit_club_id,
    participants: participantResult.data.map((participant) => ({
      playerId: participant.player_id,
      steamId: participant.player.steam_id,
      preferredRole: participant.player.preferred_role,
      manualElo: participant.group_member.manual_skill_override,
      snapshot: participant.skill_snapshot,
    })),
    variants: variantsResult.data.map((variant) => ({
      id: variant.id,
      number: variant.number,
      generation: variant.generation,
      rejectedAt: variant.rejected_at,
      isPublished: variant.is_published,
      splitKey: variant.split_key,
      teamA: variant.variant_players
        .filter((player) => player.team === "A")
        .map((player) => player.player.steam_id),
      teamB: variant.variant_players
        .filter((player) => player.team === "B")
        .map((player) => player.player.steam_id),
    })),
  };
}

export interface MixVariantPage {
  mix: MixLobby;
  chosenVariantId: string | null;
  voteResult: { tied?: number[]; winnerVotes?: number } | null;
  matchStartedAt: string | null;
  groupName: string;
  balanceConfig: unknown;
  swapLog: unknown;
  participants: (LobbyParticipant & {
    preferredRole: GenerationMember["preferredRole"];
    snapshot: SkillSnapshot | null;
  })[];
  variants: {
    id: string;
    number: number;
    generation: number;
    splitKey: string | null;
    teamAScore: number;
    teamBScore: number;
    winProbA: number;
    penalty: number;
    details: unknown;
    teamA: { playerId: string; steamId: string }[];
    teamB: { playerId: string; steamId: string }[];
  }[];
  votes: { variantId: string; voterSteamId: string; castByPlayerId: string }[];
}

interface VariantPageMixRow {
  id: string;
  group_id: string;
  title: string;
  status: MixStatus;
  created_at: string;
  scheduled_at: string | null;
  chosen_variant_id: string | null;
  vote_result: { tied?: number[]; winnerVotes?: number } | null;
  match_started_at: string | null;
  balance_config: unknown;
  swap_log: unknown;
  group: { name: string };
}

interface VariantPageParticipantRow {
  player_id: string;
  created_at: string;
  skill_snapshot: SkillSnapshot | null;
  player: {
    steam_id: string;
    display_name: string | null;
    avatar_url: string | null;
    preferred_role: GenerationMember["preferredRole"];
  };
}

interface VariantPageVariantRow {
  id: string;
  number: number;
  generation: number;
  split_key: string | null;
  team_a_score: number;
  team_b_score: number;
  win_prob_a: number;
  penalty: number;
  details: unknown;
  variant_players: {
    team: "A" | "B";
    player_id: string;
    player: { steam_id: string };
  }[];
}

/** Public variant reads include only approved rows; admins see the current balancing preview. */
export async function mixVariantPage(
  mixId: string,
  viewerIsAdmin: boolean,
): Promise<MixVariantPage | null> {
  const { data: mix, error: mixError } = await adminDb()
    .from("mixes")
    .select(
      "id, group_id, title, status, created_at, scheduled_at, chosen_variant_id, vote_result, match_started_at, balance_config, swap_log, group:groups!mixes_group_id_fkey(name)",
    )
    .eq("id", mixId)
    .maybeSingle<VariantPageMixRow>();
  if (mixError) throw new Error(`mixVariantPage mix: ${mixError.message}`);
  if (!mix) return null;

  const showVariants =
    mix.status === "voting" ||
    mix.status === "locked" ||
    mix.status === "played" ||
    (mix.status === "balancing" && viewerIsAdmin);
  const showSnapshots = showVariants;
  const [participantResult, variantResult, voteResult] = await Promise.all([
    adminDb()
      .from("mix_participants")
      .select(
        `player_id, created_at, ${showSnapshots ? "skill_snapshot," : ""} player:players!mix_participants_player_id_fkey(steam_id, display_name, avatar_url, preferred_role)`,
      )
      .eq("mix_id", mixId)
      .order("created_at", { ascending: true })
      .order("player_id", { ascending: true })
      .returns<VariantPageParticipantRow[]>(),
    showVariants
      ? adminDb()
          .from("variants")
          .select(
            "id, number, generation, split_key, team_a_score, team_b_score, win_prob_a, penalty, details, variant_players!variant_players_variant_id_fkey(team, player_id, player:players!variant_players_player_id_fkey(steam_id))",
          )
          .eq("mix_id", mixId)
          .eq("is_published", mix.status !== "balancing")
          .is("rejected_at", null)
          .order("number", { ascending: true })
          .returns<VariantPageVariantRow[]>()
      : Promise.resolve({ data: [], error: null }),
    adminDb()
      .from("votes")
      .select("variant_id, voter_id, cast_by")
      .eq("mix_id", mixId)
      .order("updated_at", { ascending: true })
      .returns<{ variant_id: string; voter_id: string; cast_by: string }[]>(),
  ]);
  if (participantResult.error)
    throw new Error(
      `mixVariantPage participants: ${participantResult.error.message}`,
    );
  if (variantResult.error)
    throw new Error(`mixVariantPage variants: ${variantResult.error.message}`);
  if (voteResult.error)
    throw new Error(`mixVariantPage votes: ${voteResult.error.message}`);

  const votesByPlayer = new Map(
    participantResult.data.map((p) => [p.player_id, p.player.steam_id]),
  );
  return {
    mix: {
      id: mix.id,
      groupId: mix.group_id,
      title: mix.title,
      status: mix.status,
      createdAt: mix.created_at,
      scheduledAt: mix.scheduled_at,
      participants: participantResult.data.map((participant) => ({
        playerId: participant.player_id,
        steamId: participant.player.steam_id,
        displayName: participant.player.display_name,
        avatarUrl: participant.player.avatar_url,
        createdAt: participant.created_at,
      })),
    },
    groupName: mix.group.name,
    chosenVariantId: mix.chosen_variant_id,
    voteResult: mix.vote_result,
    matchStartedAt: mix.match_started_at,
    balanceConfig: mix.balance_config,
    swapLog: mix.swap_log,
    participants: participantResult.data.map((participant) => ({
      playerId: participant.player_id,
      steamId: participant.player.steam_id,
      displayName: participant.player.display_name,
      avatarUrl: participant.player.avatar_url,
      createdAt: participant.created_at,
      preferredRole: participant.player.preferred_role,
      snapshot: participant.skill_snapshot,
    })),
    variants: variantResult.data.map((variant) => ({
      id: variant.id,
      number: variant.number,
      generation: variant.generation,
      splitKey: variant.split_key,
      teamAScore: Number(variant.team_a_score),
      teamBScore: Number(variant.team_b_score),
      winProbA: Number(variant.win_prob_a),
      penalty: Number(variant.penalty),
      details: variant.details,
      teamA: variant.variant_players
        .filter((player) => player.team === "A")
        .map((player) => ({
          playerId: player.player_id,
          steamId: player.player.steam_id,
        })),
      teamB: variant.variant_players
        .filter((player) => player.team === "B")
        .map((player) => ({
          playerId: player.player_id,
          steamId: player.player.steam_id,
        })),
    })),
    votes: voteResult.data.flatMap((vote) => {
      const voterSteamId = votesByPlayer.get(vote.voter_id);
      if (!voterSteamId) return [];
      return [
        {
          variantId: vote.variant_id,
          voterSteamId,
          castByPlayerId: vote.cast_by,
        },
      ];
    }),
  };
}
