"use client";

import { cx } from "@/lib/cx";

export type SegmentedOption = { value: string; label: string };

export type SegmentedProps = {
  /** Accessible name for the group, e.g. "Log entry type". */
  legend: string;
  name: string;
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

/**
 * DESIGN.md §4 segmented control: radiogroup, segments ≥ 48 px. Built on
 * native radio inputs (visually hidden, `peer`-styled) so arrow-key
 * navigation between segments (DESIGN.md §8 desktop keyboard operation)
 * comes from the browser's own radio-group behaviour rather than a
 * hand-rolled `keydown` handler.
 */
export function Segmented({ legend, name, options, value, onChange, className }: SegmentedProps) {
  return (
    <div
      role="radiogroup"
      aria-label={legend}
      className={cx("inline-flex rounded-control border-[1.5px] border-edge bg-surface p-1", className)}
    >
      {options.map((opt) => {
        const checked = opt.value === value;
        return (
          <label
            key={opt.value}
            className={cx(
              "relative flex min-h-12 flex-1 cursor-pointer items-center justify-center rounded-control px-3 text-body-strong",
              checked ? "bg-chalk text-on-chalk" : "text-ink",
            )}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={checked}
              onChange={() => onChange(opt.value)}
              className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-chalk"
            />
            <span>{opt.label}</span>
          </label>
        );
      })}
    </div>
  );
}
