"use client";

import { useState } from "react";
import { Check } from "@phosphor-icons/react";
import { cx } from "@/lib/cx";

export type CrewBasisLabel = "Day" | "Hourly" | "m²";

export type CrewChipProps = {
  name: string;
  /** Usual basis label shown on the chip ("Day", "Hourly", "m²"). Never a rate or amount. */
  basis: CrewBasisLabel;
  defaultPressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * DESIGN.md §4 crew chip: full-width row, name + usual basis + a large check
 * area. Tapped = `tape` fill with `ink` check. There is no money prop at
 * all, so the foreman variant is simply "the same component" — nothing to
 * hide.
 */
export function CrewChip({
  name,
  basis,
  defaultPressed = false,
  onPressedChange,
  disabled,
  className,
}: CrewChipProps) {
  const [pressed, setPressed] = useState(defaultPressed);

  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={() => {
        const next = !pressed;
        setPressed(next);
        onPressedChange?.(next);
      }}
      className={cx(
        "flex w-full items-center justify-between gap-4 min-h-[64px] lg:min-h-12 px-4",
        "border-l-[2px]",
        pressed ? "border-l-ink" : "border-l-transparent",
        "bg-surface disabled:opacity-50",
        "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-chalk",
        className,
      )}
    >
      <span className="flex flex-col items-start">
        <span className="text-body-strong text-ink">{name}</span>
        <span className="text-meta text-ink-2">{basis}</span>
      </span>
      <span
        aria-hidden="true"
        className={cx(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-control border-[1.5px]",
          pressed ? "bg-tape border-transparent" : "bg-surface border-edge",
        )}
      >
        {pressed ? <Check size={24} weight="bold" className="text-on-tape" /> : null}
      </span>
    </button>
  );
}
