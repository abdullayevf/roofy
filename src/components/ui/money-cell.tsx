import type { Cents } from "@/domain/types";
import { formatMoney } from "@/lib/format";
import { Icon } from "./icon";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { cx } from "@/lib/cx";

export type MoneyTone = "over" | "watch" | "good";

const TONE_CLASS: Record<MoneyTone, string> = {
  over: "text-over",
  watch: "text-watch",
  good: "text-good",
};

export type MoneyCellProps = {
  cents: Cents;
  tone?: MoneyTone;
  /** Icon paired with the tone colour, per DESIGN.md §2 ("colour is never the only signal"). */
  toneIcon?: PhosphorIcon;
  className?: string;
};

/** DESIGN.md §4 money cell: right-aligned figure, tabular numerals, true minus. */
export function MoneyCell({ cents, tone, toneIcon, className }: MoneyCellProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center justify-end gap-1 text-figure num",
        tone && TONE_CLASS[tone],
        className,
      )}
    >
      {toneIcon ? <Icon icon={toneIcon} size={20} /> : null}
      {formatMoney(cents)}
    </span>
  );
}
