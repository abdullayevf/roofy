# Phase 1 — Pay Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pure, exact, fully tested TypeScript domain core that performs every calculation in `02-pay-rules.md` — to the cent.

**Architecture:** Small single-purpose modules in `src/domain/`, no IO, no framework imports, no clock reads (callers pass `asOf`/`now`). Integers only: cents, hundredths, basis points. Every spec example is a named test (`E4.2 …`); a script proves none is missing; coverage is 100%.

**Tech Stack:** TypeScript 6.0 strict, Vitest 5, fast-check (property tests), BigInt for exact intermediate products.

**Spec:** `docs/specs/02-pay-rules.md` (all sections). Read §0 before any task.

## Global Constraints

- Money: integer cents. Quantities, hours, days, multipliers: integer hundredths (7.5 h = 750, 1 day = 100, ½ day = 50, ×1.5 = 150). Percentages: basis points (25% = 2500).
- Rounding: half away from zero to the cent, once per computed line (`mulDivRound`). Never `Math.round` on money.
- Never return `-0` (tests use `toBe`, which distinguishes it).
- `src/domain` imports only `@/domain/*` and `@/lib/*` (lint-enforced). No `Date.now()`/`new Date()` without arguments inside domain.
- Dates are `LocalDate` strings `YYYY-MM-DD`; date maths in UTC via `dates.ts` only.
- For hourly logs `quantity` = hours; for daily logs `quantity` = days; for per-unit logs `quantity` = units; lump-sum and time-only logs have `quantity` 0.

## Review Focus

1. **Split totals** for any crew size and total — must sum exactly and never drop a cent. Pinned by Task 2 property test.
2. **Negative adjustments** — reversals and negative subtotals must round symmetrically and never yield `-0`. Pinned in Task 1 and Task 12 tests.
3. **Sydney date vs UTC server date** — `todayIn` must return Sydney's date at 6 a.m. Monday Sydney (Sunday UTC). Pinned in Task 8.
4. **Rate effective the same day as the log** — `effectiveFrom === date` must apply the new rate (E1.1). Pinned in Task 3.
5. **Hours double counting for piece workers** — per-unit logs carry 0 hours; only the grid's time-only log carries hours (E4.4, E10.1). Pinned in Task 5 and Task 15.

---

## File map

| File | Responsibility |
|---|---|
| `src/domain/types.ts` | Shared primitive and enum types |
| `src/domain/money.ts` | Exact integer maths and decimal parsing |
| `src/domain/split.ts` | Largest-remainder splitting, equal/custom shares |
| `src/domain/rates.ts` | Rate lookup with overrides and effective dates |
| `src/domain/lines.ts` | Hourly/daily/per-unit amounts, default hours |
| `src/domain/piece.ts` | Piece-rate lines from progress; lump-sum lines |
| `src/domain/gst.ts` | GST and per-person pay totals |
| `src/domain/costing.ts` | Labour and expense job cost |
| `src/domain/dates.ts` | Local-date arithmetic, working days, `todayIn` |
| `src/domain/segments.ts` | Stage segments, pauses, lost days |
| `src/domain/progress.ts` | % complete, forecast, budget alerts, margins |
| `src/domain/floor.ts` | Award floor check |
| `src/domain/adjustments.ts` | Deltas and reversals for locked logs |
| `src/domain/flags.ts` | Double pay, duplicates, paused-stage logs |
| `src/domain/attendance.ts` | Gaps and utilisation |
| `src/domain/periods.ts` | Pay period containing a date |
| `src/domain/payrun.ts` | Pay run draft builder |
| `src/domain/ledger.ts` | Balances and unpaid-too-long |
| `src/lib/format.ts` | Display formatting (money, quantities, hours, dates) |
| `scripts/check-examples.ts` | Proves every spec example has a test |

---

### Task 1: Types and exact integer maths

**Files:**
- Create: `src/domain/types.ts`, `src/domain/money.ts`
- Test: `src/domain/money.test.ts`

**Interfaces:**
- Produces: types `Cents`, `Hundredths`, `BasisPoints`, `LocalDate`, `Basis`, `RateBasis`, `Unit`, `WorkerType`, `LogSource`; functions `mulDivRound(a: number, b: number, d: number): number`, `parseDecimal(input: string, places: number): number`, `toCents(s: string): Cents`, `toHundredths(s: string): Hundredths`, `sum(values: readonly number[]): number`.

- [ ] **Step 1: Write the types**

`src/domain/types.ts`:

```ts
/** Integer cents. $1,432.50 = 143250. */
export type Cents = number;
/** Integer hundredths: quantities, hours, days, multipliers. 7.5 h = 750; ½ day = 50; ×1.5 = 150. */
export type Hundredths = number;
/** Integer basis points. 25% = 2500; 100% = 10000. */
export type BasisPoints = number;
/** Local calendar date in the workspace timezone, "YYYY-MM-DD". */
export type LocalDate = string;

export type Basis = "hourly" | "daily" | "per_unit" | "lump_sum" | "time_only";
export type RateBasis = "hourly" | "daily" | "per_unit";
export type Unit = "m2" | "lm" | "each";
export type WorkerType = "employee" | "contractor";
export type LogSource = "grid" | "progress" | "lump_sum" | "adjustment";
```

- [ ] **Step 2: Write the failing tests**

`src/domain/money.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mulDivRound, parseDecimal, sum, toCents, toHundredths } from "./money";

describe("mulDivRound", () => {
  it("rounds half away from zero", () => {
    expect(mulDivRound(5, 1, 2)).toBe(3);
    expect(mulDivRound(-5, 1, 2)).toBe(-3);
    expect(mulDivRound(1, 1, 3)).toBe(0);
    expect(mulDivRound(2, 1, 3)).toBe(1);
    expect(mulDivRound(3333, 950, 100)).toBe(31664);
  });
  it("never returns negative zero", () => {
    expect(mulDivRound(-1, 1, 3)).toBe(0);
  });
  it("is exact for products beyond 2^53", () => {
    expect(mulDivRound(9_007_199_254_740_991, 3, 3)).toBe(9_007_199_254_740_991);
  });
  it("rejects non-integers, non-positive divisors and unsafe results", () => {
    expect(() => mulDivRound(1.5, 1, 1)).toThrow(RangeError);
    expect(() => mulDivRound(1, 1, 0)).toThrow(RangeError);
    expect(() => mulDivRound(9_007_199_254_740_991, 2, 1)).toThrow(RangeError);
  });
});

describe("parseDecimal", () => {
  it("parses Postgres numeric strings into integer hundredths", () => {
    expect(toHundredths("7.5")).toBe(750);
    expect(toHundredths("7.50")).toBe(750);
    expect(toHundredths("120")).toBe(12000);
    expect(toHundredths("12.")).toBe(1200);
    expect(toHundredths(".5")).toBe(50);
    expect(toCents("-300.00")).toBe(-30000);
    expect(toCents("-0.00")).toBe(0);
    expect(parseDecimal(" 3 ", 0)).toBe(3);
  });
  it("rejects garbage, too many places and unsafe values", () => {
    expect(() => parseDecimal("abc", 2)).toThrow(SyntaxError);
    expect(() => parseDecimal(".", 2)).toThrow(SyntaxError);
    expect(() => parseDecimal("1.234", 2)).toThrow(RangeError);
    expect(() => parseDecimal("99999999999999999", 2)).toThrow(RangeError);
  });
});

describe("sum", () => {
  it("adds integers and returns 0 for none", () => {
    expect(sum([1, 2, 3])).toBe(6);
    expect(sum([])).toBe(0);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm vitest run src/domain/money.test.ts` — Expected: FAIL, cannot resolve `./money`.

- [ ] **Step 4: Implement**

`src/domain/money.ts`:

```ts
import type { Cents, Hundredths } from "./types";

function assertSafeInt(n: number, name: string): void {
  if (!Number.isSafeInteger(n)) throw new RangeError(`${name} must be a safe integer, got ${n}`);
}

/** round(a × b ÷ d), half away from zero, exact via BigInt. Never returns -0. */
export function mulDivRound(a: number, b: number, d: number): number {
  assertSafeInt(a, "a");
  assertSafeInt(b, "b");
  assertSafeInt(d, "d");
  if (d <= 0) throw new RangeError("d must be positive");
  const product = BigInt(a) * BigInt(b);
  const negative = product < 0n;
  const abs = negative ? -product : product;
  const divisor = BigInt(d);
  const q = Number((abs * 2n + divisor) / (2n * divisor));
  if (!Number.isSafeInteger(q)) throw new RangeError("result exceeds the safe integer range");
  return negative && q !== 0 ? -q : q;
}

const DECIMAL = /^(-?)(\d*)(?:\.(\d*))?$/;

/** Parse a decimal string into an integer scaled by 10^places, exactly. */
export function parseDecimal(input: string, places: number): number {
  const m = DECIMAL.exec(input.trim());
  const whole = m?.[2] ?? "";
  const frac = m?.[3] ?? "";
  if (!m || (whole === "" && frac === "")) throw new SyntaxError(`Not a decimal number: "${input}"`);
  if (frac.length > places) throw new RangeError(`"${input}" has more than ${places} decimal places`);
  const value = Number((whole || "0") + frac.padEnd(places, "0"));
  if (!Number.isSafeInteger(value)) throw new RangeError(`"${input}" is too large`);
  return m[1] === "-" && value !== 0 ? -value : value;
}

export const toCents = (s: string): Cents => parseDecimal(s, 2);
export const toHundredths = (s: string): Hundredths => parseDecimal(s, 2);

export function sum(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
```

- [ ] **Step 5: Run to verify pass**

Run: `pnpm vitest run src/domain/money.test.ts` — Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/domain/types.ts src/domain/money.ts src/domain/money.test.ts
git commit -m "feat(domain): exact integer money maths and decimal parsing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Largest-remainder splitting

**Files:**
- Create: `src/domain/split.ts`
- Test: `src/domain/split.test.ts`

**Interfaces:**
- Consumes: nothing beyond types.
- Produces: `splitWeighted(total: number, weights: readonly number[]): number[]`; `type Shares = { mode: "equal" } | { mode: "custom"; bp: readonly BasisPoints[] }`; `splitByShares(total: number, count: number, shares: Shares): number[]`.

- [ ] **Step 1: Write the failing tests**

`src/domain/split.test.ts`:

```ts
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { splitByShares, splitWeighted } from "./split";

describe("splitWeighted", () => {
  it("gives leftovers to the earliest people when remainders tie", () => {
    expect(splitWeighted(10_000, [1, 1, 1])).toEqual([3334, 3333, 3333]);
    expect(splitWeighted(200_000, [1, 1, 1])).toEqual([66667, 66667, 66666]);
  });
  it("gives leftovers to the largest remainder first", () => {
    expect(splitWeighted(10, [1, 2])).toEqual([3, 7]);
  });
  it("handles zero totals", () => {
    expect(splitWeighted(0, [1, 1])).toEqual([0, 0]);
  });
  it("rejects bad input", () => {
    expect(() => splitWeighted(-1, [1])).toThrow(RangeError);
    expect(() => splitWeighted(1.5, [1])).toThrow(RangeError);
    expect(() => splitWeighted(10, [])).toThrow(RangeError);
    expect(() => splitWeighted(10, [1, 0])).toThrow(RangeError);
  });
  it("always sums exactly and stays within one unit of the exact share", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50_000_000 }),
        fc.array(fc.integer({ min: 1, max: 10_000 }), { minLength: 1, maxLength: 30 }),
        (total, weights) => {
          const parts = splitWeighted(total, weights);
          const W = BigInt(weights.reduce((a, b) => a + b, 0));
          expect(parts).toHaveLength(weights.length);
          expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
          parts.forEach((p, i) => {
            const floor = Number((BigInt(total) * BigInt(weights[i]!)) / W);
            expect(p === floor || p === floor + 1).toBe(true);
          });
        },
      ),
    );
  });
});

describe("splitByShares", () => {
  it("splits equally by head-count, not via rounded percentages (E5.1 basis)", () => {
    expect(splitByShares(200_000, 3, { mode: "equal" })).toEqual([66667, 66667, 66666]);
  });
  it("splits by custom basis points", () => {
    expect(splitByShares(8000, 2, { mode: "custom", bp: [7500, 2500] })).toEqual([6000, 2000]);
  });
  it("rejects custom shares that do not total 100% or do not match the crew", () => {
    expect(() => splitByShares(100, 2, { mode: "custom", bp: [5000, 4000] })).toThrow(RangeError);
    expect(() => splitByShares(100, 3, { mode: "custom", bp: [5000, 5000] })).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/domain/split.test.ts` — Expected: FAIL, cannot resolve `./split`.

