# lib/demo

Demo parsing Web Worker + stat calculation from parsed events. Pure TS for the calculation part (no I/O). See [docs/05-demo-pipeline.md](../../docs/05-demo-pipeline.md).

Not implemented yet. The 2026-10-07 source review found an official prebuilt WASM worker demo,
but the published browser package is older than the current Node package. A recent CS2 demo,
worker memory measurement, compression handling and correctness comparison remain prerequisites
for S4. API statistics can expand independently; do not claim demo support from API fields.

The 2026-10-08 [overtime spike](../../docs/09-demo-overtime-spike.md) establishes a native
34-round/19:15 baseline with exact FACEIT K/D/A and rounded ADR parity. The tested browser lacks
native zstd decompression, and prebuilt WASM 0.15.0 fails with EntityNotFound on decompressed input.
Build current WASM and retest before product upload support; browser memory and parity are open.

Follow-up: current upstream WASM, with [a profiling clock compatibility patch](upstream-profiling.patch),
now passes the original zstd replay in an actual browser worker using streaming fzstd: 34 rounds,
19:15, all ten scoreboard rows match native output, about 9.64 seconds. This is still a spike:
whole-renderer peak memory and reproducible app packaging remain open. See the report for exact
versions, source commits, decoder limits and memory scope.
