"use client";

import { startTransition, useActionState } from "react";
import { useT } from "@/components/i18n";
import {
  changeMember,
  type ActionState,
  type MemberOp,
} from "@/lib/groups/actions";
import { cn } from "@/lib/utils";

const small =
  "bevel bg-sheet enabled:hover:bg-hover px-1.5 py-0.5 text-[11px] disabled:text-dim";

/** Admin buttons on one member row; the server re-checks the admin role on every click. */
export function MemberActions({
  groupId,
  playerId,
  name,
  isAdmin,
}: {
  groupId: string;
  playerId: string;
  name: string;
  isAdmin: boolean;
}) {
  const t = useT();
  const [state, run, pending] = useActionState(
    (_: ActionState, op: MemberOp) => changeMember(groupId, playerId, op),
    undefined,
  );
  const act = (op: MemberOp) => {
    if (op === "close" && !confirm(t.groups.confirmRemove(name))) return;
    startTransition(() => run(op));
  };
  return (
    <span className="flex shrink-0 flex-wrap items-center justify-end gap-1">
      {state && "error" in state && (
        <span role="status" className="text-alert text-[11px]">
          {t.groups.errors[state.error]}
        </span>
      )}
      {pending && (
        <span role="status" className="text-dim text-[11px]">
          {t.loading.working}
        </span>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => act(isAdmin ? "demote" : "promote")}
        className={cn(small, "text-text")}
      >
        {isAdmin ? t.groups.removeAdmin : t.groups.makeAdmin}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => act("close")}
        className={cn(small, "text-alert")}
      >
        {t.groups.remove}
      </button>
    </span>
  );
}
