"use client";

// Mix page in the VGUI world. Renders plain `MixViewData` built on the server: the showcase
// (lib/showcase/) and later the database (M1-5..M1-7). Every string comes from lib/i18n. Buttons do
// nothing yet.

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, ChevronRight, ExternalLink, Lock } from "lucide-react";
import {
  BackgroundToggle,
  Badge,
  ListHead,
  Sheet,
  SkillBar,
  Tabs,
  VButton,
  Well,
  Window,
} from "@/components/vgui";
import type { SkillBreakdown } from "@/lib/balance";
import {
  totals,
  type MixViewData,
  type ViewLine,
  type ViewPlayer,
  type ViewVariant,
} from "@/lib/mix/view";
import { votingOutcome } from "@/lib/mix/voting";
import { LanguageToggle, useLang, useT } from "@/components/i18n";
import type { Dict } from "@/lib/i18n/dict";
import { cn } from "@/lib/utils";

export type MixState = "lobby" | "voting" | "locked" | "played";

type Player = ViewPlayer;
type Line = Omit<ViewLine, "steamId"> & { player: Player };
type MapResult = { map: string; a: number; b: number; lines: Line[] };
type Variant = Omit<ViewVariant, "teamA" | "teamB"> & {
  teamA: Player[];
  teamB: Player[];
};

/** The view data with ids resolved to players, plus the helpers every panel uses. */
function resolve(data: MixViewData) {
  const byId = new Map(data.players.map((p) => [p.steamId, p]));
  const player = (id: string) => byId.get(id)!;
  const team = (ids: string[]) => ids.map(player);
  const explain = (p: Player): SkillBreakdown => data.breakdowns[p.steamId];
  const skill = (p: Player) => explain(p).S;
  const joinIndex = new Map(data.participants.map((x, i) => [x.steamId, i]));
  const lines = (ls: ViewLine[]): Line[] =>
    ls.map(({ steamId, ...l }) => ({ ...l, player: player(steamId) }));
  const outcome = votingOutcome(data.variants, data.mix.id);
  const winnerData = data.variants.find((v) => v.number === outcome.winner)!;
  const winner: Variant = {
    ...winnerData,
    teamA: team(winnerData.teamA),
    teamB: team(winnerData.teamB),
  };
  const maps: MapResult[] = data.result.maps.map((m) => ({
    ...m,
    lines: lines(m.lines),
  }));
  return {
    data,
    now: new Date(data.mixAt),
    explain,
    skill,
    avg: (t: Player[]) =>
      Math.round(t.reduce((s, p) => s + skill(p), 0) / t.length),
    nameOf: (id: string) => byId.get(id)?.name ?? id,
    byJoinOrder: (t: Player[]) =>
      [...t].sort(
        (a, b) => joinIndex.get(a.steamId)! - joinIndex.get(b.steamId)!,
      ),
    me: player(data.mix.meId),
    waitingFor: player(data.mix.waitingForId),
    variants: data.variants.map((v): Variant => ({
      ...v,
      teamA: team(v.teamA),
      teamB: team(v.teamB),
    })),
    lobby: data.participants.slice(0, data.lobbyCount).map((x) => ({
      player: player(x.steamId),
      joinedAt: x.joinedAt,
    })),
    outcome,
    winner,
    myVote:
      data.variants.find((v) => v.voters.includes(data.mix.meId))?.number ??
      null,
    real: data.showcase && {
      ...data.showcase.real,
      teamA: team(data.showcase.real.teamA),
      teamB: team(data.showcase.real.teamB),
    },
    result: {
      source: data.result.source,
      maps,
      all: lines(totals(data.result.maps)),
    },
  };
}

type Mix = ReturnType<typeof resolve>;
const MixContext = React.createContext<Mix | null>(null);
function useMix(): Mix {
  const mix = React.useContext(MixContext);
  if (!mix) throw new Error("useMix outside <MixView>");
  return mix;
}

export function MixView({
  state,
  data,
}: {
  state: MixState;
  data: MixViewData;
}) {
  const mix = React.useMemo(() => resolve(data), [data]);
  const t = useT();
  const lang = useLang();
  const when = new Intl.DateTimeFormat(lang === "pl" ? "pl-PL" : "en-GB", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Warsaw",
  }).format(new Date(data.mixAt));
  const [variantNo, setVariantNo] = React.useState(1);
  const [focusId, setFocusId] = React.useState(data.mix.meId);
  const variant = mix.variants.find((v) => v.number === variantNo)!;
  const count = state === "lobby" ? mix.lobby.length : 10;

  return (
    <MixContext.Provider value={mix}>
      <div className="mx-auto flex w-full max-w-[460px] flex-1 flex-col pb-[76px] md:max-w-[760px] lg:max-w-[1180px]">
        <MenuBar />
        <div className="px-2">
          {data.showcase && <ShowcaseNote />}
          <Window
            title={t.mix.title(data.mix.number, when)}
            right={
              <span aria-label={t.mix.playersOf10(count)}>
                {count}
                <span className="text-dim">/10</span>
              </span>
            }
          >
            <StatusLine state={state} />

            {state === "lobby" && <Lobby />}

            {state === "voting" && (
              <div className="mt-2.5">
                <Tabs
                  label={t.variants.aria}
                  value={variantNo}
                  onChange={setVariantNo}
                  items={mix.variants.map((v) => ({
                    value: v.number,
                    label: (
                      <>
                        {t.variants.variant(v.number)}{" "}
                        <span className="text-gold font-bold">{v.votes}</span>
                      </>
                    ),
                  }))}
                />
                <Sheet>
                  <VariantBody
                    variant={variant}
                    focusId={focusId}
                    onFocus={setFocusId}
                  />
                  <Tally />
                  {data.viewerIsAdmin && (
                    <div className="mt-2.5">
                      <AdminPanel state="voting" />
                    </div>
                  )}
                </Sheet>
              </div>
            )}

            {state === "locked" && <Locked />}
            {state === "played" && <Played />}
          </Window>
          <Quip state={state} />
        </div>
        <ActionBar state={state} variantNo={variantNo} />
      </div>
    </MixContext.Provider>
  );
}

