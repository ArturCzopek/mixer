"use client";

// Mix page in the VGUI world. Renders plain `MixViewData` built on the server: the showcase and
// stored mix variants share the same presentation components.

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { DiscordMissing } from "./discord-missing";
import { useRouter } from "next/navigation";
import { ChevronDown, ExternalLink, Lock } from "lucide-react";
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
import type { SkillBreakdown } from "@/lib/balance";
import {
  mapResultSummary,
  totals,
  type MixViewData,
  type ViewLine,
  type ViewPlayer,
  type ViewVariant,
} from "@/lib/mix/view";
import { votingOutcome } from "@/lib/mix/voting";
import { useLang, useT } from "@/components/i18n";
import type { Dict } from "@/lib/i18n/dict";
import {
  faceitRoomId,
  type FaceitCandidate,
} from "@/lib/mix/faceit-candidates";
import { cn } from "@/lib/utils";
import {
  approveMixVariants,
  castMixVote,
  castProxyMixVote,
  closeMixVoting,
  findFaceitMatches,
  generateMixVariants,
  importFaceitMatches,
  reopenMixVoting,
  recordManualResults,
  rerollMixVariants,
  setMixStatus,
  startMixMatch,
  swapMixParticipant,
  type MixActionState,
} from "@/lib/mix/actions";

export type MixState = "lobby" | "balancing" | "voting" | "locked" | "played";

