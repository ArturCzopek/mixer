import { afterEach, describe, expect, it, vi } from "vitest";
import { DemoParseError, MAX_DEMO_BYTES, parseDemoFile } from "./client";

class FakeWorker {
  static instance: FakeWorker;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminate = vi.fn();
  postMessage = vi.fn();
  constructor() {
    FakeWorker.instance = this;
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("parseDemoFile", () => {
  it("rejects unsupported or oversized files without starting a worker", async () => {
    const worker = vi.fn();
    vi.stubGlobal("Worker", worker);
    await expect(
      parseDemoFile(new File(["x"], "demo.bz2"), vi.fn()),
    ).rejects.toMatchObject({ code: "unsupported" });
    const large = new File(["x"], "demo.dem");
    Object.defineProperty(large, "size", { value: MAX_DEMO_BYTES + 1 });
    await expect(parseDemoFile(large, vi.fn())).rejects.toMatchObject({
      code: "tooLarge",
    });
    expect(worker).not.toHaveBeenCalled();
  });

  it("releases worker buffers after completion and forwards progress", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const progress = vi.fn();
    const task = parseDemoFile(new File(["x"], "demo.dem.zst"), progress);
    const worker = FakeWorker.instance;
    worker.onmessage!({
      data: { type: "progress", progress: { stage: "read", percent: 50 } },
    });
    worker.onmessage!({
      data: { type: "complete", result: { payload: {}, preview: {} } },
    });
    await expect(task).resolves.toEqual({ payload: {}, preview: {} });
    expect(progress).toHaveBeenCalledWith({ stage: "read", percent: 50 });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("terminates parsing on cancellation and ignores a stale completion", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const controller = new AbortController();
    const progress = vi.fn();
    const task = parseDemoFile(
      new File(["x"], "demo.dem"),
      progress,
      controller.signal,
    );
    const rejection = expect(task).rejects.toMatchObject({
      name: "AbortError",
    });
    controller.abort();
    FakeWorker.instance.onmessage!({
      data: { type: "progress", progress: { stage: "events" } },
    });
    FakeWorker.instance.onmessage!({ data: { type: "complete", result: {} } });
    await rejection;
    expect(FakeWorker.instance.terminate).toHaveBeenCalledOnce();
    expect(progress).not.toHaveBeenCalled();
  });

  it("releases a failed or timed-out worker", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    vi.useFakeTimers();
    const task = parseDemoFile(new File(["x"], "demo.dem"), vi.fn());
    const rejection = expect(task).rejects.toBeInstanceOf(DemoParseError);
    vi.advanceTimersByTime(120_000);
    await rejection;
    expect(FakeWorker.instance.terminate).toHaveBeenCalledOnce();
  });
});
