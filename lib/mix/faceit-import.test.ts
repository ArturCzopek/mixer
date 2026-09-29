import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import type { FaceitMapStats, FaceitRoomDetail } from "@/lib/external/faceit";
import type { FaceitCandidate } from "./faceit-candidates";
import { faceitImportMap } from "./faceit-import";

const id = "1-1cb5b18b-6856-42a9-bf3c-561c0737b52f";
const fixture = (suffix: string) =>
  JSON.parse(
    readFileSync(
      join(
        __dirname,
        "../external/__fixtures__/faceit/matches",
        `${id}${suffix}.json`,
      ),
      "utf8",
    ),
  );

it("maps recorded FACEIT factions, scores and player ratings to the locked A/B lineup", () => {
  const room = fixture("") as FaceitRoomDetail;
  const response = fixture(".stats") as FaceitMapStats;
  const candidate: FaceitCandidate = {
    id,
    startedAt: new Date(room.started_at * 1000).toISOString(),
    status: room.status,
    competitionId: room.competition_id ?? null,
    bestOf: room.best_of,
    faction1: [],
    faction2: [],
    map: null,
    score1: 5,
    score2: 13,
    roomUrl: "",
    coverage: 10,
    teamAIsFaction1: false,
    lineupMismatch: [],
  };
  const known = [room.teams.faction1.roster[0], room.teams.faction2.roster[0]];
  const playerIds = new Map(
    known.map((player) => [player.game_player_id!, player.player_id]),
  );
  const imported = faceitImportMap(candidate, room, response, playerIds);
  expect(imported).toMatchObject({
    faceitId: id,
    mapName: "de_nuke",
    scoreA: 13,
    scoreB: 5,
  });
  expect(imported.stats).toHaveLength(2);
  expect(
    imported.stats.find((s) => s.playerId === known[0].player_id),
  ).toMatchObject({ team: "B", kills: 9, deaths: 16 });
  expect(
    imported.stats.find((s) => s.playerId === known[1].player_id)?.rating,
  ).toBeGreaterThan(0);
});
