import type { ComponentPropsWithoutRef } from "react";
import { cx } from "@/lib/cx";

export type InputProps = ComponentPropsWithoutRef<"input"> & {
  invalid?: boolean;
  /** In-field unit suffix shown inside the box, e.g. "m²" on a quantity field. */
  suffix?: string;
  /** Demo-only: forces the focus-visible ring so it shows up in a static screenshot. */
  focusVisible?: boolean;
};

const FOCUS =
  "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-chalk";
const FORCED_FOCUS = "outline outline-[3px] outline-offset-2 outline-chalk";

/** DESIGN.md §4 input: 52 px phone / 48 desktop, radius 10, 1.5 px edge border; error = over border. */
export function Input({ invalid, suffix, focusVisible, className, ...props }: InputProps) {
  const input = (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      className={cx(
        "h-[52px] w-full rounded-control border-[1.5px] bg-surface px-4 text-body text-ink lg:h-12",
        suffix && "pr-14",
        invalid ? "border-over" : "border-edge",
        "disabled:opacity-50",
        focusVisible ? FORCED_FOCUS : FOCUS,
        !suffix && className,
      )}
    />
  );

  if (!suffix) return input;

  return (
    <div className={cx("relative", className)}>
      {input}
      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-body text-ink-2">
        {suffix}
      </span>
    </div>
  );
}
