import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  activeGroupMix,
  CollapsibleGroupLeaders,
  DiscordMemberProfile,
  GroupCreateMix,
  GroupPageLayout,
} from "./group-page-view";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

vi.mock("@/components/mix/lobby-view", () => ({
  CreateMixForm: () => createElement("form", null, "Create mix form"),
}));

describe("group page view", () => {
  it("hides Create Mix while any active mix exists", () => {
    for (const status of ["open", "balancing", "voting", "locked"] as const) {
      const active = activeGroupMix([{ status }]);
      const html = renderToStaticMarkup(
        createElement(GroupCreateMix, {
          groupId: "group-1",
          canManage: true,
          hasActiveMix: active !== null,
          title: "New Mix",
        }),
      );
      expect(active?.status).toBe(status);
      expect(html).toBe("");
    }
  });

  it("shows Create Mix when no mix is active and the viewer can manage the group", () => {
    const html = renderToStaticMarkup(
      createElement(GroupCreateMix, {
        groupId: "group-1",
        canManage: true,
        hasActiveMix: false,
        title: "New Mix",
      }),
    );
    expect(html).toContain("New Mix");
    expect(html).toContain("Create mix form");
  });

  it("keeps rating leaders collapsed until the native summary is opened", () => {
    const html = renderToStaticMarkup(
      createElement(
        CollapsibleGroupLeaders,
        {
          title: "Mixer Rating leaders",
        },
        createElement("p", null, "Player One"),
      ),
    );
    expect(html).toContain("<details");
    expect(html).toContain("<summary");
    expect(html).not.toContain("<details open");
  });

  it("links a stored Discord ID and exposes linked and unlinked lamp labels", () => {
    const linked = renderToStaticMarkup(
      createElement(DiscordMemberProfile, {
        discordUserId: "123456789012345678",
        linkedText: "Discord linked",
        unlinkedText: "Discord not linked",
        profileText: "Discord profile",
      }),
    );
    const unlinked = renderToStaticMarkup(
      createElement(DiscordMemberProfile, {
        discordUserId: null,
        linkedText: "Discord linked",
        unlinkedText: "Discord not linked",
        profileText: "Discord profile",
      }),
    );
    expect(linked).toContain(
      'href="https://discord.com/users/123456789012345678"',
    );
    expect(linked).toContain('aria-label="Discord linked"');
    expect(linked).toContain("Discord profile");
    expect(unlinked).toContain('aria-label="Discord not linked"');
    expect(unlinked).not.toContain("https://discord.com/users/");
  });

  it("uses one shared frame and responsive internal columns", () => {
    const html = renderToStaticMarkup(
      createElement(GroupPageLayout, {
        title: "Crew",
        main: createElement("p", null, "Mixes"),
        members: createElement("p", null, "Members"),
      }),
    );
    expect(html.match(/<section /g)).toHaveLength(1);
    expect(html).toContain("grid-cols-1");
    expect(html).toContain("lg:grid-cols-[minmax(0,1fr)_320px]");
    expect(html).toContain("border-t");
    expect(html).toContain("lg:border-l");
    expect(html).toContain("Mixes");
    expect(html).toContain("Members");
  });
});
