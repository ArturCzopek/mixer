// UI strings in English (default) and Polish (owner, 2026-09-26). Every user-facing string goes
// through here; `en` defines the shape, `pl` must match it. "Data Provided by Leetify" stays in
// English on purpose (Leetify's required attribution).

export type Lang = "en" | "pl";
export const LANGS: Lang[] = ["en", "pl"];
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
    signOut: "Sign Out",
    siteAdmin: "site admin",
    showcase: "See a Real Mix: 16 Dec 2024",
    source: "source",
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
    voting: (voted: number) => `Voting · ${voted} of 10 voted · waiting for`,
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
    eManual: "No FACEIT account: the group admin's manual ELO",
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
    reroll: "Re-roll Variants",
    proxy: "Vote for Someone",
    reopen: "Reopen Voting",
    result: "Enter Result",
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
    voting: (name: string) => `${name} is late. As tradition demands.`,
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
    signOut: "Wyloguj",
    siteAdmin: "admin strony",
    showcase: "Zobacz prawdziwy miks: 16.12.2024",
    source: "kod",
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
    voting: (voted) => `Głosowanie · zagłosowało ${voted} z 10 · czekamy na`,
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
    eManual: "Brak konta FACEIT: ręczne ELO od admina grupy",
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
    reroll: "Losuj nowe warianty",
    proxy: "Zagłosuj za kogoś",
    reopen: "Otwórz głosowanie",
    result: "Wpisz wynik",
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
    voting: (name) => `${name} się spóźnia. Tradycji musi stać się zadość.`,
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
