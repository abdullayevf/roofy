"use client";

import { useState } from "react";
import { GearSix, WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/ui/stepper";
import { MoneyCell } from "@/components/ui/money-cell";

/** DESIGN.md §4 stepper demo: hours, holding its own value. */
export function StepperDemo() {
  const [hours, setHours] = useState(700);
  return <Stepper value={hours} onChange={setHours} label="Sam's hours" />;
}

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
