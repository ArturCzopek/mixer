// Backtest with the REAL FACEIT ELO at each map (local only): `npx tsx backtest/run-real-elo.ts`
// → backtest/.local/REPORT-real-elo.md. Needs backtest/.local/faceit-elo.json (ELO per match from
// FACEIT's site API, fetched by hand from a browser; not an official source, so the data and this
// report stay out of git). Compares ELO today / rebuilt (±25) / real for the same maps.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadBacktestData } from "./data";
import { realEloAt } from "./elo-history";
import { evaluate, fitScale, models } from "./evaluate";
import { brier, favouriteWinRate, logLoss } from "./metrics";

const data = loadBacktestData();
if (data.realElo.size === 0) {
  console.error("No backtest/.local/faceit-elo.json: nothing to compare.");
  process.exit(1);
}

const out: string[] = [];
const say = (line = "") => out.push(line);
const f = (x: number, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : "–");
const pct = (x: number) =>
  Number.isFinite(x) ? `${(100 * x).toFixed(1)} %` : "–";
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

say("# Backtest with real FACEIT ELO per map (local only)");
say();
say(
  `Generated ${new Date().toISOString()}. Real ELO for ${data.realElo.size} players from ` +
    "FACEIT's site API (ELO after every match). Not committed.",
);
say();
say("| Model | E | Maps | Log-loss | Brier | Fav. won | Best k |");
say("|---|---|---|---|---|---|---|");
for (const model of models().filter((m) =>
  ["elo", "f-asym", "e-a", "no-a", "full"].includes(m.id),
)) {
  for (const elo of ["now", "rebuilt", "real"] as const) {
    const r = evaluate(data, model.config, { elo });
    const preds = r.maps.map((m) => m.pred);
    say(
      `| ${model.name} | ${elo === "now" ? "today" : elo} | ${r.maps.length} | ${f(logLoss(preds))} | ${f(brier(preds))} | ` +
        `${pct(favouriteWinRate(preds).rate)} | ${f(fitScale(r.maps).k, 2)} |`,
    );
  }
}
say();

// How far off were today's ELO and the ±25 rebuild, per player-map?
const full = models().find((m) => m.id === "full")!;
const byElo = (elo: "now" | "rebuilt" | "real") =>
  evaluate(data, full.config, { elo }).maps;
const [now, rebuilt, real] = [byElo("now"), byElo("rebuilt"), byElo("real")];
const rows: {
  id: string;
  date: string;
  now: number;
  rebuilt: number;
  real: number;
}[] = [];
real.forEach((m, i) => {
  const players = [...m.team1, ...m.team2];
  players.forEach((p, k) => {
    if (!data.realElo.get(p.steamId)) return;
    const at = new Date(m.match.date);
    const realE = realEloAt(data.realElo.get(p.steamId)!, at);
    if (realE === null) return;
    rows.push({
      id: p.steamId,
      date: m.match.date,
      now: [...now[i].team1, ...now[i].team2][k].E,
      rebuilt: [...rebuilt[i].team1, ...rebuilt[i].team2][k].E,
      real: realE,
    });
  });
});
say(
  `Mean |today − real| ${f(mean(rows.map((r) => Math.abs(r.now - r.real))), 0)} ELO, ` +
    `mean |rebuilt − real| ${f(mean(rows.map((r) => Math.abs(r.rebuilt - r.real))), 0)} ELO ` +
    `(${rows.length} player-maps).`,
);
say();
say(
  "| Player | Maps | ELO today | Real, first map | Real, last map | Rebuilt, last map |",
);
say("|---|---|---|---|---|---|");
const byPlayer = new Map<string, typeof rows>();
for (const r of rows) byPlayer.set(r.id, [...(byPlayer.get(r.id) ?? []), r]);
for (const [id, xs] of [...byPlayer].sort(
  (a, b) => b[1].length - a[1].length,
)) {
  const first = xs[0];
  const last = xs.at(-1)!;
  say(
    `| ${data.nameOf.get(id) ?? id} | ${xs.length} | ${first.now} | ${first.real} (${first.date.slice(0, 10)}) | ` +
      `${last.real} (${last.date.slice(0, 10)}) | ${last.rebuilt} |`,
  );
}
say();

mkdirSync(join(__dirname, ".local"), { recursive: true });
const file = join(__dirname, ".local/REPORT-real-elo.md");
writeFileSync(file, out.join("\n") + "\n");
console.log(out.join("\n"));
