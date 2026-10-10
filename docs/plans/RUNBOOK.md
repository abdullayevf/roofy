# Runbook: how a phase is run

Read by the conductor (the main session) at the start of every session and after every compaction. Quality gates (§1) are never skipped or thinned to save tokens.

Why (measured with `python3 scripts/usage-report.py`, $220 to 2026-10-02): conductor re-reading its own long history 35%; implementer runs over 60 steps 25%; critics 21% (100+ steps each, one image per step); cold restarts after idle gaps about 10%. Runs of 40 steps or fewer averaged $0.47. So: short narrow runs, a thin conductor that starts fresh each task, batched reads.

## 1. Quality gates (unchanged)

- TDD: failing test first; pay-rule examples (E1.1…) are named tests.
- Every task: code review (`reviewer`) and spec review (`spec-reviewer`, opus). Phase gate at the end of every phase (`docs/plans/00-master-plan.md`).
- Design loop for every screen group: build, capture, automated checks, both critics (opus), fix. Exit at average ≥ 90 with no P0/P1, or at the cap in §4.
- Opus for: money/pay/ledger, foreman hiding, sync/idempotency, timezone, spec reviews, critics, the final phase review. Sonnet for everything else. A sonnet task that fails review twice is redone on opus.
- `pnpm verify` green before every commit. Foreman data never carries money. Work dates use the workspace timezone.

## 2. The conductor stays thin

- Read only: this file; `sed -n '/^## Current/,/^## Log/p' docs/plans/PROGRESS.md`; `tail -30 .superpowers/sdd/<plan>/progress.md` (the ledger). Never diffs (use `--stat`), logs, screenshots, whole plan/spec/flows files, or any file over 100 lines. Command output: `| tail -15` at most.
- Never writes product code or tests. Writes only briefs, fix lists, ledger lines, PROGRESS.md and docs commits.
- **One session per slice.** A session finishes the current task or about 4 dispatch rounds, commits ledger and PROGRESS.md, then ends. `scripts/loop.sh` starts the next fresh session with `scripts/loop/PROMPT.md` (by hand: `/clear`, then paste that prompt). The loop stops when `.superpowers/STOP` exists (§6 questions, phase gate done, budget exceeded, no progress twice). A fresh session costs a few k tokens; carrying a 100k+ history costs that on every step.
- Dispatch with the Agent tool (`subagent_type`: implementer, reviewer, spec-reviewer, design-critic, field-critic). Prompt at most 12 lines: task id, rules file, brief file, report file, other inputs by path. No pasted text.
- Replies at most 10 lines; reports and critic tables are files, read only when acting on them.
- After every completion notice, append one ledger line: `<time> <agent> <task/round> <STATUS> tool_uses=<n> tokens=<n>`; keep a running total per task.
- Do not poll or sleep for agents: end the turn and wait for the notice. Never dispatch a second agent on work one is still doing.
- Resume (SendMessage) an agent only if it used 25 tool uses or fewer and replied DONE; otherwise dispatch a fresh one pointed at its report file.
- Auto-compaction at about 120k (settings). Ledger and PROGRESS.md are current before every dispatch round, so a compaction loses nothing.

## 3. A task

1. Brief: `.superpowers/sdd/<plan>/task-N-brief.md`, at most 60 lines of pointers (plan lines, spec/flows/DESIGN.md line ranges, files to touch, model, done-when). Pointers, not copies.
2. Implement: `implementer` (sonnet; opus where the plan says; pass `model`). Split the work into runs of 30 steps or fewer from the start. PARTIAL → fresh implementer pointed at its report.
3. Review: `reviewer` and `spec-reviewer` **in parallel** on the same commit range. Merge both into one fix list → one fresh implementer → re-review of those findings only (each reviewer that had findings checks its own). At most 2 fix rounds, then redo on opus.
4. Implementers run `pnpm verify` and commit their own work (explicit paths, conventional message, CLAUDE.md trailer). The conductor then runs the task's e2e specs on all three projects (`pnpm exec playwright test <files> > .superpowers/run/e2e.log 2>&1; tail -15 .superpowers/run/e2e.log`), ticks the plan, updates PROGRESS.md "Current" (at most 12 lines) and the ledger, commits those docs, and stops (§2).
   Commands over 3 minutes (build, capture, full e2e) are the conductor's, never an implementer's.

