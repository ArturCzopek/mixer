"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { VButton, Well } from "@/components/vgui";
import { useT } from "@/components/i18n";
import { mixerRating2 } from "@/lib/balance/faceit-rating";
import {
  DemoParseError,
  parseDemoFile,
  type DemoParseErrorCode,
  type DemoParseProgress,
  type DemoParsedFile,
} from "@/lib/demo/client";
import { attachDemoToMatch } from "@/lib/demo/actions";
import type { Dict } from "@/lib/i18n/dict";
import { cn } from "@/lib/utils";
import { validateDemoForMatch, type DemoMatchPlayer } from "./validation";

type DemoErrorKey = keyof Dict["demo"]["errors"];
type PreviewPlayer = DemoMatchPlayer & { name: string };

function parseErrorKey(error: unknown): DemoErrorKey {
  if (!(error instanceof DemoParseError)) return "failed";
  const keys: Record<DemoParseErrorCode, DemoErrorKey> = {
    unsupported: "unsupportedZstd",
    tooLarge: "tooLarge",
    decode: "malformed",
    invalid: "malformed",
    memory: "lowMemory",
    failed: "failed",
  };
  return keys[error.code];
}

function actionErrorKey(error: string): DemoErrorKey {
  const known = [
    "alreadyAttached",
    "unauthorized",
    "forbidden",
    "controller",
    "invalid",
    "roster",
    "mismatch",
    "failed",
  ];
  return known.includes(error) ? (error as DemoErrorKey) : "failed";
}

function supportedFile(name: string) {
  const lower = name.toLocaleLowerCase("en");
  return lower.endsWith(".dem") || lower.endsWith(".dem.zst");
}

