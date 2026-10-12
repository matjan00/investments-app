---
name: Investments (Floor Plan)
description: A couple's portfolio and home-down-payment tracker drawn as a developer-brochure floor plan - ink-navy line work on warm paper, rooms that fill as the savings grow.
colors:
  paper: "#f4f1ea"
  card-paper: "#fbfaf6"
  ink-text: "#1f2433"
  graphite: "#5d6170"
  hairline: "#e0dacd"
  plan-ink: "#2b3a55"
  ink-wash: "#e6e9ef"
  terracotta: "#e07a3f"
  terracotta-wash: "#f8e6d9"
  stone-room: "#e7e2d6"
  sage-gain: "#3d7650"
  sage-wash: "#e2ece1"
  loss-red: "#b3261e"
  loss-wash: "#f6e1de"
  caution-bg: "#f5e8cc"
  caution-text: "#66460c"
  night-paper: "#1a1714"
  night-card: "#221e1a"
  night-text: "#efe9df"
  night-graphite: "#b0a798"
  night-hairline: "#37312a"
  night-ink: "#e6dccb"
  night-terracotta: "#ec8b52"
  night-terracotta-wash: "#3a2a20"
  night-stone-room: "#2c2722"
  night-sage-gain: "#7fbf8f"
  night-loss-red: "#f08a80"
typography:
  display:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "36px"
    fontWeight: 750
    lineHeight: 1.1
    letterSpacing: "-0.02em"
    fontVariation: "wdth 85"
  headline:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "26px"
    fontWeight: 750
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "tnum 1"
  label:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.45
rounded:
  chip: "99px"
  swatch: "2px"
  field: "12px"
  card: "14px"
  tabbar: "18px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "12px"
  lg: "16px"
  xl: "18px"
components:
  button-primary:
    backgroundColor: "{colors.plan-ink}"
    textColor: "{colors.card-paper}"
    rounded: "{rounded.field}"
    padding: "11px 18px"
  button-ghost:
    backgroundColor: "{colors.card-paper}"
    textColor: "{colors.ink-text}"
    rounded: "{rounded.field}"
    padding: "11px 18px"
  card:
    backgroundColor: "{colors.card-paper}"
    textColor: "{colors.ink-text}"
    rounded: "{rounded.card}"
    padding: "18px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-text}"
    rounded: "{rounded.field}"
    padding: "12px 14px"
  chip-filter:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.chip}"
    padding: "7px 14px"
  chip-filter-on:
    backgroundColor: "{colors.plan-ink}"
    textColor: "{colors.card-paper}"
    rounded: "{rounded.chip}"
  tab-active:
    backgroundColor: "{colors.plan-ink}"
    textColor: "{colors.card-paper}"
    rounded: "13px"
---

# Design System: Investments (Floor Plan)

Light values are in the frontmatter; the dark theme (automatic via `prefers-color-scheme`) is the `night-*` set, documented below. Status: the Overview is built in this world and reviewed (verdict: ship). The Goal page is one question at a time (when / how much) with scenarios folded away; History and Activity inherit the tokens but not the plan. All copy is Polish, addressed to the couple in the plural (wy).

## Overview

**Creative North Star: "The Brochure Floor Plan"**

The app is the sales brochure for the flat the couple is saving for, not a trading screen. The Overview opens on a drawn floor plan (five rooms: living room, kitchen, bedroom, bath, hall) that fills with terracotta, room by room and bottom-up, in proportion to saved over target, beside a large "Keys by" date. Portfolio value and today's change are demoted to one line of small type under it. The world is architectural drawing: ink-navy line work on warm paper, flat room fills, hairline rules, a dimension line with condensed numerals.

Everything is flat. No gradients, no glows, no card shadows; depth comes from paper tones (page, card, room) and wall-weight strokes. Colour is rationed by meaning: terracotta means progress toward the home, sage means gains, red means losses and delete only, plan-ink is structure and the one solid control colour.

**Key Characteristics:**
- Warm paper ground, ink-navy structure, terracotta as the single "built so far" accent.
- Figures set narrow (Archivo width axis 85) and tabular, like dimension labels on a plan.
- One signature SVG (the floor plan); everything else is quiet cards, hairline-divided rows and pill chips.
- Phone-first, a single 720px column, floating bottom tab bar (top-centred bar from 900px).
- Light and dark are the same drawing: dark is warm charcoal paper with cream ink, not a blue-black.

## Colors

A restrained two-ink palette on paper: navy line work and one orange fill, with sage and red held back for numbers that mean gain or loss.

