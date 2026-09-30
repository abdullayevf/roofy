# Design-loop decisions

Dated entries recording design decisions made while running the loop (`docs/specs/04-design-process.md` §2/§6) — including the D2 Galvanised-vs-challenger outcome, any DESIGN.md change made in response to a critic finding, and every "stopped at the 6-iteration cap" escalation to the owner.

**Usage:** append, don't edit past entries (this is a decision log, not a status board — see ISSUES.md for the live issue list and SCORES.md for the score history). Each entry: date, what was decided, why, and what changed as a result (a DESIGN.md diff, a screen rebuilt, an escalation sent).

---

## 2026-09-28 — Design-loop tooling built (Task 4)

Built the loop's tooling ahead of any screen group running through it: `tests/e2e/guards.ts` (`expectScreenHealthy`/`checkScreenHealthy` and the checks they compose), `tests/e2e/screens.ts` (the screen manifest), `scripts/design-capture.ts`, the two critic agents, and `docs/design/atlas.md`. No design decisions yet — this file starts recording once Task 10 (D2) and Tasks 11–19 (D5 per group) begin running screens through the loop.

**Deviation on globals.css's type scale:** `src/app/globals.css`'s `@utility text-*` declarations (Task 2) are written in fixed `px`, not `rem`. `checkTextZoom` in `guards.ts` still runs and still reports horizontal overflow at 200% zoom (`html { font-size: 200% }`), but because the type scale doesn't inherit from the root font-size, that injection does not actually enlarge Roofy's own type the way a rem-based scale would — it can only catch a _layout_ that overflows regardless of type scaling, not "does our type actually resize at 200%". Not changed here (out of scope for Task 4; flagged for whoever next touches `globals.css`'s type scale, and for the D3 gate on `/design`, Task 8).

## 2026-09-28 — Type scale moved to rem

Resolves the deviation above. `globals.css` type utilities and the body size are now rem (px ÷ 16), so `checkTextZoom`'s `html { font-size: 200% }` and users' browser text-size settings scale Roofy's type (DESIGN.md §8, WCAG 1.4.4). Pixel sizes at the default root size are unchanged.

## 2026-09-29 — System loop iteration 5 rulings

Input values (numbers, ABN, amounts) are Atkinson with tabular figures; Barlow is for read-only figures (DESIGN.md §3). The iteration-4 Barlow inputs were reverted and i4-D6 closed as won't fix. The desktop sidebar's active item is no longer a chalk fill (filled icon, `galv` background, `ink` edge bar); the pause sheet puts the optional note above the reason chips (flows.md updated); crew rows run in two columns from 600 to 1023 px; DESIGN.md §4 records all three.

## 2026-09-30 — System loop stopped at the 6-iteration cap (average 87)

Iterations 5 and 6 both scored 87/87 with zero open P0/P1 and clean automated checks, so the loop did not reach 90 (04-design-process §3 cap). Why it didn't converge: each round fixed every raised issue (all 23 iteration-5 rows closed but one), and the critics then raised a fresh set of P2/P3 polish on the gallery itself — caption styles, specimen corners, copy nits — rather than on anything a screen depends on. The two P2s that matter to real screens are an undo toast after a one-tap pause (i6-F1) and a width limit on grouped rows in phone landscape (i6-F2). Screenshots and the 19 open rows went to the owner for a decision.

Owner decision (2026-09-30): accept the system group at 87 and move on. i6-F1 (undo after a one-tap pause) is carried to Task 14 and i6-F2 (row width in phone landscape) to every screen group; the other i6 rows stay open as gallery polish.

## 2026-09-30 — D2 round 1 split; Galvanised revised

The A/B (Galvanised vs the Docket challenger, Home and Log crew-day) split: the design critic preferred the challenger 74 to 73, the field critic preferred Galvanised 75 to 72. Galvanised stays, with its colour meanings (both critics praised them), and takes what both critics said the challenger did better:

- B1. Save day is pinned in thumb reach and always visible: a bar fixed above the tab bar on phone (safe-area aware, content padded so the last crew row is never hidden), sticky at the bottom of the form column on desktop. Why: the challenger's top Save day was the one thing both critics called faster to reach; a pinned bar gets that without moving the action off the thumb.
- B2. Glare edges: unticked crew check boxes and the date rule use `ink` instead of faint grey, and list groups get a 1 px `edge` outline as well as the surface colour. Why: in glare a `surface` block on `galv` and a grey box vanish; both critics marked the field readability down. Contrast unchanged or better (edge is at least 3:1 on both grounds, light and dark).
- B3. Tighter radius hierarchy: controls 6, groups 8, sheets 12 (top only), chips full (was 10, 12, 16). Why: the critics read the larger radii as a generic app look; smaller radii keep the hierarchy and look more like tools.

The Docket challenger is unchanged (its own radius, edge and top-action overrides). Round 2 captures re-run before any new score.

## 2026-09-30 — D2 outcome: Galvanised wins

Round 1 split: the design critic preferred the challenger 74 to 73, the field critic preferred Galvanised 75 to 72. Galvanised was revised (Save day pinned in thumb reach, `ink` edges on unticked boxes and the date rule plus a 1 px `edge` outline on groups, radii 6/8/12) and round 2 ran blind with a fresh mapping: Galvanised won 83 to 72 with the design critic and 79 to 67 with the field critic. The challenger code and tokens are deleted (scripts/challenger-tokens.css, src/app/design/challenger/, the "direction" capture rows, the gen-tokens hook).

Lessons carried to Tasks 11 and 12: darker small text and borders for glare, a heavier check box and date stroke, a stronger ticked-row tint, and a denser Needs attention list on phone.

## 2026-10-01 — field-1 accepted by owner at 82 after the 6-iteration cap

Iteration 6 scored 82/82 (average 82) with zero open P0 and one P1 (f1i6-F1: a manager's own failed send sat as the third row under an unrelated headline), and clean automated checks, so the loop did not reach 90 (04-design-process §3 cap). Why it didn't converge: each round fixed every raised issue and the critics then raised a fresh set of wording and layout polish on Home, and the scores moved by a few points either way (85/79, then 82/82) rather than climbing.

Owner decision (2026-10-01): accept field-1 at 82, after one final unscored fix round: F1, F2/D2, F3/D1, F4/D5, F5, F6/D10, D3, D6, D9. The other iteration-6 rows stay open.