## 4. A screen group adds the design loop

Before iteration 1 the brief carries: (a) a state checklist, every screen × state × role from flows.md and the plan (normal, filled, saved, validation error, empty, loading, error, offline or waiting, no permission, foreman variant, long names), each captured by `tests/e2e/screens.ts`; (b) a pointer to `docs/design/loop/lessons.md` (repeat findings from earlier groups). The implementer self-checks its screens against lessons.md before DONE. A state or lesson the critics have to flag is a brief failure.
Each iteration:

1. Fix run: `implementer` with the fix list (P0 and P1 first, P2 batched, P3 only if cheap). No capture.
2. Capture: `scripts/capture-group.sh <group>` (conductor). If `checks.md` shows guard failures, fix those first; critics only see a capture with 0 failures.
3. Critics in parallel (`design-critic`, `field-critic`). Input: `checks.md`, the slices, and the line ranges of flows.md / product spec for this group. Iteration 2+: only files in `changed.txt`, plus a line saying every other image keeps its previous finding status. Lens split: field = phone light and dark, installed, keyboard, landscape; design = iphone and desktop light and dark, tablet, installed. Reply at most 40 lines.
4. Record scores in SCORES.md, issues in ISSUES.md, merge both tables into one fix list. Mark measurable findings "guard" (fixer adds an assertion to `tests/e2e/guards.ts` or the spec). Add any finding seen in two groups to lessons.md (one line each).
   Exit: average ≥ 90 and no P0/P1. Cap: 3 iterations (owner, 2026-10-01); after iteration 3 accept and move on without asking, open rows stay in ISSUES.md. An open P0 (crash, unusable, wrong data) at the cap gets one P0-only fix run, no re-score.

## 5. Budgets (exceeded → STOP note in the ledger, then stop)

- One run: implementer ≤ 45 steps, reviewer ≤ 30.
- Screen-group task, all agents: ≤ 28 runs and 800 tool uses (Task 13: 26 runs, 757 steps, about $30). Other task: ≤ 12 runs and 300 tool uses.
- A usage-limit message: finish the ledger line and PROGRESS.md "Next", then stop.
- Tasks 20–22 (tap-budget suite, foreman leakage sweep, visual baselines/PWA) run as one brief and one review cycle; they share files and have no design loop.
- **Small stops get assessed, not asked (owner, 2026-10-10).** If a stop condition fires on a small, low-stakes issue — a cosmetic or few-px visual delta, a single failing or flaky check, or a budget overshoot within ~10% — do not write STOP. Dispatch a one-shot assessor agent (opus, short prompt: the STOP-worthy fact, the gates, remaining budget) to pick the optimal action: fix it, accept and move on, or adjust only that check within the existing gates — optimizing token spend while keeping every quality gate intact. Execute the assessor's call, record one ledger line naming the assessor and its decision, and continue. Stop for the owner only for the §6 list, a usage-limit hit, or the phase gate.

## 6. Ask the owner only for

- A spec contradiction the specs cannot settle (if work doesn't depend on it, record the safe default and carry on).
- The same test or a P0 still failing after 2 fix rounds on opus.
- Anything that loosens a quality gate, touches money maths outside `src/domain`, or touches other projects, ports or nginx.
- Destructive git, pushing or merging. Never unasked.
  Everything else: safe default, record it under "Decisions and deviations" in PROGRESS.md, continue.

## 7. End of a phase

Phase gate in `docs/plans/00-master-plan.md`: full `pnpm verify`, full e2e on three projects, coverage, `spec-reviewer` (opus) on the whole phase range, then fix lists as above. Record evidence in PROGRESS.md, set "Next" to the next phase's first task, commit, stop. Do not start the next phase unprompted.
