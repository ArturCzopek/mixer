// Illustrative data for the design preview (`/design/mix`). Real names and ELO from the recorded
// fixtures; form numbers, votes and the result are made up. Replaced by DB data in M1-5..M1-7.

import {
  DEFAULT_BALANCE_CONFIG,
  faceitMatchRating,
  generateVariants,
  skillScore,
  type PlayerInput,
  type SkillBreakdown,
  type Variant,
} from "@/lib/balance";

export interface MockPlayer {
  steamId: string;
  name: string;
  avatar: string;
  level: number;
  /** FACEIT ELO (E in docs/04). */
  E: number;
  /**
   * Made-up FACEIT history fed to the real engine: `matches` in the last 30 days at rating `recent`,
   * played over `sessions` evenings, and 30 older matches at `before` as the baseline.
   */
  form: { matches: number; sessions: number; recent: number; before: number };
}

const avatar = (hash: string) =>
  `https://avatars.steamstatic.com/${hash}_medium.jpg`;

export const players: Record<string, MockPlayer> = {
  fontek: {
    steamId: "76561197960551471",
    name: "fontek385",
    avatar: avatar("31999d46685f965e7eedc9fe19174af090ba3de6"),
    level: 10,
    E: 2189,
    form: { matches: 22, sessions: 8, recent: 1.18, before: 1.12 },
  },
  smiley: {
    steamId: "76561198004643533",
    name: "sm1leyz",
    avatar: avatar("f55a27a898f5b4a904b6082336c5a400ad0745fc"),
    level: 10,
    E: 2042,
    form: { matches: 0, sessions: 0, recent: 0, before: 1.08 },
  },
  czopo: {
    steamId: "76561197993187687",
    name: "czopo",
    avatar: avatar("d8a6babc2ce4607cbd84d1c8d0012ab306bf0a95"),
    level: 9,
    E: 1797,
    form: { matches: 14, sessions: 5, recent: 1.23, before: 1.02 },
  },
  jawola: {
    steamId: "76561197990522246",
    name: "jawOla21",
    avatar: avatar("1df3535a6f4c9bcf76d310fff46700d18b98412c"),
    level: 7,
    E: 1510,
    form: { matches: 31, sessions: 10, recent: 0.97, before: 0.98 },
  },
  stan: {
    steamId: "76561197976084038",
    name: "stannn",
    avatar: avatar("35dfb61aa54766bfb7e21c6e4c7c4be9e33746af"),
    level: 7,
    E: 1420,
    form: { matches: 12, sessions: 4, recent: 1.11, before: 1.02 },
  },
  janex: {
    steamId: "76561197990797581",
    name: "J4neX",
    avatar: avatar("08308f69be2b8778624c99b4cbd22b6129b48ba9"),
    level: 7,
    E: 1414,
    form: { matches: 18, sessions: 6, recent: 0.91, before: 1.0 },
  },
  chelmut: {
    steamId: "76561198148296203",
    name: "botjacek",
    avatar: avatar("a86d93098a6f1da4e576e770feb1b8b90b27dd83"),
    level: 7,
    E: 1409,
    form: { matches: 6, sessions: 2, recent: 1.08, before: 1.02 },
  },
  windxore: {
    steamId: "76561198014771816",
    name: "Windxore",
    avatar: avatar("c6a7db2b413531b5985235b14426883116581969"),
    level: 6,
    E: 1277,
    form: { matches: 40, sessions: 12, recent: 1.14, before: 0.97 },
  },
  roevs: {
    steamId: "76561198063581077",
    name: "roevs",
    avatar: avatar("19c6fa0ba96030c8cc25130dca324362ee965212"),
    level: 6,
    E: 1248,
    form: { matches: 11, sessions: 4, recent: 0.95, before: 1.0 },
  },
  coma: {
    steamId: "76561199126921648",
    name: "mrhsmrcyg",
    avatar: avatar("8dfe278c7493b6984540e57ecd57b791df13841e"),
    level: 5,
    E: 1126,
    form: { matches: 3, sessions: 1, recent: 1.06, before: 1.01 },
  },
};

