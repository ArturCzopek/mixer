import "server-only";

import { adminDb } from "@/lib/db/admin";
import type { MixStatus } from "./actions";

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
    .select("id, title, status, created_at, mix_participants(player_id)")
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
    .select("id, group_id, title, status")
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
    participants: participants.map((participant) => ({
      playerId: participant.player_id,
      displayName: participant.player.display_name,
      steamId: participant.player.steam_id,
      avatarUrl: participant.player.avatar_url,
      createdAt: participant.created_at,
    })),
  };
}
