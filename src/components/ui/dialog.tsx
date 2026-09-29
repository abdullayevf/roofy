"use client";

import { useRef } from "react";
import { Dialog as RadixDialog } from "radix-ui";
import { Button } from "./button";
import { useRestoreFocus } from "./restore-focus";
import { cx } from "@/lib/cx";

export type DialogContentProps = {
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Optional so a static preview (no live open/close state) can render DialogPanel with no handlers at all. */
  onConfirm?: () => void;
  onCancel?: () => void;
  /** DESIGN.md §4: filled destructive is only used in confirmation dialogs/sheets. */
  tone?: "danger";
  className?: string;
};

/**
 * The panel visuals — title, description, confirm/cancel — as their own
 * component so the live Radix Dialog and a static gallery preview render
 * identical markup. Cancel is always the Secondary style, never a
 * borderless text button (DESIGN.md §4: that's for true inline links).
 */
export function DialogPanel({
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  tone,
  className,
}: DialogContentProps) {
  return (
    <div
      className={cx(
        // A bottom sheet on phone (grabber, 16 px top radius, clears the home bar), the shared 448 px dialog from 1024 px.
        "relative rounded-t-sheet bg-surface px-6 pt-2 shadow-sheet lg:mx-auto lg:w-full lg:max-w-md lg:rounded-sheet lg:pt-6",
        className,
      )}
      style={{ paddingBottom: "calc(max(var(--sab-sim, 0px), env(safe-area-inset-bottom)) + 24px)" }}
    >
      <div aria-hidden="true" className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line lg:hidden" />
      <h2 className="text-heading text-ink">{title}</h2>
      {description ? <p className="mt-2 text-body text-ink-2">{description}</p> : null}
      <div className="mt-6 flex flex-col gap-3">
        <Button variant="primary" tone={tone} filled={tone === "danger"} onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <span data-dialog-cancel="" className="contents">
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
        </span>
      </div>
    </div>
  );
}

export type DialogProps = DialogContentProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** DESIGN.md §4 dialog: confirmation, Radix Dialog, rounded-sheet, shadow-sheet. */
export function Dialog({ open, onOpenChange, onConfirm, ...panelProps }: DialogProps) {
  const restoreFocus = useRestoreFocus(open);
  const content = useRef<HTMLDivElement>(null);
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <RadixDialog.Content
          ref={content}
          onCloseAutoFocus={restoreFocus}
          onOpenAutoFocus={(event) => {
            // A destructive confirmation opens on the safe action, not the destructive one.
            if (panelProps.tone !== "danger") return;
            event.preventDefault();
            content.current?.querySelector<HTMLElement>("[data-dialog-cancel] button")?.focus();
          }}
          className={cx(
            "fixed inset-x-0 bottom-0 z-50 lg:inset-auto lg:left-1/2 lg:top-1/2 lg:w-full lg:max-w-md lg:-translate-x-1/2 lg:-translate-y-1/2",
            "duration-[220ms] ease-out data-[state=closed]:opacity-0 data-[state=open]:opacity-100",
          )}
        >
          <RadixDialog.Title className="sr-only">{panelProps.title}</RadixDialog.Title>
          {panelProps.description ? (
            <RadixDialog.Description className="sr-only">{panelProps.description}</RadixDialog.Description>
          ) : null}
          <DialogPanel
            {...panelProps}
            onConfirm={() => {
              onConfirm?.();
              onOpenChange(false);
            }}
            onCancel={() => onOpenChange(false)}
          />
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
