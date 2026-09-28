"use client";

import { Checkbox as RadixCheckbox } from "radix-ui";
import { Check } from "@phosphor-icons/react";
import { cx } from "@/lib/cx";

export type CheckboxProps = {
  label: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  /** Demo-only: forces the focus-visible ring so it shows up in a static screenshot. */
  focusVisible?: boolean;
  className?: string;
};

const FOCUS =
  "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-chalk";
const FORCED_FOCUS = "outline outline-[3px] outline-offset-2 outline-chalk";

/** Checkbox, built on Radix for correct keyboard/indeterminate behaviour. */
export function Checkbox({
  label,
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  focusVisible,
  className,
}: CheckboxProps) {
  return (
    <label className={cx("inline-flex min-h-12 cursor-pointer items-center gap-3", className)}>
      {/*
        Radix's Checkbox.Root is the actual interactive element (a real
        `<button role="checkbox">`), so it — not just the wrapping label —
        must itself meet the 48 px target (DESIGN.md §8). The visible box
        stays the usual small checkbox size; the extra padding around it is
        transparent hit area.
       */}
      <RadixCheckbox.Root
        checked={checked}
        defaultChecked={defaultChecked}
        onCheckedChange={(next) => onCheckedChange?.(next === true)}
        disabled={disabled}
        className={cx(
          "group flex h-12 w-12 shrink-0 items-center justify-center",
          "disabled:opacity-50",
          focusVisible ? FORCED_FOCUS : FOCUS,
        )}
      >
        <span
          className={cx(
            "flex h-6 w-6 items-center justify-center rounded-[3px] border-[1.5px] border-edge bg-surface",
            "group-data-[state=checked]:border-transparent group-data-[state=checked]:bg-chalk",
          )}
        >
          <RadixCheckbox.Indicator>
            <Check size={16} weight="bold" className="text-on-chalk" />
          </RadixCheckbox.Indicator>
        </span>
      </RadixCheckbox.Root>
      <span className="text-body text-ink">{label}</span>
    </label>
  );
}
