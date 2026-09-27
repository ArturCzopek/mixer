import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "@/lib/auth/roles";

const auth = vi.hoisted(() => ({
  requireSession: vi.fn(),
  requireGroupRole: vi.fn(),
}));
const db = vi.hoisted(() => ({
  writes: [] as {
    table: string;
    op: string;
    values?: unknown;
    filters: Record<string, unknown>;
  }[],
  responses: {} as Record<
    string,
    { data: unknown; error: { code: string; message: string } | null }
  >,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => auth);
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect ${url}`);
  },
}));
vi.mock("@/lib/db/admin", () => ({
  adminDb: () => ({
    from: (table: string) => {
      let op: string | null = null;
      let values: unknown;
      const filters: Record<string, unknown> = {};
      const result = () =>
        db.responses[`${table}:${op ?? "select"}`] ??
        (op === "insert" && table === "mixes"
          ? { data: { id: MIX }, error: null }
          : op === "update" && table === "mixes"
            ? { data: { id: MIX }, error: null }
            : table === "groups"
              ? { data: { slug: "crew" }, error: null }
              : table === "mixes"
                ? { data: { group_id: GROUP }, error: null }
                : { data: null, error: null });
      const builder = {
        select: () => builder,
        insert: (nextValues: unknown) => {
          op = "insert";
          values = nextValues;
          db.writes.push({ table, op, values, filters });
          return builder;
        },
        update: (nextValues: unknown) => {
          op = "update";
          values = nextValues;
          db.writes.push({ table, op, values, filters });
          return builder;
        },
        delete: () => {
          op = "delete";
          db.writes.push({ table, op, filters });
          return builder;
        },
        eq: (key: string, value: unknown) => {
          filters[key] = value;
          return builder;
        },
        maybeSingle: () => Promise.resolve(result()),
        single: () => Promise.resolve(result()),
        then: (
          resolve: (value: unknown) => unknown,
          reject: (error: unknown) => unknown,
        ) => Promise.resolve(result()).then(resolve, reject),
      };
      return builder;
    },
  }),
}));

const {
  addParticipant,
  createMix,
  joinMix,
  leaveMix,
  removeParticipant,
  setMixStatus,
} = await import("./actions");

const GROUP = "6f1b3c2a-8d4e-4f5a-9b6c-7d8e9f0a1b2c";
const PLAYER = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const OTHER_PLAYER = "7c6b5a4d-3e2f-4a1b-8c9d-0e1f2a3b4c5d";
const MIX = "4d0ea03c-bf8a-4d4b-a37b-21d3d40c5d55";
const validTitle = (value: string) => {
  const form = new FormData();
  form.set("title", value);
  return form;
};
const noPrev = undefined;

beforeEach(() => {
  db.writes.length = 0;
  for (const key of Object.keys(db.responses)) delete db.responses[key];
  auth.requireSession.mockReset();
  auth.requireGroupRole.mockReset();
  auth.requireSession.mockResolvedValue({ playerId: PLAYER });
  auth.requireGroupRole.mockResolvedValue({ playerId: PLAYER });
});

const everyAction = {
  createMix: () => createMix(GROUP, noPrev, validTitle("Friday mix")),
  joinMix: () => joinMix(MIX),
  leaveMix: () => leaveMix(MIX),
  addParticipant: () => addParticipant(MIX, OTHER_PLAYER),
  removeParticipant: () => removeParticipant(MIX, OTHER_PLAYER),
  setMixStatus: () => setMixStatus(MIX, "open", "balancing"),
};

describe("mix actions authorize before writing", () => {
  for (const [name, run] of Object.entries(everyAction)) {
    it.each([
      [401, "unauthorized"],
      [403, "forbidden"],
    ])(
      `${name}: %i returns %s and performs no write`,
      async (status, error) => {
        const authError = new AuthError(status as 401 | 403, "denied");
        if (name === "createMix") {
          auth.requireGroupRole.mockRejectedValue(authError);
        } else if (status === 401) {
          auth.requireSession.mockRejectedValue(authError);
        } else if (name === "leaveMix") {
          db.responses["mixes:select"] = { data: null, error: null };
        } else {
          auth.requireGroupRole.mockRejectedValue(authError);
        }
        expect(await run()).toEqual({ error });
        expect(db.writes).toEqual([]);
      },
    );
  }
});

describe("mix action validation and writes", () => {
  it("trims the title, uses the session player as creator, and leaves scheduling null", async () => {
    await expect(
      createMix(GROUP, noPrev, validTitle("  Friday mix  ")),
    ).rejects.toThrow(`redirect /g/crew/m/${MIX}`);
    expect(db.writes).toEqual([
      {
        table: "mixes",
        op: "insert",
        values: { group_id: GROUP, title: "Friday mix", created_by: PLAYER },
        filters: {},
      },
    ]);
  });

  it.each(["x", " ", "x".repeat(61)])(
    "rejects an invalid title before writing",
    async (title) => {
      expect(await createMix(GROUP, noPrev, validTitle(title))).toEqual({
        error: "title",
      });
      expect(db.writes).toEqual([]);
    },
  );

  it("validates every bound ID and the requested transition before DB work", async () => {
    expect(await createMix("bad", noPrev, validTitle("Valid title"))).toEqual({
      error: "forbidden",
    });
    expect(await joinMix("bad")).toEqual({ error: "forbidden" });
    expect(await leaveMix("bad")).toEqual({ error: "forbidden" });
    expect(await addParticipant(MIX, "bad")).toEqual({ error: "forbidden" });
    expect(await removeParticipant(MIX, "bad")).toEqual({ error: "forbidden" });
    expect(await setMixStatus(MIX, "voting", "locked" as never)).toEqual({
      error: "forbidden",
    });
    expect(await setMixStatus(MIX, "open", "locked" as "open")).toEqual({
      error: "forbidden",
    });
    expect(db.writes).toEqual([]);
    expect(auth.requireSession).not.toHaveBeenCalled();
    expect(auth.requireGroupRole).not.toHaveBeenCalled();
  });

  it("joins with the session player ID and treats an existing or duplicate join as success", async () => {
    expect(await joinMix(MIX)).toEqual({ ok: true });
    expect(db.writes).toContainEqual({
      table: "mix_participants",
      op: "insert",
      values: { mix_id: MIX, player_id: PLAYER, added_by: PLAYER },
      filters: {},
    });

    db.writes.length = 0;
    db.responses["mix_participants:select"] = {
      data: { player_id: PLAYER },
      error: null,
    };
    expect(await joinMix(MIX)).toEqual({ ok: true });
    expect(db.writes).toEqual([]);

    delete db.responses["mix_participants:select"];
    db.responses["mix_participants:insert"] = {
      data: null,
      error: { code: "23505", message: "duplicate" },
    };
    expect(await joinMix(MIX)).toEqual({ ok: true });
  });

  it.each([
    ["23514", "full"],
    ["23503", "notMember"],
    ["55000", "notOpen"],
  ])("maps join database error %s to %s", async (code, expected) => {
    db.responses["mix_participants:insert"] = {
      data: null,
      error: { code, message: "database guard" },
    };
    expect(await joinMix(MIX)).toEqual({ error: expected });
  });

  it.each([
    ["23514", "full"],
    ["23503", "notMember"],
    ["55000", "notOpen"],
  ])("maps admin add database error %s to %s", async (code, expected) => {
    db.responses["mix_participants:insert"] = {
      data: null,
      error: { code, message: "database guard" },
    };
    expect(await addParticipant(MIX, OTHER_PLAYER)).toEqual({
      error: expected,
    });
    expect(db.writes[0]).toMatchObject({
      table: "mix_participants",
      values: { player_id: OTHER_PLAYER, added_by: PLAYER },
    });
  });

  it("maps closed participant deletes to notOpen", async () => {
    db.responses["mix_participants:delete"] = {
      data: null,
      error: { code: "55000", message: "closed" },
    };
    expect(await leaveMix(MIX)).toEqual({ error: "notOpen" });
    expect(await removeParticipant(MIX, OTHER_PLAYER)).toEqual({
      error: "notOpen",
    });
  });

  it("returns forbidden for an unknown mix and maps DB lookup failures", async () => {
    db.responses["mixes:select"] = { data: null, error: null };
    expect(await joinMix(MIX)).toEqual({ error: "forbidden" });
    expect(db.writes).toEqual([]);

    db.responses["mixes:select"] = {
      data: null,
      error: { code: "08006", message: "offline" },
    };
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await joinMix(MIX)).toEqual({ error: "failed" });
    expect(db.writes).toEqual([]);
    error.mockRestore();
  });

  it("uses expected status as a conditional update and maps stale/not-full", async () => {
    expect(await setMixStatus(MIX, "open", "balancing")).toEqual({ ok: true });
    expect(db.writes[0]).toMatchObject({
      table: "mixes",
      op: "update",
      values: { status: "balancing" },
      filters: { id: MIX, status: "open" },
    });

    db.responses["mixes:update"] = {
      data: null,
      error: { code: "23514", message: "needs ten" },
    };
    expect(await setMixStatus(MIX, "open", "balancing")).toEqual({
      error: "notFull",
    });

    db.responses["mixes:update"] = {
      data: null,
      error: { code: "55000", message: "stale transition" },
    };
    expect(await setMixStatus(MIX, "open", "cancelled")).toEqual({
      error: "stale",
    });

    db.responses["mixes:update"] = { data: null, error: null };
    expect(await setMixStatus(MIX, "open", "cancelled")).toEqual({
      error: "stale",
    });
  });
});
