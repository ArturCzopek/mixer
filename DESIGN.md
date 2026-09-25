---
name: mixer
description: CS2 10-man mix organizer, built as a 2003 Steam / CS 1.6 VGUI client window
colors:
  olive-ground: "#3a4234"
  olive-window: "#434e3c"
  olive-sheet: "#4a5742"
  olive-well: "#343b2e"
  olive-row: "#3f4838"
  hatch-stripe: "#4a5641"
  bevel-hi: "#7f8d72"
  bevel-lo: "#262a20"
  client-gold: "#dccf6a"
  gold-deep: "#7a6f22"
  pale-text: "#dfe4da"
  dim-text: "#c2cab7"
  alert-rust: "#d8704f"
  white: "#ffffff"
typography:
  display:
    fontFamily: "DejaVu Sans, Tahoma, Verdana, sans-serif"
    fontSize: "64px"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "DejaVu Sans, Tahoma, Verdana, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "DejaVu Sans, Tahoma, Verdana, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: "DejaVu Sans, Tahoma, Verdana, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "tnum"
  meta:
    fontFamily: "DejaVu Sans, Tahoma, Verdana, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "DejaVu Sans, Tahoma, Verdana, sans-serif"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.06em"
rounded:
  none: "0"
spacing:
  hair: "2px"
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
components:
  button:
    backgroundColor: "{colors.olive-sheet}"
    textColor: "{colors.pale-text}"
    typography: "{typography.title}"
    rounded: "{rounded.none}"
    padding: "10px 12px"
  button-primary:
    backgroundColor: "{colors.olive-sheet}"
    textColor: "{colors.client-gold}"
    typography: "{typography.title}"
    rounded: "{rounded.none}"
    padding: "10px 12px"
  button-pressed:
    backgroundColor: "{colors.olive-window}"
    padding: "11px 12px 9px"
  button-disabled:
    textColor: "{colors.dim-text}"
  window:
    backgroundColor: "{colors.olive-window}"
    textColor: "{colors.pale-text}"
    rounded: "{rounded.none}"
    padding: "8px"
  sheet:
    backgroundColor: "{colors.olive-sheet}"
    rounded: "{rounded.none}"
    padding: "8px"
  well:
    backgroundColor: "{colors.olive-well}"
    rounded: "{rounded.none}"
  tab:
    backgroundColor: "{colors.olive-window}"
    textColor: "{colors.dim-text}"
    padding: "6px 4px 4px"
  tab-active:
    backgroundColor: "{colors.olive-sheet}"
    textColor: "{colors.pale-text}"
    padding: "8px 4px 6px"
  badge:
    textColor: "{colors.client-gold}"
    typography: "{typography.label}"
    padding: "2px 6px"
  list-head:
    backgroundColor: "{colors.olive-window}"
    textColor: "{colors.dim-text}"
    typography: "{typography.label}"
    padding: "4px 6px"
  list-row:
    textColor: "{colors.pale-text}"
    padding: "4px 6px"
  list-row-hover:
    backgroundColor: "{colors.olive-row}"
  list-row-selected:
    backgroundColor: "{colors.gold-deep}"
    textColor: "{colors.white}"
---

# Design System: mixer

## Overview

**Creative North Star: "The Server You Join"**

mixer is a 2003-era Steam / Counter-Strike 1.6 VGUI client window: olive panels, one-pixel bevels, sunken list wells, property-sheet tabs and server-browser lists with column headers. It rejects the dark esports dashboard with neon accents and the FACEIT / popflash look. Its lineage is the old client, not the modern platform.

The world is dense and small-typed on purpose. Body type sits at 13px, meta at 11px, and column headers at 10px, all in one humanist sans (DejaVu Sans, from the Verdana and Tahoma family). Depth comes only from bevel edges, never from blur shadows. Gold is the client's highlight colour: it marks key figures, the primary action, focus and the skill bar, and nothing decorative. There is one theme and no light/dark split. The world is olive, and that is deliberate.

Personality lives in copy (status lines and the italic quip under the window). The chrome stays literal: square corners, instant state changes, numbers in fixed positions.

**Key Characteristics:**
- Olive tonal layering: ground < window < sheet for raised surfaces, well below ground for sunken lists.
- 1px two-tone bevels (light top-left, dark bottom-right); inverted for sunken and pressed.
- Zero radius everywhere.
- One gold for key figures and the primary action; one skill ramp for S.
- Small, dense, tabular-numeral type in a single family at weights 400 and 700.
- Instant state changes: no fades and no easing.

## Colors

A low-chroma olive family with bevel-edge tints and one warm gold highlight, tuned so that pale and dim text both clear 4.5:1 on window, sheet and well.

### Primary
- **Client Gold** (client-gold): key figures (win chance, x/10 counter, result score, team labels, formula line), the primary button's label, the skill bar fill, links, the focus outline, and badge text. It is the only accent that draws the eye.
- **Deep Gold** (gold-deep): selection fill. Used for the selected player row (with white text) and `::selection`. Never used as a text colour.

