"use client";

// Mix page in the VGUI world. Design preview only: data comes from lib/mock/mix.ts, buttons do
// nothing yet. Real data and actions arrive with M1-5 (lobby), M1-6 (variants), M1-7 (voting).

import * as React from "react";
import Image from "next/image";
import { ChevronDown, ChevronRight, ExternalLink, Lock } from "lucide-react";
import {
  ListHead,
  Sheet,
  SkillBar,
  Tabs,
  VButton,
  Well,
  Window,
} from "@/components/vgui";
import {
  byJoinOrder,
  candidateCount,
  config,
  explain,
  lobby,
  mix,
  players,
  result,
  skill,
  variants,
  type MapLine,
  type MockPlayer,
  type MockVariant,
} from "@/lib/mock/mix";
import { cn } from "@/lib/utils";

export type MixState = "lobby" | "voting" | "locked" | "played";

const avg = (team: MockPlayer[]) =>
  Math.round(team.reduce((s, p) => s + skill(p), 0) / team.length);

export function MixView({ state }: { state: MixState }) {
  const [variantNo, setVariantNo] = React.useState(1);
  const [focusId, setFocusId] = React.useState(mix.me.steamId);
  const variant = variants.find((v) => v.number === variantNo)!;
  const count = state === "lobby" ? lobby.length : 10;

  return (
    <div className="mx-auto flex w-full max-w-[460px] flex-1 flex-col pb-[76px] md:max-w-[520px]">
      <MenuBar />
      <div className="px-2">
        <Window
          title={`Mix #${mix.number} · ${mix.when}`}
          right={
            <span aria-label={`${count} of 10 players`}>
              {count}
              <span className="text-dim">/10</span>
            </span>
          }
        >
          <StatusLine
            state={state}
            variant={variant}
            lobbyCount={lobby.length}
          />

          {state === "lobby" && <Lobby />}

          {state === "voting" && (
            <div className="mt-2.5">
              <Tabs
                label="Variants"
                value={variantNo}
                onChange={setVariantNo}
                items={variants.map((v) => ({
                  value: v.number,
                  label: (
                    <>
                      Variant {v.number}{" "}
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
              </Sheet>
            </div>
          )}

          {state === "locked" && <Locked variant={variants[0]} />}
          {state === "played" && <Played />}
        </Window>
        <Quip state={state} />
      </div>
      <ActionBar state={state} variantNo={variantNo} />
    </div>
  );
}

function MenuBar() {
  return (
    <nav className="flex items-center gap-1 px-2.5 pt-2 pb-2 text-[12px]">
      <span className="text-gold font-bold tracking-wide">mixer</span>
      <ChevronRight className="text-dim size-3" aria-hidden />
      <a href="#" className="text-text truncate no-underline hover:underline">
        {mix.group}
      </a>
      <span className="text-dim ml-auto flex items-center gap-1.5">
        {mix.me.name}
        <Avatar player={mix.me} size={18} />
      </span>
    </nav>
  );
}

function StatusLine({
  state,
  variant,
  lobbyCount,
}: {
  state: MixState;
  variant: MockVariant;
  lobbyCount: number;
}) {
  const text = {
    lobby: <>Open · {10 - lobbyCount} slots left · balancing starts at 10/10</>,
    voting: (
      <>
        Voting · 9 of 10 voted · waiting for{" "}
        <b className="text-text">{mix.waitingFor.name}</b>
      </>
    ),
    locked: <>Lineup locked · Variant {variant.number} won with 4 votes</>,
    played: (
      <>
        Played · {result.maps.length} maps · result from {result.source}
      </>
    ),
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

function Avatar({ player, size = 20 }: { player: MockPlayer; size?: number }) {
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
  player: MockPlayer;
  index?: number;
  /** Join time (lobby tooltip); the lobby lists players in join order. */
  joinedAt?: string;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const Tag = onSelect ? "button" : "div";
  return (
    <Tag
      onClick={onSelect}
      title={joinedAt && `Joined ${joinedAt}`}
      aria-pressed={onSelect ? selected : undefined}
      className={cn(
        "border-row grid w-full grid-cols-[1fr_46%] items-center gap-2 border-b px-1.5 py-1 text-left",
        selected ? "bg-gold-deep text-white" : onSelect && "hover:bg-row",
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
        <span
          className={cn("text-[10px]", selected ? "text-white" : "text-dim")}
        >
          {player.level}
        </span>
      </span>
      <SkillBar value={skill(player)} selected={selected} />
    </Tag>
  );
}

function Lobby() {
  const slots: ((typeof lobby)[number] | null)[] = [
    ...lobby,
    ...Array(10 - lobby.length).fill(null),
  ];
  return (
    <Well className="mt-2.5">
      <ListHead>
        <span className="flex-1 pl-6">Player · join order</span>
        <span className="w-[46%]">Skill S</span>
      </ListHead>
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
            <span className="italic">free slot</span>
          </div>
        ),
      )}
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
  team: MockPlayer[];
  /** `skill` in variant tabs (compare teams), `join` in the locked lineup (D28). */
  order: "skill" | "join";
  focusId?: string;
  onFocus?: (id: string) => void;
}) {
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

function Odds({ variant }: { variant: MockVariant }) {
  const a = Math.round(variant.engine.avgA);
  const b = Math.round(variant.engine.avgB);
  const pa = Math.round(variant.engine.winProbA * 100);
  return (
    <div className="mb-2 flex items-end justify-between">
      <div>
        <div className="text-dim text-[11px]">Win chance A : B</div>
        <div className="text-gold text-[24px] leading-none font-bold tracking-[-0.02em]">
          {pa}
          <span className="text-text"> : {100 - pa}</span>
        </div>
      </div>
      <div className="text-right">
        <div className="text-dim text-[11px]">Avg S</div>
        <div>
          <b>{a}</b> <span className="text-dim">vs</span> <b>{b}</b>
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
  variant: MockVariant;
  focusId: string;
  onFocus: (id: string) => void;
}) {
  const everyone = [...variant.teamA, ...variant.teamB];
  const focused = everyone.find((p) => p.steamId === focusId) ?? everyone[0];
  return (
    <>
      <Odds variant={variant} />
      <Well>
        <ListHead>
          <span className="flex-1">Player · tap for details</span>
          <span className="w-[46%]">Skill S</span>
        </ListHead>
        <TeamList
          label="Team A"
          team={variant.teamA}
          order="skill"
          focusId={focused.steamId}
          onFocus={onFocus}
        />
        <TeamList
          label="Team B"
          team={variant.teamB}
          order="skill"
          focusId={focused.steamId}
          onFocus={onFocus}
        />
      </Well>
      <Explanation player={focused} variant={variant} />
    </>
  );
}

const signed = (n: number) =>
  n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0";
const nameOf = (steamId: string) =>
  Object.values(players).find((p) => p.steamId === steamId)?.name ?? steamId;

function Explanation({
  player,
  variant,
}: {
  player: MockPlayer;
  variant: MockVariant;
}) {
  const x = explain(player);
  const w = x.weights;
  const c = x.contributions;
  const v = variant.engine;
  const weighted = (weight: number, k: string) =>
    weight === 1 ? k : `${weight}·${k}`;
  const penalties = v.penalties.reduce((s, p) => s + p.pp, 0);
  const duos = [
    v.duos.top && (["Top", v.duos.top] as const),
    v.duos.bottom && (["Bottom", v.duos.bottom] as const),
  ].filter((d) => !!d);
  return (
    <details open className="group mt-2.5">
      <summary className="bevel bg-window flex cursor-pointer list-none items-center justify-between px-2 py-1.5 select-none">
        <span>
          How was this calculated? <b className="text-text">{player.name}</b>
        </span>
        <ChevronDown
          aria-hidden
          className="text-dim size-3.5 group-open:rotate-180"
        />
      </summary>
      <Well className="p-2">
        <p className="text-gold mb-1.5 text-[11px] font-bold">
          S = {weighted(w.elo, "E")} + {weighted(w.faceitForm, "F")} +{" "}
          {weighted(w.mixForm, "M")} + {weighted(w.activity, "A")} = {c.E}{" "}
          {[c.F, c.M, c.A].map((n) => (n < 0 ? `− ${-n} ` : `+ ${n} `))}= {x.S}
        </p>
        <Term
          k="E"
          name="FACEIT ELO"
          value={c.E}
          note={
            x.eSource === "faceit"
              ? `Level ${player.level}, live from FACEIT`
              : "No FACEIT account: the group admin's manual ELO"
          }
        />
        <Term
          k="F"
          name={`FACEIT form, last ${config.form.windowDays} days`}
          value={signed(c.F)}
          note={formNote(x)}
        />
        <Term
          k="M"
          name={`Mix form${w.mixForm === 1 ? "" : ` · weight ${w.mixForm}`}`}
          value={signed(c.M)}
          note={
            x.mix.status === "ok"
              ? `${x.mix.maps} mix maps · Mixer Rating ${x.mix.playerRating!.toFixed(2)} vs group ${x.mix.groupRating!.toFixed(2)} → ${x.mix.shrunkRating!.toFixed(2)} after shrinkage`
              : "No mix maps with stats yet"
          }
        />
        <Term
          k="A"
          name={`Activity, last ${x.activity.windowDays} days`}
          value={signed(c.A)}
          note={activityNote(x)}
        />
        <p className="text-dim mt-2 text-[11px]">
          Variant cost: {v.imbalance.toFixed(1)} pp imbalance + {penalties} pp
          rule penalties = {v.cost.toFixed(1)}. Rank {v.rank} of{" "}
          {candidateCount} possible splits; the three cheapest distinct ones are
          shown.
          {duos.map(([label, d]) => (
            <React.Fragment key={label}>
              {" "}
              {label} duo {nameOf(d.ids[0])} + {nameOf(d.ids[1])}{" "}
              {d.split ? "play on opposite teams" : "play together"} ({d.mode}{" "}
              rule).
            </React.Fragment>
          ))}
        </p>
      </Well>
    </details>
  );
}

function formNote(x: ReturnType<typeof explain>) {
  const f = x.form;
  const cfg = config.form;
  if (f.status === "no-recent-matches")
    return "No FACEIT matches in the window: no form, ELO only.";
  if (f.status === "thin-baseline")
    return `${f.matches} matches, but only ${f.baselineMatches} older ones for a baseline (needs ${cfg.minBaseline}): no form.`;
  if (f.status === "invalid-baseline") return "No usable baseline rating.";
  const cap = (hit: boolean) => (hit ? ` (capped at ±${cfg.max})` : "");
  return [
    `${f.matches} matches · rating ${f.windowRating!.toFixed(2)} vs ${f.baselineRating!.toFixed(2)} over ${f.baselineMatches} older ones`,
    `ratio ${f.ratio!.toFixed(2)} → ${f.shrunkRatio!.toFixed(2)} after shrinkage (k = ${cfg.shrinkK})`,
    `raw ${cfg.beta} × ${(f.shrunkRatio! - 1).toFixed(3)} = ${signed(Math.round(f.raw))}${cap(f.rawClamped)}`,
    `× ${f.multiplier.toFixed(2)} for ${f.direction === "up" ? "good form" : "a slump"} at ${x.E} ELO${cap(f.clamped)}`,
  ].join(" · ");
}

function activityNote(x: ReturnType<typeof explain>) {
  const a = x.activity;
  if (a.status === "no-data")
    return "No FACEIT history: counts as 0, never a penalty.";
  const sessions = `${a.sessions} ${a.sessions === 1 ? "session" : "sessions"} (evenings)`;
  const last =
    a.sessions === 0 && a.lastPlayedAt
      ? ` · last played ${a.lastPlayedAt.slice(0, 10)}`
      : "";
  const anchors = config.activity.anchors;
  const [first, top] = [anchors[0], anchors[anchors.length - 1]];
  const neutral = anchors.find((n) => n.value === 0)?.sessions;
  return `${sessions}${last} · ${neutral} a month is neutral, fewer costs up to ${signed(first.value)}, ${top.sessions}+ adds ${signed(top.value)}.`;
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

function Tally() {
  return (
    <div className="mt-2.5 grid grid-cols-3 gap-1.5">
      {variants.map((v) => (
        <Well
          key={v.number}
          className="text-dim py-1.5 text-center text-[11px]"
        >
          <b className="text-text block text-[16px]">{v.votes}</b>
          Variant {v.number}
        </Well>
      ))}
    </div>
  );
}

function Locked({ variant }: { variant: MockVariant }) {
  return (
    <div className="mt-2.5">
      <Odds variant={variant} />
      <Well>
        <TeamList label="Team A" team={variant.teamA} order="join" />
        <TeamList label="Team B" team={variant.teamB} order="join" />
      </Well>
      <Well className="mt-2.5 p-2">
        <p className="text-gold mb-1 flex items-center gap-1.5 font-bold">
          <Lock className="size-3.5" aria-hidden /> How to play
        </p>
        <ol className="text-dim list-decimal space-y-0.5 pl-5">
          <li>Everyone joins the group&apos;s FACEIT Club queue.</li>
          <li>Captains pick exactly this lineup. No freelancing.</li>
          <li>No FACEIT tonight? An admin types in the score afterwards.</li>
        </ol>
      </Well>
    </div>
  );
}

function Played() {
  const [pick, setPick] = React.useState<string | null>(null);
  const wonA = result.maps.filter((m) => m.a > m.b).length;
  const wonB = result.maps.length - wonA;
  const map = result.maps.find((m) => m.map === pick);
  const rounds = result.maps.reduce((s, m) => s + m.a + m.b, 0);
  return (
    <div className="mt-2.5">
      <Well className="px-2 pt-2 pb-3 text-center">
        <div className="text-dim text-[11px]">Maps won, Team A : Team B</div>
        <div className="text-gold text-[64px] leading-[1.05] font-bold tracking-[-0.04em]">
          {wonA}
          <span className="text-dim"> : </span>
          <span className="text-text">{wonB}</span>
        </div>
        <div
          role="group"
          aria-label="Scoreboard for"
          className="mt-1 flex flex-wrap justify-center gap-1.5"
        >
          <MapChip on={!map} onClick={() => setPick(null)}>
            All maps
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
      <p className="text-dim mt-2.5 mb-1 px-0.5 text-[11px]">
        {map ? (
          <>
            {map.map} ·{" "}
            <b className="text-text">
              {map.a} : {map.b}
            </b>{" "}
            · Team {map.a > map.b ? "A" : "B"} won · {map.a + map.b} rounds
          </>
        ) : (
          <>
            All {result.maps.length} maps · {rounds} rounds · ADR and MR
            weighted by rounds
          </>
        )}
      </p>
      <Scoreboard lines={map ? map.lines : result.all} />
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
          : "bg-window hover:bg-row",
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

function Scoreboard({ lines }: { lines: MapLine[] }) {
  const best = Math.max(...lines.map((l) => l.rating));
  return (
    <Well>
      <div
        className={cn(
          "border-lo bg-window text-dim grid border-b px-1.5 py-1 text-[10px] tracking-[0.06em] uppercase",
          SCORE_COLS,
        )}
      >
        <span>Player</span>
        <span className="text-right">K</span>
        <span className="text-right">A</span>
        <span className="text-right">D</span>
        <span className="text-right">ADR</span>
        <span className="text-right" title="Mixer Rating">
          MR
        </span>
      </div>
      {(["A", "B"] as const).map((team) => (
        <React.Fragment key={team}>
          <div className="bg-window text-gold px-1.5 py-1 text-[11px] font-bold tracking-[0.05em] uppercase">
            Team {team}
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
  const mvp = [...result.all].sort((a, b) => b.rating - a.rating)[0];
  const text = {
    lobby: "Last one in brings the energy drinks.",
    voting: `${mix.waitingFor.name} is late. As tradition demands.`,
    locked: "Teams are final. Complaints go to the algorithm.",
    played: `${mvp.player.name} carried. Screenshots or it didn't happen.`,
  }[state];
  return (
    <p className="text-dim mt-2 px-2 text-center text-[11px] italic">{text}</p>
  );
}

function ActionBar({
  state,
  variantNo,
}: {
  state: MixState;
  variantNo: number;
}) {
  return (
    <div className="border-hi bg-window fixed inset-x-0 bottom-0 border-t px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-[444px] gap-2 md:max-w-[504px]">
        {state === "lobby" && (
          <>
            <VButton className="flex-1">Share</VButton>
            <VButton primary className="flex-[2]">
              Join Mix
            </VButton>
          </>
        )}
        {state === "voting" && (
          <>
            <VButton className="flex-1">Re-roll</VButton>
            <VButton primary className="flex-[2]">
              Vote Variant {variantNo}
            </VButton>
          </>
        )}
        {state === "locked" && (
          <>
            <VButton className="flex-1">Result</VButton>
            <VButton
              primary
              className="flex flex-[2] items-center justify-center gap-1.5"
            >
              FACEIT Club <ExternalLink className="size-3.5" aria-hidden />
            </VButton>
          </>
        )}
        {state === "played" && (
          <>
            <VButton className="flex-1">Upload Demo</VButton>
            <VButton primary className="flex-[2]">
              Full Scoreboard
            </VButton>
          </>
        )}
      </div>
    </div>
  );
}
