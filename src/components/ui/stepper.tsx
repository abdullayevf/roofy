"use client";

import { Minus, Plus } from "@phosphor-icons/react";
import type { Hundredths } from "@/domain/types";
import { formatDays, formatHours } from "@/lib/format";
import { Button } from "./button";
import { cx } from "@/lib/cx";

export type StepperMode = "hours" | "days";

export type StepperProps = {
  mode: StepperMode;
  /** Hundredths: hours in 0.01 h units (750 = 7.5 h), days in 0.01 day units (100 = 1 day, 50 = ½ day). */
  value: Hundredths;
  onChange: (next: Hundredths) => void;
  min?: Hundredths;
  max?: Hundredths;
  disabled?: boolean;
  /** Accessible name for the group, e.g. "Sam's hours". */
  label: string;
  className?: string;
};

const HOURS_STEP = 25;
const DAYS_STEP = 50;

function defaultBounds(mode: StepperMode): { min: Hundredths; max: Hundredths } {
  return mode === "hours" ? { min: 0, max: 2400 } : { min: 50, max: 100 };
}

/** DESIGN.md §4 stepper: − / value / + at 52 px; hours step 0.25 h, days toggles 1 / ½. */
export function Stepper({ mode, value, onChange, min, max, disabled, label, className }: StepperProps) {
  const bounds = defaultBounds(mode);
  const lo = min ?? bounds.min;
  const hi = max ?? bounds.max;
  const step = mode === "hours" ? HOURS_STEP : DAYS_STEP;
  const display = mode === "hours" ? formatHours(value) : formatDays(value);

  function step_(delta: number) {
    const next = Math.max(lo, Math.min(hi, value + delta));
    if (next !== value) onChange(next);
  }

  return (
    <div role="group" aria-label={label} className={cx("inline-flex items-center gap-3", className)}>
      <Button
        iconOnly
        icon={Minus}
        label={`Decrease ${label}`}
        variant="secondary"
        disabled={disabled || value <= lo}
        onClick={() => step_(-step)}
      />
      <span aria-live="polite" className="min-w-[64px] text-center text-figure num">
        {display}
      </span>
      <Button
        iconOnly
        icon={Plus}
        label={`Increase ${label}`}
        variant="secondary"
        disabled={disabled || value >= hi}
        onClick={() => step_(step)}
      />
    </div>
  );
}
