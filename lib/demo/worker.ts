import { Decompress, ZstdErrorCode } from "fzstd";
import { prepareDemoRounds, type DemoPlayerSnapshot } from "./prepare";
import {
  buildDemoStoredData,
  validateDemoImportPayload,
  type DemoImportPayload,
} from "./payload";
import type { DemoEvent } from "./stats";
import type { DemoParseProgress, DemoParseErrorCode } from "./client";

const MAX_BYTES = 512 * 1024 * 1024;
type Parser = typeof import("../../public/demo/demoparser2");
type Tick = DemoPlayerSnapshot & {
  name: string;
  game_time: number;
  kills_total: number;
  deaths_total: number;
  assists_total: number;
  damage_total: number;
};
type RawEvent = Record<string, unknown> & {
  event_name: string;
  tick: number;
  winner?: string | null;
};

function plain(value: unknown): unknown {
  if (value instanceof Map)
    return Object.fromEntries(
      [...value].map(([key, entry]) => [key, plain(entry)]),
    );
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === "bigint") return String(value);
  return value;
}

function progress(stage: DemoParseProgress["stage"], percent?: number) {
  self.postMessage({ type: "progress", progress: { stage, percent } });
}

async function fileHash(file: File): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(hash)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function replayBytes(file: File): Promise<Uint8Array> {
  let stream: ReadableStream<Uint8Array> = file.stream();
  let read = 0;
  let output = 0;
  let lastPercent = -1;
  const report = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      read += chunk.byteLength;
      const percent = Math.round((read / file.size) * 100);
      if (percent !== lastPercent) {
        progress("read", percent);
        lastPercent = percent;
      }
      controller.enqueue(chunk);
    },
  });
  stream = stream.pipeThrough(report);
  if (/\.zst$/i.test(file.name)) {
    let decoder: Decompress;
    stream = stream.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        start(controller) {
          decoder = new Decompress((chunk) => {
            output += chunk.byteLength;
            if (output > MAX_BYTES) throw new Error("tooLarge");
            // Decoder reuses its output storage; the stream owns each emitted copy.
            if (chunk.byteLength) controller.enqueue(chunk.slice());
          });
        },
        transform(chunk) {
          decoder.push(chunk);
        },
        flush() {
          decoder.push(new Uint8Array(0), true);
        },
      }),
    );
  }
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) throw new Error("tooLarge");
  return bytes;
}

