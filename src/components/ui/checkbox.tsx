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
  /** Demo-only: forces the focus ring so it shows up in a static screenshot. */
  focusVisible?: boolean;
  className?: string;
};

// The ring goes on the visible box, not the 48 px hit area around it, so it
// follows the box's own radius instead of drawing a big square offset frame.
const BOX_FOCUS =
  "group-focus-visible:outline group-focus-visible:outline-[3px] group-focus-visible:outline-offset-2 group-focus-visible:outline-chalk-link";
const BOX_FOCUS_FORCED = "outline outline-[3px] outline-offset-2 outline-chalk-link";

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
    <label
      className={cx(
        "flex min-h-[64px] w-full items-center gap-1 rounded-group border-group px-2 pr-4 lg:min-h-12",
        disabled ? "cursor-not-allowed bg-galv" : "cursor-pointer bg-surface active:bg-galv",
        className,
      )}
    >
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
        className="group flex h-12 w-12 shrink-0 items-center justify-center outline-none"
      >
        <span
          className={cx(
            "flex h-7 w-7 items-center justify-center rounded-md border-[1.5px] border-edge",
            disabled ? "bg-galv" : "bg-surface",
            "group-data-[state=checked]:border-transparent group-data-[state=checked]:bg-chalk",
            focusVisible ? BOX_FOCUS_FORCED : BOX_FOCUS,
          )}
        >
          <RadixCheckbox.Indicator>
            <Check size={20} weight="bold" className="text-on-chalk" />
          </RadixCheckbox.Indicator>
        </span>
      </RadixCheckbox.Root>
      <span className={cx("text-body", disabled ? "text-ink-2" : "text-ink")}>{label}</span>
    </label>
  );
}
