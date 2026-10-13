import { authConfigured, getSession } from "@/lib/auth/server";
import { myGroups } from "@/lib/groups/queries";
import { getDict } from "@/lib/i18n/server";
import { MenuBarView } from "./menu-bar-view";

/** The one menu bar (DESIGN.md "Navigation"), rendered by the root layout on every page. */
export async function MenuBar({
  initialBackdrop,
}: {
  initialBackdrop: boolean;
}) {
  const auth = authConfigured();
  const session = auth ? await getSession() : null;
  const groups = session ? await myGroups(session.playerId) : [];
  const t = await getDict();
  // Voice moves need every player's Discord, so a signed-in member without one sees this everywhere.
  const askDiscord =
    session &&
    !session.discordUserId &&
    groups.length > 0 &&
    !!process.env.DISCORD_CLIENT_ID &&
    !!process.env.DISCORD_CLIENT_SECRET;
  return (
    <>
      <MenuBarView
        initialBackdrop={initialBackdrop}
        auth={auth}
        me={
          session && {
            name: session.displayName ?? session.steamId,
            steamId: session.steamId,
            avatarUrl: session.avatarUrl,
            isSiteAdmin: session.isSiteAdmin,
          }
        }
        groups={groups}
      />
      {askDiscord && (
        <div className="border-gold bg-window mx-2 mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 border-2 px-3 py-2">
          <p className="text-gold min-w-0 flex-1 text-[13px] font-bold">
            {t.groups.discordAccount.banner}
          </p>
          <a
            href={`/auth/discord/player?next=${encodeURIComponent(`/g/${groups[0].slug}#members`)}`}
            className="bevel bg-sheet text-gold hover:bg-hover px-3 py-2 text-[13px] font-bold whitespace-nowrap no-underline hover:text-white"
          >
            {t.groups.discordAccount.connect}
          </a>
        </div>
      )}
    </>
  );
}
