#!/usr/bin/env node
// Proves that mix joins and sign-up closure serialize across independent Management API requests.
// Each call to sql() is a separate HTTP request and therefore a separate database transaction.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

function env(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
const ref = new URL(supabaseUrl).hostname.split(".")[0];
const token = env("SUPABASE_ACCESS_TOKEN");

async function sql(query) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
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
  if (!response.ok) {
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
    throw Object.assign(new Error(`SQL failed (${response.status}): ${text}`), {
      // The Management API puts the SQLSTATE in the message ("ERROR:  23514: ...").
      code: body?.code ?? /ERROR:\s+([0-9A-Z]{5}):/.exec(body?.message)?.[1],
    });
  }
  return text ? JSON.parse(text) : [];
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const groupId = randomUUID();
const mixIds = Array.from({ length: 6 }, () => randomUUID());
const playerIds = Array.from({ length: 11 }, () => randomUUID());
const steamStart = BigInt(`7${Date.now()}${Math.floor(Math.random() * 1000)}`);
const players = playerIds.map((id, i) => ({
  id,
  steamId: String(steamStart + BigInt(i))
    .padStart(17, "7")
    .slice(-17),
}));
const q = (value) => `'${value.replaceAll("'", "''")}'`;

async function createFixture() {
  const playerValues = players
    .map(
      ({ id, steamId }, i) =>
        `(${q(id)}, ${q(steamId)}, 'Race fixture ${i + 1}')`,
    )
    .join(",\n");
  const membershipValues = players
    .slice(1)
    .map(({ id }) => `(${q(groupId)}, ${q(id)}, 'member')`)
    .join(",\n");
  const mixValues = mixIds
    .map(
      (id, i) =>
        `(${q(id)}, ${q(groupId)}, 'Race check ${i + 1}', ${q(playerIds[0])})`,
    )
    .join(",\n");
  const participantValues = mixIds
    .flatMap((mixId, index) =>
      players
        .slice(0, index >= 2 ? 10 : 9)
        .map(({ id }) => `(${q(mixId)}, ${q(id)}, ${q(playerIds[0])})`),
    )
    .join(",\n");

  await sql(`
    insert into public.players (id, steam_id, display_name) values ${playerValues};
    insert into public.groups (id, slug, name, created_by)
      values (${q(groupId)}, ${q(`race-${groupId.slice(0, 8)}`)}, 'Race check', ${q(playerIds[0])});
    insert into public.group_members (group_id, player_id, role) values ${membershipValues};
    insert into public.mixes (id, group_id, title, created_by) values ${mixValues};
    insert into public.mix_participants (mix_id, player_id, added_by) values ${participantValues};
  `);
}

async function race(mixId, statement, assertion) {
  const holder = sql(`
    begin;
    insert into public.mix_participants (mix_id, player_id, added_by)
      values (${q(mixId)}, ${q(playerIds[9])}, ${q(playerIds[0])});
    select pg_sleep(4);
    commit;
  `).then(
    () => null,
    (error) => error,
  );
  await sleep(1000);
  const contender = sql(statement).then(
    () => ({ ok: true }),
    (error) => ({ ok: false, error }),
  );
  const holderError = await holder;
  const result = await contender;
  if (holderError) throw holderError;
  await assertion(result);
}

function variantPayload(teamAssignments, prefix) {
  return teamAssignments.map(([teamA, teamB], index) => ({
    splitKey: `${prefix}-${index + 1}`,
    teamA,
    teamB,
    avgA: 1500 + index,
    avgB: 1500 - index,
    winProbA: 0.5,
    penalty: 0,
    details: {},
  }));
}

try {
  await createFixture();

  await race(
    mixIds[0],
    `insert into public.mix_participants (mix_id, player_id, added_by)
      values (${q(mixIds[0])}, ${q(playerIds[10])}, ${q(playerIds[0])});`,
    async (result) => {
      assert.equal(result.ok, false, "the 11th participant insert must fail");
      assert.equal(
        result.error.code,
        "23514",
        "the join cap must reject with 23514",
      );
      const rows = await sql(
        `select count(*)::int as count from public.mix_participants where mix_id = ${q(mixIds[0])}`,
      );
      assert.equal(
        rows[0]?.count,
        10,
        "the first race must leave exactly ten participants",
      );
    },
  );

  await race(
    mixIds[1],
    `update public.mixes set status = 'balancing' where id = ${q(mixIds[1])};`,
    async (result) => {
      assert.equal(
        result.ok,
        true,
        "closing sign-ups must succeed after the tenth join commits",
      );
      const rows = await sql(`
        select m.status, count(mp.player_id)::int as count
        from public.mixes m
        left join public.mix_participants mp on mp.mix_id = m.id
        where m.id = ${q(mixIds[1])}
        group by m.id
      `);
      assert.equal(rows[0]?.status, "balancing");
      assert.equal(
        rows[0]?.count,
        10,
        "the status race must leave exactly ten participants",
      );
    },
  );

  const playerIdsForMix = players.slice(0, 10).map(({ id }) => id);
  const teamAssignments = [
    [playerIdsForMix.slice(0, 5), playerIdsForMix.slice(5)],
    [
      [playerIdsForMix[0], ...playerIdsForMix.slice(5, 9)],
      playerIdsForMix.slice(1, 5).concat(playerIdsForMix[9]),
    ],
    [
      [playerIdsForMix[0], playerIdsForMix[1], ...playerIdsForMix.slice(6, 9)],
      [
        playerIdsForMix[2],
        playerIdsForMix[3],
        playerIdsForMix[4],
        playerIdsForMix[5],
        playerIdsForMix[9],
      ],
    ],
  ];
  const snapshots = playerIdsForMix.map((playerId, index) => ({
    playerId,
    snapshot: {
      input: { steamId: players[index].steamId, eloSource: "faceit" },
      breakdown: { steamId: players[index].steamId, S: 1500 },
    },
  }));
  const initialSet = q(
    JSON.stringify(variantPayload(teamAssignments, "initial")),
  );
  await sql(`
    update public.mixes set status = 'balancing' where id = ${q(mixIds[2])};
    select public.create_mix_variant_set(
      ${q(mixIds[2])}, '{}'::jsonb, ${q(JSON.stringify(snapshots))}::jsonb, ${initialSet}::jsonb
    );
  `);

  const rerollSet = q(
    JSON.stringify(
      variantPayload(
        [
          [
            [
              playerIdsForMix[0],
              playerIdsForMix[2],
              playerIdsForMix[4],
              playerIdsForMix[6],
              playerIdsForMix[8],
            ],
            [
              playerIdsForMix[1],
              playerIdsForMix[3],
              playerIdsForMix[5],
              playerIdsForMix[7],
              playerIdsForMix[9],
            ],
          ],
          [
            [
              playerIdsForMix[0],
              playerIdsForMix[1],
              playerIdsForMix[4],
              playerIdsForMix[7],
              playerIdsForMix[9],
            ],
            [
              playerIdsForMix[2],
              playerIdsForMix[3],
              playerIdsForMix[5],
              playerIdsForMix[6],
              playerIdsForMix[8],
            ],
          ],
          [
            [
              playerIdsForMix[0],
              playerIdsForMix[3],
              playerIdsForMix[5],
              playerIdsForMix[6],
              playerIdsForMix[9],
            ],
            [
              playerIdsForMix[1],
              playerIdsForMix[2],
              playerIdsForMix[4],
              playerIdsForMix[7],
              playerIdsForMix[8],
            ],
          ],
        ],
        "reroll",
      ),
    ),
  );
  const simultaneous = await Promise.all([
    sql(`select public.approve_mix_variant_set(${q(mixIds[2])}, 1);`).then(
      () => ({ ok: true }),
      (error) => ({ ok: false, error }),
    ),
    sql(
      `select public.reroll_mix_variant_set(${q(mixIds[2])}, 1, ${rerollSet}::jsonb);`,
    ).then(
      () => ({ ok: true }),
      (error) => ({ ok: false, error }),
    ),
  ]);
  assert.equal(
    simultaneous.filter((result) => result.ok).length,
    1,
    "exactly one concurrent approve or re-roll must commit",
  );
  const raceState = await sql(`
    select m.status, coalesce(max(v.generation), 0)::int as generation,
      count(*) filter (where v.is_published)::int as published,
      count(*) filter (where v.rejected_at is not null)::int as rejected
    from public.mixes m left join public.variants v on v.mix_id = m.id
    where m.id = ${q(mixIds[2])}
    group by m.id
  `);
  if (raceState[0]?.status === "voting") {
    assert.equal(raceState[0]?.generation, 1);
    assert.equal(raceState[0]?.published, 3);
  } else {
    assert.equal(raceState[0]?.status, "balancing");
    assert.equal(raceState[0]?.generation, 2);
    assert.equal(raceState[0]?.published, 0);
    assert.equal(raceState[0]?.rejected, 3);
  }

  await sql(`
    update public.mixes set status = 'balancing' where id = ${q(mixIds[3])};
    select public.create_mix_variant_set(
      ${q(mixIds[3])}, '{}'::jsonb, ${q(JSON.stringify(snapshots))}::jsonb, ${initialSet}::jsonb
    );
    select public.approve_mix_variant_set(${q(mixIds[3])}, 1);
  `);
  const voteVariants = await sql(`
    select id from public.variants where mix_id = ${q(mixIds[3])} order by number
  `);
  for (const [index, playerId] of playerIdsForMix.entries()) {
    await sql(`select public.cast_mix_vote(
      ${q(mixIds[3])}, ${q(playerId)}, ${q(voteVariants[index < 5 ? 0 : 1].id)}, ${q(playerId)}
    );`);
  }
  await sql(`
    begin;
    alter table public.votes disable trigger votes_touch_updated_at;
    update public.votes set updated_at = now() - interval '61 minutes'
      where mix_id = ${q(mixIds[3])};
    alter table public.votes enable trigger votes_touch_updated_at;
    commit;
  `);
  const voteHolder = sql(`
    begin;
    select public.cast_mix_vote(
      ${q(mixIds[3])}, ${q(playerIdsForMix[0])}, ${q(voteVariants[1].id)}, ${q(playerIdsForMix[0])}
    );
    select pg_sleep(4);
    commit;
  `).then(
    () => null,
    (error) => error,
  );
  await sleep(1000);
  const dueClose = sql(`select public.close_due_mix_votes();`).then(
    () => null,
    (error) => error,
  );
  const [voteError, dueError] = await Promise.all([voteHolder, dueClose]);
  if (voteError) throw voteError;
  if (dueError) throw dueError;
  const votingState = await sql(`
    select m.status, m.chosen_variant_id, v.variant_id
    from public.mixes m join public.votes v on v.mix_id = m.id
    where m.id = ${q(mixIds[3])} and v.voter_id = ${q(playerIdsForMix[0])}
  `);
  assert.equal(
    votingState[0]?.status,
    "voting",
    "a moved vote resets the close deadline",
  );
  assert.equal(votingState[0]?.chosen_variant_id, null);
  assert.equal(votingState[0]?.variant_id, voteVariants[1].id);

  await sql(`
    update public.mixes set status = 'balancing' where id = ${q(mixIds[4])};
    select public.create_mix_variant_set(
      ${q(mixIds[4])}, '{}'::jsonb, ${q(JSON.stringify(snapshots))}::jsonb, ${initialSet}::jsonb
    );
    select public.approve_mix_variant_set(${q(mixIds[4])}, 1);
    select public.close_mix_votes(${q(mixIds[4])});
  `);
  const manualResult = (scoreA) =>
    sql(`select public.record_manual_mix_results(
      ${q(mixIds[4])}, ${q(playerIds[0])},
      ${q(JSON.stringify([{ scoreA, scoreB: 7 }]))}::jsonb
    );`).then(
      () => ({ ok: true }),
      (error) => ({ ok: false, error }),
    );
  const resultRace = await Promise.all([manualResult(13), manualResult(10)]);
  assert.equal(resultRace.filter((result) => result.ok).length, 1);
  assert.equal(resultRace.find((result) => !result.ok)?.error.code, "55000");
  const savedResult = await sql(`
    select m.status, count(r.id)::int as maps
    from public.mixes m left join public.matches r on r.mix_id = m.id
    where m.id = ${q(mixIds[4])} group by m.id
  `);
  assert.equal(savedResult[0]?.status, "played");
  assert.equal(savedResult[0]?.maps, 1);

  await sql(`
    update public.mixes set status = 'balancing' where id = ${q(mixIds[5])};
    select public.create_mix_variant_set(
      ${q(mixIds[5])}, '{}'::jsonb, ${q(JSON.stringify(snapshots))}::jsonb, ${initialSet}::jsonb
    );
    select public.approve_mix_variant_set(${q(mixIds[5])}, 1);
    select public.close_mix_votes(${q(mixIds[5])});
  `);
  const resultMethods = await Promise.all([
    sql(`select public.record_manual_mix_results(
      ${q(mixIds[5])}, ${q(playerIds[0])}, '[{"scoreA":13,"scoreB":7}]'::jsonb
    );`).then(
      () => ({ ok: true }),
      (error) => ({ ok: false, error }),
    ),
    sql(`select public.record_faceit_mix_results(
      ${q(mixIds[5])}, ${q(playerIds[0])},
      (select locked_at from public.mixes where id = ${q(mixIds[5])}),
      '[{"faceitId":"race-room","scoreA":13,"scoreB":7,"stats":[]}]'::jsonb
    );`).then(
      () => ({ ok: true }),
      (error) => ({ ok: false, error }),
    ),
  ]);
  assert.equal(resultMethods.filter((result) => result.ok).length, 1);
  assert.equal(resultMethods.find((result) => !result.ok)?.error.code, "55000");
  const methodState = await sql(`
    select m.status, count(r.id)::int as maps,
      min(r.source) as source, max(r.source) as last_source
    from public.mixes m left join public.matches r on r.mix_id = m.id
    where m.id = ${q(mixIds[5])} group by m.id
  `);
  assert.equal(methodState[0]?.status, "played");
  assert.equal(methodState[0]?.maps, 1);
  assert.equal(methodState[0]?.source, methodState[0]?.last_source);

  console.log("ok concurrent join cap (23514, exactly 10 participants)");
  console.log(
    "ok status update waits for tenth join (balancing, exactly 10 participants)",
  );
  console.log("ok concurrent approve vs re-roll (one operation wins)");
  console.log(
    "ok concurrent vote move vs due auto-close (vote resets deadline)",
  );
  console.log("ok concurrent manual results (one result wins, one map stored)");
  console.log("ok concurrent manual vs FACEIT results (one source wins)");
} finally {
  try {
    await sql(`
      delete from public.groups where id = ${q(groupId)};
      delete from public.players where id in (${playerIds.map(q).join(", ")});
    `);
  } catch (error) {
    console.error("Fixture cleanup failed", error);
    throw error;
  }
}
