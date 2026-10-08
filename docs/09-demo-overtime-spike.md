# Overtime demo feasibility test (2026-10-08)

S4 (browser demo parser feasibility) / M4-6 (demo extras). Supplied by Artur: a non-Mix FACEIT
CS2 replay with overtime, match `1-f76dbfd7-7fbb-4203-93eb-4b35899674a2`.
The replay and player-level results stay in ignored `backtest/.local/demo-spike/`; nothing was
attached to a group Mix, uploaded remotely, or written to the database.

## Native baseline

- Input: 289,913,207-byte zstd file; decompressed: 400,898,483 bytes.
- Node 24.19.0 streaming zstd decompression: about 1.4 seconds.
- Native `@laihoe/demoparser2` 0.42.0 read the Anubis replay, CS2 patch 14188.
- Header + player identities + match-start/round-end/freeze events: about 0.54 seconds.
- Process high-water RSS for that initial decompression/parse run: about 534 MiB; this includes
  the baseline process and decompression and is not browser/WASM memory.
- Two match-start events at ticks 1280 and 4674. Discard ends before the last start to remove
  the knife/restart round. The first live freeze-end shares tick 4674 with the match start;
  the filter must retain it (`>=`, not `>`).
- 34 completed live rounds: regulation 12:12, first overtime six rounds, second overtime four.
- Reconstructed team score: 19:15. Map each round's T/CT winner to player identities at that
  round's freeze-end; do not use one fixed side for the entire replay.
- Final-tick controller K/D/A match FACEIT exactly for all ten players. Controller damage / 34
  agrees with FACEIT ADR to its displayed one-decimal precision for all ten players.
- Raw `round_end.round` runs from 2 to 35 because of the earlier knife round. Counting valid live
  ends yields 34; treating that raw field as the match round count would incorrectly yield 35.

The native check has runnable assertions in ignored `backtest/.local/demo-spike/validate.cjs`.
It validates observed round/team reconstruction and final scoreboard parity, not an implemented
KAST/trade/clutch/event-damage calculator. Parser queries requested only relevant events/ticks.

## Actual browser worker test

A loopback-only scratch page serves the WASM assets and worker, with a local file input. Its
server accepts GET for four asset routes only; there is no demo upload endpoint. The worker
reads the File directly. No external hosting or demo transmission was used.

- Compressed input: the tested in-app desktop browser rejects
  `DecompressionStream('zstd')` with unsupported compression format. A client-side zstd decoder
  or a pre-decompressed input is needed for this browser.
- Decompressed input: published WASM `demoparser2` 0.15.0 fails `parseEvents` with
  `EntityNotFound` after about 2.49 seconds. This is a parser compatibility failure;
  it does not establish a memory limit or prove that current WASM source would fail.
- No completed browser/native statistics parity or browser high-water memory measurement exists.
  S4 remains open. Do not ship this prebuilt WASM as CS2 demo support.

## Initial next step (completed in the follow-up below)

Build the current upstream WASM source and rerun this exact replay before building the product
upload flow. Then add browser zstd support, measure memory and compare extracted events/statistics
with the native baseline. This supplied non-Mix demo is sufficient for parser testing; later Mix
enrichment requires identity/map/score validation against the actual stored Mix.

