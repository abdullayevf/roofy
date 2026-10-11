# T17 assessor 3 (opus, 2026-10-11): after re-review a6d9fa9
Decision: FIX NOW, no owner stop. The STOP trigger is one test-only P2 (a missing `toBeVisible`) and a run overshoot of 1/36 (~3%), with tool uses still under 1050. That is a "small stop" under §5 (owner, 2026-10-10), which overrides assessor 2's "no third assessor" line. No product code, spec or pay maths is open; spec-reviewer has all FIXED; the design loop was accepted at the cap.
Fix run: one `implementer`, **sonnet** (test and guard code only, no money, no foreman data), cap 12 steps, this file is the brief.
1. N1 (P2) `tests/e2e/pay-run-review.spec.ts:338`: add `await expect(page.locator("[data-pay-needs-connection-inline]")).toBeVisible()` before the `toHaveText`. Prove it bites (TDD by mutation): comment out the `display: block` rule at `globals.css:522-525`, run only this test on one project and watch it fail, then restore the rule and watch it pass. Do not commit the mutation.
2. N3 (P3, one line, same run): `guards.ts:1173`: `if ((await circleLoc.count()) === 0)` push the "no Log circle" failure and skip `boundingBox()`.
3. While that test runs, log the measured bar height for the 844x390 manager offline+blocked case (N2). If it is under 100, set the cap to the measured height + 4 px. If it is not, leave the cap at 100 and record it.
Then `pnpm verify`, commit `test(app): Task 17 review fix 3 - ...`.
Deferred to ISSUES.md (rows, no code): N2 untested two-factor+offline manager combination (about 96 px), F4c (button height/gap check in `checkPinnedBarCompact`). Both P3.
Verification (conductor): `pay-run-review.spec.ts` on 3 projects (iphone, android, desktop). No recapture, no critics.
Re-review: one `reviewer`, cap 6, checks only N1 and N3 at the fix commit. No spec-reviewer rerun: this is test-only and every spec item is already FIXED.
Outcome: N1 FIXED, e2e green, verify green: close T17. If N1 is still open or e2e goes red: STOP note for the owner. Do not run a 4th assessor.
New ceiling (final): **39 runs / 1040 tool uses** (37/~1010 + implementer ≤12 + reviewer ≤6, rounded). Going over it = STOP for the owner.
Ledger: "assessor-3 (opus) T17: small stop; 1 sonnet test fix (N1 toBeVisible, N3 count guard, N2 cap measured), reviewer re-check N1/N3, N2-combo+F4c to ISSUES, final ceiling 39/1040".
