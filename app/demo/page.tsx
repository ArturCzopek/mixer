import type { Metadata } from "next";
import { SwitchableMix } from "@/components/mix/state-switcher";
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
  const t = await getDict();
  return (
    <SwitchableMix
      initial={state}
      fallback="voting"
      data={await showcaseViewData()}
      label={t.switcher.label}
      names={t.switcher}
    />
  );
}
