"use client";

import { useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { Drawer } from "vaul";
import { Dialog } from "radix-ui";
import { X } from "@phosphor-icons/react";
import { cx } from "@/lib/cx";

export type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  /** Pinned above the home bar (phone) via env(safe-area-inset-bottom). */
  primaryAction?: ReactNode;
};

const DESKTOP_QUERY = "(min-width: 1024px)";

function subscribeToDesktopQuery(onChange: () => void): () => void {
  const mql = window.matchMedia(DESKTOP_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/** True at >= 1024 px (DESIGN.md §8 desktop breakpoint). SSR-safe default: phone. */
function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribeToDesktopQuery,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
}

function SheetBody({
  title,
  children,
  primaryAction,
}: Pick<SheetProps, "title" | "children" | "primaryAction">) {
  return (
    <div className="flex max-h-[85vh] flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 pb-4 pt-2">
        <h2 className="text-heading text-ink">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
      {primaryAction ? (
        <div
          className="border-t border-line px-4 pt-4"
          style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}
        >
          {primaryAction}
        </div>
      ) : null}
    </div>
  );
}

/**
 * DESIGN.md §4 sheet/dialog: vaul Drawer on phone (< 1024 px), Radix Dialog
 * on desktop (>= 1024 px), the same content component either way. 16 px top
 * radius, grabber, shadow-sheet, 220 ms ease-out (instant under reduced
 * motion, handled globally in globals.css).
 */
export function Sheet({ open, onOpenChange, title, children, primaryAction }: SheetProps) {
  const isDesktop = useIsDesktop();

  // Radix's own auto-restore only knows to refocus a <Dialog.Trigger>, which
  // this fully-controlled component never renders (the caller owns its own
  // trigger element, often not even a descendant of this tree). We capture
  // the pre-open active element ourselves in a *layout* effect: all layout
  // effects for a commit run before any passive effect does, and Radix's own
  // FocusScope moves focus into the content from a passive `useEffect`, so
  // this is guaranteed to observe the trigger, not the content, regardless
  // of the two components' relative position in the tree.
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (open) restoreFocusRef.current = document.activeElement as HTMLElement;
  }, [open]);
  function restoreFocus(event: Event) {
    event.preventDefault();
    restoreFocusRef.current?.focus();
    restoreFocusRef.current = null;
  }

  if (isDesktop) {
    return (
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
          <Dialog.Content
            onCloseAutoFocus={restoreFocus}
            className={cx(
              "fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2",
              "rounded-sheet bg-surface shadow-sheet",
              "duration-[220ms] ease-out data-[state=closed]:opacity-0 data-[state=open]:opacity-100",
            )}
          >
            <Dialog.Title className="sr-only">{title}</Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center text-ink-2"
            >
              <X size={24} aria-hidden="true" />
            </Dialog.Close>
            <SheetBody title={title} primaryAction={primaryAction}>
              {children}
            </SheetBody>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Drawer.Content
          onCloseAutoFocus={restoreFocus}
          className={cx(
            "fixed inset-x-0 bottom-0 z-50 rounded-t-sheet bg-surface shadow-sheet",
            "duration-[220ms] ease-out",
          )}
        >
          <Drawer.Title className="sr-only">{title}</Drawer.Title>
          <Drawer.Handle className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-line" />
          <SheetBody title={title} primaryAction={primaryAction}>
            {children}
          </SheetBody>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
