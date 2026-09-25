// Loads the backtest fixtures (TEST DATA ONLY, D25): popflash club maps and the players' FACEIT
// history recorded by scripts/backtest-data.mjs. The only file of the module that touches the disk.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const FIX = join(__dirname, "../lib/balance/__fixtures__");

export interface PopflashLine {
  popflashId: string;
  name: string | null;
  team: number;
  kills: number;
  assists: number;
  deaths: number;
  adr: number;
  rounds: number;
  kast: number | null;
  popflashRating: number | null;
  [stat: string]: unknown;
}

export interface PopflashMatch {
  id: string;
  date: string;
  map: string;
  score1: number;
  score2: number;
  winner: number;
  rounds: number;
  players: PopflashLine[];
}

export interface FaceitRecord {
  matchId: string;
  finishedAt: string;
  gameMode: string;
  competitionId: string | null;
  map: string;
  kills: number;
  deaths: number;
  assists: number;
  rounds: number;
  adr: number | null;
  won: boolean;
}

export interface FaceitHistory {
  steamId: string;
  nickname: string;
  eloNow: number | null;
  levelNow: number | null;
  stats: FaceitRecord[];
}

export interface PopflashPlayer {
  popflashId: string;
  name: string;
  steamId: string;
  mergeInto?: string;
  who?: string | null;
  faceitNickname?: string;
}

export interface BacktestData {
  matches: PopflashMatch[];
  /** popflashId → SteamID64 of the person (second accounts merged into the main one). */
  steamIdOf: Map<string, string>;
  /** SteamID64 → a readable name (roster name or FACEIT nickname). */
  nameOf: Map<string, string>;
  faceit: Map<string, FaceitHistory>;
}

const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(join(FIX, path), "utf8")) as T;

export function loadBacktestData(): BacktestData {
  const { matches } = readJson<{ matches: PopflashMatch[] }>(
    "popflash/matches.json",
  );
  const { players } = readJson<{ players: PopflashPlayer[] }>(
    "popflash/players.json",
  );
  const faceit = new Map<string, FaceitHistory>();
  for (const file of readdirSync(join(FIX, "backtest/faceit"))) {
    if (!/^\d+\.json$/.test(file)) continue;
    const h = readJson<FaceitHistory>(`backtest/faceit/${file}`);
    faceit.set(h.steamId, h);
  }
  const steamIdOf = new Map<string, string>();
  const nameOf = new Map<string, string>();
  for (const p of players) {
    const id = p.mergeInto ?? p.steamId;
    steamIdOf.set(p.popflashId, id);
    if (!p.mergeInto)
      nameOf.set(id, p.who ?? faceit.get(id)?.nickname ?? p.name);
  }
  return {
    matches: [...matches].sort((a, b) => a.date.localeCompare(b.date)),
    steamIdOf,
    nameOf,
    faceit,
  };
}
