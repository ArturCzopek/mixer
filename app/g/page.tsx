import type { Metadata } from "next";
import Link from "next/link";
import { Well, Window } from "@/components/vgui";
import { publicGroups } from "@/lib/groups/queries";
import { getDict } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Groups · mixer" };

export default async function GroupsPage() {
  const [groups, t] = await Promise.all([publicGroups(), getDict()]);
  return (
    <main className="mx-auto w-full max-w-[460px] px-2 py-6">
      <Window title={t.groups.directoryTitle}>
        <Well className="overflow-hidden">
          {groups.length ? (
            <ul className="divide-row divide-y">
              {groups.map((group) => (
                <li key={group.id}>
                  <Link
                    href={`/g/${group.slug}`}
                    className="hover:bg-hover block px-2 py-2 font-bold no-underline"
                  >
                    {group.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-dim px-2 py-2 text-[11px]">
              {t.groups.directoryEmpty}
            </p>
          )}
        </Well>
      </Window>
    </main>
  );
}