self.onmessage = async (message: MessageEvent<{ file: File }>) => {
  let stage: DemoParseProgress["stage"] = "read";
  try {
    const file = message.data.file;
    if (!file.size || file.size > MAX_BYTES) throw new Error("tooLarge");
    progress(stage, 0);
    const demoHash = await fileHash(file);
    const bytes = await replayBytes(file);
    if (new TextDecoder().decode(bytes.subarray(0, 8)) !== "PBDEMS2\0")
      throw new Error("invalid");
    stage = "initialize";
    progress(stage);
    const bindingsUrl = "/demo/demoparser2.js";
    const parser: Parser = await import(/* webpackIgnore: true */ bindingsUrl);
    await parser.default({ module_or_path: "/demo/demoparser2_bg.wasm" });
    const header = plain(parser.parseHeader(bytes)) as {
      map_name: string;
      client_name: string;
    };
    // Partial POV streams are not approved for enrichment until their accuracy is established.
    if (header.client_name !== "SourceTV Demo") throw new Error("invalid");
    stage = "events";
    progress(stage);
    const rawEvents = plain(
      parser.parseEvents(
        bytes,
        [
          "round_start",
          "round_announce_match_start",
          "round_end",
          "round_freeze_end",
          "player_hurt",
          "player_death",
          "player_blind",
          "other_death",
          "server_cvar",
        ],
        ["team_num"],
        ["total_rounds_played"],
      ),
    ) as RawEvent[];
    const timeline = rawEvents.filter(
      (event) => event.event_name.startsWith("round_") && event.tick >= 0,
    );
    const starts = timeline.filter(
      (event) => event.event_name === "round_announce_match_start",
    );
    if (!starts.length) throw new Error("invalid");
    const live = Math.max(...starts.map((event) => event.tick));
    const ends = timeline.filter(
      (event) => event.event_name === "round_end" && event.tick > live,
    );
    const freezes = timeline.filter(
      (event) => event.event_name === "round_freeze_end" && event.tick >= live,
    );
    if (!ends.length || ends.length > 100) throw new Error("invalid");
    const lastEnd = ends.at(-1)!.tick;
    stage = "snapshots";
    progress(stage);
    const wantedTicks = new Int32Array([
      ...new Set([...freezes, ...ends].map((event) => event.tick)),
    ]);
    const ticks = plain(
      parser.parseTicks(
        bytes,
        [
          "team_num",
          "is_alive",
          "health",
          "game_time",
          "kills_total",
          "deaths_total",
          "assists_total",
          "damage_total",
        ],
        wantedTicks,
        [],
        false,
      ),
    ) as Tick[];
    const final = ticks.filter(
      (row) =>
        row.tick === lastEnd &&
        row.steamid &&
        (row.team_num === 2 || row.team_num === 3),
    );
    if (final.length !== 10) throw new Error("invalid");
    const players = final.map((row) => ({
      steamid: row.steamid,
      name: row.name,
      teamId: String(row.team_num),
    }));
    const fields = [
      "attacker_steamid",
      "user_steamid",
      "assister_steamid",
      "assistedflash",
      "headshot",
      "dmg_health",
      "health",
      "weapon",
      "blind_duration",
      "penetrated",
      "thrusmoke",
      "noscope",
      "attackerblind",
      "attackerinair",
      "othertype",
    ];
    const combat = rawEvents
      .filter(
        (event) =>
          event.tick >= live &&
          [
            "player_death",
            "player_hurt",
            "player_blind",
            "other_death",
          ].includes(event.event_name),
      )
      .map((event) =>
        Object.fromEntries([
          ["event_name", event.event_name],
          ["tick", event.tick],
          ...fields
            .filter(
              (field) => event[field] !== undefined && event[field] !== null,
            )
            .map((field) => [
              field,
              event[field] === "0" ? null : event[field],
            ]),
        ]),
      ) as DemoEvent[];
    const snapshots = ticks.map((row) => ({
      steamid: row.steamid,
      tick: row.tick,
      team_num: row.team_num,
      is_alive: row.is_alive,
      health: row.health,
    }));
    const rounds = prepareDemoRounds({
      players,
      timeline,
      snapshots,
      events: combat,
    });
    const first = ticks.find((row) => row.tick === rounds[0].startTick)!;
    const end = ticks.find((row) => row.tick === rounds[0].endTick)!;
    const tickRate =
      (end.tick - first.tick) / (end.game_time - first.game_time);
    const maxRounds = rawEvents
      .filter(
        (event) =>
          event.event_name === "server_cvar" &&
          event.name === "mp_maxrounds" &&
          event.tick <= live,
      )
      .at(-1);
    const observedMaxRounds = Number(maxRounds?.value);
    const regulationRounds =
      Number.isInteger(observedMaxRounds) &&
      observedMaxRounds >= 2 &&
      observedMaxRounds <= 60 &&
      observedMaxRounds % 2 === 0
        ? observedMaxRounds
        : null;
    const payload: DemoImportPayload = {
      version: 1,
      demoHash,
      mapName: header.map_name,
      tickRate,
      regulationRounds,
      players,
      rounds,
      events: combat,
      endSnapshots: snapshots.filter((row) =>
        ends.some((event) => event.tick === row.tick),
      ),
      controller: final.map((row) => ({
        steamid: row.steamid,
        kills: row.kills_total,
        deaths: row.deaths_total,
        assists: row.assists_total,
        damage: row.damage_total,
      })),
    };
    stage = "calculate";
    progress(stage);
    const checked = validateDemoImportPayload(payload);
    const preview = buildDemoStoredData(checked);
    self.postMessage({
      type: "complete",
      result: { payload: checked, preview },
    });
  } catch (error) {
    let code: DemoParseErrorCode = "failed";
    if (
      stage === "read" &&
      error instanceof Error &&
      "code" in error &&
      error.code === ZstdErrorCode.WindowSizeTooLarge
    )
      code = "unsupported";
    else if (
      error instanceof Error &&
      (error.message === "tooLarge" || /too large/i.test(error.message))
    )
      code = "tooLarge";
    else if (
      error instanceof RangeError ||
      (error instanceof Error && /memory|allocation/i.test(error.message))
    )
      code = "memory";
    else if (stage === "read") code = "decode";
    else if (
      stage === "events" ||
      stage === "snapshots" ||
      stage === "calculate" ||
      (error instanceof Error && error.message === "invalid")
    )
      code = "invalid";
    self.postMessage({ type: "error", code });
  }
};
