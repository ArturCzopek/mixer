# lib/external

Server-only API clients, responses validated with Zod against the recorded fixtures in `__fixtures__/` (tests: `external.test.ts`). See [docs/06-external-apis.md](../../docs/06-external-apis.md).

- `steam.ts`: `parseSteamInput` (SteamID64 / profile URL / vanity), `resolveSteamInput`, `getPlayerSummaries` (100 IDs per call).
- `faceit.ts`: `getPlayerBySteamId` (null if no account), `getMatchStats` (paged, from/to in ms), `toFormSamples` (input for balancing F), `getLifetimeStats`.
- `http.ts`: `getJson` with timeout, Next.js data cache (`revalidate`) and `ExternalApiError`; URLs are never logged (the Steam key is in the query).
- `leetify.ts` (M3-2): display only, Leetify data must never be stored.

Every client takes `{ apiKey, fetch }` for tests; by default it reads the key from the environment.
