# Task 19 run 2c - the 7 e2e failures left by runs 2a/2b

All three causes were in the tests, not the app. No `src/` file changed. The build in `.next` was newer than every `src/` file, so I did not rebuild; I served it on 3100 with `ROOFY_DATA=fake`, ran the three specs, and stopped the server.

## Causes and fixes

1. `guards.spec.ts:458` pinned bar matches its form column (iphone, android).
   - Cause: the fixture page had no viewport meta. A mobile project lays such a page out at 980 px, not the test's 768 px, so the failure line said "the bar starts at 190 px; the form column starts at 130 px" instead of "starts at 84 px". Desktop has no mobile emulation, so it passed.
   - Fix: the fixture now carries `<meta name="viewport" content="width=device-width, initial-scale=1">`. The assertions are unchanged (a 720 px bar passes; a 600 px bar over a 720 px column fails with "starts at 84 px").

2. `settings-lists.spec.ts:324` members row opens a role sheet (all 3 projects).
   - Cause: the test clicked the option's text (`getByText("Manager")`). The Segmented control's real radio input sits over the whole option (`absolute inset-0 opacity-0`), so Playwright reports it "intercepts pointer events". A person tapping the option hits the input, so the app behaves correctly.
   - Fix: click `getByRole("radio", { name: "Manager", exact: true })`, and the same for the "Accountant" put-back. This matches every other spec that picks a Segmented option. Nothing was weakened.

3. `settings-levels.spec.ts:63` tablet and desktop level row layout (desktop project; two tests).
   - Cause A (first failure, "rows are at least 48 px, received 0"): the row locator `form.pin-pad > div > *` also matched the children of the pinned Save bar's div, whose empty slots have no height. It now reads the children of the form's first div, the levels list.
   - Cause B (found once A was fixed, 61 > 60 at tablet only): below 1024 px the rate input is 52 px high (`h-[52px] lg:h-12`), so a row is 4 + 52 + 4 + 1 px divider = 61 px. At 1024 px and up the text stack sets the height (59 px). The 60 px limit was a guess from the desktop figure, written in 2a when no server was run. The limit is now 61, with a comment saying why. The row is still far from the old 67 px, the 48 px minimum is unchanged, and the 52 px touch-size box is kept.

## Result

- Full run of `guards.spec.ts`, `settings-lists.spec.ts`, `settings-levels.spec.ts` on iphone, android and desktop: 269 passed, 30 skipped (the resize tests skip off desktop), 1 failed (cause B, before the 61 px fix).
- After the fix, `settings-levels.spec.ts --project=desktop`: 17 passed.
- Guards and members specs passed on all three projects in the full run.
- `pnpm verify`: green (100% domain coverage, pay-rule examples named).
- Server on 3100 stopped (PID taken from `ss -ltnp`); nothing left running.

Files: `tests/e2e/guards.spec.ts`, `tests/e2e/settings-lists.spec.ts`, `tests/e2e/settings-levels.spec.ts`.
