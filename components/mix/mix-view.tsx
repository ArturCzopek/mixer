"use client";

// Mix page in the VGUI world. Design preview only: data comes from lib/mock/mix.ts, buttons do
// nothing yet. Real data and actions arrive with M1-5 (lobby), M1-6 (variants), M1-7 (voting).

import * as React from "react";
import Image from "next/image";
import { ChevronDown, ChevronRight, ExternalLink, Lock } from "lucide-react";
import {
  Badge,
  ListHead,
  Sheet,
  SkillBar,
  Tabs,
  VButton,
  Well,
  Window,
} from "@/components/vgui";
import {
  formBreakdown,
  lobby,
  mix,
  result,
  skill,
  variants,
  type MockPlayer,
  type MockVariant,
} from "@/lib/mock/mix";
import { cn } from "@/lib/utils";

export type MixState = "lobby" | "voting" | "locked" | "played";

const avg = (team: MockPlayer[]) =>
  Math.round(team.reduce((s, p) => s + skill(p), 0) / team.length);
const winProbA = (a: number, b: number) => 1 / (1 + 10 ** ((b - a) / 400));

export function MixView({ state }: { state: MixState }) {
  const [variantNo, setVariantNo] = React.useState(1);
  const [focusId, setFocusId] = React.useState(mix.me.steamId);
  const variant = variants.find((v) => v.number === variantNo)!;
  const joined = lobby.filter(
    (p): p is MockPlayer => p !== null && p !== mix.me,
  );
  const count = state === "lobby" ? joined.length : 10;

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
            lobbyCount={joined.length}
          />

          {state === "lobby" && <Lobby joined={joined} />}

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
    played: <>Played · 3 maps · result from {result.source}</>,
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
  selected,
  onSelect,
}: {
  player: MockPlayer;
  index?: number;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const Tag = onSelect ? "button" : "div";
  return (
    <Tag
      onClick={onSelect}
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

function Lobby({ joined }: { joined: MockPlayer[] }) {
  const slots = [
    ...joined,
    ...Array(10 - joined.length).fill(null),
  ] as (MockPlayer | null)[];
  return (
    <Well className="mt-2.5">
      <ListHead>
        <span className="flex-1 pl-6">Player</span>
        <span className="w-[46%]">Skill S</span>
      </ListHead>
      {slots.map((p, i) =>
        p ? (
          <PlayerRow key={p.steamId} player={p} index={i + 1} />
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
  focusId,
  onFocus,
}: {
  label: string;
  team: MockPlayer[];
  focusId?: string;
  onFocus?: (id: string) => void;
}) {
  return (
    <>
      <div className="bg-window text-gold flex justify-between px-1.5 py-1 text-[11px] font-bold tracking-[0.05em] uppercase">
        {label}
        <span className="text-text">{avg(team)}</span>
      </div>
      {team.map((p) => (
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
  const a = avg(variant.teamA);
  const b = avg(variant.teamB);
  const pa = Math.round(winProbA(a, b) * 100);
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
      <div className="mb-2 flex flex-wrap gap-1">
        {variant.badges.map((b) => (
          <Badge key={b}>{b}</Badge>
        ))}
      </div>
      <Well>
        <ListHead>
          <span className="flex-1">Player · tap for details</span>
          <span className="w-[46%]">Skill S</span>
        </ListHead>
        <TeamList
          label="Team A"
          team={variant.teamA}
          focusId={focused.steamId}
          onFocus={onFocus}
        />
        <TeamList
          label="Team B"
          team={variant.teamB}
          focusId={focused.steamId}
          onFocus={onFocus}
        />
      </Well>
      <Explanation player={focused} variant={variant} />
    </>
  );
}

function Explanation({
  player,
  variant,
}: {
  player: MockPlayer;
  variant: MockVariant;
}) {
  const f = formBreakdown(player);
  const a = avg(variant.teamA);
  const b = avg(variant.teamB);
  const pa = winProbA(a, b);
  const imbalance = Math.abs(pa - 0.5) * 100;
  const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
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
          S = E + F + M = {player.E} {f.F < 0 ? "−" : "+"} {Math.abs(f.F)} +{" "}
          {player.M} = {skill(player)}
        </p>
        <Term k="E" name="FACEIT ELO" value={player.E} />
        <Term
          k="F"
          name="FACEIT form, last 30 days"
          value={sign(f.F)}
          note={`${player.form.maps} maps · rating ${player.form.recent.toFixed(2)} vs ${player.form.before.toFixed(2)} before · ratio ${f.ratio.toFixed(2)} → ${f.shrunk.toFixed(2)} after shrinkage (k = 10) · 500 × ${(f.shrunk - 1).toFixed(2)}`}
        />
        <Term
          k="M"
          name="Mix form"
          value={player.M}
          note="No mix maps with stats yet"
        />
        <p className="text-dim mt-2 text-[11px]">
          Variant cost: {imbalance.toFixed(1)} pp imbalance + 0 pp rule
          penalties. Lower is fairer; the three cheapest distinct splits are
          shown.
        </p>
      </Well>
    </details>
  );
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
        <TeamList label="Team A" team={variant.teamA} />
        <TeamList label="Team B" team={variant.teamB} />
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
  const wonA = result.maps.filter((m) => m.a > m.b).length;
  const wonB = result.maps.length - wonA;
  return (
    <div className="mt-2.5">
      <Well className="px-2 pt-2 pb-3 text-center">
        <div className="text-dim text-[11px]">Maps won, Team A : Team B</div>
        <div className="text-gold text-[64px] leading-[1.05] font-bold tracking-[-0.04em]">
          {wonA}
          <span className="text-dim"> : </span>
          <span className="text-text">{wonB}</span>
        </div>
        <div className="mt-1 flex justify-center gap-1.5">
          {result.maps.map((m) => (
            <span key={m.map} className="bevel bg-window px-2 py-1 text-[11px]">
              {m.map}{" "}
              <b className={m.a > m.b ? "text-gold" : "text-text"}>{m.a}</b>
              <span className="text-dim">:</span>
              <b className={m.b > m.a ? "text-gold" : "text-text"}>{m.b}</b>
            </span>
          ))}
        </div>
      </Well>
      <Well className="mt-2.5">
        <div className="border-lo bg-window text-dim grid grid-cols-[1fr_repeat(4,2.4rem)_3rem] border-b px-1.5 py-1 text-[10px] tracking-[0.06em] uppercase">
          <span>Top 5 · all maps</span>
          <span className="text-right">K</span>
          <span className="text-right">A</span>
          <span className="text-right">D</span>
          <span className="text-right">ADR</span>
          <span className="text-right" title="Mixer Rating">
            MR
          </span>
        </div>
        {result.scoreboard.map((r, i) => (
          <div
            key={r.player.steamId}
            className={cn(
              "border-row grid grid-cols-[1fr_repeat(4,2.4rem)_3rem] items-center border-b px-1.5 py-1",
              i === 0 && "bg-row",
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
      </Well>
    </div>
  );
}

function Quip({ state }: { state: MixState }) {
  const text = {
    lobby: "Last one in brings the energy drinks.",
    voting: `${mix.waitingFor.name} is late. As tradition demands.`,
    locked: "Teams are final. Complaints go to the algorithm.",
    played: `${result.scoreboard[0].player.name} carried. Screenshots or it didn't happen.`,
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
