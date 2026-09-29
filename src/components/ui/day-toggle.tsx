"use client";

import type { Hundredths } from "@/domain/types";
import { Segmented } from "./segmented";

export type DayToggleProps = {
  /** Hundredths: 100 = a full day, 50 = a half day. */
  value?: Hundredths;
  /** Uncontrolled starting value. Ignored once `value` (controlled) is passed. */
  defaultValue?: Hundredths;
  onChange?: (next: Hundredths) => void;
  /** Accessible name for the group, e.g. "Tom's day". */
  label: string;
  disabled?: boolean;
  focusVisible?: boolean;
  className?: string;
};

const OPTIONS = [
  { value: "100", label: "1 day" },
  { value: "50", label: "½ day" },
];

/**
 * A full/half day is a choice between two fixed values, not a step count
 * (DESIGN.md §4's stepper is for hours). Built on the segmented control,
 * which already holds uncontrolled state when no `value`/`onChange` pair
 * is given.
 */
export function DayToggle({
  value,
  defaultValue,
  onChange,
  label,
  disabled,
  focusVisible,
  className,
}: DayToggleProps) {
  return (
    <Segmented
      legend={label}
      name={label}
      options={OPTIONS}
      value={value === undefined ? undefined : String(value)}
      defaultValue={defaultValue === undefined ? undefined : String(defaultValue)}
      onChange={onChange ? (next) => onChange(Number(next)) : undefined}
      disabled={disabled}
      focusVisible={focusVisible}
      className={className}
    />
  );
}
