"use client";

import { useActionState, useId, useState } from "react";
import { useT } from "@/components/i18n";
import { VButton, Well } from "@/components/vgui";
import {
  addRosterPlayer,
  updateRosterElo,
  type RosterState,
} from "@/lib/groups/roster";

function Feedback({ state }: { state: RosterState }) {
  const t = useT();
  if (!state) return null;
  return (
    <Well role="status" className="text-dim px-2 py-1.5 text-[11px]">
      {"error" in state
        ? t.roster.errors[state.error]
        : state.faceitUnavailable
          ? t.roster.faceitUnavailable
          : t.groups.saved}
    </Well>
  );
}

export function AddRosterPlayer({ groupId }: { groupId: string }) {
  const t = useT();
  const hintId = useId();
  const [steam, setSteam] = useState("");
  const [state, run, pending] = useActionState(
    addRosterPlayer.bind(null, groupId),
    undefined,
  );
  return (
    <form action={run} className="mb-3 flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="font-bold">{t.roster.add}</span>
        <input
          name="steam"
          required
          maxLength={256}
          value={steam}
          onChange={(e) => setSteam(e.target.value)}
          autoCapitalize="none"
          spellCheck={false}
          aria-describedby={hintId}
          className="sunk text-text focus:bg-row w-full px-1.5 py-2 text-[13px]"
        />
      </label>
      <p id={hintId} className="text-dim text-[11px]">
        {t.roster.steamHint}
      </p>
      <Feedback state={state} />
      <VButton type="submit" primary disabled={pending}>
        {pending ? t.roster.adding : t.roster.add}
      </VButton>
    </form>
  );
}

export function RosterElo({
  groupId,
  playerId,
  name,
  value,
}: {
  groupId: string;
  playerId: string;
  name: string;
  value: number | null;
}) {
  const t = useT();
  const hintId = useId();
  const [elo, setElo] = useState(value?.toString() ?? "");
  const [state, run, pending] = useActionState(
    updateRosterElo.bind(null, groupId, playerId),
    undefined,
  );
  return (
    <details className="mt-1">
      <summary className="text-gold cursor-pointer text-[11px]">
        {t.roster.editElo}
      </summary>
      <form action={run} className="mt-2 flex flex-col gap-2">
        <label className="flex flex-wrap items-center gap-2 text-[11px]">
          <span>{t.roster.eloFor(name)}</span>
          <input
            name="elo"
            type="number"
            min={600}
            max={2500}
            step={1}
            value={elo}
            onChange={(e) => setElo(e.target.value)}
            aria-describedby={hintId}
            className="sunk text-text focus:bg-row w-24 px-1.5 py-2 text-[13px]"
          />
        </label>
        <p id={hintId} className="text-dim text-[11px]">
          {t.roster.eloHint}
        </p>
        <Feedback state={state} />
        <VButton type="submit" disabled={pending}>
          {pending ? t.roster.saving : t.groups.save}
        </VButton>
      </form>
    </details>
  );
}
