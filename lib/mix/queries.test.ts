import { describe, expect, it, vi } from "vitest";
import type { HomeMixRow } from "./queries";

vi.mock("server-only", () => ({}));

const { mapHomeMixes } = await import("./queries");

describe("mapHomeMixes", () => {
  it("counts open participants, marks the viewer, and keeps only their active mixes", () => {
    const rows = [
      {
        id: "open-joined",
        title: "Friday",
        status: "open",
        group: { slug: "crew", name: "The Crew" },
        mix_participants: [{ player_id: "viewer" }, { player_id: "other" }],
      },
      {
        id: "open-free",
        title: "Sunday",
        status: "open",
        group: { slug: "crew", name: "The Crew" },
        mix_participants: [{ player_id: "other" }],
      },
      {
        id: "balancing",
        title: "Monday",
        status: "balancing",
        group: { slug: "other-crew", name: "Other Crew" },
        mix_participants: [{ player_id: "viewer" }],
      },
      {
        id: "voting",
        title: "Tuesday",
        status: "voting",
        group: { slug: "crew", name: "The Crew" },
        mix_participants: [{ player_id: "viewer" }],
      },
      {
        id: "locked",
        title: "Wednesday",
        status: "locked",
        group: { slug: "crew", name: "The Crew" },
        mix_participants: [{ player_id: "viewer" }],
      },
      {
        id: "played",
        title: "Last week",
        status: "played",
        group: { slug: "crew", name: "The Crew" },
        mix_participants: [{ player_id: "viewer" }],
      },
    ] satisfies HomeMixRow[];

    expect(mapHomeMixes(rows, "viewer")).toEqual({
      openSignups: [
        {
          id: "open-joined",
          title: "Friday",
          groupSlug: "crew",
          groupName: "The Crew",
          participantCount: 2,
          viewerJoined: true,
        },
        {
          id: "open-free",
          title: "Sunday",
          groupSlug: "crew",
          groupName: "The Crew",
          participantCount: 1,
          viewerJoined: false,
        },
      ],
      inProgress: [
        {
          id: "balancing",
          title: "Monday",
          groupSlug: "other-crew",
          groupName: "Other Crew",
          status: "balancing",
        },
        {
          id: "voting",
          title: "Tuesday",
          groupSlug: "crew",
          groupName: "The Crew",
          status: "voting",
        },
        {
          id: "locked",
          title: "Wednesday",
          groupSlug: "crew",
          groupName: "The Crew",
          status: "locked",
        },
      ],
    });
  });
});
