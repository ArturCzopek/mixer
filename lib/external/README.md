# lib/external

Server-only API clients, responses validated with Zod against the recorded fixtures in `__fixtures__/` (tests: `external.test.ts`). See [docs/06-external-apis.md](../../docs/06-external-apis.md).

- `steam.ts`: `parseSteamInput` (SteamID64 / profile URL / vanity), `resolveSteamInput`, `getPlayerSummaries` (100 IDs per call).
- `faceit.ts`: `getPlayerBySteamId` (null if no account), `getMatchStats` (100 per page, up to 200 records by default; from/to in ms), `toFormSamples` (input for balancing F). No lifetime client: balancing never reads lifetime stats.
- `http.ts`: `getJson` uses a 10 s timeout per attempt and Zod validation; only an explicitly allowed 404 is nullable, other HTTP/schema errors throw `ExternalApiError`. FACEIT retries once on HTTP 429/5xx, respecting `Retry-After` seconds or an HTTP date (1 s when absent/invalid); Steam and Leetify do not retry. It uses the Next.js data cache (`revalidate`) or `no-store`; URLs are never logged (the Steam key is in the query). Retry tests live in `http.test.ts`.
- `leetify.ts` (M3-2): display only; responses use a five-minute Next server fetch cache and are never stored in our database.

Every client takes `{ apiKey, fetch }` for tests; by default it reads the key from the environment.
