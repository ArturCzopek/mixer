"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n";
import { ListHead, VButton, Well, Window } from "@/components/vgui";
import { DiscordMissing } from "./discord-missing";
import {
  addParticipant,
  createMix,
  joinMix,
  leaveMix,
  removeParticipant,
  setMixStatus,
  type MixActionError,
  type MixActionState,
} from "@/lib/mix/actions";
import type { LobbyParticipant, MixLobby } from "@/lib/mix/queries";

export function CreateMixForm({ groupId }: { groupId: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(
    createMix.bind(null, groupId),
    undefined,
  );
  return (
    <form action={action} className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="font-bold">{t.lobby.mixTitle}</span>
        <input
          name="title"
          required
          minLength={2}
          maxLength={60}
          autoComplete="off"
          className="sunk text-text focus:bg-row w-full px-1.5 py-2 text-[13px]"
        />
      </label>
      {state && "error" in state && (
        <Well role="alert" className="text-alert px-2 py-1.5 text-[11px]">
          {t.lobby.errors[state.error]}
        </Well>
      )}
      <VButton type="submit" primary disabled={pending}>
        {pending ? t.lobby.creating : t.lobby.create}
      </VButton>
    </form>
  );
}

export function MixLobbyView({
  groupSlug,
  groupName,
  mix,
  viewerId,
  isMember,
  canManage,
  candidates,
  unlinkedDiscordPlayers,
}: {
  groupSlug: string;
  groupName: string;
  mix: MixLobby;
  viewerId: string | null;
  isMember: boolean;
  canManage: boolean;
  candidates: { playerId: string; name: string }[];
  unlinkedDiscordPlayers: string[];
}) {
  const t = useT();
  const router = useRouter();
  const [feedback, setFeedback] = useState<MixActionError>();
  const [pending, startTransition] = useTransition();
  const [newPlayerId, setNewPlayerId] = useState(candidates[0]?.playerId ?? "");
  const joinedIds = new Set(mix.participants.map((player) => player.playerId));
  const isJoined = viewerId !== null && joinedIds.has(viewerId);
  const open = mix.status === "open";
  const count = mix.participants.length;

  function run(action: () => Promise<MixActionState>) {
    startTransition(async () => {
      const result = await action();
      setFeedback(result && "error" in result ? result.error : undefined);
      if (result && ("ok" in result || result.error === "stale"))
        router.refresh();
    });
  }

  return (
    <main className="mx-auto w-full max-w-[460px] px-2 py-6">
      <p className="text-dim mb-2 text-xs">
        <Link href={`/g/${groupSlug}`}>{groupName}</Link>
        <span aria-hidden="true"> › </span>
        {t.lobby.lobby}
      </p>
      <Window title={mix.title} right={t.lobby.playersOf10(count)}>
        <Well
          aria-live="polite"
          className="text-dim mb-2 px-2 py-1.5 text-[11px]"
        >
          <span
            className={`mr-1.5 inline-block size-[7px] align-[1px] ${
              mix.status === "open" || mix.status === "voting"
                ? "bg-gold"
                : "bg-dim"
            }`}
          />
          {t.lobby.status[mix.status]}
        </Well>

        <DiscordMissing names={unlinkedDiscordPlayers} groupSlug={groupSlug} />

        <Well className="mb-2 overflow-hidden">
          <ListHead>
            <span className="flex-1">{t.lobby.players}</span>
            <span>{t.lobby.joinOrder}</span>
          </ListHead>
          {mix.participants.map((participant, index) => (
            <ParticipantRow
              key={participant.playerId}
              participant={participant}
              position={index + 1}
              removable={canManage && open && participant.playerId !== viewerId}
              pending={pending}
              onRemove={() =>
                run(() => removeParticipant(mix.id, participant.playerId))
              }
            />
          ))}
          {!open && count === 0 && (
            <p className="text-dim px-1.5 py-2 text-[11px]">
              {t.lobby.noPlayers}
            </p>
          )}
          {Array.from(
            { length: open ? Math.max(0, 10 - count) : 0 },
            (_, index) => (
              <div
                key={`slot-${count + index + 1}`}
                className="border-hi text-dim mx-1.5 my-1 flex min-h-9 items-center border border-dashed px-1.5 text-[11px] last:mb-1.5"
              >
                {t.lobby.freeSlot(count + index + 1)}
              </div>
            ),
          )}
        </Well>

        {feedback && (
          <Well
            role="alert"
            className="text-alert mb-2 px-2 py-1.5 text-[11px]"
          >
            {t.lobby.errors[feedback]}
          </Well>
        )}

        {open && isMember && !isJoined && count < 10 && (
          <div className="mb-2 flex justify-end">
            <VButton
              type="button"
              primary
              disabled={pending}
              onClick={() => run(() => joinMix(mix.id))}
            >
              {t.lobby.join}
            </VButton>
          </div>
        )}
        {open && isJoined && (
          <div className="mb-2 flex justify-end">
            <VButton
              type="button"
              disabled={pending}
              onClick={() => run(() => leaveMix(mix.id))}
            >
              {t.lobby.leave}
            </VButton>
          </div>
        )}

        {canManage && open && count < 10 && candidates.length > 0 && (
          <div className="border-hi mb-2 border-t pt-2">
            <label className="mb-2 flex flex-col gap-1">
              <span className="font-bold">{t.lobby.addPlayer}</span>
              <select
                value={newPlayerId}
                onChange={(event) => setNewPlayerId(event.target.value)}
                className="sunk text-text focus:bg-row w-full px-1.5 py-2 text-[13px]"
              >
                {candidates.map((player) => (
                  <option key={player.playerId} value={player.playerId}>
                    {player.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex justify-end">
              <VButton
                type="button"
                disabled={pending || !newPlayerId}
                onClick={() => run(() => addParticipant(mix.id, newPlayerId))}
              >
                {t.lobby.add}
              </VButton>
            </div>
          </div>
        )}

        {canManage && (
          <div className="border-hi flex flex-wrap justify-end gap-2 border-t pt-2">
            {open && count === 10 && (
              <VButton
                type="button"
                primary
                disabled={pending}
                onClick={() =>
                  run(() => setMixStatus(mix.id, "open", "balancing"))
                }
              >
                {t.lobby.startBalancing}
              </VButton>
            )}
            {mix.status === "balancing" && (
              <VButton
                type="button"
                disabled={pending}
                onClick={() =>
                  run(() => setMixStatus(mix.id, "balancing", "open"))
                }
              >
                {t.lobby.reopen}
              </VButton>
            )}
            {(open || mix.status === "balancing") && (
              <VButton
                type="button"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    setMixStatus(
                      mix.id,
                      mix.status as "open" | "balancing",
                      "cancelled",
                    ),
                  )
                }
              >
                {t.lobby.cancel}
              </VButton>
            )}
          </div>
        )}
      </Window>
      <p className="text-dim mt-2 text-[11px]">{t.lobby.joinOrderNote}</p>
    </main>
  );
}

function ParticipantRow({
  participant,
  position,
  removable,
  pending,
  onRemove,
}: {
  participant: LobbyParticipant;
  position: number;
  removable: boolean;
  pending: boolean;
  onRemove: () => void;
}) {
  const t = useT();
  const name = participant.displayName ?? participant.steamId;
  return (
    <div className="border-row flex min-w-0 items-center gap-2 border-b px-1.5 py-1.5 last:border-b-0">
      {participant.avatarUrl ? (
        <Image
          src={participant.avatarUrl}
          alt=""
          width={20}
          height={20}
          unoptimized
          className="border-lo size-5 shrink-0 border"
        />
      ) : (
        <span className="border-lo bg-row size-5 shrink-0 border" />
      )}
      <span className="text-text min-w-0 flex-1 truncate text-[13px]">
        {name}
      </span>
      <span className="text-dim shrink-0 text-[11px]">
        {t.lobby.joined(position)}
      </span>
      {removable && (
        <VButton
          type="button"
          disabled={pending}
          onClick={onRemove}
          aria-label={t.lobby.removePlayer(name)}
          className="shrink-0 px-2 py-1.5 text-[11px]"
        >
          {t.lobby.remove}
        </VButton>
      )}
    </div>
  );
}
