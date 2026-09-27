import { beforeEach, describe, expect, it, vi } from "vitest";
import config from "@/vercel.json";

const db = vi.hoisted(() => ({
  read: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
}));
vi.mock("@/lib/db/admin", () => ({ adminDb: () => ({ from: db.from }) }));
const { GET } = await import("@/app/api/cron/keepalive/route");

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CRON_SECRET", "test-secret");
  db.from.mockReturnValue({ select: db.select });
  db.select.mockReturnValue({ limit: db.read });
  db.read.mockResolvedValue({ data: [], error: null });
});

const request = (authorization?: string) =>
  new Request("https://mixer.test/api/cron/keepalive", {
    headers: authorization ? { authorization } : {},
  });

describe("keepalive", () => {
  it.each([undefined, "Bearer wrong", "Bearer test-secrex", "test-secret"])(
    "rejects %s before accessing DB",
    async (header) => {
      expect((await GET(request(header))).status).toBe(401);
      expect(db.from).not.toHaveBeenCalled();
    },
  );
  it("fails closed when CRON_SECRET is missing", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(request("Bearer undefined"))).status).toBe(401);
    expect(db.from).not.toHaveBeenCalled();
  });
  it("reads the DB on every invocation, succeeds even with an empty table and returns no rows", async () => {
    for (let i = 0; i < 2; i++) {
      const response = await GET(request("Bearer test-secret"));
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toEqual({ ok: true });
    }
    expect(db.from).toHaveBeenCalledWith("groups");
    expect(db.select).toHaveBeenCalledWith("id");
    expect(db.read).toHaveBeenCalledWith(1);
    expect(db.read).toHaveBeenCalledTimes(2);
  });
  it.each([false, true])(
    "returns 503 for a database failure (thrown: %s)",
    async (throws) => {
      if (throws)
        db.read.mockRejectedValue(new Error("private connection details"));
      else
        db.read.mockResolvedValue({
          error: { message: "private connection details" },
        });
      const response = await GET(request("Bearer test-secret"));
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: "Database unavailable" });
    },
  );
  it("schedules the existing endpoint once daily", () => {
    expect(config.crons).toEqual([
      { path: "/api/cron/keepalive", schedule: "0 5 * * *" },
    ]);
  });
});
