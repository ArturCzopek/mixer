// Illustrative data for the design preview (`/design/mix`). Real names and ELO from the recorded
// fixtures; form numbers, votes and the result are made up. Replaced by DB data in M1-5..M1-7.

export interface MockPlayer {
  steamId: string;
  name: string;
  avatar: string;
  level: number;
  /** Skill score parts (docs/04): E FACEIT ELO, M mix form; F is derived from `form`. */
  E: number;
  M: number;
  form: { maps: number; recent: number; before: number };
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
    M: 0,
    form: { maps: 22, recent: 1.18, before: 1.12 },
  },
  smiley: {
    steamId: "76561198004643533",
    name: "sm1leyz",
    avatar: avatar("f55a27a898f5b4a904b6082336c5a400ad0745fc"),
    level: 10,
    E: 2042,
    M: 0,
    form: { maps: 9, recent: 1.02, before: 1.08 },
  },
  czopo: {
    steamId: "76561197993187687",
    name: "czopo",
    avatar: avatar("d8a6babc2ce4607cbd84d1c8d0012ab306bf0a95"),
    level: 9,
    E: 1797,
    M: 0,
    form: { maps: 14, recent: 1.23, before: 1.02 },
  },
  jawola: {
    steamId: "76561197990522246",
    name: "jawOla21",
    avatar: avatar("1df3535a6f4c9bcf76d310fff46700d18b98412c"),
    level: 7,
    E: 1510,
    M: 0,
    form: { maps: 31, recent: 0.97, before: 0.98 },
  },
  stan: {
    steamId: "76561197976084038",
    name: "stannn",
    avatar: avatar("35dfb61aa54766bfb7e21c6e4c7c4be9e33746af"),
    level: 7,
    E: 1420,
    M: 0,
    form: { maps: 12, recent: 1.11, before: 1.02 },
  },
  janex: {
    steamId: "76561197990797581",
    name: "J4neX",
    avatar: avatar("08308f69be2b8778624c99b4cbd22b6129b48ba9"),
    level: 7,
    E: 1414,
    M: 0,
    form: { maps: 18, recent: 0.91, before: 1.0 },
  },
  chelmut: {
    steamId: "76561198148296203",
    name: "botjacek",
    avatar: avatar("a86d93098a6f1da4e576e770feb1b8b90b27dd83"),
    level: 7,
    E: 1409,
    M: 0,
    form: { maps: 6, recent: 1.08, before: 1.02 },
  },
  windxore: {
    steamId: "76561198014771816",
    name: "Windxore",
    avatar: avatar("c6a7db2b413531b5985235b14426883116581969"),
    level: 6,
    E: 1277,
    M: 0,
    form: { maps: 40, recent: 1.14, before: 0.97 },
  },
  roevs: {
    steamId: "76561198063581077",
    name: "roevs",
    avatar: avatar("19c6fa0ba96030c8cc25130dca324362ee965212"),
    level: 6,
    E: 1248,
    M: 0,
    form: { maps: 11, recent: 0.95, before: 1.0 },
  },
  coma: {
    steamId: "76561199126921648",
    name: "mrhsmrcyg",
    avatar: avatar("8dfe278c7493b6984540e57ecd57b791df13841e"),
    level: 5,
    E: 1126,
    M: 0,
    form: { maps: 3, recent: 1.06, before: 1.01 },
  },
};

/** F from docs/04 with the default config (k = 10, beta = 500, max 150). */
export function formBreakdown(p: MockPlayer) {
  const { maps, recent, before } = p.form;
  const ratio = recent / before;
  const shrunk = (maps * ratio + 10) / (maps + 10);
  const F = Math.round(Math.max(-150, Math.min(150, 500 * (shrunk - 1))));
  return { ratio, shrunk, F };
}

export const skill = (p: MockPlayer) => p.E + formBreakdown(p).F + p.M;

export interface MockVariant {
  number: number;
  teamA: MockPlayer[];
  teamB: MockPlayer[];
  votes: number;
  badges: string[];
}

const p = players;
export const variants: MockVariant[] = [
  {
    number: 1,
    votes: 4,
    badges: ["Top duo split"],
    teamA: [p.fontek, p.jawola, p.stan, p.chelmut, p.roevs],
    teamB: [p.smiley, p.czopo, p.janex, p.windxore, p.coma],
  },
  {
    number: 2,
    votes: 3,
    badges: ["Top duo split", "Bottom duo split"],
    teamA: [p.fontek, p.stan, p.janex, p.windxore, p.coma],
    teamB: [p.smiley, p.czopo, p.jawola, p.chelmut, p.roevs],
  },
  {
    number: 3,
    votes: 2,
    badges: ["Top duo split"],
    teamA: [p.fontek, p.jawola, p.janex, p.windxore, p.roevs],
    teamB: [p.smiley, p.czopo, p.stan, p.chelmut, p.coma],
  },
];

export const lobby: (MockPlayer | null)[] = [
  p.czopo,
  p.fontek,
  p.stan,
  p.janex,
  p.windxore,
  p.jawola,
  p.coma,
  p.roevs,
  null,
  null,
];

export const mix = {
  number: 14,
  when: "Thu 21:00",
  group: "Skarpeciarze i pantofle",
  /** Who has not voted yet (voting state). */
  waitingFor: p.coma,
  me: p.czopo,
};

export const result = {
  maps: [
    { map: "Nuke", a: 16, b: 12 },
    { map: "Anubis", a: 13, b: 10 },
    { map: "Mirage", a: 10, b: 13 },
  ],
  source: "FACEIT",
  scoreboard: [
    {
      player: p.fontek,
      team: "A",
      k: 32,
      a: 6,
      d: 19,
      adr: 125.2,
      rating: 1.54,
    },
    {
      player: p.windxore,
      team: "B",
      k: 27,
      a: 6,
      d: 20,
      adr: 103.1,
      rating: 1.31,
    },
    { player: p.czopo, team: "B", k: 22, a: 8, d: 18, adr: 81.5, rating: 1.12 },
    { player: p.stan, team: "A", k: 20, a: 3, d: 19, adr: 85.9, rating: 1.08 },
    {
      player: p.jawola,
      team: "A",
      k: 17,
      a: 2,
      d: 20,
      adr: 68.8,
      rating: 0.94,
    },
  ],
};
