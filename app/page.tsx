import Link from "next/link";
import { Window } from "@/components/vgui";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-[460px] px-2 py-6">
      <Window title="mixer">
        <p className="mb-2">
          CS2 10-man mixes for our crew: balanced 5v5 lineups, live voting and
          stats across mixes.
        </p>
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