### Primary
- **Plan Ink** (#2b3a55; dark #e6dccb, `--ink`/`--accent`): walls, primary buttons, active tab, selected chips and segments, the table highlight cell, the first chart series. In dark it inverts to Cream Ink and `--on-ink` flips to the page colour.
- **Terracotta Fill** (#e07a3f; dark #ec8b52, `--fill`): progress only: room fills, the dimension fill line, progress bars, slider accent, link underlines, focus rings, caret, spinner head. Its wash (#f8e6d9; dark #3a2a20) backs the goal result block and text selection.

### Secondary
- **Sage Gain** (#3d7650; dark #7fbf8f, `--up`): positive change and buy chips; wash #e2ece1 (dark #1c2d22).
- **Loss Red** (#b3261e; dark #f08a80, `--down`): negative change, sell chips, errors, delete links; wash #f6e1de (dark #3a1f1d). Nothing else is red.

### Neutral
- **Warm Paper** (#f4f1ea; dark #1a1714, `--bg`): page ground and input/chip fill.
- **Card Paper** (#fbfaf6; dark #221e1a, `--card`): cards, tab bar, ghost buttons, dialogs, plan windows.
- **Ink Text** (#1f2433; dark #efe9df, `--text`) and **Graphite** (#5d6170; dark #b0a798, `--text-2`): primary and secondary text.
- **Hairline** (#e0dacd; dark #37312a, `--line`): every border and row divider (1px).
- **Stone Room** (#e7e2d6; dark #2c2722, `--room`): empty rooms and progress tracks. The direction contract named #d9d4c7; the build uses this lighter stone.
- **Caution** (bg #f5e8cc / text #66460c; dark #33291a / #f0cf8a): warning banners only.
- **Chart inks** (JS `PALETTE`): #2b3a55 (swapped to the live `--ink` in dark), #e07a3f, #7aa37a, #d2a24c, #7d9ac2, #8e5b7a, #a39b8b, #4f8a8b, #a8553a, #8a8d4f; shared by the allocation donut, holdings swatches and chart lines.

### Named Rules
**The Meaning-Not-Decoration Rule.** Orange = progress toward the home; sage = gain; red = loss or delete. A colour never appears for ornament, and red is never used for emphasis that is not a loss.

**The Flat Paper Rule.** Surfaces are separated by paper tone and 1px hairlines, never by gradient, glow or card shadow.

## Typography

**Display / Body / Label Font:** Archivo (variable, wdth 62-125, wght 400-800, from Google Fonts) with the system sans stack as fallback.

**Character:** One grotesque family doing everything. Headings are heavy and tight; figures switch to the narrow width axis so numbers read as dimension callouts on a drawing.

### Hierarchy
- **Display** (750, 36px, 1.1, -0.02em, wdth 85; 40px in the goal result): the "Keys by" date and the big figures.
- **Headline** (750, 26px, -0.02em): the page title in the top bar; login title 24px.
- **Title** (650, 16px, -0.01em): card headings; dialog headings 19px; slider values 21px.
- **Body** (400-500, 15px, 1.45, tabular numerals): default text; row figures 16px bold.
- **Label** (600, 13px; 12-12.5px sub-lines, 11px chips and tab labels): field labels, secondary lines, the summary line (13.5px), plan dimension text (12.5px, 600, wdth 85).

### Named Rules
**The Dimension-Label Rule.** Money and percentage figures are set at width 85 with tabular numerals (`.num`, `.big`, `.pos-num b`, `.slider-head b`, `.result-sub b`, table cells, legend values).

## Layout

A single centred column: `main` max 720px, 16px gutters, cards stacked with a 12px gap, bottom padding (96px) clears the fixed tab bar. Cards pad 18px (plan card 16px, 20px when wide). Rows are hairline-divided lists with 12px vertical rhythm. Grids use `minmax(0, 1fr)` so long text never widens the page.

Breakpoints: below 380px the allocation stacks; at 640px the plan card becomes two columns (plan 1.25fr, text 1fr) and dialogs become centred modals instead of bottom sheets; at 900px the tab bar moves to a top-centred bar and the header gains top padding to clear it. Tap targets are at least 40px.

## Elevation & Depth

Flat by default. Depth is tonal (page paper, lighter card paper, darker stone) plus stroke weight in the plan (outer wall 6, inner walls 3.5, windows 1.2, door swing dashed 1). The only shadow is the upward shadow under the bottom-sheet dialog (`box-shadow: 0 -8px 30px rgba(20, 24, 34, .18)`) over a `rgba(20, 24, 34, .45)` backdrop. Motion is small: tabs rise 6px over .25s; sheets slide 40px over .22s; room fills grow upward (`scaleY`, .9s, staggered 140ms per room), all guarded by `prefers-reduced-motion`.

### Named Rules
**The No-Glow Rule.** No gradients, glows or card shadows. The dialog sheet shadow is the single exception because it is a floating layer.

## Shapes

Soft-cornered cards over sharp architecture. Cards 14px, fields and buttons 12px, small buttons 10px, tab bar 18px with a 13px active pill, chips and pills fully round (99px), sheets 18px on top corners. Swatches and legend keys are 2px-radius squares; progress bars 3px. Inside the SVG plan, geometry is square-cornered (`stroke-linecap: square`) with only the door swing curved. Borders are always 1px hairline; selected states fill with Plan Ink rather than thickening a border.

## Components

### Buttons
- **Primary:** Plan Ink fill, card-paper text, 12px radius, 11px 18px padding, weight 650; hover brightens 12%; disabled .6 opacity.
- **Ghost:** card-paper fill, 1px hairline border; used for Add purchase (full width, 14px padding, 15.5px) and secondary actions.
- **Small:** 7px 13px, 13.5px, 10px radius. **Icon button:** 40px square, 12px radius, hairline border.
- **Danger link:** text only, Loss Red, 13px, delete only.
- **Link:** bold 14px text with a 2px terracotta underline, 4px offset.
- **Focus:** 2px terracotta outline, 2px offset, on every control.

### Chips & Pills
- **Filter chips:** round, paper fill, hairline border, graphite text; selected = Plan Ink fill with card-paper text.
- **Status chips:** 11px, 650, ink-wash by default; buy = sage wash, sell = loss wash, grey = outlined. Pills carry change values (up/down wash).

### Cards / Containers
- Card Paper, 14px radius, 1px hairline, 18px padding, no shadow. Card headings are space-between with a muted aside.
- **Warning banner:** caution tones, 14px radius, 20px triangle glyph.

### Inputs / Fields
- Paper fill, 1px hairline, 12px radius, 12px 14px padding, 16px text, terracotta caret. Focus: 2px Plan Ink inset outline, fill lifts to card paper. Range sliders use terracotta accent, 30px tall. Segmented control: paper track, selected segment Plan Ink.

### Navigation
- Four-tab bar, card paper with hairline, 18px radius, floating 10px from the bottom; icon above 11px label (21px icons); active tab is a Plan Ink pill. From 900px it is a centred top bar with icon beside 13.5px label.

### Floor Plan (signature)
The Overview hero: an SVG (viewBox 320x214) of a five-room flat. Rooms are Stone Room; a Terracotta Fill rises from each room's floor in sequence, total filled area proportional to saved/target. Navy walls (outer 6, inner 3.5), card-paper windows with navy outline, a dashed door swing, room names at 12px 600 (names on a mostly filled room switch to a fixed dark ink for contrast), and a dimension line beneath with a terracotta segment to the saved amount and saved/target figures at either end. It is the only illustration in the app.

### Dialog (bottom sheet)
Card Paper, 18px top radius, full width to 480px, slides up on phones; actions grid 1fr/2fr with the primary on the larger side.

## Do's and Don'ts

### Do:
- **Do** keep paper, ink and orange as the world: Warm Paper ground, Plan Ink structure, Terracotta only for progress toward the home.
- **Do** set every money figure narrow (wdth 85) and tabular.
- **Do** separate surfaces with tone and 1px hairlines; keep all surfaces flat.
- **Do** keep red for loss and delete only, sage for gain only.
- **Do** keep the plan the headline of the Overview and the portfolio total in small type beneath it.
- **Do** build dark as warm charcoal with cream ink using the `night-*` values, inverting `--ink` and `--on-ink`.

### Don't:
- **Don't** add gradients, glows, coloured card shadows or a glowing portfolio-total hero.
- **Don't** use orange or red as decoration, or add a second progress accent.
- **Don't** use blue-black dark backgrounds, pure #000 or pure #fff.
- **Don't** add more illustration; the floor plan is the single drawn object.
- **Don't** let a second hero figure compete with "Keys by" on the Overview.

## Notes on drift (recorded, not canonized)
- `.plan .room-name.on` hard-codes #1f2433 instead of a token; deliberate for contrast on orange but not a variable.
- The dialog's rgba shadow and backdrop colours are literals, not tokens.
- The Goal page (slider controls, scenario grid, result block) still uses the old structure and will be restructured in a later step; its layout is not part of the world.
- Copy is Polish (pl-PL dates and numbers, plural "wy" voice); amounts never break before "zł" (non-breaking space).
