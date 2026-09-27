"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { browserDb } from "@/lib/db/browser";

export function LobbyRealtime({ mixId }: { mixId: string }) {
  const router = useRouter();

  useEffect(() => {
    const client = browserDb();
    if (!client) return;

    const channel = client
      .channel(`mix-lobby:${mixId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mix_participants",
          filter: `mix_id=eq.${mixId}`,
        },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "mix_participants" },
        (payload) => {
          if (payload.old.mix_id === mixId) router.refresh();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "mixes",
          filter: `id=eq.${mixId}`,
        },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [mixId, router]);

  return null;
}
