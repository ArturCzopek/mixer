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
