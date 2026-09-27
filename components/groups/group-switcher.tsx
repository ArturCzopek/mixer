import Link from "next/link";
import type { Session } from "@/lib/auth/server";
import { myGroups } from "@/lib/groups/queries";
import type { Dict } from "@/lib/i18n/dict";

/** Title-bar menu of the player's groups (native <details>, no client JS). */
export async function GroupSwitcher({
  session,
  current,
  t,
}: {
  session: Session | null;
  current?: string;
  t: Dict;
}) {
  if (!session) return null;
  const groups = await myGroups(session.playerId);
  return (
    <details className="relative">
      <summary className="bevel bg-sheet text-text hover:bg-hover cursor-pointer list-none px-2 py-0.5 text-[11px] select-none">
        {t.groups.switcher} ▾
      </summary>
      <nav className="bevel bg-window absolute top-full right-0 z-10 mt-0.5 flex min-w-44 flex-col py-1 text-[12px] font-normal">
        {groups.length === 0 && (
          <span className="text-dim px-2 py-1">{t.groups.none}</span>
        )}
        {groups.map((g) => (
          <Link
            key={g.slug}
            href={`/g/${g.slug}`}
            aria-current={g.slug === current ? "page" : undefined}
            className="hover:bg-hover aria-[current=page]:text-gold text-text truncate px-2 py-1 no-underline"
          >
            {g.name}
          </Link>
        ))}
        <Link
          href="/g/new"
          className="border-lo hover:bg-hover text-gold mt-1 border-t px-2 py-1 no-underline"
        >
          + {t.groups.newGroup}
        </Link>
      </nav>
    </details>
  );
}
