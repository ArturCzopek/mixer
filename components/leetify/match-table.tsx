"use client";

import { Fragment, useId, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useLang, useT } from "@/components/i18n";
import { Well } from "@/components/vgui";
import type { LeetifyMatch, LeetifyDetailField } from "@/lib/external/leetify";

const detailFields: LeetifyDetailField[] = [
  "total_damage",
  "mvps",
  "multi5k",
  "total_hs_kills",
  "flashbang_hit_foe",
  "flashbang_hit_friend",
  "flash_assist",
];

export function leetifyMatchDetails(match: LeetifyMatch) {
  const details: { field: LeetifyDetailField | "adr"; value: number }[] = [];
  for (const field of detailFields) {
    const value = match.details?.[field];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0)
      details.push({ field, value });
    if (field === "total_damage") {
      const rounds = match.details?.rounds_count;
      if (
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= 0 &&
        typeof rounds === "number" &&
        Number.isFinite(rounds) &&
        rounds > 0
      )
        details.push({
          field: "adr",
          value: Math.round((value / rounds) * 10) / 10,
        });
    }
  }
  return details;
}

export function averageLeetifyRating(matches: LeetifyMatch[], count: number) {
  const ratings = matches
    .slice(0, count)
    .flatMap(({ leetifyRating }) =>
      typeof leetifyRating === "number" && Number.isFinite(leetifyRating)
        ? [leetifyRating]
        : [],
    );
  return ratings.length
    ? {
        value:
          ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length,
        count: ratings.length,
      }
    : null;
}

export function LeetifyMatchTable({
  matches,
  fixedRows,
  loading = false,
  emptyMessage,
}: {
  matches: LeetifyMatch[];
  fixedRows?: number;
  loading?: boolean;
  emptyMessage?: string;
}) {
  const t = useT();
  const lang = useLang();
  const tableId = useId();
  const [expanded, setExpanded] = useState<string[]>([]);
  const shown = matches.slice(0, fixedRows ?? 20);
  const rowCount = fixedRows ?? shown.length;
  const rating = (value: number | null) =>
    value === null || !Number.isFinite(value)
      ? "—"
      : value > 0
        ? `+${value.toFixed(2)}`
        : value < 0
          ? `−${Math.abs(value).toFixed(2)}`
          : "0.00";

  return (
    <Well className="max-h-[32rem] overflow-auto">
      <table
        aria-label={t.leetify.resultsAria}
        className="w-full min-w-[540px] text-left text-xs tabular-nums"
      >
        <thead className="bg-window text-dim sticky top-0">
          <tr>
            <th className="p-2">{t.leetify.date}</th>
            <th>{t.leetify.map}</th>
            <th className="text-right">{t.leetify.score}</th>
            <th className="px-2">
              <span className="sr-only">{t.leetify.result}</span>
            </th>
            <th className="text-right">{t.leetify.kad}</th>
            <th className="px-2 text-right">{t.leetify.rating}</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }, (_, index) => {
            const match = shown[index];
            if (!match)
              return (
                <tr
                  key={`empty-${index}`}
                  className="border-row h-[30px] border-t"
                >
                  <td colSpan={6} className="px-2">
                    {loading && <span className="bg-hover block h-2 w-2/3" />}
                  </td>
                </tr>
              );
            const outcome =
              match.score[0] > match.score[1]
                ? "win"
                : match.score[0] < match.score[1]
                  ? "loss"
                  : "draw";
            const date = new Intl.DateTimeFormat(
              lang === "pl" ? "pl-PL" : "en-GB",
              {
                day: "2-digit",
                month: "short",
                year: "numeric",
                timeZone: "Europe/Warsaw",
              },
            ).format(new Date(match.finishedAt));
            const details = leetifyMatchDetails(match);
            const expandable = fixedRows === undefined && details.length > 0;
            const rowId = `${match.dataSource}-${match.finishedAt}-${index}`;
            const open = expanded.includes(rowId);
            return (
              <Fragment key={`${match.finishedAt}-${index}`}>
                <tr
                  key={`${match.finishedAt}-${index}`}
                  className="border-row h-[30px] border-t"
                >
                  <td className="text-dim px-2">
                    <span className="inline-flex items-center gap-1">
                      {expandable && (
                        <button
                          type="button"
                          aria-label={`${t.leetify.detailsTitle} · ${date} · ${match.map}`}
                          aria-expanded={open}
                          aria-controls={`${tableId}-details-${index}`}
                          onClick={() =>
                            setExpanded((rows) =>
                              rows.includes(rowId)
                                ? rows.filter((row) => row !== rowId)
                                : [...rows, rowId],
                            )
                          }
                          className="text-gold hover:bg-hover focus-visible:outline-gold inline-flex h-6 w-6 shrink-0 items-center justify-center focus-visible:outline-2"
                        >
                          <ChevronRight
                            aria-hidden="true"
                            size={14}
                            className={open ? "rotate-90" : ""}
                          />
                        </button>
                      )}
                      {match.matchUrl ? (
                        <a
                          href={match.matchUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gold underline"
                        >
                          {date}
                        </a>
                      ) : (
                        date
                      )}
                    </span>
                  </td>
                  <td>
                    {match.matchUrl ? (
                      <a
                        href={match.matchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gold underline"
                      >
                        {match.map}
                      </a>
                    ) : (
                      match.map
                    )}
                  </td>
                  <td className="text-right">
                    {match.score[0]}:{match.score[1]}
                  </td>
                  <td className="px-2">
                    <b
                      className={
                        outcome === "win"
                          ? "text-win"
                          : outcome === "loss"
                            ? "text-loss"
                            : "text-dim"
                      }
                    >
                      {t.leetify[outcome]}
                    </b>
                  </td>
                  <td className="text-right">{match.kad.join("/")}</td>
                  <td
                    className={`px-2 text-right ${
                      match.leetifyRating === null ||
                      !Number.isFinite(match.leetifyRating)
                        ? "text-dim"
                        : match.leetifyRating > 0
                          ? "text-gold"
                          : "text-text"
                    }`}
                  >
                    {rating(match.leetifyRating)}
                  </td>
                </tr>
                {expandable && open && (
                  <tr
                    id={`${tableId}-details-${index}`}
                    className="border-row border-t"
                  >
                    <td colSpan={6} className="px-2 py-1">
                      <dl className="grid max-w-[calc(100vw-4rem)] grid-cols-2 gap-x-4 gap-y-2 py-2 sm:max-w-none sm:grid-cols-3">
                        {details.map(({ field, value }) => (
                          <div key={field}>
                            <dt className="text-dim">
                              {t.leetify.details[field]}
                            </dt>
                            <dd className="tabular-nums">{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {fixedRows !== undefined && matches.length > fixedRows && (
        <p className="text-dim px-2 py-1 text-[11px]">
          {t.leetify.more(matches.length - fixedRows)}
        </p>
      )}
      {!loading && matches.length === 0 && emptyMessage && (
        <p className="text-dim px-3 py-3 text-center text-[11px]">
          {emptyMessage}
        </p>
      )}
    </Well>
  );
}

export function LeetifyAttribution() {
  return (
    <a
      href="https://leetify.com/"
      target="_blank"
      rel="noreferrer"
      className="bevel bg-sheet text-text hover:bg-hover mt-1.5 flex items-center justify-center px-2 py-1.5 text-[11px] font-bold no-underline"
    >
      Data Provided by Leetify
    </a>
  );
}
