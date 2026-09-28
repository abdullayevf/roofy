"use client";

import { Dialog as RadixDialog } from "radix-ui";
import { Button } from "./button";
import { cx } from "@/lib/cx";

export type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  /** DESIGN.md §4: filled destructive is only used in confirmation dialogs/sheets. */
  tone?: "danger";
};

/** DESIGN.md §4 dialog: confirmation, Radix Dialog, rounded-sheet, shadow-sheet. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  tone,
}: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <RadixDialog.Content
          className={cx(
            "fixed left-1/2 top-1/2 z-50 w-[calc(100%-32px)] max-w-sm -translate-x-1/2 -translate-y-1/2",
            "rounded-sheet bg-surface p-6 shadow-sheet",
            "duration-[220ms] ease-out data-[state=closed]:opacity-0 data-[state=open]:opacity-100",
          )}
        >
          <RadixDialog.Title className="text-heading text-ink">{title}</RadixDialog.Title>
          {description ? (
            <RadixDialog.Description className="mt-2 text-body text-ink-2">
              {description}
            </RadixDialog.Description>
          ) : null}
          <div className="mt-6 flex flex-col gap-3">
            <Button
              variant="primary"
              tone={tone}
              filled={tone === "danger"}
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
            >
              {confirmLabel}
            </Button>
            <RadixDialog.Close asChild>
              <Button variant="ghost">{cancelLabel}</Button>
            </RadixDialog.Close>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
