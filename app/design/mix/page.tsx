import type { Metadata } from "next";
import { MixView } from "@/components/mix/mix-view";
import { parseMixState, StateSwitcher } from "@/components/mix/state-switcher";
import { mockViewData } from "@/lib/mock/mix";

export const metadata: Metadata = { title: "Mix #14 · design preview · mixer" };

export default async function MixPreviewPage({
  searchParams,
}: PageProps<"/design/mix">) {
  const { state } = await searchParams;
  const current = parseMixState(state, "voting");
  return (
    <>
      <StateSwitcher label="Preview:" current={current} />
      <MixView key={current} state={current} data={mockViewData()} />
    </>
  );
}
