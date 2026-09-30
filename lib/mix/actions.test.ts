import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "@/lib/auth/roles";

const auth = vi.hoisted(() => ({
  requireSession: vi.fn(),
  requireGroupRole: vi.fn(),
}));
const variantService = vi.hoisted(() => ({
  initialVariantPlan: vi.fn(),
  rerollVariantPlan: vi.fn(),
}));
const faceitService = vi.hoisted(() => ({
  faceitImportPlan: vi.fn(),
  findMixFaceitCandidates: vi.fn(),
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
  rpcCalls: [] as { name: string; args: Record<string, unknown> }[],
  rpcResponse: { data: null, error: null } as {
    data: unknown;
    error: { code: string; message: string } | null;
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => auth);
vi.mock("@/lib/mix/variant-service", () => ({
  ...variantService,
  StaleVariantSetError: class extends Error {},
}));
vi.mock("@/lib/mix/faceit-service", () => faceitService);
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect ${url}`);
  },
}));
vi.mock("@/lib/db/admin", () => ({
  adminDb: () => ({
    rpc: (name: string, args: Record<string, unknown>) => {
      db.rpcCalls.push({ name, args });
      return Promise.resolve(db.rpcResponse);
    },
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
  approveMixVariants,
  castMixVote,
  castProxyMixVote,
  closeMixVoting,
  generateMixVariants,
  reopenMixVoting,
  rerollMixVariants,
  swapMixParticipant,
  startMixMatch,
  importFaceitMatches,
} = await import("./actions");

const GROUP = "6f1b3c2a-8d4e-4f5a-9b6c-7d8e9f0a1b2c";
const PLAYER = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const OTHER_PLAYER = "7c6b5a4d-3e2f-4a1b-8c9d-0e1f2a3b4c5d";
const JOINING_PLAYER = "2c6b5a4d-3e2f-4a1b-8c9d-0e1f2a3b4c5d";
const MIX = "4d0ea03c-bf8a-4d4b-a37b-21d3d40c5d55";
const VARIANT = "0c784f5a-2496-4fa4-a4d7-37c27bf302f7";
const validTitle = (value: string) => {
  const form = new FormData();
  form.set("title", value);
  return form;
};
const noPrev = undefined;

beforeEach(() => {
  db.writes.length = 0;
  db.rpcCalls.length = 0;
  db.rpcResponse = { data: null, error: null };
  for (const key of Object.keys(db.responses)) delete db.responses[key];
  auth.requireSession.mockReset();
  auth.requireGroupRole.mockReset();
  auth.requireSession.mockResolvedValue({ playerId: PLAYER });
  auth.requireGroupRole.mockResolvedValue({ playerId: PLAYER });
  variantService.initialVariantPlan.mockReset();
  variantService.rerollVariantPlan.mockReset();
  variantService.initialVariantPlan.mockResolvedValue({
    balanceConfig: { weights: { elo: 1 } },
    snapshots: [],
    variants: [],
  });
  variantService.rerollVariantPlan.mockResolvedValue({ variants: [] });
  faceitService.faceitImportPlan.mockReset();
  faceitService.faceitImportPlan.mockResolvedValue([]);
});

const everyAction = {
  createMix: () => createMix(GROUP, noPrev, validTitle("Friday mix")),
  joinMix: () => joinMix(MIX),
  leaveMix: () => leaveMix(MIX),
  addParticipant: () => addParticipant(MIX, OTHER_PLAYER),
  removeParticipant: () => removeParticipant(MIX, OTHER_PLAYER),
  setMixStatus: () => setMixStatus(MIX, "open", "balancing"),
  generateMixVariants: () => generateMixVariants(MIX),
  rerollMixVariants: () => rerollMixVariants(MIX, 1),
  approveMixVariants: () => approveMixVariants(MIX, 1),
  swapMixParticipant: () =>
    swapMixParticipant(MIX, OTHER_PLAYER, JOINING_PLAYER),
  castMixVote: () => castMixVote(MIX, VARIANT),
  castProxyMixVote: () => castProxyMixVote(MIX, OTHER_PLAYER, VARIANT),
  closeMixVoting: () => closeMixVoting(MIX),
  reopenMixVoting: () => reopenMixVoting(MIX),
  startMixMatch: () => startMixMatch(MIX),
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
        expect(db.rpcCalls).toEqual([]);
        expect(variantService.initialVariantPlan).not.toHaveBeenCalled();
        expect(variantService.rerollVariantPlan).not.toHaveBeenCalled();
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
    expect(await generateMixVariants("bad")).toEqual({ error: "forbidden" });
    expect(await rerollMixVariants(MIX, 0)).toEqual({ error: "forbidden" });
    expect(await approveMixVariants(MIX, 0)).toEqual({ error: "forbidden" });
    expect(await swapMixParticipant(MIX, PLAYER, PLAYER)).toEqual({
      error: "forbidden",
    });
    expect(await castMixVote(MIX, "bad")).toEqual({ error: "forbidden" });
    expect(await castProxyMixVote(MIX, "bad", VARIANT)).toEqual({
      error: "forbidden",
    });
    expect(await closeMixVoting("bad")).toEqual({ error: "forbidden" });
    expect(await reopenMixVoting("bad")).toEqual({ error: "forbidden" });
    expect(await startMixMatch("bad")).toEqual({ error: "forbidden" });
    expect(db.writes).toEqual([]);
    expect(db.rpcCalls).toEqual([]);
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

  it("calls generation RPCs with the expected generation after admin authorization", async () => {
    expect(await generateMixVariants(MIX)).toEqual({ ok: true });
    expect(variantService.initialVariantPlan).toHaveBeenCalledWith(MIX);
    expect(db.rpcCalls[0]).toMatchObject({
      name: "create_mix_variant_set",
      args: { p_mix_id: MIX, p_variants: [] },
    });

    db.rpcCalls.length = 0;
    expect(await rerollMixVariants(MIX, 3)).toEqual({ ok: true });
    expect(variantService.rerollVariantPlan).toHaveBeenCalledWith(MIX, 3);
    expect(db.rpcCalls[0]).toMatchObject({
      name: "reroll_mix_variant_set",
      args: { p_mix_id: MIX, p_expected_generation: 3, p_variants: [] },
    });

    db.rpcCalls.length = 0;
    expect(await approveMixVariants(MIX, 3)).toEqual({ ok: true });
    expect(db.rpcCalls[0]).toEqual({
      name: "approve_mix_variant_set",
      args: { p_mix_id: MIX, p_expected_generation: 3 },
    });
  });

  it("uses the session admin and delegates 1:1 swap validation to the database", async () => {
    expect(await swapMixParticipant(MIX, OTHER_PLAYER, JOINING_PLAYER)).toEqual(
      {
        ok: true,
      },
    );
    expect(db.rpcCalls[0]).toEqual({
      name: "swap_mix_participant",
      args: {
        p_mix_id: MIX,
        p_leaving_player_id: OTHER_PLAYER,
        p_joining_player_id: JOINING_PLAYER,
        p_admin_id: PLAYER,
      },
    });

    db.rpcResponse = {
      data: null,
      error: { code: "23503", message: "not active" },
    };
    expect(await swapMixParticipant(MIX, OTHER_PLAYER, JOINING_PLAYER)).toEqual(
      {
        error: "notMember",
      },
    );
  });

  it("enriches played manual maps through the dedicated RPC", async () => {
    const room = "1-00000000-0000-4000-8000-000000000001";
    db.responses["mixes:select"] = {
      data: {
        group_id: GROUP,
        status: "played",
        locked_at: "2026-09-29T20:00:00Z",
      },
      error: null,
    };
    db.responses["matches:select"] = {
      data: [{ faceit_match_id: null, source: "manual", stats_origin: null }],
      error: null,
    };
    expect(await importFaceitMatches(MIX, [room])).toEqual({ ok: true });
    expect(faceitService.faceitImportPlan).toHaveBeenCalledWith(
      MIX,
      [room],
      [],
    );
    expect(db.rpcCalls[0]).toMatchObject({
      name: "enrich_manual_mix_results",
      args: { p_mix_id: MIX, p_actor_id: PLAYER },
    });

    db.rpcCalls.length = 0;
    db.responses["matches:select"] = {
      data: [
        { faceit_match_id: room, source: "manual", stats_origin: "faceit" },
      ],
      error: null,
    };
    expect(await importFaceitMatches(MIX, [room])).toEqual({ ok: true });
    expect(db.rpcCalls).toEqual([]);
  });

  it("uses the session identity for votes and the admin for proxy votes", async () => {
    expect(await castMixVote(MIX, VARIANT)).toEqual({ ok: true });
    expect(db.rpcCalls[0]).toEqual({
      name: "cast_mix_vote",
      args: {
        p_mix_id: MIX,
        p_voter_id: PLAYER,
        p_variant_id: VARIANT,
        p_cast_by: PLAYER,
      },
    });
    expect(auth.requireGroupRole).toHaveBeenCalledWith(GROUP, "member");
    expect(await castProxyMixVote(MIX, OTHER_PLAYER, VARIANT)).toEqual({
      ok: true,
    });
    expect(db.rpcCalls[1]).toEqual({
      name: "cast_mix_vote",
      args: {
        p_mix_id: MIX,
        p_voter_id: OTHER_PLAYER,
        p_variant_id: VARIANT,
        p_cast_by: PLAYER,
      },
    });
    expect(auth.requireGroupRole).toHaveBeenCalledWith(GROUP, "admin");

    db.rpcResponse = {
      data: null,
      error: { code: "23503", message: "not a participant" },
    };
    expect(await castMixVote(MIX, VARIANT)).toEqual({
      error: "notParticipant",
    });
  });

  it("uses admin RPCs for closing, reopening, and starting a match", async () => {
    expect(await closeMixVoting(MIX)).toEqual({ ok: true });
    expect(await reopenMixVoting(MIX)).toEqual({ ok: true });
    expect(await startMixMatch(MIX)).toEqual({ ok: true });
    expect(db.rpcCalls).toEqual([
      {
        name: "close_mix_votes",
        args: { p_mix_id: MIX, p_require_due: false },
      },
      { name: "reopen_mix_votes", args: { p_mix_id: MIX } },
      { name: "start_mix_match", args: { p_mix_id: MIX } },
    ]);
  });
});
