"use client";

import { useEffect, useState } from "react";
import { useLang, useT } from "@/components/i18n";
import { Well } from "@/components/vgui";
import { RatingTrend } from "@/components/profile/rating-trend";
import type { LeetifyMatch, LeetifyProfile } from "@/lib/external/leetify";
import { LeetifyAttribution, LeetifyMatchTable } from "./match-table";

type ProfileResponse = LeetifyProfile & {
  faceitMatches: LeetifyMatch[];
  premierMatches: LeetifyMatch[];
};

export function LeetifyProfilePanel({
  steamId,
  name,
  source,
}: {
  steamId: string;
  name: string;
  source: "faceit" | "premier";
}) {
  const t = useT();
  const lang = useLang();
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/leetify/${encodeURIComponent(steamId)}?view=profile`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Leetify request failed");
        return (await response.json()) as ProfileResponse;
      })
      .then(setData)
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [steamId]);

  const pending = data === null && !failed;
  const matches =
    source === "faceit"
      ? (data?.faceitMatches ?? [])
      : (data?.premierMatches ?? []);
  const rankValues: [string, number | null | undefined][] =
    source === "faceit"
      ? [
          [t.profile.faceitLevel, data?.ranks.faceit],
          [t.profile.faceitElo, data?.ranks.faceit_elo],
        ]
      : [[t.profile.premierRating, data?.ranks.premier]];
  const ratingPoints = [...matches.slice(0, 20)]
    .reverse()
    .flatMap((match, index) => {
      const value = match.leetifyRating;
      if (value === null) return [];
      const rating =
        value > 0
          ? `+${value.toFixed(2)}`
          : value < 0
            ? `−${Math.abs(value).toFixed(2)}`
            : "0.00";
      const date = new Intl.DateTimeFormat(lang === "pl" ? "pl-PL" : "en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Europe/Warsaw",
      }).format(new Date(match.finishedAt));
      return [
        {
          id: `${match.finishedAt}-${index}`,
          rating: value,
          dateLabel: date,
          title: t.leetify.ratingPoint(
            date,
            match.map,
            `${match.score[0]}:${match.score[1]}`,
            rating,
          ),
        },
      ];
    });
  const emptyMessage = failed
    ? t.leetify.notAnswering(name)
    : data?.privacyMode
      ? t.leetify.privateProfile
      : t.profile.noLeetifyMatches;

  return (
    <div className="mt-3">
      {pending ? (
        <Well
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="text-dim mb-2 px-2 py-2 text-[11px]"
        >
          {t.loading.leetify}
        </Well>
      ) : !data?.privacyMode && !failed ? (
        <Well className="mb-2 flex flex-wrap gap-x-6 gap-y-2 px-3 py-2 text-xs">
          {rankValues.map(([label, value]) => (
            <div key={label}>
              <span className="text-dim block">{label}</span>
              <b className="text-gold text-lg">{value ?? "—"}</b>
            </div>
          ))}
        </Well>
      ) : null}
      {!pending && ratingPoints.length > 0 && (
        <Well className="mb-2 px-2 py-1.5">
          <p className="text-dim mb-1 text-[11px]">
            {t.leetify.rawRatingByMatch} · {t.leetify.lastMatches}
          </p>
          <RatingTrend
            points={ratingPoints}
            label={t.leetify.rawRatingByMatch}
            referenceValue={0}
          />
        </Well>
      )}
      <LeetifyMatchTable
        matches={matches.slice(0, 20)}
        fixedRows={pending ? 5 : undefined}
        loading={pending}
        emptyMessage={pending ? undefined : emptyMessage}
      />
      <LeetifyAttribution />
    </div>
  );
}
