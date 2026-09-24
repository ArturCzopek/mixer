# lib/db

Supabase clients and typed queries. Writes use the service role, server-side only. Schema: [docs/03-data-model.md](../../docs/03-data-model.md).

## Migrations

- SQL files in `db/migrations/` named `YYYYMMDDHHMMSS_name.sql` (Supabase CLI format), never edited after they are applied.
- `db/tests/*.sql`: behaviour checks (10-player cap, vote integrity, anon cannot write). They raise on failure.
- `lib/db/migrations.test.ts` applies all migrations + checks to an in-memory Postgres (PGlite) in `npm test`.
- **Applying:** the `DB migrate` GitHub workflow runs `scripts/db-migrate.mjs --verify` on every push to `main`
  that touches `db/`, using the repo secrets (Supabase Management API, recorded in
  `supabase_migrations.schema_migrations`). Manual run: Actions → DB migrate → Run workflow.