/** "Now" for the preview, so the made-up history always lands in the same windows. */
export const NOW = new Date("2026-09-24T12:00:00Z");
const HOUR = 3_600_000;

/** Turns the made-up form numbers into the engine's input (FACEIT history with timestamps). */
function toInput(p: MockPlayer): PlayerInput {
  const { matches, sessions, recent, before } = p.form;
  const at = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
  const history = [
    // Recent matches, spread over `sessions` evenings two days apart, one hour between maps.
    ...Array.from({ length: matches }, (_, i) => ({
      finishedAt: at(((i % sessions) * 2 + 1) * 24 * HOUR + (i % 3) * HOUR),
      rating: recent,
    })),
    // Baseline: 30 older matches, 45+ days ago.
    ...Array.from({ length: 30 }, (_, i) => ({
      finishedAt: at((45 + i) * 24 * HOUR),
      rating: before,
    })),
  ];
  return { steamId: p.steamId, faceitElo: p.E, faceit: { matches: history } };
}

const breakdowns = new Map(
  Object.values(players).map((pl) => [
    pl.steamId,
    skillScore(
      toInput(pl),
      { now: NOW, groupRating: null },
      DEFAULT_BALANCE_CONFIG,
    ),
  ]),
);

/** The engine's full explanation of a player's S (M1-4b). */
export const explain = (p: MockPlayer): SkillBreakdown =>
  breakdowns.get(p.steamId)!;
export const skill = (p: MockPlayer) => explain(p).S;
export const config = DEFAULT_BALANCE_CONFIG;

export interface MockVariant {
  number: number;
  teamA: MockPlayer[];
  teamB: MockPlayer[];
  votes: number;
  /** The engine's variant: averages, win chance, cost split, duo status. */
  engine: Variant;
}

const p = players;
const bySteamId = new Map(Object.values(players).map((pl) => [pl.steamId, pl]));
const generated = generateVariants({
  players: [...breakdowns.values()],
  config: DEFAULT_BALANCE_CONFIG,
});
/** Splits left after hard rules, for "rank x of n" in the explanation. */
export const candidateCount = generated.candidateCount;
const VOTES = [4, 3, 2];
export const variants: MockVariant[] = generated.variants.map((v, i) => ({
  number: i + 1,
  votes: VOTES[i],
  teamA: v.teamA.map((b) => bySteamId.get(b.steamId)!),
  teamB: v.teamB.map((b) => bySteamId.get(b.steamId)!),
  engine: v,
}));

/** Everyone in the mix, in join order (D28); `joinedAt` is local time on mix day. */
export const participants: { player: MockPlayer; joinedAt: string }[] = [
  { player: p.fontek, joinedAt: "11:02" },
  { player: p.stan, joinedAt: "11:15" },
  { player: p.janex, joinedAt: "11:40" },
  { player: p.windxore, joinedAt: "12:03" },
  { player: p.jawola, joinedAt: "12:30" },
  { player: p.coma, joinedAt: "13:10" },
  { player: p.roevs, joinedAt: "13:45" },
  { player: p.czopo, joinedAt: "14:20" },
  { player: p.smiley, joinedAt: "15:05" },
  { player: p.chelmut, joinedAt: "16:30" },
];

/** Players sorted by when they joined the mix. */
export const byJoinOrder = (team: MockPlayer[]) =>
  [...team].sort(
    (a, b) =>
      participants.findIndex((x) => x.player === a) -
      participants.findIndex((x) => x.player === b),
  );

export const mix = {
  number: 14,
  when: "Thu 21:00",
  group: "Skarpeciarze i pantofle",
  /** Who has not voted yet (voting state). */
  waitingFor: p.coma,
  me: p.czopo,
};

/** Lobby state: everyone who joined before `me` (who has not joined yet). */
export const lobby = participants.slice(
  0,
  participants.findIndex((x) => x.player === mix.me),
);

