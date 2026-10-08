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

Product demo upload, result preview, and saving/enriching a match are not implemented. The browser
spike in [the overtime report](../../docs/09-demo-overtime-spike.md) successfully parsed one
compressed replay in a local worker with a patched current WASM build and streaming `fzstd`: 34
rounds, a 19:15 result, and all ten scoreboard rows matching native output in about 9.64 seconds.
The follow-up runs the same TypeScript calculator in the browser in 9.61 seconds: all ten K/D/A and
HP-derived damage totals match controller values, and every calculated statistic matches the native
event baseline. This establishes implementation parity on this sample; advanced metrics do not have
an independent external reference. See the report for exact input requirements and limits.

S4 remains open for whole-renderer peak-memory measurement and reproducible packaging of the WASM
build and decoder. `fzstd`'s documented 32 MiB backreference limit also remains a known input limit.
Do not describe M4-6 or product demo support as complete until the stats, validation, and product
flow are integrated.
