import { keepAmountsTogether } from "@/lib/text";

/** A word with a hyphen inside it ("clean-up", "re-bed"), with any punctuation stuck to it. */
const HYPHENATED = /(\S*\p{L}-\p{L}\S*)/gu;

/**
 * Sentence text for a wrapping line: an amount stays with the word that gives it meaning (`keepAmountsTogether`)
 * and a hyphenated word never splits at its hyphen ("clean-" / "up").
 */
export function KeepTogether({ text }: { text: string }) {
  return (
    <>
      {keepAmountsTogether(text)
        .split(HYPHENATED)
        .map((part, i) =>
          i % 2 === 1 ? (
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
