---
version: 1
slug: "app-g-slug-mix-id-page-tsx"
primary_target: "app/g/[slug]/mix/[id]/page.tsx"
related_targets: []
---

# Mix page (surface brief)

Scope: the mix page `/g/[slug]/mix/[id]` in every state (open lobby → voting on variants → locked → played); first surface of the app, sets the world for all others. Mode: **Operate**. Phone first (players check it during the day), works on desktop.

Audience/job: players join, compare 3 variants, see *why* each split is fair, vote; group admins run the flow. Constraints: never assume FACEIT data; Mixer Rating naming; English UI; relaxed in-group humor in copy only.

## Direction contract

THESIS: The mix is a server you join. The page is a 2003 Steam/CS 1.6 VGUI window, olive and bevelled, not a dark esports dashboard with neon, and not a FACEIT/popflash clone.

OWN-WORLD: Olive panels (#3e4637 ground, #4c5844 window, #5a6a50 sheet), 1-px bevels (light top-left #8c9a7e, dark bottom-right #292e23), sunken list wells, gold #c4b550 for key figures and the primary action, pale #d8ded3 text. DejaVu Sans (Verdana/Tahoma lineage) at small, dense sizes; property-sheet tabs; server-browser lists with column headers; hatch pattern marks rule conflicts and badges. One skill ramp: S always as the same gold bar.

STORY: Visitor sees in one glance how many are in (x/10), what state the mix is in, which variant leads and why each team is fair; they join or vote with a thumb.

FIRST VIEWPORT: Title bar "Mix #N · Day HH:MM" with the x/10 counter at right; sunken status line; variant tabs with vote counts; win chance A:B in gold at the top-left of the sheet, avg S at right; roster table grouped Team A / Team B with S bars; sticky bottom bar with bevelled buttons, primary action gold ("Join" / "Vote Variant N").

FORM: Olive VGUI (Steam/CS 1.6 era client), position 3 of 7 on the grounded list, seed 1ab56e1d. Raises: one S ramp (star atlas), hatch for conflicts (darkroom), fixed readout positions (viewfinder). Signature interaction: pressing a bevelled button inverts its bevel (sinks) like the old client; tab switch is instant, no fades.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Shipped played-map demo presentation

This section records the implemented played state. It extends the surface brief without changing the CS 1.6/VGUI system above. The existing All maps / map picker, result score, map artwork, and score styling remain ahead of the demo content. For a selected map with an attached demo, equal-width property-sheet tabs switch instantly between Scoreboard and Rounds; the Rounds label includes the parsed round count. The scoreboard is the initial view for each map.

- **Scoreboard:** two semantic team tables sit side by side from `lg` and stack on narrower screens. Each keeps its own column header and team group header. Rows sort by Mixer Rating within each team, preserve aligned numeric columns, and show K, A, D, ADR, KAST when available, and MR. A player's expansion opens an in-table well with aligned label/value pairs under Combat, Clutches and multikills, and Utility. The numeric values use tabular figures; the best row gets the established olive-row fill, while MR values at or above 1 use gold.
- **Rounds:** a sunken well groups consecutive rounds by parsed phase and actual team-side changes. Regulation halves are named only when a side change is present; overtime can form further segments. Each group shows its round range and a compact selectable grid, six columns on phones and twelve from `sm`. Every round cell shows its number and winning team. The selected cell uses the existing deep-gold selection fill and controls a separate detail well.
- **Selected round:** the detail well identifies the round winner and its section, shows the cumulative A:B score through that round, then lists opening kill, clutch, and multikill events when supplied. A dim empty message appears when none are present. The selection and details are connected with `aria-controls`; the detail well announces changes politely.
- **Import:** when a map has no attached demo and the viewer can attach one, the import starts as a collapsed disclosure after the played-map content. Its expanded preview uses the same well and table language. It does not compete with the result or scoreboard in the default view.

The desktop and phone evidence is `.impeccable/review/demo-redesign-scoreboard-desktop.png`, `demo-redesign-rounds-desktop.png`, and `demo-redesign-rounds-mobile.png`. The illustrated selected match is Anubis, 19:15 over 34 rounds; those figures are fixture content, not layout or design tokens. The captured screenshots display Polish localization while the component structure and visual rules remain the same.
