// One-off, rerunnable Steam identity refresh for everyone in a group archive.
// npx tsx --env-file=.env.local scripts/refresh-group-identities.ts --apply
import { createClient } from "@supabase/supabase-js";
import { getPlayerBySteamId } from "../lib/external/faceit";
import { getPlayerSummaries } from "../lib/external/steam";

async function main() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: group, error: groupError } = await db
    .from("groups")
    .select("id")
    .eq("slug", "skarpeciarze")
    .single();
  if (groupError) throw groupError;
  const { data: memberships, error: membersError } = await db
    .from("group_members")
    .select("player_id")
    .eq("group_id", group.id);
  if (membersError) throw membersError;
  const ids = [...new Set(memberships.map((row) => row.player_id))];
  const { data: players, error: playersError } = await db
    .from("players")
    .select("id, steam_id, display_name")
    .in("id", ids);
  if (playersError) throw playersError;
  const steam = new Map(
    (await getPlayerSummaries(players.map((player) => player.steam_id))).map(
      (profile) => [profile.steamId, profile],
    ),
  );
  console.log(`Steam summaries: ${steam.size}/${players.length}`);
  if (!process.argv.includes("--apply")) {
    console.log(
      "Dry run. Pass --apply to update names, avatars and found FACEIT links.",
    );
    return;
  }
  let updated = 0;
  let linked = 0;
  for (const player of players) {
    const profile = steam.get(player.steam_id);
    if (!profile) continue;
    const faceit = await getPlayerBySteamId(player.steam_id).catch(() => null);
    const { error } = await db
      .from("players")
      .update({
        display_name: profile.name,
        avatar_url: profile.avatarUrl,
        ...(faceit && {
          faceit_player_id: faceit.playerId,
          faceit_nickname: faceit.nickname,
        }),
      })
      .eq("id", player.id);
    if (error) throw error;
    updated++;
    if (faceit) linked++;
  }
  console.log(
    `Updated ${updated} Steam identities; found ${linked} FACEIT links.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
