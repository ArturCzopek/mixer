import { describe, expect, it } from "vitest";
import { myProfileHref } from "./href";

const groups = [{ slug: "alpha" }, { slug: "beta" }];
const steamId = "76561197960551471";

describe("myProfileHref", () => {
  it("uses the group from the current route", () => {
    expect(myProfileHref("/g/beta/m/mix-1", groups, steamId)).toBe(
      `/g/beta/p/${steamId}`,
    );
  });

  it("uses the first group in switcher order outside a group", () => {
    expect(myProfileHref("/", groups, steamId)).toBe(`/g/alpha/p/${steamId}`);
  });

  it("has no destination when the player has no groups", () => {
    expect(myProfileHref("/g", [], steamId)).toBeNull();
  });
});
