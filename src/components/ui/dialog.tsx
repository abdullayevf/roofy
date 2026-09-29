"use client";

import { Dialog as RadixDialog } from "radix-ui";
import { Button } from "./button";
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
    <div className={cx("rounded-sheet bg-surface p-6 shadow-sheet", className)}>
      <h2 className="text-heading text-ink">{title}</h2>
      {description ? <p className="mt-2 text-body text-ink-2">{description}</p> : null}
      <div className="mt-6 flex flex-col gap-3">
        <Button variant="primary" tone={tone} filled={tone === "danger"} onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
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
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <RadixDialog.Content
          className={cx(
            "fixed left-1/2 top-1/2 z-50 w-[calc(100%-32px)] max-w-sm -translate-x-1/2 -translate-y-1/2",
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
