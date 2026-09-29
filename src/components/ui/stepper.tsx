"use client";

import { useState } from "react";
import { Minus, Plus } from "@phosphor-icons/react";
import type { Hundredths } from "@/domain/types";
import { formatHours } from "@/lib/format";
import { Button } from "./button";
import { cx } from "@/lib/cx";

export type StepperProps = {
  /** Hundredths: 0.01 h units (750 = 7.5 h). Controlled; omit to let the stepper hold its own value. */
  value?: Hundredths;
  /** Starting value when uncontrolled. */
  defaultValue?: Hundredths;
  onChange?: (next: Hundredths) => void;
  min?: Hundredths;
  max?: Hundredths;
  disabled?: boolean;
  /** Accessible name for the group, e.g. "Sam's hours". */
  label: string;
  className?: string;
};

const HOURS_STEP = 25;
const DEFAULT_MIN = 0;
const DEFAULT_MAX = 2400;

/**
 * DESIGN.md §4 stepper: − / value / + at 52 px phone / 48 desktop, steps by
 * 0.25 h. (A full/half day is a two-option choice, not a step count — see
 * `DayToggle`.)
 */
export function Stepper({
  value: controlledValue,
  defaultValue = 0,
  onChange,
  min,
  max,
  disabled,
  label,
  className,
}: StepperProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const value = controlledValue ?? uncontrolled;
  const lo = min ?? DEFAULT_MIN;
  const hi = max ?? DEFAULT_MAX;

  function step_(delta: number) {
    const next = Math.max(lo, Math.min(hi, value + delta));
    if (next === value) return;
    setUncontrolled(next);
    onChange?.(next);
  }

  return (
    <div role="group" aria-label={label} className={cx("inline-flex items-center gap-3", className)}>
      <Button
        iconOnly
        icon={Minus}
        label={`Decrease ${label}`}
        variant="secondary"
        disabled={disabled || value <= lo}
        onClick={() => step_(-HOURS_STEP)}
      />
      <span aria-live="polite" className="min-w-[64px] text-center text-figure num text-ink">
        {formatHours(value)}
      </span>
      <Button
        iconOnly
        icon={Plus}
        label={`Increase ${label}`}
        variant="secondary"
        disabled={disabled || value >= hi}
        onClick={() => step_(HOURS_STEP)}
      />
    </div>
  );
}
