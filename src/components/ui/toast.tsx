"use client";

import { useEffect, useLayoutEffect, useRef, type ComponentPropsWithRef } from "react";
import { Toast as RadixToast } from "radix-ui";
import { cx } from "@/lib/cx";
import { isTextEntry } from "./focus";

export type ToastViewProps = ComponentPropsWithRef<"li"> & {
  message: string;
};

/**
 * The toast bubble's own visuals (DESIGN.md §6 level 3: `ink` background,
 * `surface` text, shadow-toast) as their own component so the live Radix
 * Toast and a static gallery preview render identical markup. It is an `li`
 * (Radix's viewport is an `ol`); it forwards the props and ref Radix injects.
 */
export function ToastView({ message, className, children, ...rest }: ToastViewProps) {
  return (
    <li
      {...rest}
      className={cx(
        "flex list-none items-center rounded-control bg-bar px-4 py-3 text-body-strong text-on-bar shadow-toast",
        className,
      )}
    >
      {message}
      {children}
    </li>
  );
}

/** Space left between a lifted toast and the primary button under it, px. */
const CLEAR_GAP = 8;

/**
 * A toast never covers the page's primary action (auth i2 D27 + F16): when it opens over a visible primary button (Send
 * invite at the foot of a long page, a Save that is in the flow) its holder is lifted until the toast ends above that
 * button. It does nothing when the toast is already clear, or when lifting would push it off the top of the screen.
 */
export function liftClearOfPrimary(viewport: HTMLElement) {
  viewport.style.removeProperty("bottom");
  const li = viewport.querySelector("li");
  if (!li) return;
  const box = li.getBoundingClientRect();
  let lift = 0;
  for (const button of Array.from(document.querySelectorAll<HTMLElement>('button[data-variant="primary"], a[data-variant="primary"]'))) {
    const r = button.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const across = box.left < r.right && box.right > r.left;
    const down = box.top < r.bottom && box.bottom > r.top;
    if (across && down) lift = Math.max(lift, box.bottom - r.top + CLEAR_GAP);
  }
  if (lift === 0 || box.top - lift < CLEAR_GAP) return;
  const bottom = parseFloat(getComputedStyle(viewport).bottom) || 0;
  viewport.style.setProperty("bottom", `${bottom + lift}px`, "important");
}

export type ToastProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
  className?: string;
  /** Extra classes for the fixed holder, e.g. one that lifts it above a pinned bar. */
  viewportClassName?: string;
};

/**
 * DESIGN.md §6 level-3 toast: 180 ms, polite live region (Radix Toast
 * announces via its own aria-live viewport). It closes when a text field takes focus (it would sit over the
 * field once the keyboard is up).
 */
export function Toast({ open, onOpenChange, message, className, viewportClassName }: ToastProps) {
  // A toast never covers the field being typed in: it has said its piece, so it goes when a text field takes focus.
  useEffect(() => {
    if (!open) return;
    const entered = (e: FocusEvent) => {
      if (isTextEntry(e.target as Element | null)) onOpenChange(false);
    };
    document.addEventListener("focusin", entered);
    return () => document.removeEventListener("focusin", entered);
  }, [open, onOpenChange]);
  const holder = useRef<HTMLOListElement>(null);
  useLayoutEffect(() => {
    if (open && holder.current) liftClearOfPrimary(holder.current);
  }, [open]);
  return (
    <RadixToast.Provider swipeDirection="up" duration={4000}>
      <RadixToast.Root
        open={open}
        onOpenChange={onOpenChange}
        asChild
      >
        <ToastView
          message={message}
          className={cx(
            "duration-[180ms] ease-out data-[state=closed]:opacity-0 data-[state=open]:opacity-100",
            className,
          )}
        />
      </RadixToast.Root>
      <RadixToast.Viewport ref={holder} className={cx("fixed inset-x-4 bottom-4 z-50 flex flex-col gap-2", viewportClassName)} />
    </RadixToast.Provider>
  );
}
