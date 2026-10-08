# Demo event statistics

`lib/demo` contains the pure TypeScript calculation for demo-derived stats. The current M4-6 work
covers K/D/A, enemy damage and ADR, headshots, opening kills/deaths, five-second trades, KAST,
1vX clutches, utility damage, flash assists, enemies/teammates flashed, and multikills. It does not parse demo
files or perform I/O.

`prepareDemoRounds` excludes rounds before the last live-match start, maps winners from actual
player sides, and verifies death-event coverage against end-of-round alive snapshots. Missing
snapshots, duplicate deaths and unfinished rounds are rejected. `calculateDemoStats` computes the
statistics from those normalized rounds without I/O.

The calculator needs the measured demo tick rate, ordered events, and a complete snapshot for every
counted round. Each snapshot supplies the same player identities and stable team IDs, each player's
T/CT side, alive state and health, plus the winning team ID. Team score mapping follows the actual
round snapshots, including overtime; it must not assume a fixed halftime schedule. Event times use
the measured tick rate, including the five-second trade window.

Round boundaries must distinguish live-round stats from scoreboard events. KAST, opening kills,
trades and clutches use events through the round end. Scoreboard events continue until the next
`round_start`, which is an exclusive boundary. Survival for KAST is measured at round end, so a
post-round death does not erase survival.

The product flow is implemented: a group member selects a demo for one recorded map, previews
its ten-player scoreboard, and saves only when the map, exact teams, and score match. A missing
manual map name can be filled by the matching demo. `client.ts` runs `worker.ts`, cancels stale
work, and terminates the worker after every outcome. Original replay bytes remain local.

`payload.ts` bounds and validates event evidence; `actions.ts` recalculates statistics and checks
controller K/D/A and damage before calling the atomic `attach_demo_to_match` transaction. The RPC
locks the mix and map, checks active membership and the recorded lineup, preserves result source
and previous payload/stat evidence, and rejects duplicate attachments or mismatches. Only the
service role can execute it. Client evidence establishes consistency, not authenticity of a replay.

The selected map shows KAST, expandable player details, and round events with observed overtime.
Evening KAST requires complete coverage and is weighted by rounds; per-map details are not summed
into the evening. Thirteen event-based award types extend the existing eighteen awards.

The browser
spike in [the overtime report](../../docs/09-demo-overtime-spike.md) successfully parsed one
compressed replay in a local worker with a patched current WASM build and streaming `fzstd`: 34
rounds, a 19:15 result, and all ten scoreboard rows matching native output in about 9.64 seconds.
The follow-up runs the same TypeScript calculator in the browser in 9.61 seconds: all ten K/D/A and
HP-derived damage totals match controller values, and every calculated statistic matches the native
event baseline. This establishes implementation parity on this sample; advanced metrics do not have
an independent external reference. See the report for exact input requirements and limits.

The pinned-source Docker rebuild passed on 2026-10-08; provenance and hashes are in
[public/demo](../../public/demo/README.md). The actual product worker also parsed the supplied
compressed replay and enabled its matching preview. SQL tests pass locally in PGlite. The live
migration was explicitly approved and applied on 2026-10-08. All eight live SQL suites,
publishable-key checks and six affected PostgREST reads passed. Authenticated browser save still
requires a matching real Mix demo. The played view separates team scoreboards and a responsive
round grid, with grouped player details and observed side-change segments.
Whole-renderer peak memory remains unverified: process sampling did not cover the entire parse.
Input and decoded sizes are capped at 512 MiB; `fzstd` has a 32 MiB backreference limit.
Only complete GOTV demos are accepted; POV accuracy and `.bz2` decoding remain outside this flow.