- [ ] **Step 3: Implement**

`src/domain/split.ts`:

```ts
import type { BasisPoints } from "./types";

/**
 * Split a non-negative integer total by positive integer weights (largest remainder).
 * Leftover units go to the largest remainders; ties go to the earlier position. Sums exactly to total.
 */
export function splitWeighted(total: number, weights: readonly number[]): number[] {
  if (!Number.isSafeInteger(total) || total < 0) throw new RangeError("total must be a non-negative integer");
  if (weights.length === 0) throw new RangeError("at least one weight is required");
  if (weights.some((w) => !Number.isSafeInteger(w) || w <= 0)) {
    throw new RangeError("weights must be positive integers");
  }
  const T = BigInt(total);
  const W = BigInt(weights.reduce((a, b) => a + b, 0));
  const base = weights.map((w) => (T * BigInt(w)) / W);
  const rem = weights.map((w) => (T * BigInt(w)) % W);
  const order = weights
    .map((_, i) => i)
    .sort((i, j) => {
      const diff = rem[j]! - rem[i]!;
      return diff === 0n ? i - j : diff > 0n ? 1 : -1;
    });
  const out = base.map(Number);
  let leftover = Number(T - base.reduce((a, b) => a + b, 0n));
  for (let k = 0; leftover > 0; k++, leftover--) {
    const i = order[k]!;
    out[i] = out[i]! + 1;
  }
  return out;
}

export type Shares = { mode: "equal" } | { mode: "custom"; bp: readonly BasisPoints[] };

/** Split total across `count` people. Equal splits divide by head-count directly. */
export function splitByShares(total: number, count: number, shares: Shares): number[] {
  if (shares.mode === "equal") return splitWeighted(total, Array.from({ length: count }, () => 1));
  if (shares.bp.length !== count) throw new RangeError("one share per person is required");
  if (shares.bp.reduce((a, b) => a + b, 0) !== 10_000) throw new RangeError("custom shares must total 100%");
  return splitWeighted(total, shares.bp);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/domain/split.test.ts` — Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/domain/split.ts src/domain/split.test.ts
git commit -m "feat(domain): largest-remainder splitting with property tests

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Rate lookup

**Files:**
- Create: `src/domain/rates.ts`
- Test: `src/domain/rates.test.ts`

**Interfaces:**
- Produces: `interface RateRecord { id: string; crewMemberId: string; basis: RateBasis; unit: Unit | null; amountCents: Cents; effectiveFrom: LocalDate; projectId: string | null }`; `interface RateQuery { crewMemberId: string; basis: RateBasis; unit: Unit | null; projectId: string; date: LocalDate }`; `resolveRate(rates: readonly RateRecord[], q: RateQuery): RateRecord | null`.

- [ ] **Step 1: Write the failing tests**

`src/domain/rates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveRate, type RateRecord } from "./rates";

const rate = (p: Partial<RateRecord> & Pick<RateRecord, "id" | "amountCents" | "effectiveFrom">): RateRecord => ({
  crewMemberId: "sam",
  basis: "daily",
  unit: null,
  projectId: null,
  ...p,
});

const rates: RateRecord[] = [
  rate({ id: "d1", amountCents: 30000, effectiveFrom: "2026-07-01" }),
  rate({ id: "d2", amountCents: 32000, effectiveFrom: "2026-09-15" }),
  rate({ id: "ryde", amountCents: 36000, effectiveFrom: "2026-09-01", projectId: "ryde" }),
  rate({ id: "m2", basis: "per_unit", unit: "m2", amountCents: 950, effectiveFrom: "2026-07-01" }),
];

describe("resolveRate", () => {
  it("E1.1 uses the latest default rate effective on or before the log date", () => {
    const q = { crewMemberId: "sam", basis: "daily", unit: null, projectId: "smith" } as const;
    expect(resolveRate(rates, { ...q, date: "2026-09-12" })?.amountCents).toBe(30000);
    expect(resolveRate(rates, { ...q, date: "2026-09-15" })?.amountCents).toBe(32000);
  });
  it("E1.2 prefers a project override on that project only", () => {
    const q = { crewMemberId: "sam", basis: "daily", unit: null, date: "2026-09-16" } as const;
    expect(resolveRate(rates, { ...q, projectId: "ryde" })?.amountCents).toBe(36000);
    expect(resolveRate(rates, { ...q, projectId: "smith" })?.amountCents).toBe(32000);
  });
  it("matches unit for per-unit rates", () => {
    const q = { crewMemberId: "sam", basis: "per_unit", projectId: "smith", date: "2026-09-16" } as const;
    expect(resolveRate(rates, { ...q, unit: "m2" })?.amountCents).toBe(950);
    expect(resolveRate(rates, { ...q, unit: "lm" })).toBeNull();
  });
  it("does not depend on the order rates are stored in", () => {
    const q = { crewMemberId: "sam", basis: "daily", unit: null, projectId: "smith", date: "2026-09-16" } as const;
    expect(resolveRate([...rates].reverse(), q)?.amountCents).toBe(32000);
  });
  it("returns null before any rate is effective or for another person", () => {
    expect(
      resolveRate(rates, { crewMemberId: "sam", basis: "daily", unit: null, projectId: "smith", date: "2026-06-30" }),
    ).toBeNull();
    expect(
      resolveRate(rates, { crewMemberId: "tom", basis: "daily", unit: null, projectId: "smith", date: "2026-09-16" }),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/domain/rates.test.ts` — Expected: FAIL, cannot resolve `./rates`.

- [ ] **Step 3: Implement**

`src/domain/rates.ts`:

```ts
import type { Cents, LocalDate, RateBasis, Unit } from "./types";

export interface RateRecord {
  id: string;
  crewMemberId: string;
  basis: RateBasis;
  unit: Unit | null;
  amountCents: Cents;
  effectiveFrom: LocalDate;
  projectId: string | null;
}

export interface RateQuery {
  crewMemberId: string;
  basis: RateBasis;
  unit: Unit | null;
  projectId: string;
  date: LocalDate;
}

function latest(list: readonly RateRecord[]): RateRecord | null {
  return list.reduce<RateRecord | null>(
    (best, r) => (best === null || r.effectiveFrom > best.effectiveFrom ? r : best),
    null,
  );
}

/** Pay rules §1: project override first, then default; latest effective_from ≤ date. */
export function resolveRate(rates: readonly RateRecord[], q: RateQuery): RateRecord | null {
  const candidates = rates.filter(
    (r) => r.crewMemberId === q.crewMemberId && r.basis === q.basis && r.unit === q.unit && r.effectiveFrom <= q.date,
  );
  return (
    latest(candidates.filter((r) => r.projectId === q.projectId)) ??
    latest(candidates.filter((r) => r.projectId === null))
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/domain/rates.test.ts` — Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/domain/rates.ts src/domain/rates.test.ts
git commit -m "feat(domain): rate lookup with project overrides and effective dates

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Line amounts and default hours

**Files:**
- Create: `src/domain/lines.ts`
- Test: `src/domain/lines.test.ts`

**Interfaces:**
- Consumes: `mulDivRound` (Task 1).
- Produces: `hourlyAmount(hours: Hundredths, rateCents: Cents, multiplier?: Hundredths): Cents`, `dailyAmount(days: Hundredths, rateCents: Cents): Cents`, `perUnitAmount(quantity: Hundredths, rateCents: Cents): Cents`, `defaultHours(days: Hundredths, standardDayHours: Hundredths): Hundredths`.

- [ ] **Step 1: Write the failing tests**

`src/domain/lines.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { dailyAmount, defaultHours, hourlyAmount, perUnitAmount } from "./lines";

describe("hourly", () => {
  it("E2.1 Jake 7.5 h × $24.00 = $180.00", () => {
    expect(hourlyAmount(750, 2400)).toBe(18000);
  });
  it("E2.2 overtime 2 h × $24.00 × 1.5 = $72.00", () => {
    expect(hourlyAmount(200, 2400, 150)).toBe(7200);
  });
  it("rejects hours not in 0.25 steps and out-of-range multipliers", () => {
    expect(() => hourlyAmount(760, 2400)).toThrow(RangeError);
    expect(() => hourlyAmount(0, 2400)).toThrow(RangeError);
    expect(() => hourlyAmount(100, 2400, 90)).toThrow(RangeError);
    expect(() => hourlyAmount(100, 2400, 310)).toThrow(RangeError);
  });
});

describe("daily", () => {
  it("E3.1 Sam 1 day = $320.00 with 8.0 default hours", () => {
    expect(dailyAmount(100, 32000)).toBe(32000);
    expect(defaultHours(100, 800)).toBe(800);
  });
  it("E3.2 Sam ½ day = $160.00 with 4.0 default hours", () => {
    expect(dailyAmount(50, 32000)).toBe(16000);
    expect(defaultHours(50, 800)).toBe(400);
  });
  it("rejects days other than 1 or ½", () => {
    expect(() => dailyAmount(75, 32000)).toThrow(RangeError);
  });
});

describe("per unit", () => {
  it("multiplies quantity by rate", () => {
    expect(perUnitAmount(6000, 950)).toBe(57000);
  });
  it("rejects non-positive quantities", () => {
    expect(() => perUnitAmount(0, 950)).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/domain/lines.test.ts` — Expected: FAIL, cannot resolve `./lines`.

- [ ] **Step 3: Implement**

`src/domain/lines.ts`:

```ts
import { mulDivRound } from "./money";
import type { Cents, Hundredths } from "./types";

/** Pay rules §2. hours in 0.25 steps; multiplier 1.0–3.0 (default 1.0). */
export function hourlyAmount(hours: Hundredths, rateCents: Cents, multiplier: Hundredths = 100): Cents {
  if (hours <= 0 || hours % 25 !== 0) throw new RangeError("hours must be positive, in 0.25 steps");
  if (multiplier < 100 || multiplier > 300) throw new RangeError("multiplier must be between 1.0 and 3.0");
  return mulDivRound(hours * multiplier, rateCents, 10_000);
}

/** Pay rules §3. days ∈ {1, ½}. */
export function dailyAmount(days: Hundredths, rateCents: Cents): Cents {
  if (days !== 100 && days !== 50) throw new RangeError("days must be 1 or 0.5");
  return mulDivRound(days, rateCents, 100);
}

/** Pay rules §4. */
export function perUnitAmount(quantity: Hundredths, rateCents: Cents): Cents {
  if (quantity <= 0) throw new RangeError("quantity must be positive");
  return mulDivRound(quantity, rateCents, 100);
}

/** Hours pre-filled on the grid = days × standard day hours. */
export function defaultHours(days: Hundredths, standardDayHours: Hundredths): Hundredths {
  return mulDivRound(days, standardDayHours, 100);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/domain/lines.test.ts` — Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/domain/lines.ts src/domain/lines.test.ts
git commit -m "feat(domain): hourly, daily and per-unit line amounts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Piece-rate and lump-sum lines

**Files:**
- Create: `src/domain/piece.ts`
- Test: `src/domain/piece.test.ts`

**Interfaces:**
- Consumes: `splitByShares`, `Shares` (Task 2); `perUnitAmount` (Task 4).
- Produces: `interface SplitMember { crewMemberId: string; rateCents: Cents | null }`; `interface PieceLine { crewMemberId: string; quantity: Hundredths; hours: 0; rateCents: Cents | null; amountCents: Cents; missingRate: boolean }`; `pieceRateLines(quantity: Hundredths, unit: Unit, members: readonly SplitMember[], shares: Shares): PieceLine[]`; `interface LumpLine { crewMemberId: string; amountCents: Cents; hours: 0 }`; `lumpSumLines(amountCents: Cents, crewMemberIds: readonly string[], shares: Shares): LumpLine[]`.

- [ ] **Step 1: Write the failing tests**