// --- result (played state) --------------------------------------------------------------------

export interface MapLine {
  player: MockPlayer;
  team: "A" | "B";
  k: number;
  a: number;
  d: number;
  adr: number;
  /** Mixer Rating from FACEIT stats (KAST fixed until demo extras, M2-3). */
  rating: number;
  rounds: number;
}

export interface MapResult {
  map: string;
  a: number;
  b: number;
  lines: MapLine[];
}

const MAPS = [
  { map: "Nuke", a: 16, b: 12 },
  { map: "Anubis", a: 13, b: 10 },
  { map: "Mirage", a: 10, b: 13 },
  { map: "Ancient", a: 11, b: 13 },
  { map: "Inferno", a: 13, b: 9 },
];

/** Deterministic pseudo-random numbers (mulberry32), so the preview never changes between renders. */
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Splits `total` into integers proportional to `weights` (largest remainder). */
function share(total: number, weights: number[]) {
  const sum = weights.reduce((s, w) => s + w, 0);
  const exact = weights.map((w) => (total * w) / sum);
  const out = exact.map(Math.floor);
  const order = exact
    .map((x, i) => [x - Math.floor(x), i] as const)
    .sort((x, y) => y[0] - x[0]);
  for (let i = 0; i < total - out.reduce((s, x) => s + x, 0); i++)
    out[order[i][1]]++;
  return out;
}

/** Made-up but self-consistent scoreboards for the locked lineup (team kills = enemy deaths). */
function simulate(teamA: MockPlayer[], teamB: MockPlayer[]): MapResult[] {
  const rnd = random(14);
  return MAPS.map(({ map, a, b }) => {
    const rounds = a + b;
    const side = (team: MockPlayer[], won: number, lost: number) => {
      const kills = Math.round(4.2 * won + 2.4 * lost + rnd() * 6);
      const strength = team.map(
        (pl) => (skill(pl) / 1500) ** 2 * (0.6 + 0.8 * rnd()),
      );
      return { kills, strength };
    };
    const sa = side(teamA, a, b);
    const sb = side(teamB, b, a);
    const lines = (
      team: MockPlayer[],
      mine: typeof sa,
      theirs: typeof sa,
      label: "A" | "B",
    ): MapLine[] => {
      const k = share(mine.kills, mine.strength);
      const d = share(
        theirs.kills,
        mine.strength.map((w) => 1 / (w + 0.4)),
      );
      return team.map((player, i) => {
        const assists = Math.round(rounds * (0.08 + 0.14 * rnd()));
        const adr =
          Math.round(((k[i] / rounds) * 88 + 8 + 14 * rnd()) * 10) / 10;
        return {
          player,
          team: label,
          k: k[i],
          a: assists,
          d: d[i],
          adr,
          rounds,
          rating: faceitMatchRating({
            kills: k[i],
            deaths: d[i],
            assists,
            rounds,
            adr,
          }),
        };
      });
    };
    return {
      map,
      a,
      b,
      lines: [...lines(teamA, sa, sb, "A"), ...lines(teamB, sb, sa, "B")],
    };
  });
}

/** Sums one player's lines over all maps (ADR and rating weighted by rounds). */
export function totals(maps: MapResult[]): MapLine[] {
  const byId = new Map<string, MapLine>();
  for (const line of maps.flatMap((m) => m.lines)) {
    const t = byId.get(line.player.steamId);
    if (!t) {
      byId.set(line.player.steamId, { ...line });
      continue;
    }
    const rounds = t.rounds + line.rounds;
    t.adr = (t.adr * t.rounds + line.adr * line.rounds) / rounds;
    t.rating = (t.rating * t.rounds + line.rating * line.rounds) / rounds;
    t.k += line.k;
    t.a += line.a;
    t.d += line.d;
    t.rounds = rounds;
  }
  return [...byId.values()];
}

const locked = variants[0];
const maps = simulate(locked.teamA, locked.teamB);

export const result = {
  maps,
  all: totals(maps),
  source: "FACEIT",
};
