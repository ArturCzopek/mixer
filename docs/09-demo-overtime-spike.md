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

## Next smallest step

Build the current upstream WASM source and rerun this exact replay before building the product
upload flow. Then add browser zstd support, measure memory and compare extracted events/statistics
with the native baseline. This supplied non-Mix demo is sufficient for parser testing; later Mix
enrichment requires identity/map/score validation against the actual stored Mix.

Upstream primary sources: [parser](https://github.com/LaihoE/demoparser),
[WASM worker example](https://github.com/LaihoE/demoparser-wasm-demo/blob/master/worker.js),
[WASM API](https://github.com/LaihoE/demoparser-wasm-demo/blob/master/pkg/demoparser2.d.ts).
