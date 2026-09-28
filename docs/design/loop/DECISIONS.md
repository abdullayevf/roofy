# Design-loop decisions

Dated entries recording design decisions made while running the loop (`docs/specs/04-design-process.md` §2/§6) — including the D2 Galvanised-vs-challenger outcome, any DESIGN.md change made in response to a critic finding, and every "stopped at the 6-iteration cap" escalation to the owner.

**Usage:** append, don't edit past entries (this is a decision log, not a status board — see ISSUES.md for the live issue list and SCORES.md for the score history). Each entry: date, what was decided, why, and what changed as a result (a DESIGN.md diff, a screen rebuilt, an escalation sent).

---

## 2026-09-28 — Design-loop tooling built (Task 4)

Built the loop's tooling ahead of any screen group running through it: `tests/e2e/guards.ts` (`expectScreenHealthy`/`checkScreenHealthy` and the checks they compose), `tests/e2e/screens.ts` (the screen manifest), `scripts/design-capture.ts`, the two critic agents, and `docs/design/atlas.md`. No design decisions yet — this file starts recording once Task 10 (D2) and Tasks 11–19 (D5 per group) begin running screens through the loop.

**Deviation on globals.css's type scale:** `src/app/globals.css`'s `@utility text-*` declarations (Task 2) are written in fixed `px`, not `rem`. `checkTextZoom` in `guards.ts` still runs and still reports horizontal overflow at 200% zoom (`html { font-size: 200% }`), but because the type scale doesn't inherit from the root font-size, that injection does not actually enlarge Roofy's own type the way a rem-based scale would — it can only catch a _layout_ that overflows regardless of type scaling, not "does our type actually resize at 200%". Not changed here (out of scope for Task 4; flagged for whoever next touches `globals.css`'s type scale, and for the D3 gate on `/design`, Task 8).

## 2026-09-28 — Type scale moved to rem

Resolves the deviation above. `globals.css` type utilities and the body size are now rem (px ÷ 16), so `checkTextZoom`'s `html { font-size: 200% }` and users' browser text-size settings scale Roofy's type (DESIGN.md §8, WCAG 1.4.4). Pixel sizes at the default root size are unchanged.
