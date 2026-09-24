import { afterEach, describe, expect, it, vi } from "vitest";

import { requireEnv } from "./env";

describe("requireEnv", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns the value when set", () => {
    vi.stubEnv("MIXER_TEST_VAR", "abc");
    expect(requireEnv("MIXER_TEST_VAR")).toBe("abc");
  });

  it("throws with the variable name when missing or empty", () => {
    vi.stubEnv("MIXER_TEST_VAR", "");
    expect(() => requireEnv("MIXER_TEST_VAR")).toThrow("MIXER_TEST_VAR");
  });
});
