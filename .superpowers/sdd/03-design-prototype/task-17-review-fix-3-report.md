# T17 review fix 3 report (sonnet, test and guard code only)
Commit: 0e95bc5 `test(app): Task 17 review fix 3 - ...` (tests/e2e/guards.ts, tests/e2e/pay-run-review.spec.ts). No product code. ISSUES.md untouched.

## N1 (P2) toBeVisible with mutation proof
- Added `await expect(page.locator("[data-pay-needs-connection-inline]")).toBeVisible();` before the `toHaveText` in the "offline and blocked" test (now spec line 338; test starts at 335).
- The test is skipped on desktop (`:335 --project=desktop` finds no test), so I ran it on iphone.
- Mutation: commented out the whole `.pin-action.pin-pay [data-pay-needs-connection-inline] { display: block; font-weight: 400; }` rule in globals.css.
  - FAIL: `toBeVisible` timed out at spec line 338, element resolved to `<span class="hidden text-ink" data-pay-needs-connection-inline>`, "unexpected value hidden".
- Restored with `git checkout src/app/globals.css` (globals.css was clean before, is clean now, not committed).
  - PASS: same test, 1 passed.

## N3 (P3) count guard
- guards.ts `checkPinnedBarCompact`: `circleLoc.count() === 0` now gives circle = null (the "no Log circle in the tab bar to measure against" failure still pushes) and `boundingBox()` is never called on an empty locator.

## N2 measured cap
- Measured with a temporary console.log (removed): 844x390, manager, `?demo=offline`, blocked pay run. Pinned bar height = 76 px (under 100).
- Cap set to measured + 4 = 80 (was 100); comment in the spec updated to say 76 measured, cap measured + 4.

## Evidence
- `pay-run-review.spec.ts --project=iphone`: 28 passed, 1 skipped (desktop-only test) with cap 80 and the new guard code.
- `pnpm verify`: green. Unit tests 100 files / 992 tests passed; domain coverage 100%; check:examples OK.
- Not run (conductor): android and desktop projects, full e2e, build/capture.
- Deferred to ISSUES.md by conductor (not edited here): N2 two-factor+offline manager combination (about 96 px), F4c button height/gap check in `checkPinnedBarCompact`.
