#!/usr/bin/env node
// Seeds a group from a roster file (M1-G): players by SteamID64, the group, memberships. Idempotent:
// existing players, the group (matched by slug) and memberships are kept as they are, so rerunning it
// (e.g. on the prod project after P0-6) never reopens a closed membership or changes a role.
// The first admin in the file creates the group, so the DB makes them admin (D36).
//
//   node --env-file=.env.local scripts/seed-group.mjs --slug our-crew \
//     [--name "Our Crew" --faceit-club https://www.faceit.com/en/club/…] [--roster db/seed/roster.json]
// --name only when the group does not exist yet; for a group made in the UI it only adds members.
// Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY.

import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

const { values: args } = parseArgs({
  options: {
    name: { type: "string" },
    slug: { type: "string" },
    "faceit-club": { type: "string" },
    roster: { type: "string", default: "db/seed/roster.json" },
  },
});
if (!args.slug)
  throw new Error("Usage: --slug <slug> [--name <name> --faceit-club <url>]");

const env = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};
const db = createClient(
  env("NEXT_PUBLIC_SUPABASE_URL"),
  env("SUPABASE_SECRET_KEY"),
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);
const check = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
};

const roster = JSON.parse(readFileSync(args.roster, "utf8"));
const admins = new Set(roster.admins);
const creatorSteamId = roster.admins[0];
if (!creatorSteamId) throw new Error("The roster needs at least one admin");

check(
  await db.from("players").upsert(
    roster.players.map((steam_id) => ({ steam_id })),
    { onConflict: "steam_id", ignoreDuplicates: true },
  ),
  "players",
);
const players = check(
  await db
    .from("players")
    .select("id, steam_id")
    .in("steam_id", roster.players),
  "players",
);
const idOf = new Map(players.map((p) => [p.steam_id, p.id]));
const creator = idOf.get(creatorSteamId);

let group = check(
  await db.from("groups").select("id").eq("slug", args.slug).maybeSingle(),
  "group",
);
if (!group) {
  if (!args.name)
    throw new Error(`No group ${args.slug} yet: pass --name to create it`);
  const club = args["faceit-club"] ?? null;
  group = check(
    await db
      .from("groups")
      .insert({
        name: args.name,
        slug: args.slug,
        faceit_club_url: club,
        faceit_club_id:
          club?.match(/\/club\/([0-9a-f-]{36})/i)?.[1].toLowerCase() ?? null,
        created_by: creator,
      })
      .select("id")
      .single(),
    "group",
  );
  console.log(`created group ${args.slug}`);
} else console.log(`group ${args.slug} exists, keeping it`);

check(
  await db.from("group_members").upsert(
    roster.players.map((steamId) => ({
      group_id: group.id,
      player_id: idOf.get(steamId),
      role: admins.has(steamId) ? "admin" : "member",
      added_by: creator,
    })),
    { onConflict: "group_id,player_id", ignoreDuplicates: true },
  ),
  "members",
);
const members = check(
  await db
    .from("group_members")
    .select("role")
    .eq("group_id", group.id)
    .is("left_at", null),
  "members",
);
console.log(
  `${members.length} active members (${members.filter((m) => m.role === "admin").length} admin)`,
);
