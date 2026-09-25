// Loads the backtest fixtures (TEST DATA ONLY, D25): popflash club maps and the players' FACEIT
// history recorded by scripts/backtest-data.mjs. The only file of the module that touches the disk.

import { readdirSync, readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { MatchResult, RealEloRow } from "./elo-history";

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

export interface FaceitResults {
  steamId: string;
  eloNow: number | null;
  results: MatchResult[];
}

export interface BacktestData {
  matches: PopflashMatch[];
  /** popflashId → SteamID64 of the person (second accounts merged into the main one). */
  steamIdOf: Map<string, string>;
  /** SteamID64 → a readable name (roster name or FACEIT nickname). */
  nameOf: Map<string, string>;
  faceit: Map<string, FaceitHistory>;
  /** Every FACEIT result up to the recording day, for rebuilding ELO at a map (may be empty). */
  results: Map<string, FaceitResults>;
  /** Real ELO history from backtest/.local/faceit-elo.json (local only, never committed); empty without it. */
  realElo: Map<string, RealEloRow[]>;
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
  const results = new Map<string, FaceitResults>();
  const resultsDir = join(FIX, "backtest/faceit-results");
  if (existsSync(resultsDir))
    for (const file of readdirSync(resultsDir)) {
      if (!/^\d+\.json$/.test(file)) continue;
      const r = readJson<FaceitResults>(`backtest/faceit-results/${file}`);
      results.set(r.steamId, r);
    }
  const steamIdOf = new Map<string, string>();
  const nameOf = new Map<string, string>();
  for (const p of players) {
    const id = p.mergeInto ?? p.steamId;
    steamIdOf.set(p.popflashId, id);
    if (!p.mergeInto)
      nameOf.set(id, p.who ?? faceit.get(id)?.nickname ?? p.name);
  }
  const realElo = new Map<string, RealEloRow[]>();
  const realFile = join(__dirname, ".local/faceit-elo.json");
  if (existsSync(realFile))
    for (const [id, rows] of Object.entries(
      JSON.parse(readFileSync(realFile, "utf8")) as Record<
        string,
        RealEloRow[]
      >,
    ))
      realElo.set(id, rows);
  return {
    realElo,
    matches: [...matches].sort((a, b) => a.date.localeCompare(b.date)),
    steamIdOf,
    nameOf,
    faceit,
    results,
  };
}