`src/domain/piece.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { lumpSumLines, pieceRateLines } from "./piece";

describe("pieceRateLines", () => {
  it("E4.1 120 m² split equally between Sam and Dima", () => {
    const lines = pieceRateLines(
      12000,
      "m2",
      [
        { crewMemberId: "sam", rateCents: 950 },
        { crewMemberId: "dima", rateCents: 1200 },
      ],
      { mode: "equal" },
    );
    expect(lines.map((l) => [l.quantity, l.amountCents])).toEqual([
      [6000, 57000],
      [6000, 72000],
    ]);
    expect(lines.every((l) => l.hours === 0)).toBe(true);
  });
  it("E4.2 100 m² split three ways gives the extra 0.01 m² to the first person", () => {
    const lines = pieceRateLines(
      10000,
      "m2",
      [
        { crewMemberId: "sam", rateCents: 950 },
        { crewMemberId: "dima", rateCents: 1200 },
        { crewMemberId: "tom", rateCents: 900 },
      ],
      { mode: "equal" },
    );
    expect(lines.map((l) => [l.quantity, l.amountCents])).toEqual([
      [3334, 31673],
      [3333, 39996],
      [3333, 29997],
    ]);
  });
  it("E4.3 custom split with a missing rate saves $0.00 and flags it", () => {
    const lines = pieceRateLines(
      8000,
      "lm",
      [
        { crewMemberId: "lee", rateCents: 800 },
        { crewMemberId: "jake", rateCents: null },
      ],
      { mode: "custom", bp: [7500, 2500] },
    );
    expect(lines).toEqual([
      { crewMemberId: "lee", quantity: 6000, hours: 0, rateCents: 800, amountCents: 48000, missingRate: false },
      { crewMemberId: "jake", quantity: 2000, hours: 0, rateCents: null, amountCents: 0, missingRate: true },
    ]);
  });
  it("splits 'each' in whole units", () => {
    const lines = pieceRateLines(
      500,
      "each",
      [
        { crewMemberId: "a", rateCents: 100 },
        { crewMemberId: "b", rateCents: 100 },
      ],
      { mode: "equal" },
    );
    expect(lines.map((l) => l.quantity)).toEqual([300, 200]);
  });
  it("rejects empty crews, non-positive and fractional 'each' quantities", () => {
    expect(() => pieceRateLines(100, "m2", [], { mode: "equal" })).toThrow(RangeError);
    expect(() => pieceRateLines(0, "m2", [{ crewMemberId: "a", rateCents: 1 }], { mode: "equal" })).toThrow(
      RangeError,
    );
    expect(() => pieceRateLines(150, "each", [{ crewMemberId: "a", rateCents: 1 }], { mode: "equal" })).toThrow(
      RangeError,
    );
  });
});

describe("lumpSumLines", () => {
  it("E5.1 $2,000 split equally between three people", () => {
    expect(lumpSumLines(200_000, ["sam", "tom", "dima"], { mode: "equal" })).toEqual([
      { crewMemberId: "sam", amountCents: 66667, hours: 0 },
      { crewMemberId: "tom", amountCents: 66667, hours: 0 },
      { crewMemberId: "dima", amountCents: 66666, hours: 0 },
    ]);
  });
  it("rejects an empty crew", () => {
    expect(() => lumpSumLines(100, [], { mode: "equal" })).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/domain/piece.test.ts` — Expected: FAIL, cannot resolve `./piece`.

- [ ] **Step 3: Implement**

`src/domain/piece.ts`:

```ts
import { perUnitAmount } from "./lines";
import { splitByShares, type Shares } from "./split";
import type { Cents, Hundredths, Unit } from "./types";

export interface SplitMember {
  crewMemberId: string;
  rateCents: Cents | null;
}

export interface PieceLine {
  crewMemberId: string;
  quantity: Hundredths;
  hours: 0;
  rateCents: Cents | null;
  amountCents: Cents;
  missingRate: boolean;
}

/** Pay rules §4. Hours are 0: the crew-day grid records hours once (E4.4). */
export function pieceRateLines(
  quantity: Hundredths,
  unit: Unit,
  members: readonly SplitMember[],
  shares: Shares,
): PieceLine[] {
  if (members.length === 0) throw new RangeError("at least one crew member is required");
  if (quantity <= 0) throw new RangeError("quantity must be positive");
  const step = unit === "each" ? 100 : 1;
  if (quantity % step !== 0) throw new RangeError("'each' quantities must be whole numbers");
  const parts = splitByShares(quantity / step, members.length, shares).map((q) => q * step);
  return members.map((m, i) => {
    const q = parts[i]!;
    return {
      crewMemberId: m.crewMemberId,
      quantity: q,
      hours: 0,
      rateCents: m.rateCents,
      amountCents: m.rateCents === null ? 0 : perUnitAmount(q, m.rateCents),
      missingRate: m.rateCents === null,
    };
  });
}

export interface LumpLine {
  crewMemberId: string;
  amountCents: Cents;
  hours: 0;
}

/** Pay rules §5. */
export function lumpSumLines(amountCents: Cents, crewMemberIds: readonly string[], shares: Shares): LumpLine[] {
  if (crewMemberIds.length === 0) throw new RangeError("at least one crew member is required");
  const parts = splitByShares(amountCents, crewMemberIds.length, shares);
  return crewMemberIds.map((crewMemberId, i) => ({ crewMemberId, amountCents: parts[i]!, hours: 0 }));
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/domain/piece.test.ts` — Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/domain/piece.ts src/domain/piece.test.ts
git commit -m "feat(domain): piece-rate and lump-sum crew lines

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: GST and per-person totals

**Files:**
- Create: `src/domain/gst.ts`
- Test: `src/domain/gst.test.ts`

**Interfaces:**
- Consumes: `mulDivRound` (Task 1).
- Produces: `GST_RATE_BP = 1000`; `gstOn(exGstCents: Cents): Cents`; `gstIncludedIn(totalCents: Cents): Cents`; `interface PersonTotals { subtotalCents: Cents; gstCents: Cents; reimbursementsCents: Cents; totalCents: Cents }`; `personTotals(person: { type: WorkerType; gstRegistered: boolean }, subtotalCents: Cents, reimbursementsCents: Cents): PersonTotals`.

- [ ] **Step 1: Write the failing tests**

`src/domain/gst.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { gstIncludedIn, gstOn, personTotals } from "./gst";

const dima = { type: "contractor", gstRegistered: true } as const;
const lee = { type: "contractor", gstRegistered: false } as const;
const jake = { type: "employee", gstRegistered: false } as const;

describe("GST", () => {
  it("E6.1 Dima subtotal $1,520.00 → GST $152.00 → total $1,672.00", () => {
    expect(personTotals(dima, 152_000, 0)).toEqual({
      subtotalCents: 152_000,
      gstCents: 15_200,
      reimbursementsCents: 0,
      totalCents: 167_200,
    });
  });
  it("E6.2 Lee (not registered) subtotal $1,050.00 → no GST", () => {
    expect(personTotals(lee, 105_000, 0).totalCents).toBe(105_000);
  });
  it("E7.1 reimbursement $110.00 is added after GST, with no GST on top", () => {
    expect(personTotals(dima, 152_000, 11_000).totalCents).toBe(178_200);
    expect(gstIncludedIn(11_000)).toBe(1_000);
  });
  it("employees never get GST", () => {
    expect(personTotals(jake, 18_000, 0).gstCents).toBe(0);
  });
  it("rounds GST on negative subtotals symmetrically", () => {
    expect(gstOn(-1_005)).toBe(-101);
    expect(gstOn(1_005)).toBe(101);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/domain/gst.test.ts` — Expected: FAIL, cannot resolve `./gst`.

- [ ] **Step 3: Implement**

`src/domain/gst.ts`:

```ts
import { mulDivRound } from "./money";
import type { Cents, WorkerType } from "./types";

export const GST_RATE_BP = 1000;

export function gstOn(exGstCents: Cents): Cents {
  return mulDivRound(exGstCents, GST_RATE_BP, 10_000);
}

/** GST contained in a GST-inclusive total (total ÷ 11). */
export function gstIncludedIn(totalCents: Cents): Cents {
  return mulDivRound(totalCents, 1, 11);
}

export interface PersonTotals {
  subtotalCents: Cents;
  gstCents: Cents;
  reimbursementsCents: Cents;
  totalCents: Cents;
}

/** Pay rules §6–§7. */
export function personTotals(
  person: { type: WorkerType; gstRegistered: boolean },
  subtotalCents: Cents,
  reimbursementsCents: Cents,
): PersonTotals {
  const gstCents = person.type === "contractor" && person.gstRegistered ? gstOn(subtotalCents) : 0;
  return {
    subtotalCents,
    gstCents,
    reimbursementsCents,
    totalCents: subtotalCents + gstCents + reimbursementsCents,
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/domain/gst.test.ts` — Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/domain/gst.ts src/domain/gst.test.ts
git commit -m "feat(domain): GST and per-person pay totals

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Job costing

**Files:**
- Create: `src/domain/costing.ts`
- Test: `src/domain/costing.test.ts`

**Interfaces:**
- Consumes: `mulDivRound` (Task 1), `gstOn` (Task 6).
- Produces: `interface CostContext { workspaceGstRegistered: boolean; onCostBp: BasisPoints }`; `labourCost(amountCents: Cents, worker: { type: WorkerType; gstRegistered: boolean }, ctx: CostContext): Cents`; `expenseCost(exGstCents: Cents, gstCents: Cents, workspaceGstRegistered: boolean): Cents`.

- [ ] **Step 1: Write the failing tests**

`src/domain/costing.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { expenseCost, labourCost } from "./costing";

const employee = { type: "employee", gstRegistered: false } as const;
const gstContractor = { type: "contractor", gstRegistered: true } as const;
const registered = { workspaceGstRegistered: true, onCostBp: 2500 };
const unregistered = { workspaceGstRegistered: false, onCostBp: 2500 };

describe("labourCost", () => {
  it("E11.1 Sam $570.00 × 1.25 + Dima $720.00 = $1,432.50", () => {
    expect(labourCost(57_000, employee, registered) + labourCost(72_000, gstContractor, registered)).toBe(143_250);
  });
  it("E11.2 unregistered workspace pays GST as a real cost: $1,504.50", () => {
    expect(labourCost(57_000, employee, unregistered) + labourCost(72_000, gstContractor, unregistered)).toBe(
      150_450,
    );
  });
  it("E8.1 a +$12.00 adjustment adds $15.00 of job cost", () => {
    expect(labourCost(1_200, employee, registered)).toBe(1_500);
  });
  it("non-registered contractors cost exactly their amount", () => {
    expect(labourCost(105_000, { type: "contractor", gstRegistered: false }, unregistered)).toBe(105_000);
  });
});

describe("expenseCost", () => {
  it("is ex GST for registered workspaces and incl. GST otherwise", () => {
    expect(expenseCost(10_000, 1_000, true)).toBe(10_000);
    expect(expenseCost(10_000, 1_000, false)).toBe(11_000);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/domain/costing.test.ts` — Expected: FAIL, cannot resolve `./costing`.

- [ ] **Step 3: Implement**

`src/domain/costing.ts`:

```ts
import { gstOn } from "./gst";
import { mulDivRound } from "./money";
import type { BasisPoints, Cents, WorkerType } from "./types";

export interface CostContext {
  workspaceGstRegistered: boolean;
  onCostBp: BasisPoints;
}

/** Pay rules §11. */
export function labourCost(
  amountCents: Cents,
  worker: { type: WorkerType; gstRegistered: boolean },
  ctx: CostContext,
): Cents {
  if (worker.type === "employee") return mulDivRound(amountCents, 10_000 + ctx.onCostBp, 10_000);
  if (worker.gstRegistered && !ctx.workspaceGstRegistered) return amountCents + gstOn(amountCents);
  return amountCents;
}

export function expenseCost(exGstCents: Cents, gstCents: Cents, workspaceGstRegistered: boolean): Cents {
  return workspaceGstRegistered ? exGstCents : exGstCents + gstCents;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/domain/costing.test.ts` — Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/domain/costing.ts src/domain/costing.test.ts
git commit -m "feat(domain): labour and expense job costing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Local dates, working days and "today" in the workspace timezone

**Files:**
- Create: `src/domain/dates.ts`
- Test: `src/domain/dates.test.ts`

**Interfaces:**
- Produces: `addDays(d: LocalDate, n: number): LocalDate`, `dayOfWeek(d: LocalDate): number` (0 = Sun … 6 = Sat), `daysBetween(a: LocalDate, b: LocalDate): number`, `eachDay(start: LocalDate, endExclusive: LocalDate): LocalDate[]`, `countWorkingDays(start: LocalDate, endExclusive: LocalDate, workingDays: readonly number[]): number`, `todayIn(timeZone: string, now: Date): LocalDate`.

- [ ] **Step 1: Write the failing tests**

