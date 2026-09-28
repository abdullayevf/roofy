/**
 * Foreman money-leak scanner (plan Task 5, Review Focus 1).
 *
 * Foreman DTO types in `contracts.ts` are declared without money fields; this scanner is the
 * runtime check behind them. Task 6 calls `expectNoMoney` on the result of every
 * foreman-reachable service method; Task 21 applies the same patterns to rendered HTML.
 */

/**
 * Object keys that name money. Foreman DTO keys are chosen so they never match (e.g. `quantityDone`,
 * not `totalQuantity`). Watch substrings: "re**cents**tages", "gene**rate**dAt", "sepa**rate**" all match.
 */
export const MONEY_KEY = /rate|amount|cents|budget|margin|balance|cost|earn|pay|total|gst/i;

/** A dollar figure inside a string value ("$775", "$ 12.00"). */
export const MONEY_TEXT = /\$\s?\d/;

/**
 * Walks `value` (plain objects and arrays) and returns the JSONPath-style location of every key
 * matching `MONEY_KEY` and every string matching `MONEY_TEXT`, in document order.
 */
export function scanForMoney(value: unknown): string[] {
  const hits: string[] = [];
  const walk = (v: unknown, path: string): void => {
    if (typeof v === "string") {
      if (MONEY_TEXT.test(v)) hits.push(path);
      return;
    }
    if (Array.isArray(v)) {
      v.forEach((item, i) => walk(item, `${path}[${i}]`));
      return;
    }
    if (v === null || typeof v !== "object" || v instanceof Date) return;
    for (const [key, child] of Object.entries(v)) {
      const childPath = `${path}.${key}`;
      if (MONEY_KEY.test(key)) hits.push(childPath);
      walk(child, childPath);
    }
  };
  walk(value, "$");
  return hits;
}

/** Throws when `value` carries money; `label` names the method under test in the message. */
export function expectNoMoney(value: unknown, label: string): void {
  const hits = scanForMoney(value);
  if (hits.length > 0) throw new Error(`${label} leaks money: ${hits.join(", ")}`);
}
