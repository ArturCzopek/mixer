// Parsers for popflash.site pages (used by scripts/backtest-data.mjs). Popflash is a Next.js app:
// the match page embeds its data in the React Server Components payload (`self.__next_f.push`),
// which holds a `{"match": {...}}` object with the lineups and per-player stats.

/** Match ids linked from a club matches page. */
export function parseMatchList(html) {
  return [
    ...new Set([...html.matchAll(/href="\/match\/(\d+)"/g)].map((m) => m[1])),
  ];
}

function rscPayload(html) {
  let payload = "";
  for (const [, chunk] of html.matchAll(
    /self\.__next_f\.push\((\[.*?\])\)<\/script>/gs,
  )) {
    try {
      const arr = JSON.parse(chunk);
      if (typeof arr[1] === "string") payload += arr[1];
    } catch {
      // not a data chunk
    }
  }
  return payload;
}

/** Reads one JSON value starting at `start` (balanced braces, strings respected). */
function readJson(text, start) {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0)
      return JSON.parse(text.slice(start, i + 1));
  }
  throw new Error("Unterminated JSON");
}

const n = (x) => (x === null || x === undefined ? null : Number(x));

/** Compact, test-friendly record of one popflash match. */
export function parseMatch(html, id) {
  const payload = rscPayload(html);
  const at = payload.indexOf('{"match":{"__typename":"matches"');
  if (at < 0) throw new Error("no match object in page");
  const m = readJson(payload, at).match;
  if (String(m.id) !== String(id)) throw new Error(`id mismatch ${m.id}`);
  const players = m.users_matches
    .filter((u) => !u.is_coach && !u.is_spectator)
    .map((u) => {
      const p = u.premium ?? {};
      return {
        popflashId: String(u.user_id),
        name: u.user?.name ?? null,
        team: u.team,
        kills: n(u.kills),
        assists: n(u.assists),
        deaths: n(u.deaths),
        adr: n(u.average_damage_per_round),
        rounds: n(u.rounds_played),
        hsRatio: n(u.headshot_ratio),
        popflashRating: n(p.hltv_rating),
        kast: n(p.kast),
        firstKills: n(p.first_kills),
        firstDeaths: n(p.first_deaths),
        tradeKills: n(p.trade_kills),
        tradedDeaths: n(p.traded),
        survived: n(p.survived),
        damage: n(p.damage_done),
        utilityDamage: n(p.utility_damage),
        flashAssists: n(p.flash_assists),
        flashThrows: n(p.flash_throws),
        enemiesFlashed: n(p.flash_enemy_hits),
        teammatesFlashed: n(p.flash_teammate_hits),
        awpKills: n(p.awp),
        noscopeKills: n(p.noscope_kills),
        wallbangKills: n(p.penetrated_kills),
        smokeKills: n(p.smoke_kills),
        multi: [2, 3, 4, 5].map((k) => n(p[`total_${k}k_rounds`])),
        clutchWins: [1, 2, 3, 4, 5].reduce(
          (s, k) => s + (n(p[`total_1v${k}_clutches`]) ?? 0),
          0,
        ),
      };
    });
  return {
    id: String(m.id),
    date: m.created_at,
    map: m.map,
    score1: m.score1,
    score2: m.score2,
    winner: m.winner,
    status: m.status,
    rounds: m.score1 + m.score2,
    players,
  };
}
