"use client";

import { useState } from "react";
import type { Cents } from "@/domain/types";
import { toCents } from "@/domain/money";
import { formatMoney } from "@/lib/format";
import { Field } from "./field";

export type MoneyFieldProps = {
  label: string;
  hint?: string;
  /** Starting amount in integer cents. */
  defaultCents?: Cents;
  /** Starting text that couldn't be read, shown with its error (a field opened again before it was fixed). */
  defaultText?: string;
  /**
   * Called on blur with the amount in integer cents, null when the field is blank, or "unreadable" when the text
   * can't be read as dollars and cents (never treat that as blank or $0.00), with the text as typed.
   */
  onCentsChange?: (cents: Cents | null | "unreadable", text: string) => void;
  className?: string;
  /** Spoken name when the visible label is short because the group around it says which ("Labour budget" inside "Stage 2"). */
  ariaLabel?: string;
  /** An error from the form around it (a refused save, "Add an amount before saving."); the field's own wins. */
  error?: string;
  /** A unit shown inside the box after the amount ("an hour" so the field reads "$28.00 an hour"). */
  suffix?: string;
};

// The currency mark is drawn as a leading mark inside the field, so the text
// itself is the unsigned amount: "1,482.00". A negative amount puts the minus
// before the "$" as formatMoney does ("−$1,482.00"), so the mark is "−$".
const CANT_READ = "Enter an amount in dollars and cents, like 1,482.00.";

const show = (cents: Cents) => formatMoney(Math.abs(cents)).replace("$", "");

/**
 * A dollar amount field: "$" (ink-2) inside the field, decimal keypad, and on
 * blur the text is tidied to `format.ts`'s grouping and cents. Parsing is
 * exact integer cents via `src/domain` — never a float.
 */
export function MoneyField({ label, hint, defaultCents, defaultText, onCentsChange, className, ariaLabel, error: formError, suffix }: MoneyFieldProps) {
  const [text, setText] = useState(defaultText ?? (defaultCents === undefined ? "" : show(defaultCents)));
  const [negative, setNegative] = useState(defaultText === undefined && (defaultCents ?? 0) < 0);
  const [error, setError] = useState<string | undefined>(defaultText === undefined ? undefined : CANT_READ);

  function commit() {
    const raw = text.replace(/[$,\s]/g, "");
    if (raw === "") {
      setError(undefined);
      onCentsChange?.(null, text);
      return;
    }
    try {
      const cents = toCents(raw);
      setText(show(cents));
      setNegative(cents < 0);
      setError(undefined);
      onCentsChange?.(cents, text);
    } catch {
      setNegative(false);
      setError(CANT_READ);
      onCentsChange?.("unreadable", text);
    }
  }

  return (
    <Field
      label={label}
      inputMode="decimal"
      leading={negative ? "\u2212$" : "$"}
      suffix={suffix}
      hint={hint}
      error={error ?? formError}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      className={className}
      aria-label={ariaLabel}
    />
  );
}
