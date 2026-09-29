const AMOUNT = String.raw`[−-]?\$[\d,]+(?:\.\d+)?`;
const BEFORE = new RegExp(String.raw`(\S) (?=${AMOUNT})`, "g");
const AFTER = new RegExp(String.raw`(${AMOUNT}) (?=(?:over|under)\b)`, "g");

/**
 * Turns the space before a dollar amount into a non-breaking space ("of" /
 * "$4,000.00"), and the space between an amount and a trailing "over"/"under"
 * ("$775.00 over"), so a wrapping line never strands an amount from the word
 * that gives it meaning. Everything else still wraps normally, and a chunk too
 * long for one line can still break (pair this with `overflow-wrap: anywhere`).
 */
export function keepAmountsTogether(text: string): string {
  return text.replace(BEFORE, "$1 ").replace(AFTER, "$1 ");
}
