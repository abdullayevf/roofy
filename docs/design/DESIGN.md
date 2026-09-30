# Roofy — DESIGN.md ("Galvanised")

The single source of truth for how Roofy looks and feels. Read this before building or changing any screen. Format follows the DESIGN.md convention (theme · colour · type · components · layout · depth · do/don't · responsive · agent guide).

---

## 1. Visual theme and atmosphere

**Roofy is a site tool, not a SaaS dashboard.** It should feel like the good gear in a roofer's ute: a steel tape, a chalk line, a sheet of Colorbond — plain, tough, precise, readable in full sun, operable with one gloved thumb.

- **Materials we borrow from:** galvanised/zincalume steel (the page), Colorbond Monument charcoal (the ink), builder's chalk-line blue (actions), steel-tape yellow (marks and measurements).
- **Mood:** calm and certain. Numbers are the heroes; chrome stays quiet.
- **The one memorable thing:** measurement. Big, confident signage numerals for money and quantities, and the **tape progress bar** — stage progress drawn as a steel tape with tick marks. Everything else is disciplined and quiet.
- **Not:** hazard stripes, hard-hat clip-art, orange-and-black "construction template", cream-and-terracotta, dark-mode-with-acid-green, gradient washes, glassmorphism, card grids.

## 2. Colour palette and roles

Contrast ratios verified (WCAG 2.1). Status colour is never the only signal: always paired with an icon or words.

### Light (default)
| Token | Hex | Role | Contrast |
|---|---|---|---|
| `galv` | `#EDEFED` | Page background (zincalume) | — |
| `surface` | `#FFFFFF` | Lists, sheets, inputs | — |
| `ink` | `#2F3133` | Primary text, icons (Monument) | 11.3 on galv · 13.1 on surface |
| `ink-2` | `#5A605C` | Secondary text | 5.6 on galv · 6.4 on surface |
| `line` | `#D5DAD6` | Dividers between rows (decorative) | — |
| `edge` | `#7D8580` | Input and control borders | 3.8 on surface · 3.3 on galv |
| `chalk` | `#1F4FB5` | Primary actions, links, focus ring | 7.4 white-on-chalk · 6.4 on galv |
| `tape` | `#FFC82C` | Marks: selected crew, today, tape bar fill (always with `ink` text/outline) | ink on tape 8.4 |
| `over` | `#C62D1F` | Over budget, errors, destructive | 5.5 on surface · 4.8 on galv |
| `over-fill` | `#C62D1F` | Filled destructive button (confirmation dialogs only), white text | 5.5 white-on-fill |
| `bar` | `#2F3133` | Offline banner and toast background, `surface` text | 13.1 |
| `watch` | `#8A5300` | Trending over, warnings (text); fill uses `tape` | 6.3 on surface |
| `good` | `#256B40` | On track, sent, done | 5.6 on galv |

### Dark
| Token | Hex | Contrast |
|---|---|---|
| `galv` | `#1F2224` | — |
| `surface` | `#2A2E30` | — |
| `ink` | `#ECEEEC` | 13.7 on galv |
| `ink-2` | `#A9B0AC` | 6.2 on surface |
| `line` | `#3A3F42` | — |
| `edge` | `#7A827E` | ≥ 3.0 on surface |
| `chalk` (button fill) | `#3563CC` (white text 5.5) · links `#8FB0FF` (6.4) | |
| `tape` | `#FFC82C` (galv text on tape 10.3) | |
| `over` | `#FF8A7A` (6.0) · `watch` `#FFC82C` · `good` `#6FCF97` (7.2) | |
| `over-fill` | `#C62D1F` (white text 5.5) — `#FF8A7A` is for text only, never a fill under text | |
| `bar` | `#454B4E` (`ink` text 7.5) — a raised grey, not near-white | |

Dark mode is elevation-by-lightness (surfaces get lighter as they rise), no shadows.

## 3. Typography

| Role | Family | Weights | Why |
|---|---|---|---|
| Numbers, headings, tab labels | **Barlow Semi Condensed** | 500, 600, 700 | Descended from highway signage: industrial, legible at a distance, condensed so big figures fit a phone. Tabular figures (`tnum`) verified. |
| Body, inputs, buttons, lists | **Atkinson Hyperlegible Next** | 400, 600 | Designed for maximum character distinction (0/O, 1/l/I) — exactly what matters in sun glare and for ABNs, phone numbers, quantities. `tnum` verified. |

Both free (Google Fonts, OFL), self-hosted via `next/font`, subset to Latin.

**Scale (phone → desktop)**
| Style | Font | Size / line | Use |
|---|---|---|---|
| `figure-xl` | Barlow SC 700 | 40/44 → 48/52 | The one key number on a screen (e.g. this week's labour cost) |
| `title` | Barlow SC 600 | 28/32 → 32/36 | Screen titles |
| `heading` | Barlow SC 600 | 20/24 | Section headings, sheet titles |
| `figure` | Barlow SC 600 | 20/24 | Row amounts, quantities |
| `body` | Atkinson 400 | 17/24 → 16/24 | Default text |
| `body-strong` | Atkinson 600 | 17/24 → 16/24 | Row primary text, button text |
| `meta` | Atkinson 400 | 15/20 → 14/20 | Secondary text, timestamps (never smaller) |

Rules: all money, quantities, hours and dates in tables use `font-variant-numeric: tabular-nums`, right-aligned. Sentence case everywhere — no all-caps labels, no letter-spaced eyebrows. Money: `$1,432.50`; negative `−$300.00` (true minus). Units: `120 m²`, `80 lm`, `7.5 h`, `½ day`. Dates: `Mon 7 Sep`; with year only when not the current year.

## 4. Components

- **Button** — 52 px tall on phone (48 desktop), radius 6, Atkinson 600 17 px. Primary = `chalk` fill, white text. Secondary = `surface` + 1.5 px `edge` border, `ink` text. Destructive = `over` text on surface; filled (`over-fill`, white text) only in confirmation dialogs. Labels are verbs: "Save day", "Pause stage", "Approve pay run". No trailing arrows.
- **Input** — 52 px, radius 6, 1.5 px `edge` border, label above (never placeholder-only), correct `inputmode`. Focus: 3 px `chalk` ring outside the border. Error: `over` border + message below saying how to fix.
- **Stepper** (hours, days) — − / value / + with 52 px buttons; hours step 0.25, days toggle 1 / ½.
- **Selection** — one treatment everywhere: a selected segment, day toggle option, choice chip or crew check is `tape` fill with `ink` text and a check. `chalk` is only for actions and focus, never for "selected". Segmented controls are full width on phone.
- **Date rule** (Log) — the date sits above a 1.5 px `ink` rule that the `chalk` line draws along once the day is saved; a rule, not a faint divider, so it reads in glare.
- **Crew chip** (crew-day grid) — full-width row on phone (two columns from 600 px to 1023 px, §8): name, usual basis ("Day", "Hourly", "m²") and a large check area. Untapped = an empty check box with a 1.5 px `ink` border (readable in glare). Tapped = the check box in `tape` fill with an `ink` check and the whole row tinted `tape`; the whole row is the target. It's the mark a foreman makes on a list.
- **Tape bar** (progress) — 12 px tall steel-tape track (`surface` with 1 px `ink` outline), `tape` fill, `ink` tick marks every 10% (taller at 50%). The % is always also printed as text beside it, in a fixed-width slot (sized to "100% done") so every track is the same length and ticks line up between rows. Over-budget stages show a marker at the forecast point (`watch` when trending over, `over` when actually over), not a red bar. A forecast past 100% cannot sit on the track, so the marker sits just beyond the end cap, joined to it by a short bar in its colour, further out the bigger the overrun (to a fixed maximum); the exact figure is in the sentence below. The marker's caption is its own row under the track, never inside the marker.
- **Status chip** — pill, icon + word: Active (chalk), Paused (watch, pause icon + reason), Done (good), Not started (ink-2).
- **Money cell** — right-aligned `figure`; drill-in affordance on tap (whole row is the target).
- **List row** — 64 px min on phone, primary text left, figure right, meta below primary. The right column (figure or chip, and the chevron) is fixed: it never wraps or moves, only the label wraps; chip and chevron are vertically centred on the row, and a figure with a status line beneath it lines up with the label's first line. Groups of rows sit on one `surface` block with `line` dividers (iOS-style grouped list), not separate cards.
- **Bottom sheet** (phone) / **dialog** (desktop) — same content component; sheet has 12 px top radius, grabber, primary action pinned above the home bar. A sheet with more content than fits shows a "More below" strip above its pinned action. Every sheet and dialog with a form or choices has a 48 px borderless ink close (X) at top right, on phone and desktop. A confirmation ("Discard this entry?") is a bottom sheet on phone and a dialog on desktop, closes with its Cancel button instead of an X, and uses the same 448 px width as other dialogs.
- **Navigation** — Phone: bottom tab bar (Home · Jobs · **Log** · Crew · More) with Log as the raised `chalk` circle in the middle; Foreman: Home · Jobs · **Log** · Outbox (four equal tabs, Log raised in place; the desktop sidebar lists the same order); Accountant: Home · Pay · Reports · More (no Log, no raised circle). Desktop ≥ 1024: left sidebar 240 px, same items. The active item is a filled icon on a `galv` background with a 4 px `ink` edge bar — never a chalk fill (chalk is for actions and focus). The active phone tab is a filled icon with `chalk-link` text (the raised Log too). Only the bar actually fixed at the bottom pads for the home-bar inset.
- **Outbox badge** — small `tape` pill with count ("3 to send") at top of screen when entries are waiting; when one has failed it becomes an `over`-outlined pill with a warning icon ("1 needs attention"), which wins over the waiting count. On Home it sits inline beside the title, elsewhere on its own row above the page. Tap opens Outbox.
- **Offline banner** — slim `bar` strip (`ink` in light, a raised grey in dark), left-aligned: "No signal — entries are saved on this device and will send automatically."
- **Needs-attention item** — row with severity icon (over / watch), one-line plain sentence ("Smith job is $775 over on sheet install"), tap-through.
- **Empty state** — one sentence of direction + the action button ("No jobs yet. Add your first job."). No illustrations.
- **Skeleton** — `line`-coloured blocks sized exactly like the content; no shimmer.
- **Icons** — Phosphor (Regular 24 px in UI, Fill for active tab). Every icon-only button has a text label for screen readers and ≥ 48 px target.

## 5. Layout principles

- Spacing scale (px): 4, 8, 12, 16, 20, 24, 32, 40, 56. Phone gutters 16; desktop 24–32.
- Phone: single column, title top-left, key figure directly under the title, lists below. Primary action bottom, in thumb reach. Long forms (Log crew-day) pin their primary action above the tab bar: a bar fixed above the tab bar's box, safe-area aware, always visible, with the content padded so the last row is never hidden. From 1024 px the action sticks to the bottom of the form column.
- Desktop ≥ 1024: sidebar + content (max 1200 px); list/detail split where it helps (Jobs, Crew, Pay runs). Tables allowed on desktop only; phone uses rows.
- Alignment: left-aligned text; numbers right-aligned; nothing centred except empty states.
- Density: phone generous (64 px rows); desktop tighter (48 px rows), same components.

## 6. Depth and elevation (light)

| Level | Use | Treatment |
|---|---|---|
| 0 | Page | `galv` |
| 1 | Lists, panels | `surface`, radius 8, 1 px `edge` outline, no shadow |
| 2 | Sheets, menus, popovers | `surface`, radius 12 (sheets top only), shadow `0 8px 24px rgb(31 34 36 / 0.18)` |
| 3 | Toasts | `bar` background, `surface` text (`ink` in dark), shadow `0 12px 32px rgb(31 34 36 / 0.28)` |

Radius hierarchy is deliberate: controls 6, groups 8, sheets 12 (top only), chips full. Not one radius for everything.

## 7. Do's and don'ts

**Do**
- Lead each screen with the one number that matters.
- Use real roofing content everywhere, including prototypes (Smith job, Ryde re-roof, sheet install, 120 m²).
- Keep one primary action per screen.
- Show where every dollar came from (tap through).
- Write plain verbs in sentence case: "Log today", "Same as yesterday", "Pause for weather".

**Don't** (these are the tells of generated UI — the design lint checks for many of them)
- Inter, Roboto, Arial, Space Grotesk, Geist, system-ui as the brand font.
- Purple/violet anything; gradient backgrounds or text; glass blur.
- Cream `#F4F1EA`-style backgrounds with terracotta `#D97757`-style accents.
- Near-black with acid-green/vermilion accent.
- Grids of identical rounded cards with the same soft grey shadow.
- ALL-CAPS or letter-spaced eyebrow labels; "01 / 02 / 03" markers on non-sequences.
- Monospace for data labels (we have tabular figures).
- "→" or "›" appended to button/link text; "·"-joined meta strings in the UI.
- Accenting one word in a heading with colour/italic.
- Entrance animations on scroll; hover effects on every card; shimmer loaders.
- Emoji as icons; illustrations in empty states; hazard stripes.
- Jargon: "entity", "sync", "mutation", "record" (as a noun for a row of data; the verb in "Record payout" and the screen name "Record history" are fine), "submit".

## 8. Responsive and platform behaviour

- Breakpoints: `< 600` phone · `600–1023` large phone/tablet (phone layout, wider content, 2 columns only for crew grid) · `≥ 1024` desktop.
- Touch targets ≥ 48 × 48 px, 8 px apart.
- Installed-app mode (`display: standalone`): respect `env(safe-area-inset-*)`; status bar `theme-color` = `galv`; no browser-only UI assumptions.
- Keyboard: correct `inputmode` (decimal for m², numeric for hours, tel for phone); sheet content scrolls above the keyboard; primary action stays visible.
- Supports landscape phone (content reflows, no locked orientation).
- Respects `prefers-reduced-motion`, `prefers-color-scheme` (user can override in settings), text zoom up to 200% without horizontal scroll.
- Desktop: full keyboard operation of the crew-day grid (arrows, space to tick, Enter to save).

## 9. Motion

Only in answer to an action: sheet open/close (220 ms, ease-out, spring on phone), row check (120 ms), toast (180 ms). **One signature moment:** saving a crew-day — ticked chips fold into one "Logged" line while a chalk-line stroke snaps under the date (≤ 400 ms). Nothing animates on load or scroll. Reduced motion → instant.

## 10. Agent guide

Before building a screen: read §1–§8 and the screen's flow in `docs/design/flows.md`. Use only tokens from `src/app/tokens.css` (generated from this file). After building: run the design loop (`docs/specs/04-design-process.md`) — screenshots at 390×844 (WebKit), 412×915 (Chromium), 1440×900; light and dark; critic review; design lint.

Quick tokens: page `#EDEFED` · surface `#FFFFFF` · ink `#2F3133` · ink-2 `#5A605C` · edge `#7D8580` · chalk `#1F4FB5` · tape `#FFC82C` · over `#C62D1F` · watch `#8A5300` · good `#256B40`. Fonts: Barlow Semi Condensed (numbers/headings), Atkinson Hyperlegible Next (text).