type Player = ViewPlayer;
type Line = Omit<ViewLine, "steamId"> & { player: Player };
type MapResult = {
  map: string;
  a: number;
  b: number;
  lines: Line[];
  roomUrl?: string | null;
  demoUrl?: string | null;
  statsOrigin?: string | null;
};
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
  const calculatedOutcome = data.variants.length
    ? votingOutcome(data.variants, data.mix.id)
    : { winner: 0, tied: [] };
  const outcome = {
    winner: data.chosenVariantNumber ?? calculatedOutcome.winner,
    tied: data.votingTied ?? calculatedOutcome.tied,
  };
  const winnerData = data.variants.find((v) => v.number === outcome.winner);
  const winner: Variant | null = winnerData
    ? {
        ...winnerData,
        teamA: team(winnerData.teamA),
        teamB: team(winnerData.teamB),
      }
    : null;
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
      data.viewerCanVote === false
        ? null
        : (data.variants.find((v) => v.voters.includes(data.mix.meId))
            ?.number ?? null),
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
  groupSlug,
}: {
  state: MixState;
  data: MixViewData;
  groupSlug?: string;
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
  const [variantNo, setVariantNo] = React.useState(
    data.variants[0]?.number ?? 1,
  );
  const [focusId, setFocusId] = React.useState(data.mix.meId);
  const activeVariantNo = mix.variants.some((v) => v.number === variantNo)
    ? variantNo
    : (mix.variants[0]?.number ?? 1);
  const variant = mix.variants.find((v) => v.number === activeVariantNo);
  const count = state === "lobby" ? mix.lobby.length : 10;

  return (
    <MixContext.Provider value={mix}>
      <div className="mx-auto flex w-full max-w-[460px] flex-1 flex-col pb-[76px] md:max-w-[760px] lg:max-w-[1180px]">
        <div className="px-2">
          {groupSlug && (
            <p className="text-dim mb-2 text-xs">
              <Link href={`/g/${groupSlug}`}>{data.mix.group}</Link>
              <span aria-hidden="true"> › </span>
              {t.groups.mix}
            </p>
          )}
          {data.showcase && <ShowcaseNote />}
          <Window
            title={
              data.archiveSource && data.mix.title
                ? data.mix.title
                : t.mix.title(data.mix.number, when)
            }
            right={
              data.archiveSource ? undefined : (
                <span aria-label={t.mix.playersOf10(count)}>
                  {count}
                  <span className="text-dim">/10</span>
                </span>
              )
            }
          >
            <StatusLine state={state} />
            {groupSlug && data.unlinkedDiscordPlayers && (
              <DiscordMissing
                names={data.unlinkedDiscordPlayers}
                groupSlug={groupSlug}
              />
            )}

            {state === "lobby" && <Lobby />}

            {state === "balancing" && (
              <BalancingPanel
                variant={variant}
                variantNo={activeVariantNo}
                onVariantChange={setVariantNo}
                focusId={focusId}
                onFocus={setFocusId}
              />
            )}

            {state === "voting" && (
              <div className="mt-2.5">
                <Tabs
                  label={t.variants.aria}
                  value={activeVariantNo}
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
                  {variant && (
                    <VariantBody
                      variant={variant}
                      focusId={focusId}
                      onFocus={setFocusId}
                    />
                  )}
                  {variant && <Tally />}
                  {data.showcase && data.viewerIsAdmin && (
                    <div className="mt-2.5">
                      <AdminPanel state="voting" />
                    </div>
                  )}
                  {!data.showcase && data.viewerIsAdmin && (
                    <VotingAdminPanel state="voting" />
                  )}
                </Sheet>
              </div>
            )}

            {state === "locked" && <Locked />}
            {state === "played" && <Played />}

            {!data.showcase && <SwapHistory />}
            {data.viewerIsAdmin &&
              ["balancing", "voting", "locked"].includes(state) &&
              !data.showcase && <SwapPanel />}
          </Window>
          <Quip state={state} />
        </div>
        {data.showcase && (
          <ActionBar state={state} variantNo={activeVariantNo} />
        )}
        {!data.showcase &&
          state === "voting" &&
          data.viewerCanVote &&
          variant?.id && <VoteBar variant={variant} myVote={mix.myVote} />}
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

function StatusLine({ state }: { state: MixState }) {
  const { data, lobby, waitingFor, result, winner } = useMix();
  const t = useT();
  const voted = data.variants.reduce((s, v) => s + v.votes, 0);
  const text = {
    lobby: <>{t.status.lobby(10 - lobby.length)}</>,
    balancing: <>{t.status.balancing}</>,
    voting: data.showcase ? (
      <>
        {t.status.voting(voted)} <b className="text-text">{waitingFor.name}</b>
      </>
    ) : voted === 10 ? (
      <>{t.status.votingAll}</>
    ) : (
      <>
        {t.status.voting(voted)} <b className="text-text">{waitingFor.name}</b>
      </>
    ),
    locked: (
      <>
        {t.status.lockedBefore}{" "}
        <b className="text-text">{t.variants.variant(winner!.number)}</b>{" "}
        {t.status.lockedAfter}
      </>
    ),
    played: (
      <>
        {t.status.played(result.maps.length, t.played.sources[result.source])}
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

function BalancingPanel({
  variant,
  variantNo,
  onVariantChange,
  focusId,
  onFocus,
}: {
  variant?: Variant;
  variantNo: number;
  onVariantChange: (number: number) => void;
  focusId: string;
  onFocus: (id: string) => void;
}) {
  const { data } = useMix();
  const t = useT();
  if (!data.viewerIsAdmin) return <Lobby />;
  return (
    <div className="mt-2.5 space-y-2.5">
      {data.variants.length === 0 ? (
        <>
          <Well className="p-2 text-[11px]">
            <p className="text-gold font-bold">{t.admin.previewWaiting}</p>
            <p className="text-dim mt-1">{t.admin.previewNote}</p>
          </Well>
          <Lobby />
        </>
      ) : (
        <>
          <Tabs
            label={t.variants.aria}
            value={variantNo}
            onChange={onVariantChange}
            items={data.variants.map((item) => ({
              value: item.number,
              label: t.variants.variant(item.number),
            }))}
          />
          <Sheet>
            {variant && (
              <VariantBody
                variant={variant}
                focusId={focusId}
                onFocus={onFocus}
              />
            )}
          </Sheet>
        </>
      )}
      <VariantAdminControls />
    </div>
  );
}

function VariantAdminControls() {
  const { data } = useMix();
  const t = useT();
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const run = async (key: string, action: () => Promise<MixActionState>) => {
    setPending(key);
    setError(null);
    try {
      const result = await action();
      if (result && "error" in result) {
        setError(t.lobby.errors[result.error]);
        if (result.error === "stale") router.refresh();
      } else router.refresh();
    } catch {
      setError(t.lobby.errors.failed);
    } finally {
      setPending(null);
    }
  };
  const generation = data.generation;
  const generated = data.variants.length === 3 && generation !== undefined;
  const isPending = pending !== null;
  return (
    <Well className="p-2 text-[11px]">
      <p className="text-gold mb-1 font-bold">{t.admin.title}</p>
      <p className="text-dim mb-2">
        {generated ? t.admin.previewReady(generation) : t.admin.previewWaiting}
      </p>
      {error && (
        <p role="alert" className="text-loss mb-2">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {!generated && (
          <VButton
            primary
            disabled={isPending}
            onClick={() =>
              void run("generate", () => generateMixVariants(data.mix.id))
            }
          >
            {pending === "generate" ? t.admin.generating : t.admin.generate}
          </VButton>
        )}
        {generated && (
          <>
            <VButton
              disabled={isPending}
              onClick={() =>
                void run("reroll", () =>
                  rerollMixVariants(data.mix.id, generation),
                )
              }
            >
              {pending === "reroll" ? t.admin.rerolling : t.admin.reroll}
            </VButton>
            <VButton
              primary
              disabled={isPending}
              onClick={() =>
                void run("approve", () =>
                  approveMixVariants(data.mix.id, generation),
                )
              }
            >
              {pending === "approve" ? t.admin.approving : t.admin.approve}
            </VButton>
          </>
        )}
        <VButton
          disabled={isPending}
          onClick={() =>
            void run("reopen", () =>
              setMixStatus(data.mix.id, "balancing", "open"),
            )
          }
        >
          {pending === "reopen" ? t.admin.reopening : t.lobby.reopen}
        </VButton>
        <VButton
          disabled={isPending}
          onClick={() =>
            void run("cancel", () =>
              setMixStatus(data.mix.id, "balancing", "cancelled"),
            )
          }
        >
          {pending === "cancel" ? t.admin.cancelling : t.lobby.cancel}
        </VButton>
      </div>
    </Well>
  );
}

function SwapPanel() {
  const { data } = useMix();
  const t = useT();
  const router = useRouter();
  const leavers = data.swapLeavers ?? [];
  const candidates = data.swapCandidates ?? [];
  const [leavingId, setLeavingId] = React.useState(leavers[0]?.playerId ?? "");
  const [joiningId, setJoiningId] = React.useState(
    candidates[0]?.playerId ?? "",
  );
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const leaving = leavers.some((p) => p.playerId === leavingId)
    ? leavingId
    : (leavers[0]?.playerId ?? "");
  const joining = candidates.some((p) => p.playerId === joiningId)
    ? joiningId
    : (candidates[0]?.playerId ?? "");
  const swap = async () => {
    setPending(true);
    setError(null);
    try {
      const result = await swapMixParticipant(data.mix.id, leaving, joining);
      if (result && "error" in result) {
        setError(t.lobby.errors[result.error]);
        if (result.error === "stale") router.refresh();
      } else router.refresh();
    } catch {
      setError(t.lobby.errors.failed);
    } finally {
      setPending(false);
    }
  };
  return (
    <Well className="mt-2.5 p-2 text-[11px]">
      <p className="text-gold mb-2 font-bold">{t.admin.swapTitle}</p>
      {leavers.length > 0 && candidates.length > 0 ? (
        <div className="flex flex-col gap-1.5 sm:flex-row">
          <label className="min-w-0 flex-1">
            <span className="text-dim mb-0.5 block">{t.admin.swapLeaving}</span>
            <select
              className="bevel bg-window w-full min-w-0 px-2 py-1.5"
              value={leaving}
              disabled={pending}
              onChange={(event) => setLeavingId(event.target.value)}
            >
              {leavers.map((player) => (
                <option key={player.playerId} value={player.playerId}>
                  {player.name}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0 flex-1">
            <span className="text-dim mb-0.5 block">{t.admin.swapJoining}</span>
            <select
              className="bevel bg-window w-full min-w-0 px-2 py-1.5"
              value={joining}
              disabled={pending}
              onChange={(event) => setJoiningId(event.target.value)}
            >
              {candidates.map((player) => (
                <option key={player.playerId} value={player.playerId}>
                  {player.name}
                </option>
              ))}
            </select>
          </label>
          <VButton
            primary
            className="self-end"
            disabled={pending || !leaving || !joining}
            onClick={() => void swap()}
          >
            {pending ? t.admin.swapping : t.admin.swap}
          </VButton>
        </div>
      ) : (
        <p className="text-dim">{t.admin.noSwapCandidates}</p>
      )}
      {error && (
        <p role="alert" className="text-loss mt-1.5">
          {error}
        </p>
      )}
    </Well>
  );
}

function SwapHistory() {
  const { data } = useMix();
  const t = useT();
  if (!data.swapLog?.length) return null;
  return (
    <Well className="mt-2.5 p-2 text-[11px]">
      <ul className="text-dim space-y-0.5">
        {data.swapLog.map((swap, index) => (
          <li key={`${swap.at}-${index}`}>
            {t.admin.swapRecorded(swap.fromName, swap.toName, swap.byName)}
          </li>
        ))}
      </ul>
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
  const { data, skill } = useMix();
  const t = useT();
  const hasSkill = data.breakdowns[player.steamId] !== undefined;
  const Tag = onSelect ? "button" : "div";
  return (
    <Tag
      onClick={onSelect}
      title={joinedAt && t.lists.joined(joinedAt)}
      aria-pressed={onSelect ? selected : undefined}
      className={cn(
        "border-row grid w-full items-center gap-2 border-b px-1.5 py-1 text-left",
        hasSkill ? "grid-cols-[1fr_46%]" : "grid-cols-[1fr]",
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
      {hasSkill && <SkillBar value={skill(player)} selected={selected} />}
    </Tag>
  );
}

function Lobby() {
  const { data, lobby } = useMix();
  const t = useT();
  const slots: ((typeof lobby)[number] | null)[] = [
    ...lobby,
    ...Array(10 - lobby.length).fill(null),
  ];
  return (
    <Well className="mt-2.5">
      <ListHead>
        <span className="flex-1 pl-6">{t.lists.playerJoinOrder}</span>
        {Object.keys(data.breakdowns).length > 0 && (
          <span className="w-[46%]">{t.lists.skill}</span>
        )}
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
const LEETIFY_COLS = "grid-cols-[3.6rem_1fr_2.8rem_3.6rem_3.4rem]";

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
        className="mt-1.5 flex h-[16px] flex-row-reverse flex-wrap content-start justify-end gap-0.5 overflow-hidden px-0.5"
      >
        {matches.map((m, i) => (
          <span
            key={i}
            title={`${m.map} ${m.score[0]}:${m.score[1]}`}
            className={cn(
              "size-[7px]",
              m.score[0] > m.score[1] ? "bg-win" : "bg-loss",
            )}
          />
        ))}
      </div>
      <Well className="mt-1.5">
        <div
          className={cn(
            "border-lo bg-window text-dim grid items-end gap-x-2 border-b px-1.5 py-1 text-[10px] leading-tight tracking-[0.06em] uppercase",
            LEETIFY_COLS,
          )}
        >
          <span>{t.leetify.date}</span>
          <span>{t.leetify.map}</span>
          <span className="text-right">{t.leetify.score}</span>
          <span className="text-right">{t.leetify.kad}</span>
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
                      {m.score[0] > m.score[1] ? (
                        <b className="text-win">{t.leetify.win}</b>
                      ) : (
                        <b className="text-loss">{t.leetify.loss}</b>
                      )}{" "}
                      {ddmm(m.finishedAt)}
                    </span>
                    <span className="truncate">{m.map.replace("de_", "")}</span>
                    <span className="text-right">
                      {m.score[0]}
                      <span className="text-dim">:</span>
                      {m.score[1]}
                    </span>
                    <span className="text-right">{m.kad.join("/")}</span>
                    <b
                      className={cn(
                        "text-right",
                        m.leetifyRating > 0 && "text-win",
                        m.leetifyRating < 0 && "text-loss",
                      )}
                    >
                      {rating(m.leetifyRating)}
                    </b>
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
  const input = data.skillInputs?.[player.steamId];
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
          input?.eloSource === "faceit"
            ? t.explain.eNote(player.level)
            : input?.eloSource === "group-manual"
              ? t.explain.eManual
              : input?.eloSource === "mix-mean"
                ? t.explain.eMixMean
                : input?.eloSource === "neutral-default"
                  ? t.explain.eNeutral
                  : input?.eloSource === "swap-slot"
                    ? t.explain.eSwapSlot(input.swapInheritedFrom ?? "")
                    : t.explain.eManual
        }
      />
      <Term
        k="F"
        name={t.explain.fName(config.form.windowDays)}
        value={signed(c.F)}
        note={
          input?.faceitFormAvailable === false
            ? t.explain.fUnavailable
            : formNote(x, config, t)
        }
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
  const { variants, me, data } = useMix();
  const t = useT();
  const byId = new Map(data.players.map((p) => [p.steamId, p]));
  const top = Math.max(...variants.map((v) => v.votes));
  const voted = new Set(variants.flatMap((variant) => variant.voters));
  const notVoted = data.participants
    .map((participant) => byId.get(participant.steamId))
    .filter(
      (player): player is Player => !!player && !voted.has(player.steamId),
    );
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
                const isMe =
                  (data.showcase || data.viewerCanVote) && id === me.steamId;
                return (
                  <li
                    key={id}
                    className={cn(
                      "flex items-center gap-1.5 px-1.5 py-0.5 text-[11px]",
                      isMe && "text-gold font-bold",
                    )}
                  >
                    <Avatar player={p} size={14} />
                    <span className="truncate">
                      {isMe ? t.tally.you : p.name}
                      {data.proxyVotes?.[id] &&
                        ` (${t.tally.castBy(data.proxyVotes[id])})`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Well>
        ))}
      </div>
      {notVoted.length > 0 && (
        <p className="text-dim mt-1.5 px-0.5 text-[11px]">
          {t.tally.publicNotVoted}{" "}
          <b className="text-text">
            {notVoted.map((player) => player.name).join(", ")}
          </b>
        </p>
      )}
    </section>
  );
}

function Locked() {
  const { winner, outcome, real, data } = useMix();
  const t = useT();
  const lockedWinner = winner!;
  const tie = outcome.tied.length > 1;
  const winningVotes = data.winningVotes ?? lockedWinner.votes;
  return (
    <div className="mt-2.5 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-3">
      <div>
        <Well className="mb-2 flex items-baseline gap-2 px-2 py-1.5">
          <b className="text-gold text-[16px]">
            {t.locked.won(lockedWinner.number)}
          </b>
          <span className="text-dim text-[11px]">
            {tie
              ? t.locked.tie(
                  winningVotes,
                  outcome.tied
                    .filter((n) => n !== lockedWinner.number)
                    .join(t.locked.and),
                )
              : t.locked.ofVotes(winningVotes)}
          </span>
        </Well>
        <Odds
          avgA={lockedWinner.engine.avgA}
          avgB={lockedWinner.engine.avgB}
          winProbA={lockedWinner.engine.winProbA}
        />
        <Teams
          teamA={lockedWinner.teamA}
          teamB={lockedWinner.teamB}
          order="join"
        />
      </div>
      <div className="mt-2.5 space-y-2.5 lg:mt-0">
        <Well className="p-2">
          <p className="text-gold mb-1 flex items-center gap-1.5 font-bold">
            <Lock className="size-3.5" aria-hidden /> {t.locked.howToPlay}
          </p>
          <ol className="text-dim list-decimal space-y-0.5 pl-5">
            {t.locked.steps.map((step, index) => (
              <li key={step}>
                {index === 0 && !data.showcase ? (
                  data.faceitClubUrl ? (
                    <a
                      href={data.faceitClubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t.locked.openClub}{" "}
                      <ExternalLink className="inline size-3" aria-hidden />
                    </a>
                  ) : (
                    t.locked.noClub
                  )
                ) : (
                  step
                )}
              </li>
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
        {data.showcase && data.viewerIsAdmin && <AdminPanel state="locked" />}
        {!data.showcase && data.viewerIsAdmin && (
          <VotingAdminPanel state="locked" />
        )}
      </div>
    </div>
  );
}

/**
 * Group admin controls (D33). Voting never closes by itself on the 10th vote (a misclick could not
 * be undone): it closes when an admin says so, or 60 minutes after the last vote once all ten
 * have voted. Admins can reopen it until the match starts, on the same approved variants (D37).
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

function VotingAdminPanel({ state }: { state: "voting" | "locked" }) {
  const { data, variants } = useMix();
  const t = useT();
  const router = useRouter();
  const targets = data.proxyTargets ?? [];
  const [voterId, setVoterId] = React.useState(targets[0]?.playerId ?? "");
  const [variantId, setVariantId] = React.useState(variants[0]?.id ?? "");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showProxy, setShowProxy] = React.useState(false);
  const [showResults, setShowResults] = React.useState(false);
  const [maps, setMaps] = React.useState([
    { mapName: "", scoreA: "", scoreB: "" },
  ]);
  const run = async (action: () => Promise<MixActionState>) => {
    setPending(true);
    setError(null);
    try {
      const result = await action();
      if (result && "error" in result) {
        setError(t.lobby.errors[result.error]);
        if (result.error === "stale") router.refresh();
      } else router.refresh();
    } catch {
      setError(t.lobby.errors.failed);
    } finally {
      setPending(false);
    }
  };
  return (
    <Well className="mt-2.5 p-2 text-[11px]">
      <p className="text-gold mb-1 font-bold">{t.admin.title}</p>
      <p className="text-dim mb-2">
        {data.matchStartedAt
          ? t.admin.matchStarted
          : state === "voting"
            ? t.admin.voting
            : t.admin.locked}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {state === "voting" ? (
          <>
            <VButton
              disabled={pending}
              onClick={() => void run(() => closeMixVoting(data.mix.id))}
            >
              {t.admin.close}
            </VButton>
            <VButton
              disabled={pending}
              onClick={() => setShowProxy(!showProxy)}
            >
              {t.admin.proxy}
            </VButton>
          </>
        ) : !data.matchStartedAt ? (
          <>
            <VButton
              disabled={pending}
              onClick={() => void run(() => reopenMixVoting(data.mix.id))}
            >
              {t.admin.reopen}
            </VButton>
            <VButton
              disabled={pending}
              onClick={() => {
                if (window.confirm(t.admin.startConfirm))
                  void run(() => startMixMatch(data.mix.id));
              }}
            >
              {t.admin.startMatch}
            </VButton>
          </>
        ) : null}
        {state === "locked" && (
          <VButton
            disabled={pending}
            onClick={() => setShowResults(!showResults)}
          >
            {t.admin.result}
          </VButton>
        )}
      </div>
      {showResults && state === "locked" && (
        <form
          className="mt-2 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            const parsed = maps.map((map) => ({
              mapName: map.mapName,
              scoreA: Number(map.scoreA),
              scoreB: Number(map.scoreB),
            }));
            if (maps.some((map) => map.scoreA === "" || map.scoreB === "")) {
              setError(t.lobby.errors.result);
              return;
            }
            if (window.confirm(t.admin.resultConfirm))
              void run(() => recordManualResults(data.mix.id, parsed));
          }}
        >
          <p className="text-dim">{t.admin.resultHint}</p>
          {maps.map((map, index) => (
            <div key={index} className="flex flex-wrap items-end gap-1.5">
              <label>
                <span className="text-dim mb-0.5 block">
                  {t.admin.mapName(index + 1)}
                </span>
                <input
                  className="bevel bg-window w-32 px-2 py-1.5"
                  maxLength={60}
                  value={map.mapName}
                  onChange={(event) =>
                    setMaps((rows) =>
                      rows.map((row, i) =>
                        i === index
                          ? { ...row, mapName: event.target.value }
                          : row,
                      ),
                    )
                  }
                  disabled={pending}
                />
              </label>
              {(["scoreA", "scoreB"] as const).map((team) => (
                <label key={team}>
                  <span className="text-dim mb-0.5 block">
                    {team === "scoreA" ? t.admin.teamA : t.admin.teamB}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={32767}
                    required
                    className="bevel bg-window w-16 px-2 py-1.5"
                    value={map[team]}
                    onChange={(event) =>
                      setMaps((rows) =>
                        rows.map((row, i) =>
                          i === index
                            ? { ...row, [team]: event.target.value }
                            : row,
                        ),
                      )
                    }
                    disabled={pending}
                  />
                </label>
              ))}
              {maps.length > 1 && (
                <VButton
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    setMaps((rows) => rows.filter((_, i) => i !== index))
                  }
                >
                  {t.admin.removeMap}
                </VButton>
              )}
            </div>
          ))}
          <div className="flex gap-1.5">
            <VButton
              type="button"
              disabled={pending}
              onClick={() =>
                setMaps((rows) => [
                  ...rows,
                  { mapName: "", scoreA: "", scoreB: "" },
                ])
              }
            >
              {t.admin.addMap}
            </VButton>
            <VButton primary type="submit" disabled={pending}>
              {t.admin.saveResult}
            </VButton>
          </div>
        </form>
      )}
      {state === "locked" && <FaceitImportPanel mixId={data.mix.id} />}
      {showProxy && state === "voting" && (
        <div className="mt-2 flex flex-wrap items-end gap-1.5">
          <label>
            <span className="text-dim mb-0.5 block">{t.admin.proxyPlayer}</span>
            <select
              className="bevel bg-window px-2 py-1.5"
              value={voterId}
              onChange={(event) => setVoterId(event.target.value)}
              disabled={pending}
            >
              {targets.map((target) => (
                <option key={target.playerId} value={target.playerId}>
                  {target.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-dim mb-0.5 block">
              {t.admin.proxyVariant}
            </span>
            <select
              className="bevel bg-window px-2 py-1.5"
              value={variantId}
              onChange={(event) => setVariantId(event.target.value)}
              disabled={pending}
            >
              {variants.map((variant) => (
                <option key={variant.number} value={variant.id}>
                  {t.variants.variant(variant.number)}
                </option>
              ))}
            </select>
          </label>
          <VButton
            primary
            disabled={pending || !voterId || !variantId}
            onClick={() =>
              void run(() => castProxyMixVote(data.mix.id, voterId, variantId))
            }
          >
            {t.admin.proxy}
          </VButton>
        </div>
      )}
      {error && (
        <p role="alert" className="text-loss mt-2">
          {error}
        </p>
      )}
    </Well>
  );
}

function FaceitImportPanel({
  mixId,
  enrich = false,
}: {
  mixId: string;
  enrich?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [roomLink, setRoomLink] = React.useState("");
  const [candidates, setCandidates] = React.useState<FaceitCandidate[] | null>(
    null,
  );
  const [selected, setSelected] = React.useState<string[]>([]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const find = async () => {
    setPending(true);
    setError(null);
    try {
      const result = await findFaceitMatches(mixId, roomLink);
      if ("error" in result) setError(t.lobby.errors[result.error]);
      else {
        setCandidates(result.candidates);
        setSelected(
          result.candidates
            .filter((candidate) => candidate.teamAIsFaction1 !== null)
            .map((candidate) => candidate.id),
        );
        if (
          roomLink &&
          !result.candidates.some(
            (candidate) => candidate.id === faceitRoomId(roomLink),
          )
        )
          setError(t.admin.faceitRoomRejected);
      }
    } catch {
      setError(t.lobby.errors.failed);
    } finally {
      setPending(false);
    }
  };
  const importSelected = async () => {
    if (
      !selected.length ||
      !window.confirm(
        enrich
          ? t.admin.faceitEnrichConfirm(selected.length)
          : t.admin.faceitImportConfirm(selected.length),
      )
    )
      return;
    setPending(true);
    setError(null);
    try {
      const result = await importFaceitMatches(mixId, selected, roomLink);
      if (result && "error" in result) setError(t.lobby.errors[result.error]);
      else router.refresh();
    } catch {
      setError(t.lobby.errors.failed);
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="border-hi mt-3 border-t pt-2">
      <p className="text-gold mb-1 font-bold">{t.admin.faceitTitle}</p>
      <p className="text-dim mb-2">
        {enrich ? t.admin.faceitEnrichHint : t.admin.faceitHint}
      </p>
      <div className="flex flex-wrap items-end gap-1.5">
        <label className="min-w-0 flex-1">
          <span className="text-dim mb-0.5 block">
            {t.admin.faceitRoomLink}
          </span>
          <input
            type="text"
            className="bevel bg-window w-full min-w-40 px-2 py-1.5"
            value={roomLink}
            placeholder="https://www.faceit.com/en/cs2/room/…"
            onChange={(event) => setRoomLink(event.target.value)}
            disabled={pending}
          />
        </label>
        <VButton disabled={pending} onClick={() => void find()}>
          {pending ? t.admin.faceitFinding : t.admin.faceitFind}
        </VButton>
      </div>
      {candidates && (
        <div className="mt-2 space-y-1.5">
          {candidates.length === 0 && (
            <p className="text-dim">{t.admin.faceitEmpty}</p>
          )}
          {candidates.map((candidate) => (
            <div
              key={candidate.id}
              className="bg-row flex items-start gap-2 px-2 py-1.5"
            >
              <label className="flex min-w-0 flex-1 items-start gap-2">
                <input
                  type="checkbox"
                  checked={selected.includes(candidate.id)}
                  disabled={pending || candidate.teamAIsFaction1 === null}
                  onChange={(event) =>
                    setSelected((current) =>
                      event.target.checked
                        ? [...current, candidate.id]
                        : current.filter((id) => id !== candidate.id),
                    )
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">
                    {candidate.map ?? t.admin.faceitUnknownMap} ·{" "}
                    {candidate.score1 ?? "?"}:{candidate.score2 ?? "?"} ·{" "}
                    {candidate.coverage}/10
                  </span>
                  <span className="text-dim block">
                    {new Date(candidate.startedAt).toLocaleString()} ·{" "}
                    {candidate.lineupMismatch.length
                      ? t.admin.faceitMismatch(candidate.lineupMismatch.length)
                      : t.admin.faceitLineupOk}
                  </span>
                  {candidate.teamAIsFaction1 === null && (
                    <span className="text-loss block">
                      {t.admin.faceitAmbiguous}
                    </span>
                  )}
                </span>
              </label>
              <a
                href={candidate.roomUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold underline"
              >
                {t.admin.faceitOpenRoom}
              </a>
            </div>
          ))}
          {candidates.length > 0 && (
            <VButton
              primary
              disabled={pending || selected.length === 0}
              onClick={() => void importSelected()}
            >
              {t.admin.faceitImport(selected.length)}
            </VButton>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-loss mt-2">
          {error}
        </p>
      )}
    </div>
  );
}

function VoteBar({
  variant,
  myVote,
}: {
  variant: Variant;
  myVote: number | null;
}) {
  const { data } = useMix();
  const t = useT();
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const vote = async () => {
    if (!variant.id) return;
    setPending(true);
    setError(null);
    try {
      const result = await castMixVote(data.mix.id, variant.id);
      if (result && "error" in result) {
        setError(t.lobby.errors[result.error]);
        if (result.error === "stale") router.refresh();
      } else router.refresh();
    } catch {
      setError(t.lobby.errors.failed);
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="border-hi bg-window fixed inset-x-0 bottom-0 z-10 border-t px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-[444px] md:max-w-[744px] lg:max-w-[1164px]">
        {error && (
          <p role="alert" className="text-loss mb-1 text-[11px]">
            {error}
          </p>
        )}
        <VButton
          primary
          className="w-full"
          disabled={pending || myVote === variant.number}
          onClick={() => void vote()}
        >
          {pending
            ? t.actions.savingVote
            : myVote === variant.number
              ? t.actions.yourVote(variant.number)
              : myVote === null
                ? t.actions.vote(variant.number)
                : t.actions.moveVote(variant.number)}
        </VButton>
      </div>
    </div>
  );
}

function Played() {
  const { result, data, winner } = useMix();
  const t = useT();
  const [pick, setPick] = React.useState(0);
  const { wonA, wonB, rounds } = mapResultSummary(data.result.maps);
  const map = result.maps[pick - 1] ?? null;
  const scoreA = map?.a ?? wonA;
  const scoreB = map?.b ?? wonB;
  const winnerText =
    scoreA === scoreB
      ? t.played.draw
      : t.played.teamWon(scoreA > scoreB ? "A" : "B");
  return (
    <div className="mt-2.5">
      <div className="overflow-x-auto pb-0.5">
        <div style={{ minWidth: `${(result.maps.length + 1) * 112}px` }}>
          <Tabs
            label={t.played.scoreboardFor}
            value={pick}
            onChange={setPick}
            items={[
              { value: 0, label: t.played.allMaps },
              ...result.maps.map((m, index) => ({
                value: index + 1,
                label: `${m.map} · ${m.a}:${m.b}`,
              })),
            ]}
          />
        </div>
      </div>
      <div className="mt-1.5">
        <Well className="mb-2 px-2 py-3 text-center">
          <div className="text-dim text-[11px]">
            {map ? map.map : t.played.seriesResult(result.maps.length)}
          </div>
          <div className="flex items-end justify-center gap-3 leading-none">
            <div className="min-w-16 text-center">
              <div className="text-dim text-[11px]">{t.lists.team("A")}</div>
              <b
                className={cn(
                  "text-[52px]",
                  scoreA > scoreB ? "text-gold" : "text-text",
                )}
              >
                {scoreA}
              </b>
            </div>
            <span className="text-dim pb-1 text-[32px]">:</span>
            <div className="min-w-16 text-center">
              <div className="text-dim text-[11px]">{t.lists.team("B")}</div>
              <b
                className={cn(
                  "text-[52px]",
                  scoreB > scoreA ? "text-gold" : "text-text",
                )}
              >
                {scoreB}
              </b>
            </div>
          </div>
          <b className="text-gold mt-1 block text-[13px]">{winnerText}</b>
          <p className="text-dim mt-0.5 text-[11px]">
            {map
              ? t.played.mapRounds(map.a + map.b)
              : t.played.mapRounds(rounds)}
          </p>
        </Well>
        {(data.showcase || data.archiveSource) && (
          <p className="text-dim mt-2.5 mb-1 px-0.5 text-[11px] lg:mt-0">
            {data.archiveSource
              ? t.played.archiveNote(data.archiveSource)
              : t.played.realNote}
          </p>
        )}
        {!map && (
          <div className="mb-2 grid gap-1.5 sm:grid-cols-2">
            {result.maps.map((item, index) => (
              <button
                key={index}
                onClick={() => setPick(index + 1)}
                className="bevel bg-window hover:bg-hover flex min-w-0 items-center gap-2 p-1.5 text-left"
              >
                <MapArtwork name={item.map} />
                <span className="min-w-0 flex-1">
                  <b className="block truncate">{item.map}</b>
                  <span className="text-dim text-[11px]">
                    {item.a === item.b
                      ? t.played.draw
                      : t.played.teamWon(item.a > item.b ? "A" : "B")}
                  </span>
                </span>
                <b className="text-gold shrink-0 text-[13px]">
                  {item.a}:{item.b}
                </b>
              </button>
            ))}
          </div>
        )}
        {map && (
          <div className="bevel bg-window mb-2 flex items-center gap-2 p-1.5">
            <MapArtwork name={map.map} />
            <span className="min-w-0">
              <b className="block truncate">{map.map}</b>
              <span className="text-dim text-[11px]">
                {t.played.mapArtwork}
              </span>
            </span>
          </div>
        )}
        <p className="text-dim mt-2.5 mb-1 px-0.5 text-[11px]">
          {map ? t.played.mapStats : t.played.totalStats}
        </p>
        {map && (map.roomUrl || map.demoUrl) && (
          <div className="mb-2 flex gap-3 px-0.5 text-[11px]">
            {map.roomUrl && (
              <a
                href={map.roomUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold underline"
              >
                {t.played.faceitRoom}
              </a>
            )}
            {map.demoUrl && (
              <a
                href={map.demoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold underline"
              >
                {t.played.downloadDemo}
              </a>
            )}
          </div>
        )}
        {map?.statsOrigin === "popflash" && (
          <p className="text-dim mb-2 px-0.5 text-[11px]">
            {t.played.historicalStats}
          </p>
        )}
        {(map ? map.lines : result.all).length > 0 ? (
          <Scoreboard lines={map ? map.lines : result.all} />
        ) : (
          <Well className="p-3 text-[11px]">
            <p className="text-dim mb-2">{t.played.noStats}</p>
            {winner && (
              <div className="grid gap-2 sm:grid-cols-2">
                {(["A", "B"] as const).map((team) => (
                  <div key={team}>
                    <b className="text-gold">{t.lists.team(team)}</b>
                    <p className="text-text">
                      {(team === "A" ? winner.teamA : winner.teamB)
                        .map((player) => player.name)
                        .join(", ")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Well>
        )}
      </div>
      {!!data.result.awards?.length && (
        <Well className="mt-2">
          <ListHead>{t.played.awardsTitle}</ListHead>
          <div className="grid sm:grid-cols-2">
            {data.result.awards.map((award) => {
              const [title, unit] = t.played.awardLabels[award.key];
              const name =
                data.players.find((player) => player.steamId === award.steamId)
                  ?.name ?? award.steamId;
              const rate = [
                "cannonFodder",
                "pacifist",
                "assistKing",
                "tourist",
              ].includes(award.key);
              return (
                <div
                  key={award.key}
                  className="border-row border-b px-2 py-1.5"
                >
                  <b className="text-gold block">{title}</b>
                  <span className="text-text">{name}</span>
                  <span className="text-dim">
                    {" "}
                    · {rate
                      ? award.value.toFixed(2)
                      : award.value.toFixed(0)}{" "}
                    {unit}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-dim px-2 py-1 text-[10px]">
            {t.played.awardsNote}
          </p>
        </Well>
      )}
      {data.viewerIsAdmin &&
        !data.showcase &&
        !data.archiveSource &&
        data.result.source === "manual" &&
        data.result.maps.length > 0 &&
        data.result.maps.every((item) => !item.statsOrigin) && (
          <Well className="mt-2 p-2">
            <FaceitImportPanel mixId={data.mix.id} enrich />
          </Well>
        )}
    </div>
  );
}

/** Original schematic card, deliberately not a claimed game map overview. */
function MapArtwork({ name }: { name: string }) {
  const shift =
    [...name].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 3;
  return (
    <svg
      viewBox="0 0 96 56"
      role="img"
      aria-label={name}
      className="border-lo bg-well h-14 w-24 shrink-0 border"
    >
      <path
        d={
          [
            "M5 14h34v11h16V7h35v27H66v16H8V37h23V27H5z",
            "M8 6h28v16h16V8h34v18H66v13h20v11H42V36H8z",
            "M6 8h23v15h19V7h40v13H67v16h21v13H7V35h28V26H6z",
          ][shift]
        }
        fill="var(--vg-row)"
        stroke="var(--vg-hi)"
        strokeWidth="1"
      />
      <path
        d="M19 15L49 29L76 18M49 29L71 43"
        fill="none"
        stroke="var(--vg-dim)"
        strokeDasharray="3 3"
      />
      <circle cx="19" cy="15" r="3" fill="var(--vg-gold)" />
      <circle cx="71" cy="43" r="3" fill="var(--vg-gold)" />
    </svg>
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
  const { data, result, waitingFor, skill } = useMix();
  const t = useT();
  const text = {
    lobby: t.quips.lobby,
    balancing: t.quips.balancing,
    voting: data.showcase
      ? t.quips.voting(waitingFor.name)
      : t.quips.votingOpen,
    locked: t.quips.locked,
    played: data.archiveSource ? "" : playedQuip(result.all, skill, t),
  }[state];
  if (!text) return null;
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
