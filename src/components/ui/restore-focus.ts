"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Radix's own auto-restore only knows to refocus a `<Dialog.Trigger>`, which
 * our fully-controlled overlays never render (the caller owns its own
 * trigger, often not even a descendant of this tree). We capture the
 * pre-open active element ourselves in a *layout* effect: all layout effects
 * for a commit run before any passive effect does, and the focus scope moves
 * focus into the content from a passive effect, so this always observes the
 * trigger, not the content. Pass `onCloseAutoFocus` to the overlay content.
 */
export function useRestoreFocus(open: boolean): (event: Event) => void {
  const ref = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (open) ref.current = document.activeElement as HTMLElement;
  }, [open]);
  return (event: Event) => {
    event.preventDefault();
    ref.current?.focus();
    ref.current = null;
  };
}