Upstream primary sources: [parser](https://github.com/LaihoE/demoparser),
[WASM worker example](https://github.com/LaihoE/demoparser-wasm-demo/blob/master/worker.js),
[WASM API](https://github.com/LaihoE/demoparser-wasm-demo/blob/master/pkg/demoparser2.d.ts).


## Current WASM build follow-up (2026-10-08)

Built upstream commit `45ca85aeac8fb0de9d385124d2c7fe0e7b8ff0c8` with Rust's
`wasm32-unknown-unknown` target in an isolated official Rust Docker image. The build regenerated
protocol bindings from GameTracking-CS2 `ac1278dbbff39b7fe5030fba42a010e455c011f6`.
`wasm-bindgen` 0.2.100 generated no-modules worker bindings. Final WASM size: 3,219,350 bytes.

The unmodified current build trapped during event parsing (`RuntimeError: unreachable`).
Inspection found unconditional native `std::time::Instant::now()` calls in profiling paths.
The [compatibility patch](../lib/demo/upstream-profiling.patch) only creates those clocks when
profiling is enabled; it does not change replay parsing or statistics. A local diagnostic panic
hook was also added to the test build. After the patch, the actual browser worker completed.
Current bindings return Maps for event rows; normalize those explicitly instead of assuming
plain objects. SteamID64 values in tick rows are strings and were checked without numeric coercion.

### Compressed-input result

- Streaming `fzstd` 0.1.1 decoded the original supplied zstd file locally in the worker.
- Node decoder check: 3.40 seconds, 400,898,483 decoded bytes. SHA-256 matches the native output:
  `f167b98fa013e7234a73f4da9257e7c4d8c16a1c07b513ddc105a50842251904`.
- Actual desktop browser: decompression/read about 3.55 seconds; full round/scoreboard validation
  about 9.64 seconds. 34 live rounds, regulation 12:12, final 19:15. Winner mapping uses actual
  freeze-end player sides, including both overtimes. All ten final K/D/A/damage/team rows match
  native output; native output previously matched FACEIT, including rounded ADR.
- Final WASM linear memory capacity: 409,010,176 bytes (390.06 MiB). This is allocator capacity,
  not measured whole-renderer peak RSS. The decompressed input adds 382.33 MiB while retained;
  decoder state, JS outputs and temporary copies add further memory. Whole-browser peak memory
  and lower-memory optimizations remain open.
- `fzstd` has a documented 32 MiB backreference limit. This replay passes; arbitrary larger
  windows are not established. `zstd-wasm-decoder` 0.2.3 was also tested and rejects this frame
  as `win 2 large` because of its 10,000,000-byte window limit.

The local harness asserts score, regulation, round count, ten-player identity and scoreboard
parity. Replay data and generated binaries remain in ignored `backtest/.local/demo-spike/`.
Only the minimal upstream compatibility patch and this report are committed. Streaming decoder
research was delegated with requested `gpt-6-luna` / xhigh; the child runtime did not independently
expose model confirmation. No application dependency, upload route or database write was added.

This establishes browser compatibility for this sample with a patched current build, replacing
the earlier prebuilt-WASM failure. S4 remains partial until whole-process memory is measured and
the build/decoder are packaged reproducibly for the app. M4-6 still needs stat calculation,
identity/map/score validation and atomic result enrichment; KAST/trades/clutches are not yet
implemented by this spike.

Decoder primary source: [fzstd](https://github.com/101arrowz/fzstd).

Validation: native and browser parity assertions passed; 439 repository tests, lint, typecheck,
format check and production build passed. ESLint now excludes ignored private backtest fixtures
and third-party build artifacts, matching their existing Git exclusion.

## Event-stat calculation follow-up (2026-10-08)

`lib/demo/prepare.ts` now normalizes completed live rounds from the last
`round_announce_match_start`, including a freeze-end on the same tick. It resolves winners using
observed player sides, never a fixed halftime/overtime formula. Complete start/end snapshots are
required; end alive states must match the death events. Missing snapshots, duplicate deaths and an
unfinished last round are rejected. Scoreboard events end at the exclusive next `round_start`;
opening duels, trades, clutches and KAST survival end at inclusive `round_end`.

`lib/demo/stats.ts` computes K/D/A and per-round rates, enemy damage/ADR, headshots, first enemy
kill/death, five-second trades, KAST, 1vX clutch attempts/wins, utility damage, flash assists,
enemy/teammate flashes above 0.5 seconds (excluding self), and multikills. Team/world/self damage
updates victim health but contributes no enemy damage. A clutch is won when its team wins, including
a planted-bomb win after the last player dies. Post-round deaths do not erase round-end survival.

### Damage rounding correction

Summing `min(dmg_health, previousHP)` undercounted all ten players by 13–41 damage on this replay.
There are 248 nonfatal hurt events where `dmg_health` is one point lower than the observed HP loss.
Computing `previousHP - event.health` instead produces exact controller damage totals for all ten
players, caps overkill naturally, and accounts for preceding uncredited friendly/world damage.
This is an observed integer-rounding discrepancy in this sample, not a claim about every parser or
game version. Start health and nonincreasing event health are validated; healing modes are unsupported.

### Native/browser comparison

- Native event-derived K/D/A and damage match all ten controller rows, over all 34 completed rounds.
  Those controller values already match the FACEIT K/D/A and rounded ADR baseline.
- Measured tick rate is 64, from tick and `game_time` differences between the first freeze and end.
- The actual browser worker parses the original compressed file and runs the same pure TypeScript
  adapter/calculator. Every field of every player's calculated statistics matches the native event
  baseline. First run: 9.61 seconds including 3.37 seconds decoding/read; WASM capacity 411,369,472
  bytes (392.31 MiB), plus the retained 382.33 MiB input. The final version, including separate teammate
  flash counts, passed again in 9.95 seconds (3.63 seconds decoding/read). Whole-process peak memory
  is still unmeasured.
- Sample checks: 34 opening kills/deaths, 44 trade kills, KAST range 52.94–85.29%. These advanced
  metrics have implementation parity and focused edge-case tests, not an independent external
  accuracy reference. Incomplete POV event streams are not approved for product enrichment.

The raw replay, extracted fixtures and local browser harness remain ignored. Product upload/preview,
reproducible WASM/decoder packaging, whole-process memory measurement, identity/map/score validation,
atomic enrichment and full Mixer Rating replacement remain open. No database query/write or
balancing change is included. M4-6 is partial, not complete.

Delegation requested Sol high for event calculation and Luna xhigh for documentation; runtime did
not independently expose model confirmation. Validation: 455 tests, lint, typecheck, format check
and production build, plus native/browser replay assertions. No Supabase/PostgREST embed changed.

## Product integration follow-up (2026-10-08)

The product file-picker flow parsed the original compressed replay using freshly rebuilt pinned
WebAssembly bindings. Its matching preview showed ten players, 19:15, and exact K/D/A/damage
controller parity. The compact validated evidence was about 349 kB; replay bytes stayed local.
The selected-map UI adds KAST, expandable player details, and opening/clutch/multikill events for
34 rounds, including ten overtime rounds. Desktop and 375 px mobile layouts were inspected.

Thirteen additional demo awards use observed event fields; missing coverage excludes them.
The local transaction tests cover active membership, exact saved teams, mismatch rollback,
previous-data preservation, duplicate attachment, and restricted RPC execution. Presentation
projection excludes stored evidence and previous payloads. Server recalculation checks consistency
but cannot authenticate a user-supplied replay without its binary.

Validation: 492 tests, lint, typecheck, format check, and production build passed. The pinned-source
Docker recipe passed after normalizing Windows checkout line endings inside the container; shipped
hashes are recorded in public/demo/README.md. Whole-renderer peak memory is still unverified: two
process-sampling intervals missed part of the file selection/parse. The 512 MiB file/decoded-input
cap and 32 MiB fzstd backreference limit remain; only complete GOTV demos are accepted.

Automatic approval review rejected the live migration because it interpreted the earlier database
deferral as still active. No migration or push was made. Owner approval is required before applying
migration 20261008100000 and releasing it; pushing the migration also triggers the DB workflow.
A matching real Mix demo is still needed for authenticated browser save verification.

## Approved release and presentation follow-up (2026-10-08)

Artur explicitly approved the feature migration and publication, resolving the earlier approval
rejection. Migration 20261008100000 is applied. Eight live SQL suites, publishable-key access
checks and six affected PostgREST reads passed.

Impeccable refinement preserves the CS 1.6/VGUI direction: selected-map Scoreboard/Rounds tabs,
paired team tables on desktop, stacked tables on phones, grouped expandable player details,
and responsive round grids segmented by phase and observed side changes. Selected rounds show
cumulative score and opening/clutch/multikill events. Desktop and 375 px mobile confirmation
and a fresh independent visual review found no material defects. Presentation and side-metadata
tests bring the suite to 496 passing tests; lint, typecheck, format check and the production build
also pass. Authenticated save with a matching real Mix demo and
whole-renderer peak-memory measurement remain open.
