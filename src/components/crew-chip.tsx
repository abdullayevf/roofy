"use client";

import { useState } from "react";
import { Check, Info, WarningDiamond } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import type { Hundredths } from "@/domain/types";
import { cx } from "@/lib/cx";
import { DayToggle } from "./ui/day-toggle";
import { Stepper } from "./ui/stepper";

export type CrewBasisLabel = "Day" | "Hourly" | "m²" | "lm" | "Each" | "Hours only";

/**
 * A grouped `surface` block of crew rows with `line` dividers. From 600 px up
 * to the desktop breakpoint (DESIGN.md §8) the rows run in two columns; the
 * cells are separated by 1 px `line` gaps and an odd last row spans both.
 */
export function CrewGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "divide-y divide-line overflow-hidden rounded-group border-group bg-surface",
        "tablet:max-lg:grid tablet:max-lg:grid-cols-2 tablet:max-lg:gap-px tablet:max-lg:divide-y-0 tablet:max-lg:bg-line",
        "tablet:max-lg:[&>*:last-child:nth-child(odd)]:col-span-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

export type CrewChipProps = {
  name: string;
  /** Usual basis label shown on the chip ("Day", "Hourly", "m²"). Never a rate or amount. */
  basis: CrewBasisLabel;
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
          "group flex min-h-[64px] w-full items-center justify-between gap-4 px-4 py-2 text-left outline-none active:bg-galv lg:min-h-12 lg:py-1",
          // The whole row is the target, so the whole ticked row is tinted, not just the box.
          pressed && "bg-tape/10",
        )}
      >
        <span className="flex min-w-0 flex-col items-start">
          <span className={cx("text-body-strong", disabled ? "text-ink-2" : "text-ink")}>{name}</span>
          <span className="text-meta text-ink-2">{basis}</span>
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
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-control border-[1.5px]",
            pressed ? "border-transparent bg-tape" : cx("border-edge", disabled ? "bg-galv" : "bg-surface"),
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
        </div>
      ) : null}
    </div>
  );
}
