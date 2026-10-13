// Conversions between Postgres column text and the integer units the domain uses.
// numeric(12,2) quantities and hours <-> integer hundredths; bigint money <-> integer cents.
// Pure string and BigInt maths: no floats touch a value.

const DECIMAL = /^(-?)(\d+)(?:\.(\d+))?$/;
const WHOLE = /^-?\d+$/;
const MAX = BigInt(Number.MAX_SAFE_INTEGER);

function safe(value: bigint, what: string): number {
  if (value > MAX || value < -MAX) throw new RangeError(`${what} is outside the safe range`);
  return Number(value);
}

function assertWhole(n: number, what: string): void {
  if (!Number.isSafeInteger(n))
    throw new RangeError(`${what} must be a whole number in the safe range, got ${n}`);
}

/** "12.50" -> 1250. Rejects more than 2 decimal places. */
export function toHundredths(numeric: string): number {
  const match = DECIMAL.exec(numeric);
  if (!match) throw new TypeError(`"${numeric}" is not a number`);
  const [, sign = "", whole = "0", frac = ""] = match;
  if (frac.length > 2) throw new RangeError(`"${numeric}" has more than 2 decimal places`);
  const units = BigInt(whole) * 100n + BigInt(frac.padEnd(2, "0"));
  return safe(sign === "-" ? -units : units, `"${numeric}"`);
}

/** 1250 -> "12.50". */
export function fromHundredths(n: number): string {
  assertWhole(n, "Hundredths");
  const abs = Math.abs(n);
  const text = `${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
  return n < 0 ? `-${text}` : text;
}

/** bigint column value ("123456" or 123456n) -> 123456 cents. */
export function toCents(value: string | bigint): number {
  if (typeof value === "string" && !WHOLE.test(value))
    throw new TypeError(`"${value}" is not a whole number`);
  return safe(BigInt(value), `${value} cents`);
}

/** 123456 cents -> "123456". */
export function fromCents(n: number): string {
  assertWhole(n, "Cents");
  return String(n);
}
