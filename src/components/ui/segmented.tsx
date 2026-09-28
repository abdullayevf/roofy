"use client";

import { useState } from "react";
import { cx } from "@/lib/cx";

export type SegmentedOption = { value: string; label: string };

export type SegmentedProps = {
  /** Accessible name for the group, e.g. "Log entry type". */
  legend: string;
  name: string;
  options: SegmentedOption[];
  /** Uncontrolled starting value. Ignored once `value` (controlled) is passed. */
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  /** Demo-only: forces the focus-visible ring so it shows up in a static screenshot. */
  focusVisible?: boolean;
  className?: string;
};

/**
 * DESIGN.md §4 segmented control: radiogroup, segments ≥ 48 px. Built on
 * native radio inputs (visually hidden, `peer`-styled) so arrow-key
 * navigation between segments (DESIGN.md §8 desktop keyboard operation)
 * comes from the browser's own radio-group behaviour rather than a
 * hand-rolled `keydown` handler.
 */
export function Segmented({
  legend,
  name,
  options,
  defaultValue,
  value: controlledValue,
  onChange,
  disabled,
  focusVisible,
  className,
}: SegmentedProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? options[0]?.value ?? "");
  const value = controlledValue ?? uncontrolled;
  const FOCUS = focusVisible
    ? "outline outline-[3px] outline-offset-2 outline-chalk"
    : "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-chalk";

  return (
    <div
      role="radiogroup"
      aria-label={legend}
      aria-disabled={disabled || undefined}
      className={cx(
        "inline-flex rounded-control border-[1.5px] border-edge bg-surface p-1",
        disabled && "opacity-50",
        className,
      )}
    >
      {options.map((opt) => {
        const checked = opt.value === value;
        return (
          <label
            key={opt.value}
            className={cx(
              "relative flex min-h-[52px] flex-1 items-center justify-center rounded-control px-3 text-body-strong lg:min-h-12",
              disabled ? "cursor-not-allowed" : "cursor-pointer",
              checked ? "bg-chalk text-on-chalk" : "text-ink",
            )}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={checked}
              disabled={disabled}
              onChange={() => {
                setUncontrolled(opt.value);
                onChange?.(opt.value);
              }}
              className={cx(
                "absolute inset-0 h-full w-full appearance-none opacity-0",
                disabled ? "cursor-not-allowed" : "cursor-pointer",
                FOCUS,
              )}
            />
            <span>{opt.label}</span>
          </label>
        );
      })}
    </div>
  );
}
