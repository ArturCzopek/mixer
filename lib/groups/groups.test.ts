import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "@/lib/auth/roles";
import { parseGroupForm, toSlug } from "./form";

// The actions run against mocks: the session/role checks and the DB client. What matters here is the
// order (authorize before any write) and the error mapping; the DB invariants are in db/tests/groups.sql.
const auth = vi.hoisted(() => ({
  requireSession: vi.fn(),
  requireGroupRole: vi.fn(),
}));
const db = vi.hoisted(() => ({
  calls: [] as { table: string; op: string; values?: unknown }[],
  result: { error: null as { code: string; message: string } | null },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => auth);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect ${url}`);
  }),
}));
vi.mock("@/lib/db/admin", () => ({
  adminDb: () => ({
    from: (table: string) => {
      const chain = {
        eq: () => chain,
        is: () => chain,
        then: (ok: (r: unknown) => unknown) =>
          Promise.resolve(db.result).then(ok),
      };
      return {
        insert: (values: unknown) => {
          db.calls.push({ table, op: "insert", values });
          return Promise.resolve(db.result);
        },
        update: (values: unknown) => {
          db.calls.push({ table, op: "update", values });
          return chain;
        },
      };
    },
  }),
}));

const { createGroup, updateGroup, changeMember } = await import("./actions");

const GROUP = "6f1b3c2a-8d4e-4f5a-9b6c-7d8e9f0a1b2c";
const PLAYER = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const valid = { name: "Our Crew", slug: "our-crew", faceitClub: "" };

beforeEach(() => {
  db.calls.length = 0;
  db.result.error = null;
  auth.requireSession.mockResolvedValue({ playerId: PLAYER });
  auth.requireGroupRole.mockResolvedValue({ playerId: PLAYER });
});

describe("group form", () => {
  it("parses a FACEIT Club link and its club id", () => {
    const r = parseGroupForm(
      form({
        ...valid,
        slug: " Our-Crew ",
        faceitClub:
          "https://www.faceit.com/en/club/0A1B2C3D-0000-4000-8000-000000000001/parties",
      }),
      true,
    );
    expect(r).toEqual({
      ok: true,
      value: {
        name: "Our Crew",
        slug: "our-crew",
        faceitClubUrl:
          "https://www.faceit.com/en/club/0A1B2C3D-0000-4000-8000-000000000001/parties",
        faceitClubId: "0a1b2c3d-0000-4000-8000-000000000001",
      },
    });
  });

  it.each([
    ["name", { name: "x" }],
    ["slug", { slug: "no spaces" }],
    ["slug", { slug: "-edge" }],
    ["faceitClub", { faceitClub: "https://evil.example/club/1" }],
  ])("rejects a bad %s", (field, over) => {
    expect(parseGroupForm(form({ ...valid, ...over }), true)).toEqual({
      ok: false,
      field,
    });
  });

  it("ignores the slug when editing", () => {
    expect(parseGroupForm(form({ ...valid, slug: "" }), false).ok).toBe(true);
  });
});

describe("group actions authorize before writing", () => {
  it("createGroup: 401 without a session, nothing written", async () => {
    auth.requireSession.mockRejectedValue(new AuthError(401, "log in"));
    expect(await createGroup(undefined, form(valid))).toEqual({
      error: "unauthorized",
    });
    expect(db.calls).toEqual([]);
  });

  it("createGroup: the logged-in player is the creator; taken slug is reported", async () => {
    await expect(createGroup(undefined, form(valid))).rejects.toThrow(
      "redirect /g/our-crew",
    );
    expect(db.calls[0]).toMatchObject({
      table: "groups",
      op: "insert",
      values: { slug: "our-crew", created_by: PLAYER },
    });
    db.result.error = { code: "23505", message: "duplicate" };
    expect(await createGroup(undefined, form(valid))).toEqual({
      error: "slugTaken",
    });
  });

  it("updateGroup / changeMember: 403 for a non-admin, nothing written", async () => {
    auth.requireGroupRole.mockRejectedValue(new AuthError(403, "admins"));
    expect(await updateGroup(GROUP, undefined, form(valid))).toEqual({
      error: "forbidden",
    });
    expect(await changeMember(GROUP, PLAYER, "demote")).toEqual({
      error: "forbidden",
    });
    expect(auth.requireGroupRole).toHaveBeenCalledWith(GROUP, "admin");
    expect(db.calls).toEqual([]);
  });

  it("changeMember: rejects tampered arguments before any lookup", async () => {
    expect(await changeMember(GROUP, PLAYER, "delete" as "close")).toEqual({
      error: "forbidden",
    });
    expect(await changeMember("x", PLAYER, "close")).toEqual({
      error: "forbidden",
    });
    expect(auth.requireGroupRole).not.toHaveBeenCalled();
  });

  it("changeMember: maps the last-admin DB check to its own error", async () => {
    expect(await changeMember(GROUP, PLAYER, "promote")).toEqual({
      ok: true,
    });
    expect(db.calls[0]).toMatchObject({
      table: "group_members",
      values: { role: "admin" },
    });
    db.result.error = { code: "23514", message: "must keep one admin" };
    expect(await changeMember(GROUP, PLAYER, "close")).toEqual({
      error: "lastAdmin",
    });
  });
});

describe("toSlug (address field while typing)", () => {
  it.each([
    ["Skarpeciarze", "skarpeciarze"],
    ["Mixy Czwartek", "mixy-czwartek"],
    ["Żubry Łódź", "zubry-lodz"],
    ["-cs2  ekipa!", "cs2-ekipa"],
    ["a-", "a-"],
  ])("%s → %s", (typed, slug) => expect(toSlug(typed)).toBe(slug));
});
