import type { Metadata } from "next";
import { MixView } from "@/components/mix/mix-view";
import { parseMixState, StateSwitcher } from "@/components/mix/state-switcher";
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
  return (
    <>
      <StateSwitcher
        label="Showcase:"
        current={current}
        names={{
          lobby: "1 lobby",
          voting: "2 voting",
          locked: "3 lineup",
          played: "4 result",
        }}
      />
      <MixView key={current} state={current} data={await showcaseViewData()} />
    </>
  );
}
