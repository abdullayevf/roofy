"use client";

import { useState } from "react";
import { Check } from "@phosphor-icons/react";
import { cx } from "@/lib/cx";
import { focusRingWithin } from "./focus";

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
  /** Demo-only: forces the focus ring (on the selected chip, or the first) so it shows up in a static screenshot. */
  focusVisible?: boolean;
  className?: string;
};

/**
 * Single-select chips (radiogroup): a pause reason, an expense category, who
 * paid, a recent-stage pick. Resting = surface + edge border; selected =
 * tape fill, ink text, a check icon; every chip is >= 48 px tall. The focus
 * ring is drawn on the chip itself (so it follows its radius), and a long
 * label wraps inside its chip rather than running off the screen.
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
  const forcedOn = options.find((o) => o.value === value)?.value ?? options[0]?.value;

  return (
    <div role="radiogroup" aria-label={legend} className={cx("flex flex-wrap gap-2", className)}>
      {options.map((opt) => {
        const checked = opt.value === value;
        const optionDisabled = disabled || opt.disabled;
        return (
          <label
            key={opt.value}
            className={cx(
              "relative flex min-h-12 max-w-full items-center gap-1.5 rounded-3xl border-[1.5px] px-4 py-1 text-body-strong",
              optionDisabled ? "cursor-not-allowed" : "cursor-pointer",
              checked
                ? "border-transparent bg-tape text-on-tape"
                : optionDisabled
                  ? "border-line bg-galv text-ink-2"
                  : "border-edge bg-surface text-ink",
              focusRingWithin(focusVisible && opt.value === forcedOn),
            )}
          >
            {checked ? <Check size={24} weight="bold" aria-hidden="true" className="shrink-0" /> : null}
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
              )}
            />
            <span className="min-w-0 [overflow-wrap:anywhere]">{opt.label}</span>
          </label>
        );
      })}
    </div>
  );
}
