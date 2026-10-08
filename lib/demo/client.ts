import type { DemoImportPayload, DemoStoredData } from "./payload";

export type DemoParseProgress = {
  stage: "read" | "initialize" | "events" | "snapshots" | "calculate";
  percent?: number;
};
export type DemoParsedFile = {
  payload: DemoImportPayload;
  preview: DemoStoredData;
};
export type DemoParseErrorCode =
  "unsupported" | "tooLarge" | "decode" | "invalid" | "memory" | "failed";
export class DemoParseError extends Error {
  constructor(public readonly code: DemoParseErrorCode) {
    super(code);
    this.name = "DemoParseError";
  }
}

export const MAX_DEMO_BYTES = 512 * 1024 * 1024;

/** A separate worker owns the large replay buffers and is released after every outcome. */
export function parseDemoFile(
  file: File,
  onProgress: (progress: DemoParseProgress) => void,
  signal?: AbortSignal,
): Promise<DemoParsedFile> {
  if (!/\.dem(?:\.zst)?$/i.test(file.name))
    return Promise.reject(new DemoParseError("unsupported"));
  if (!file.size || file.size > MAX_DEMO_BYTES)
    return Promise.reject(new DemoParseError("tooLarge"));
  if (signal?.aborted)
    return Promise.reject(new DOMException("Cancelled", "AbortError"));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    let settled = false;
    const finish = (result?: DemoParsedFile, error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener("abort", cancel);
      worker.terminate();
      if (error) reject(error);
      else resolve(result!);
    };
    const cancel = () =>
      finish(undefined, new DOMException("Cancelled", "AbortError"));
    const timeout = setTimeout(
      () => finish(undefined, new DemoParseError("failed")),
      120_000,
    );
    signal?.addEventListener("abort", cancel, { once: true });
    worker.onmessage = (
      event: MessageEvent<
        | { type: "progress"; progress: DemoParseProgress }
        | { type: "complete"; result: DemoParsedFile }
        | { type: "error"; code: DemoParseErrorCode }
      >,
    ) => {
      if (settled) return;
      if (event.data.type === "progress") onProgress(event.data.progress);
      else if (event.data.type === "error")
        finish(undefined, new DemoParseError(event.data.code));
      else finish(event.data.result);
    };
    worker.onerror = () => finish(undefined, new DemoParseError("failed"));
    worker.onmessageerror = () =>
      finish(undefined, new DemoParseError("failed"));
    worker.postMessage({ file });
  });
}
