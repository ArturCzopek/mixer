#!/usr/bin/env node
// Spike S3: call the FACEIT Data API endpoints we plan to use (docs/06) for the roster in
// db/seed/roster.json, record JSON fixtures for tests and write a report of fields,
// statuses and rate-limit headers. Also records Steam player summaries and validates the
// Leetify key (Leetify data is never recorded: display only, see CLAUDE.md).
//
// Runs where the keys are: GitHub Actions (workflow "API spike") or locally with a filled .env.local:
//   node --env-file=.env.local scripts/faceit-spike.mjs
// The cloud sandbox cannot reach open.faceit.com (Cloudflare challenge), hence the workflow.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const FACEIT = "https://open.faceit.com/data/v4";
const TEST_MATCH =
  process.env.FACEIT_TEST_MATCH ?? "1-1cb5b18b-6856-42a9-bf3c-561c0737b52f";
const OUT = "lib/external/__fixtures__";
const DAY = 24 * 60 * 60;

const roster = JSON.parse(readFileSync("db/seed/roster.json", "utf8"));
const report = {
  generatedAt: new Date().toISOString(),
  env: {},
  calls: [],
  notes: [],
};

// Which secrets are visible (names only, never values).
for (const name of [
  "FACEIT_API_KEY",
  "STEAM_WEB_API_KEY",
  "LEETIFY_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ACCESS_TOKEN",
]) {
  report.env[name] = Boolean(process.env[name]);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function writeJson(path, data) {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}

// "a.b[].c: number" style paths, merged over (up to 20) array items.
function keyPaths(value, prefix = "", out = new Map()) {
  if (Array.isArray(value)) {
    out.set(`${prefix}[]`, "array");
    for (const item of value.slice(0, 20)) keyPaths(item, `${prefix}[]`, out);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      keyPaths(v, prefix ? `${prefix}.${k}` : k, out);
    }
  } else if (!out.has(prefix)) {
    out.set(prefix, value === null ? "null" : typeof value);
  }
  return out;
}

const INTERESTING_HEADERS = /rate|limit|retry|remaining|reset|quota/i;

async function call(label, url, headers, { record = true } = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const started = Date.now();
    const res = await fetch(url, {
      headers: { Accept: "application/json", ...headers },
    });
    const ms = Date.now() - started;
    const hdrs = Object.fromEntries(
      [...res.headers].filter(([k]) => INTERESTING_HEADERS.test(k)),
    );
    const text = await res.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = { nonJson: text.slice(0, 200) };
    }
    report.calls.push({
      label,
      url: url.replace(/key=[^&]+/, "key=***"),
      status: res.status,
      ms,
      headers: hdrs,
      ...(res.ok ? {} : { error: body }),
    });
    console.log(`${res.status} ${ms}ms ${label}`);
    if (res.status === 429 && attempt < 2) {
      const wait = Number(res.headers.get("retry-after") ?? 5) * 1000;
      report.notes.push(`429 on ${label}, retry after ${wait} ms`);
      await sleep(wait);
      continue;
    }
    await sleep(200);
    return { ok: res.ok, status: res.status, body: record ? body : null };
  }
}

// ---------- FACEIT ----------
const shapes = {};
function addShape(name, body) {
  if (!body) return;
  const paths = keyPaths(body);
  shapes[name] ??= {};
  for (const [k, v] of paths) shapes[name][k] ??= v;
}

