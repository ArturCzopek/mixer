"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n";
import { VButton } from "@/components/vgui";
import { browserDb } from "@/lib/db/browser";
import { joinMix, type MixActionError } from "@/lib/mix/actions";

export function HomeRealtime() {
  const router = useRouter();

  useEffect(() => {
    const client = browserDb();
    if (!client) return;

    // The home page lists every group's mixes, so it hears every join and vote; coalesce a burst
    // (ten players joining, an evening of votes) into one refresh instead of one per row.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 1_000);
    };
    const channel = client
      .channel("home-mixes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mix_participants" },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mixes" },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "votes" },
        refresh,
      )
      .subscribe();

    return () => {
      clearTimeout(timer);
      void client.removeChannel(channel);
    };
  }, [router]);

  return null;
}

export function HomeJoinButton({ mixId }: { mixId: string }) {
  const t = useT();
  const router = useRouter();
  const [error, setError] = useState<MixActionError>();
  const [pending, startTransition] = useTransition();

  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      <VButton
        type="button"
        primary
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await joinMix(mixId);
            setError(result && "error" in result ? result.error : undefined);
            router.refresh();
          })
        }
      >
        {t.actions.join}
      </VButton>
      {error && (
        <span
          role="alert"
          className="text-alert max-w-28 text-right text-[10px]"
        >
          {t.lobby.errors[error]}
        </span>
      )}
    </span>
  );
}
