"use client";

import { useSyncExternalStore, type ComponentPropsWithoutRef } from "react";
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
 *
 * Read-only until React has attached (F1): text typed into a server-drawn box before hydration shows, but never
 * reaches the form's state, so the next render wiped it and the form said the field was empty. Holding the box
 * read-only for that moment means nothing typed is ever silently lost.
 */
export function Input({ invalid, suffix, leading, focusVisible, className, readOnly, ...props }: InputProps) {
  const hydrated = useHydrated();
  const input = (
    <input
      {...props}
      readOnly={readOnly || !hydrated}
      aria-invalid={invalid || undefined}
      className={cx(
        "h-[52px] w-full rounded-control bg-surface px-4 text-ink lg:h-12",
        // DESIGN.md §3: input values are Atkinson (its slashed zero is the 0/O legibility feature); numbers stay tabular.
        "text-body",
        (props.inputMode === "decimal" || props.inputMode === "numeric") && "num",
        suffix && (suffix.length > 5 ? "pr-20" : "pr-14"),
        leading && (leading.length > 1 ? "pl-11" : "pl-8"),
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

const noSubscribe = () => () => {};
/** False on the server and while hydrating, true once React owns the page (and straight away on a client-side render). */
function useHydrated(): boolean {
  return useSyncExternalStore(noSubscribe, () => true, () => false);
}
