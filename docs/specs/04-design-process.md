# Roofy — UX/UI Design Process (self-checking)

**Status:** Draft for review · **Date:** 2026-09-28
**Design system:** `docs/design/DESIGN.md` ("Galvanised").

Goal: the UI is designed, checked and locked **before** backend logic is built, and it cannot drift afterwards.

The owner is **not** a required gate. Quality is enforced by automated checks and independent critic agents that never see the builder's reasoning — only the result, the design system, the spec and reference benchmarks. The owner can look at the preview any time; the only escalation to the owner is when a loop fails to converge (§3).

---

## 1. Steps and gates

| # | Step | Output | Gate (all automatic) |
|---|---|---|---|
| D1 | Brief | `docs/design/brief.md` — users, context (sun, gloves, one hand, patchy signal), tone, UX targets | Critic confirms it matches product spec; no contradictions |
| D2 | Prove the direction | Home + Log crew-day built in **Galvanised** and in one deliberately different challenger direction | Blind A/B by critics; Galvanised must win or be revised (DESIGN.md updated, decision logged) |
| D3 | Design system | Tokens in code + `/design` page showing every component in every state, light + dark | Contrast script passes · design lint passes · critic ≥ 90 |
| D4 | Flows | `docs/design/flows.md` — numbered steps per core job, tap counts, offline behaviour, errors | Every UX target has a flow; each flow becomes a tap-budget test |
| D5 | Clickable prototype | Every screen in the inventory on the fake data layer, all states | Design loop (§2) passes per screen group |
| D6 | Usability | Simulated task runs (tap-budget + time tests) now; real design-partner test before pilot | Tap budgets pass; partner findings fixed before pilot |
| D7 | Lock | Screenshot baselines committed | From here, any visual diff fails CI until fixed or re-run through the loop |

Backend wiring for a screen group starts only after its D5 loop passes.

## 2. The design loop (per screen group)

```
build → run → capture → automated checks → critics → fix → (repeat)
```

1. **Build** the screens from DESIGN.md + flows, with realistic seeded roofing data.
2. **Run** the app (preview build, not dev mode).
3. **Capture** with Playwright: every screen × every state (normal, empty, loading, error, offline/waiting, foreman view) × 3 viewports (iPhone 390×844 WebKit, Android 412×915 Chromium, desktop 1440×900) × light/dark.
4. **Automated checks** — any failure = P0/P1:
   - **Design lint** (`pnpm lint:design`): banned fonts, gradients, purple hues, `uppercase`/`tracking-*` on labels, `→`/`›` in button text, `·`-joined UI strings, non-token colours, Lucide imports, shadow on level-1 surfaces, hard-coded px outside the scale.
   - **Contrast script**: every token pair used in the DOM meets its WCAG ratio.
   - **axe-core**: no serious/critical violations.
   - **Layout guards**: no horizontal overflow at any viewport; all interactive elements ≥ 48 px on phone; nothing hidden under safe areas or the keyboard (checked with an on-screen-keyboard viewport).
   - **Console**: no errors or warnings.
   - **Tap-budget tests**: each core task completed by script within its tap budget (brief UX targets).
5. **Critics** — two fresh subagents, each given only: screenshots, DESIGN.md, the flows, the product spec, and the reference atlas (§4). They score the rubric (§3) and list issues by severity:
   - **Design critic** — senior product designer: craft, hierarchy, consistency, distinctiveness, fidelity to DESIGN.md.
   - **Field critic** — plays a roofing manager at 7 a.m. in a ute and a foreman on a roof in glare with gloves: can they do each task, is the next action obvious, is every word plain?
   The two scores are averaged; either critic's P0/P1 blocks.
6. **Fix** the highest-severity issues first, then repeat from step 2.

**Exit:** average score ≥ 90/100 · zero P0/P1 · all automated checks green.
**Cap:** 6 iterations per screen group. If not converged, stop, log why in `docs/design/loop/DECISIONS.md`, and publish the current screenshots + open issues to the owner as a private link (the only time the owner is asked).

**Severity:** P0 broken (crash, unusable, data wrong) · P1 major (fails a task, fails contrast/target size, breaks layout on a viewport, off-system styling) · P2 moderate (inconsistent spacing, weak hierarchy) · P3 polish.

## 3. Rubric (100 points)

| Criterion | Pts | What earns full marks |
|---|---|---|
| Task efficiency | 25 | Every core task within tap budget; next action always obvious; no dead ends |
| Visual craft & fidelity | 25 | Tokens only; type scale and spacing exact; clear hierarchy; one key number per screen; matches DESIGN.md |
| Field legibility | 15 | Readable in glare (contrast AA+, key figures AAA), 48 px targets, one-thumb reach for primary actions |
| Responsive & platform | 15 | Phone, tablet, desktop, installed mode, safe areas, keyboard, landscape all correct |
| Content & states | 10 | Plain sentence-case words; real roofing data; every state designed (empty, loading, error, offline, foreman) |
| Distinctiveness | 10 | Reads as Roofy, not a template; none of the DESIGN.md §7 tells |

## 4. Reference atlas (benchmarks the critics compare against)

Used for quality bar, not for copying. For each, the critic asks "is ours at least this clear/fast/precise for the equivalent job?"
- **Wise** (DESIGN.md from awesome-design-md) — clarity of money, amounts and statuses.
- **Linear** (DESIGN.md from awesome-design-md) — typographic precision, restraint, density on desktop.
- **Apple Human Interface Guidelines** — touch targets, sheets, tab bars, safe areas, Dynamic Type behaviour.
- **Material 3 guidance** — Android touch and navigation expectations.
- **Things 3** (public screenshots) — calm lists, one primary action, quick entry.

## 5. Usability beyond the machine

- **Simulated:** the tap-budget tests (D6) run on every change.
- **Real people:** before the pilot, the design partner does 5 tasks on their own phone, unassisted (log yesterday's crew; record 120 m² split between two people; pause a job for rain; add a receipt a crew member paid for; find which job is losing money and why). Time, taps and hesitations are recorded; any failure against a UX target is fixed through the loop.

## 6. Records

- `docs/design/loop/ISSUES.md` — open/closed issues with severity and screenshot references.
- `docs/design/loop/DECISIONS.md` — design decisions and why (including D2 outcome).
- `tests/visual/` — approved baselines.

## 7. Quality checklist (every screen, every slice)

- One-handed on a 6.1" phone; primary action in thumb reach.
- Tap targets ≥ 48 px; no hover-only actions.
- Correct keyboard for each field.
- Safe areas respected in installed mode.
- Contrast AA minimum; key figures AAA.
- No layout jump when data loads.
- Every state designed.
- Money figures tap through to their source lines.
- Plain words; no jargon.
- Same component for the same thing everywhere.