`src/domain/dates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { addDays, countWorkingDays, dayOfWeek, daysBetween, eachDay, todayIn } from "./dates";

const MON_FRI = [1, 2, 3, 4, 5];

describe("local dates", () => {
  it("adds days across month ends", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
  });
  it("knows the weekday", () => {
    expect(dayOfWeek("2026-09-28")).toBe(1);
    expect(dayOfWeek("2026-09-27")).toBe(0);
  });
  it("counts days between dates", () => {
    expect(daysBetween("2026-09-20", "2026-09-28")).toBe(8);
    expect(daysBetween("2026-09-28", "2026-09-20")).toBe(-8);
  });
  it("lists each day in a half-open range", () => {
    expect(eachDay("2026-09-07", "2026-09-10")).toEqual(["2026-09-07", "2026-09-08", "2026-09-09"]);
    expect(eachDay("2026-09-10", "2026-09-10")).toEqual([]);
  });
  it("counts working days", () => {
    expect(countWorkingDays("2026-09-07", "2026-09-14", MON_FRI)).toBe(5);
  });
  it("rejects malformed and impossible dates", () => {
    expect(() => addDays("2026-9-1", 1)).toThrow(RangeError);
    expect(() => addDays("2026-02-30", 1)).toThrow(RangeError);
  });
});

describe("todayIn", () => {
  it("returns Sydney's date when UTC is still the previous day (Review Focus 1)", () => {
    expect(todayIn("Australia/Sydney", new Date("2026-09-27T20:00:00Z"))).toBe("2026-09-28");
  });
  it("returns the previous day just before Sydney midnight", () => {
    expect(todayIn("Australia/Sydney", new Date("2026-09-27T13:59:00Z"))).toBe("2026-09-27");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/domain/dates.test.ts` — Expected: FAIL, cannot resolve `./dates`.

- [ ] **Step 3: Implement**

`src/domain/dates.ts`:

```ts
import type { LocalDate } from "./types";

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

function toUtc(d: LocalDate): Date {
  const m = ISO.exec(d);
  if (!m) throw new RangeError(`Invalid date: ${d}`);
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (date.toISOString().slice(0, 10) !== d) throw new RangeError(`Invalid date: ${d}`);
  return date;
}

const fromUtc = (date: Date): LocalDate => date.toISOString().slice(0, 10);

export function addDays(d: LocalDate, n: number): LocalDate {
  return fromUtc(new Date(toUtc(d).getTime() + n * DAY_MS));
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(d: LocalDate): number {
  return toUtc(d).getUTCDay();
}

export function daysBetween(a: LocalDate, b: LocalDate): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / DAY_MS);
}

export function eachDay(start: LocalDate, endExclusive: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  for (let d = start; d < endExclusive; d = addDays(d, 1)) out.push(d);
  return out;
}

export function countWorkingDays(start: LocalDate, endExclusive: LocalDate, workingDays: readonly number[]): number {
  return eachDay(start, endExclusive).filter((d) => workingDays.includes(dayOfWeek(d))).length;
}

/** The calendar date in `timeZone` at instant `now`. Never use the server's local date. */
export function todayIn(timeZone: string, now: Date): LocalDate {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/domain/dates.test.ts` — Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/domain/dates.ts src/domain/dates.test.ts
git commit -m "feat(domain): local-date arithmetic and timezone-aware today

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Stage segments, pauses and lost days

**Files:**
- Create: `src/domain/segments.ts`
- Test: `src/domain/segments.test.ts`

**Interfaces:**
- Consumes: `addDays`, `countWorkingDays` (Task 8); `sum` (Task 1).
- Produces: `type PauseReason = "weather" | "materials" | "client" | "other_job" | "other"`; `interface StageSegment { start: LocalDate; end: LocalDate | null; pauseReason: PauseReason | null }` (half-open `[start, end)`; `pauseReason` = why this segment ended, null if it ended by Done or is open); `interface PausePeriod { start: LocalDate; end: LocalDate; reason: PauseReason; ongoing: boolean }`; `isActiveOn(segments, date): boolean`; `realWorkingDays(segments, workingDays, asOf): number`; `pausePeriods(segments, asOf): PausePeriod[]`; `lostWorkingDays(segments, workingDays, asOf): Record<PauseReason, number>`; `PAUSED_TOO_LONG_DAYS = 5`; `pausedTooLong(segments, workingDays, asOf): boolean`.

- [ ] **Step 1: Write the failing tests**

`src/domain/segments.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  isActiveOn,
  lostWorkingDays,
  pausedTooLong,
  pausePeriods,
  realWorkingDays,
  type StageSegment,
} from "./segments";

const MON_FRI = [1, 2, 3, 4, 5];
// E13.1: active Mon 7–Wed 9, paused Thu 10 (weather), resumed Tue 15, Done Thu 17 (end = 18).
const sheetInstall: StageSegment[] = [
  { start: "2026-09-15", end: "2026-09-18", pauseReason: null },
  { start: "2026-09-07", end: "2026-09-10", pauseReason: "weather" },
];

describe("segments", () => {
  it("E13.1 real working days = 6", () => {
    expect(realWorkingDays(sheetInstall, MON_FRI, "2026-09-30")).toBe(6);
  });
  it("E13.1 days lost to weather = 3", () => {
    expect(lostWorkingDays(sheetInstall, MON_FRI, "2026-09-30")).toEqual({
      weather: 3,
      materials: 0,
      client: 0,
      other_job: 0,
      other: 0,
    });
  });
  it("knows whether a stage was active on a date", () => {
    expect(isActiveOn(sheetInstall, "2026-09-09")).toBe(true);
    expect(isActiveOn(sheetInstall, "2026-09-10")).toBe(false);
    expect(isActiveOn(sheetInstall, "2026-09-17")).toBe(true);
    expect(isActiveOn(sheetInstall, "2026-09-18")).toBe(false);
    expect(isActiveOn([{ start: "2026-09-01", end: null, pauseReason: null }], "2027-01-01")).toBe(true);
    expect(isActiveOn([], "2026-09-01")).toBe(false);
  });
  it("counts an open segment up to and including asOf", () => {
    expect(realWorkingDays([{ start: "2026-09-28", end: null, pauseReason: null }], MON_FRI, "2026-09-30")).toBe(3);
  });
  it("reports an ongoing pause and whether it is too long (> 5 working days)", () => {
    const paused: StageSegment[] = [{ start: "2026-09-21", end: "2026-09-22", pauseReason: "materials" }];
    expect(pausePeriods(paused, "2026-09-28")).toEqual([
      { start: "2026-09-22", end: "2026-09-29", reason: "materials", ongoing: true },
    ]);
    expect(pausedTooLong(paused, MON_FRI, "2026-09-28")).toBe(false);
    expect(pausedTooLong(paused, MON_FRI, "2026-09-29")).toBe(true);
    expect(pausedTooLong(sheetInstall, MON_FRI, "2026-09-30")).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/domain/segments.test.ts` — Expected: FAIL, cannot resolve `./segments`.

- [ ] **Step 3: Implement**

`src/domain/segments.ts`:

```ts
import { addDays, countWorkingDays } from "./dates";
import { sum } from "./money";
import type { LocalDate } from "./types";

export type PauseReason = "weather" | "materials" | "client" | "other_job" | "other";

/** Half-open [start, end). pauseReason = why this segment ended (null if Done or still open). */
export interface StageSegment {
  start: LocalDate;
  end: LocalDate | null;
  pauseReason: PauseReason | null;
}

export interface PausePeriod {
  start: LocalDate;
  end: LocalDate;
  reason: PauseReason;
  ongoing: boolean;
}

export const PAUSED_TOO_LONG_DAYS = 5;

const byStart = (segments: readonly StageSegment[]) => [...segments].sort((a, b) => a.start.localeCompare(b.start));

export function isActiveOn(segments: readonly StageSegment[], date: LocalDate): boolean {
  return segments.some((s) => s.start <= date && (s.end === null || date < s.end));
}

export function realWorkingDays(
  segments: readonly StageSegment[],
  workingDays: readonly number[],
  asOf: LocalDate,
): number {
  return sum(segments.map((s) => countWorkingDays(s.start, s.end ?? addDays(asOf, 1), workingDays)));
}

export function pausePeriods(segments: readonly StageSegment[], asOf: LocalDate): PausePeriod[] {
  const sorted = byStart(segments);
  return sorted.flatMap((s, i) => {
    if (s.end === null || s.pauseReason === null) return [];
    const next = sorted[i + 1];
    return [{ start: s.end, end: next ? next.start : addDays(asOf, 1), reason: s.pauseReason, ongoing: !next }];
  });
}

export function lostWorkingDays(
  segments: readonly StageSegment[],
  workingDays: readonly number[],
  asOf: LocalDate,
): Record<PauseReason, number> {
  const lost: Record<PauseReason, number> = { weather: 0, materials: 0, client: 0, other_job: 0, other: 0 };
  for (const p of pausePeriods(segments, asOf)) lost[p.reason] += countWorkingDays(p.start, p.end, workingDays);
  return lost;
}

export function pausedTooLong(
  segments: readonly StageSegment[],
  workingDays: readonly number[],
  asOf: LocalDate,
): boolean {
  const ongoing = pausePeriods(segments, asOf).find((p) => p.ongoing);
  return ongoing !== undefined && countWorkingDays(ongoing.start, ongoing.end, workingDays) > PAUSED_TOO_LONG_DAYS;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/domain/segments.test.ts` — Expected: all pass. (Check: paused from Tue 22 Sep; asOf Mon 28 → Tue–Fri 4 + Mon 1 = 5 → not too long; asOf Tue 29 → 6 → too long.)

- [ ] **Step 5: Commit**

```bash
git add src/domain/segments.ts src/domain/segments.test.ts
git commit -m "feat(domain): stage segments, pause periods and lost days

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Progress, forecasts, budget alerts and margins

**Files:**
- Create: `src/domain/progress.ts`
- Test: `src/domain/progress.test.ts`

**Interfaces:**
- Consumes: `mulDivRound`, `sum` (Task 1).
- Produces: `type StageStatus = "not_started" | "active" | "paused" | "done"`; `interface StageProgressInput { status: StageStatus; unit: Unit | null; budgetQty: Hundredths | null; measuredQty: Hundredths; manualPctBp: BasisPoints | null }`; `stagePercentBp(s): BasisPoints`; `projectPercentBp(stages: readonly { pctBp: BasisPoints; labourBudgetCents: Cents }[]): BasisPoints`; `FORECAST_MIN_PCT_BP = 1000`; `TRENDING_TOLERANCE_BP = 500`; `forecastLabour(status: StageStatus, pctBp: BasisPoints, actualCents: Cents): Cents | null`; `type BudgetAlert = { level: "over" | "trending"; byCents: Cents } | null`; `budgetAlert(actualCents: Cents, forecastCents: Cents | null, budgetCents: Cents): BudgetAlert`; `interface MarginInput {…}`; `projectMargins(m: MarginInput): { earnedValueCents: Cents; marginToDateCents: Cents; forecastMarginCents: Cents }`.

- [ ] **Step 1: Write the failing tests**

`src/domain/progress.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { budgetAlert, forecastLabour, projectMargins, projectPercentBp, stagePercentBp } from "./progress";

const unitStage = { status: "active", unit: "m2", budgetQty: 40_000, manualPctBp: null } as const;

describe("stage % complete", () => {
  it("E12.1 120 of 400 m² = 30%", () => {
    expect(stagePercentBp({ ...unitStage, measuredQty: 12_000 })).toBe(3000);
  });
  it("caps at 100% and treats Done as 100%", () => {
    expect(stagePercentBp({ ...unitStage, measuredQty: 45_000 })).toBe(10_000);
    expect(stagePercentBp({ ...unitStage, status: "done", measuredQty: 0 })).toBe(10_000);
  });
  it("uses the manual % for no-unit stages, else 0", () => {
    const noUnit = { status: "active", unit: null, budgetQty: null, measuredQty: 0 } as const;
    expect(stagePercentBp({ ...noUnit, manualPctBp: 5000 })).toBe(5000);
    expect(stagePercentBp({ ...noUnit, manualPctBp: null })).toBe(0);
    expect(stagePercentBp({ ...unitStage, budgetQty: 0, measuredQty: 100 })).toBe(0);
  });
});

