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
