"use client";

import { Dialog } from "radix-ui";
import { Receipt, X } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { cx } from "@/lib/cx";
import { useRestoreFocus } from "@/components/ui/restore-focus";
import { useState } from "react";

/**
 * The saved receipt on an expense: the whole row is a 64 px button with a thumbnail, and it opens the photo full
 * screen with a Close button. `src` is the photo's address; the prototype has no stored photos yet (uploads arrive in
 * Phase 5), so a stand-in receipt icon shows in its place.
 */
export function ReceiptViewer({ name, src = null }: { name: string; src?: string | null }) {
  const [open, setOpen] = useState(false);
  const restoreFocus = useRestoreFocus(open);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          data-receipt-open=""
          aria-label={`View receipt: ${name}`}
          className="flex min-h-16 w-full items-center justify-between gap-x-4 px-4 py-2 text-left active:bg-galv focus-visible:outline focus-visible:outline-[3px] focus-visible:-outline-offset-3 focus-visible:outline-chalk-link lg:min-h-12"
        >
          <span className="shrink-0 text-meta text-ink-2">Receipt</span>
          <span className="flex min-w-0 items-center gap-3">
            <span className="min-w-0 text-body-strong text-ink [overflow-wrap:anywhere]">{name}</span>
            <Thumb src={src} className="size-12" />
          </span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-scrim" />
        <Dialog.Content
          data-receipt-full=""
          onCloseAutoFocus={restoreFocus}
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col bg-galv"
        >
          <div className="flex min-h-16 items-center justify-between gap-x-4 px-4 pt-[env(safe-area-inset-top)]">
            <Dialog.Title className="min-w-0 text-heading text-ink [overflow-wrap:anywhere]">{name}</Dialog.Title>
            <Button iconOnly icon={X} label="Close" variant="ghost" onClick={() => setOpen(false)} />
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
            <Thumb src={src} className="max-h-full w-full max-w-150 aspect-[3/4]" large />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Thumb({ src, className, large = false }: { src: string | null; className?: string; large?: boolean }) {
  if (src)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className={cx("rounded-control border-control object-cover", className)} />;
  return (
    <span aria-hidden="true" className={cx("flex shrink-0 items-center justify-center rounded-control border-control bg-surface text-ink-2", className)}>
      <Receipt size={large ? 96 : 28} />
    </span>
  );
}
