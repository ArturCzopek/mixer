// Showcase mix (`/demo`): the real popflash evening of 16.12.2024 run through the real engine.
// Real: players, their engine inputs as of that evening, the lineup played, every map and line.
// Made up (and said so on the page): join times, votes, who was late. The Leetify card is live
// (last 30 days before today, never stored). Server only.

import {
  DEFAULT_BALANCE_CONFIG,
  enumerateSplits,
  generateVariants,
  skillScore,
  winProbability,
  type PlayerInput,
} from "@/lib/balance";
import { getFaceitMatches } from "@/lib/external/leetify";
import { previewVoters, type MixViewData } from "@/lib/mix/view";
import evening from "./evening-2024-12-16.json";

const OWNER = "76561197993187687";
const config = DEFAULT_BALANCE_CONFIG;

export async function showcaseViewData(): Promise<MixViewData> {
  const at = new Date(evening.date);
  const breakdowns = Object.fromEntries(
    evening.players.map((p) => [
      p.steamId,
      skillScore(
        p.input as PlayerInput,
        { now: new Date(at.getTime() - 1), groupRating: evening.groupRating },
        config,
      ),
    ]),
  );
  const S = (id: string) => breakdowns[id].S;
  const avg = (team: string[]) =>
    team.reduce((s, id) => s + S(id), 0) / team.length;

  const generated = generateVariants({
    players: Object.values(breakdowns),
    config,
  });
  // A 4 : 4 tie on purpose, to show the random tie-break (D33).
  const votes = [4, 4, 1];

  // How the engine would have ranked the lineup they actually played, by evenness.
  const ids = evening.players.map((p) => p.steamId);
  const gap = (a: string[], b: string[]) =>
    Math.abs(winProbability(avg(a), avg(b)) - 0.5);
  const real = gap(evening.teamA, evening.teamB);
  const rank =
    1 +
    enumerateSplits(ids).filter(([a, b]) => gap(a, b) < real - 1e-12).length;
  const avgA = avg(evening.teamA);
  const avgB = avg(evening.teamB);

  // Made-up join order: the real team A first, then team B.
  const joinOrder = [...evening.teamA, ...evening.teamB].filter(
    (id) => id !== OWNER,
  );
  joinOrder.splice(7, 0, OWNER);
  const waitingForId = evening.teamB[evening.teamB.length - 1];
  const voters = previewVoters(joinOrder, waitingForId, votes);
  const times = [
    "10:12",
    "10:40",
    "11:05",
    "12:18",
    "12:55",
    "13:30",
    "14:02",
    "14:47",
    "16:10",
    "17:25",
  ];

  const now = new Date();
  const window = { from: new Date(now.getTime() - 30 * 86_400_000), to: now };
  const leetify = process.env.LEETIFY_API_KEY
    ? Object.fromEntries(
        await Promise.all(
          ids.map(async (id) => [
            id,
            await getFaceitMatches(id, window).catch(() => null),
          ]),
        ),
      )
    : null;

  return {
    mix: {
      id: "showcase-2024-12-16",
      number: 1,
      when: "Mon 20:45",
      group: "Skarpeciarze i pantofle",
      meId: OWNER,
      waitingForId,
    },
    mixAt: at.toISOString(),
    players: evening.players.map(({ steamId, name, avatar, level }) => ({
      steamId,
      name,
      avatar,
      level,
    })),
    breakdowns,
    config,
    candidateCount: generated.candidateCount,
    variants: generated.variants.map((v, i) => ({
      number: i + 1,
      votes: votes[i] ?? 0,
      voters: voters[i] ?? [],
      teamA: v.teamA.map((b) => b.steamId),
      teamB: v.teamB.map((b) => b.steamId),
      engine: v,
    })),
    participants: joinOrder.map((steamId, i) => ({
      steamId,
      joinedAt: times[i],
    })),
    lobbyCount: joinOrder.indexOf(OWNER),
    alwaysTogether: generated.alwaysTogether,
    viewerIsAdmin: true,
    result: {
      source: "popflash",
      maps: evening.maps.map((m) => ({
        map: m.map,
        a: m.a,
        b: m.b,
        lines: m.lines.map((l) => ({ ...l, team: l.team as "A" | "B" })),
      })),
    },
    leetify: leetify && {
      window: {
        from: window.from.toISOString(),
        to: window.to.toISOString(),
        live: true,
      },
      matches: leetify,
    },
    showcase: {
      title: "Showcase: our popflash evening of 16 Dec 2024",
      notes: [
        "Real: the ten of us, the teams we played, every map score and every K/A/D/ADR line.",
        "Real engine: skill S from each player's FACEIT history before that evening (ELO is today's).",
        "Made up: join times, votes (a 4 : 4 tie on purpose) and who was late. Buttons do nothing yet.",
        "Leetify card: live, the last 30 days before today (Leetify keeps no 2024 matches), never stored.",
      ],
      real: {
        teamA: evening.teamA,
        teamB: evening.teamB,
        avgA,
        avgB,
        winProbA: winProbability(avgA, avgB),
        rank,
      },
    },
  };
}
