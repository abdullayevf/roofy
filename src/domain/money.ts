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