if (process.env.FACEIT_API_KEY) {
  const auth = { Authorization: `Bearer ${process.env.FACEIT_API_KEY}` };
  const now = Math.floor(Date.now() / 1000);
  const from30 = now - 30 * DAY;
  const players = {};

  for (const steamId of roster.players) {
    const found = await call(
      `player by steam ${steamId}`,
      `${FACEIT}/players?game=cs2&game_player_id=${steamId}`,
      auth,
    );
    if (!found.ok) {
      players[steamId] = { found: false, status: found.status };
      continue;
    }
    const p = found.body;
    addShape("GET /players?game_player_id", p);
    writeJson(`${OUT}/faceit/players/${steamId}.json`, p);
    players[steamId] = {
      found: true,
      player_id: p.player_id,
      nickname: p.nickname,
      elo: p.games?.cs2?.faceit_elo ?? null,
      level: p.games?.cs2?.skill_level ?? null,
    };

    const id = p.player_id;
    const history = await call(
      `history 30d ${p.nickname}`,
      `${FACEIT}/players/${id}/history?game=cs2&from=${from30}&to=${now}&limit=100`,
      auth,
    );
    if (history.ok) {
      addShape("GET /players/{id}/history", history.body);
      writeJson(`${OUT}/faceit/history/${steamId}.json`, history.body);
      players[steamId].history30d = history.body.items?.length ?? 0;
    }

    const stats = await call(
      `games stats ${p.nickname}`,
      `${FACEIT}/players/${id}/games/cs2/stats?limit=100`,
      auth,
    );
    if (stats.ok) {
      addShape("GET /players/{id}/games/cs2/stats", stats.body);
      writeJson(`${OUT}/faceit/games-stats/${steamId}.json`, stats.body);
      players[steamId].gamesStats = stats.body.items?.length ?? 0;
    }

    const lifetime = await call(
      `lifetime ${p.nickname}`,
      `${FACEIT}/players/${id}/stats/cs2`,
      auth,
    );
    if (lifetime.ok) {
      addShape("GET /players/{id}/stats/cs2", lifetime.body);
      writeJson(`${OUT}/faceit/lifetime/${steamId}.json`, lifetime.body);
    }
  }
  report.players = players;

  // Probes on the first found player: does the stats endpoint accept from/to, and in which unit?
  // Does pagination via offset work past 100?
  const probe = Object.entries(players).find(([, v]) => v.found);
  if (probe) {
    const id = probe[1].player_id;
    const probes = {};
    for (const [name, qs] of [
      ["stats from/to seconds", `from=${from30}&to=${now}&limit=100`],
      [
        "stats from/to millis",
        `from=${from30 * 1000}&to=${now * 1000}&limit=100`,
      ],
      ["stats offset 100", `offset=100&limit=100`],
    ]) {
      const r = await call(
        `probe ${name}`,
        `${FACEIT}/players/${id}/games/cs2/stats?${qs}`,
        auth,
      );
      const items = r.body?.items ?? [];
      const dates = items
        .map((i) =>
          Number(
            i.stats?.["Match Finished At"] ?? i.stats?.["Updated At"] ?? NaN,
          ),
        )
        .filter(Number.isFinite);
      probes[name] = {
        status: r.status,
        count: items.length,
        newest: dates.length ? Math.max(...dates) : null,
        oldest: dates.length ? Math.min(...dates) : null,
      };
    }
    const h2 = await call(
      "probe history offset 100 (no window)",
      `${FACEIT}/players/${id}/history?game=cs2&offset=100&limit=100`,
      auth,
    );
    probes["history offset 100"] = {
      status: h2.status,
      count: h2.body?.items?.length ?? 0,
    };
    report.probes = probes;
  }

  // Test match (a public FACEIT match, docs/05) — details + per-map stats.
  const match = await call(
    `match ${TEST_MATCH}`,
    `${FACEIT}/matches/${TEST_MATCH}`,
    auth,
  );
  if (match.ok) {
    addShape("GET /matches/{id}", match.body);
    writeJson(`${OUT}/faceit/matches/${TEST_MATCH}.json`, match.body);
  }
  const matchStats = await call(
    `match stats ${TEST_MATCH}`,
    `${FACEIT}/matches/${TEST_MATCH}/stats`,
    auth,
  );
  if (matchStats.ok) {
    addShape("GET /matches/{id}/stats", matchStats.body);
    writeJson(
      `${OUT}/faceit/matches/${TEST_MATCH}.stats.json`,
      matchStats.body,
    );
  }
  report.shapes = shapes;
} else {
  report.notes.push("FACEIT_API_KEY not set: FACEIT calls skipped");
}

// ---------- Steam ----------
if (process.env.STEAM_WEB_API_KEY) {
  const r = await call(
    "steam GetPlayerSummaries",
    `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${process.env.STEAM_WEB_API_KEY}&steamids=${roster.players.join(",")}`,
    {},
  );
  if (r.ok) writeJson(`${OUT}/steam/player-summaries.json`, r.body);
} else {
  report.notes.push("STEAM_WEB_API_KEY not set: Steam call skipped");
}

// ---------- Leetify (validate key only; never record data) ----------
if (process.env.LEETIFY_API_KEY) {
  await call(
    "leetify validate key",
    "https://api-public.cs-prod.leetify.com/api-key/validate",
    { Authorization: `Bearer ${process.env.LEETIFY_API_KEY}` },
    { record: false },
  );
} else {
  report.notes.push("LEETIFY_API_KEY not set: Leetify check skipped");
}

writeJson(`${OUT}/spike-report.json`, report);
console.log(
  JSON.stringify(
    {
      env: report.env,
      players: report.players,
      probes: report.probes,
      notes: report.notes,
    },
    null,
    2,
  ),
);

const failed = report.calls.filter((c) => c.status >= 400 && c.status !== 404);
if (!process.env.FACEIT_API_KEY || failed.length > 0) {
  console.error(
    `Spike incomplete: ${failed.length} failed calls; see ${OUT}/spike-report.json`,
  );
  process.exitCode = 1;
}
