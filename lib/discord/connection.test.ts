import { describe, expect, it } from "vitest";
import {
  BOT_PERMISSIONS,
  canManageDiscordGuild,
  discordAuthorizeUrl,
  parseDiscordSettings,
  readGuildState,
  type DiscordChannel,
} from "./connection";

const GROUP = "6f1b3c2a-8d4e-4f5a-9b6c-7d8e9f0a1b2c";
const PLAYER = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const NONCE = "01a0f127-b17e-74b2-9453-49e525e62598";
const guild = "123456789012345678";
const channels: DiscordChannel[] = [
  { id: "123456789012345671", name: "Lobby", type: 2, position: 0 },
  { id: "123456789012345672", name: "A", type: 2, position: 1 },
  { id: "123456789012345673", name: "B", type: 2, position: 2 },
  { id: "123456789012345674", name: "News", type: 0, position: 3 },
];

function form(over: Record<string, string> = {}) {
  const value = new FormData();
  for (const [key, item] of Object.entries({
    lobby: channels[0].id,
    teamA: channels[1].id,
    teamB: channels[2].id,
    notification: channels[3].id,
    ...over,
  }))
    value.set(key, item);
  return value;
}

describe("Discord server connection", () => {
  it("requests only the needed bot permissions and a code-bound guild scope", () => {
    const url = new URL(
      discordAuthorizeUrl(
        "123456789012345670",
        "https://mixer.test/callback",
        NONCE,
      ),
    );
    expect(url.origin).toBe("https://discord.com");
    expect(url.searchParams.get("scope")).toBe("bot guilds");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("permissions")).toBe(BOT_PERMISSIONS);
    expect(Number(BOT_PERMISSIONS)).toBe(16780288);
    expect(url.searchParams.get("state")).toBe(NONCE);
  });

  it("accepts the callback only with its matching state cookie", () => {
    const cookie = JSON.stringify({
      nonce: NONCE,
      groupId: GROUP,
      playerId: PLAYER,
    });
    expect(readGuildState(cookie, NONCE)).toEqual({
      nonce: NONCE,
      groupId: GROUP,
      playerId: PLAYER,
    });
    expect(readGuildState(cookie, "different")).toBeNull();
    expect(readGuildState("invalid", NONCE)).toBeNull();
  });

  it("requires server ownership or Manage Server for the selected guild", () => {
    expect(
      canManageDiscordGuild(
        [{ id: guild, owner: false, permissions: "32" }],
        guild,
      ),
    ).toBe(true);
    expect(
      canManageDiscordGuild(
        [{ id: guild, owner: true, permissions: "0" }],
        guild,
      ),
    ).toBe(true);
    expect(
      canManageDiscordGuild(
        [{ id: guild, owner: false, permissions: "8" }],
        guild,
      ),
    ).toBe(true);
    expect(
      canManageDiscordGuild(
        [{ id: guild, owner: false, permissions: "0" }],
        guild,
      ),
    ).toBe(false);
    expect(
      canManageDiscordGuild(
        [{ id: "999", owner: true, permissions: "32" }],
        guild,
      ),
    ).toBe(false);
  });

  it("accepts only three different live voice channels and a live text channel", () => {
    expect(parseDiscordSettings(form(), channels)).toEqual({
      lobby_channel_id: channels[0].id,
      team_a_channel_id: channels[1].id,
      team_b_channel_id: channels[2].id,
      notification_channel_id: channels[3].id,
    });
    expect(
      parseDiscordSettings(form({ teamB: channels[0].id }), channels),
    ).toBeNull();
    expect(
      parseDiscordSettings(form({ teamB: channels[3].id }), channels),
    ).toBeNull();
    expect(
      parseDiscordSettings(form({ notification: "999" }), channels),
    ).toBeNull();
  });
});
