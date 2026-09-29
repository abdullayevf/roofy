import { CheckCircle, WarningCircle, WarningDiamond } from "@phosphor-icons/react/dist/ssr";
import type { Cents } from "@/domain/types";
import { formatMoney } from "@/lib/format";
import { keepAmountsTogether } from "@/lib/text";
import { cx } from "@/lib/cx";

export type MoneyTone = "over" | "watch" | "good";

const TONE = {
  over: { className: "text-over", icon: WarningCircle },
  watch: { className: "text-watch", icon: WarningDiamond },
  good: { className: "text-good", icon: CheckCircle },
} as const;

export type MoneyCellProps = {
  cents: Cents;
  className?: string;
} & (
  | { tone?: undefined; status?: undefined }
  // A tone is always icon + words, never colour alone (DESIGN.md §2).
  | { tone: MoneyTone; status: string }
);

/**
 * DESIGN.md §4 money cell: right-aligned figure (never wraps), tabular
 * numerals, true minus. An optional status line sits under it, in the same
 * pattern as the tape bar's summary: the tone's icon beside left-aligned meta
 * text ("$775.00 over budget"), in that tone's colour.
 */
export function MoneyCell({ cents, tone, status, className }: MoneyCellProps) {
  const t = tone ? TONE[tone] : undefined;
  return (
    <span className={cx("inline-flex max-w-full flex-col items-end gap-0.5", className)}>
      <span className="whitespace-nowrap text-figure num text-ink">{formatMoney(cents)}</span>
      {t && status ? (
        <span className={cx("flex items-start gap-1 text-left text-meta", t.className)}>
          <t.icon size={24} aria-hidden="true" className="shrink-0" />
          <span className="min-w-0 [overflow-wrap:anywhere]">{keepAmountsTogether(status)}</span>
        </span>
      ) : null}
    </span>
  );
}
