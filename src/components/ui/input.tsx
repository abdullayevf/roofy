import type { ComponentPropsWithoutRef } from "react";
import { cx } from "@/lib/cx";
import { focusRing } from "./focus";

export type InputProps = ComponentPropsWithoutRef<"input"> & {
  invalid?: boolean;
  /** In-field unit suffix shown inside the box, e.g. "m²" on a quantity field. */
  suffix?: string;
  /** In-field leading mark shown inside the box, e.g. "$" on an amount field. */
  leading?: string;
  /** Demo-only: forces the focus ring so it shows up in a static screenshot. */
  focusVisible?: boolean;
};

/**
 * DESIGN.md §4 input: 52 px phone / 48 desktop, radius 10, 1.5 px edge
 * border; error = a 2 px `over` border (the message below carries the icon
 * and the fix, so colour is never alone). Disabled = `galv` fill, `line`
 * border, ink-2 text, so it reads as dimmed in both schemes.
 */
export function Input({ invalid, suffix, leading, focusVisible, className, ...props }: InputProps) {
  const input = (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      className={cx(
        "h-[52px] w-full rounded-control bg-surface px-4 text-ink lg:h-12",
        // DESIGN.md §3: input values are Atkinson (its slashed zero is the 0/O legibility feature); numbers stay tabular.
        "text-body",
        (props.inputMode === "decimal" || props.inputMode === "numeric") && "num",
        suffix && "pr-14",
        leading && "pl-8",
        invalid ? "border-2 border-over" : "border-[1.5px] border-edge",
        "disabled:border-line disabled:bg-galv disabled:text-ink-2",
        focusRing(focusVisible),
        !suffix && !leading && className,
      )}
    />
  );

  if (!suffix && !leading) return input;

  return (
    <div className={cx("relative", className)}>
      {leading ? (
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-body text-ink-2">
          {leading}
        </span>
      ) : null}
      {input}
      {suffix ? (
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-body text-ink-2">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}