describe("project % complete", () => {
  it("weights stages by labour budget", () => {
    expect(
      projectPercentBp([
        { pctBp: 10_000, labourBudgetCents: 100_000 },
        { pctBp: 0, labourBudgetCents: 300_000 },
      ]),
    ).toBe(2500);
  });
  it("falls back to a simple average when all budgets are zero, and 0 for no stages", () => {
    expect(
      projectPercentBp([
        { pctBp: 10_000, labourBudgetCents: 0 },
        { pctBp: 0, labourBudgetCents: 0 },
      ]),
    ).toBe(5000);
    expect(projectPercentBp([])).toBe(0);
  });
});

describe("forecast and alerts", () => {
  it("E12.1 forecast $4,775.00 vs budget $4,000.00 → trending over by $775.00", () => {
    const f = forecastLabour("active", 3000, 143_250);
    expect(f).toBe(477_500);
    expect(budgetAlert(143_250, f, 400_000)).toEqual({ level: "trending", byCents: 77_500 });
  });
  it("E12.2 manual 50%, $900 spent of $1,500 → trending over by $300.00", () => {
    const f = forecastLabour("active", 5000, 90_000);
    expect(budgetAlert(90_000, f, 150_000)).toEqual({ level: "trending", byCents: 30_000 });
  });
  it("E12.3 no % set, $1,600 spent of $1,500 → over by $100.00", () => {
    const f = forecastLabour("active", 0, 160_000);
    expect(f).toBeNull();
    expect(budgetAlert(160_000, f, 150_000)).toEqual({ level: "over", byCents: 10_000 });
  });
  it("ignores forecasts within the 5% tolerance and uses actual for Done stages", () => {
    expect(budgetAlert(100_000, 104_000, 100_000)).toBeNull();
    expect(forecastLabour("done", 10_000, 123_400)).toBe(123_400);
    expect(budgetAlert(10_000, null, 100_000)).toBeNull();
  });
});

