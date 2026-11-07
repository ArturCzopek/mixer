"use client";

import { useEffect } from "react";
import { useT } from "@/components/i18n";
import { ErrorPanel } from "@/components/vgui/error-panel";

export default function RouteError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useT().errorPage;
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <ErrorPanel
      title={t.errorTitle}
      message={t.error}
      homeLabel={t.home}
      retry={{ label: t.retry, onClick: retry }}
    />
  );
}
