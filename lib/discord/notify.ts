import "server-only";

import { after } from "next/server";
import { adminDb } from "@/lib/db/admin";
import { postDiscordMessage } from "./api";
import { mixNoticeText, type MixNotice } from "./messages";

interface NoticeMix {
  title: string;
  chosen_variant_id: string | null;
  discord_notices: string[];
  group: {
    slug: string;
    discord_guild_id: string | null;
    discord_settings: { notification_channel_id?: string };
  };
}

/** Posts the notice to the group's text channel once per mix and event; never throws. */
export async function notifyMix(mixId: string, event: MixNotice) {
  try {
    const db = adminDb();
    const { data: mix, error } = await db
      .from("mixes")
      .select(
        "title, chosen_variant_id, discord_notices, group:groups!mixes_group_id_fkey(slug, discord_guild_id, discord_settings)",
      )
      .eq("id", mixId)
      .single<NoticeMix>();
    if (error) throw error;
    const channel = mix.group.discord_settings?.notification_channel_id;
    if (
      !mix.group.discord_guild_id ||
      !channel ||
      mix.discord_notices.includes(event)
    )
      return;

    // Claim first so concurrent callers post once.
    // ponytail: a failed post is not retried; add a retry if Discord drops messages in practice.
    const { data: claimed, error: claimError } = await db
      .from("mixes")
      .update({ discord_notices: [...mix.discord_notices, event] })
      .eq("id", mixId)
      .not("discord_notices", "cs", `{${event}}`)
      .select("id")
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) return;

    const base = process.env.APP_URL?.replace(/\/$/, "");
    const data: Parameters<typeof mixNoticeText>[1] = {
      title: mix.title,
      url: base ? `${base}/g/${mix.group.slug}/m/${mixId}` : null,
    };
    if (event === "locked" && mix.chosen_variant_id) {
      const { data: rows, error: teamError } = await db
        .from("variant_players")
        .select("team, player:players(display_name, steam_id)")
        .eq("variant_id", mix.chosen_variant_id)
        .returns<
          {
            team: "A" | "B";
            player: { display_name: string | null; steam_id: string };
          }[]
        >();
      if (teamError) throw teamError;
      const names = (team: "A" | "B") =>
        rows
          .filter((row) => row.team === team)
          .map((row) => row.player.display_name ?? row.player.steam_id);
      data.teamA = names("A");
      data.teamB = names("B");
    }
    if (event === "played") {
      const { data: maps, error: mapError } = await db
        .from("matches")
        .select("map_name, score_a, score_b")
        .eq("mix_id", mixId)
        .order("map_number");
      if (mapError) throw mapError;
      data.maps = maps.map((map) => ({
        mapName: map.map_name,
        scoreA: map.score_a,
        scoreB: map.score_b,
      }));
    }
    await postDiscordMessage(channel, mixNoticeText(event, data));
  } catch (error) {
    console.error(`notifyMix ${event}`, error);
  }
}

/** Runs notifyMix after the response so Discord never slows a page or action. */
export function notifyMixLater(mixId: string, event: MixNotice) {
  after(() => notifyMix(mixId, event));
}
