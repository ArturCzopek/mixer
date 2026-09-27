import Link from "next/link";
import { Well, Window } from "@/components/vgui";
import { authConfigured, getSession, missingAuthEnv } from "@/lib/auth/server";
import { getDict } from "@/lib/i18n/server";

export default async function Home({ searchParams }: PageProps<"/">) {
  const { login } = await searchParams;
  const session = authConfigured() ? await getSession() : null;
  const t = await getDict();
  return (
    <main className="mx-auto w-full max-w-[460px] px-2 py-6">
      <Window title="mixer">
        <p className="mb-2">{t.home.tagline}</p>
        {login === "failed" && (
          <Well className="text-dim mb-2 px-2 py-1.5 text-[11px]">
            {t.home.loginFailed}
          </Well>
        )}
        {authConfigured() ? (
          !session && (
            <a
              href="/auth/steam"
              className="bevel bg-sheet text-gold mb-2 block px-3 py-2.5 text-center text-[13px] font-bold no-underline"
            >
              {t.home.signIn}
            </a>
          )
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
