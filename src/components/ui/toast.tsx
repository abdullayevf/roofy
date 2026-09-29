"use client";

import type { ComponentPropsWithRef } from "react";
import { Toast as RadixToast } from "radix-ui";
import { cx } from "@/lib/cx";

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

export type ToastProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
  className?: string;
};

/**
 * DESIGN.md §6 level-3 toast: 180 ms, polite live region (Radix Toast
 * announces via its own aria-live viewport).
 */
export function Toast({ open, onOpenChange, message, className }: ToastProps) {
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
      <RadixToast.Viewport className="fixed inset-x-4 bottom-4 z-50 flex flex-col gap-2" />
    </RadixToast.Provider>
  );
}
