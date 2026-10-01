# Design-loop scores

Score history for every screen group's design loop (`docs/specs/04-design-process.md` §2/§3), one row per group per iteration.

**Usage:**

- `group` matches `tests/e2e/screens.ts`'s `ScreenGroup` values (`system`, `field-1`, `field-2`, `jobs-1`, `jobs-2`, `crew`, `expenses`, `pay`, `reports`, `entry-settings`).
- `iteration` starts at 1 and is capped at 6 (§2 "Cap"). If a group doesn't converge by iteration 6, stop, log why in `DECISIONS.md`, and record the final row here with `automated checks pass?` and the P0/P1 count as of that stop — don't keep iterating past 6.
- `design score` / `field score` are each critic's `Total: X/100` from that iteration's run of `.claude/agents/design-critic.md` / `field-critic.md`. `average` is their mean.
- `P0/P1 count` is the number of **open** P0 + P1 rows in `ISSUES.md` for this group as of this iteration (should be 0 on the row that passes the gate).
- `automated checks pass?` is yes/no from that iteration's `docs/design/loop/shots/<group>/checks.md` (all guards green, design lint clean, contrast script clean).
- **Exit** (§2): average ≥ 90, zero open P0/P1, automated checks pass — all on the same iteration's row.

| group  | iteration | design score | field score | average | P0/P1 count | automated checks pass?                                                          |
| ------ | --------- | ------------ | ----------- | ------- | ----------- | ------------------------------------------------------------------------------- |
| system | 1         | 72           | 69          | 70.5    | 6           | no (console 404: /outbox prefetch)                                              |
| system | 2         | 75           | 70          | 72.5    | 5           | no (Back to Home 26 px target; 200% zoom overflow 544 px; /outbox prefetch 404) |
| system | 3         | 90           | 87          | 88.5    | 1           | no (/outbox prefetch 404 only — route arrives in Task 12)                       |
| system | 4         | 82           | 82          | 82      | 2           | no (dom-contrast "Forecast"/"Cost so far" 1.00:1)                               |
| system | 5         | 87           | 87          | 87      | 0           | yes                                                                             |
| system | 6         | 87           | 87          | 87      | 0           | yes                                                                             |
| field-1 | 1 | 74 | 71 | 72.5 | 5 | no (24 `?demo=error` captures: console 500 and React #441 from the forced error, ruled expected) |
| field-1 | 2 | 77 | 79 | 78 | 4 | yes |
| field-1 | 3 | 82 | 82 | 82 | 0 | yes |
| field-1 | 4 | 85 | 81 | 83 | 1 | yes |
| field-1 | 5 | 85 | 79 | 82 | 1 | yes |
| field-1 | 6 | 82 | 82 | 82 | 1 | yes |
| field-2 | 1 | 72 | 68 | 70 | 5 | no (6 `log-crew-day` `?demo=error` captures: console 500 and React #441 from the forced error, ruled expected) |
| field-2 | 2 | 78 | 76 | 77 | 4 | no (2 `log-crew-day-offline-saved` console errors: ERR_INTERNET_DISCONNECTED from cutting the network, expected) |
