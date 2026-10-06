import { authConfigured, getSession } from "@/lib/auth/server";
import { myGroups } from "@/lib/groups/queries";
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
  return (
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
  );
}
