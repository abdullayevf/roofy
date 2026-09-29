"use client";

import { useState } from "react";
import { GearSix } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { Field } from "@/components/ui/field";
import { SheetPanel } from "@/components/ui/sheet";
import { StatusChip } from "@/components/ui/status-chip";

/**
 * Passing a Phosphor icon component as a prop (Button's `icon`) only works
 * from inside a Client Component: page.tsx (a Server Component) can't hand an
 * unrendered icon *component reference* down into an already-client
 * primitive as a bare prop value. Every icon-prop demo therefore lives here.
 */
export function IconOnlyButtonDemo() {
  return <Button iconOnly icon={GearSix} label="Settings" variant="secondary" />;
}

const REASONS = [
  { value: "weather", label: "Weather" },
  { value: "materials", label: "Waiting on materials" },
  { value: "client", label: "Waiting on client or builder" },
  { value: "crew", label: "Crew on another job" },
  { value: "other", label: "Other" },
];

/**
 * flows.md "Pause a stage for rain": nothing is pre-selected, and tapping a
 * reason pauses immediately (no separate confirm). The note is optional; a
 * pinned "Pause stage" only appears once a note is typed, since that's the one
 * case where the person needs a deliberate commit.
 */
export function PauseStageSheetDemo() {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const reasonLabel = REASONS.find((r) => r.value === reason)?.label;

  return (
    <SheetPanel
      title="Pause stage"
      primaryAction={
        note.trim() ? (
          <Button variant="primary" onClick={() => setReason((r) => r || "other")}>
            Pause stage
          </Button>
        ) : undefined
      }
    >
      <Field
        label="Add a note first (optional)"
        inputMode="text"
        hint="e.g. Forecast clearing Thursday"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <p className="mb-3 mt-4 text-body-strong text-ink">Then tap a reason to pause now.</p>
      <ChoiceChip legend="Reason" name="pause-reason" value={reason} onChange={setReason} options={REASONS} />
      {reasonLabel ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StatusChip status="paused" reason={reasonLabel} />
          <span className="text-meta text-ink-2">Stage paused.</span>
        </div>
      ) : null}
    </SheetPanel>
  );
}
