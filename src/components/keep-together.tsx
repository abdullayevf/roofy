import { keepAmountsTogether } from "@/lib/text";

/** A word with a hyphen inside it ("clean-up", "re-bed"), with any punctuation stuck to it. */
const HYPHENATED = /(\S*\p{L}-\p{L}\S*)/gu;

/** Longer than this and a hyphenated word may break at its hyphen: at 200% text a long one is wider than the screen. */
const MAX_UNBROKEN = 12;

/**
 * Sentence text for a wrapping line: an amount stays with the word that gives it meaning (`keepAmountsTogether`)
 * and a short hyphenated word never splits at its hyphen ("clean-" / "up").
 */
export function KeepTogether({ text }: { text: string }) {
  return (
    <>
      {keepAmountsTogether(text)
        .split(HYPHENATED)
        .map((part, i) =>
          i % 2 === 1 && part.length <= MAX_UNBROKEN ? (
            <span key={i} className="whitespace-nowrap">
              {part}
            </span>
          ) : (
            part
          ),
        )}
    </>
  );
}
