import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import type { PopflashMatch, PopflashPlayer } from "@/backtest/data";
import { popflashArchive } from "./popflash";

const fixtures = "lib/balance/__fixtures__/popflash/";
const { matches } = JSON.parse(
  readFileSync(`${fixtures}matches.json`, "utf8"),
) as { matches: PopflashMatch[] };
const { players } = JSON.parse(
  readFileSync(`${fixtures}players.json`, "utf8"),
) as { players: PopflashPlayer[] };

it("keeps all 71 historical maps and separates evenings with lineup changes", () => {
  const { evenings } = popflashArchive(matches, players);
  expect(evenings.flatMap((evening) => evening.maps)).toHaveLength(71);
  expect(new Set(evenings.map((evening) => evening.key)).size).toBe(
    evenings.length,
  );
  expect(evenings.length).toBeGreaterThan(27);
  for (const evening of evenings) {
    expect(evening.teamA).toHaveLength(5);
    expect(evening.teamB).toHaveLength(5);
    for (const map of evening.maps) {
      expect(map.lines).toHaveLength(10);
      expect(map.lines.filter((line) => line.team === "A")).toHaveLength(5);
      expect(map.lines.filter((line) => line.team === "B")).toHaveLength(5);
    }
  }
});

it("preserves the December showcase evening and its real results", () => {
  const { evenings } = popflashArchive(matches, players);
  const december = evenings.find(
    (evening) => evening.key === "popflash:2024-12-16:1",
  );
  expect(
    december?.maps.map((map) => [map.name, map.scoreA, map.scoreB]),
  ).toEqual([
    ["Mirage", 10, 13],
    ["Anubis", 10, 13],
    ["Nuke", 16, 12],
  ]);
  expect(december?.maps[0].lines.every((line) => line.rating > 0)).toBe(true);
});
