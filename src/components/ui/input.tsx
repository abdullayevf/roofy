import type { ComponentPropsWithoutRef } from "react";
import { cx } from "@/lib/cx";

export type InputProps = ComponentPropsWithoutRef<"input"> & {
  invalid?: boolean;
  /** Demo-only: forces the focus-visible ring so it shows up in a static screenshot. */
  focusVisible?: boolean;
};

const FOCUS =
  "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-chalk";
const FORCED_FOCUS = "outline outline-[3px] outline-offset-2 outline-chalk";

/** DESIGN.md §4 input: 52 px, radius 10, 1.5 px edge border; error = over border. */
export function Input({ invalid, focusVisible, className, ...props }: InputProps) {
  return (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      className={cx(
        "h-[52px] w-full rounded-control border-[1.5px] bg-surface px-4 text-body text-ink",
        invalid ? "border-over" : "border-edge",
        "disabled:opacity-50",
        focusVisible ? FORCED_FOCUS : FOCUS,
        className,
      )}
    />
  );
}
