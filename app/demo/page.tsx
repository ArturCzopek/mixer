import type { Metadata } from "next";
import { MixView } from "@/components/mix/mix-view";
import { parseMixState, StateSwitcher } from "@/components/mix/state-switcher";
import { getDict } from "@/lib/i18n/server";
import { showcaseViewData } from "@/lib/showcase/evening";

export const metadata: Metadata = {
  title: "Showcase mix · 16 Dec 2024 · mixer",
  description:
    "Our real popflash evening of 16 Dec 2024 replayed through the mixer: balanced variants, voting, lineup and results.",
};

export default async function ShowcasePage({
  searchParams,
}: PageProps<"/demo">) {
  const { state } = await searchParams;
  const current = parseMixState(state, "voting");
  const t = await getDict();
  return (
    <>
      <StateSwitcher
        label={t.switcher.label}
        current={current}
        names={t.switcher}
      />
      <MixView key={current} state={current} data={await showcaseViewData()} />
    </>
  );
}
