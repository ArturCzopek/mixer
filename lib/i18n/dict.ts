// UI strings in English (default) and Polish (owner, 2026-09-26). Every user-facing string goes
// through here; `en` defines the shape, `pl` must match it. "Data Provided by Leetify" stays in
// English on purpose (Leetify's required attribution).

export type Lang = "en" | "pl";
export const LANG_COOKIE = "mixer.lang";

export const parseLang = (value: string | undefined | null): Lang =>
  value === "pl" ? "pl" : "en";

const plural = (n: number, one: string, few: string, many: string) => {
  if (n === 1) return one;
  const d = n % 10;
  const t = n % 100;
  return d >= 2 && d <= 4 && (t < 12 || t > 14) ? few : many;
};

const en = {
  prefs: {
    backdrop: "1.6 backdrop",
    backdropShort: "1.6",
    language: "Language",
    english: "English",
    polish: "Polski",
  },
  home: {
    tagline:
      "CS2 10-man mixes for our crew: balanced 5v5 lineups, live voting and stats across mixes.",
    loginFailed: "Steam login did not go through. Try again.",
    notConfigured: (missing: string) =>
      `Login is not configured on this deployment. Missing: ${missing}.`,
    signIn: "Sign In Through Steam",
    signInShort: "Sign In",
    signOut: "Sign Out",
    myProfile: "My Profile",
    siteAdmin: "site admin",
    showcase: "See a Real Mix: 16 Dec 2024",
    source: "source",
    openSignups: "Open sign-ups",
    noOpenSignups: "No open sign-ups right now.",
    inProgress: "My mixes in progress",
    noInProgress: "No mixes in progress.",
    myGroups: "My groups",
    createGroup: "Create group",
    youAreIn: "You are in",
    mixStatus: {
      balancing: "Balancing",
      voting: "Voting",
      locked: "Lineup locked",
    },
  },
  switcher: {
    label: "Showcase:",
    lobby: "1 lobby",
    voting: "2 voting",
    locked: "3 lineup",
    played: "4 result",
  },
  mix: {
    title: (n: number, when: string) => `Mix #${n} · ${when}`,
    playersOf10: (n: number) => `${n} of 10 players`,
  },
  status: {
    lobby: (left: number) =>
      `Open · ${left} slots left · balancing starts at 10/10`,
    balancing: "Balancing · admin review",
    voting: (voted: number) => `Voting · ${voted} of 10 voted · waiting for`,
    votingReady: "Voting · the approved lineups are ready",
    votingAll: "Voting · all 10 voted · closes 60 minutes after the last vote",
    lockedBefore: "Voting closed ·",
    lockedAfter: "won",
    played: (maps: number, source: string) =>
      `Played · ${maps} maps · result from ${source}`,
  },
  lists: {
    playerJoinOrder: "Player · join order",
    player: "Player",
    tapForDetails: " · tap for details",
    skill: "Balance score S",
    showPlayerDetails: (name: string) => `Show ${name}'s balance details`,
    freeSlot: "free slot",
    joined: (t: string) => `Joined ${t}`,
    teamA: "Team A",
    teamB: "Team B",
    team: (t: string) => `Team ${t}`,
  },
  odds: { winChance: "Win chance A : B", avgS: "Avg S", vs: "vs" },
  variants: {
    aria: "Variants",
    variant: (n: number) => `Variant ${n}`,
    mostEven: "Most even",
    fresh: "Fresh split",
    leading: "Leading",
  },
  leetify: {
    title: (live: boolean) =>
      `Leetify · FACEIT, last 30 days${live ? " (live)" : ""}`,
    previewTitle: (name: string) => `Leetify · ${name} · FACEIT, last 30 days`,
    notAnswering: (name: string) =>
      `Leetify is not answering for ${name} right now.`,
    privateProfile: "This Leetify profile is private.",
    noRecentFaceit: "No FACEIT matches in the last 30 days.",
    none: (span: string) => `No FACEIT matches ${span}.`,
    matches: (span: string) => `FACEIT matches ${span}`,
    wl: (w: number, l: number, d = 0) => `${w} W ${l} L${d ? ` ${d} D` : ""}`,
    win: "W",
    loss: "L",
    draw: "D",
    kad: "K/A/D",
    liveNotStored: "live from Leetify, not stored",
    resultsAria: "Results, newest first",
    detailsTitle: "More match stats",
    details: {
      total_damage: "Total damage",
      adr: "ADR",
      rounds_count: "Rounds played",
      rounds_survived: "Rounds survived",
      total_hs_kills: "Headshot kills",
      mvps: "MVPs",
      multi2k: "2K rounds",
      multi3k: "3K rounds",
      multi4k: "4K rounds",
      multi5k: "Aces",
      flashbang_thrown: "Flashbangs thrown",
      flashbang_hit_foe: "Enemies flashed",
      flashbang_hit_friend: "Teammates flashed",
      flash_assist: "Flash assists",
      trade_kills_succeed: "Trade kills",
      traded_deaths_succeed: "Traded deaths",
      shots_fired: "Shots fired",
      shots_hit_foe: "Hits on enemies",
      shots_hit_friend: "Hits on teammates",
    },
    date: "Date",
    map: "Map",
    score: "Score",
    rating: "Leetify Rating",
    result: "Result",
    rawRatingByMatch: "Raw Leetify Rating by match",
    lastMatches: "Last 20 matches",
    averageRating: (source: string, count: number) =>
      `Average Leetify Rating · ${count} ${source} matches`,
    ratingPoint: (date: string, map: string, score: string, rating: string) =>
      `${date} · ${map} · ${score} · Leetify Rating ${rating}`,
    placeholder: (name: string) =>
      `No FACEIT in 30 days. ${name} is either touching grass or secretly grinding Premier.`,
    more: (n: number) => `and ${n} more on Leetify`,
  },
  explain: {
    title: "How was this calculated?",
    eName: "E contribution",
    eFaceitAtLineup: (elo: string, level: number) =>
      `${elo} ELO at lineup · ${level ? `level ${level} · ` : ""}FACEIT data used for this mix`,
    eManualAtLineup: (elo: string) =>
      `${elo} ELO at lineup · group admin's manual value because FACEIT ELO was unavailable`,
    eMixMeanAtLineup: (elo: string) =>
      `${elo} ELO at lineup · mean of the other players' sourced ELO in this mix`,
    eNeutralAtLineup: (elo: string) => `${elo} ELO at lineup · neutral default`,
    eSwapAtLineup: (elo: string, steamId: string) =>
      `${elo} ELO at lineup · approved slot inherited from ${steamId}`,
    fName: (days: number) => `FACEIT form, last ${days} days`,
    mName: (weight: number) =>
      `Mix form${weight === 1 ? "" : ` · weight ${weight}`}`,
    mNote: (p: {
      maps: number;
      player: string;
      group: string;
      shrunk: string;
      raw: string;
      mult: string;
      up: boolean;
      elo: number;
      cap: string;
    }) =>
      `${p.maps} mix maps · Mixer Rating ${p.player} vs group ${p.group} → ${p.shrunk} after shrinkage · raw ${p.raw} × ${p.mult} for ${p.up ? "good form" : "a slump"} at ${p.elo} ELO${p.cap}`,
    mNone: "No mix maps with stats yet",
    aName: (days: number) => `Activity, last ${days} days`,
    capped: (max: number) => ` (capped at ±${max})`,
    fNoRecent: (span: string) =>
      `No FACEIT matches ${span} (30 days before the mix): no form, ELO only.`,
    fThin: (n: number, base: number, need: number) =>
      `${n} matches, but only ${base} older ones for a baseline (needs ${need}): no form.`,
    fInvalid: "No usable baseline rating.",
    fUnavailable: "FACEIT form unavailable; F = 0 for this mix.",
    fParts: (p: {
      n: number;
      span: string;
      window: string;
      base: string;
      baseN: number;
      ratio: string;
      shrunk: string;
      k: number;
      beta: number;
      delta: string;
      raw: string;
      rawCap: string;
      mult: string;
      up: boolean;
      elo: number;
      cap: string;
    }) =>
      [
        `${p.n} matches ${p.span} · rating ${p.window} vs ${p.base} over ${p.baseN} older ones`,
        `ratio ${p.ratio} → ${p.shrunk} after shrinkage (k = ${p.k})`,
        `raw ${p.beta} × ${p.delta} = ${p.raw}${p.rawCap}`,
        `× ${p.mult} for ${p.up ? "good form" : "a slump"} at ${p.elo} ELO${p.cap}`,
      ].join(" · "),
    aNoData: "No FACEIT history: counts as 0, never a penalty.",
    aNote: (p: {
      sessions: number;
      span: string;
      last: string | null;
      neutral: number | undefined;
      worst: string;
      topSessions: number;
      top: string;
    }) =>
      `${p.sessions} ${p.sessions === 1 ? "session" : "sessions"} (evenings) ${p.span}${p.last ? ` · last played ${p.last}` : ""} · ${p.neutral} a month is neutral, fewer costs up to ${p.worst}, ${p.topSessions}+ adds ${p.top}.`,
    cost: (p: {
      imbalance: string;
      penalties: number;
      cost: string;
      rank: number;
      of: number;
    }) =>
      `Variant cost: ${p.imbalance} pp imbalance + ${p.penalties} pp rule penalties = ${p.cost}. Rank ${p.rank} of ${p.of} possible splits; the three cheapest distinct ones are shown.`,
    noPairs: "No two players are teammates in all three variants.",
    pairs: (list: string, pp: number) =>
      `Teammates in all three variants: ${list} (splitting them would cost more than ${pp} pp of balance).`,
    duo: (top: boolean, a: string, b: string, split: boolean, mode: string) =>
      `${top ? "Top" : "Bottom"} duo ${a} + ${b} ${split ? "play on opposite teams" : "play together"} (${mode} rule).`,
  },
  tally: {
    aria: "Votes",
    you: "You",
    publicNotVoted: "Votes are public. Not voted yet:",
    castBy: (name: string) => `by ${name}`,
  },
  locked: {
    won: (n: number) => `Variant ${n} won`,
    tie: (votes: number, others: string) =>
      `${votes} : ${votes} tie with Variant ${others}, drawn at random`,
    and: " and ",
    ofVotes: (v: number) => `${v} of 10 votes`,
    howToPlay: "How to play",
    openClub: "Open the group's FACEIT Club and join its queue",
    noClub: "No FACEIT Club linked yet. Ask an admin where to play.",
    steps: [
      "Everyone joins the group's FACEIT Club queue.",
      "Captains pick exactly this lineup. No freelancing.",
      "After play, send the match room links or map scores to your group admin.",
    ],
    realTitle: "What you really played on 16.12.2024",
    realText: (odds: string, rank: number) =>
      `A different split: ${odds} on paper, rank ${rank} of 126 by evenness. The Result tab shows how that went.`,
  },
  discordVoice: {
    title: "Discord voice",
    hint: "After the knife round, move connected players to their team channels. Return them to the lobby after play.",
    teams: "Move teams to channels",
    lobby: "Return players to lobby",
    moved: (count: number) => `Moved ${count} players.`,
    notConnected: (names: string) => `Not in voice: ${names}.`,
    unlinked: (names: string) => `Discord not linked: ${names}.`,
    failed: (names: string) =>
      `Move failed: ${names}. Check bot permissions and channel access.`,
    errors: {
      forbidden: "Only a group admin can move players.",
      mix: "This mix has no locked 5v5 lineup for this action.",
      channels:
        "Set up the three Discord voice channels in group settings first.",
      failed: "Discord is unavailable. Try again shortly.",
    },
  },
  admin: {
    title: "Admin",
    voting:
      "Voting closes when you close it, or by itself 60 minutes after the last vote once all ten have voted.",
    locked:
      "Changed your mind? Reopen voting any time before the match starts.",
    close: "Close Voting Now",
    proxy: "Vote for Someone",
    reopen: "Reopen Voting",
    result: "Enter Result",
    resultHint: "Add every map from this evening. The map name is optional.",
    resultConfirm: "Save these scores and mark the mix as played?",
    mapName: (number: number) => `Map ${number} (optional)`,
    teamA: "Team A",
    teamB: "Team B",
    addMap: "Add map",
    removeMap: "Remove",
    saveResult: "Save results",
    faceitTitle: "FACEIT results",
    faceitHint:
      "Find finished rooms played by this lineup, then confirm the maps to import.",
    faceitEnrichHint:
      "Add FACEIT stats to the manual result. Select the same maps in order; every score must match.",
    faceitRoomLink: "Add a room link (optional)",
    faceitFind: "Find matches",
    faceitFinding: "Finding…",
    faceitEmpty:
      "No eligible finished rooms found. You can enter scores manually.",
    faceitUnknownMap: "Unknown map",
    faceitMismatch: (count: number) =>
      `${count} lineup differences · check before importing`,
    faceitLineupOk: "Lineup matches",
    faceitAmbiguous:
      "Teams cannot be mapped safely; enter this score manually.",
    faceitOpenRoom: "Open FACEIT room",
    faceitRoomRejected:
      "The added room does not meet this mix's time, lineup or Club rules.",
    faceitImport: (count: number) => `Import ${count} maps`,
    faceitImportConfirm: (count: number) =>
      `Import ${count} FACEIT maps and mark this mix as played?`,
    faceitEnrichConfirm: (count: number) =>
      `Add FACEIT stats from ${count} maps? Manual scores will stay unchanged.`,
    proxyPlayer: "Player",
    proxyVariant: "Variant",
    startMatch: "Mark Match Started",
    startConfirm:
      "Mark the match as started? Voting cannot be reopened after this.",
    matchStarted: "Match started · voting cannot reopen",
    previewWaiting: "No variants generated yet.",
    previewNote:
      "Generation uses FACEIT ELO, group fallback ELO or the mix mean. Missing FACEIT form counts as zero.",
    previewReady: (generation: number) => `Showing generation ${generation}.`,
    generate: "Generate 3 Variants",
    generating: "Generating…",
    reroll: "Re-roll 3 Variants",
    rerolling: "Re-rolling…",
    approve: "Approve for Voting",
    approving: "Approving…",
    reopening: "Reopening…",
    cancelling: "Cancelling…",
    swapTitle: "1:1 lineup swap",
    swapLeaving: "Replace player",
    swapJoining: "With active member",
    swap: "Swap players",
    swapping: "Swapping…",
    noSwapCandidates: "No active group member is available to join this mix.",
    swapRecorded: (from: string, to: string, by: string) =>
      `Lineup changed by a swap: ${from} → ${to} (by ${by}).`,
  },
  played: {
    sources: {
      manual: "manual scores",
      faceit: "FACEIT",
      demo: "demo",
      mixed: "mixed sources",
      popflash: "Popflash archive",
    },
    archiveNote: (source: string) =>
      `Historical ${source} lineup and results. The original players did not vote here. Names are current Steam personas.`,
    historicalStats:
      "Historical Popflash stats. Missing fields stay empty; older maps use assumed KAST for Mixer Rating.",
    mapArtwork: "Illustrative map sketch",
    faceitRoom: "FACEIT room",
    downloadDemo: "Download demo",
    noStats: "Map scores are saved. Player stats are not available yet.",
    drawLine: (map: string, a: number, b: number) =>
      `${map} · ${a} : ${b} · draw`,
    scoreOnlySummary: (maps: number) => `Maps with saved scores: ${maps}`,
    mapsWon: "Maps won, Team A : Team B",
    seriesResult: (maps: number) => `Evening result · ${maps} maps`,
    mapStats: "Map player stats",
    totalStats: "All maps · player stats",
    teamWon: (team: string) => `Team ${team} won`,
    draw: "Draw",
    mapRounds: (rounds: number) => `${rounds} rounds`,
    scoreboardFor: "Scoreboard for",
    allMaps: "All maps",
    realNote:
      "The real lineup and result of 16.12.2024, not the voted variant.",
    mapLine: (
      map: string,
      a: number,
      b: number,
      team: string,
      rounds: number,
    ) => `${map} · ${a} : ${b} · Team ${team} won · ${rounds} rounds`,
    allLine: (maps: number, rounds: number) =>
      `All ${maps} maps · ${rounds} rounds · ADR and MR weighted by rounds`,
    mr: "Mixer Rating",
    awardsTitle: "Evening awards",
    awardsNote: "Calculated from available recorded stats only.",
    awardLabels: {
      cannonFodder: ["Cannon Fodder", "deaths / round"],
      pacifist: ["Pacifist", "ADR"],
      assistKing: ["Assist King", "assists / round"],
      tourist: ["Tourist", "kills / round"],
      doorOpener: ["Door Opener", "first kills"],
      clutchMinister: ["Clutch Minister", "clutches won"],
      grenadier: ["Grenadier", "utility damage"],
      sunglasses: ["Sunglasses Salesman", "enemies flashed"],
      exterminator: ["Exterminator", "aces"],
      soClose: ["So Close", "4K rounds"],
      headhunter: ["Headhunter", "% headshot kills"],
      sprayAndPray: ["Spray and Pray", "% headshot kills"],
      loneWolf: ["Lone Wolf", "kills on a lost map"],
    },
  },
  quips: {
    lobby: "Last one in brings the energy drinks.",
    balancing: "Ten players in. Time to see how the teams shake out.",
    voting: (name: string) => `${name} is late. As tradition demands.`,
    votingReady: "The lineups are ready. Voting opens soon.",
    votingOpen: "Pick a lineup. You can move your vote until voting closes.",
    locked: "Teams are final. Complaints go to the algorithm.",
    carried: (name: string) =>
      `${name} carried. Screenshots or it didn't happen.`,
    paper: (mvp: string, worst: string) =>
      `${mvp} did the job. ${worst} was only strong on paper tonight.`,
    boring: (name: string) =>
      `${name} top-fragged, exactly as the algorithm predicted. Boring, but correct.`,
    closeGame: "One round either way and this evening tells a different story.",
    stomp: "Someone brought a steamroller to a five-on-five.",
    splitEvening:
      "Both teams took a map. The rematch practically books itself.",
  },
  actions: {
    share: "Share",
    join: "Join Mix",
    vote: (n: number) => `Vote Variant ${n}`,
    yourVote: (n: number) => `Your Vote: Variant ${n}`,
    moveVote: (n: number) => `Move Vote to Variant ${n}`,
    savingVote: "Saving vote…",
    faceitClub: "FACEIT Club",
    uploadDemo: "Upload Demo",
    fullScoreboard: "Full Scoreboard",
  },
  groups: {
    switcher: "Groups",
    none: "No groups yet.",
    browse: "Browse all groups",
    directoryTitle: "Groups",
    directoryEmpty: "No groups have been created yet.",
    noMembers: "No active members yet.",
    mix: "Mix",
    newGroup: "New Group",
    name: "Name",
    slug: "Page address",
    slugHint:
      "3 to 40 characters: lowercase letters, digits and dashes, no dash at either end. Capitals and spaces are fixed as you type. It cannot be changed later.",
    slugPreview: "Your group’s page:",
    faceitClub: "FACEIT Club link (optional)",
    create: "Create Group",
    settings: "Group settings",
    discord: {
      title: "Discord server",
      setup:
        "Add the Discord app credentials and bot token to enable server connection.",
      connect: "Connect Server",
      reconnect: "Change Server",
      connected: (name: string) => `Connected to ${name}.`,
      choose: "Choose channels for voice moves and mix notifications.",
      lobby: "Lobby voice",
      teamA: "Team A voice",
      teamB: "Team B voice",
      notification: "Notifications text",
      select: "Select channel",
      save: "Save Channels",
      saved: "Channels saved.",
      unavailable:
        "The bot cannot read this server. Check that it is still installed, then reconnect.",
      missingChannels:
        "Create three voice channels and one text channel on Discord first.",
      result: {
        failed: "Could not connect the server. Try again.",
        forbidden: "Your Discord account must have Manage Server permission.",
        taken: "This Discord server is already linked to another group.",
      },
      errors: {
        forbidden: "Only group admins can save channels.",
        channels:
          "Choose three different voice channels and one text channel from this server.",
        disconnected: "Connect a Discord server first.",
        failed:
          "Could not save channels. Check the bot connection and try again.",
      },
    },
    discordAccount: {
      linked: "Discord linked",
      unlinked: "Discord not linked",
      profile: "Discord profile",
      connect: "Link Discord",
      change: "Change Discord",
      disconnect: "Unlink",
      result: {
        linked: "Your Discord account is linked.",
        unlinked: "Your Discord account is unlinked.",
        alreadyUsed: "That Discord account is linked to another player.",
        failed: "Could not update your Discord link. Try again.",
      },
    },
    discordMissing: {
      title: (count: number) =>
        `${count} ${count === 1 ? "player has" : "players have"} no Discord link`,
      roster: "View links in the group roster",
    },
    save: "Save",
    saved: "Saved.",
    club: "FACEIT Club",
    noClub: "No FACEIT Club linked yet.",
    members: (n: number) => `Members · ${n}`,
    archiveMixes: (n: number) => `Historical mixes · ${n}`,
    statistics: {
      title: "Group statistics",
      open: "Open statistics",
      intro: "Results saved to this group’s played mixes.",
      period: "Period",
      archiveScope: "Mix archive",
      sortBy: "Rank players by",
      periodOptions: {
        all: "All time",
        "30": "Last 30 days",
        "90": "Last 90 days",
        "365": "Last 365 days",
      },
      archiveOptions: {
        all: "All mixes",
        current: "Group mixes",
        archive: "Historical archive",
      },
      sortOptions: {
        rating: "Mixer Rating",
        adr: "ADR",
        kd: "K/D",
        winRate: "Win rate",
        maps: "Maps played",
      },
      apply: "Apply filters",
      evenings: "evenings",
      maps: "maps",
      scoreOnlyMaps: "score-only maps",
      archives: "archive mixes",
      sources: "Map sources",
      sourceCounts: (
        faceit: number,
        popflash: number,
        manual: number,
        demo: number,
      ) =>
        `FACEIT ${faceit} · Popflash ${popflash} · manual ${manual} · demo ${demo}`,
      scoreOnlyNote:
        "Score-only results count when the saved lineup is known. Missing player stats are left blank.",
      weightingNote:
        "ADR and Mixer Rating are weighted by the rounds available for each stat.",
      sections: "Statistics sections",
      leaderboard: "Player leaderboard",
      leaderboardNote:
        "A rank needs at least five samples for the selected column. Every player stays listed; lower-sample rows have no rank.",
      rank: "Rank",
      player: "Player",
      appearances: "Maps · evenings",
      rating: "Mixer Rating",
      ratedMaps: "rated maps",
      adr: "ADR",
      adrMaps: "ADR maps",
      kd: "K/D",
      kdMaps: "K/D maps",
      record: "W–L–D",
      winRate: "Win rate",
      mapsPlayed: "Maps",
      winRateMaps: "maps",
      noPlayers: "No player records in this scope.",
      emptyScope: "No played maps in this scope.",
      mapsTitle: "Map performance",
      map: "Map",
      played: "Played",
      mapRecord: "Team A · draws · Team B",
      averageScore: "Avg. score A:B",
      unnamedMap: "Unknown map",
      playerDetails: (count: number) => `Players · ${count}`,
      noMapPlayers: "No player records for this map.",
      pairsTitle: "Teammate pairs",
      pairsNote:
        "Pairs count maps played together on the same team. A rank needs at least five shared maps.",
      pair: "Players",
      sharedMaps: "Shared maps",
      sharedEvenings: "Evenings",
      pairRecord: "W–L–D together",
      pairWinRate: "Win rate",
      sample: "Samples",
      eligible: "Eligible",
      belowMinimum: "Below 5 maps",
      noPairs: "No teammate pair records in this scope.",
      awardsTitle: "Award totals",
      award: "Award",
      awardCount: "Times earned",
      awardLeaders: "Most awards",
      noAwards: "No awards recorded in this scope.",
    },
    statsTitle: "Group stats · all time",
    statsMixes: "played mixes",
    statsMaps: "maps",
    statsPlayers: "players with stats",
    statsSources: (
      popflash: number,
      faceit: number,
      manual: number,
      demo: number,
    ) =>
      `Sources: Popflash ${popflash} · FACEIT ${faceit} · manual ${manual} · demo ${demo}`,
    statsLeaders: "Mixer Rating leaders",
    statsMinimum:
      "At least 5 rated maps. W–L covers maps with player stats. Older Popflash ratings use assumed KAST.",
    noCurrentMixes: "No active mixes right now.",
    statsEmpty: "No rated maps yet.",
    mixResult: (a: number, b: number, draws: number) =>
      `Maps: A ${a} : ${b} B${draws ? ` · ${draws} drawn` : ""}`,
    ownResult: (kills: number, deaths: number, rating: string) =>
      `Yours: K/D ${kills}/${deaths} · MR ${rating}`,
    cancelledMix: "Mix cancelled before play.",
    admin: "admin",
    makeAdmin: "Make Admin",
    removeAdmin: "Remove Admin",
    remove: "Remove",
    confirmRemove: (name: string) => `Remove ${name} from the group?`,
    home: "Home",
    errors: {
      name: "Name: 2 to 60 characters.",
      slug: "Address: 3 to 40 lowercase letters, digits or dashes, no dash at either end.",
      faceitClub: "The FACEIT link must start with https://www.faceit.com/.",
      slugTaken: "That address is already taken.",
      lastAdmin: "A group needs at least one admin.",
      unauthorized: "Sign in through Steam first.",
      forbidden: "Only group admins can do that.",
      failed: "Something went wrong. Try again.",
    },
  },
  roster: {
    add: "Add Player",
    adding: "Adding…",
    saving: "Saving…",
    steamHint:
      "Paste a SteamID64, Steam profile URL or vanity name. Name and avatar come from Steam.",
    noFaceit: "No FACEIT link",
    fallbackElo: "Fallback ELO",
    editElo: "Edit fallback ELO",
    eloFor: (name: string) => `Fallback ELO for ${name}`,
    eloHint:
      "600–2500, used only when FACEIT ELO is missing. Leave blank to clear. Applies to this group only.",
    faceitUnavailable:
      "Player saved. FACEIT is unavailable; add the same Steam profile again to retry linking it.",
    errors: {
      steam: "Enter a valid SteamID64, Steam profile URL or vanity name.",
      notFound: "Steam did not return this player. Check the profile address.",
      steamUnavailable: "Steam is unavailable. Try again shortly.",
      closed:
        "This membership is closed. Reopening memberships is not available yet.",
      elo: "Enter a whole number from 600 to 2500, or leave blank.",
      unauthorized: "Log in with Steam first.",
      forbidden: "Only group admins can manage the roster.",
      failed: "Could not save the player. Try again.",
    },
  },
  lobby: {
    lobby: "Lobby",
    noPlayers: "No players joined this mix.",
    mixList: "Mixes",
    noMixes: "No mixes in this group yet.",
    newMix: "New Mix",
    mixTitle: "Mix title",
    create: "Create Mix",
    creating: "Creating…",
    playersColumn: "Players",
    players: "Players",
    joinOrder: "Join order",
    playersOf10: (n: number) => `${n}/10`,
    status: {
      open: "Open for sign-ups",
      balancing: "Sign-ups closed · balancing",
      voting: "Voting",
      locked: "Lineup locked",
      played: "Played",
      cancelled: "Cancelled",
    },
    freeSlot: (n: number) => `Slot ${n} · Free`,
    joined: (n: number) => `#${n}`,
    joinOrderNote: "Players appear in the order they joined.",
    join: "Join Mix",
    leave: "Leave Mix",
    addPlayer: "Add group member",
    add: "Add Player",
    remove: "Remove",
    removePlayer: (name: string) => `Remove ${name} from this mix`,
    startBalancing: "Start Balancing",
    reopen: "Reopen Sign-ups",
    cancel: "Cancel Mix",
    errors: {
      title: "Use a title from 2 to 60 characters.",
      full: "This mix is full (10 players).",
      notMember: "Only active group members can join this mix.",
      notParticipant: "Only mix participants can vote.",
      notOpen: "Sign-ups are closed for this mix.",
      notFull: "Ten players must join before balancing starts.",
      result: "Enter a valid score for every map.",
      stale: "This mix changed in another browser and has been refreshed.",
      noVariants: "Generate or refresh the three variants before continuing.",
      unauthorized: "Sign in through Steam first.",
      forbidden: "You cannot do that for this group.",
      failed: "Could not update this mix. Try again.",
    },
  },
  profile: {
    title: "Player profile",
    comparePlayers: "Compare players",
    compareTitle: "Player comparison",
    choosePlayers:
      "Choose two group members to compare their mix or Leetify history.",
    playerA: "Player A",
    playerB: "Player B",
    selectPlayer: "Choose a player",
    compareAction: "Compare players",
    compareWithMe: "Compare with me",
    chooseBothPlayers: "Choose two group members to see their comparison.",
    chooseDifferentPlayers: "Choose two different players.",
    chooseGroupMembers: "Choose two current members of this group.",
    needsTwoMembers:
      "This group needs at least two members before you can compare players.",
    profileUnavailable:
      "A player profile could not be loaded. Choose two current group members and try again.",
    comparisonMix: "Mix comparison",
    sharedHistory: "Shared mix history",
    sharedMaps: "Shared maps",
    sharedEvenings: "Shared evenings",
    againstEachOther: "Against each other",
    onSameTeam: "On the same team",
    wins: "Wins",
    losses: "Losses",
    draws: "Draws",
    kda: "K / D / A",
    adr: "ADR",
    team: "Team",
    teamA: "Team A",
    teamB: "Team B",
    date: "Date",
    noSharedMaps: "These players have no shared mix maps yet.",
    sharedMapHistory: "Recent shared maps",
    resultForPlayer: (name: string) => `${name}'s result`,
    source: "Profile source",
    mixTab: "Mix",
    faceitTab: "FACEIT",
    premierTab: "Premier",
    faceitLevel: "FACEIT level",
    faceitElo: "FACEIT ELO",
    currentFaceitElo: "Current FACEIT ELO",
    ratingTrendCount: (shown: number, total: number) =>
      `${shown} of ${total} rated maps`,
    ratingTrendAverage: (count: number) =>
      `Average Mixer Rating · ${count} maps`,
    ratingTrendMin: "Min",
    ratingTrendReference: (value: string) => `Reference ${value}`,
    ratingTrendMax: "Max",
    ratingPoint: (date: string, map: string, score: string, rating: string) =>
      `${date} · ${map} · ${score} · Mixer Rating ${rating}`,
    premierRating: "Premier",
    noLeetifyMatches: "No matches for this source.",
    faceitProfile: "Open FACEIT profile",
    faceitUnavailable: "FACEIT ELO is unavailable for this player.",
    maps: "Maps",
    winRate: "Win rate",
    record: "Wins / losses / draws",
    rating: "Mixer Rating",
    ratedMaps: "Maps with player stats",
    ratingTrend: "Mixer Rating across maps",
    noRatings:
      "No rated mix maps yet. Score-only maps still count toward the record.",
    mapHistory: "Map history",
    map: "Map",
    score: "Score",
    result: "Result",
    bestTeammates: "Best teammates",
    empty:
      "No played mix maps yet. Results will appear after the first evening.",
    outcome: { win: "Win", loss: "Loss", draw: "Draw" },
  },
  loading: {
    loading: "Loading...",
    working: "Working...",
    leetify: "Loading Leetify data...",
    routes: {
      groups: "Loading groups...",
      group: "Loading group...",
      mix: "Loading mix...",
      profile: "Loading player profile...",
    },
  },
  showcase: {
    title: "Showcase: our popflash evening of 16 Dec 2024",
    notes: [
      "Real: the ten of us, the teams we played, every map score and every K/A/D/ADR line.",
      "Real engine: skill S from each player's FACEIT history before that evening (ELO is today's).",
      "Made up: join times, votes (a 4 : 4 tie on purpose) and who was late. Buttons do nothing yet.",
      "Leetify card: live, the last 30 days before today (Leetify keeps no 2024 matches), never stored.",
    ],
    when: "Mon 20:45",
  },
};

