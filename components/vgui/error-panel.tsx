import Link from "next/link";
import { VButton, Well, Window } from "@/components/vgui";

/** A not-found or failed page, inside the olive world with a way back. */
export function ErrorPanel({
  title,
  message,
  homeLabel,
  retry,
}: {
  title: string;
  message: string;
  homeLabel: string;
  retry?: { label: string; onClick: () => void };
}) {
  return (
    <main className="mx-auto w-full max-w-[460px] flex-1 px-2 py-6">
      <Window title={title}>
        <Well role="alert" className="text-dim mb-2 px-2 py-1.5 text-[11px]">
          <span
            aria-hidden
            className="bg-alert mr-1.5 inline-block size-[7px] align-[1px]"
          />
          {message}
        </Well>
        <div className="flex flex-wrap justify-end gap-2">
          <Link
            href="/"
            className="bevel bg-sheet text-text hover:bg-hover px-3 py-2.5 text-[13px] font-bold no-underline"
          >
            {homeLabel}
          </Link>
          {retry && (
            <VButton type="button" primary onClick={retry.onClick}>
              {retry.label}
            </VButton>
          )}
        </div>
      </Window>
    </main>
  );
}
