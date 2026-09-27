import Link from "next/link";
import { Well, Window } from "@/components/vgui";
import { authConfigured, getSession, missingAuthEnv } from "@/lib/auth/server";
import { HomeJoinButton, HomeRealtime } from "@/components/mix/home-live";
import { getDict } from "@/lib/i18n/server";
import { homeMixes } from "@/lib/mix/queries";

export default async function Home({ searchParams }: PageProps<"/">) {
  const { login } = await searchParams;
  const configured = authConfigured();
  const session = configured ? await getSession() : null;
  const t = await getDict();
  const data = session ? await homeMixes(session.playerId) : null;

  return (
    <main className="mx-auto w-full max-w-[460px] px-2 py-6">
      <Window title="mixer">
        <p className="mb-2">{t.home.tagline}</p>
        {login === "failed" && (
          <Well className="text-dim mb-2 px-2 py-1.5 text-[11px]">
            {t.home.loginFailed}
          </Well>
        )}
        {session && data ? (
          <>
            <HomeRealtime />
            <section className="mb-3">
              <h2 className="mb-1 text-[13px] font-bold">
                {t.home.openSignups}
              </h2>
              <Well className="overflow-hidden">
                {data.openSignups.length > 0 ? (
                  <ul className="divide-row divide-y">
                    {data.openSignups.map((mix) => (
                      <li
                        key={mix.id}
                        className="flex min-w-0 items-center gap-2 px-1.5 py-1.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-dim truncate text-[11px]">
                            {mix.groupName}
                          </p>
                          <Link
                            href={`/g/${mix.groupSlug}/m/${mix.id}`}
                            className="block truncate font-bold"
                          >
                            {mix.title}
                          </Link>
                        </div>
                        <span className="text-gold shrink-0 text-[11px] font-bold tabular-nums">
                          {mix.participantCount}/10
                        </span>
                        {mix.viewerJoined ? (
                          <span className="text-dim shrink-0 text-[11px]">
                            {t.home.youAreIn}
                          </span>
                        ) : (
                          mix.participantCount < 10 && (
                            <HomeJoinButton mixId={mix.id} />
                          )
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-dim px-1.5 py-1.5 text-[11px]">
                    {t.home.noOpenSignups}
                  </p>
                )}
              </Well>
            </section>

            <section className="mb-3">
              <h2 className="mb-1 text-[13px] font-bold">
                {t.home.inProgress}
              </h2>
              <Well className="overflow-hidden">
                {data.inProgress.length > 0 ? (
                  <ul className="divide-row divide-y">
                    {data.inProgress.map((mix) => (
                      <li
                        key={mix.id}
                        className="flex min-w-0 items-center gap-2 px-1.5 py-1.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-dim truncate text-[11px]">
                            {mix.groupName}
                          </p>
                          <Link
                            href={`/g/${mix.groupSlug}/m/${mix.id}`}
                            className="block truncate font-bold"
                          >
                            {mix.title}
                          </Link>
                        </div>
                        <span className="text-dim shrink-0 text-[11px]">
                          {t.home.mixStatus[mix.status]}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-dim px-1.5 py-1.5 text-[11px]">
                    {t.home.noInProgress}
                  </p>
                )}
              </Well>
            </section>

            <section>
              <h2 className="mb-1 text-[13px] font-bold">{t.home.myGroups}</h2>
              <Well className="overflow-hidden">
                {data.groups.length > 0 ? (
                  <ul className="divide-row divide-y">
                    {data.groups.map((group) => (
                      <li key={group.id}>
                        <Link
                          href={`/g/${group.slug}`}
                          className="block px-1.5 py-1.5"
                        >
                          {group.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-dim px-1.5 py-1.5 text-[11px]">
                    {t.groups.none}
                  </p>
                )}
              </Well>
              <Link href="/g/new" className="mt-1 inline-block text-[11px]">
                {t.home.createGroup}
              </Link>
            </section>
          </>
        ) : configured ? (
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
        <p className="text-dim mt-2 flex flex-wrap gap-x-2 text-[11px]">
          <Link href="/demo">{t.home.showcase}</Link>
          <span aria-hidden="true">·</span>
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