export function DemoAttachment({
  matchId,
  mapName,
  mapLabel,
  scoreA,
  scoreB,
  players,
  viewerCanAttach,
}: {
  matchId: string;
  /** Canonical saved name used for matching, without a display ordinal. */
  mapName: string | null;
  mapLabel: string;
  scoreA: number;
  scoreB: number;
  players: PreviewPlayer[];
  viewerCanAttach: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const fileInput = React.useRef<HTMLInputElement>(null);
  const sequence = React.useRef(0);
  const activeController = React.useRef<AbortController | null>(null);
  const parsingRef = React.useRef(false);
  const [parsed, setParsed] = React.useState<DemoParsedFile | null>(null);
  const [fileName, setFileName] = React.useState("");
  const [progress, setProgress] = React.useState<DemoParseProgress | null>(
    null,
  );
  const [parsing, setParsing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [issue, setIssue] = React.useState<DemoErrorKey | null>(null);
  const [saved, setSaved] = React.useState(false);

  const target = React.useMemo(
    () => ({
      mapName: mapName ?? "",
      scoreA,
      scoreB,
      players: players.map(({ steamId, team }) => ({ steamId, team })),
    }),
    [mapName, players, scoreA, scoreB],
  );
  const targetKey = JSON.stringify([
    matchId,
    target.mapName,
    target.scoreA,
    target.scoreB,
    target.players,
  ]);
  const targetKeyRef = React.useRef(targetKey);
  const previousTargetKey = React.useRef(targetKey);
  const stopWorker = React.useCallback(() => {
    sequence.current++;
    activeController.current?.abort();
    activeController.current = null;
    parsingRef.current = false;
  }, []);
  React.useEffect(() => {
    targetKeyRef.current = targetKey;
    if (previousTargetKey.current !== targetKey) {
      previousTargetKey.current = targetKey;
      setParsed(null);
      setFileName("");
      setProgress(null);
      setParsing(false);
      setIssue(null);
      setSaved(false);
      setSaving(false);
    }
    return stopWorker;
  }, [targetKey, stopWorker]);

  const validation = parsed
    ? validateDemoForMatch(parsed.payload, target)
    : null;
  const visibleIssue =
    issue ?? (validation && !validation.valid ? validation.reason : null);

  const chooseFile = () => fileInput.current?.click();
  const cancel = () => {
    sequence.current++;
    activeController.current?.abort();
    activeController.current = null;
    parsingRef.current = false;
    setParsing(false);
    setProgress(null);
    setParsed(null);
    setFileName("");
    setIssue(null);
    setSaved(false);
    if (fileInput.current) fileInput.current.value = "";
  };

  const selectFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (parsingRef.current || saving) return;
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    sequence.current++;
    activeController.current?.abort();
    activeController.current = null;
    parsingRef.current = false;
    setParsed(null);
    setIssue(null);
    setSaved(false);
    setFileName(file.name);
    setProgress(null);
    if (!supportedFile(file.name)) {
      setIssue("file");
      setParsing(false);
      return;
    }

    const request = ++sequence.current;
    const controller = new AbortController();
    activeController.current = controller;
    parsingRef.current = true;
    setParsing(true);
    void parseDemoFile(
      file,
      (nextProgress) => {
        if (request === sequence.current && targetKeyRef.current === targetKey)
          setProgress(nextProgress);
      },
      controller.signal,
    )
      .then((result) => {
        if (
          request !== sequence.current ||
          targetKeyRef.current !== targetKey ||
          controller.signal.aborted
        ) {
          return;
        }
        setParsed(result);
        const check = validateDemoForMatch(result.payload, target);
        if (!check.valid) setIssue(check.reason);
      })
      .catch((error: unknown) => {
        if (
          controller.signal.aborted ||
          (error instanceof Error && error.name === "AbortError")
        ) {
          return;
        }
        if (request === sequence.current) setIssue(parseErrorKey(error));
      })
      .finally(() => {
        if (request === sequence.current) {
          parsingRef.current = false;
          activeController.current = null;
          setParsing(false);
          setProgress(null);
        }
      });
  };

  const save = async () => {
    if (!parsed || !validation?.valid || parsingRef.current || saving) return;
    const request = sequence.current;
    const submittedTarget = targetKey;
    const check = validateDemoForMatch(parsed.payload, target);
    if (!check.valid) {
      setIssue(check.reason);
      return;
    }
    setSaving(true);
    setIssue(null);
    try {
      const result = await attachDemoToMatch(matchId, parsed.payload);
      if (
        request !== sequence.current ||
        targetKeyRef.current !== submittedTarget
      )
        return;
      if (result && "error" in result) {
        setIssue(actionErrorKey(result.error));
        if (result.error === "mismatch") router.refresh();
      } else {
        setSaved(true);
        router.refresh();
      }
    } catch {
      if (request === sequence.current) setIssue("failed");
    } finally {
      if (request === sequence.current) setSaving(false);
    }
  };

  if (!viewerCanAttach) return null;
  return (
    <details
      className="border-lo mt-3 border-t text-[11px]"
      onToggle={(event) => {
        if (!event.currentTarget.open && parsing) cancel();
      }}
    >
      <summary className="text-gold hover:bg-hover cursor-pointer px-1 py-2 font-bold">
        {t.demo.uploadOpen}
      </summary>
      <Well className="p-2 text-[11px]">
        <>
          {!mapName && (
            <p className="text-dim mt-1">{t.demo.mapNameRequired}</p>
          )}
          <p className="text-dim mt-1">{t.demo.intro}</p>
          <p className="text-dim mt-0.5">{t.demo.supportedFiles}</p>
          <input
            ref={fileInput}
            type="file"
            accept=".dem,.dem.zst"
            aria-hidden="true"
            tabIndex={-1}
            className="sr-only"
            onChange={selectFile}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {!parsed && (
              <VButton
                type="button"
                disabled={parsing || saving}
                onClick={chooseFile}
              >
                {parsing ? t.demo.parsing : t.demo.chooseFile}
              </VButton>
            )}
            {parsed && (
              <VButton
                type="button"
                disabled={parsing || saving}
                onClick={chooseFile}
              >
                {t.demo.chooseAnother}
              </VButton>
            )}
            {(parsing || parsed) && (
              <VButton type="button" disabled={saving} onClick={cancel}>
                {t.demo.cancel}
              </VButton>
            )}
          </div>
          {fileName && (
            <p className="text-dim mt-1 break-all" aria-live="polite">
              {fileName}
            </p>
          )}
          {parsing && progress && (
            <div className="mt-2" aria-live="polite" aria-busy="true">
              <div className="text-text mb-1 flex justify-between gap-2">
                <span>{t.demo.parseStages[progress.stage]}</span>
                {typeof progress.percent === "number" && (
                  <span>{Math.round(progress.percent)}%</span>
                )}
              </div>
              <div
                role="progressbar"
                aria-label={t.demo.parseStages[progress.stage]}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress.percent}
                className="bg-lo h-2"
              >
                <span
                  className="bg-gold block h-full"
                  style={{
                    width:
                      typeof progress.percent === "number"
                        ? `${Math.max(0, Math.min(100, progress.percent))}%`
                        : "0%",
                  }}
                />
              </div>
            </div>
          )}
          {parsed && validation && (
            <div className="mt-2">
              <h4 className="text-text mb-1 font-bold">
                {t.demo.previewTitle}
              </h4>
              <dl className="border-lo bg-well grid grid-cols-2 gap-x-2 gap-y-0.5 p-1.5">
                <dt className="text-dim">{t.demo.previewMap}</dt>
                <dd className="min-w-0 truncate text-right">
                  {parsed.payload.mapName}
                </dd>
                <dt className="text-dim">{t.demo.targetMap}</dt>
                <dd className="text-right">{mapLabel}</dd>
                <dt className="text-dim">{t.demo.targetResult}</dt>
                <dd className="text-right">
                  {t.lists.team("A")} {scoreA}:{scoreB} {t.lists.team("B")}
                </dd>
                <dt className="text-dim">{t.demo.previewResult}</dt>
                <dd className="text-right">
                  {validation.score
                    ? `${t.lists.team("A")} ${validation.score.a}:${validation.score.b} ${t.lists.team("B")}`
                    : "—"}
                </dd>
                <dt className="text-dim">{t.demo.previewRoster}</dt>
                <dd className="text-right">
                  {parsed.payload.players.length}/10
                </dd>
              </dl>
              <DemoPreviewTable
                parsed={parsed}
                validation={validation}
                targetPlayers={players}
              />
            </div>
          )}
          {visibleIssue && (
            <p role="alert" className="text-loss mt-2">
              {t.demo.errors[visibleIssue]}
            </p>
          )}
          {saved && (
            <p role="status" className="text-text mt-2">
              {t.demo.saved}
            </p>
          )}
          {parsed && (
            <VButton
              type="button"
              primary
              className="mt-2 w-full"
              disabled={!validation?.valid || saving || parsing}
              onClick={() => void save()}
            >
              {saving ? t.demo.saving : t.demo.save}
            </VButton>
          )}
        </>
      </Well>
    </details>
  );
}

