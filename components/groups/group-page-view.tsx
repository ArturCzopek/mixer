import type { ReactNode } from "react";
import Link from "next/link";
import { CreateMixForm } from "@/components/mix/lobby-view";
import { Window } from "@/components/vgui";
import type { MixStatus } from "@/lib/mix/actions";

const activeStatuses: readonly MixStatus[] = [
  "open",
  "balancing",
  "voting",
  "locked",
];

export const groupPageLinkClassName =
  "text-gold underline decoration-1 underline-offset-2 hover:text-white";

export function activeGroupMix<T extends { status: MixStatus }>(mixes: T[]) {
  return mixes.find((mix) => activeStatuses.includes(mix.status)) ?? null;
}

export function GroupPageLayout({
  title,
  activeMix,
  main,
  members,
}: {
  title: string;
  activeMix?: ReactNode;
  main: ReactNode;
  members: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-[1180px] px-2 py-6">
      <Window title={title} className="w-full">
        {activeMix && (
          <div className="border-hi bg-row mb-2 border px-2 py-1">
            {activeMix}
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-2 pb-3 lg:pb-0">{main}</div>
          <aside className="border-hi min-w-0 border-t pt-3 lg:border-t-0 lg:border-l lg:pt-1 lg:pl-3">
            {members}
          </aside>
        </div>
      </Window>
    </main>
  );
}

export function GroupCreateMix({
  groupId,
  canManage,
  hasActiveMix,
  title,
}: {
  groupId: string;
  canManage: boolean;
  hasActiveMix: boolean;
  title: string;
}) {
  if (!canManage || hasActiveMix) return null;
  return (
    <section>
      <h2 className="text-text mb-1 text-[13px] font-bold">{title}</h2>
      <CreateMixForm groupId={groupId} />
    </section>
  );
}

export function CollapsibleGroupLeaders({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <details className="border-row border-t">
      <summary className="bevel bg-window hover:bg-hover text-gold px-2 py-1.5 font-bold">
        {title}
      </summary>
      {children}
    </details>
  );
}

export function DiscordMemberProfile({
  discordUserId,
  linkedText,
  unlinkedText,
  profileText,
}: {
  discordUserId: string | null;
  linkedText: string;
  unlinkedText: string;
  profileText: string;
}) {
  const linked = discordUserId !== null;
  const status = linked ? linkedText : unlinkedText;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-flex items-center"
        role="img"
        aria-label={status}
        title={status}
      >
        <span
          aria-hidden="true"
          className={`border-lo inline-block size-[7px] border ${linked ? "bg-gold" : "bg-dim"}`}
        />
        <span className="sr-only">{status}</span>
      </span>
      {discordUserId && (
        <a
          href={`https://discord.com/users/${discordUserId}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={profileText}
          className={groupPageLinkClassName}
        >
          {profileText}
        </a>
      )}
    </span>
  );
}

export function ActiveMixLink({
  href,
  title,
  status,
}: {
  href: string;
  title: string;
  status: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-w-0 items-center gap-2 text-[11px]"
      aria-label={`${title}: ${status}`}
    >
      <span
        aria-hidden="true"
        className="bg-gold inline-block size-2 shrink-0"
      />
      <span className={`min-w-0 flex-1 truncate ${groupPageLinkClassName}`}>
        {title}
      </span>
      <span className="text-dim shrink-0">{status}</span>
    </Link>
  );
}
