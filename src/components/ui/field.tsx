import { useId, type ComponentPropsWithoutRef } from "react";
import { Input } from "./input";
import { cx } from "@/lib/cx";

export type FieldProps = Omit<ComponentPropsWithoutRef<"input">, "id"> & {
  label: string;
  /** Required: DESIGN.md §8 "correct inputmode for every field". Pass "text" for plain text. */
  inputMode: ComponentPropsWithoutRef<"input">["inputMode"];
  /** Secondary text in meta/ink-2, e.g. "Optional". */
  hint?: string;
  /** Message stating what went wrong and how to fix it. Shown below in `over`. */
  error?: string;
  /** In-field unit suffix shown inside the box, e.g. "m²" on a quantity field. */
  suffix?: string;
  focusVisible?: boolean;
  className?: string;
};

/**
 * DESIGN.md §4 field: label always above the input (never placeholder-only),
 * hint in meta/ink-2, error in `over` linked to the input by aria-describedby.
 */
export function Field({
  label,
  inputMode,
  hint,
  error,
  suffix,
  focusVisible,
  className,
  ...inputProps
}: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-body-strong text-ink">
        {label}
      </label>
      <Input
        {...inputProps}
        id={id}
        inputMode={inputMode}
        invalid={Boolean(error)}
        suffix={suffix}
        focusVisible={focusVisible}
        aria-describedby={describedBy}
      />
      {hint && !error ? (
        <span id={hintId} className="text-meta text-ink-2">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className="text-meta text-over">
          {error}
        </span>
      ) : null}
    </div>
  );
}