function DemoPreviewTable({
  parsed,
  validation,
  targetPlayers,
}: {
  parsed: DemoParsedFile;
  validation: ReturnType<typeof validateDemoForMatch>;
  targetPlayers: PreviewPlayer[];
}) {
  const t = useT();
  const playersById = new Map(
    targetPlayers.map((player) => [player.steamId, player]),
  );
  const statsById = new Map(
    parsed.preview.stats.map((stat) => [stat.steamid, stat]),
  );
  const rows = parsed.payload.players
    .map((player) => {
      const stats = statsById.get(player.steamid);
      const team = validation.teamById?.get(player.teamId) ?? null;
      const mixerRating =
        stats && stats.roundsPlayed > 0
          ? mixerRating2({
              kills: stats.kills,
              deaths: stats.deaths,
              assists: stats.assists,
              rounds: stats.roundsPlayed,
              adr: stats.adr,
              kastPct: stats.kastPercent,
            })
          : null;
      return {
        id: player.steamid,
        name: playersById.get(player.steamid)?.name ?? player.name,
        team,
        stats,
        mixerRating,
      };
    })
    .sort((a, b) => {
      const teamOrder = (a.team ?? "C").localeCompare(b.team ?? "C");
      if (teamOrder) return teamOrder;
      return (b.mixerRating ?? -Infinity) - (a.mixerRating ?? -Infinity);
    });
  const best = Math.max(...rows.flatMap((row) => row.mixerRating ?? []));
  const grouped = rows.some((row) => row.team !== null);
  const grid = "min-w-[330px] w-full text-left text-[11px] tabular-nums";
  return (
    <Well className="mt-1 overflow-x-auto p-0">
      <table aria-label={t.demo.previewTitle} className={grid}>
        <thead className="bg-window text-dim">
          <tr>
            <th scope="col" className="px-1.5 py-1">
              {t.lists.player}
            </th>
            <th
              scope="col"
              title={t.demo.statTitles.kills}
              className="text-right"
            >
              K
            </th>
            <th
              scope="col"
              title={t.demo.statTitles.assists}
              className="text-right"
            >
              A
            </th>
            <th
              scope="col"
              title={t.demo.statTitles.deaths}
              className="text-right"
            >
              D
            </th>
            <th
              scope="col"
              title={t.demo.statTitles.adr}
              className="text-right"
            >
              ADR
            </th>
            <th
              scope="col"
              title={t.demo.statTitles.kast}
              className="text-right"
            >
              KAST
            </th>
            <th scope="col" title={t.played.mr} className="px-1.5 text-right">
              MR
            </th>
          </tr>
        </thead>
        <tbody>
          {(["A", "B"] as const).map((team) => {
            const teamRows = rows.filter((row) => row.team === team);
            if (!grouped || !teamRows.length) return null;
            return (
              <React.Fragment key={team}>
                <tr>
                  <th
                    scope="rowgroup"
                    colSpan={7}
                    className="bg-window text-gold px-1.5 py-1 text-left font-bold"
                  >
                    {t.lists.team(team)}
                  </th>
                </tr>
                {teamRows.map((row) => (
                  <DemoPreviewRow key={row.id} row={row} best={best} />
                ))}
              </React.Fragment>
            );
          })}
          {!grouped &&
            rows.map((row) => (
              <DemoPreviewRow key={row.id} row={row} best={best} />
            ))}
        </tbody>
      </table>
    </Well>
  );
}

function DemoPreviewRow({
  row,
  best,
}: {
  row: {
    id: string;
    name: string;
    stats: DemoParsedFile["preview"]["stats"][number] | undefined;
    mixerRating: number | null;
  };
  best: number;
}) {
  const stats = row.stats;
  const value = (number: number | undefined) =>
    typeof number === "number" && Number.isFinite(number) ? number : "—";
  return (
    <tr
      className={cn(
        "border-row border-t",
        row.mixerRating === best && "bg-row",
      )}
    >
      <th
        scope="row"
        className="max-w-28 min-w-0 truncate px-1.5 py-1 text-left font-normal"
      >
        {row.name}
      </th>
      <td className="text-right">{value(stats?.kills)}</td>
      <td className="text-right">{value(stats?.assists)}</td>
      <td className="text-right">{value(stats?.deaths)}</td>
      <td className="text-right">{stats ? stats.adr.toFixed(0) : "—"}</td>
      <td className="text-right">
        {stats ? `${stats.kastPercent.toFixed(1)}%` : "—"}
      </td>
      <td className="px-1.5 text-right font-bold">
        {row.mixerRating === null ? "—" : row.mixerRating.toFixed(2)}
      </td>
    </tr>
  );
}
