"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/i18n";
import { Badge, Well, Window } from "@/components/vgui";
import type { LeetifyMatch } from "@/lib/external/leetify";
import { LeetifyAttribution, LeetifyMatchTable } from "./match-table";

type Preview = { privacyMode: boolean; matches: LeetifyMatch[] };

export function LeetifyPreviewCard({
  player,
}: {
  player: { steamId: string; name: string };
}) {
  const t = useT();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/leetify/${encodeURIComponent(player.steamId)}?view=preview`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Leetify request failed");
        return (await response.json()) as Preview;
      })
      .then(setPreview)
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [player.steamId]);

  const pending = preview === null && !failed;
  const matches = preview?.matches ?? [];
  const wins = matches.filter(
    (match) => match.score[0] > match.score[1],
  ).length;
  const losses = matches.filter(
    (match) => match.score[0] < match.score[1],
  ).length;
  const draws = matches.length - wins - losses;
  const message = pending
    ? t.loading.leetify
    : failed
      ? t.leetify.notAnswering(player.name)
      : preview?.privacyMode
        ? t.leetify.privateProfile
        : matches.length === 0
          ? t.leetify.noRecentFaceit
          : t.leetify.wl(wins, losses, draws);

  return (
    <Window title={t.leetify.previewTitle(player.name)} className="mt-2.5">
      <Well
        role="status"
        aria-live="polite"
        aria-busy={pending}
        className="text-dim mb-1.5 flex min-h-[38px] items-center gap-2 px-2 py-1.5 text-[11px]"
      >
        <Badge>{matches.length}</Badge>
        <span className="min-w-0 truncate">{message}</span>
      </Well>
      <LeetifyMatchTable matches={matches} fixedRows={8} loading={pending} />
      <LeetifyAttribution />
    </Window>
  );
}
