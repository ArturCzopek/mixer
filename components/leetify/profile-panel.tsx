"use client";

import { useEffect, useState } from "react";
import { useLang, useT } from "@/components/i18n";
import { Well } from "@/components/vgui";
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
      {!pending && matches.length > 0 && (
        <LeetifyRatingChart matches={matches} />
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

export function LeetifyRatingChart({ matches }: { matches: LeetifyMatch[] }) {
  const t = useT();
  const lang = useLang();
  const recent = matches.slice(0, 20).reverse();
  const ratings = recent.flatMap((match) =>
    match.leetifyRating === null ? [] : [match.leetifyRating],
  );
  if (recent.length === 0) return null;
  const extent = Math.max(0.1, ...ratings.map(Math.abs));
  const x = (index: number) =>
    recent.length === 1 ? 300 : 26 + (index * 548) / (recent.length - 1);
  const y = (value: number) => 76 - (value / extent) * 58;
  const ratingText = (value: number | null) =>
    value === null
      ? "—"
      : value > 0
        ? `+${value.toFixed(2)}`
        : value < 0
          ? `−${Math.abs(value).toFixed(2)}`
          : "0.00";
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(lang === "pl" ? "pl-PL" : "en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Europe/Warsaw",
    }).format(new Date(value));

  return (
    <Well className="mb-2 px-2 py-1.5">
      <p className="text-dim mb-1 text-[11px]">
        {t.leetify.rawRatingByMatch} · {t.leetify.lastMatches}
      </p>
      <svg
        viewBox="0 0 600 152"
        role="img"
        aria-label={t.leetify.rawRatingByMatch}
        className="h-32 w-full"
        preserveAspectRatio="none"
      >
        <line
          x1="26"
          x2="574"
          y1={y(0)}
          y2={y(0)}
          stroke="var(--vg-dim)"
          strokeDasharray="3 5"
          opacity="0.65"
        />
        {recent.map((match, index) => {
          const value = match.leetifyRating;
          const title = t.leetify.ratingPoint(
            formatDate(match.finishedAt),
            match.map,
            `${match.score[0]}:${match.score[1]}`,
            ratingText(value),
          );
          return (
            <g key={`${match.finishedAt}-${index}`}>
              {value !== null && (
                <line
                  x1={x(index)}
                  x2={x(index)}
                  y1={y(0)}
                  y2={y(value)}
                  stroke={value > 0 ? "var(--vg-gold)" : "var(--vg-text)"}
                  strokeWidth="2"
                />
              )}
              <circle
                cx={x(index)}
                cy={y(value ?? 0)}
                r="4"
                fill={
                  value === null
                    ? "var(--vg-dim)"
                    : value > 0
                      ? "var(--vg-gold)"
                      : "var(--vg-text)"
                }
              >
                <title>{title}</title>
              </circle>
            </g>
          );
        })}
      </svg>
    </Well>
  );
}
