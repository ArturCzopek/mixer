import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  groupBySlug: vi.fn(),
  getSession: vi.fn(),
  groupMixes: vi.fn(),
  groupStats: vi.fn(),
}));

vi.mock("next/image", () => ({ default: () => null }));
vi.mock("next/link", () => ({ default: () => null }));
vi.mock("next/navigation", () => ({ notFound: () => null }));
vi.mock("@/components/groups/group-form", () => ({ GroupForm: () => null }));
vi.mock("@/components/groups/discord-settings", () => ({
  DiscordSettings: () => null,
}));
vi.mock("@/components/groups/member-actions", () => ({
  MemberActions: () => null,
}));
vi.mock("@/components/groups/roster-form", () => ({
  AddRosterPlayer: () => null,
  RosterElo: () => null,
}));
vi.mock("@/components/vgui/pending-submit", () => ({
  PendingSubmit: () => null,
}));
vi.mock("@/components/vgui", () => ({
  Badge: () => null,
  ListHead: () => null,
  Well: () => null,
}));
vi.mock("@/components/groups/group-page-view", () => ({
  ActiveMixLink: () => null,
  activeGroupMix: () => null,
  CollapsibleGroupLeaders: () => null,
  DiscordMemberProfile: () => null,
  GroupCreateMix: () => null,
  GroupPageLayout: () => null,
  groupPageLinkClassName: "",
}));
vi.mock("@/lib/auth/server", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/discord/actions", () => ({
  saveDiscordChannels: vi.fn(),
  unlinkDiscordAccount: vi.fn(),
}));
vi.mock("@/lib/discord/queries", () => ({ groupDiscordConfig: vi.fn() }));
vi.mock("@/lib/groups/actions", () => ({ updateGroup: vi.fn() }));
vi.mock("@/lib/groups/queries", () => ({
  groupBySlug: mocks.groupBySlug,
}));
vi.mock("@/lib/groups/stats", () => ({ groupStats: mocks.groupStats }));
vi.mock("@/lib/mix/queries", () => ({ groupMixes: mocks.groupMixes }));
vi.mock("@/lib/i18n/server", async () => {
  const { DICTS } = await import("@/lib/i18n/dict");
  return { getDict: async () => DICTS.en };
});

import GroupPage from "@/app/g/[slug]/page";

const viewerSteamId = "76561197993187687";
const targetSteamId = "76561198012352866";
const group = {
  id: "group",
  slug: "crew",
  name: "Crew",
  faceitClubUrl: null,
  discordGuildId: null,
  members: [viewerSteamId, targetSteamId].map((steamId) => ({
    playerId: steamId,
    steamId,
    displayName: steamId,
    avatarUrl: null,
    faceitNickname: null,
    discordUserId: null,
    manualElo: null,
    role: "member" as const,
    joinedAt: "2026-10-01T00:00:00Z",
  })),
};

function elements(node: ReactNode): ReactElement<{ href?: string }>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement(node)) return [];
  const element = node as ReactElement<{
    children?: ReactNode;
    href?: string;
  }>;
  return [element, ...elements(element.props.children)];
}

async function rosterCompareHrefs() {
  const page = (await GroupPage({
    params: Promise.resolve({ slug: "crew" }),
    searchParams: Promise.resolve({}),
  })) as ReactElement<{ members: ReactNode }>;
  return elements(page.props.members)
    .map((element) => element.props.href)
    .filter((href): href is string => !!href?.includes("/compare?"));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.groupBySlug.mockResolvedValue(group);
  mocks.getSession.mockResolvedValue({
    playerId: viewerSteamId,
    steamId: viewerSteamId,
    displayName: viewerSteamId,
    avatarUrl: null,
    isSiteAdmin: false,
  });
  mocks.groupMixes.mockResolvedValue([]);
  mocks.groupStats.mockResolvedValue({
    mixes: 0,
    maps: 0,
    players: 0,
    sources: { popflash: 0, faceit: 0, manual: 0, demo: 0 },
    mixResults: {},
    leaderboard: [],
  });
});

it("links each other roster member to compare with the active viewer", async () => {
  expect(await rosterCompareHrefs()).toEqual([
    `/g/crew/compare?a=${viewerSteamId}&b=${targetSteamId}&source=mix`,
  ]);
});

it("links the group result summary to full group statistics", async () => {
  const page = (await GroupPage({
    params: Promise.resolve({ slug: "crew" }),
    searchParams: Promise.resolve({}),
  })) as ReactElement<{ main: ReactNode }>;
  expect(
    elements(page.props.main).some(
      (element) => element.props.href === "/g/crew/stats",
    ),
  ).toBe(true);
});

it("labels FACEIT roster links without repeating the external nickname", async () => {
  mocks.groupBySlug.mockResolvedValue({
    ...group,
    members: group.members.map((member) => ({
      ...member,
      faceitNickname: "external-name",
    })),
  });
  const page = (await GroupPage({
    params: Promise.resolve({ slug: "crew" }),
    searchParams: Promise.resolve({}),
  })) as ReactElement<{ members: ReactNode }>;
  const links = elements(page.props.members).filter((element) =>
    element.props.href?.includes("faceit.com/en/players/"),
  );
  expect(links).toHaveLength(2);
  for (const link of links) {
    expect(link.props.href).toBe(
      "https://www.faceit.com/en/players/external-name",
    );
    expect((link.props as { children: ReactNode }).children).toBe("FACEIT");
  }
});

it.each([
  ["visitors", null],
  [
    "players without a linked Steam ID",
    { playerId: viewerSteamId, steamId: "" },
  ],
  [
    "players outside the active roster",
    { playerId: "outsider", steamId: viewerSteamId },
  ],
])("hides roster comparison links for %s", async (_case, session) => {
  mocks.getSession.mockResolvedValue(session);
  expect(await rosterCompareHrefs()).toEqual([]);
});
