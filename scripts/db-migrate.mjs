#!/usr/bin/env node
// Applies db/migrations/*.sql to the Supabase project through the Management API (HTTPS only, no
// direct Postgres connection needed) and records them in supabase_migrations.schema_migrations
// (the table the Supabase CLI uses). With --verify it then runs db/tests/*.sql in a rolled-back
// transaction and checks over REST that the publishable key can read but not write.
//
// Env: SUPABASE_ACCESS_TOKEN, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (verify).
// Runs in the "DB migrate" GitHub workflow (the keys are repo secrets), or locally:
//   node --env-file=.env.local scripts/db-migrate.mjs [--verify] [--dry-run]

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const args = new Set(process.argv.slice(2));
const MIGRATIONS = "db/migrations";
const TESTS = "db/tests";

function env(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
const ref = new URL(supabaseUrl).hostname.split(".")[0];
const token = env("SUPABASE_ACCESS_TOKEN");

async function sql(query) {
  const res = await fetch(
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
  const text = await res.text();
  if (!res.ok) throw new Error(`SQL failed (${res.status}): ${text}`);
  return text ? JSON.parse(text) : [];
}

const quote = (s) => `'${s.replaceAll("'", "''")}'`;

await sql(`
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (
    version text primary key,
    statements text[],
    name text
  );
`);
const applied = new Set(
  (await sql("select version from supabase_migrations.schema_migrations")).map(
    (r) => r.version,
  ),
);

const files = readdirSync(MIGRATIONS)
  .filter((f) => /^\d{14}_.+\.sql$/.test(f))
  .sort();
const pending = files.filter((f) => !applied.has(f.slice(0, 14)));
console.log(
  `Project ${ref}: ${files.length} migrations, ${pending.length} pending`,
);

for (const file of pending) {
  const version = file.slice(0, 14);
  const name = file.slice(15, -4);
  if (args.has("--dry-run")) {
    console.log(`would apply ${file}`);
    continue;
  }
  const body = readFileSync(join(MIGRATIONS, file), "utf8");
  // One request = one implicit transaction: the migration and its bookkeeping row land together.
  await sql(
    `${body}\n;insert into supabase_migrations.schema_migrations (version, name) values (${quote(version)}, ${quote(name)});`,
  );
  console.log(`applied ${file}`);
}

if (args.has("--verify")) {
  for (const file of readdirSync(TESTS)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await sql(`begin;\n${readFileSync(join(TESTS, file), "utf8")}\nrollback;`);
    console.log(`ok ${file}`);
  }

  const key = env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const headers = { apikey: key, "Content-Type": "application/json" };
  const read = await fetch(`${supabaseUrl}/rest/v1/mixes?select=id&limit=1`, {
    headers,
  });
  if (read.status !== 200)
    throw new Error(
      `publishable key cannot read mixes: ${read.status} ${await read.text()}`,
    );
  console.log("ok publishable key can select");

  const write = await fetch(`${supabaseUrl}/rest/v1/players`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify({ steam_id: "70000000000000097" }),
  });
  if (write.ok) {
    await sql(
      "delete from public.players where steam_id = '70000000000000097'",
    );
    throw new Error("publishable key could insert into players");
  }
  console.log(`ok publishable key cannot insert (${write.status})`);
}