export type Dict = typeof en;

const pl: Dict = {
  prefs: {
    backdrop: "Tło 1.6",
    backdropShort: "1.6",
    language: "Język",
    english: "English",
    polish: "Polski",
  },
  home: {
    tagline:
      "Miksy 5 na 5 w CS2 dla naszej ekipy: wyrównane składy, głosowanie na żywo i statystyki ze wszystkich miksów.",
    loginFailed: "Logowanie przez Steam nie wyszło. Spróbuj jeszcze raz.",
    notConfigured: (missing: string) =>
      `Logowanie nie jest skonfigurowane na tym deployu. Brakuje: ${missing}.`,
    signIn: "Zaloguj przez Steam",
    signInShort: "Zaloguj",
    signOut: "Wyloguj",
    myProfile: "Mój profil",
    siteAdmin: "admin strony",
    showcase: "Zobacz prawdziwy miks: 16.12.2024",
    source: "kod",
    openSignups: "Otwarte zapisy",
    noOpenSignups: "Nie ma teraz otwartych zapisów.",
    inProgress: "Moje trwające miksy",
    noInProgress: "Nie masz żadnych trwających miksów.",
    myGroups: "Moje grupy",
    createGroup: "Utwórz grupę",
    youAreIn: "Jesteś zapisany",
    mixStatus: {
      balancing: "Balansowanie",
      voting: "Głosowanie",
      locked: "Skład zamknięty",
    },
  },
  switcher: {
    label: "Pokaz:",
    lobby: "1 lobby",
    voting: "2 głosowanie",
    locked: "3 skład",
    played: "4 wynik",
  },
  mix: {
    title: (n, when) => `Miks #${n} · ${when}`,
    playersOf10: (n) => `${n} z 10 graczy`,
  },
  status: {
    lobby: (left) =>
      `Otwarty · ${left} ${plural(left, "wolne miejsce", "wolne miejsca", "wolnych miejsc")} · balans rusza przy 10/10`,
    balancing: "Balansowanie · podgląd admina",
    voting: (voted) => `Głosowanie · zagłosowało ${voted} z 10 · czekamy na`,
    votingReady: "Głosowanie · zatwierdzone składy są gotowe",
    votingAll:
      "Głosowanie · zagłosowało 10 z 10 · zamknie się 60 minut po ostatnim głosie",
    lockedBefore: "Głosowanie zamknięte ·",
    lockedAfter: "wygrał",
    played: (maps, source) =>
      `Rozegrany · ${maps} ${plural(maps, "mapa", "mapy", "map")} · wynik z ${source}`,
  },
  lists: {
    playerJoinOrder: "Gracz · kolejność zapisów",
    player: "Gracz",
    showPlayerDetails: (name) => `Pokaż szczegóły balansu gracza ${name}`,
    tapForDetails: " · kliknij po szczegóły",
    skill: "Wynik balansu S",
    freeSlot: "wolne miejsce",
    joined: (t) => `Dołączył o ${t}`,
    teamA: "Drużyna A",
    teamB: "Drużyna B",
    team: (t) => `Drużyna ${t}`,
  },
  odds: { winChance: "Szansa A : B", avgS: "Średnie S", vs: "vs" },
  variants: {
    aria: "Warianty",
    variant: (n) => `Wariant ${n}`,
    mostEven: "Najrówniejszy",
    fresh: "Świeży podział",
    leading: "Prowadzi",
  },
  leetify: {
    title: (live) =>
      `Leetify · FACEIT, ostatnie 30 dni${live ? " (na żywo)" : ""}`,
    previewTitle: (name) => `Leetify · ${name} · FACEIT, ostatnie 30 dni`,
    notAnswering: (name) => `Leetify nie odpowiada teraz dla gracza ${name}.`,
    privateProfile: "Ten profil Leetify jest prywatny.",
    noRecentFaceit: "Brak meczów FACEIT z ostatnich 30 dni.",
    none: (span) => `Brak meczów FACEIT ${span}.`,
    matches: (span) => `meczów FACEIT ${span}`,
    wl: (w, l, d = 0) => `${w} W ${l} P${d ? ` ${d} R` : ""}`,
    win: "W",
    loss: "P",
    draw: "R",
    kad: "K/A/D",
    liveNotStored: "na żywo z Leetify, nie zapisujemy",
    resultsAria: "Wyniki, od najnowszego",
    detailsTitle: "Więcej statystyk meczu",
    details: {
      total_damage: "Łączne obrażenia",
      adr: "ADR",
      rounds_count: "Rozegrane rundy",
      rounds_survived: "Przeżyte rundy",
      total_hs_kills: "Zabójstwa w głowę",
      mvps: "MVP",
      multi2k: "Rundy 2K",
      multi3k: "Rundy 3K",
      multi4k: "Rundy 4K",
      multi5k: "Asy",
      flashbang_thrown: "Rzucone flashe",
      flashbang_hit_foe: "Oślepieni przeciwnicy",
      flashbang_hit_friend: "Oślepieni koledzy",
      flash_assist: "Asysty po flashu",
      trade_kills_succeed: "Zabójstwa po wymianie",
      traded_deaths_succeed: "Wymienione zgony",
      shots_fired: "Oddane strzały",
      shots_hit_foe: "Trafienia przeciwników",
      shots_hit_friend: "Trafienia kolegów",
    },
    date: "Data",
    map: "Mapa",
    score: "Wynik",
    rating: "Leetify Rating",
    rawRatingByMatch: "Surowy Leetify Rating na mecz",
    lastMatches: "Ostatnie 20 meczów",
    averageRating: (source, count) =>
      `Średni Leetify Rating · ${count} ${plural(count, "mecz", "mecze", "meczów")} (${source})`,
    ratingPoint: (date, map, score, rating) =>
      `${date} · ${map} · ${score} · Leetify Rating ${rating}`,
    result: "Rezultat",
    placeholder: (name) =>
      `Zero FACEIT od 30 dni. ${name} albo dotyka trawy, albo po cichu grinduje Premiera.`,
    more: (n) => `i jeszcze ${n} na Leetify`,
  },
  explain: {
    title: "Jak to policzyliśmy?",
    eName: "Wkład E",
    eFaceitAtLineup: (elo, level) =>
      `${elo} ELO przy układaniu składu · ${level ? `poziom ${level} · ` : ""}dane FACEIT użyte w tym miksie`,
    eManualAtLineup: (elo) =>
      `${elo} ELO przy układaniu składu · ręczna wartość admina, bo brakowało ELO FACEIT`,
    eMixMeanAtLineup: (elo) =>
      `${elo} ELO przy układaniu składu · średnia z ELO pozostałych graczy w tym miksie`,
    eNeutralAtLineup: (elo) =>
      `${elo} ELO przy układaniu składu · wartość neutralna`,
    eSwapAtLineup: (elo, steamId) =>
      `${elo} ELO przy układaniu składu · dane z zatwierdzonego slota od ${steamId}`,
    fName: (days) => `Forma na FACEIT, ostatnie ${days} dni`,
    mName: (weight) =>
      `Forma w miksach${weight === 1 ? "" : ` · waga ${weight}`}`,
    mNote: (p) =>
      `${p.maps} ${plural(p.maps, "mapa", "mapy", "map")} z miksów · Mixer Rating ${p.player} vs grupa ${p.group} → ${p.shrunk} po ściągnięciu do średniej · surowo ${p.raw} × ${p.mult} za ${p.up ? "dobrą formę" : "słabszy okres"} przy ${p.elo} ELO${p.cap}`,
    mNone: "Brak jeszcze map z miksów ze statystykami",
    aName: (days) => `Aktywność, ostatnie ${days} dni`,
    capped: (max) => ` (ucięte do ±${max})`,
    fNoRecent: (span) =>
      `Brak meczów FACEIT ${span} (30 dni przed miksem): bez formy, samo ELO.`,
    fThin: (n, base, need) =>
      `${n} ${plural(n, "mecz", "mecze", "meczów")}, ale tylko ${base} starszych do porównania (potrzeba ${need}): bez formy.`,
    fInvalid: "Brak sensownego ratingu bazowego.",
    fUnavailable: "Forma FACEIT niedostępna; F = 0 w tym miksie.",
    fParts: (p) =>
      [
        `${p.n} ${plural(p.n, "mecz", "mecze", "meczów")} ${p.span} · rating ${p.window} vs ${p.base} z ${p.baseN} starszych`,
        `stosunek ${p.ratio} → ${p.shrunk} po ściągnięciu do normy (k = ${p.k})`,
        `surowo ${p.beta} × ${p.delta} = ${p.raw}${p.rawCap}`,
        `× ${p.mult} za ${p.up ? "dobrą formę" : "słabszy okres"} przy ${p.elo} ELO${p.cap}`,
      ].join(" · "),
    aNoData: "Brak historii FACEIT: liczy się jako 0, nigdy jako kara.",
    aNote: (p) =>
      `${p.sessions} ${plural(p.sessions, "sesja", "sesje", "sesji")} (wieczorów) ${p.span}${p.last ? ` · ostatnio grał ${p.last}` : ""} · ${p.neutral} w miesiącu to norma, mniej kosztuje do ${p.worst}, ${p.topSessions}+ dodaje ${p.top}.`,
    cost: (p) =>
      `Koszt wariantu: ${p.imbalance} pp nierówności + ${p.penalties} pp kar za reguły = ${p.cost}. Miejsce ${p.rank} z ${p.of} możliwych podziałów; pokazujemy trzy najtańsze różne.`,
    noPairs: "Żadna para nie gra razem we wszystkich trzech wariantach.",
    pairs: (list, pp) =>
      `Razem we wszystkich trzech wariantach: ${list} (rozdzielenie kosztowałoby ponad ${pp} pp równowagi).`,
    duo: (top, a, b, split, mode) =>
      `${top ? "Topowy" : "Najsłabszy"} duet ${a} + ${b} ${split ? "gra po przeciwnych stronach" : "gra razem"} (reguła ${mode === "hard" ? "twarda" : mode === "soft" ? "miękka" : "wyłączona"}).`,
  },
  tally: {
    aria: "Głosy",
    you: "Ty",
    publicNotVoted: "Głosy są jawne. Jeszcze nie zagłosował:",
    castBy: (name) => `przez ${name}`,
  },
  locked: {
    won: (n) => `Wygrał wariant ${n}`,
    tie: (votes, others) =>
      `remis ${votes} : ${votes} z wariantem ${others}, rozstrzygnięty losowo`,
    and: " i ",
    ofVotes: (v) => `${v} z 10 głosów`,
    howToPlay: "Jak gramy",
    openClub: "Otwórz klub grupy na FACEIT i dołącz do kolejki",
    noClub: "Grupa nie ma jeszcze klubu FACEIT. Zapytaj admina, gdzie gramy.",
    steps: [
      "Wszyscy wchodzą do kolejki klubu grupy na FACEIT.",
      "Kapitanowie wybierają dokładnie ten skład. Bez samowolki.",
      "Po grze wyślij adminowi grupy linki do pokoi meczowych albo wyniki map.",
    ],
    realTitle: "Co naprawdę zagraliście 16.12.2024",
    realText: (odds, rank) =>
      `Inny podział: ${odds} na papierze, ${rank}. miejsce na 126 pod względem wyrównania. Jak to się skończyło, widać w zakładce z wynikiem.`,
  },
  discordVoice: {
    title: "Kanały głosowe Discord",
    hint: "Po nożówce przenieś graczy do kanałów drużyn. Po grze wróć z nimi do lobby.",
    teams: "Przenieś drużyny na kanały",
    lobby: "Przenieś graczy do lobby",
    moved: (count) => `Przeniesiono graczy: ${count}.`,
    notConnected: (names) => `Nie byli na voice: ${names}.`,
    unlinked: (names) => `Nie połączyli Discorda: ${names}.`,
    failed: (names) =>
      `Nie udało się przenieść: ${names}. Sprawdź uprawnienia bota i dostęp do kanałów.`,
    errors: {
      forbidden: "Tylko admin grupy może przenosić graczy.",
      mix: "Ten miks nie ma zamkniętego składu 5 na 5 dla tej akcji.",
      channels:
        "Najpierw ustaw trzy kanały głosowe Discorda w ustawieniach grupy.",
      failed: "Discord jest niedostępny. Spróbuj ponownie za chwilę.",
    },
  },
  admin: {
    title: "Admin",
    voting:
      "Głosowanie zamykasz Ty albo zamyka się samo 60 minut po ostatnim głosie, gdy zagłosuje cała dziesiątka.",
    locked:
      "Zmiana planów? Możesz otworzyć głosowanie ponownie aż do startu meczu.",
    close: "Zamknij głosowanie",
    proxy: "Zagłosuj za kogoś",
    reopen: "Otwórz głosowanie",
    result: "Wpisz wynik",
    resultHint: "Dodaj wszystkie rozegrane mapy. Nazwa mapy jest opcjonalna.",
    resultConfirm: "Zapisać wyniki i oznaczyć miks jako rozegrany?",
    mapName: (number: number) => `Mapa ${number} (opcjonalnie)`,
    teamA: "Drużyna A",
    teamB: "Drużyna B",
    addMap: "Dodaj mapę",
    removeMap: "Usuń",
    saveResult: "Zapisz wyniki",
    faceitTitle: "Wyniki FACEIT",
    faceitHint:
      "Znajdź zakończone pokoje tego składu i potwierdź mapy do importu.",
    faceitEnrichHint:
      "Dodaj statystyki FACEIT do ręcznego wyniku. Wybierz te same mapy po kolei; każdy wynik musi się zgadzać.",
    faceitRoomLink: "Dodaj link do pokoju (opcjonalnie)",
    faceitFind: "Znajdź mecze",
    faceitFinding: "Szukanie…",
    faceitEmpty:
      "Brak pasujących zakończonych pokoi. Możesz wpisać wyniki ręcznie.",
    faceitUnknownMap: "Nieznana mapa",
    faceitMismatch: (count) =>
      `${count} różnic w składzie · sprawdź przed importem`,
    faceitLineupOk: "Skład pasuje",
    faceitAmbiguous: "Nie da się pewnie przypisać drużyn; wpisz wynik ręcznie.",
    faceitOpenRoom: "Otwórz pokój FACEIT",
    faceitRoomRejected:
      "Dodany pokój nie pasuje do czasu, składu albo klubu tego miksu.",
    faceitImport: (count) => `Importuj ${count} map`,
    faceitImportConfirm: (count) =>
      `Zaimportować ${count} map FACEIT i oznaczyć miks jako rozegrany?`,
    faceitEnrichConfirm: (count) =>
      `Dodać statystyki FACEIT z ${count} map? Ręczne wyniki pozostaną bez zmian.`,
    proxyPlayer: "Gracz",
    proxyVariant: "Wariant",
    startMatch: "Oznacz start meczu",
    startConfirm:
      "Oznaczyć start meczu? Nie będzie można ponownie otworzyć głosowania.",
    matchStarted: "Mecz rozpoczęty · głosowania nie można otworzyć ponownie",
    previewWaiting: "Nie wygenerowano jeszcze wariantów.",
    previewNote:
      "ELO pochodzi z FACEIT, zapasowego ELO grupy albo średniej miksu. Brak formy FACEIT liczy się jako zero.",
    previewReady: (generation) => `Podgląd zestawu ${generation}.`,
    generate: "Wygeneruj 3 warianty",
    generating: "Generowanie…",
    reroll: "Przelosuj 3 warianty",
    rerolling: "Przelosowywanie…",
    approve: "Zatwierdź do głosowania",
    approving: "Zatwierdzanie…",
    reopening: "Otwieranie zapisów…",
    cancelling: "Anulowanie…",
    swapTitle: "Wymiana 1:1 w składzie",
    swapLeaving: "Zastąp gracza",
    swapJoining: "Aktywnym członkiem",
    swap: "Zamień graczy",
    swapping: "Zamienianie…",
    noSwapCandidates:
      "Brak aktywnego członka grupy, który może dołączyć do miksu.",
    swapRecorded: (from, to, by) =>
      `Skład zmieniono przez wymianę: ${from} → ${to} (admin: ${by}).`,
  },
  played: {
    sources: {
      manual: "wyników ręcznych",
      faceit: "FACEIT",
      demo: "dema",
      mixed: "różnych źródeł",
      popflash: "archiwum Popflash",
    },
    archiveNote: (source) =>
      `Archiwalny skład i wyniki z ${source}. Gracze nie głosowali tu nad składem. Nicki pochodzą z aktualnych profili Steam.`,
    historicalStats:
      "Historyczne statystyki Popflash. Brakujące pola pozostają puste; na starszych mapach Mixer Rating używa założonego KAST.",
    mapArtwork: "Ilustracyjny szkic mapy",
    faceitRoom: "Pokój FACEIT",
    downloadDemo: "Pobierz demo",
    noStats:
      "Wyniki map są zapisane. Statystyki graczy nie są jeszcze dostępne.",
    drawLine: (map, a, b) => `${map} · ${a} : ${b} · remis`,
    scoreOnlySummary: (maps) => `Mapy z zapisanym wynikiem: ${maps}`,
    mapsWon: "Wygrane mapy, drużyna A : drużyna B",
    seriesResult: (maps) =>
      `Wynik wieczoru · ${maps} ${plural(maps, "mapa", "mapy", "map")}`,
    mapStats: "Statystyki graczy na mapie",
    totalStats: "Statystyki graczy · wszystkie mapy",
    teamWon: (team) => `Wygrała drużyna ${team}`,
    draw: "Remis",
    mapRounds: (rounds) => `${rounds} rund`,
    scoreboardFor: "Tabela dla",
    allMaps: "Wszystkie mapy",
    realNote: "Prawdziwy skład i wynik z 16.12.2024, nie wariant z głosowania.",
    mapLine: (map, a, b, team, rounds) =>
      `${map} · ${a} : ${b} · wygrała drużyna ${team} · ${rounds} rund`,
    allLine: (maps, rounds) =>
      `Wszystkie ${maps} ${plural(maps, "mapa", "mapy", "map")} · ${rounds} rund · ADR i MR ważone rundami`,
    mr: "Mixer Rating",
    awardsTitle: "Nagrody wieczoru",
    awardsNote: "Liczone wyłącznie z dostępnych zapisanych statystyk.",
    awardLabels: {
      cannonFodder: ["Mięso armatnie", "zgony / rundę"],
      pacifist: ["Pacyfista", "ADR"],
      assistKing: ["Król asyst", "asysty / rundę"],
      tourist: ["Turysta", "zabójstwa / rundę"],
      doorOpener: ["Otwieracz", "pierwsze zabójstwa"],
      clutchMinister: ["Minister clutchy", "wygrane clutche"],
      grenadier: ["Grenadier", "obrażenia granatami"],
      sunglasses: ["Sprzedawca okularów", "oślepieni wrogowie"],
      exterminator: ["Eksterminator", "asy"],
      soClose: ["Tak blisko", "rundy 4K"],
      headhunter: ["Łowca głów", "% zabójstw w głowę"],
      sprayAndPray: ["Spray i modlitwa", "% zabójstw w głowę"],
      loneWolf: ["Samotny wilk", "zabójstwa na przegranej mapie"],
    },
  },
  quips: {
    lobby: "Ostatni zapisany stawia energetyki.",
    balancing: "Dziesiątka zebrana. Zobaczmy, jak wyjdą składy.",
    voting: (name) => `${name} się spóźnia. Tradycji musi stać się zadość.`,
    votingReady: "Składy są gotowe. Głosowanie pojawi się wkrótce.",
    votingOpen: "Wybierz skład. Możesz zmienić głos do zamknięcia głosowania.",
    locked: "Składy zamknięte. Reklamacje do algorytmu.",
    carried: (name) =>
      `${name} wyniósł drużynę na plecach. Screeny albo nie było.`,
    paper: (mvp, worst) =>
      `${mvp} zrobił robotę. ${worst} był dziś mocny tylko na papierze.`,
    boring: (name) =>
      `${name} najlepszy, dokładnie jak przewidział algorytm. Nudne, ale poprawne.`,
    closeGame: "Jedna runda w drugą stronę i ten wieczór miałby inną historię.",
    stomp: "Ktoś zabrał walec na mecz pięciu na pięciu.",
    splitEvening:
      "Obie drużyny wzięły mapę. Rewanż praktycznie umawia się sam.",
  },
  actions: {
    share: "Udostępnij",
    join: "Dołącz",
    vote: (n) => `Głosuj na wariant ${n}`,
    yourVote: (n) => `Twój głos: wariant ${n}`,
    moveVote: (n) => `Przenieś głos na wariant ${n}`,
    savingVote: "Zapisywanie głosu…",
    faceitClub: "Klub FACEIT",
    uploadDemo: "Wrzuć demo",
    fullScoreboard: "Pełna tabela",
  },
  groups: {
    switcher: "Grupy",
    none: "Nie masz jeszcze grup.",
    browse: "Wszystkie grupy",
    directoryTitle: "Grupy",
    directoryEmpty: "Nie utworzono jeszcze żadnej grupy.",
    noMembers: "Nie ma jeszcze aktywnych członków.",
    mix: "Miks",
    newGroup: "Nowa grupa",
    name: "Nazwa",
    slug: "Adres strony",
    slugHint:
      "Od 3 do 40 znaków: małe litery, cyfry i myślniki, bez myślnika na końcach. Wielkie litery, spacje i polskie znaki poprawiamy przy wpisywaniu. Później nie da się go zmienić.",
    slugPreview: "Strona grupy:",
    faceitClub: "Link do klubu FACEIT (opcjonalnie)",
    create: "Utwórz grupę",
    settings: "Ustawienia grupy",
    discord: {
      title: "Serwer Discord",
      setup: "Dodaj dane aplikacji Discord i token bota, aby podłączyć serwer.",
      connect: "Podłącz serwer",
      reconnect: "Zmień serwer",
      connected: (name) => `Połączono z ${name}.`,
      choose: "Wybierz kanały do przenoszenia graczy i powiadomień o miksach.",
      lobby: "Kanał głosowy lobby",
      teamA: "Kanał głosowy drużyny A",
      teamB: "Kanał głosowy drużyny B",
      notification: "Kanał tekstowy powiadomień",
      select: "Wybierz kanał",
      save: "Zapisz kanały",
      saved: "Zapisano kanały.",
      unavailable:
        "Bot nie może odczytać serwera. Sprawdź, czy nadal jest dodany, i połącz ponownie.",
      missingChannels:
        "Najpierw utwórz na Discordzie trzy kanały głosowe i jeden tekstowy.",
      result: {
        failed: "Nie udało się podłączyć serwera. Spróbuj ponownie.",
        forbidden:
          "Twoje konto Discord musi mieć uprawnienie Zarządzanie serwerem.",
        taken: "Ten serwer Discord jest już przypisany do innej grupy.",
      },
      errors: {
        forbidden: "Kanały mogą zapisywać tylko admini grupy.",
        channels:
          "Wybierz trzy różne kanały głosowe i jeden tekstowy z tego serwera.",
        disconnected: "Najpierw podłącz serwer Discord.",
        failed:
          "Nie udało się zapisać kanałów. Sprawdź połączenie z botem i spróbuj ponownie.",
      },
    },
    discordAccount: {
      linked: "Połączono z Discordem",
      unlinked: "Brak połączenia z Discordem",
      profile: "Profil Discord",
      connect: "Połącz Discord",
      change: "Zmień konto Discord",
      disconnect: "Odłącz",
      result: {
        linked: "Twoje konto Discord zostało połączone.",
        unlinked: "Twoje konto Discord zostało odłączone.",
        alreadyUsed: "To konto Discord jest już połączone z innym graczem.",
        failed:
          "Nie udało się zmienić połączenia z Discordem. Spróbuj ponownie.",
      },
    },
    discordMissing: {
      title: (count) =>
        `${count} ${count === 1 ? "gracz nie ma" : "graczy nie ma"} połączenia z Discordem`,
      roster: "Zobacz połączenia w składzie grupy",
    },
    save: "Zapisz",
    saved: "Zapisano.",
    club: "Klub FACEIT",
    noClub: "Brak podpiętego klubu FACEIT.",
    members: (n) => `Członkowie · ${n}`,
    archiveMixes: (n) => `Archiwalne miksy · ${n}`,
    statistics: {
      title: "Statystyki grupy",
      open: "Otwórz statystyki",
      intro: "Wyniki zapisane w rozegranych miksach tej grupy.",
      period: "Okres",
      archiveScope: "Archiwum miksów",
      sortBy: "Sortuj graczy według",
      periodOptions: {
        all: "Cała historia",
        "30": "Ostatnie 30 dni",
        "90": "Ostatnie 90 dni",
        "365": "Ostatnie 365 dni",
      },
      archiveOptions: {
        all: "Wszystkie miksy",
        current: "Miksy grupy",
        archive: "Archiwalne wyniki",
      },
      sortOptions: {
        rating: "Mixer Rating",
        adr: "ADR",
        kd: "K/D",
        winRate: "Odsetek zwycięstw",
        maps: "Rozegrane mapy",
      },
      apply: "Zastosuj filtry",
      evenings: "wieczorów",
      maps: "map",
      scoreOnlyMaps: "map tylko z wynikiem",
      archives: "archiwalnych miksów",
      sources: "Źródła map",
      sourceCounts: (
        faceit: number,
        popflash: number,
        manual: number,
        demo: number,
      ) =>
        `FACEIT ${faceit} · Popflash ${popflash} · ręczne ${manual} · demo ${demo}`,
      scoreOnlyNote:
        "Wynik mapy liczy się, gdy zapisany jest skład. Brakujące statystyki graczy pozostają puste.",
      weightingNote:
        "ADR i Mixer Rating są ważone według liczby dostępnych rund dla danej statystyki.",
      sections: "Sekcje statystyk",
      leaderboard: "Tabela graczy",
      leaderboardNote:
        "Do rankingu potrzeba 5 map z danymi dla wybranej statystyki. Wszyscy gracze są widoczni; poniżej progu wiersze są bez miejsca w rankingu.",
      rank: "Miejsce",
      player: "Gracz",
      appearances: "Mapy · wieczory",
      rating: "Mixer Rating",
      ratedMaps: "ocenionych map",
      adr: "ADR",
      adrMaps: "map ADR",
      kd: "K/D",
      kdMaps: "map K/D",
      record: "W–P–R",
      winRate: "Odsetek zwycięstw",
      mapsPlayed: "Mapy",
      winRateMaps: "map",
      noPlayers: "Brak danych graczy w tym zakresie.",
      emptyScope: "Brak rozegranych map w tym zakresie.",
      mapsTitle: "Wyniki na mapach",
      map: "Mapa",
      played: "Rozegrane",
      mapRecord: "Drużyna A · remisy · drużyna B",
      averageScore: "Śr. wynik A:B",
      unnamedMap: "Nieznana mapa",
      playerDetails: (count: number) => `Gracze · ${count}`,
      noMapPlayers: "Brak danych graczy dla tej mapy.",
      pairsTitle: "Współgracze",
      pairsNote:
        "Liczą się mapy rozegrane razem w tej samej drużynie. Do rankingu potrzeba co najmniej pięciu wspólnych map.",
      pair: "Gracze",
      sharedMaps: "Wspólne mapy",
      sharedEvenings: "Wieczory",
      pairRecord: "W–P–R razem",
      pairWinRate: "Odsetek zwycięstw",
      sample: "Próbka",
      eligible: "W rankingu",
      belowMinimum: "Poniżej 5 map",
      noPairs: "Brak wspólnych map w tym zakresie.",
      awardsTitle: "Zestawienie nagród",
      award: "Wyróżnienie",
      awardCount: "Liczba wyróżnień",
      awardLeaders: "Najwięcej wyróżnień",
      noAwards: "Brak wyróżnień w tym zakresie.",
    },
    statsTitle: "Statystyki grupy · cała historia",
    statsMixes: "rozegrane miksy",
    statsMaps: "mapy",
    statsPlayers: "gracze ze statystykami",
    statsSources: (popflash, faceit, manual, demo) =>
      `Źródła: Popflash ${popflash} · FACEIT ${faceit} · ręczne ${manual} · demo ${demo}`,
    statsLeaders: "Najwyższy Mixer Rating",
    statsMinimum:
      "Co najmniej 5 ocenionych map. W–L dotyczy map ze statystykami graczy. Starsze oceny Popflash używają założonego KAST.",
    noCurrentMixes: "Brak aktywnych miksów.",
    statsEmpty: "Nie ma jeszcze ocenionych map.",
    mixResult: (a, b, draws) =>
      `Mapy: A ${a} : ${b} B${draws ? ` · remisy ${draws}` : ""}`,
    ownResult: (kills, deaths, rating) =>
      `Twoje: K/D ${kills}/${deaths} · MR ${rating}`,
    cancelledMix: "Miks anulowano przed grą.",
    admin: "admin",
    makeAdmin: "Daj admina",
    removeAdmin: "Zabierz admina",
    remove: "Usuń",
    confirmRemove: (name) => `Usunąć ${name} z grupy?`,
    home: "Start",
    errors: {
      name: "Nazwa: od 2 do 60 znaków.",
      slug: "Adres: od 3 do 40 małych liter, cyfr lub myślników, bez myślnika na końcach.",
      faceitClub: "Link FACEIT musi zaczynać się od https://www.faceit.com/.",
      slugTaken: "Ten adres jest już zajęty.",
      lastAdmin: "Grupa musi mieć co najmniej jednego admina.",
      unauthorized: "Najpierw zaloguj się przez Steam.",
      forbidden: "To mogą zrobić tylko admini grupy.",
      failed: "Coś poszło nie tak. Spróbuj ponownie.",
    },
  },
  roster: {
    add: "Dodaj gracza",
    adding: "Dodawanie…",
    saving: "Zapisywanie…",
    steamHint:
      "Wklej SteamID64, link do profilu Steam lub własną nazwę z adresu profilu. Nazwę i awatar pobierzemy ze Steam.",
    noFaceit: "Brak powiązania z FACEIT",
    fallbackElo: "Zapasowe ELO",
    editElo: "Zmień zapasowe ELO",
    eloFor: (name) => `Zapasowe ELO gracza ${name}`,
    eloHint:
      "600–2500, używane tylko przy braku ELO FACEIT. Puste pole usuwa wartość. Dotyczy tylko tej grupy.",
    faceitUnavailable:
      "Gracz zapisany. FACEIT jest niedostępny; dodaj ten sam profil Steam ponownie, aby ponowić powiązanie.",
    errors: {
      steam:
        "Podaj poprawne SteamID64, link do profilu Steam lub własną nazwę z adresu profilu.",
      notFound: "Steam nie zwrócił tego gracza. Sprawdź adres profilu.",
      steamUnavailable: "Steam jest niedostępny. Spróbuj za chwilę.",
      closed:
        "To członkostwo jest zamknięte. Ponowne otwieranie nie jest jeszcze dostępne.",
      elo: "Podaj liczbę całkowitą od 600 do 2500 lub zostaw puste pole.",
      unauthorized: "Najpierw zaloguj się przez Steam.",
      forbidden: "Składem mogą zarządzać tylko admini grupy.",
      failed: "Nie udało się zapisać gracza. Spróbuj ponownie.",
    },
  },
  lobby: {
    lobby: "Lobby",
    noPlayers: "Nikt nie dołączył do tego miksu.",
    mixList: "Miksy",
    noMixes: "W tej grupie nie ma jeszcze miksów.",
    newMix: "Nowy miks",
    mixTitle: "Nazwa miksu",
    create: "Utwórz miks",
    creating: "Tworzenie…",
    playersColumn: "Gracze",
    players: "Gracze",
    joinOrder: "Kolejność zapisów",
    playersOf10: (n: number) => `${n}/10`,
    status: {
      open: "Zapisy otwarte",
      balancing: "Zapisy zamknięte · podział składów",
      voting: "Głosowanie",
      locked: "Skład zamknięty",
      played: "Rozegrany",
      cancelled: "Anulowany",
    },
    freeSlot: (n: number) => `Miejsce ${n} · wolne`,
    joined: (n: number) => `#${n}`,
    joinOrderNote: "Gracze są pokazani w kolejności zapisów.",
    join: "Dołącz do miksu",
    leave: "Wypisz się",
    addPlayer: "Dodaj członka grupy",
    add: "Dodaj gracza",
    remove: "Usuń",
    removePlayer: (name) => `Usuń ${name} z tego miksu`,
    startBalancing: "Zamknij zapisy",
    reopen: "Otwórz zapisy",
    cancel: "Anuluj miks",
    errors: {
      title: "Nazwa musi mieć od 2 do 60 znaków.",
      full: "Miks jest pełny (10 graczy).",
      notMember: "Do miksu mogą dołączyć tylko aktywni członkowie grupy.",
      notParticipant: "Głosować mogą tylko uczestnicy miksu.",
      notOpen: "Zapisy do tego miksu są zamknięte.",
      notFull: "Do rozpoczęcia podziału składów potrzeba dziesięciu graczy.",
      result: "Wpisz poprawny wynik każdej mapy.",
      stale: "Miks zmienił się w innej przeglądarce i został odświeżony.",
      noVariants: "Wygeneruj trzy warianty albo odśwież stronę.",
      unauthorized: "Najpierw zaloguj się przez Steam.",
      forbidden: "Nie możesz wykonać tej czynności w tej grupie.",
      failed: "Nie udało się zmienić miksu. Spróbuj ponownie.",
    },
  },
  profile: {
    title: "Profil gracza",
    comparePlayers: "Porównaj graczy",
    compareTitle: "Porównanie graczy",
    choosePlayers:
      "Wybierz dwóch członków grupy, aby porównać historię miksów lub Leetify.",
    playerA: "Gracz A",
    playerB: "Gracz B",
    selectPlayer: "Wybierz gracza",
    compareAction: "Porównaj graczy",
    compareWithMe: "Porównaj ze mną",
    chooseBothPlayers: "Wybierz dwóch członków grupy, aby zobaczyć porównanie.",
    chooseDifferentPlayers: "Wybierz dwóch różnych graczy.",
    chooseGroupMembers: "Wybierz dwóch aktywnych członków tej grupy.",
    needsTwoMembers: "Do porównania potrzeba co najmniej dwóch członków grupy.",
    profileUnavailable:
      "Nie udało się wczytać profilu gracza. Wybierz dwóch aktywnych członków grupy i spróbuj ponownie.",
    comparisonMix: "Porównanie miksów",
    sharedHistory: "Wspólna historia miksów",
    sharedMaps: "Wspólne mapy",
    sharedEvenings: "Wspólne wieczory",
    againstEachOther: "Przeciwko sobie",
    onSameTeam: "W jednej drużynie",
    wins: "Wygrane",
    losses: "Porażki",
    draws: "Remisy",
    kda: "K / D / A",
    adr: "ADR",
    team: "Drużyna",
    teamA: "Drużyna A",
    teamB: "Drużyna B",
    date: "Data",
    noSharedMaps: "Ci gracze nie mają jeszcze wspólnych map z miksów.",
    sharedMapHistory: "Ostatnie wspólne mapy",
    resultForPlayer: (name) => `Wynik gracza ${name}`,
    source: "Źródło profilu",
    mixTab: "Mix",
    faceitTab: "FACEIT",
    premierTab: "Premier",
    faceitLevel: "Poziom FACEIT",
    faceitElo: "ELO FACEIT",
    currentFaceitElo: "Aktualne ELO FACEIT",
    ratingTrendCount: (shown, total) => `${shown} z ${total} ocenionych map`,
    ratingTrendAverage: (count) =>
      `Średni Mixer Rating · ${count} ${plural(count, "mapa", "mapy", "map")}`,
    ratingTrendMin: "Min",
    ratingTrendReference: (value) => `Odniesienie ${value}`,
    ratingTrendMax: "Maks.",
    ratingPoint: (date, map, score, rating) =>
      `${date} · ${map} · ${score} · Mixer Rating ${rating}`,
    premierRating: "Premier",
    noLeetifyMatches: "Brak meczów z tego źródła.",
    faceitProfile: "Otwórz profil FACEIT",
    faceitUnavailable: "ELO FACEIT tego gracza jest niedostępne.",
    maps: "Mapy",
    winRate: "Odsetek zwycięstw",
    record: "Wygrane / porażki / remisy",
    rating: "Mixer Rating",
    ratedMaps: "Mapy ze statystykami gracza",
    ratingTrend: "Mixer Rating na kolejnych mapach",
    noRatings:
      "Brak map z ratingiem. Mapy z samym wynikiem nadal liczą się do bilansu.",
    mapHistory: "Historia map",
    map: "Mapa",
    score: "Wynik",
    result: "Rezultat",
    bestTeammates: "Najlepsi współgracze",
    empty:
      "Nie ma jeszcze rozegranych map. Wyniki pojawią się po pierwszym wieczorze.",
    outcome: { win: "Wygrana", loss: "Porażka", draw: "Remis" },
  },
  loading: {
    loading: "Wczytywanie...",
    working: "Zapisywanie...",
    leetify: "Wczytywanie danych Leetify...",
    routes: {
      groups: "Wczytywanie grup...",
      group: "Wczytywanie grupy...",
      mix: "Wczytywanie miksu...",
      profile: "Wczytywanie profilu gracza...",
    },
  },
  showcase: {
    title: "Pokaz: nasz wieczór na popflashu, 16.12.2024",
    notes: [
      "Prawdziwe: nasza dziesiątka, składy, wynik każdej mapy i każda linijka K/A/D/ADR.",
      "Prawdziwy silnik: siła S z historii FACEIT każdego gracza sprzed tamtego wieczoru (ELO dzisiejsze).",
      "Zmyślone: godziny zapisów, głosy (remis 4 : 4 celowo) i kto się spóźnia. Przyciski jeszcze nic nie robią.",
      "Karta Leetify: na żywo, ostatnie 30 dni przed dziś (Leetify nie trzyma meczów z 2024), nic nie zapisujemy.",
    ],
    when: "pon 20:45",
  },
};

export const DICTS: Record<Lang, Dict> = { en, pl };
