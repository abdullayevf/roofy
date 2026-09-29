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
  /** Called on blur with the parsed amount in integer cents, or null when it can't be read. */
  onCentsChange?: (cents: Cents | null) => void;
  className?: string;
};

// The "$" is drawn as a leading mark inside the field, so the text itself is
// the amount without it: "1,482.00".
const show = (cents: Cents) => formatMoney(cents).replace("$", "");

/**
 * A dollar amount field: "$" (ink-2) inside the field, decimal keypad, and on
 * blur the text is tidied to `format.ts`'s grouping and cents. Parsing is
 * exact integer cents via `src/domain` — never a float.
 */
export function MoneyField({ label, hint, defaultCents, onCentsChange, className }: MoneyFieldProps) {
  const [text, setText] = useState(defaultCents === undefined ? "" : show(defaultCents));
  const [error, setError] = useState<string | undefined>();

  function commit() {
    const raw = text.replace(/[$,\s]/g, "");
    if (raw === "") {
      setError(undefined);
      onCentsChange?.(null);
      return;
    }
    try {
      const cents = toCents(raw);
      setText(show(cents));
      setError(undefined);
      onCentsChange?.(cents);
    } catch {
      setError("Enter an amount in dollars and cents, like 1,482.00.");
      onCentsChange?.(null);
    }
  }

  return (
    <Field
      label={label}
      inputMode="decimal"
      leading="$"
      hint={hint}
      error={error}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      className={className}
    />
  );
}
