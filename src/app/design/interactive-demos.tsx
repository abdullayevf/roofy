"use client";

import { useState } from "react";
import { GearSix, WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/ui/stepper";
import { Sheet } from "@/components/ui/sheet";
import { Dialog } from "@/components/ui/dialog";
import { Toast } from "@/components/ui/toast";
import { MoneyCell } from "@/components/ui/money-cell";

/**
 * A few demos below pass a Phosphor icon component as a prop (Button's
 * `icon`, MoneyCell's `toneIcon`). That only works from inside a Client
 * Component: page.tsx (a Server Component) can render icons itself, but
 * can't hand an unrendered icon *component reference* down into one of
 * these already-client primitives as a bare prop value — only rendered
 * content, or plain strings/booleans, cross that boundary. Every icon-prop
 * demo therefore lives in this file.
 */
export function IconOnlyButtonDemo() {
  return <Button iconOnly icon={GearSix} label="Settings" variant="secondary" />;
}

export function MoneyCellIconDemo() {
  return <MoneyCell cents={-30000} tone="over" toneIcon={WarningCircle} />;
}

/** DESIGN.md §4 stepper demo: the two live modes, each holding its own value. */
export function StepperDemo() {
  const [hours, setHours] = useState(700);
  const [day, setDay] = useState(100);
  return (
    <div className="flex flex-wrap gap-8">
      <Stepper mode="hours" value={hours} onChange={setHours} label="Sam's hours" />
      <Stepper mode="days" value={day} onChange={setDay} label="Tom's day" />
    </div>
  );
}

/** DESIGN.md §4 sheet demo: vaul Drawer on phone, Radix Dialog on desktop. */
export function SheetDemo() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Pause stage
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Pause stage"
        primaryAction={
          <Button variant="primary" onClick={() => setOpen(false)}>
            Confirm pause
          </Button>
        }
      >
        <p className="text-body text-ink-2">Why is the sheet install stage pausing?</p>
        <div className="mt-4 flex flex-col gap-2">
          <Button variant="secondary">Weather</Button>
          <Button variant="secondary">Waiting on materials</Button>
          <Button variant="secondary">Waiting on client or builder</Button>
        </div>
      </Sheet>
    </div>
  );
}

/** DESIGN.md §4 dialog demo: a destructive confirmation. */
export function DialogDemo() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Button tone="danger" onClick={() => setOpen(true)}>
        Discard entry
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Discard this entry?"
        description="Nothing will be sent. This can't be undone."
        confirmLabel="Discard entry"
        tone="danger"
        onConfirm={() => setOpen(false)}
      />
    </div>
  );
}

/** DESIGN.md §6 level-3 toast demo. */
export function ToastDemo() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Button
        variant="secondary"
        onClick={() => {
          setOpen(false);
          window.setTimeout(() => setOpen(true), 0);
        }}
      >
        Save day
      </Button>
      <Toast open={open} onOpenChange={setOpen} message="Logged" />
    </div>
  );
}
