"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { ChevronRight } from "lucide-react";
import { LanguageToggle, useT } from "@/components/i18n";
import { BackgroundToggle } from "@/components/vgui";
import type { GroupLink } from "@/lib/groups/queries";
import { myProfileHref } from "@/lib/profile/href";

interface Me {
  name: string;
  steamId: string;
  avatarUrl: string | null;
  isSiteAdmin: boolean;
}

/**
 * mixer › group menu on the left; backdrop, language and the account on the right. The current group
 * comes from the URL, so the bar can stay in the root layout.
 */
export function MenuBarView({
  auth,
  me,
  groups,
  initialBackdrop,
}: {
  auth: boolean;
  me: Me | null;
  groups: GroupLink[];
  initialBackdrop: boolean;
}) {
  const t = useT();
  const path = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);
  const slug = /^\/g\/([^/]+)/.exec(path)?.[1];
  const current = groups.find((g) => g.slug === slug);
  const profileHref = me ? myProfileHref(path, groups, me.steamId) : null;
  const close = () => menu.current?.removeAttribute("open");

  return (
    <nav className="mx-auto flex w-full max-w-[1180px] items-center gap-1 px-2.5 py-2 text-[12px]">
      <Link href="/" className="text-gold font-bold tracking-wide no-underline">
        mixer
      </Link>
      {!me && (
        <Link
          href="/g"
          className="text-text ml-2 shrink-0 no-underline hover:underline"
        >
          {t.groups.switcher}
        </Link>
      )}
      {me && (
        <>
          <ChevronRight className="text-dim size-3 shrink-0" aria-hidden />
          <details ref={menu} className="relative min-w-0">
            <summary className="text-text block cursor-pointer list-none truncate hover:underline">
              {current?.name ?? t.groups.switcher} ▾
            </summary>
            <div className="bevel bg-window absolute top-full left-0 z-20 mt-1 flex min-w-48 flex-col py-1">
              {groups.length === 0 && (
                <span className="text-dim px-2 py-1">{t.groups.none}</span>
              )}
              {groups.map((g) => (
                <Link
                  key={g.slug}
                  href={`/g/${g.slug}`}
                  onClick={close}
                  aria-current={g === current ? "page" : undefined}
                  className="hover:bg-hover aria-[current=page]:text-gold text-text truncate px-2 py-1 no-underline"
                >
                  {g.name}
                </Link>
              ))}
              <Link
                href="/g"
                onClick={close}
                className="border-lo hover:bg-hover text-text mt-1 border-t px-2 py-1 no-underline"
              >
                {t.groups.browse}
              </Link>
              <Link
                href="/g/new"
                onClick={close}
                className="hover:bg-hover text-gold px-2 py-1 no-underline"
              >
                + {t.groups.newGroup}
              </Link>
            </div>
          </details>
        </>
      )}
      {profileHref && me && (
        <Link
          href={profileHref}
          className="text-gold ml-1 shrink-0 no-underline hover:underline"
        >
          {t.home.myProfile}
        </Link>
      )}
      <BackgroundToggle className="ml-auto" initialOn={initialBackdrop} />
      <LanguageToggle className="ml-2" />
      {me ? (
        <form
          action="/auth/logout"
          method="post"
          className="ml-3 flex min-w-0 items-center gap-1.5"
        >
          <span className="text-dim hidden truncate sm:inline">
            {me.name}
            {me.isSiteAdmin && ` · ${t.home.siteAdmin}`}
          </span>
          {me.avatarUrl && (
            <Image
              src={me.avatarUrl}
              alt={me.name}
              width={18}
              height={18}
              unoptimized
              className="border-lo shrink-0 border"
            />
          )}
          <button
            type="submit"
            className="bevel bg-sheet enabled:hover:bg-hover text-text shrink-0 px-1.5 py-0.5 text-[11px]"
          >
            {t.home.signOut}
          </button>
        </form>
      ) : (
        auth && (
          <a
            href={
              path === "/"
                ? "/auth/steam"
                : `/auth/steam?next=${encodeURIComponent(path)}`
            }
            className="text-gold ml-3 shrink-0 font-bold no-underline hover:underline"
          >
            {t.home.signInShort}
          </a>
        )
      )}
    </nav>
  );
}
