import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

// Applies db/migrations/*.sql to an in-memory Postgres (PGlite) with the bits of Supabase they
// rely on (roles, realtime publication), then runs db/tests/*.sql, which raise on a failed check.
const ROOT = join(__dirname, "..", "..");
const SUPABASE_PRELUDE = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  create publication supabase_realtime;
`;

function sqlFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir))
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(ROOT, dir, f), "utf8"));
}

describe("db migrations", () => {
  it("apply cleanly and pass the schema checks", async () => {
    const db = new PGlite();
    await db.exec(SUPABASE_PRELUDE);
    for (const sql of sqlFiles("db/migrations")) await db.exec(sql);

    for (const sql of sqlFiles("db/tests")) {
      await db.exec(`begin;\n${sql}\nrollback;`);
    }

    const { rows } = await db.query<{ tablename: string }>(
      "select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1",
    );
    expect(rows.map((r) => r.tablename)).toEqual([
      "mix_participants",
      "mixes",
      "variants",
      "votes",
    ]);
    await db.close();
  }, 30_000);
});
