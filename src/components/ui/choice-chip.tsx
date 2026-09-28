"use client";

import { useState } from "react";
import { Check } from "@phosphor-icons/react";
import { cx } from "@/lib/cx";

export type ChoiceChipOption = { value: string; label: string; disabled?: boolean };

export type ChoiceChipProps = {
  /** Accessible name for the group, e.g. "Reason", "Category". */
  legend: string;
  name: string;
  options: ChoiceChipOption[];
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  focusVisible?: boolean;
  className?: string;
};

const FOCUS =
  "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-chalk";
const FORCED_FOCUS = "outline outline-[3px] outline-offset-2 outline-chalk";

/**
 * Single-select chips (radiogroup): a pause reason, an expense category, who
 * paid, a recent-stage pick. Resting = surface + edge border; selected =
 * tape fill, ink text, a check icon; every chip is >= 48 px tall.
 */
export function ChoiceChip({
  legend,
  name,
  options,
  defaultValue,
  value: controlledValue,
  onChange,
  disabled,
  focusVisible,
  className,
}: ChoiceChipProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? "");
  const value = controlledValue ?? uncontrolled;

  return (
    <div role="radiogroup" aria-label={legend} className={cx("flex flex-wrap gap-2", className)}>
      {options.map((opt) => {
        const checked = opt.value === value;
        const optionDisabled = disabled || opt.disabled;
        return (
          <label
            key={opt.value}
            className={cx(
              "relative flex min-h-12 items-center gap-1.5 rounded-full border-[1.5px] px-4 text-body-strong",
              optionDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
              checked ? "border-transparent bg-tape text-on-tape" : "border-edge bg-surface text-ink",
            )}
          >
            {checked ? <Check size={18} weight="bold" aria-hidden="true" /> : null}
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={checked}
              disabled={optionDisabled}
              onChange={() => {
                setUncontrolled(opt.value);
                onChange?.(opt.value);
              }}
              className={cx(
                "absolute inset-0 h-full w-full appearance-none opacity-0",
                optionDisabled ? "cursor-not-allowed" : "cursor-pointer",
                focusVisible ? FORCED_FOCUS : FOCUS,
              )}
            />
            <span>{opt.label}</span>
          </label>
        );
      })}
    </div>
  );
}
