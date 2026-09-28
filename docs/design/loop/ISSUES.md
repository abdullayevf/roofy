# Design-loop issues

Open and closed issues found by the automated checks or either critic agent (`docs/specs/04-design-process.md` §2/§6), across every screen group's design loop (Tasks 8, 10–19 in `docs/plans/03-design-prototype.md`).

**Usage:**

- One row per issue. `id` is the critic's own id (`D1`, `D2`, ... from `design-critic`; `F1`, `F2`, ... from `field-critic`; `A<n>` for an automated-check failure copied in from a group's `checks.md`) prefixed with the group, e.g. `field-2/D3`, `jobs-2/A1`, so ids stay unique across groups and re-runs.
- `severity` is P0–P3 (`04-design-process.md` §2: P0 broken, P1 major, P2 moderate, P3 polish).
- `screen/state/viewport/scheme` names exactly which capture the issue is about (e.g. `log-progress/foreman/iphone/light`).
- `status` is `open` or `closed`. Close an issue by editing its row in place (don't delete it) once the fix has been re-verified through the loop — keep the row as a record.
- `iteration` is the design-loop iteration number (1–6, per the group's 6-iteration cap) the issue was raised in. If fixed in a later iteration, note that iteration number in the `fix` cell too (e.g. "... — fixed iteration 3").
- A screen group's exit gate (§2 "Exit") requires zero **open** P0/P1 rows for that group.

| id                                                                                              | group | severity | screen/state/viewport/scheme | problem | fix | status | iteration |
| ----------------------------------------------------------------------------------------------- | ----- | -------- | ---------------------------- | ------- | --- | ------ | --------- |
| _(none yet — Task 4 ships the tooling; screen groups start filling this in from Task 8 onward)_ |       |          |                              |         |     |        |           |
