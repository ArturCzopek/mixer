import { createHash, timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { adminDb } from "@/lib/db/admin";
import { claimMixFlag } from "@/lib/discord/notify";
import { moveMixLineup } from "@/lib/discord/voice";
import { finishedMatch, mixForMatch } from "@/lib/mix/faceit-webhook";

const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * FACEIT App Studio webhook (D29, D-3). On `match_status_finished` the mix whose lineup played
 * the room goes back to the Discord lobby, once per FACEIT match. Everything else is ignored.
 * App Studio sends the shared secret in the `X-Mixer-Secret` header.
 */
export async function POST(request: Request) {
  const secret = process.env.FACEIT_WEBHOOK_SECRET;
  const headers = { "Cache-Control": "no-store" };
  if (
    !secret ||
    !timingSafeEqual(
      digest(request.headers.get("x-mixer-secret") ?? ""),
      digest(secret),
    )
  )
    return Response.json({ error: "Unauthorized" }, { status: 401, headers });

  const match = finishedMatch(await request.json().catch(() => null));
  if (!match) return Response.json({ ignored: true }, { headers });

  try {
    const db = adminDb();
    // A map ends within hours of the lock; older mixes are never moved automatically.
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data: mixes, error } = await db
      .from("mixes")
      .select(
        "id, group_id, chosen_variant_id, group:groups!mixes_group_id_fkey!inner(discord_guild_id)",
      )
      .in("status", ["locked", "played"])
      .gte("locked_at", since)
      .not("chosen_variant_id", "is", null)
      .not("group.discord_guild_id", "is", null)
      .returns<
        {
          id: string;
          group_id: string;
          chosen_variant_id: string;
        }[]
      >();
    if (error) throw error;
    if (!mixes.length) return Response.json({ ignored: true }, { headers });

    const { data: rows, error: lineupError } = await db
      .from("variant_players")
      .select(
        "variant_id, player:players!variant_players_player_id_fkey(steam_id, faceit_player_id)",
      )
      .in(
        "variant_id",
        mixes.map((mix) => mix.chosen_variant_id),
      )
      .returns<
        {
          variant_id: string;
          player: { steam_id: string; faceit_player_id: string | null };
        }[]
      >();
    if (lineupError) throw lineupError;
    const mixId = mixForMatch(
      match,
      mixes.map((mix) => ({
        id: mix.id,
        lineup: rows
          .filter((row) => row.variant_id === mix.chosen_variant_id)
          .map(({ player }) =>
            [player.steam_id, player.faceit_player_id].filter(
              (id): id is string => !!id,
            ),
          ),
      })),
    );
    const mix = mixes.find((item) => item.id === mixId);
    if (!mix || !(await claimMixFlag(mix.id, `returned:${match.matchId}`)))
      return Response.json({ ignored: true }, { headers });

    after(async () => {
      const result = await moveMixLineup(
        mix.group_id,
        mix.chosen_variant_id,
        "lobby",
      );
      console.info("FACEIT finish: lobby return", match.matchId, result);
    });
    return Response.json({ ok: true }, { headers });
  } catch (error) {
    console.error("FACEIT webhook failed", error);
    return Response.json({ error: "Failed" }, { status: 500, headers });
  }
}
