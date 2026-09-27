# Roofy — UX/UI Design Process

**Status:** Draft for review · **Date:** 2026-09-28
Goal: the UI is designed, tested with real people and approved **before** backend logic is built, and it cannot drift afterwards.

Nothing in this process is "Claude says it looks fine". Every step ends with something the owner **sees on their own phone** and approves, or a check a machine runs.

---

## Gates at a glance

| # | Step | Owner sees | Gate |
|---|---|---|---|
| D1 | Inputs & brief | 1-page brief | Owner approves brief |
| D2 | Visual direction | 2–3 styles of the same 2 screens, on phone | Owner picks one |
| D3 | Design system | Live "kitchen sink" page: colours, type, buttons, inputs, sheets, lists — light + dark | Owner approves |
| D4 | Flows | Step-by-step flow per core job with tap counts | Owner approves |
| D5 | Clickable prototype | Every MVP screen, fake realistic data, all states, installed on phone | Owner approves per screen group |
| D6 | Usability test | Design partner does 5 real tasks while we watch | Fix issues found → re-approve |
| D7 | Lock | Approved screenshots become baselines | Any later visual change must be approved |

Backend work (beyond the pure pay-rules code) does not start until D7 is passed for the screens a slice touches.

## D1 — Inputs and brief

**From the owner:** 3–5 apps whose look/feel you like (any category — banking, delivery, etc.) and what you like about each; any logo/colour preferences; anything you hate.

**Brief (`docs/design/brief.md`, 1 page):** who uses it (owner, office manager, foreman), where (ute, office, rooftop, sun, gloves, one hand, patchy signal), tone (calm, trustworthy, plain words — "Log today", not "Create work entry"), and the UX targets below.

**UX targets (measurable):**
| Job | Target |
|---|---|
| Log a normal crew-day on one job | ≤ 30 s, ≤ 6 taps when nothing changes from usual |
| "Same as yesterday" | ≤ 3 taps |
| Enter progress with equal split | ≤ 20 s |
| Add expense with receipt photo | ≤ 45 s |
| Find why a job is over budget | ≤ 3 taps from Home to the log lines behind it |
| Review + approve a clean weekly pay run | ≤ 2 min |

## D2 — Visual direction

2–3 distinct visual directions applied to the **same two screens**: Home (Monday screen) and Log crew-day. Built as real pages at phone size and published to a private link the owner opens on their phone. Owner picks one (or mixes). No other screen is designed before this.

## D3 — Design system

Built in code, so it's exactly what ships:
- **Tokens:** colour (light + dark, all text/background pairs WCAG AA; status colours red/amber/green usable in bright sun), type scale (min body 16 px), spacing, radius, shadows, motion.
- **Components:** button (primary/secondary/destructive, min 48 px tall), input + number input (right keyboard type), select/picker, toggle, crew chip, status chip, money cell, list row, card, bottom sheet (phone) / dialog (desktop), tabs, bottom tab bar / sidebar, toast, empty state, skeleton loader, offline banner, outbox badge.
- A `/design` page in the preview app shows every component in every state, light and dark. Owner approves this page.

## D4 — Flows

For each core job (onboarding, log crew-day, progress + split, pause/resume/done + lump sum, add expense, pay run review → approve → export → share statement, record payout, find over-budget cause): a short numbered flow in `docs/design/flows.md` with screens, taps, what happens offline, and error cases. Owner approves.

## D5 — Clickable prototype

- Every screen in the inventory (product spec §6), built as real Next.js routes on the **fake data layer** (realistic seeded roofing data: 12 crew, 5 jobs, 2 years of history).
- Every screen shows all its states: normal, empty, loading, error, offline / waiting to send, no permission (foreman view).
- Deployed to the preview site; owner installs it to the home screen on iPhone and/or Android and taps through.
- Reviewed in groups (Home · Logging · Jobs & stages · Crew · Expenses · Pay · Reports · Settings). Feedback → fix → re-review until approved.

## D6 — Usability test (the real proof)

With the design partner (a real roofing owner/manager), on their phone, 30 minutes, no help from us:
1. Log yesterday's crew on the Smith job.
2. Record 120 m² of sheeting split between two people.
3. Pause the Ryde job for rain.
4. Add a receipt Dima paid for.
5. Tell us which job is losing money and why.

We record time, taps, and where they hesitate. Anything that fails a UX target or confuses them gets fixed before D7.

## D7 — Lock

- Approved screens → Playwright screenshots at iPhone (WebKit), Android (Chromium) and desktop sizes, light + dark = **visual baselines** in the repo.
- From then on, every slice runs visual comparison; any difference must be either fixed or shown to the owner and re-approved. The UI cannot silently degrade while logic is wired in.
- Accessibility (axe) and performance checks run on every slice (architecture §10).

## Quality checklist (every screen, every slice)

- Works one-handed on a 6.1" phone; primary action in thumb reach.
- Tap targets ≥ 48 px; no hover-only actions.
- Correct keyboard for each field (numeric, decimal, phone, email).
- Safe areas respected (notch, home bar) in installed mode.
- Readable in sunlight (contrast AA minimum, AAA for key numbers).
- No layout jump when data loads (skeletons sized like content).
- Every state designed: empty, loading, error, offline, no permission.
- Money figures tap through to their source lines.
- Plain words; no jargon (no "entity", "mutation", "sync conflict").
- Same component used for the same thing everywhere.