describe("projectMargins", () => {
  it("computes earned value, margin to date and forecast margin", () => {
    expect(
      projectMargins({
        contractCents: 2_000_000,
        projectPctBp: 3000,
        labourCostCents: 143_250,
        expenseCostCents: 400_000,
        materialsBudgetCents: 800_000,
        materialsExpenseCents: 400_000,
        stages: [
          { forecastCents: 477_500, labourBudgetCents: 400_000, actualLabourCents: 143_250 },
          { forecastCents: null, labourBudgetCents: 300_000, actualLabourCents: 0 },
        ],
      }),
    ).toEqual({ earnedValueCents: 600_000, marginToDateCents: 56_750, forecastMarginCents: 422_500 });
  });
  it("never counts negative remaining materials and uses actual when above budget without a forecast", () => {
    expect(
      projectMargins({
        contractCents: 1_000_000,
        projectPctBp: 0,
        labourCostCents: 0,
        expenseCostCents: 900_000,
        materialsBudgetCents: 500_000,
        materialsExpenseCents: 900_000,
        stages: [{ forecastCents: null, labourBudgetCents: 100_000, actualLabourCents: 200_000 }],
      }).forecastMarginCents,
    ).toBe(1_000_000 - (200_000 + 900_000 + 0));
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/domain/progress.test.ts` — Expected: FAIL, cannot resolve `./progress`.

- [ ] **Step 3: Implement**

`src/domain/progress.ts`:

```ts
import { mulDivRound, sum } from "./money";
import type { BasisPoints, Cents, Hundredths, Unit } from "./types";

export type StageStatus = "not_started" | "active" | "paused" | "done";

export interface StageProgressInput {
  status: StageStatus;
  unit: Unit | null;
  budgetQty: Hundredths | null;
  measuredQty: Hundredths;
  manualPctBp: BasisPoints | null;
}

export const FORECAST_MIN_PCT_BP = 1_000;
export const TRENDING_TOLERANCE_BP = 500;

/** Pay rules §12. */
export function stagePercentBp(s: StageProgressInput): BasisPoints {
  if (s.status === "done") return 10_000;
  if (s.unit !== null && s.budgetQty !== null && s.budgetQty > 0) {
    return Math.min(10_000, mulDivRound(s.measuredQty, 10_000, s.budgetQty));
  }
  return s.manualPctBp ?? 0;
}

export function projectPercentBp(stages: readonly { pctBp: BasisPoints; labourBudgetCents: Cents }[]): BasisPoints {
  if (stages.length === 0) return 0;
  const totalBudget = sum(stages.map((s) => s.labourBudgetCents));
  if (totalBudget === 0) return mulDivRound(sum(stages.map((s) => s.pctBp)), 1, stages.length);
  return mulDivRound(sum(stages.map((s) => s.pctBp * s.labourBudgetCents)), 1, totalBudget);
}

export function forecastLabour(status: StageStatus, pctBp: BasisPoints, actualCents: Cents): Cents | null {
  if (status === "done") return actualCents;
  if (pctBp < FORECAST_MIN_PCT_BP) return null;
  return mulDivRound(actualCents, 10_000, pctBp);
}

export type BudgetAlert = { level: "over" | "trending"; byCents: Cents } | null;

export function budgetAlert(actualCents: Cents, forecastCents: Cents | null, budgetCents: Cents): BudgetAlert {
  if (actualCents > budgetCents) return { level: "over", byCents: actualCents - budgetCents };
  if (forecastCents !== null && forecastCents * 10_000 > budgetCents * (10_000 + TRENDING_TOLERANCE_BP)) {
    return { level: "trending", byCents: forecastCents - budgetCents };
  }
  return null;
}

export interface MarginInput {
  contractCents: Cents;
  projectPctBp: BasisPoints;
  labourCostCents: Cents;
  expenseCostCents: Cents;
  materialsBudgetCents: Cents;
  materialsExpenseCents: Cents;
  stages: readonly { forecastCents: Cents | null; labourBudgetCents: Cents; actualLabourCents: Cents }[];
}

export function projectMargins(m: MarginInput): {
  earnedValueCents: Cents;
  marginToDateCents: Cents;
  forecastMarginCents: Cents;
} {
  const earnedValueCents = mulDivRound(m.contractCents, m.projectPctBp, 10_000);
  const expectedLabour = sum(
    m.stages.map((s) => s.forecastCents ?? Math.max(s.labourBudgetCents, s.actualLabourCents)),
  );
  const remainingMaterials = Math.max(m.materialsBudgetCents - m.materialsExpenseCents, 0);
  return {
    earnedValueCents,
    marginToDateCents: earnedValueCents - (m.labourCostCents + m.expenseCostCents),
    forecastMarginCents: m.contractCents - (expectedLabour + m.expenseCostCents + remainingMaterials),
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/domain/progress.test.ts` — Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/domain/progress.ts src/domain/progress.test.ts
git commit -m "feat(domain): progress, forecasts, budget alerts and margins

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Award floor check

**Files:**
- Create: `src/domain/floor.ts`
- Test: `src/domain/floor.test.ts`

**Interfaces:**
- Consumes: `mulDivRound` (Task 1).
- Produces: `interface FloorResult { effectiveHourlyCents: Cents | null; below: boolean; shortfallCents: Cents }`; `floorCheck(earningsCents: Cents, hours: Hundredths, floorHourlyCents: Cents): FloorResult`.

- [ ] **Step 1: Write the failing tests**

`src/domain/floor.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { floorCheck } from "./floor";

describe("floorCheck", () => {
  it("E10.1 Tom $479.97 over 16 h = $30.00/h, below $32.00 by $32.03", () => {
    expect(floorCheck(47_997, 1_600, 3_200)).toEqual({ effectiveHourlyCents: 3_000, below: true, shortfallCents: 3_203 });
  });
  it("passes when at or above the floor", () => {
    expect(floorCheck(51_200, 1_600, 3_200)).toEqual({ effectiveHourlyCents: 3_200, below: false, shortfallCents: 0 });
  });
  it("cannot run without hours", () => {
    expect(floorCheck(10_000, 0, 3_200)).toEqual({ effectiveHourlyCents: null, below: false, shortfallCents: 0 });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/domain/floor.test.ts` — Expected: FAIL, cannot resolve `./floor`.

- [ ] **Step 3: Implement**

`src/domain/floor.ts`:

```ts
import { mulDivRound } from "./money";
import type { Cents, Hundredths } from "./types";

export interface FloorResult {
  effectiveHourlyCents: Cents | null;
  below: boolean;
  shortfallCents: Cents;
}

/** Pay rules §10. Compares exactly (not via the rounded effective rate). */
export function floorCheck(earningsCents: Cents, hours: Hundredths, floorHourlyCents: Cents): FloorResult {
  if (hours <= 0) return { effectiveHourlyCents: null, below: false, shortfallCents: 0 };
  const requiredX100 = floorHourlyCents * hours;
  const earnedX100 = earningsCents * 100;
  const below = earnedX100 < requiredX100;
  return {
    effectiveHourlyCents: mulDivRound(earningsCents, 100, hours),
    below,
    shortfallCents: below ? mulDivRound(requiredX100 - earnedX100, 1, 100) : 0,
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/domain/floor.test.ts` — Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/domain/floor.ts src/domain/floor.test.ts
git commit -m "feat(domain): award floor check

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Adjustments for locked logs

**Files:**
- Create: `src/domain/adjustments.ts`
- Test: `src/domain/adjustments.test.ts`

**Interfaces:**
- Consumes: `hourlyAmount` (Task 4) in tests only.
- Produces: `interface LogValues { quantity: Hundredths; hours: Hundredths; amountCents: Cents }`; `adjustmentDelta(original: LogValues, edited: LogValues): LogValues | null`; `reversal(original: LogValues): LogValues`.

- [ ] **Step 1: Write the failing tests**

`src/domain/adjustments.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { adjustmentDelta, reversal } from "./adjustments";
import { hourlyAmount } from "./lines";

describe("adjustments", () => {
  it("E8.1 Jake 7.5 h → 8.0 h creates +0.5 h, +$12.00", () => {
    const original = { quantity: 750, hours: 750, amountCents: hourlyAmount(750, 2400) };
    const edited = { quantity: 800, hours: 800, amountCents: hourlyAmount(800, 2400) };
    expect(adjustmentDelta(original, edited)).toEqual({ quantity: 50, hours: 50, amountCents: 1200 });
  });
  it("returns null when nothing changed", () => {
    const v = { quantity: 100, hours: 800, amountCents: 32000 };
    expect(adjustmentDelta(v, { ...v })).toBeNull();
  });
  it("reverses a deleted log exactly, without negative zero", () => {
    expect(reversal({ quantity: 100, hours: 800, amountCents: 32000 })).toEqual({
      quantity: -100,
      hours: -800,
      amountCents: -32000,
    });
    expect(reversal({ quantity: 0, hours: 0, amountCents: 0 })).toEqual({ quantity: 0, hours: 0, amountCents: 0 });
    expect(Object.is(reversal({ quantity: 0, hours: 0, amountCents: 0 }).amountCents, 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/domain/adjustments.test.ts` — Expected: FAIL, cannot resolve `./adjustments`.

- [ ] **Step 3: Implement**

`src/domain/adjustments.ts`:

```ts
import type { Cents, Hundredths } from "./types";

export interface LogValues {
  quantity: Hundredths;
  hours: Hundredths;
  amountCents: Cents;
}

/** Pay rules §8: the difference an edit makes to a locked log, or null if nothing changed. */
export function adjustmentDelta(original: LogValues, edited: LogValues): LogValues | null {
  const delta = {
    quantity: edited.quantity - original.quantity,
    hours: edited.hours - original.hours,
    amountCents: edited.amountCents - original.amountCents,
  };
  return delta.quantity === 0 && delta.hours === 0 && delta.amountCents === 0 ? null : delta;
}

/** Pay rules §8: deleting a locked log. `0 - x` avoids -0. */
export function reversal(original: LogValues): LogValues {
  return { quantity: 0 - original.quantity, hours: 0 - original.hours, amountCents: 0 - original.amountCents };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/domain/adjustments.test.ts` — Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/domain/adjustments.ts src/domain/adjustments.test.ts
git commit -m "feat(domain): adjustment deltas and reversals for locked logs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Pay-run flags and attendance (gaps, utilisation)

**Files:**
- Create: `src/domain/flags.ts`, `src/domain/attendance.ts`
- Test: `src/domain/flags.test.ts`, `src/domain/attendance.test.ts`

**Interfaces:**
- Consumes: `isActiveOn`, `StageSegment` (Task 9); `eachDay`, `dayOfWeek` (Task 8); `mulDivRound` (Task 1).
- Produces (flags): `interface FlagLog { id: string; crewMemberId: string; date: LocalDate; stageId: string; basis: Basis; source: LogSource; entryId: string }`; `interface GroupFlag { crewMemberId: string; date: LocalDate; stageId: string; logIds: string[] }`; `doublePayFlags(logs: readonly FlagLog[]): GroupFlag[]`; `duplicateFlags(logs: readonly FlagLog[]): GroupFlag[]`; `pausedStageFlags(logs: readonly FlagLog[], segmentsByStage: ReadonlyMap<string, readonly StageSegment[]>): string[]`.
- Produces (attendance): `type NoWorkReason = "rain" | "leave" | "sick" | "other"`; `interface CrewActive { crewMemberId: string; activeFrom: LocalDate; activeTo: LocalDate | null }` (activeTo inclusive); `dayKey(crewMemberId: string, date: LocalDate): string`; `interface AttendanceInput { start: LocalDate; endExclusive: LocalDate; workingDays: readonly number[]; loggedDays: ReadonlySet<string>; noWork: ReadonlyMap<string, NoWorkReason> }`; `findGaps(input: AttendanceInput, crew: readonly CrewActive[]): { crewMemberId: string; date: LocalDate }[]`; `utilisation(input: AttendanceInput, crew: CrewActive): { availableDays: number; workedDays: number; bp: BasisPoints | null }`.

- [ ] **Step 1: Write the failing flag tests**

`src/domain/flags.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { doublePayFlags, duplicateFlags, pausedStageFlags, type FlagLog } from "./flags";

const log = (p: Partial<FlagLog> & Pick<FlagLog, "id" | "basis">): FlagLog => ({
  crewMemberId: "sam",
  date: "2026-09-16",
  stageId: "sheet",
  source: "grid",
  entryId: "e1",
  ...p,
});

describe("doublePayFlags", () => {
  it("E4.4 a grid time-only log plus a progress per-unit log is not double pay", () => {
    expect(
      doublePayFlags([
        log({ id: "t", basis: "time_only" }),
        log({ id: "p", basis: "per_unit", source: "progress", entryId: "pe1" }),
      ]),
    ).toEqual([]);
  });
  it("flags daily and per-unit pay on the same stage and date", () => {
    expect(
      doublePayFlags([
        log({ id: "d", basis: "daily" }),
        log({ id: "p", basis: "per_unit", source: "progress", entryId: "pe1" }),
        log({ id: "other-day", basis: "daily", date: "2026-09-17" }),
      ]),
    ).toEqual([{ crewMemberId: "sam", date: "2026-09-16", stageId: "sheet", logIds: ["d", "p"] }]);
  });
  it("ignores adjustments", () => {
    expect(
      doublePayFlags([log({ id: "d", basis: "daily" }), log({ id: "a", basis: "lump_sum", source: "adjustment" })]),
    ).toEqual([]);
  });
});

describe("duplicateFlags", () => {
  it("flags the same person/date/stage/basis entered by two different entries", () => {
    expect(
      duplicateFlags([
        log({ id: "m", basis: "daily", entryId: "manager-grid" }),
        log({ id: "f", basis: "daily", entryId: "foreman-grid" }),
      ]),
    ).toEqual([{ crewMemberId: "sam", date: "2026-09-16", stageId: "sheet", logIds: ["m", "f"] }]);
  });
  it("does not flag logs from the same entry, time-only logs or adjustments", () => {
    expect(
      duplicateFlags([
        log({ id: "a", basis: "hourly", entryId: "g" }),
        log({ id: "b", basis: "hourly", entryId: "g" }),
        log({ id: "t1", basis: "time_only", entryId: "x" }),
        log({ id: "t2", basis: "time_only", entryId: "y" }),
        log({ id: "adj", basis: "hourly", source: "adjustment", entryId: "z" }),
      ]),
    ).toEqual([]);
  });
});

describe("pausedStageFlags", () => {
  it("flags logs dated when the stage was paused, done or never started", () => {
    const segments = new Map([["sheet", [{ start: "2026-09-07", end: "2026-09-10", pauseReason: "weather" as const }]]]);
    expect(
      pausedStageFlags(
        [
          log({ id: "ok", basis: "daily", date: "2026-09-08" }),
          log({ id: "paused", basis: "daily", date: "2026-09-11" }),
          log({ id: "unknown-stage", basis: "daily", stageId: "gutters" }),
          log({ id: "adj", basis: "daily", date: "2026-09-11", source: "adjustment" }),
        ],
        segments,
      ),
    ).toEqual(["paused", "unknown-stage"]);
  });
});
```

- [ ] **Step 2: Write the failing attendance tests**

`src/domain/attendance.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { dayKey, findGaps, utilisation, type AttendanceInput } from "./attendance";

const jake = { crewMemberId: "jake", activeFrom: "2026-01-01", activeTo: null };
const week = (logged: string[], noWork: [string, "rain" | "leave" | "sick" | "other"][]): AttendanceInput => ({
  start: "2026-09-14",
  endExclusive: "2026-09-21",
  workingDays: [1, 2, 3, 4, 5],
  loggedDays: new Set(logged.map((d) => dayKey("jake", d))),
  noWork: new Map(noWork.map(([d, r]) => [dayKey("jake", d), r])),
});

describe("attendance", () => {
  it("E14.1 Mon–Wed logged, Thu rain, Fri nothing → gap Fri, utilisation 60%", () => {
    const input = week(["2026-09-14", "2026-09-15", "2026-09-16"], [["2026-09-17", "rain"]]);
    expect(findGaps(input, [jake])).toEqual([{ crewMemberId: "jake", date: "2026-09-18" }]);
    expect(utilisation(input, jake)).toEqual({ availableDays: 5, workedDays: 3, bp: 6000 });
  });
  it("leave and sick days reduce available days; weekend logs do not count", () => {
    const input = week(["2026-09-14", "2026-09-19"], [
      ["2026-09-15", "leave"],
      ["2026-09-16", "sick"],
    ]);
    expect(utilisation(input, jake)).toEqual({ availableDays: 3, workedDays: 1, bp: 3333 });
  });
  it("ignores days outside a crew member's active range", () => {
    const left = { crewMemberId: "jake", activeFrom: "2026-01-01", activeTo: "2026-09-16" };
    expect(findGaps(week(["2026-09-14", "2026-09-15", "2026-09-16"], []), [left])).toEqual([]);
    const notYet = { crewMemberId: "jake", activeFrom: "2026-10-01", activeTo: null };
    expect(utilisation(week([], []), notYet)).toEqual({ availableDays: 0, workedDays: 0, bp: null });
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm vitest run src/domain/flags.test.ts src/domain/attendance.test.ts` — Expected: FAIL, modules not found.

- [ ] **Step 4: Implement flags**

`src/domain/flags.ts`:

```ts
import { isActiveOn, type StageSegment } from "./segments";
import type { Basis, LocalDate, LogSource } from "./types";

export interface FlagLog {
  id: string;
  crewMemberId: string;
  date: LocalDate;
  stageId: string;
  basis: Basis;
  source: LogSource;
  /** The grid submission or progress entry that created this log. */
  entryId: string;
}

export interface GroupFlag {
  crewMemberId: string;
  date: LocalDate;
  stageId: string;
  logIds: string[];
}

const TIME_BASED: ReadonlySet<Basis> = new Set(["hourly", "daily"]);
const OUTPUT_BASED: ReadonlySet<Basis> = new Set(["per_unit", "lump_sum"]);

function groups(logs: readonly FlagLog[], key: (l: FlagLog) => string): FlagLog[][] {
  const map = new Map<string, FlagLog[]>();
  for (const l of logs) map.set(key(l), [...(map.get(key(l)) ?? []), l]);
  return [...map.values()];
}

const toFlag = (g: FlagLog[]): GroupFlag => ({
  crewMemberId: g[0]!.crewMemberId,
  date: g[0]!.date,
  stageId: g[0]!.stageId,
  logIds: g.map((l) => l.id),
});

/** Pay rules §9: time-based and output-based pay on the same stage and date. */
export function doublePayFlags(logs: readonly FlagLog[]): GroupFlag[] {
  return groups(
    logs.filter((l) => l.source !== "adjustment"),
    (l) => `${l.crewMemberId}|${l.date}|${l.stageId}`,
  )
    .filter((g) => g.some((l) => TIME_BASED.has(l.basis)) && g.some((l) => OUTPUT_BASED.has(l.basis)))
    .map(toFlag);
}

/** Pay rules §9: same person, date, stage and basis created by different entries. */
export function duplicateFlags(logs: readonly FlagLog[]): GroupFlag[] {
  return groups(
    logs.filter((l) => l.source !== "adjustment" && l.basis !== "time_only"),
    (l) => `${l.crewMemberId}|${l.date}|${l.stageId}|${l.basis}`,
  )
    .filter((g) => new Set(g.map((l) => l.entryId)).size > 1)
    .map(toFlag);
}

/** Pay rules §9: logs dated when their stage was not active. */
export function pausedStageFlags(
  logs: readonly FlagLog[],
  segmentsByStage: ReadonlyMap<string, readonly StageSegment[]>,
): string[] {
  return logs
    .filter((l) => l.source !== "adjustment" && !isActiveOn(segmentsByStage.get(l.stageId) ?? [], l.date))
    .map((l) => l.id);
}
```

- [ ] **Step 5: Implement attendance**

`src/domain/attendance.ts`:

```ts
import { dayOfWeek, eachDay } from "./dates";
import { mulDivRound } from "./money";
import type { BasisPoints, LocalDate } from "./types";

export type NoWorkReason = "rain" | "leave" | "sick" | "other";

export interface CrewActive {
  crewMemberId: string;
  activeFrom: LocalDate;
  /** Inclusive. */
  activeTo: LocalDate | null;
}

export interface AttendanceInput {
  start: LocalDate;
  endExclusive: LocalDate;
  workingDays: readonly number[];
  loggedDays: ReadonlySet<string>;
  noWork: ReadonlyMap<string, NoWorkReason>;
}

export const dayKey = (crewMemberId: string, date: LocalDate): string => `${crewMemberId}|${date}`;

function activeWorkingDays(input: AttendanceInput, c: CrewActive): LocalDate[] {
  return eachDay(input.start, input.endExclusive).filter(
    (d) =>
      input.workingDays.includes(dayOfWeek(d)) && d >= c.activeFrom && (c.activeTo === null || d <= c.activeTo),
  );
}

/** Pay rules §14. */
export function findGaps(input: AttendanceInput, crew: readonly CrewActive[]): { crewMemberId: string; date: LocalDate }[] {
  return crew.flatMap((c) =>
    activeWorkingDays(input, c)
      .filter((d) => !input.loggedDays.has(dayKey(c.crewMemberId, d)) && !input.noWork.has(dayKey(c.crewMemberId, d)))
      .map((date) => ({ crewMemberId: c.crewMemberId, date })),
  );
}

/** Pay rules §14: leave/sick reduce availability; rain/other do not; only working days count as worked. */
export function utilisation(
  input: AttendanceInput,
  c: CrewActive,
): { availableDays: number; workedDays: number; bp: BasisPoints | null } {
  const days = activeWorkingDays(input, c);
  const away = (d: LocalDate) => {
    const reason = input.noWork.get(dayKey(c.crewMemberId, d));
    return reason === "leave" || reason === "sick";
  };
  const availableDays = days.filter((d) => !away(d)).length;
  const workedDays = days.filter((d) => input.loggedDays.has(dayKey(c.crewMemberId, d))).length;
  return { availableDays, workedDays, bp: availableDays === 0 ? null : mulDivRound(workedDays, 10_000, availableDays) };
}
```

- [ ] **Step 6: Run to verify pass**

Run: `pnpm vitest run src/domain/flags.test.ts src/domain/attendance.test.ts` — Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/domain/flags.ts src/domain/flags.test.ts src/domain/attendance.ts src/domain/attendance.test.ts
git commit -m "feat(domain): pay-run flags, logging gaps and utilisation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Pay periods

**Files:**
- Create: `src/domain/periods.ts`
- Test: `src/domain/periods.test.ts`

**Interfaces:**
- Consumes: `addDays`, `dayOfWeek`, `daysBetween` (Task 8).
- Produces: `type PayFrequency = "weekly" | "fortnightly"`; `interface PayPeriod { start: LocalDate; end: LocalDate }` (end inclusive); `payPeriodContaining(date: LocalDate, cfg: { frequency: PayFrequency; weekStartDay: number; anchor: LocalDate }): PayPeriod`.

- [ ] **Step 1: Write the failing tests**

`src/domain/periods.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { payPeriodContaining } from "./periods";

describe("payPeriodContaining", () => {
  it("weekly Mon–Sun", () => {
    expect(payPeriodContaining("2026-09-30", { frequency: "weekly", weekStartDay: 1, anchor: "2026-01-05" })).toEqual({
      start: "2026-09-28",
      end: "2026-10-04",
    });
  });
  it("weekly starting Sunday, with an anchor that is not a Sunday", () => {
    expect(payPeriodContaining("2026-09-30", { frequency: "weekly", weekStartDay: 0, anchor: "2026-09-14" })).toEqual({
      start: "2026-09-27",
      end: "2026-10-03",
    });
  });
  it("fortnightly from an anchor, including dates before the anchor", () => {
    const cfg = { frequency: "fortnightly", weekStartDay: 1, anchor: "2026-09-14" } as const;
    expect(payPeriodContaining("2026-09-30", cfg)).toEqual({ start: "2026-09-28", end: "2026-10-11" });
    expect(payPeriodContaining("2026-09-10", cfg)).toEqual({ start: "2026-08-31", end: "2026-09-13" });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/domain/periods.test.ts` — Expected: FAIL, cannot resolve `./periods`.

- [ ] **Step 3: Implement**

`src/domain/periods.ts`:

```ts
import { addDays, dayOfWeek, daysBetween } from "./dates";
import type { LocalDate } from "./types";

export type PayFrequency = "weekly" | "fortnightly";

/** Inclusive start and end. */
export interface PayPeriod {
  start: LocalDate;
  end: LocalDate;
}

export function payPeriodContaining(
  date: LocalDate,
  cfg: { frequency: PayFrequency; weekStartDay: number; anchor: LocalDate },
): PayPeriod {
  const length = cfg.frequency === "weekly" ? 7 : 14;
  const origin = addDays(cfg.anchor, -((dayOfWeek(cfg.anchor) - cfg.weekStartDay + 7) % 7));
  const k = Math.floor(daysBetween(origin, date) / length);
  const start = addDays(origin, k * length);
  return { start, end: addDays(start, length - 1) };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/domain/periods.test.ts` — Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/domain/periods.ts src/domain/periods.test.ts
git commit -m "feat(domain): weekly and fortnightly pay periods

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Pay-run draft builder

**Files:**
- Create: `src/domain/payrun.ts`
- Test: `src/domain/payrun.test.ts`

**Interfaces:**
- Consumes: `personTotals`, `PersonTotals` (Task 6); `floorCheck`, `FloorResult` (Task 11); `PayPeriod` (Task 14); `sum` (Task 1).
- Produces: `interface PayLog { id: string; crewMemberId: string; date: LocalDate; projectId: string; stageId: string; basis: Basis; source: LogSource; quantity: Hundredths; hours: Hundredths; rateCents: Cents | null; amountCents: Cents; missingRate: boolean; locked: boolean }`; `interface PayReimbursement { expenseId: string; crewMemberId: string; date: LocalDate; amountCents: Cents; reimbursed: boolean }`; `interface PayPerson { id: string; type: WorkerType; gstRegistered: boolean; floorHourlyCents: Cents | null }`; `type LineLabel = "normal" | "late" | "adjustment"`; `interface PayLine { log: PayLog; label: LineLabel }`; `interface PersonPay { crewMemberId: string; lines: PayLine[]; reimbursements: PayReimbursement[]; totals: PersonTotals; hours: Hundredths; floor: FloorResult | null; noHours: boolean; missingRate: boolean }`; `buildPayRun(period: PayPeriod, people: readonly PayPerson[], logs: readonly PayLog[], reimbursements: readonly PayReimbursement[]): PersonPay[]`.

- [ ] **Step 1: Write the failing tests**

`src/domain/payrun.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildPayRun, type PayLog, type PayPerson } from "./payrun";

const period = { start: "2026-09-14", end: "2026-09-20" };
const people: PayPerson[] = [
  { id: "dima", type: "contractor", gstRegistered: true, floorHourlyCents: null },
  { id: "tom", type: "employee", gstRegistered: false, floorHourlyCents: 3200 },
  { id: "jake", type: "employee", gstRegistered: false, floorHourlyCents: 2200 },
  { id: "lee", type: "contractor", gstRegistered: false, floorHourlyCents: null },
];
let n = 0;
const log = (p: Partial<PayLog> & Pick<PayLog, "crewMemberId" | "basis" | "amountCents">): PayLog => ({
  id: `l${++n}`,
  date: "2026-09-15",
  projectId: "smith",
  stageId: "sheet",
  source: "grid",
  quantity: 0,
  hours: 0,
  rateCents: null,
  missingRate: false,
  locked: false,
  ...p,
});

describe("buildPayRun", () => {
  it("E6.1 + E7.1 Dima: $720 per-unit + 2 × $400 daily, GST, plus $110 reimbursement = $1,782.00", () => {
    const [dima] = buildPayRun(
      period,
      people,
      [
        log({ crewMemberId: "dima", basis: "per_unit", source: "progress", amountCents: 72_000 }),
        log({ crewMemberId: "dima", basis: "daily", amountCents: 40_000, date: "2026-09-16" }),
        log({ crewMemberId: "dima", basis: "daily", amountCents: 40_000, date: "2026-09-17" }),
      ],
      [{ expenseId: "x1", crewMemberId: "dima", date: "2026-09-16", amountCents: 11_000, reimbursed: false }],
    );
    expect(dima!.totals).toEqual({
      subtotalCents: 152_000,
      gstCents: 15_200,
      reimbursementsCents: 11_000,
      totalCents: 178_200,
    });
    expect(dima!.floor).toBeNull();
  });

  it("E6.2 Lee: 3 days × $350 with no GST", () => {
    const result = buildPayRun(
      period,
      people,
      ["2026-09-14", "2026-09-15", "2026-09-16"].map((date) =>
        log({ crewMemberId: "lee", basis: "daily", amountCents: 35_000, date }),
      ),
      [],
    );
    expect(result.find((p) => p.crewMemberId === "lee")!.totals.totalCents).toBe(105_000);
  });

  it("E10.1 Tom: per-unit pay plus grid hours → below floor by $32.03", () => {
    const [tom] = buildPayRun(
      period,
      people,
      [
        log({ crewMemberId: "tom", basis: "per_unit", source: "progress", amountCents: 29_997, date: "2026-09-14" }),
        log({ crewMemberId: "tom", basis: "time_only", amountCents: 0, hours: 800, date: "2026-09-14" }),
        log({ crewMemberId: "tom", basis: "per_unit", source: "progress", amountCents: 18_000, date: "2026-09-15" }),
        log({ crewMemberId: "tom", basis: "time_only", amountCents: 0, hours: 800, date: "2026-09-15" }),
      ],
      [],
    );
    expect(tom!.hours).toBe(1_600);
    expect(tom!.floor).toEqual({ effectiveHourlyCents: 3_000, below: true, shortfallCents: 3_203 });
    expect(tom!.noHours).toBe(false);
  });

  it("E8.1 labels adjustments and late entries from earlier periods; excludes locked and future logs", () => {
    const [jake] = buildPayRun(
      { start: "2026-09-21", end: "2026-09-27" },
      people,
      [
        log({ crewMemberId: "jake", basis: "hourly", source: "adjustment", amountCents: 1_200, hours: 50, date: "2026-09-15" }),
        log({ crewMemberId: "jake", basis: "hourly", amountCents: 18_000, hours: 750, date: "2026-09-16" }),
        log({ crewMemberId: "jake", basis: "hourly", amountCents: 18_000, hours: 750, date: "2026-09-22" }),
        log({ crewMemberId: "jake", basis: "hourly", amountCents: 18_000, hours: 750, date: "2026-09-14", locked: true }),
        log({ crewMemberId: "jake", basis: "hourly", amountCents: 18_000, hours: 750, date: "2026-09-28" }),
      ],
      [],
    );
    expect(jake!.lines.map((l) => [l.log.date, l.label])).toEqual([
      ["2026-09-15", "adjustment"],
      ["2026-09-16", "late"],
      ["2026-09-22", "normal"],
    ]);
    expect(jake!.totals.subtotalCents).toBe(37_200);
  });

  it("sorts lines by date, then project, then stage", () => {
    const [jake] = buildPayRun(
      period,
      people,
      [
        log({ crewMemberId: "jake", basis: "hourly", amountCents: 1, hours: 25, projectId: "smith", stageId: "b" }),
        log({ crewMemberId: "jake", basis: "hourly", amountCents: 1, hours: 25, projectId: "smith", stageId: "a" }),
        log({ crewMemberId: "jake", basis: "hourly", amountCents: 1, hours: 25, projectId: "ryde", stageId: "z" }),
      ],
      [],
    );
    expect(jake!.lines.map((l) => `${l.log.projectId}/${l.log.stageId}`)).toEqual(["ryde/z", "smith/a", "smith/b"]);
  });

  it("warns when an employee has earnings but no hours, and when a rate is missing", () => {
    const [jake] = buildPayRun(
      period,
      people,
      [log({ crewMemberId: "jake", basis: "lump_sum", source: "lump_sum", amountCents: 50_000 }), log({ crewMemberId: "jake", basis: "per_unit", amountCents: 0, missingRate: true })],
      [],
    );
    expect(jake!.noHours).toBe(true);
    expect(jake!.floor).toBeNull();
    expect(jake!.missingRate).toBe(true);
  });

  it("omits people with nothing to pay and skips already-reimbursed or future expenses", () => {
    const result = buildPayRun(
      period,
      people,
      [],
      [
        { expenseId: "a", crewMemberId: "dima", date: "2026-09-16", amountCents: 500, reimbursed: true },
        { expenseId: "b", crewMemberId: "dima", date: "2026-09-21", amountCents: 500, reimbursed: false },
      ],
    );
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/domain/payrun.test.ts` — Expected: FAIL, cannot resolve `./payrun`.

- [ ] **Step 3: Implement**

`src/domain/payrun.ts`:

```ts
import { floorCheck, type FloorResult } from "./floor";
import { personTotals, type PersonTotals } from "./gst";
import { sum } from "./money";
import type { PayPeriod } from "./periods";
import type { Basis, Cents, Hundredths, LocalDate, LogSource, WorkerType } from "./types";

export interface PayLog {
  id: string;
  crewMemberId: string;
  date: LocalDate;
  projectId: string;
  stageId: string;
  basis: Basis;
  source: LogSource;
  quantity: Hundredths;
  hours: Hundredths;
  rateCents: Cents | null;
  amountCents: Cents;
  missingRate: boolean;
  /** True once the log belongs to an approved pay run. */
  locked: boolean;
}

export interface PayReimbursement {
  expenseId: string;
  crewMemberId: string;
  date: LocalDate;
  /** GST-inclusive amount the person paid. */
  amountCents: Cents;
  reimbursed: boolean;
}

export interface PayPerson {
  id: string;
  type: WorkerType;
  gstRegistered: boolean;
  floorHourlyCents: Cents | null;
}

export type LineLabel = "normal" | "late" | "adjustment";

export interface PayLine {
  log: PayLog;
  label: LineLabel;
}

export interface PersonPay {
  crewMemberId: string;
  lines: PayLine[];
  reimbursements: PayReimbursement[];
  totals: PersonTotals;
  hours: Hundredths;
  floor: FloorResult | null;
  noHours: boolean;
  missingRate: boolean;
}

const byDateProjectStage = (a: PayLog, b: PayLog) =>
  a.date.localeCompare(b.date) || a.projectId.localeCompare(b.projectId) || a.stageId.localeCompare(b.stageId);

const labelFor = (log: PayLog, period: PayPeriod): LineLabel =>
  log.source === "adjustment" ? "adjustment" : log.date < period.start ? "late" : "normal";

/** Pay rules §6–§10: the draft pay run for a period. */
export function buildPayRun(
  period: PayPeriod,
  people: readonly PayPerson[],
  logs: readonly PayLog[],
  reimbursements: readonly PayReimbursement[],
): PersonPay[] {
  const openLogs = logs.filter((l) => !l.locked && l.date <= period.end);
  const openReimbursements = reimbursements.filter((r) => !r.reimbursed && r.date <= period.end);
  return people.flatMap((p) => {
    const lines = openLogs
      .filter((l) => l.crewMemberId === p.id)
      .sort(byDateProjectStage)
      .map((log) => ({ log, label: labelFor(log, period) }));
    const rs = openReimbursements.filter((r) => r.crewMemberId === p.id);
    if (lines.length === 0 && rs.length === 0) return [];
    const subtotal = sum(lines.map((l) => l.log.amountCents));
    const hours = sum(lines.map((l) => l.log.hours));
    const floorRate = p.type === "employee" ? p.floorHourlyCents : null;
    return [
      {
        crewMemberId: p.id,
        lines,
        reimbursements: rs,
        totals: personTotals(p, subtotal, sum(rs.map((r) => r.amountCents))),
        hours,
        floor: floorRate !== null && hours > 0 ? floorCheck(subtotal, hours, floorRate) : null,
        noHours: p.type === "employee" && subtotal !== 0 && hours === 0,
        missingRate: lines.some((l) => l.log.missingRate),
      },
    ];
  });
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/domain/payrun.test.ts` — Expected: all pass. (E8.1 check: 1,200 + 18,000 + 18,000 = 37,200.)

- [ ] **Step 5: Commit**

```bash
git add src/domain/payrun.ts src/domain/payrun.test.ts
git commit -m "feat(domain): pay-run draft builder with labels, totals and floor checks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Payout ledger

**Files:**
- Create: `src/domain/ledger.ts`
- Test: `src/domain/ledger.test.ts`

**Interfaces:**
- Consumes: `sum` (Task 1), `daysBetween` (Task 8).
- Produces: `type LedgerKind = "payrun_credit" | "advance" | "payment"`; `interface LedgerEntry { date: LocalDate; kind: LedgerKind; amountCents: Cents }` (amount always positive); `ledgerBalance(entries: readonly LedgerEntry[]): Cents`; `oldestUnpaidCreditDate(entries: readonly LedgerEntry[]): LocalDate | null`; `unpaidTooLong(entries: readonly LedgerEntry[], asOf: LocalDate, periodDays: number): boolean`.

- [ ] **Step 1: Write the failing tests**

`src/domain/ledger.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ledgerBalance, oldestUnpaidCreditDate, unpaidTooLong, type LedgerEntry } from "./ledger";

const advance: LedgerEntry = { date: "2026-09-14", kind: "advance", amountCents: 30_000 };
const credit: LedgerEntry = { date: "2026-09-20", kind: "payrun_credit", amountCents: 178_200 };
const payment: LedgerEntry = { date: "2026-09-25", kind: "payment", amountCents: 148_200 };

describe("ledger", () => {
  it("E15.1 Dima: −$300 → +$1,782 → −$1,482 = $0.00", () => {
    expect(ledgerBalance([advance])).toBe(-30_000);
    expect(ledgerBalance([advance, credit])).toBe(148_200);
    expect(ledgerBalance([advance, credit, payment])).toBe(0);
    expect(oldestUnpaidCreditDate([advance, credit, payment])).toBeNull();
  });
  it("finds the oldest unpaid credit first-in-first-out", () => {
    const older: LedgerEntry = { date: "2026-09-13", kind: "payrun_credit", amountCents: 10_000 };
    expect(oldestUnpaidCreditDate([credit, older, advance])).toBe("2026-09-20");
    expect(oldestUnpaidCreditDate([credit, older])).toBe("2026-09-13");
  });
  it("flags balances unpaid for longer than one pay period", () => {
    expect(unpaidTooLong([advance, credit], "2026-09-28", 7)).toBe(true);
    expect(unpaidTooLong([advance, credit], "2026-09-27", 7)).toBe(false);
    expect(unpaidTooLong([advance, credit, payment], "2026-12-01", 7)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/domain/ledger.test.ts` — Expected: FAIL, cannot resolve `./ledger`.

- [ ] **Step 3: Implement**

`src/domain/ledger.ts`:

```ts
import { daysBetween } from "./dates";
import { sum } from "./money";
import type { Cents, LocalDate } from "./types";

export type LedgerKind = "payrun_credit" | "advance" | "payment";

export interface LedgerEntry {
  date: LocalDate;
  kind: LedgerKind;
  /** Always positive; kind decides the sign. */
  amountCents: Cents;
}

const isCredit = (e: LedgerEntry) => e.kind === "payrun_credit";

/** Pay rules §15. Positive = the business owes the person. */
export function ledgerBalance(entries: readonly LedgerEntry[]): Cents {
  return sum(entries.map((e) => (isCredit(e) ? e.amountCents : 0 - e.amountCents)));
}

/** Debits pay off credits oldest first; returns the date of the first credit not fully paid. */
export function oldestUnpaidCreditDate(entries: readonly LedgerEntry[]): LocalDate | null {
  let debits = sum(entries.filter((e) => !isCredit(e)).map((e) => e.amountCents));
  const credits = entries.filter(isCredit).sort((a, b) => a.date.localeCompare(b.date));
  for (const c of credits) {
    if (debits < c.amountCents) return c.date;
    debits -= c.amountCents;
  }
  return null;
}

export function unpaidTooLong(entries: readonly LedgerEntry[], asOf: LocalDate, periodDays: number): boolean {
  const oldest = oldestUnpaidCreditDate(entries);
  return oldest !== null && daysBetween(oldest, asOf) > periodDays;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/domain/ledger.test.ts` — Expected: all pass. (Check "FIFO" case: debits 30,000 cover the 13 Sep credit of 10,000, leaving 20,000 < 178,200 → 20 Sep.)

- [ ] **Step 5: Commit**

```bash
git add src/domain/ledger.ts src/domain/ledger.test.ts
git commit -m "feat(domain): payout ledger balances and unpaid-too-long

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: Display formatting

**Files:**
- Create: `src/lib/format.ts`
- Test: `src/lib/format.test.ts`

**Interfaces:**
- Produces: `formatMoney(cents: number): string`, `formatQuantity(hundredths: number, unit: "m2" | "lm" | "each"): string`, `formatHours(hundredths: number): string`, `formatDays(hundredths: number): string`, `formatDate(date: string, today: string): string`. (`src/lib` must not import `src/domain`.)

- [ ] **Step 1: Write the failing tests**

`src/lib/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatDate, formatDays, formatHours, formatMoney, formatQuantity } from "./format";

describe("format", () => {
  it("formats AUD with a true minus sign", () => {
    expect(formatMoney(143_250)).toBe("$1,432.50");
    expect(formatMoney(-30_000)).toBe("−$300.00");
    expect(formatMoney(0)).toBe("$0.00");
  });
  it("formats quantities without trailing zeros", () => {
    expect(formatQuantity(12_000, "m2")).toBe("120 m²");
    expect(formatQuantity(3_334, "m2")).toBe("33.34 m²");
    expect(formatQuantity(8_050, "lm")).toBe("80.5 lm");
    expect(formatQuantity(1_200, "each")).toBe("12");
    expect(formatQuantity(-50, "lm")).toBe("−0.5 lm");
  });
  it("formats hours and days", () => {
    expect(formatHours(750)).toBe("7.5 h");
    expect(formatDays(50)).toBe("½ day");
    expect(formatDays(100)).toBe("1 day");
    expect(formatDays(200)).toBe("2 days");
  });
  it("formats dates, adding the year only when it differs", () => {
    expect(formatDate("2026-09-07", "2026-09-28")).toBe("Mon 7 Sep");
    expect(formatDate("2025-12-31", "2026-09-28")).toBe("Wed 31 Dec 2025");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/lib/format.test.ts` — Expected: FAIL, cannot resolve `./format`.

- [ ] **Step 3: Implement**

`src/lib/format.ts`:

```ts
const AUD = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });
const MINUS = "−";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const UNIT_LABEL = { m2: " m²", lm: " lm", each: "" } as const;

export function formatMoney(cents: number): string {
  const text = AUD.format(Math.abs(cents) / 100);
  return cents < 0 ? `${MINUS}${text}` : text;
}

function hundredths(value: number): string {
  const abs = Math.abs(value);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const body = frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(2, "0").replace(/0$/, "")}`;
  return value < 0 ? `${MINUS}${body}` : body;
}

export function formatQuantity(value: number, unit: keyof typeof UNIT_LABEL): string {
  return `${hundredths(value)}${UNIT_LABEL[unit]}`;
}

export function formatHours(value: number): string {
  return `${hundredths(value)} h`;
}

export function formatDays(value: number): string {
  if (value === 50) return "½ day";
  return value === 100 ? "1 day" : `${hundredths(value)} days`;
}

/** "Mon 7 Sep", plus the year when it isn't today's year. Dates are "YYYY-MM-DD". */
export function formatDate(date: string, today: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const base = `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  return date.slice(0, 4) === today.slice(0, 4) ? base : `${base} ${date.slice(0, 4)}`;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/lib/format.test.ts` — Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts src/lib/format.test.ts
git commit -m "feat(lib): money, quantity, hours and date formatting

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 18: Prove every spec example is tested; coverage gate

**Files:**
- Create: `scripts/check-examples.ts`, `scripts/check-examples.test.ts`
- Modify: `package.json` (scripts `check:examples`, `verify`), `docs/plans/PROGRESS.md`

**Interfaces:**
- Consumes: `docs/specs/02-pay-rules.md`, all `src/**/*.test.ts`.
- Produces: `missingExamples(specText: string, testTexts: readonly string[]): string[]`; CLI exits 1 listing missing ids.

- [ ] **Step 1: Write the failing test**

`scripts/check-examples.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { missingExamples } from "./check-examples";

describe("missingExamples", () => {
  it("lists spec example ids that no test mentions", () => {
    const spec = "> **E1.1** a\n> **E4.2 Equal split** b\n> **E10.1** c";
    const tests = ['it("E1.1 uses …")', 'it("E10.1 Tom …")'];
    expect(missingExamples(spec, tests)).toEqual(["E4.2"]);
  });
  it("does not treat E1.1 as covering E1.10", () => {
    expect(missingExamples("**E1.10** x", ['it("E1.1 y")'])).toEqual(["E1.10"]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run scripts/check-examples.test.ts` — Expected: FAIL, cannot resolve `./check-examples`.

- [ ] **Step 3: Implement**

`scripts/check-examples.ts`:

```ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ID = /\*\*(E\d+\.\d+)/g;

export function missingExamples(specText: string, testTexts: readonly string[]): string[] {
  const ids = [...new Set([...specText.matchAll(ID)].map((m) => m[1]!))];
  const tests = testTexts.join("\n");
  return ids.filter((id) => !new RegExp(`\\b${id.replace(".", "\\.")}(?!\\d)`).test(tests));
}

function testFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) testFiles(p, out);
    else if (p.endsWith(".test.ts")) out.push(p);
  }
  return out;
}

function main(): void {
  const spec = readFileSync("docs/specs/02-pay-rules.md", "utf8");
  const missing = missingExamples(spec, testFiles("src").map((f) => readFileSync(f, "utf8")));
  if (missing.length > 0) {
    console.error(`Spec examples without a named test: ${missing.join(", ")}`);
    process.exit(1);
  }
  console.log("Every pay-rules example has a named test.");
}

if (process.argv[1]?.endsWith("check-examples.ts")) main();
```

- [ ] **Step 4: Run to verify pass, then run the real check**

```bash
pnpm vitest run scripts/check-examples.test.ts
pnpm tsx scripts/check-examples.ts
```
Expected: tests pass; then `Every pay-rules example has a named test.` If ids are listed as missing, add a named test for each in the module that owns the rule, then re-run.

- [ ] **Step 5: Wire into verify and run coverage**

`package.json`:

```json
"check:examples": "tsx scripts/check-examples.ts",
"verify": "pnpm typecheck && pnpm lint && pnpm lint:design && pnpm test:coverage && pnpm check:examples"
```

Run: `pnpm verify` — Expected: coverage 100% for `src/domain`. If coverage reports an uncovered branch, write a test named after the rule it protects in that module's test file (e.g. `it("rejects …")`), run it red→green, and re-run `pnpm verify`. Do not lower the threshold.

- [ ] **Step 6: Commit**

```bash
git add scripts/check-examples.ts scripts/check-examples.test.ts package.json src
git commit -m "test: prove every pay-rules example is tested; enforce 100% domain coverage

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Phase gate**

1. `pnpm verify` green (paste summary into `docs/plans/PROGRESS.md`).
2. Dispatch `spec-reviewer` on the Phase 1 range with this plan and `02-pay-rules.md`; it must confirm every example matches to the cent and every rule in §0–§16 has code or is explicitly owned by a later phase (§9 approve/reopen and §16 statement are Phase 7; §13 segment creation is Phase 4).
3. Update `PROGRESS.md` (Current → Phase 2), commit, merge `phase/1-pay-engine` into `master`.
