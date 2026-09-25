// End-to-end check of the balancing explanation (M1-4b) on recorded FACEIT data: the 10 players of
// the 2026-09-20 mix, real ELO and match history, through the same path the server will use.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_BALANCE_CONFIG as CFG,
  generateVariants,
  skillScore,
  type PlayerInput,
} from "@/lib/balance";
import mix from "@/lib/balance/__fixtures__/mix-2026-09-20.json";
import { parseMatchStatsPage, toFormSamples } from "./faceit";

const FIXTURES = join(__dirname, "__fixtures__/faceit");
const read = (path: string): unknown =>
  JSON.parse(readFileSync(join(FIXTURES, path), "utf8"));

/** When the fixtures were recorded (spike-report.json `generatedAt`). */
const NOW = new Date("2026-09-25T06:56:59Z");

function input(steamId: string): PlayerInput {
  const player = read(`players/${steamId}.json`) as {
    games: { cs2: { faceit_elo: number } };
  };
  const stats = parseMatchStatsPage(read(`games-stats/${steamId}.json`));
  return {
    steamId,
    faceitElo: player.games.cs2.faceit_elo,
    faceit: { matches: toFormSamples(stats) },
    activity: { playedAt: stats.map((s) => s.finishedAt) },
  };
}

const ids = [...mix.teamA.steamIds, ...mix.teamB.steamIds];
const skills = ids.map((id) =>
  skillScore(input(id), { now: NOW, groupRating: null }, CFG),
);

describe("balancing explanation on recorded FACEIT data", () => {
  it("every player's contributions add up to S", () => {
    for (const s of skills) {
      const c = s.contributions;
      expect(c.E + c.F + c.M + c.A).toBe(s.S);
      expect(c.E).toBe(s.E);
      expect(s.mix.status).toBe("no-maps");
    }
  });

  it("form and activity use the 30-day window of the recorded history", () => {
    for (const s of skills) {
      expect(Math.abs(s.F)).toBeLessThanOrEqual(CFG.form.max);
      expect(s.activity.status).toBe("ok");
      if (s.form.matches > 0) expect(s.activity.sessions).toBeGreaterThan(0);
      if (s.form.status === "ok") {
        expect(s.form.ratio).toBeCloseTo(
          s.form.windowRating! / s.form.baselineRating!,
        );
      }
    }
  });

  it("variant costs add up to imbalance + penalties", () => {
    const { variants } = generateVariants({ players: skills, config: CFG });
    expect(variants).toHaveLength(3);
    for (const v of variants) {
      expect(v.cost).toBe(
        v.imbalance + v.penalties.reduce((sum, p) => sum + p.pp, 0),
      );
      expect(v.teamA.length + v.teamB.length).toBe(10);
    }
  });
});
