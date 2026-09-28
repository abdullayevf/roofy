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
  if (shares.mode === "equal")
    return splitWeighted(
      total,
      Array.from({ length: count }, () => 1),
    );
  if (shares.bp.length !== count) throw new RangeError("one share per person is required");
  if (shares.bp.reduce((a, b) => a + b, 0) !== 10_000) throw new RangeError("custom shares must total 100%");
  return splitWeighted(total, shares.bp);
}
