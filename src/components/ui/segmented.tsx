"use client";

import { useState } from "react";
import { Check } from "@phosphor-icons/react";
import { cx } from "@/lib/cx";
import { focusRingWithin } from "./focus";

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
  /** Demo-only: forces the focus ring (on the selected segment) so it shows up in a static screenshot. */
  focusVisible?: boolean;
  className?: string;
};

/**
 * DESIGN.md §4 segmented control: radiogroup, segments 52 px phone / 48
 * desktop, full width on phone. A selected segment is `tape` fill, `ink` text
 * and a check — the one selection treatment (`chalk` is for actions and focus).
 * Built on native radio inputs (visually hidden) so arrow-key
 * navigation between segments (DESIGN.md §8 desktop keyboard operation)
 * comes from the browser's own radio-group behaviour rather than a
 * hand-rolled `keydown` handler. The focus ring is drawn on the segment
 * (not the hidden input) so it follows the segment's radius. Segments wrap
 * onto a second row when text is large rather than running off the screen.
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

  return (
    <div
      role="radiogroup"
      aria-label={legend}
      aria-disabled={disabled || undefined}
      className={cx(
        "flex w-full max-w-full flex-wrap rounded-control border-[1.5px] border-edge p-1 lg:w-fit",
        disabled ? "bg-galv" : "bg-surface",
        className,
      )}
    >
      {options.map((opt) => {
        const checked = opt.value === value;
        return (
          <label
            key={opt.value}
            className={cx(
              "relative flex min-h-[52px] flex-auto items-center justify-center gap-1.5 rounded-control px-3 py-1 text-center text-body-strong lg:min-h-12",
              disabled ? "cursor-not-allowed" : "cursor-pointer",
              checked
                ? disabled
                  ? "bg-line text-ink-2"
                  : "bg-tape text-on-tape"
                : disabled
                  ? "text-ink-2"
                  : "text-ink",
              focusRingWithin(focusVisible && checked),
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
              )}
            />
            {checked ? <Check size={24} weight="bold" aria-hidden="true" className="shrink-0" /> : null}
            <span>{opt.label}</span>
          </label>
        );
      })}
    </div>
  );
}
