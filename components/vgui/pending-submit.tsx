"use client";

import { useFormStatus } from "react-dom";
import { VButton } from "@/components/vgui";

export function PendingSubmit({
  children,
  pendingLabel,
  primary = false,
  className,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  primary?: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <VButton
      type="submit"
      primary={primary}
      disabled={pending}
      className={className}
    >
      {pending ? pendingLabel : children}
    </VButton>
  );
}
