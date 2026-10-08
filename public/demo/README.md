# Browser demo parser

The browser demo flow reads compressed or uncompressed CS2 replay files locally. The worker streams
Zstandard input through `fzstd` 0.1.1, parses the selected event and tick fields with LaihoE's
`demoparser2` WebAssembly build, then passes the extracted evidence to `prepareDemoRounds` and
`calculateDemoStats`. The server receives bounded event and round evidence plus a SHA-256 digest for
validation and storage; the original `.dem` bytes are never uploaded.

## Build provenance

Run `pwsh -File scripts/build-demo-wasm.ps1` from the repository root. The script stores clean
source checkouts and generated output in the ignored `backtest/.local/demo-build` directory. It
never resets an existing checkout: it reuses only clean repositories at the pinned commits and
fails if the directory contains different source. The Docker build mounts only that scratch
directory, copies the sources to the container's temporary filesystem, and applies the build-only
adjustments there.

The inputs are pinned as follows:

| Input | Pin or adjustment |
| --- | --- |
| `LaihoE/demoparser` | `45ca85aeac8fb0de9d385124d2c7fe0e7b8ff0c8` |
| `SteamDatabase/GameTracking-CS2` protobufs | `ac1278dbbff39b7fe5030fba42a010e455c011f6` |
| Rust build image | `rust:1-bookworm@sha256:114c7a4425406451c2866b6aafe69fe29b1b298832db1277d411ac73c82d04d6` |
| Protobuf compiler | Debian bookworm `3.21.12-3+deb12u1` |
| `wasm-bindgen` CLI | Official `0.2.100` Linux musl release archive, SHA-256 `63d6a38deb65bd7023c02bdf382ab66b0d2c0241c8582fd3413b5a808b8aeb5b` |
| Compatibility patch | [`upstream-profiling.patch`](../../lib/demo/upstream-profiling.patch), which avoids creating profiling timers when profiling is disabled |
| WASM diagnostic hook | Appended build-only panic hook logs Rust panics to the browser console |

Generated WebAssembly bindings are written to `backtest/.local/demo-build/web-wasm`. The deployment
files are `demoparser2.js` and `demoparser2_bg.wasm`; TypeScript declarations are also emitted for
inspection. The script prints SHA-256 digests for the generated runtime files. Copy those two files
to this directory only when intentionally refreshing the shipped parser.

This is a pinned-source rebuild recipe, not a claim of bit-for-bit reproducibility. Debian package
repositories and locked Cargo dependencies remain external inputs. Run the script successfully
before treating a fresh generated build as verified.

The recipe completed successfully on 2026-10-08, including clean LF source normalization inside
the container for Windows checkouts. The generated deployment files were tested by the product
worker against the supplied compressed overtime replay:

- `demoparser2.js`: `acfe1231a54a7a3bf3fdc892c1b3966f34d764c32cf7cbf3ee48a6c74751e9a5`
- `demoparser2_bg.wasm`: `48053547547793ef30b2c44c3028bbaa628778908388653c858688b678393fb0`

## Runtime limits

The browser rejects decoded replay data above 512 MiB. This is an input cap, not a bound on total
browser-process memory: decompressed bytes, WebAssembly memory, parsed events, and JavaScript objects
can coexist. Whole-renderer peak memory has not been measured. `fzstd` also has a documented 32 MiB
Zstandard backreference limit.

The bundled parser is MIT-licensed; see [LICENSE](./LICENSE). Its source and protobuf inputs are
listed above so future parser refreshes can be reviewed against the same provenance.
