import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { GroupForm } from "@/components/groups/group-form";
import { Window } from "@/components/vgui";
import { getSession } from "@/lib/auth/server";
import { createGroup } from "@/lib/groups/actions";
import { getDict } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "New group · mixer" };

export default async function NewGroupPage() {
  const session = await getSession();
  if (!session) redirect("/auth/steam?next=/g/new");
  const t = await getDict();
  return (
    <main className="mx-auto w-full max-w-[460px] px-2 py-6">
      <Window title={t.groups.newGroup}>
        <GroupForm
          action={createGroup}
          withSlug
          submit={t.groups.create}
          host={(await headers()).get("host") ?? ""}
        />
        <p className="text-dim mt-2">
          <Link href="/">{t.groups.home}</Link>
        </p>
      </Window>
    </main>
  );
}
