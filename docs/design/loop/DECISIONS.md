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

## 2026-10-01 — field-2 accepted by owner at 80 after the 3-iteration cap

Iteration 3 scored 82/78 (average 80) with one open P1 (field-2/i3-F1, the installed-landscape Save bar and nav covering about 45% of the screen; accepted under the cap) and clean automated checks (152 captures, 2 expected offline-console fails), so the loop capped at iteration 3 per the owner's standing rule (design loop capped at 3 iterations, accept and move on). Scores: 70 → 77 → 80.

Owner decision (2026-10-01): accept field-2 at 80 under the 3-iteration cap. Open rows stay in ISSUES.md.

## 2026-10-02 — jobs-1 accepted at 75.5 under the 3-iteration cap

Scores 66 → 71 → 75.5 (iteration 3: design 77, field 74), automated checks clean (84 captures, 0 fail). The loop did not reach 90 (04-design-process §3): each round fixed the rows raised, and the critics then raised a fresh set of layout and wording rows on the jobs list and the job form (iteration 3 added i3-F2 to F10 and i3-D2 to D15) while the score rose 4 to 5 points a round, from a low start (66).

One P1 stood at iteration 3: the date fields read mm/dd/yyyy in the Chromium captures (jobs-1/i3-F1, i3-D1). It was a capture-language fault, not an app fault, and was closed afterwards (8131392, Chromium launched with --lang=en-AU; guard checkDateFields; ruling R8).

Owner decision (2026-10-01, standing rule): accepted under the 3-iteration cap. Open rows left in ISSUES.md, none P0/P1: P2 (12): i2-F10, i2-D7, i3-F2, i3-F3, i3-F4, i3-F5, i3-D2, i3-D3, i3-D4, i3-D5, i3-D6, i3-D7; P3 (17): i2-F12, i2-D12, i2-D14, i3-F6, i3-F7, i3-F8, i3-F9, i3-F10, i3-D8, i3-D9, i3-D10, i3-D11, i3-D12, i3-D13, i3-D14, i3-D15, long-name-clamp.

## 2026-10-09 — jobs-2 accepted by the owner at 73.5 after iteration 1

Iteration 1 scored 72/75 (average 73.5) with three open P1 rows (jobs-2/i1-F1 two primary buttons, i1-F2 paused timeline said Working, i1-D1 actions at the top) and clean automated checks (320 captures, 0 fail after guard fix 70ac00e). Why it stopped below 90 and before the cap: the three P1 rows were fixed in 43f9190 and the iteration 2 capture came back clean (320 captures, 0 fail), but Task 14 had used 766 of its 800 tool uses, so the iteration 2 critics could not be run inside the budget (RUNBOOK §5). No iteration 2 score exists.

Owner decision (2026-10-09): accept jobs-2 at 73.5 and tick Task 14. This is the lowest accepted score; it was accepted at iteration 1, before the 3-iteration cap (owner, 2026-10-01) was reached. All three P1 rows are closed in ISSUES.md. Open rows left in ISSUES.md, none P0/P1: P2 (26): i1-F3 to i1-F14, i1-D2 to i1-D13, i1-D15; P3 (7): i1-F15 to i1-F17, i1-D16 to i1-D19. i1-D14 (date field reads dd/mm/yyyy) is the guard row, covered by checkDateFields.

## 2026-10-10 — crew accepted by the owner at 83.5 after iteration 2

Scores 69 → 83.5 (iteration 2: design 84, field 83), automated checks clean (211 captures, 0 fail). Both critics reported no open P0/P1 at iteration 2 (the three P0/P1 rows from iteration 1 are closed as fixed in iteration 2; the 4 in the SCORES.md row was a mis-entry and is corrected to 0). Why it stopped below 90 and before the cap: Task 15 reached 825 of 800 tool uses after design fixes 1b and 2, so iteration 3 could not be run inside the budget (RUNBOOK §5). One further fix (063b072) closed a desktop crew-detail name-to-balance gap found by the task e2e.

