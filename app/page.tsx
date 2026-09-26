import Image from "next/image";
import Link from "next/link";
import { BackgroundToggle, VButton, Well, Window } from "@/components/vgui";
import { LanguageToggle } from "@/components/i18n";
import { getSession, type Session } from "@/lib/auth/server";
import type { Dict } from "@/lib/i18n/dict";
import { getDict } from "@/lib/i18n/server";

/** Env vars login needs on the server. Only their names are ever shown, never values. */
const AUTH_ENV = [
  "SESSION_SECRET",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
] as const;
const missingAuthEnv = () => AUTH_ENV.filter((name) => !process.env[name]);
const authConfigured = () => missingAuthEnv().length === 0;

export default async function Home({ searchParams }: PageProps<"/">) {
  const { login } = await searchParams;
  const session = authConfigured() ? await getSession() : null;
  const t = await getDict();
  return (
    <main className="mx-auto w-full max-w-[460px] px-2 py-6">
      <Window
        title="mixer"
        right={
          <span className="flex items-center gap-2">
            <BackgroundToggle />
            <LanguageToggle />
          </span>
        }
      >
        <p className="mb-2">{t.home.tagline}</p>
        {login === "failed" && (
          <Well className="text-dim mb-2 px-2 py-1.5 text-[11px]">
            {t.home.loginFailed}
          </Well>
        )}
        {authConfigured() ? (
          <Account session={session} t={t} />
        ) : (
          <p className="text-dim mb-2 text-[11px]">
            {t.home.notConfigured(missingAuthEnv().join(", "))}
          </p>
        )}
        <Link
          href="/demo"
          className="bevel bg-sheet text-text mb-2 block px-3 py-2.5 text-center text-[13px] font-bold no-underline"
        >
          {t.home.showcase}
        </Link>
        <p className="text-dim">
          <a
            href="https://github.com/ArturCzopek/mixer"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.home.source}
          </a>
        </p>
      </Window>
    </main>
  );
}

function Account({ session, t }: { session: Session | null; t: Dict }) {
  if (!session)
    return (
      <a
        href="/auth/steam"
        className="bevel bg-sheet text-gold mb-2 block px-3 py-2.5 text-center text-[13px] font-bold no-underline"
      >
        {t.home.signIn}
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
          <span className="text-dim text-[11px]"> · {t.home.siteAdmin}</span>
        )}
      </span>
      <VButton type="submit" className="py-1.5">
        {t.home.signOut}
      </VButton>
    </form>
  );
}
