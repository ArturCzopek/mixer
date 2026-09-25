#!/usr/bin/env node
// Data for the balancing backtest (T-1, T-2). TEST FIXTURES ONLY (D25): never imported into a database.
//
//   node scripts/backtest-data.mjs probe     # raw popflash pages → lib/balance/__fixtures__/popflash/probe/
//   node scripts/backtest-data.mjs popflash  # all club matches   → lib/balance/__fixtures__/popflash/matches.json
//   node scripts/backtest-data.mjs faceit    # FACEIT profile + match stats of every popflash player
//                                            #                    → lib/balance/__fixtures__/backtest/faceit/*.json
//
// Runs where the network allows it: GitHub Actions (workflow "Backtest data") or locally
// (`node --env-file=.env.local scripts/backtest-data.mjs faceit`). The cloud sandbox cannot reach
// popflash.site or open.faceit.com. Polite: one request at a time with a pause.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CLUB = "skarpeciarze-i-pantofle";
const POPFLASH = "https://popflash.site";
const FACEIT = "https://open.faceit.com/data/v4";
const FIX = "lib/balance/__fixtures__";
const UA =
  "mixer-backtest/1.0 (friend-group tool; one-off export of our own club)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const write = (path, data) => {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(
    path,
    typeof data === "string" ? data : JSON.stringify(data, null, 2) + "\n",
  );
};

async function get(url, headers = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA, ...headers } });
    const text = await res.text();
    // Popflash sometimes answers the first request of a fresh client with a 403 challenge page.
    if (res.status === 429 || res.status === 403 || res.status >= 500) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    return {
      status: res.status,
      headers: Object.fromEntries(res.headers),
      text,
    };
  }
  throw new Error(`Gave up on ${url}`);
}

// --- probe: save raw pages so the parser can be written against the real markup -----------------

async function probe() {
  const out = `${FIX}/popflash/probe`;
  const index = [];
  const save = async (name, url) => {
    const r = await get(url);
    write(`${out}/${name}`, r.text);
    index.push({
      name,
      url,
      status: r.status,
      contentType: r.headers["content-type"],
      bytes: r.text.length,
    });
    await sleep(700);
    return r;
  };
  const list = await save("club-matches.html", `${POPFLASH}/-/${CLUB}/matches`);
  await save("club-matches-page2.html", `${POPFLASH}/-/${CLUB}/matches?page=2`);
  await save("club.html", `${POPFLASH}/-/${CLUB}`);
  const ids = [
    ...new Set([...list.text.matchAll(/\/match\/(\d+)/g)].map((m) => m[1])),
  ];
  index.push({
    note: `match ids on list page: ${ids.length}`,
    ids: ids.slice(0, 50),
  });
  if (ids[0]) {
    await save("match.html", `${POPFLASH}/match/${ids[0]}`);
    for (const [name, url] of [
      ["api-match.json", `https://api.popflash.site/match/${ids[0]}`],
      ["site-api-match.json", `${POPFLASH}/api/match/${ids[0]}`],
    ]) {
      try {
        await save(name, url);
      } catch (e) {
        index.push({ name, url, error: String(e) });
      }
    }
  }
  write(`${out}/index.json`, index);
  console.log(JSON.stringify(index, null, 2));
}

// --- popflash: every club match with lineups and per-player stats ---------------------------------
// Parser filled in after the probe (see lib/balance/__fixtures__/popflash/README.md).

async function popflash() {
  const { parseMatchList, parseMatch } = await import("./popflash-parse.mjs");
  const ids = [];
  for (let page = 1; page <= 20; page++) {
    const r = await get(
      `${POPFLASH}/-/${CLUB}/matches${page > 1 ? `?page=${page}` : ""}`,
    );
    const found = parseMatchList(r.text).filter((id) => !ids.includes(id));
    if (found.length === 0) break;
    ids.push(...found);
    await sleep(700);
  }
  console.log(`${ids.length} match ids`);
  const matches = [];
  for (const id of ids) {
    const r = await get(`${POPFLASH}/match/${id}`);
    try {
      matches.push(parseMatch(r.text, id));
    } catch (e) {
      console.log(`match ${id}: ${e.message}`);
      write(`${FIX}/popflash/probe/failed-${id}.html`, r.text);
    }
    await sleep(700);
  }
  matches.sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );
  write(`${FIX}/popflash/matches.json`, {
    $comment:
      "Popflash club skarpeciarze-i-pantofle, exported by scripts/backtest-data.mjs. TEST DATA ONLY (D25).",
    exportedAt: new Date().toISOString(),
    matches,
  });
  console.log(`${matches.length} matches written`);
}

// --- faceit: ELO now + match stats around the popflash period, for every popflash player -----------

