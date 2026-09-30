"use client";

import { useState } from "react";
import { Check, Info, WarningDiamond } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import type { Hundredths } from "@/domain/types";
import { cx } from "@/lib/cx";
import { DayToggle } from "./ui/day-toggle";
import { Segmented } from "./ui/segmented";
import { Stepper } from "./ui/stepper";

const OVERTIME = [
  { value: "100", label: "Normal" },
  { value: "150", label: "×1.5" },
  { value: "200", label: "×2" },
];

export type CrewBasisLabel = "Day" | "Hourly" | "m²" | "lm" | "Each" | "Hours only";

/**
 * A grouped `surface` block of crew rows with `line` dividers. From 600 px up
 * to the desktop breakpoint (DESIGN.md §8) the rows run in two columns; the
 * cells are separated by `line` rules and an odd last row keeps to the left column.
 */
export function CrewGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "divide-y divide-line overflow-hidden rounded-group border-group bg-surface",
        "tablet:max-lg:grid tablet:max-lg:grid-cols-2 tablet:max-lg:divide-y-0",
        // Two columns: a `line` rule under every row but the last row, and down the middle. An odd last row stays in the left column.
        "tablet:max-lg:[&>*:not(:last-child)]:border-b tablet:max-lg:[&>*:nth-last-child(2):nth-child(odd)]:border-b-0",
        "tablet:max-lg:[&>*:nth-child(odd)]:border-r tablet:max-lg:[&>*]:border-line",
        className,
      )}
    >
      {children}
    </div>
  );
}

export type CrewChipProps = {
  name: string;
  /** Usual basis label shown on the chip ("Day", "Hourly", "m²"). Never a rate or amount. Left out where pay type is noise (progress, no work). */
  basis?: CrewBasisLabel;
  /** A plain line under the basis, e.g. "No rate for this basis" (watch) or "Paid from progress, not this grid" (info). */
  note?: { text: string; tone: "watch" | "info" };
  /** When ticked, show the inline exception control: a full/half day toggle, or an hours stepper. */
  exception?: "half-day" | "hours";
  defaultPressed?: boolean;
  /** Controlled tick; omit to let the chip hold its own. */
  pressed?: boolean;
  /** Controlled exception value (100 = 1 day, 50 = ½ day; or hours in hundredths); omit to let the control hold its own. */
  exceptionValue?: Hundredths;
  onExceptionChange?: (value: Hundredths) => void;
  /** Hourly people: overtime as a multiplier in hundredths (100 = normal, 150 = ×1.5, 200 = ×2). Shown with the hours stepper when `onMultiplierChange` is given. */
  multiplier?: Hundredths;
  onMultiplierChange?: (value: Hundredths) => void;
  onPressedChange?: (pressed: boolean) => void;
  disabled?: boolean;
  /** Demo-only: forces the focus ring on the check box so it shows up in a static screenshot. */
  focusVisible?: boolean;
  className?: string;
};

/**
 * DESIGN.md §4 crew chip: a full-width row for a grouped `surface` block —
 * name (body-strong), usual basis, and a large check area. Ticked = `tape`
 * fill with an on-tape check. The focus ring goes on the check box (so it
 * follows its radius and is never clipped by the group). There is no money
 * prop at all, so the foreman variant is simply "the same component" —
 * nothing to hide.
 */
export function CrewChip({
  name,
  basis,
  note,
  exception,
  defaultPressed = false,
  pressed: controlledPressed,
  exceptionValue,
  onExceptionChange,
  multiplier = 100,
  onMultiplierChange,
  onPressedChange,
  disabled,
  focusVisible,
  className,
}: CrewChipProps) {
  const [uncontrolled, setPressed] = useState(defaultPressed);
  const pressed = controlledPressed ?? uncontrolled;
  const NoteIcon = note?.tone === "watch" ? WarningDiamond : Info;

  return (
    <div className={cx("flex flex-col bg-surface", className)}>
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
          "group flex min-h-[64px] w-full items-start justify-between gap-4 px-4 py-2 text-left outline-none active:bg-galv",
          // The whole row is the target, so the whole ticked row is tinted, not just the box.
          pressed && "bg-tape/25",
        )}
      >
        <span className="flex min-h-12 min-w-0 flex-col items-start justify-center">
          <span className={cx("text-body-strong", disabled ? "text-ink-2" : "text-ink")}>{name}</span>
          {basis ? <span className="text-meta text-ink-2">{basis}</span> : null}
          {note ? (
            <span
              className={cx(
                "mt-1 flex items-start gap-2 text-meta",
                note.tone === "watch" ? "text-watch" : "text-ink-2",
              )}
            >
              <NoteIcon size={24} aria-hidden="true" className="shrink-0" />
              {note.text}
            </span>
          ) : null}
        </span>
        <span
          aria-hidden="true"
          className={cx(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-control border-2",
            pressed ? "border-ink bg-tape" : disabled ? "border-edge bg-galv" : "border-ink bg-surface",
            focusVisible
              ? "outline outline-[3px] outline-offset-2 outline-chalk-link"
              : "group-focus-visible:outline group-focus-visible:outline-[3px] group-focus-visible:outline-offset-2 group-focus-visible:outline-chalk-link",
          )}
        >
          {pressed ? <Check size={24} weight="bold" className="text-on-tape" /> : null}
        </span>
      </button>
      {pressed && exception ? (
        <div className="flex flex-wrap items-center gap-3 px-4 pb-3">
          {exception === "half-day" ? (
            <DayToggle
              label={`${name}'s day`}
              value={exceptionValue}
              defaultValue={exceptionValue === undefined ? 50 : undefined}
              onChange={onExceptionChange}
            />
          ) : (
            <Stepper
              label={`${name}'s hours`}
              value={exceptionValue}
              defaultValue={exceptionValue === undefined ? 650 : undefined}
              onChange={onExceptionChange}
            />
          )}
          {exception === "hours" && onMultiplierChange ? (
            <Segmented
              legend={`${name}'s overtime`}
              name={`${name}-overtime`}
              options={OVERTIME}
              value={String(multiplier)}
              onChange={(v) => onMultiplierChange(Number(v))}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
