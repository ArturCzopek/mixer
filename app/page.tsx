import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start justify-center gap-6 px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">mixer</h1>
      <p className="text-muted-foreground max-w-prose">
        CS2 10-man mix organizer: balanced 5v5 lineups, live voting and stats
        across mixes.
      </p>
      <Button asChild variant="outline">
        <a
          href="https://github.com/ArturCzopek/mixer"
          target="_blank"
          rel="noopener noreferrer"
        >
          Project on GitHub
        </a>
      </Button>
    </main>
  );
}
