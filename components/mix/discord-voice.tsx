"use client";

import { useActionState } from "react";
import { useT } from "@/components/i18n";
import { VButton, Well } from "@/components/vgui";
import { moveMixDiscordPlayers } from "@/lib/discord/actions";

export function DiscordVoice({
  mixId,
  state,
}: {
  mixId: string;
  state: "locked" | "played";
}) {
  const dict = useT();
  const t = dict.discordVoice;
  const [result, run, pending] = useActionState(
    moveMixDiscordPlayers.bind(null, mixId),
    undefined,
  );
  return (
    <Well className="mt-2.5 p-2">
      <b className="text-gold block text-[13px]">{t.title}</b>
      <p className="text-dim mt-0.5 text-[11px]">{t.hint}</p>
      <form action={run} className="mt-2 flex flex-wrap gap-1.5">
        {state === "locked" && (
          <VButton
            type="submit"
            name="target"
            value="teams"
            primary
            disabled={pending}
          >
            {pending ? dict.loading.working : t.teams}
          </VButton>
        )}
        <VButton type="submit" name="target" value="lobby" disabled={pending}>
          {pending ? dict.loading.working : t.lobby}
        </VButton>
      </form>
      {result && (
        <div
          role="status"
          aria-live="polite"
          className="text-dim mt-2 space-y-0.5 text-[11px]"
        >
          {"error" in result ? (
            <p>{t.errors[result.error]}</p>
          ) : (
            <>
              <p>{t.moved(result.moved.length)}</p>
              {result.notConnected.length > 0 && (
                <p>{t.notConnected(result.notConnected.join(", "))}</p>
              )}
              {result.unlinked.length > 0 && (
                <p>{t.unlinked(result.unlinked.join(", "))}</p>
              )}
              {result.failed.length > 0 && (
                <p>{t.failed(result.failed.join(", "))}</p>
              )}
            </>
          )}
        </div>
      )}
    </Well>
  );
}
