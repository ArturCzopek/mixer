// One-off, rerunnable import of the owner's historical Popflash archive.
// Run after db-migrate.mjs: npx tsx --env-file=.env.local scripts/import-popflash-archive.ts --apply
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { DEFAULT_BALANCE_CONFIG, skillScore } from "../lib/balance";
import { popflashArchive } from "../lib/archive/popflash";
import type { PopflashMatch, PopflashPlayer } from "../backtest/data";

const fixture = "lib/balance/__fixtures__/popflash/";
const { matches } = JSON.parse(
  readFileSync(`${fixture}matches.json`, "utf8"),
) as { matches: PopflashMatch[] };
const { players } = JSON.parse(
  readFileSync(`${fixture}players.json`, "utf8"),
) as { players: PopflashPlayer[] };
const { evenings, names } = popflashArchive(matches, players);
const allIds = [...new Set(evenings.flatMap((e) => [...e.teamA, ...e.teamB]))];
const quote = (value: unknown) => `'${String(value).replaceAll("'", "''")}'`;
const json = (value: unknown) => `${quote(JSON.stringify(value))}::jsonb`;
const list = (values: string[]) => values.map(quote).join(", ");

if (!process.argv.includes("--apply")) {
  console.log(
    `Dry run: ${evenings.length} archived mixes, ${matches.length} maps, ${matches.length * 10} player lines, ${allIds.length} players. Pass --apply to write.`,
  );
  process.exit(0);
}

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN is required");
  const project = "gjcfazmpzfcoldigjlkj"; // Artur-approved target until P0-6.
  async function sql(query: string): Promise<Record<string, unknown>[]> {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${project}/database/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      },
    );
    const text = await response.text();
    if (!response.ok) throw new Error(`SQL ${response.status}: ${text}`);
    return JSON.parse(text) as Record<string, unknown>[];
  }

  const [group] = await sql(`
  select g.id as group_id, p.id as admin_id
  from public.groups g join public.players p on p.id = g.created_by
  where g.slug = 'skarpeciarze'
`);
  if (!group) throw new Error("The Skarpeciarze group is missing");
  const groupId = String(group.group_id);
  const adminId = String(group.admin_id);
  const originalMembers = await sql(`
  select p.steam_id, gm.left_at
  from public.players p join public.group_members gm on gm.player_id = p.id
  where gm.group_id = ${quote(groupId)} and p.steam_id in (${list(allIds)})
`);
  const previousMembership = new Map(
    originalMembers.map((row) => [String(row.steam_id), row.left_at]),
  );
  const imported = await sql(`
  select m.archive_key, count(distinct r.id)::integer as maps,
    count(s.player_id)::integer as lines
  from public.mixes m
  left join public.matches r on r.mix_id = m.id
  left join public.match_player_stats s on s.match_id = r.id
  where m.group_id = ${quote(groupId)} and m.archive_source = 'popflash'
  group by m.archive_key
`);
  const existing = new Map(
    imported.map((row) => [String(row.archive_key), row]),
  );

  for (const evening of evenings) {
    const found = existing.get(evening.key);
    if (found) {
      if (
        Number(found.maps) !== evening.maps.length ||
        Number(found.lines) !== evening.maps.length * 10
      )
        throw new Error(`Incomplete existing archive: ${evening.key}`);
      console.log(`skip ${evening.key}`);
      continue;
    }
    const mixId = randomUUID();
    const variantId = randomUUID();
    const roster = [...evening.teamA, ...evening.teamB];
    const date = new Date(evening.at);
    const snapshots = roster.map((steamId) => {
      // Archived lineups were not balanced in Mixer. The neutral snapshot only
      // satisfies the existing read model; the played page never shows odds.
      const input = {
        steamId,
        faceitElo: null,
        manualSkillOverride: 1400,
        faceit: { matches: [] },
        activity: { playedAt: [] },
        mixRatings: [],
        preferredRole: "any" as const,
        resolvedElo: 1400,
        eloSource: "neutral-default",
        faceitLevel: null,
        faceitFormAvailable: false,
        swapInheritedFrom: null,
      };
      return {
        steamId,
        snapshot: {
          input,
          breakdown: skillScore(
            input,
            { now: date, groupRating: null },
            DEFAULT_BALANCE_CONFIG,
          ),
        },
      };
    });
    const mapRows = evening.maps.map((map, index) => ({
      id: randomUUID(),
      number: index + 1,
      name: map.name,
      at: map.at,
      scoreA: map.scoreA,
      scoreB: map.scoreB,
      reference: `popflash:${map.id}`,
    }));
    const lineRows = evening.maps.flatMap((map, index) =>
      map.lines.map((line) => ({
        matchId: mapRows[index].id,
        steamId: line.steamId,
        team: line.team,
        kills: line.raw.kills,
        deaths: line.raw.deaths,
        assists: line.raw.assists,
        damage: line.raw.damage,
        rounds: line.raw.rounds,
        adr: line.raw.adr,
        kastRounds: line.raw.kast || null,
        firstKills: line.raw.firstKills,
        firstDeaths: line.raw.firstDeaths,
        tradeKills: line.raw.tradeKills,
        tradedDeaths: line.raw.tradedDeaths,
        doubleKills: (line.raw.multi as number[])[0],
        tripleKills: (line.raw.multi as number[])[1],
        quadroKills: (line.raw.multi as number[])[2],
        pentaKills: (line.raw.multi as number[])[3],
        clutchWins: line.raw.clutchWins,
        utilityDamage: line.raw.utilityDamage,
        enemiesFlashed: line.raw.enemiesFlashed,
        flashAssists: line.raw.flashAssists,
        rating: line.rating,
        raw: line.raw,
      })),
    );
    const playerValues = roster.map(
      (steamId) =>
        `(${quote(steamId)}, ${quote(names.get(steamId) ?? steamId)})`,
    );
    const restore = roster
      .filter((steamId) => previousMembership.get(steamId) !== null)
      .map((steamId) => {
        const leftAt = previousMembership.has(steamId)
          ? previousMembership.get(steamId)
          : "2025-01-01T00:00:00Z";
        return `update public.group_members gm set left_at = ${quote(leftAt)}::timestamptz
        from public.players p where gm.player_id = p.id and gm.group_id = ${quote(groupId)}
        and p.steam_id = ${quote(steamId)};`;
      })
      .join("\n");
    await sql(`
    begin;
    insert into public.players (steam_id, display_name)
      values ${playerValues.join(",\n")}
      on conflict (steam_id) do nothing;
    update public.players p set display_name = x.name
      from (values ${playerValues.join(",\n")}) as x(steam_id, name)
      where p.steam_id = x.steam_id and p.display_name is null;
    insert into public.group_members (group_id, player_id, role, added_by, joined_at)
      select ${quote(groupId)}::uuid, p.id, 'member', ${quote(adminId)}::uuid,
        ${quote(evening.at)}::timestamptz
      from public.players p where p.steam_id in (${list(roster)})
      on conflict (group_id, player_id) do nothing;
    update public.group_members gm set left_at = null
      from public.players p where gm.player_id = p.id and gm.group_id = ${quote(groupId)}
        and p.steam_id in (${list(roster)});
    insert into public.mixes (
      id, group_id, title, scheduled_at, created_at, created_by, archive_source, archive_key
    ) values (
      ${quote(mixId)}::uuid, ${quote(groupId)}::uuid, ${quote(evening.title)},
      ${quote(evening.at)}::timestamptz, ${quote(evening.at)}::timestamptz,
      ${quote(adminId)}::uuid, 'popflash', ${quote(evening.key)}
    );
    insert into public.mix_participants (mix_id, player_id, added_by, created_at)
      select ${quote(mixId)}::uuid, p.id, ${quote(adminId)}::uuid,
        ${quote(evening.at)}::timestamptz
      from public.players p where p.steam_id in (${list(roster)});
    update public.mixes set status = 'balancing' where id = ${quote(mixId)}::uuid;
    update public.mix_participants mp set skill_snapshot = x.snapshot
      from jsonb_to_recordset(${json(snapshots)}) as x("steamId" text, snapshot jsonb)
      join public.players p on p.steam_id = x."steamId"
      where mp.mix_id = ${quote(mixId)}::uuid and mp.player_id = p.id;
    insert into public.variants (
      id, mix_id, number, is_published, team_a_score, team_b_score,
      win_prob_a, penalty, details
    ) values (
      ${quote(variantId)}::uuid, ${quote(mixId)}::uuid, 1, false,
      1400, 1400, 0.5, 0, '{"archive":true}'::jsonb
    );
    insert into public.variant_players (variant_id, player_id, team)
      select ${quote(variantId)}::uuid, p.id,
        case when p.steam_id in (${list(evening.teamA)}) then 'A' else 'B' end
      from public.players p where p.steam_id in (${list(roster)});
    update public.variants set is_published = true where id = ${quote(variantId)}::uuid;
    update public.mixes set status = 'voting' where id = ${quote(mixId)}::uuid;
    update public.mixes set status = 'locked', chosen_variant_id = ${quote(variantId)}::uuid
      where id = ${quote(mixId)}::uuid;
    insert into public.matches (
      id, mix_id, map_number, map_name, played_at, score_a, score_b,
      source, stats_origin, source_reference, uploaded_by
    ) select x.id, ${quote(mixId)}::uuid, x.number, x.name, x.at,
        x."scoreA", x."scoreB", 'manual', 'popflash', x.reference,
        ${quote(adminId)}::uuid
      from jsonb_to_recordset(${json(mapRows)}) as x(
        id uuid, number integer, name text, at timestamptz,
        "scoreA" smallint, "scoreB" smallint, reference text
      );
    insert into public.match_player_stats (
      match_id, player_id, team, kills, deaths, assists, damage, rounds, adr,
      kast_rounds, first_kills, first_deaths, trade_kills, traded_deaths,
      multi_2k, multi_3k, multi_4k, multi_5k, clutch_wins, utility_damage,
      enemies_flashed, flash_assists, rating, raw
    ) select x."matchId", p.id, x.team, x.kills, x.deaths, x.assists,
        x.damage, x.rounds, x.adr, x."kastRounds", x."firstKills",
        x."firstDeaths", x."tradeKills", x."tradedDeaths",
        x."doubleKills", x."tripleKills", x."quadroKills", x."pentaKills",
        x."clutchWins", x."utilityDamage", x."enemiesFlashed",
        x."flashAssists", x.rating, x.raw
      from jsonb_to_recordset(${json(lineRows)}) as x(
        "matchId" uuid, "steamId" text, team char(1), kills smallint,
        deaths smallint, assists smallint, damage integer, rounds smallint,
        adr numeric, "kastRounds" smallint, "firstKills" smallint,
        "firstDeaths" smallint, "tradeKills" smallint,
        "tradedDeaths" smallint, "doubleKills" smallint,
        "tripleKills" smallint, "quadroKills" smallint,
        "pentaKills" smallint, "clutchWins" smallint,
        "utilityDamage" integer, "enemiesFlashed" smallint,
        "flashAssists" smallint, rating numeric, raw jsonb
      ) join public.players p on p.steam_id = x."steamId";
    update public.mixes set status = 'played', locked_at = ${quote(evening.at)}::timestamptz,
      match_started_at = ${quote(evening.at)}::timestamptz
      where id = ${quote(mixId)}::uuid;
    ${restore}
    do $$ begin
      if (select count(*) from public.matches where mix_id = ${quote(mixId)}::uuid) <> ${mapRows.length}
        or (select count(*) from public.match_player_stats s join public.matches m on m.id = s.match_id
            where m.mix_id = ${quote(mixId)}::uuid) <> ${lineRows.length} then
        raise exception 'archive import count mismatch';
      end if;
    end $$;
    commit;
  `);
    console.log(`imported ${evening.key}: ${evening.maps.length} maps`);
  }

  const [counts] = await sql(`
  select count(distinct m.id)::integer as mixes, count(distinct r.id)::integer as maps,
    count(s.player_id)::integer as lines
  from public.mixes m left join public.matches r on r.mix_id = m.id
  left join public.match_player_stats s on s.match_id = r.id
  where m.group_id = ${quote(groupId)} and m.archive_source = 'popflash'
`);
  console.log("Archive verified:", counts);
  if (
    Number(counts.mixes) !== evenings.length ||
    Number(counts.maps) !== matches.length ||
    Number(counts.lines) !== matches.length * 10
  )
    throw new Error("Archive totals differ from the fixture");
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
