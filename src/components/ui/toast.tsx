"use client";

import { Toast as RadixToast } from "radix-ui";
import { cx } from "@/lib/cx";

export type ToastProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
  className?: string;
};

/**
 * DESIGN.md §6 level-3 toast: `ink` background, `surface` text, shadow-toast,
 * 180 ms, polite live region (Radix Toast announces via its own aria-live
 * viewport, which we render alongside this).
 */
export function Toast({ open, onOpenChange, message, className }: ToastProps) {
  return (
    <RadixToast.Provider swipeDirection="up" duration={4000}>
      <RadixToast.Root
        open={open}
        onOpenChange={onOpenChange}
        className={cx(
          "flex items-center rounded-control bg-ink px-4 py-3 text-body-strong text-surface shadow-toast",
          "duration-[180ms] ease-out data-[state=closed]:opacity-0 data-[state=open]:opacity-100",
          className,
        )}
      >
        <RadixToast.Description>{message}</RadixToast.Description>
      </RadixToast.Root>
      <RadixToast.Viewport className="fixed inset-x-4 bottom-4 z-50 flex flex-col gap-2" />
    </RadixToast.Provider>
  );
}
