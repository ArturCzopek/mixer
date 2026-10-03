import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ requireEnv: () => "bot-token" }));
const { moveDiscordMember } = await import("./api");
const guild = "123456789012345678";
const user = "123456789012345679";
const channel = "123456789012345670";

afterEach(() => vi.unstubAllGlobals());

describe("Discord voice API", () => {
  it("sends the bot move request and accepts a successful move", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetch);
    expect(await moveDiscordMember(guild, user, channel)).toBe("moved");
    expect(fetch).toHaveBeenCalledWith(
      `https://discord.com/api/v10/guilds/${guild}/members/${user}`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ channel_id: channel }),
        headers: expect.objectContaining({ Authorization: "Bot bot-token" }),
      }),
    );
  });

  it("distinguishes a member outside voice from an API failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ code: 40032 }),
      }),
    );
    expect(await moveDiscordMember(guild, user, channel)).toBe("not_connected");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 403 }),
    );
    await expect(moveDiscordMember(guild, user, channel)).rejects.toThrow(
      "HTTP 403",
    );
  });
});
