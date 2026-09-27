import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ExternalApiError, getJson } from "./http";

const schema = z.object({ ok: z.boolean() });
const success = () => Response.json({ ok: true });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-27T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("FACEIT retry", () => {
  it.each([429, 500, 502, 503, 599])("retries HTTP %s once", async (status) => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status }))
      .mockResolvedValueOnce(success());
    const result = getJson("https://example.test", schema, {
      service: "faceit",
      revalidate: 600,
      headers: { Authorization: "Bearer test" },
      fetch,
    });
    await vi.advanceTimersByTimeAsync(999);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(2);
    const first = fetch.mock.calls[0][1];
    const second = fetch.mock.calls[1][1];
    expect(second).toMatchObject({
      headers: first.headers,
      next: { revalidate: 600 },
    });
    expect(second.signal).not.toBe(first.signal);
    expect(second.signal.aborted).toBe(false);
  });

  it.each([
    ["2", 2000],
    ["Sun, 27 Sep 2026 12:00:03 GMT", 3000],
    ["Sun, 27 Sep 2026 11:59:59 GMT", 0],
    ["invalid", 1000],
  ])("honours Retry-After %s", async (retryAfter, delay) => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 429,
          headers: { "Retry-After": retryAfter },
        }),
      )
      .mockResolvedValueOnce(success());
    const result = getJson("https://example.test", schema, {
      service: "faceit",
      revalidate: 0,
      fetch,
    });
    if (delay > 0) {
      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(fetch).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
    } else await vi.advanceTimersByTimeAsync(0);
    await expect(result).resolves.toEqual({ ok: true });
    expect(fetch.mock.calls[1][1].cache).toBe("no-store");
  });

  it("throws after the second failure without a third attempt", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 503 }));
    const result = getJson("https://example.test", schema, {
      service: "faceit",
      revalidate: 600,
      fetch,
    });
    const check = expect(result).rejects.toMatchObject({
      service: "faceit",
      status: 503,
    });
    await vi.advanceTimersByTimeAsync(1000);
    await check;
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["faceit", 400],
    ["faceit", 401],
    ["faceit", 403],
    ["faceit", 404],
    ["steam", 503],
    ["leetify", 429],
  ] as const)("does not retry %s HTTP %s", async (service, status) => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status }));
    await expect(
      getJson("https://example.test", schema, {
        service,
        revalidate: 600,
        fetch,
      }),
    ).rejects.toBeInstanceOf(ExternalApiError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("preserves nullable 404 after retry", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    const result = getJson("https://example.test", schema, {
      service: "faceit",
      revalidate: 600,
      allowNotFound: true,
      fetch,
    });
    await vi.advanceTimersByTimeAsync(1000);
    await expect(result).resolves.toBeNull();
  });

  it("does not retry invalid responses or network failures", async () => {
    for (const fetch of [
      vi.fn().mockResolvedValue(Response.json({ wrong: true })),
      vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    ]) {
      await expect(
        getJson("https://example.test", schema, {
          service: "faceit",
          revalidate: 600,
          fetch,
        }),
      ).rejects.toThrow();
      expect(fetch).toHaveBeenCalledTimes(1);
    }
  });
});