async function faceit() {
  const key = process.env.FACEIT_API_KEY;
  if (!key) throw new Error("FACEIT_API_KEY missing");
  const auth = { Authorization: `Bearer ${key}`, Accept: "application/json" };
  const { players } = JSON.parse(
    readFileSync(`${FIX}/popflash/players.json`, "utf8"),
  );
  // Popflash period Jan–Dec 2024; form needs 30 days before a map plus a baseline before that.
  // Fetched in 2-month slices: one long window stops at 300 items (offset limit).
  const from = Date.parse("2023-09-01T00:00:00Z");
  const to = Date.parse("2025-01-31T00:00:00Z");
  const slices = [];
  for (let t = from; t < to;) {
    const d = new Date(t);
    const next = Math.min(
      to,
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 2, 1),
    );
    slices.push([t, next]);
    t = next;
  }
  const summary = [];
  for (const p of players) {
    if (p.mergeInto) continue; // second account: the main account carries the FACEIT data
    let r = await get(
      `${FACEIT}/players?game=cs2&game_player_id=${p.steamId}`,
      auth,
    );
    if (r.status === 404 && p.faceitNickname) {
      await sleep(100);
      r = await get(
        `${FACEIT}/players?nickname=${encodeURIComponent(p.faceitNickname)}`,
        auth,
      );
    }
    if (r.status !== 200) {
      summary.push({ steamId: p.steamId, status: r.status });
      continue;
    }
    const player = JSON.parse(r.text);
    const stats = [];
    for (const [sliceFrom, sliceTo] of slices)
      for (let offset = 0; offset < 300; offset += 100) {
        await sleep(100);
        const page = await get(
          `${FACEIT}/players/${player.player_id}/games/cs2/stats?from=${sliceFrom}&to=${sliceTo}&limit=100&offset=${offset}`,
          auth,
        );
        if (page.status !== 200) break;
        const items = JSON.parse(page.text).items ?? [];
        for (const { stats: s } of items) {
          stats.push({
            matchId: s["Match Id"],
            finishedAt: new Date(Number(s["Match Finished At"])).toISOString(),
            gameMode: s["Game Mode"],
            competitionId: s["Competition Id"] ?? null,
            map: s["Map"],
            kills: Number(s["Kills"]),
            deaths: Number(s["Deaths"]),
            assists: Number(s["Assists"]),
            rounds: Number(s["Rounds"]),
            adr: s["ADR"] === undefined ? null : Number(s["ADR"]),
            won: s["Result"] === "1",
          });
        }
        if (items.length < 100) break;
      }
    const seen = new Set();
    const unique = stats
      .filter((x) => !seen.has(x.matchId) && seen.add(x.matchId))
      .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
    stats.length = 0;
    stats.push(...unique);
    write(`${FIX}/backtest/faceit/${p.steamId}.json`, {
      steamId: p.steamId,
      nickname: player.nickname,
      eloNow: player.games?.cs2?.faceit_elo ?? null,
      levelNow: player.games?.cs2?.skill_level ?? null,
      window: {
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
      },
      stats,
    });
    summary.push({
      steamId: p.steamId,
      nickname: player.nickname,
      elo: player.games?.cs2?.faceit_elo,
      stats: stats.length,
    });
  }
  write(`${FIX}/backtest/faceit/_summary.json`, {
    recordedAt: new Date().toISOString(),
    players: summary,
  });
  console.log(JSON.stringify(summary, null, 2));
}

// --- results: every FACEIT match result up to today, to walk ELO back from today's value --------
// ELO is not in the Data API per match; backtest/elo-history.ts reconstructs it (±25 per queue match).