Owner decision (2026-10-10): accepted by the owner at iteration 2; open P3 rows stay in ISSUES.md. Open rows left in ISSUES.md, none P0/P1: P2 (12): i1-D4, i1-D6+F13, i1-D9, i1-D10, i1-D11, i1-D12+F11, i1-D13+F12, i1-F8, i2-D4+F23+D14, i2-D21+F25, i2-F18+D10, i2-F19+D25; P3 (17): i1-D14, i1-D16, i1-D19, i1-F16, i1-F17, i2-F17, i2-F27, i2-D6+D24, i2-D23+F20, i2-F26, i2-D12+F11, i2-D16, i2-F22, i2-D9+D11, i2-D22+F24, i2-F28, i2-D26+F21.

## 2026-10-10 — expenses accepted at 88 under the 3-iteration cap

Scores 74.5 → 84 → 88 (iteration 3: design 86, field 90), zero P0/P1, automated checks clean (278 captures, 0 fail). Below 90 on the average because the design critic held 86: it raised a new P2 for the landscape pinned bar (i3-D32) and P3 wording rows after the iteration 2 P2s were fixed. Iteration 3 ran trimmed (a budget assessor allowed one fix run and one capture).

Accepted under the 3-iteration cap (owner, 2026-10-01). Open rows left in ISSUES.md, none P0/P1: P2 (5): i1-F7+D5, i1-F8+D15, i1-D8+D17, i1-D9, i3-D32+F27; P3 (16): i1-D13+D14+D18, i1-F13, i1-D20, i2-F18, i2-F21, i2-F22+D31, i2-F23, i2-D24+D25, i2-D26+D29, i2-D27, i2-D30, i3-F24+D33, i3-F25+D5, i3-F26, i3-D34, i3-D13+D17.

## 2026-10-11 — pay accepted at 88.5 under the 3-iteration cap

Scores 77.5 → 82 → 88.5 (iteration 3: design 88, field 89), zero P0/P1 at iteration 3 (iteration 2 had 3, all fixed), automated checks clean (276 captures, 0 fail). Short of 90 by 1.5 points: iteration 3 raised one new P2 (i3-N1+F5) and a few P3 rows after the earlier rows were closed.

Accepted under the 3-iteration cap (owner, 2026-10-01). Open rows left in ISSUES.md, none P0/P1: P2 (1): i3-N1+F5; P3 (10): i2-D20, i3-D17, i3-D20, i3-N2, i3-N3, i3-F2, i3-F3, i3-F6, r-N2, r-F4c.

## 2026-10-11 — reports accepted at 81.5 under the 3-iteration cap

Scores 65.5 → 77 → 81.5 (iteration 3: design 83, field 80), zero P0/P1 at iterations 2 and 3, automated checks clean (836 captures, 0 fail). Why it did not converge: iteration 1 started low (65.5, one P0 and five P1 rows on range handling, sort order, no key figure) and five reports plus the hub and history lists gave the critics many screens; the fixes lifted it 11.5 and then 4.5 points, not enough in three iterations. The iteration 1 P1 rows are closed (key figure and Change row in dbca743, guard checkReportFirstScreen).

Accepted under the 3-iteration cap (owner, 2026-10-01). Open rows left in ISSUES.md, none P0/P1: P2 (9): i1-D4+N17, i1-D9+N9, i1-D14+N8, i1-N11+D20, i1-N14, i1-N15, i2-F2+D26, i2-F3, i3-F3; P3 (8): i1-D12, i1-D16, i1-D19, i2-D12+F9, i2-D16, i2-D19, i2-misc, i3-misc.

## 2026-10-13 — entry-settings accepted at 87.5 under the 3-iteration cap

Scores 74 → 83.5 → 87.5 (iteration 3: design 87, field 88), zero P0/P1 at iteration 3 (iteration 2 had 1, fixed), automated checks clean (1182 captures, 0 fail). Short of 90 by 2.5 points: the group is the largest (1182 captures: entry, settings and lists) and iteration 3 raised one new P2 (i3-D33) and seven P3 rows after the iteration 2 rows were closed.

Accepted under the 3-iteration cap (owner, 2026-10-01). Open rows left in ISSUES.md, none P0/P1: P2 (4): i2-D27, i2-F15, i3-D33, i3-F15; P3 (4): i1-misc-P3, i2-misc-P3, i3-D21+F11, i3-misc-P3.