function ShowcaseNote() {
  const t = useT();
  return (
    <Well className="mb-2 px-2 py-1.5 text-[11px]">
      <p className="text-gold font-bold">{t.showcase.title}</p>
      <ul className="text-dim mt-0.5 space-y-0.5">
        {t.showcase.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </Well>
  );
}

function MenuBar() {
  const { data, me } = useMix();
  return (
    <nav className="flex items-center gap-1 px-2.5 pt-2 pb-2 text-[12px]">
      <Link href="/" className="text-gold font-bold tracking-wide no-underline">
        mixer
      </Link>
      <ChevronRight className="text-dim size-3 shrink-0" aria-hidden />
      <a href="#" className="text-text truncate no-underline hover:underline">
        {data.mix.group}
      </a>
      <BackgroundToggle className="ml-auto" />
      <LanguageToggle className="ml-2" />
      <span className="text-dim ml-3 flex items-center gap-1.5">
        {me.name}
        <Avatar player={me} size={18} />
      </span>
    </nav>
  );
}

function StatusLine({ state }: { state: MixState }) {
  const { data, lobby, waitingFor, result, winner } = useMix();
  const t = useT();
  const voted = data.variants.reduce((s, v) => s + v.votes, 0);
  const text = {
    lobby: <>{t.status.lobby(10 - lobby.length)}</>,
    voting: (
      <>
        {t.status.voting(voted)} <b className="text-text">{waitingFor.name}</b>
      </>
    ),
    locked: (
      <>
        {t.status.lockedBefore}{" "}
        <b className="text-text">{t.variants.variant(winner.number)}</b>{" "}
        {t.status.lockedAfter}
      </>
    ),
    played: <>{t.status.played(result.maps.length, result.source)}</>,
  }[state];
  return (
    <Well className="text-dim flex items-center gap-1.5 px-2 py-1.5 text-[11px]">
      <span
        aria-hidden
        className={cn(
          "size-[7px] shrink-0",
          state === "locked" || state === "played" ? "bg-dim" : "bg-gold",
        )}
      />
      <span className="min-w-0">{text}</span>
    </Well>
  );
}

function Avatar({ player, size = 20 }: { player: Player; size?: number }) {
  if (!player.avatar)
    return (
      <span
        aria-hidden
        style={{ width: size, height: size }}
        className="border-lo bg-well inline-block shrink-0 border"
      />
    );
  return (
    <Image
      src={player.avatar}
      alt=""
      width={size}
      height={size}
      unoptimized
      loading="eager"
      className="border-lo shrink-0 border"
    />
  );
}

function PlayerRow({
  player,
  index,
  joinedAt,
  selected,
  onSelect,
}: {
  player: Player;
  index?: number;
  /** Join time (lobby tooltip); the lobby lists players in join order. */
  joinedAt?: string;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const { skill } = useMix();
  const t = useT();
  const Tag = onSelect ? "button" : "div";
  return (
    <Tag
      onClick={onSelect}
      title={joinedAt && t.lists.joined(joinedAt)}
      aria-pressed={onSelect ? selected : undefined}
      className={cn(
        "border-row grid w-full grid-cols-[1fr_46%] items-center gap-2 border-b px-1.5 py-1 text-left",
        selected ? "bg-gold-deep text-white" : onSelect && "hover:bg-hover",
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        {index !== undefined && (
          <span className="text-dim w-4 shrink-0 text-right text-[11px]">
            {index}
          </span>
        )}
        <Avatar player={player} />
        <span className="truncate">{player.name}</span>
        {player.level > 0 && (
          <span
            className={cn("text-[10px]", selected ? "text-white" : "text-dim")}
          >
            {player.level}
          </span>
        )}
      </span>
      <SkillBar value={skill(player)} selected={selected} />
    </Tag>
  );
}

function Lobby() {
  const { lobby } = useMix();
  const t = useT();
  const slots: ((typeof lobby)[number] | null)[] = [
    ...lobby,
    ...Array(10 - lobby.length).fill(null),
  ];
  return (
    <Well className="mt-2.5">
      <ListHead>
        <span className="flex-1 pl-6">{t.lists.playerJoinOrder}</span>
        <span className="w-[46%]">{t.lists.skill}</span>
      </ListHead>
      <div className="md:divide-row md:grid md:grid-flow-col md:grid-cols-2 md:grid-rows-5 md:divide-x">
        {slots.map((p, i) =>
          p ? (
            <PlayerRow
              key={p.player.steamId}
              player={p.player}
              index={i + 1}
              joinedAt={p.joinedAt}
            />
          ) : (
            <div
              key={`free-${i}`}
              className="border-row text-dim flex items-center gap-2 border-b px-1.5 py-1"
            >
              <span className="w-4 text-right text-[11px]">{i + 1}</span>
              <span className="border-hi/60 inline-block size-5 border border-dashed" />
              <span className="italic">{t.lists.freeSlot}</span>
            </div>
          ),
        )}
      </div>
    </Well>
  );
}

function TeamList({
  label,
  team,
  order,
  focusId,
  onFocus,
}: {
  label: string;
  team: Player[];
  /** `skill` in variant tabs (compare teams), `join` in the locked lineup (D28). */
  order: "skill" | "join";
  focusId?: string;
  onFocus?: (id: string) => void;
}) {
  const { avg, byJoinOrder, skill } = useMix();
  const sorted =
    order === "join"
      ? byJoinOrder(team)
      : [...team].sort((a, b) => skill(b) - skill(a));
  return (
    <>
      <div className="bg-window text-gold flex justify-between px-1.5 py-1 text-[11px] font-bold tracking-[0.05em] uppercase">
        {label}
        <span className="text-text">{avg(team)}</span>
      </div>
      {sorted.map((p) => (
        <PlayerRow
          key={p.steamId}
          player={p}
          selected={focusId === p.steamId}
          onSelect={onFocus && (() => onFocus(p.steamId))}
        />
      ))}
    </>
  );
}

/** Team A and Team B: stacked on phones, side by side from md. */
function Teams({
  teamA,
  teamB,
  order,
  focusId,
  onFocus,
}: {
  teamA: Player[];
  teamB: Player[];
  order: "skill" | "join";
  focusId?: string;
  onFocus?: (id: string) => void;
}) {
  const t = useT();
  return (
    <div className="grid gap-2.5 md:grid-cols-2">
      {(
        [
          [t.lists.teamA, teamA],
          [t.lists.teamB, teamB],
        ] as const
      ).map(([label, team]) => (
        <Well key={label}>
          <ListHead>
            <span className="flex-1">
              {t.lists.player}
              {onFocus ? t.lists.tapForDetails : ""}
            </span>
            <span className="w-[46%]">{t.lists.skill}</span>
          </ListHead>
          <TeamList
            label={label}
            team={team}
            order={order}
            focusId={focusId}
            onFocus={onFocus}
          />
        </Well>
      ))}
    </div>
  );
}

function Odds({
  avgA,
  avgB,
  winProbA,
}: {
  avgA: number;
  avgB: number;
  winProbA: number;
}) {
  const t = useT();
  const pa = Math.round(winProbA * 100);
  return (
    <div className="mb-2 flex items-end justify-between">
      <div>
        <div className="text-dim text-[11px]">{t.odds.winChance}</div>
        <div className="text-gold text-[24px] leading-none font-bold tracking-[-0.02em]">
          {pa}
          <span className="text-text"> : {100 - pa}</span>
        </div>
      </div>
      <div className="text-right">
        <div className="text-dim text-[11px]">{t.odds.avgS}</div>
        <div>
          <b>{Math.round(avgA)}</b>{" "}
          <span className="text-dim">{t.odds.vs}</span>{" "}
          <b>{Math.round(avgB)}</b>
        </div>
      </div>
    </div>
  );
}

function VariantBody({
  variant,
  focusId,
  onFocus,
}: {
  variant: Variant;
  focusId: string;
  onFocus: (id: string) => void;
}) {
  const { data } = useMix();
  const everyone = [...variant.teamA, ...variant.teamB];
  const focused = everyone.find((p) => p.steamId === focusId) ?? everyone[0];
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-3">
      <div>
        <Odds
          avgA={variant.engine.avgA}
          avgB={variant.engine.avgB}
          winProbA={variant.engine.winProbA}
        />
        <Labels variant={variant} />
        <Teams
          teamA={variant.teamA}
          teamB={variant.teamB}
          order="skill"
          focusId={focused.steamId}
          onFocus={onFocus}
        />
      </div>
      <div className="lg:[&>details:first-child]:mt-0">
        <Explanation player={focused} everyone={everyone} variant={variant} />
        {data.leetify && <LeetifyCard player={focused} />}
      </div>
    </div>
  );
}

/**
 * Variant labels (D28): engine's "Most even" / "Fresh split" plus "Leading" from the vote count.
 * The row keeps its height when a variant has no labels, so the teams never jump between tabs.
 */
function Labels({ variant }: { variant: Variant }) {
  const { variants } = useMix();
  const t = useT();
  const top = Math.max(...variants.map((v) => v.votes));
  const LABELS = { "most-even": t.variants.mostEven, fresh: t.variants.fresh };
  const leading =
    variant.votes === top &&
    variants.filter((v) => v.votes === top).length === 1;
  const labels = [
    ...variant.engine.labels.map((l) => LABELS[l]),
    ...(leading ? [t.variants.leading] : []),
  ];
  return (
    <div className="mb-2 flex h-[19px] flex-wrap gap-1 overflow-hidden">
      {labels.map((l) => (
        <Badge key={l}>{l}</Badge>
      ))}
    </div>
  );
}

const LEETIFY_ROWS = 8;
const LEETIFY_COLS = "grid-cols-[3rem_1fr_3rem_5.6rem]";

/**
 * Leetify preview (M3-2) as an old-client property window: the player's FACEIT matches in the
 * window the server fetched live (never stored), each with its Leetify Rating exactly as Leetify shows it. Nothing is averaged or
 * recomputed (Leetify terms). Fixed height: always LEETIFY_ROWS rows, so switching players never
 * moves the page.
 */
function LeetifyCard({ player }: { player: Player }) {
  const { data } = useMix();
  const t = useT();
  const lw = data.leetify!;
  const found = lw.matches[player.steamId];
  const matches = found ?? [];
  const span = dates(lw.window.from, lw.window.to);
  const won = matches.filter((m) => m.score[0] > m.score[1]).length;
  const shown = matches.slice(0, LEETIFY_ROWS);
  const rating = (n: number) =>
    n > 0 ? `+${n.toFixed(2)}` : n < 0 ? `−${Math.abs(n).toFixed(2)}` : "0.00";
  return (
    <details open className="group mt-2.5">
      <summary className="bevel bg-window hover:bg-hover flex cursor-pointer list-none items-center justify-between px-2 py-1.5 select-none">
        <span className="truncate">
          {t.leetify.title(lw.window.live)}{" "}
          <b className="text-text">{player.name}</b>
        </span>
        <ChevronDown
          aria-hidden
          className="text-dim size-3.5 shrink-0 group-open:rotate-180"
        />
      </summary>
      <Well className="text-dim flex h-[42px] items-center gap-1.5 px-2 text-[11px]">
        <span aria-hidden className="bg-gold size-[7px] shrink-0" />
        {found === null ? (
          <span>{t.leetify.notAnswering(player.name)}</span>
        ) : matches.length === 0 ? (
          <span>{t.leetify.none(span)}</span>
        ) : (
          <span>
            <b className="text-text">{matches.length}</b>{" "}
            {t.leetify.matches(span)} ·{" "}
            <b className="text-text">
              {t.leetify.wl(won, matches.length - won)}
            </b>{" "}
            · {t.leetify.liveNotStored}
          </span>
        )}
      </Well>
      <div
        aria-label={t.leetify.resultsAria}
        className="mt-1.5 flex h-[16px] flex-wrap content-start gap-0.5 overflow-hidden px-0.5"
      >
        {matches.map((m, i) => (
          <span
            key={i}
            title={`${m.map} ${m.score[0]}:${m.score[1]}`}
            className={cn(
              "size-[7px]",
              m.score[0] > m.score[1] ? "bg-gold" : "bg-lo",
            )}
          />
        ))}
      </div>
      <Well className="mt-1.5">
        <div
          className={cn(
            "border-lo bg-window text-dim grid gap-x-2 border-b px-1.5 py-1 text-[10px] tracking-[0.06em] uppercase",
            LEETIFY_COLS,
          )}
        >
          <span>{t.leetify.date}</span>
          <span>{t.leetify.map}</span>
          <span className="text-right">{t.leetify.score}</span>
          <span className="text-right">{t.leetify.rating}</span>
        </div>
        <div className="relative">
          {Array.from({ length: LEETIFY_ROWS }, (_, i) => {
            const m = shown[i];
            return (
              <div
                key={i}
                className={cn(
                  "border-row grid h-[27px] items-center gap-x-2 border-b px-1.5",
                  LEETIFY_COLS,
                )}
              >
                {m && (
                  <>
                    <span className="text-dim text-[11px]">
                      {m.finishedAt.slice(8, 10)}.{m.finishedAt.slice(5, 7)}
                    </span>
                    <span className="truncate">{m.map.replace("de_", "")}</span>
                    <span className="text-right">
                      <b
                        className={
                          m.score[0] > m.score[1] ? "text-gold" : "text-text"
                        }
                      >
                        {m.score[0]}
                      </b>
                      <span className="text-dim">:</span>
                      {m.score[1]}
                    </span>
                    <b className="text-right">{rating(m.leetifyRating)}</b>
                  </>
                )}
              </div>
            );
          })}
          {matches.length === 0 && (
            <p className="text-dim absolute inset-0 grid place-items-center px-6 text-center text-[11px] italic">
              {t.leetify.placeholder(player.name)}
            </p>
          )}
        </div>
        <p className="text-dim h-[24px] px-1.5 py-1 text-[11px]">
          {matches.length > shown.length &&
            t.leetify.more(matches.length - shown.length)}
        </p>
      </Well>
      <a
        href="https://leetify.com/"
        target="_blank"
        rel="noreferrer"
        className="bevel bg-sheet text-text mt-1.5 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] font-bold no-underline"
      >
        Data Provided by Leetify
        <ExternalLink className="size-3" aria-hidden />
      </a>
    </details>
  );
}

const ddmm = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
/** "25.08–24.09": a mix's window, always ending at the mix, never at today. */
const dates = (from: string, to: string) => `${ddmm(from)}–${ddmm(to)}`;

const signed = (n: number) =>
  n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0";

/**
 * "How was this calculated?" for the focused player. Every player's text is rendered in the same
 * grid cell and only the focused one is visible, so the panel is always as tall as the longest
 * explanation and the page never jumps when you tap through players.
 */
function Explanation({
  player,
  everyone,
  variant,
}: {
  player: Player;
  everyone: Player[];
  variant: Variant;
}) {
  const t = useT();
  return (
    <details open className="group mt-2.5">
      <summary className="bevel bg-window hover:bg-hover flex cursor-pointer list-none items-center justify-between px-2 py-1.5 select-none">
        <span>
          {t.explain.title} <b className="text-text">{player.name}</b>
        </span>
        <ChevronDown
          aria-hidden
          className="text-dim size-3.5 group-open:rotate-180"
        />
      </summary>
      <Well className="grid p-2">
        {everyone.map((p) => (
          <div
            key={p.steamId}
            aria-hidden={p.steamId !== player.steamId}
            className={cn(
              "[grid-area:1/1]",
              p.steamId !== player.steamId && "invisible",
            )}
          >
            <PlayerExplanation player={p} variant={variant} />
          </div>
        ))}
      </Well>
    </details>
  );
}

function PlayerExplanation({
  player,
  variant,
}: {
  player: Player;
  variant: Variant;
}) {
  const { data, explain, nameOf } = useMix();
  const t = useT();
  const x = explain(player);
  const w = x.weights;
  const c = x.contributions;
  const v = variant.engine;
  const config = data.config;
  const weighted = (weight: number, k: string) =>
    weight === 1 ? k : `${weight}·${k}`;
  const penalties = v.penalties.reduce((s, p) => s + p.pp, 0);
  const duos = [
    v.duos.top && ([true, v.duos.top] as const),
    v.duos.bottom && ([false, v.duos.bottom] as const),
  ].filter((d) => !!d);
  return (
    <>
      <p className="text-gold mb-1.5 text-[11px] font-bold">
        S = {weighted(w.elo, "E")} + {weighted(w.faceitForm, "F")} +{" "}
        {weighted(w.mixForm, "M")} + {weighted(w.activity, "A")} = {c.E}{" "}
        {[c.F, c.M, c.A].map((n) => (n < 0 ? `− ${-n} ` : `+ ${n} `))}= {x.S}
      </p>
      <Term
        k="E"
        name={t.explain.eName}
        value={c.E}
        note={
          x.eSource === "faceit"
            ? t.explain.eNote(player.level)
            : t.explain.eManual
        }
      />
      <Term
        k="F"
        name={t.explain.fName(config.form.windowDays)}
        value={signed(c.F)}
        note={formNote(x, config, t)}
      />
      <Term
        k="M"
        name={t.explain.mName(w.mixForm)}
        value={signed(c.M)}
        note={
          x.mix.status === "ok"
            ? t.explain.mNote({
                maps: x.mix.maps,
                player: x.mix.playerRating!.toFixed(2),
                group: x.mix.groupRating!.toFixed(2),
                shrunk: x.mix.shrunkRating!.toFixed(2),
                raw: signed(Math.round(x.mix.raw)),
                mult: x.mix.multiplier.toFixed(2),
                up: x.mix.direction === "up",
                elo: x.E,
                cap:
                  x.mix.clamped || x.mix.rawClamped
                    ? t.explain.capped(data.config.mix.max)
                    : "",
              })
            : t.explain.mNone
        }
      />
      <Term
        k="A"
        name={t.explain.aName(x.activity.windowDays)}
        value={signed(c.A)}
        note={activityNote(x, config, t)}
      />
      <p className="text-dim mt-2 text-[11px]">
        {t.explain.cost({
          imbalance: v.imbalance.toFixed(1),
          penalties,
          cost: v.cost.toFixed(1),
          rank: v.rank,
          of: data.candidateCount,
        })}{" "}
        {data.alwaysTogether.length === 0
          ? t.explain.noPairs
          : t.explain.pairs(
              data.alwaysTogether
                .map(([a, b]) => `${nameOf(a)} + ${nameOf(b)}`)
                .join(", "),
              data.config.pairSpread.maxExtraCost,
            )}
        {duos.map(([top, d]) => (
          <React.Fragment key={String(top)}>
            {" "}
            {t.explain.duo(
              top,
              nameOf(d.ids[0]),
              nameOf(d.ids[1]),
              d.split,
              d.mode,
            )}
          </React.Fragment>
        ))}
      </p>
    </>
  );
}

function formNote(x: SkillBreakdown, config: MixViewData["config"], t: Dict) {
  const f = x.form;
  const cfg = config.form;
  if (f.status === "no-recent-matches")
    return t.explain.fNoRecent(dates(f.windowFrom, f.windowTo));
  if (f.status === "thin-baseline")
    return t.explain.fThin(f.matches, f.baselineMatches, cfg.minBaseline);
  if (f.status === "invalid-baseline") return t.explain.fInvalid;
  const cap = (hit: boolean) => (hit ? t.explain.capped(cfg.max) : "");
  return t.explain.fParts({
    n: f.matches,
    span: dates(f.windowFrom, f.windowTo),
    window: f.windowRating!.toFixed(2),
    base: f.baselineRating!.toFixed(2),
    baseN: f.baselineMatches,
    ratio: f.ratio!.toFixed(2),
    shrunk: f.shrunkRatio!.toFixed(2),
    k: cfg.shrinkK,
    beta: cfg.beta,
    delta: (f.shrunkRatio! - 1).toFixed(3),
    raw: signed(Math.round(f.raw)),
    rawCap: cap(f.rawClamped),
    mult: f.multiplier.toFixed(2),
    up: f.direction === "up",
    elo: x.E,
    cap: cap(f.clamped),
  });
}

function activityNote(
  x: SkillBreakdown,
  config: MixViewData["config"],
  t: Dict,
) {
  const a = x.activity;
  if (a.status === "no-data") return t.explain.aNoData;
  const anchors = config.activity.anchors;
  const [first, top] = [anchors[0], anchors[anchors.length - 1]];
  return t.explain.aNote({
    sessions: a.sessions,
    span: dates(a.windowFrom, a.windowTo),
    last:
      a.sessions === 0 && a.lastPlayedAt ? a.lastPlayedAt.slice(0, 10) : null,
    neutral: anchors.find((x) => x.value === 0)?.sessions,
    worst: signed(first.value),
    topSessions: top.sessions,
    top: signed(top.value),
  });
}

function Term({
  k,
  name,
  value,
  note,
}: {
  k: string;
  name: string;
  value: React.ReactNode;
  note?: string;
}) {
  return (
    <div className="border-sheet grid grid-cols-[1.25rem_1fr_auto] items-baseline gap-x-1.5 border-b border-dotted py-1">
      <b className="text-gold">{k}</b>
      <span>{name}</span>
      <b>{value}</b>
      {note && (
        <p className="text-dim col-start-2 col-end-4 text-[11px]">{note}</p>
      )}
    </div>
  );
}

/** Public votes: who voted for which variant, and who has not voted yet. */
function Tally() {
  const { variants, me, waitingFor, data } = useMix();
  const t = useT();
  const byId = new Map(data.players.map((p) => [p.steamId, p]));
  const top = Math.max(...variants.map((v) => v.votes));
  return (
    <section aria-label={t.tally.aria} className="mt-2.5">
      <div className="grid grid-cols-3 gap-1.5">
        {variants.map((v) => (
          <Well key={v.number} className="min-w-0">
            <div className="bg-window text-dim border-lo flex items-baseline justify-between border-b px-1.5 py-1 text-[10px] tracking-[0.06em] uppercase">
              <span className="truncate">{t.variants.variant(v.number)}</span>
              <b
                className={cn(
                  "text-[13px] tracking-normal",
                  v.votes === top && top > 0 ? "text-gold" : "text-text",
                )}
              >
                {v.votes}
              </b>
            </div>
            <ul className="min-h-[104px] py-0.5">
              {v.voters.map((id) => {
                const p = byId.get(id)!;
                return (
                  <li
                    key={id}
                    className={cn(
                      "flex items-center gap-1.5 px-1.5 py-0.5 text-[11px]",
                      id === me.steamId && "text-gold font-bold",
                    )}
                  >
                    <Avatar player={p} size={14} />
                    <span className="truncate">
                      {id === me.steamId ? t.tally.you : p.name}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Well>
        ))}
      </div>
      <p className="text-dim mt-1.5 px-0.5 text-[11px]">
        {t.tally.publicNotVoted} <b className="text-text">{waitingFor.name}</b>
      </p>
    </section>
  );
}

function Locked() {
  const { winner, outcome, real, data } = useMix();
  const t = useT();
  const tie = outcome.tied.length > 1;
  return (
    <div className="mt-2.5 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-3">
      <div>
        <Well className="mb-2 flex items-baseline gap-2 px-2 py-1.5">
          <b className="text-gold text-[16px]">{t.locked.won(winner.number)}</b>
          <span className="text-dim text-[11px]">
            {tie
              ? t.locked.tie(
                  winner.votes,
                  outcome.tied
                    .filter((n) => n !== winner.number)
                    .join(t.locked.and),
                )
              : t.locked.ofVotes(winner.votes)}
          </span>
        </Well>
        <Odds
          avgA={winner.engine.avgA}
          avgB={winner.engine.avgB}
          winProbA={winner.engine.winProbA}
        />
        <Teams teamA={winner.teamA} teamB={winner.teamB} order="join" />
      </div>
      <div className="mt-2.5 space-y-2.5 lg:mt-0">
        <Well className="p-2">
          <p className="text-gold mb-1 flex items-center gap-1.5 font-bold">
            <Lock className="size-3.5" aria-hidden /> {t.locked.howToPlay}
          </p>
          <ol className="text-dim list-decimal space-y-0.5 pl-5">
            {t.locked.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </Well>
        {real && (
          <Well className="p-2 text-[11px]">
            <p className="text-gold mb-1 font-bold">{t.locked.realTitle}</p>
            <p className="text-dim">
              {t.locked.realText(
                `${Math.round(real.winProbA * 100)} : ${100 - Math.round(real.winProbA * 100)}`,
                real.rank,
              )}
            </p>
            <p className="text-dim mt-1">
              A: {real.teamA.map((p) => p.name).join(", ")}
              <br />
              B: {real.teamB.map((p) => p.name).join(", ")}
            </p>
          </Well>
        )}
        {data.viewerIsAdmin && <AdminPanel state="locked" />}
      </div>
    </div>
  );
}

/**
 * Group admin controls (D33). Voting never closes by itself on the 10th vote (a misclick could not
 * be undone): it closes when an admin says so, or 60 minutes after the last vote once all ten
 * have voted. Admins can reopen it until the match starts.
 */
function AdminPanel({ state }: { state: "voting" | "locked" }) {
  const t = useT();
  return (
    <Well className="p-2 text-[11px]">
      <p className="text-gold mb-1 font-bold">{t.admin.title}</p>
      <p className="text-dim mb-2">
        {state === "voting" ? t.admin.voting : t.admin.locked}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {state === "voting" ? (
          <>
            <VButton className="px-2 py-1.5 text-[11px]">
              {t.admin.close}
            </VButton>
            <VButton className="px-2 py-1.5 text-[11px]">
              {t.admin.reroll}
            </VButton>
            <VButton className="px-2 py-1.5 text-[11px]">
              {t.admin.proxy}
            </VButton>
          </>
        ) : (
          <>
            <VButton className="px-2 py-1.5 text-[11px]">
              {t.admin.reopen}
            </VButton>
            <VButton className="px-2 py-1.5 text-[11px]">
              {t.admin.result}
            </VButton>
          </>
        )}
      </div>
    </Well>
  );
}

function Played() {
  const { result, data } = useMix();
  const t = useT();
  const [pick, setPick] = React.useState<string | null>(null);
  const wonA = result.maps.filter((m) => m.a > m.b).length;
  const wonB = result.maps.length - wonA;
  const map = result.maps.find((m) => m.map === pick);
  const rounds = result.maps.reduce((s, m) => s + m.a + m.b, 0);
  return (
    <div className="mt-2.5 lg:grid lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-3">
      <Well className="px-2 pt-2 pb-3 text-center lg:py-6">
        <div className="text-dim text-[11px]">{t.played.mapsWon}</div>
        <div className="text-gold text-[64px] leading-[1.05] font-bold tracking-[-0.04em]">
          {wonA}
          <span className="text-dim"> : </span>
          <span className="text-text">{wonB}</span>
        </div>
        <div
          role="group"
          aria-label={t.played.scoreboardFor}
          className="mt-1 flex flex-wrap justify-center gap-1.5"
        >
          <MapChip on={!map} onClick={() => setPick(null)}>
            {t.played.allMaps}
          </MapChip>
          {result.maps.map((m) => (
            <MapChip key={m.map} on={m === map} onClick={() => setPick(m.map)}>
              {m.map} <Figure win={m.a > m.b}>{m.a}</Figure>
              <span className="text-dim">:</span>
              <Figure win={m.b > m.a}>{m.b}</Figure>
            </MapChip>
          ))}
        </div>
      </Well>
      <div>
        {data.showcase && (
          <p className="text-gold mt-2.5 mb-1 px-0.5 text-[11px] font-bold lg:mt-0">
            {t.played.realNote}
          </p>
        )}
        <p className="text-dim mt-2.5 mb-1 px-0.5 text-[11px] lg:mt-0">
          {map
            ? t.played.mapLine(
                map.map,
                map.a,
                map.b,
                map.a > map.b ? "A" : "B",
                map.a + map.b,
              )
            : t.played.allLine(result.maps.length, rounds)}
        </p>
        <Scoreboard lines={map ? map.lines : result.all} />
      </div>
    </div>
  );
}

/** Map score chip that doubles as the scoreboard picker; pressed = shown below. */
function MapChip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "group/chip bevel px-2 py-1 text-[11px]",
        on
          ? "border-t-lo border-r-hi border-b-hi border-l-lo bg-gold-deep text-white"
          : "bg-window hover:bg-hover",
      )}
    >
      {children}
    </button>
  );
}

function Figure({ win, children }: { win: boolean; children: number }) {
  return (
    <b
      className={cn(
        "group-aria-pressed/chip:text-white",
        win ? "text-gold" : "text-text",
      )}
    >
      {children}
    </b>
  );
}

const SCORE_COLS = "grid-cols-[1fr_repeat(4,2.3rem)_2.8rem]";

function Scoreboard({ lines }: { lines: Line[] }) {
  const t = useT();
  const best = Math.max(...lines.map((l) => l.rating));
  return (
    <Well>
      <div
        className={cn(
          "border-lo bg-window text-dim grid border-b px-1.5 py-1 text-[10px] tracking-[0.06em] uppercase",
          SCORE_COLS,
        )}
      >
        <span>{t.lists.player}</span>
        <span className="text-right">K</span>
        <span className="text-right">A</span>
        <span className="text-right">D</span>
        <span className="text-right">ADR</span>
        <span className="text-right" title={t.played.mr}>
          MR
        </span>
      </div>
      {(["A", "B"] as const).map((team) => (
        <React.Fragment key={team}>
          <div className="bg-window text-gold px-1.5 py-1 text-[11px] font-bold tracking-[0.05em] uppercase">
            {t.lists.team(team)}
          </div>
          {lines
            .filter((l) => l.team === team)
            .sort((x, y) => y.rating - x.rating)
            .map((r) => (
              <div
                key={r.player.steamId}
                className={cn(
                  "border-row grid items-center border-b px-1.5 py-1",
                  SCORE_COLS,
                  r.rating === best && "bg-row",
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Avatar player={r.player} />
                  <span className="truncate">{r.player.name}</span>
                </span>
                <span className="text-right">{r.k}</span>
                <span className="text-dim text-right">{r.a}</span>
                <span className="text-right">{r.d}</span>
                <span className="text-right">{r.adr.toFixed(0)}</span>
                <b
                  className={cn(
                    "text-right",
                    r.rating >= 1 ? "text-gold" : "text-text",
                  )}
                >
                  {r.rating.toFixed(2)}
                </b>
              </div>
            ))}
        </React.Fragment>
      ))}
    </Well>
  );
}

function Quip({ state }: { state: MixState }) {
  const { result, waitingFor, skill } = useMix();
  const t = useT();
  const text = {
    lobby: t.quips.lobby,
    voting: t.quips.voting(waitingFor.name),
    locked: t.quips.locked,
    played: playedQuip(result.all, skill, t),
  }[state];
  return (
    <p className="text-dim mt-2 px-2 text-center text-[11px] italic">{text}</p>
  );
}

/**
 * One line about the evening, picked from what happened. "Carried" only when the best player was
 * not one of the three strongest on paper; more lines come with the awards (M2-8).
 */
function playedQuip(
  all: Line[],
  skill: (p: Player) => number,
  t: Dict,
): string {
  if (all.length === 0) return "";
  const byRating = [...all].sort((a, b) => b.rating - a.rating);
  const bySkill = [...all].sort((a, b) => skill(b.player) - skill(a.player));
  const mvp = byRating[0];
  const worst = byRating[byRating.length - 1];
  const paperRank = bySkill.findIndex((l) => l === mvp) + 1;
  if (paperRank > 3) return t.quips.carried(mvp.player.name);
  if (bySkill.slice(0, 3).includes(worst))
    return t.quips.paper(mvp.player.name, worst.player.name);
  return t.quips.boring(mvp.player.name);
}

function ActionBar({
  state,
  variantNo,
}: {
  state: MixState;
  variantNo: number;
}) {
  const { myVote } = useMix();
  const t = useT();
  return (
    <div className="border-hi bg-window fixed inset-x-0 bottom-0 border-t px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-[444px] gap-2 md:max-w-[744px] lg:max-w-[1164px] lg:justify-end lg:[&>button]:flex-none lg:[&>button]:basis-52">
        {state === "lobby" && (
          <>
            <VButton className="flex-1">{t.actions.share}</VButton>
            <VButton primary className="flex-[2]">
              {t.actions.join}
            </VButton>
          </>
        )}
        {state === "voting" && (
          <>
            <VButton className="flex-1">{t.actions.share}</VButton>
            <VButton
              primary
              className="flex-[2]"
              disabled={myVote === variantNo}
            >
              {myVote === variantNo
                ? t.actions.yourVote(variantNo)
                : myVote === null
                  ? t.actions.vote(variantNo)
                  : t.actions.moveVote(variantNo)}
            </VButton>
          </>
        )}
        {state === "locked" && (
          <>
            <VButton className="flex-1">{t.actions.share}</VButton>
            <VButton
              primary
              className="flex flex-[2] items-center justify-center gap-1.5"
            >
              {t.actions.faceitClub}{" "}
              <ExternalLink className="size-3.5" aria-hidden />
            </VButton>
          </>
        )}
        {state === "played" && (
          <>
            <VButton className="flex-1">{t.actions.uploadDemo}</VButton>
            <VButton primary className="flex-[2]">
              {t.actions.fullScoreboard}
            </VButton>
          </>
        )}
      </div>
    </div>
  );
}