async function results() {
  const key = process.env.FACEIT_API_KEY;
  if (!key) throw new Error("FACEIT_API_KEY missing");
  const auth = { Authorization: `Bearer ${key}`, Accept: "application/json" };
  const { players } = JSON.parse(
    readFileSync(`${FIX}/popflash/players.json`, "utf8"),
  );
  const from = Date.parse("2023-09-01T00:00:00Z");
  const to = Date.now();
  const slices = [];
  for (let t = from; t < to;) {
    const d = new Date(t);
    const next = Math.min(
      to,
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1),
    );
    slices.push([t, next]);
    t = next;
  }
  const summary = [];
  for (const p of players) {
    if (p.mergeInto) continue;
    let r = await get(
      `${FACEIT}/players?game=cs2&game_player_id=${p.steamId}`,
      auth,
    );
    if (r.status === 404 && p.faceitNickname)
      r = await get(
        `${FACEIT}/players?nickname=${encodeURIComponent(p.faceitNickname)}`,
        auth,
      );
    if (r.status !== 200) continue;
    const player = JSON.parse(r.text);
    const seen = new Set();
    const out = [];
    let truncated = 0;
    for (const [a, b] of slices) {
      for (let offset = 0; offset < 1000; offset += 100) {
        await sleep(80);
        const page = await get(
          `${FACEIT}/players/${player.player_id}/games/cs2/stats?from=${a}&to=${b}&limit=100&offset=${offset}`,
          auth,
        );
        if (page.status !== 200) {
          if (offset > 0) truncated++;
          break;
        }
        const items = JSON.parse(page.text).items ?? [];
        for (const { stats: s } of items) {
          if (seen.has(s["Match Id"])) continue;
          seen.add(s["Match Id"]);
          out.push({
            finishedAt: new Date(Number(s["Match Finished At"])).toISOString(),
            won: s["Result"] === "1",
            gameMode: s["Game Mode"],
            competitionId: s["Competition Id"] ?? null,
          });
        }
        if (items.length < 100) break;
      }
    }
    out.sort((x, y) => x.finishedAt.localeCompare(y.finishedAt));
    write(`${FIX}/backtest/faceit-results/${p.steamId}.json`, {
      steamId: p.steamId,
      nickname: player.nickname,
      eloNow: player.games?.cs2?.faceit_elo ?? null,
      recordedAt: new Date().toISOString(),
      truncatedSlices: truncated,
      results: out,
    });
    summary.push({
      nickname: player.nickname,
      elo: player.games?.cs2?.faceit_elo,
      results: out.length,
      truncated,
    });
  }
  console.log(JSON.stringify(summary, null, 2));
}

// --- probe-elo: which other sources have historical ELO? Prints field names and date ranges to the
// job log only; nothing is written or committed (Leetify data must not be stored).

async function probeElo() {
  const steamId = "76561197993187687"; // owner
  const report = [];
  const keysOf = (o, prefix = "", out = new Set()) => {
    if (Array.isArray(o))
      o.slice(0, 3).forEach((x) => keysOf(x, `${prefix}[]`, out));
    else if (o && typeof o === "object")
      for (const [k, v] of Object.entries(o)) {
        out.add(prefix ? `${prefix}.${k}` : k);
        keysOf(v, prefix ? `${prefix}.${k}` : k, out);
      }
    return out;
  };
  if (process.env.LEETIFY_API_KEY) {
    const h = {
      _leetify_key: process.env.LEETIFY_API_KEY,
      Accept: "application/json",
    };
    for (const url of [
      `https://api-public.cs-prod.leetify.com/v3/profile/matches?steam64_id=${steamId}`,
      `https://api-public.cs-prod.leetify.com/v3/profile?steam64_id=${steamId}`,
    ]) {
      const r = await get(url, h);
      let body = null;
      try {
        body = JSON.parse(r.text);
      } catch {}
      const list = Array.isArray(body)
        ? body
        : (body?.recent_matches ?? body?.matches ?? []);
      const dates = list
        .map((m) => m.finished_at ?? m.finishedAt)
        .filter(Boolean)
        .sort();
      report.push({
        url: url.replace(steamId, "<owner>"),
        status: r.status,
        items: list.length,
        oldest: dates[0] ?? null,
        newest: dates.at(-1) ?? null,
        eloFields: [...keysOf(body)]
          .filter((k) => /elo|rank|skill/i.test(k))
          .slice(0, 40),
      });
      await sleep(500);
    }
  }
  // FACEIT's own site API (undocumented, not the Data API): ELO per match.
  const key = process.env.FACEIT_API_KEY;
  const me = key
    ? JSON.parse(
        (
          await get(`${FACEIT}/players?game=cs2&game_player_id=${steamId}`, {
            Authorization: `Bearer ${key}`,
          })
        ).text,
      )
    : null;
  if (me?.player_id) {
    const url = `https://api.faceit.com/stats/v1/stats/time/users/${me.player_id}/games/cs2?page=0&size=100`;
    const r = await get(url, { Accept: "application/json" }).catch((e) => ({
      status: String(e),
      text: "",
    }));
    let body = null;
    try {
      body = JSON.parse(r.text);
    } catch {}
    const list = Array.isArray(body) ? body : [];
    report.push({
      url: url.replace(me.player_id, "<owner>"),
      status: r.status,
      items: list.length,
      eloFields: [...keysOf(list[0] ?? {})].filter((k) =>
        /elo|date|created/i.test(k),
      ),
      oldest: list.length
        ? new Date(
            Math.min(...list.map((x) => Number(x.date ?? x.created_at ?? 0))),
          ).toISOString()
        : null,
    });
  }
  console.log(JSON.stringify(report, null, 2));
}

const step = process.argv[2];
const steps = { probe, popflash, faceit, results, "probe-elo": probeElo };
if (!steps[step]) {
  console.error(
    `Usage: node scripts/backtest-data.mjs ${Object.keys(steps).join("|")}`,
  );
  process.exit(1);
}
await steps[step]();
