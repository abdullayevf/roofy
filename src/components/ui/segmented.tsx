"use client";

import { useState } from "react";
import { Check } from "@phosphor-icons/react";
import { cx } from "@/lib/cx";

// The group clips its corners, so the focus ring is drawn inside the segment (an outer ring would be cut off).
const RING = "has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:-outline-offset-3 has-[:focus-visible]:outline-chalk-link";
const RING_FORCED = "outline outline-[3px] -outline-offset-3 outline-chalk-link";

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
  /** Full width of its column from 1024 px too (a form whose fields all share one column), not just as wide as its options. */
  fill?: boolean;
  /** One row of equal options that never wraps onto a second row (a label wraps inside its own option): for a few short options on a phone. */
  equal?: boolean;
  /** Demo-only: forces the focus ring (on the selected segment) so it shows up in a static screenshot. */
  focusVisible?: boolean;
  className?: string;
};

/**
 * DESIGN.md §4 segmented control: radiogroup, segments 52 px phone / 48
 * desktop, full width on phone. One outer border, a straight 1 px divider between every two segments (the group is
 * `edge` showing through a 1 px gap, so the line never curves or vanishes beside the selected one). A selected segment
 * is flush `tape` fill, `ink` text and a check — the one selection treatment (`chalk` is for actions and focus).
 * Built on native radio inputs (visually hidden) so arrow-key
 * navigation between segments (DESIGN.md §8 desktop keyboard operation)
 * comes from the browser's own radio-group behaviour rather than a
 * hand-rolled `keydown` handler. The focus ring is drawn on the segment
 * (not the hidden input) so it follows the segment's radius. Segments wrap
 * onto a second row when text is large rather than running off the screen;
 * `equal` keeps one row of equal columns instead (the label wraps inside its own option).
 */
export function Segmented({
  legend,
  name,
  options,
  defaultValue,
  value: controlledValue,
  onChange,
  disabled,
  fill = false,
  equal = false,
  focusVisible,
  className,
}: SegmentedProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? options[0]?.value ?? "");
  const value = controlledValue ?? uncontrolled;

  return (
    <div
      role="radiogroup"
      data-segmented=""
      aria-label={legend}
      aria-disabled={disabled || undefined}
      style={equal ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` } : undefined}
      className={cx(
        "w-full max-w-full gap-px overflow-hidden rounded-control border-[1.5px] border-edge bg-edge",
        equal ? "grid" : "flex flex-wrap",
        fill ? "" : "lg:w-fit",
        className,
      )}
    >
      {options.map((opt) => {
        const checked = opt.value === value;
        return (
          <label
            key={opt.value}
            className={cx(
              "relative flex min-h-[52px] items-center justify-center gap-1.5 py-1 text-center text-body-strong lg:min-h-12",
              equal ? "min-w-0 px-2" : "flex-auto px-3",
              disabled ? "cursor-not-allowed" : "cursor-pointer",
              checked
                ? disabled
                  ? "bg-line text-ink-2"
                  : "bg-tape text-on-tape"
                : disabled
                  ? "bg-galv text-ink-2"
                  : "bg-surface text-ink",
              focusVisible && checked ? RING_FORCED : RING,
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
