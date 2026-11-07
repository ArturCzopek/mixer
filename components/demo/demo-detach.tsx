"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { VButton } from "@/components/vgui";
import { useT } from "@/components/i18n";
import { detachDemoFromMatch } from "@/lib/demo/actions";

type DetachError = "forbidden" | "detachLegacy" | "failed";

/** D23: a group admin removes a wrong or forged demo; the map gets its earlier stats back. */
export function DemoDetach({ matchId }: { matchId: string }) {
  const t = useT();
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [issue, setIssue] = React.useState<DetachError | null>(null);

  const detach = () =>
    startTransition(async () => {
      setIssue(null);
      const result = await detachDemoFromMatch(matchId);
      if ("ok" in result) {
        setConfirming(false);
        router.refresh();
        return;
      }
      setIssue(
        result.error === "forbidden" || result.error === "detachLegacy"
          ? result.error
          : "failed",
      );
    });

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
      {!confirming ? (
        <VButton type="button" onClick={() => setConfirming(true)}>
          {t.demo.detach}
        </VButton>
      ) : (
        <>
          <span>{t.demo.detachConfirm}</span>
          <VButton type="button" primary disabled={pending} onClick={detach}>
            {pending ? t.demo.detaching : t.demo.detachYes}
          </VButton>
          <VButton
            type="button"
            disabled={pending}
            onClick={() => setConfirming(false)}
          >
            {t.demo.cancel}
          </VButton>
        </>
      )}
      {issue && (
        <p role="alert" className="text-loss w-full">
          {t.demo.detachFailed[issue]}
        </p>
      )}
    </div>
  );
}
