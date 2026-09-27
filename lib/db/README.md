# lib/db

Supabase clients and typed queries. Writes use the service role, server-side only. Schema: [docs/03-data-model.md](../../docs/03-data-model.md).

## Migrations

- SQL files in `db/migrations/` named `YYYYMMDDHHMMSS_name.sql` (Supabase CLI format), never edited after they are applied.
- `db/tests/*.sql`: behaviour checks (10-player cap and transition guards, participant join order and cascade deletes, vote integrity, anon cannot write, published-only variants, and browser column grants). They raise on failure.
- `lib/db/migrations.test.ts` applies all migrations + checks to an in-memory Postgres (PGlite) in `npm test`.
- **Applying:** the `DB migrate` GitHub workflow runs `scripts/db-migrate.mjs --verify` on every push to `main`
  that touches `db/`, using the repo secrets (Supabase Management API, recorded in
  `supabase_migrations.schema_migrations`). Manual run: Actions → DB migrate → Run workflow.
- `--verify` also checks public-column reads and that private-column REST requests return `401` / `42501`. It applies pending migrations before its checks. `--dry-run` still creates the
  `supabase_migrations` bookkeeping schema and table if they are missing.

The SQL harness uses one PGlite connection, so it cannot prove row-lock races. Against a disposable,
owner-selected dev project, run `node --env-file=.env.local scripts/db-race-check.mjs` to create a
temporary fixture, test a concurrent 11th join and a status change waiting for the tenth join over
separate Management API requests, then remove the fixture group in a `finally` block. Do not use
this against production; Claude runs this check separately from the local suite.
