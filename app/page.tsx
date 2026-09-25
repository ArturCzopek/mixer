import Image from "next/image";
import Link from "next/link";
import { VButton, Well, Window } from "@/components/vgui";
import { getSession, type Session } from "@/lib/auth/server";

const authConfigured = () =>
  Boolean(
    process.env.SESSION_SECRET &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SECRET_KEY,
  );

export default async function Home({ searchParams }: PageProps<"/">) {
  const { login } = await searchParams;
  const session = authConfigured() ? await getSession() : null;
  return (
    <main className="mx-auto w-full max-w-[460px] px-2 py-6">
      <Window title="mixer">
        <p className="mb-2">
          CS2 10-man mixes for our crew: balanced 5v5 lineups, live voting and
          stats across mixes.
        </p>
        {login === "failed" && (
          <Well className="text-dim mb-2 px-2 py-1.5 text-[11px]">
            Steam login did not go through. Try again.
          </Well>
        )}
        {authConfigured() ? (
          <Account session={session} />
        ) : (
          <p className="text-dim mb-2 text-[11px]">
            Login is not configured on this deployment.
          </p>
        )}
        <Link
          href="/demo"
          className="bevel bg-sheet text-text mb-2 block px-3 py-2.5 text-center text-[13px] font-bold no-underline"
        >
          See a Real Mix: 16 Dec 2024
        </Link>
        <p className="text-dim">
          Design preview: <Link href="/design/mix">mix page</Link> ·{" "}
          <a
            href="https://github.com/ArturCzopek/mixer"
            target="_blank"
            rel="noopener noreferrer"
          >
            source
          </a>
        </p>
      </Window>
    </main>
  );
}

function Account({ session }: { session: Session | null }) {
  if (!session)
    return (
      <a
        href="/auth/steam"
        className="bevel bg-sheet text-gold mb-2 block px-3 py-2.5 text-center text-[13px] font-bold no-underline"
      >
        Sign In Through Steam
      </a>
    );
  return (
    <form
      action="/auth/logout"
      method="post"
      className="mb-2 flex items-center gap-2"
    >
      {session.avatarUrl && (
        <Image
          src={session.avatarUrl}
          alt=""
          width={20}
          height={20}
          unoptimized
          className="border-lo border"
        />
      )}
      <span className="min-w-0 flex-1 truncate">
        {session.displayName ?? session.steamId}
        {session.isSiteAdmin && (
          <span className="text-dim text-[11px]"> · site admin</span>
        )}
      </span>
      <VButton type="submit" className="py-1.5">
        Log Out
      </VButton>
    </form>
  );
}
