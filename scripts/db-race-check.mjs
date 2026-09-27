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
const mixIds = [randomUUID(), randomUUID()];
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
    .flatMap((mixId) =>
      players
        .slice(0, 9)
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
    select pg_sleep(3);
    commit;
  `).then(
    () => null,
    (error) => error,
  );
  await sleep(500);
  const contender = sql(statement).then(
    () => ({ ok: true }),
    (error) => ({ ok: false, error }),
  );
  const holderError = await holder;
  const result = await contender;
  if (holderError) throw holderError;
  await assertion(result);
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

  console.log("ok concurrent join cap (23514, exactly 10 participants)");
  console.log(
    "ok status update waits for tenth join (balancing, exactly 10 participants)",
  );
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
