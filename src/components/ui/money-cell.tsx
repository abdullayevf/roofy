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
  /**
   * A tone must be paired with an icon or a word, never colour alone
   * (DESIGN.md §2). `toneIcon` takes a Phosphor icon component (render it
   * only where that crosses no server/client boundary as a bare prop —
   * e.g. within another Client Component); `toneLabel` is a plain string
   * and always safe.
   */
  toneIcon?: PhosphorIcon;
  toneLabel?: string;
  className?: string;
};

/** DESIGN.md §4 money cell: right-aligned figure, tabular numerals, true minus. */
export function MoneyCell({ cents, tone, toneIcon, toneLabel, className }: MoneyCellProps) {
  return (
    <span className={cx("inline-flex flex-col items-end gap-0.5", className)}>
      <span
        className={cx("inline-flex items-center gap-1 text-figure num", tone ? TONE_CLASS[tone] : "text-ink")}
      >
        {toneIcon ? <Icon icon={toneIcon} size={20} /> : null}
        {formatMoney(cents)}
      </span>
      {toneLabel ? (
        <span className={cx("text-meta", tone ? TONE_CLASS[tone] : "text-ink-2")}>{toneLabel}</span>
      ) : null}
    </span>
  );
}
