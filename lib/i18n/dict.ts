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
    lockedBefore: "Voting closed ·",
    lockedAfter: "won",
    played: (maps: number, source: string) =>
      `Played · ${maps} maps · result from ${source}`,
  },
  lists: {
    playerJoinOrder: "Player · join order",
    player: "Player",
    tapForDetails: " · tap for details",
    skill: "Skill S",
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
    notAnswering: (name: string) =>
      `Leetify is not answering for ${name} right now.`,
    none: (span: string) => `No FACEIT matches ${span}.`,
    matches: (span: string) => `FACEIT matches ${span}`,
    wl: (w: number, l: number) => `${w} W ${l} L`,
    win: "W",
    loss: "L",
    kad: "K/A/D",
    liveNotStored: "live from Leetify, not stored",
    resultsAria: "Results, newest first",
    date: "Date",
    map: "Map",
    score: "Score",
    rating: "Leetify Rating",
    placeholder: (name: string) =>
      `No FACEIT in 30 days. ${name} is either touching grass or secretly grinding Premier.`,
    more: (n: number) => `and ${n} more on Leetify`,
  },
  explain: {
    title: "How was this calculated?",
    eName: "FACEIT ELO",
    eNote: (level: number) =>
      `${level ? `Level ${level}, ` : ""}live from FACEIT`,
    eManual: "FACEIT ELO missing: the group admin's manual ELO",
    eMixMean: "Fallback: mean ELO of the other players in this mix",
    eNeutral: "No sourced ELO in the lineup: neutral default of 1500",
    eSwapSlot: (steamId: string) =>
      `Keeps the approved slot's skill; inherited from ${steamId}`,
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
  },
  locked: {
    won: (n: number) => `Variant ${n} won`,
    tie: (votes: number, others: string) =>
      `${votes} : ${votes} tie with Variant ${others}, drawn at random`,
    and: " and ",
    ofVotes: (v: number) => `${v} of 10 votes`,
    howToPlay: "How to play",
    steps: [
      "Everyone joins the group's FACEIT Club queue.",
      "Captains pick exactly this lineup. No freelancing.",
      "No FACEIT tonight? An admin types in the score afterwards.",
    ],
    realTitle: "What you really played on 16.12.2024",
    realText: (odds: string, rank: number) =>
      `A different split: ${odds} on paper, rank ${rank} of 126 by evenness. The Result tab shows how that went.`,
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
    mapsWon: "Maps won, Team A : Team B",
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
  },
  quips: {
    lobby: "Last one in brings the energy drinks.",
    balancing: "Ten players in. Time to see how the teams shake out.",
    voting: (name: string) => `${name} is late. As tradition demands.`,
    votingReady: "The lineups are ready. Voting opens soon.",
    locked: "Teams are final. Complaints go to the algorithm.",
    carried: (name: string) =>
      `${name} carried. Screenshots or it didn't happen.`,
    paper: (mvp: string, worst: string) =>
      `${mvp} did the job. ${worst} was only strong on paper tonight.`,
    boring: (name: string) =>
      `${name} top-fragged, exactly as the algorithm predicted. Boring, but correct.`,
  },
  actions: {
    share: "Share",
    join: "Join Mix",
    vote: (n: number) => `Vote Variant ${n}`,
    yourVote: (n: number) => `Your Vote: Variant ${n}`,
    moveVote: (n: number) => `Move Vote to Variant ${n}`,
    faceitClub: "FACEIT Club",
    uploadDemo: "Upload Demo",
    fullScoreboard: "Full Scoreboard",
  },
  groups: {
    switcher: "Groups",
    none: "No groups yet.",
    newGroup: "New Group",
    name: "Name",
    slug: "Page address",
    slugHint:
      "3 to 40 characters: lowercase letters, digits and dashes, no dash at either end. Capitals and spaces are fixed as you type. It cannot be changed later.",
    slugPreview: "Your group’s page:",
    faceitClub: "FACEIT Club link (optional)",
    create: "Create Group",
    settings: "Group settings",
    save: "Save",
    saved: "Saved.",
    club: "FACEIT Club",
    noClub: "No FACEIT Club linked yet.",
    members: (n: number) => `Members · ${n}`,
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
      "100–5000, used only when FACEIT ELO is missing. Leave blank to clear. Applies to this group only.",
    faceitUnavailable:
      "Player saved. FACEIT is unavailable; add the same Steam profile again to retry linking it.",
    errors: {
      steam: "Enter a valid SteamID64, Steam profile URL or vanity name.",
      notFound: "Steam did not return this player. Check the profile address.",
      steamUnavailable: "Steam is unavailable. Try again shortly.",
      closed:
        "This membership is closed. Reopening memberships is not available yet.",
      elo: "Enter a whole number from 100 to 5000, or leave blank.",
      unauthorized: "Log in with Steam first.",
      forbidden: "Only group admins can manage the roster.",
      failed: "Could not save the player. Try again.",
    },
  },
  lobby: {
    lobby: "Lobby",
    mixList: "Mixes",
    noMixes: "No mixes yet. Make one and get the crew in.",
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
      notOpen: "Sign-ups are closed for this mix.",
      notFull: "Ten players must join before balancing starts.",
      stale: "This mix changed in another browser and has been refreshed.",
      noVariants: "Generate or refresh the three variants before continuing.",
      unauthorized: "Sign in through Steam first.",
      forbidden: "You cannot do that for this group.",
      failed: "Could not update this mix. Try again.",
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
    lockedBefore: "Głosowanie zamknięte ·",
    lockedAfter: "wygrał",
    played: (maps, source) =>
      `Rozegrany · ${maps} ${plural(maps, "mapa", "mapy", "map")} · wynik z ${source}`,
  },
  lists: {
    playerJoinOrder: "Gracz · kolejność zapisów",
    player: "Gracz",
    tapForDetails: " · kliknij po szczegóły",
    skill: "Siła S",
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
    notAnswering: (name) => `Leetify nie odpowiada teraz dla gracza ${name}.`,
    none: (span) => `Brak meczów FACEIT ${span}.`,
    matches: (span) => `meczów FACEIT ${span}`,
    wl: (w, l) => `${w} W ${l} P`,
    win: "W",
    loss: "P",
    kad: "K/A/D",
    liveNotStored: "na żywo z Leetify, nie zapisujemy",
    resultsAria: "Wyniki, od najnowszego",
    date: "Data",
    map: "Mapa",
    score: "Wynik",
    rating: "Leetify Rating",
    placeholder: (name) =>
      `Zero FACEIT od 30 dni. ${name} albo dotyka trawy, albo po cichu grinduje Premiera.`,
    more: (n) => `i jeszcze ${n} na Leetify`,
  },
  explain: {
    title: "Jak to policzyliśmy?",
    eName: "ELO FACEIT",
    eNote: (level) => `${level ? `Poziom ${level}, ` : ""}na żywo z FACEIT`,
    eManual: "Brak ELO FACEIT: ręczne ELO od admina grupy",
    eMixMean: "Zapasowe: średnia ELO pozostałych graczy w tym miksie",
    eNeutral: "Brak ELO w składzie: neutralna wartość 1500",
    eSwapSlot: (steamId) =>
      `Zachowano siłę zatwierdzonego miejsca w składzie; dane gracza ${steamId}`,
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
  },
  locked: {
    won: (n) => `Wygrał wariant ${n}`,
    tie: (votes, others) =>
      `remis ${votes} : ${votes} z wariantem ${others}, rozstrzygnięty losowo`,
    and: " i ",
    ofVotes: (v) => `${v} z 10 głosów`,
    howToPlay: "Jak gramy",
    steps: [
      "Wszyscy wchodzą do kolejki klubu grupy na FACEIT.",
      "Kapitanowie wybierają dokładnie ten skład. Bez samowolki.",
      "Dziś bez FACEIT? Admin wpisze wynik po meczu.",
    ],
    realTitle: "Co naprawdę zagraliście 16.12.2024",
    realText: (odds, rank) =>
      `Inny podział: ${odds} na papierze, ${rank}. miejsce na 126 pod względem wyrównania. Jak to się skończyło, widać w zakładce z wynikiem.`,
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
    mapsWon: "Wygrane mapy, drużyna A : drużyna B",
    scoreboardFor: "Tabela dla",
    allMaps: "Wszystkie mapy",
    realNote: "Prawdziwy skład i wynik z 16.12.2024, nie wariant z głosowania.",
    mapLine: (map, a, b, team, rounds) =>
      `${map} · ${a} : ${b} · wygrała drużyna ${team} · ${rounds} rund`,
    allLine: (maps, rounds) =>
      `Wszystkie ${maps} ${plural(maps, "mapa", "mapy", "map")} · ${rounds} rund · ADR i MR ważone rundami`,
    mr: "Mixer Rating",
  },
  quips: {
    lobby: "Ostatni zapisany stawia energetyki.",
    balancing: "Dziesiątka zebrana. Zobaczmy, jak wyjdą składy.",
    voting: (name) => `${name} się spóźnia. Tradycji musi stać się zadość.`,
    votingReady: "Składy są gotowe. Głosowanie pojawi się wkrótce.",
    locked: "Składy zamknięte. Reklamacje do algorytmu.",
    carried: (name) =>
      `${name} wyniósł drużynę na plecach. Screeny albo nie było.`,
    paper: (mvp, worst) =>
      `${mvp} zrobił robotę. ${worst} był dziś mocny tylko na papierze.`,
    boring: (name) =>
      `${name} najlepszy, dokładnie jak przewidział algorytm. Nudne, ale poprawne.`,
  },
  actions: {
    share: "Udostępnij",
    join: "Dołącz",
    vote: (n) => `Głosuj na wariant ${n}`,
    yourVote: (n) => `Twój głos: wariant ${n}`,
    moveVote: (n) => `Przenieś głos na wariant ${n}`,
    faceitClub: "Klub FACEIT",
    uploadDemo: "Wrzuć demo",
    fullScoreboard: "Pełna tabela",
  },
  groups: {
    switcher: "Grupy",
    none: "Nie masz jeszcze grup.",
    newGroup: "Nowa grupa",
    name: "Nazwa",
    slug: "Adres strony",
    slugHint:
      "Od 3 do 40 znaków: małe litery, cyfry i myślniki, bez myślnika na końcach. Wielkie litery, spacje i polskie znaki poprawiamy przy wpisywaniu. Później nie da się go zmienić.",
    slugPreview: "Strona grupy:",
    faceitClub: "Link do klubu FACEIT (opcjonalnie)",
    create: "Utwórz grupę",
    settings: "Ustawienia grupy",
    save: "Zapisz",
    saved: "Zapisano.",
    club: "Klub FACEIT",
    noClub: "Brak podpiętego klubu FACEIT.",
    members: (n) => `Członkowie · ${n}`,
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
      "100–5000, używane tylko przy braku ELO FACEIT. Puste pole usuwa wartość. Dotyczy tylko tej grupy.",
    faceitUnavailable:
      "Gracz zapisany. FACEIT jest niedostępny; dodaj ten sam profil Steam ponownie, aby ponowić powiązanie.",
    errors: {
      steam:
        "Podaj poprawne SteamID64, link do profilu Steam lub własną nazwę z adresu profilu.",
      notFound: "Steam nie zwrócił tego gracza. Sprawdź adres profilu.",
      steamUnavailable: "Steam jest niedostępny. Spróbuj za chwilę.",
      closed:
        "To członkostwo jest zamknięte. Ponowne otwieranie nie jest jeszcze dostępne.",
      elo: "Podaj liczbę całkowitą od 100 do 5000 lub zostaw puste pole.",
      unauthorized: "Najpierw zaloguj się przez Steam.",
      forbidden: "Składem mogą zarządzać tylko admini grupy.",
      failed: "Nie udało się zapisać gracza. Spróbuj ponownie.",
    },
  },
  lobby: {
    lobby: "Lobby",
    mixList: "Miksy",
    noMixes: "Nie ma jeszcze miksów. Utwórz jeden i zbierz ekipę.",
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
      notOpen: "Zapisy do tego miksu są zamknięte.",
      notFull: "Do rozpoczęcia podziału składów potrzeba dziesięciu graczy.",
      stale: "Miks zmienił się w innej przeglądarce i został odświeżony.",
      noVariants: "Wygeneruj trzy warianty albo odśwież stronę.",
      unauthorized: "Najpierw zaloguj się przez Steam.",
      forbidden: "Nie możesz wykonać tej czynności w tej grupie.",
      failed: "Nie udało się zmienić miksu. Spróbuj ponownie.",
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