### Tertiary
- **Alert Rust** (alert-rust): the destructive role. It is defined but not yet used on shipped surfaces. Reserve it for destructive or error states only.

### Neutral
- **Olive Ground** (olive-ground): page background and browser theme-color.
- **Olive Window** (olive-window): window bodies, list header rows, inactive tabs, team header strips, the bottom action bar, pressed buttons.
- **Olive Sheet** (olive-sheet): raised content: tab sheets, buttons, the active tab, scrollbar thumb.
- **Olive Well** (olive-well): sunken wells (lists, status line, explanation body, tally cells), inputs, scrollbar track.
- **Olive Row** (olive-row): list row dividers, row hover, and highlight for the scoreboard's top row.
- **Hatch Stripe** (hatch-stripe): the second stripe of the hatch pattern, alternating with olive-window.
- **Bevel Hi** (bevel-hi): light top-left bevel edge and the engraved shadow on disabled button text.
- **Bevel Lo** (bevel-lo): dark bottom-right bevel edge, default border colour, avatar frame, and the primary-foreground role.
- **Pale Text** (pale-text): body text and the second figure of paired readouts.
- **Dim Text** (dim-text): secondary text: meta lines, column headers, inactive tabs, disabled labels, the quip.

### Named Rules
**The Gold Means Look Here Rule.** Gold goes only on a figure or action the user must read or press first: the primary button label, the lead readout, the S bar. If everything on a screen is gold, nothing is.

**The Contrast Floor Rule.** Any new text/background pair keeps at least 4.5:1. Pale and dim text already pass on window, sheet and well. Dim text on olive-row or the hatch stripe is the lower bound; do not add darker surfaces under dim text.

## Typography

**Display Font:** DejaVu Sans (with Tahoma, Verdana, sans-serif), self-hosted via @fontsource at 400 and 700
**Body Font:** DejaVu Sans (same stack)
**Label/Mono Font:** DejaVu Sans Mono (with Lucida Console, monospace), declared but not used on shipped surfaces

**Character:** One Verdana-lineage sans at small, dense sizes, as in the old client. Hierarchy comes from weight (400 / 700), size, and gold versus pale versus dim. It never comes from a second family. Tabular numerals are global, so figures in lists and readouts line up.

### Hierarchy
- **Display** (700, 64px, 1.05, -0.04em): the final result score (maps won A : B) only.
- **Headline** (700, 24px, 1.0, -0.02em): the win-chance readout at the top-left of a variant sheet.
- **Title** (700, 13px): window title bars, button labels, active tab, emphasised figures in rows.
- **Body** (400, 13px, 1.4): list rows, names, explanation terms. Tally figures step up to 16px bold.
- **Meta** (400, 11px): status line, readout captions ("Win chance A : B", "Avg S"), notes, the quip (italic), map score chips. The menu bar sits at 12px.
- **Label** (400, 10px, 0.06em, uppercase): server-browser column headers and hatch badges (badges at 700) only. Team header strips use the same treatment at 11px bold gold.

### Named Rules
**The One Family Rule.** Only DejaVu Sans, at only 400 and 700. Get emphasis from weight and colour. Do not add another face or weight.

**The Uppercase Belongs To Columns Rule.** Tracked uppercase is for list column headers, team group strips and badges: the places the old client used it. Captions on readouts stay in sentence case, in dim 11px.

## Layout

The layout is a single column, phone first. The content column is capped at 460px (520px from the `md` breakpoint, 768px) and centered. There is 8px side padding outside the window. A breadcrumb menu bar (12px) sits above the window. The window holds everything, with a sunken status line at the top of its body. A fixed bottom action bar (olive-window, bevel-hi top edge, safe-area aware) holds two bevelled buttons: a secondary one at flex 1 and the primary at flex 2. Content reserves 76px at the bottom for it.

Spacing is tight and follows a 2px step: 2px (tab gaps), 4px (row padding, badge gaps), 6px (list padding, status line), 8px (window and sheet padding, button gaps), 10px (block separation between wells, button vertical padding), 12px (button horizontal padding). Lists use grids with fixed readout columns. The skill column is 46% of the row. Numbers stay in the same place across states.

## Elevation & Depth

There are no blur shadows. Depth comes from tonal layering plus the 1px two-tone bevel. Raised surfaces (window, sheet, button, tab, chip) use a light top-left edge and a dark bottom-right edge. Sunken wells invert it and drop to olive-well. A pressed button inverts its bevel and shifts its label 1px down-right in the padding, so it sinks the way the old client's did.

### Shadow Vocabulary
- **Engraved disabled text** (`text-shadow: 1px 1px 0 var(--vg-hi)`): only on disabled button labels, the classic etched-out look.

### Named Rules
**The Bevel Is The Shadow Rule.** Elevation is expressed only by bevel direction and olive tone. Raised means a light top-left edge. Sunken means a dark top-left edge on the well colour. Nothing floats.

## Shapes

