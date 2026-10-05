export type MixNotice = "created" | "locked" | "played";

export interface MixNoticeData {
  title: string;
  url: string | null;
  teamA?: string[];
  teamB?: string[];
  maps?: { mapName: string | null; scoreA: number; scoreB: number }[];
}

/** Text for the group's Discord channel; mentions are disabled when posting. */
export function mixNoticeText(event: MixNotice, mix: MixNoticeData): string {
  const lines =
    event === "created"
      ? [`🆕 New mix: **${mix.title}**. Sign up on Mixer.`]
      : event === "locked"
        ? [
            `🔒 Lineup locked: **${mix.title}**`,
            `Team A: ${(mix.teamA ?? []).join(", ")}`,
            `Team B: ${(mix.teamB ?? []).join(", ")}`,
          ]
        : [
            `🏁 Results: **${mix.title}**`,
            ...(mix.maps ?? []).map(
              (map, index) =>
                `${map.mapName ?? `Map ${index + 1}`}: ${map.scoreA}:${map.scoreB}`,
            ),
          ];
  if (mix.url) lines.push(mix.url);
  return lines.join("\n").slice(0, 2000);
}