Every corner is square (radius 0, including shadcn's radius tokens). Borders are always 1px solid: bevel pairs for surfaces, bevel-lo for dividers and avatar frames, olive-row for list rows. Dotted 1px lines separate explanation terms. A dashed 1px bevel-hi square marks an empty lobby slot. The hatch (135deg stripes, 4px each, olive-window / hatch-stripe) is the only pattern. It marks badges and rule conflicts, so they never depend on colour alone. Status indicators are 7px squares, not dots.

## Components

### Buttons
Bevelled and literal: they press in.
- **Shape:** square (0), 1px raised bevel on olive-sheet.
- **Primary:** gold label, bold 13px, 10px 12px padding. One per action bar, at double width.
- **Secondary:** the same button with a pale-text label.
- **Pressed:** the bevel inverts, the background drops to olive-window, and the label nudges down 1px. There is no transition.
- **Focus:** 1px dotted gold outline, offset 2px.
- **Disabled:** dim label with the engraved hi text-shadow and a not-allowed cursor.
- **Labels:** short verb phrases. Title Case like the old client ("Join Mix", "Vote Variant 1", "Upload Demo").

### Chips (badges)
- **Style:** hatch background, gold bold 10px uppercase, tracked 0.06em, 2px 6px padding, no border.
- **Use:** variant properties and rule conflicts only.
- **Map score chip:** a raised bevel on olive-window, 11px, with the winning figure in gold. On a
  played mix the chips (plus an "All maps" chip) double as the scoreboard picker, because they wrap
  for any number of maps where tabs would truncate: the pressed chip inverts its bevel and takes the
  selection fill (gold-deep, white text and figures).
- **No variant badges for duo rules** (D28): the duo rule is explained in the explanation panel instead.

### Cards / Containers
- **Window:** raised bevel on olive-window. The title bar has a bold 13px title at left and an optional gold readout (such as x/10) at right. A bevel-lo line under the title bar and a bevel-hi line over the 8px body.
- **Sheet:** raised bevel on olive-sheet, 8px padding, the tab panel under a tab row.
- **Well:** sunken bevel on olive-well. It holds every list, the status line, the explanation and the tally cells.

### Inputs / Fields
There are no shipped inputs yet. The token wiring maps input to olive-well, so fields are sunken wells with the dotted gold focus outline.

### Navigation
- **Menu bar:** 12px breadcrumb. "mixer" in bold gold, a dim chevron, the group as a pale link (underline on hover), and the user's name plus an 18px avatar at the right.
- **Property-sheet tabs:** equal-width raised tabs with no bottom edge, 2px apart, overlapping the sheet by 1px. The active tab is on olive-sheet, bold and pale, and 2px taller. Inactive tabs are on olive-window with dim text. Vote counts sit in gold inside the tab label. Tab switches are instant.

### Server-Browser List
A well holding a column header row (olive-window, dim 10px uppercase) and 1px olive-row-divided rows at 4px 6px padding. Rows carry a 20px square avatar in a bevel-lo frame, the name, a dim level, and the skill bar. Tappable rows turn olive-row on hover and gold-deep with white text when selected. Team groups get an olive-window strip with a bold gold uppercase 11px label and the team average in pale at the right.

Player order: lobby and locked lineup list players in **join order** (D28); variant tabs sort each
team by S. Scoreboards group rows by team, sorted by Mixer Rating, the evening's best row on olive-row.

### Skill Bar
S is always rendered with the same bar: a 7px track (bevel-lo at 40%) with a gold fill scaled linearly from 800 to 2300 (never under 4% wide), and a 2.6rem right-aligned bold figure. The fill turns white on a selected row. The bar has no other colour, scale or shape.

### Status Line
A sunken well at 11px dim, led by a 7px square indicator: gold while the mix is live (open, voting), dim once locked or played.

## Do's and Don'ts

### Do:
- **Do** build every surface from Window, Sheet, Well, Tabs, VButton, ListHead, Badge and SkillBar before adding anything new.
- **Do** express raised and sunken with the 1px bevel pair (bevel-hi top-left / bevel-lo bottom-right, inverted for wells and pressed buttons).
- **Do** render every S value with the one SkillBar ramp (min 800, max 2300, gold fill).
- **Do** keep focus as the 1px dotted gold outline offset 2px.
- **Do** mark conflicts and badges with the hatch plus text, never with colour alone.
- **Do** keep humour in status and quip copy (11px dim italic under the window). Keep data, labels and actions plain.
- **Do** use lucide-react line icons sparingly at 12-14px, in dim or the surrounding text colour, always aria-hidden next to a text label.

### Don't:
- **Don't** round any corner. The radius is 0 everywhere.
- **Don't** use blur shadows, glows, gradients (other than the hatch) or neon. The world has none.
- **Don't** fade, slide or ease state changes. Tabs switch and buttons sink instantly.
- **Don't** add a light theme or a second palette. The world is one olive theme.
- **Don't** introduce a second typeface or weights beyond 400 and 700.
- **Don't** use gold for decoration or body copy. It marks the lead figure and the primary action.
- **Don't** put small tracked uppercase captions above headings or readouts. Uppercase is reserved for column headers, team strips and badges.
