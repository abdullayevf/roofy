"use client";

import { Button } from "@/components/ui/button";
import { PinnedAction, usePinnedBar } from "./field-entry";

/**
 * Add job on a phone or tablet: pinned flush on the tab bar so it is under the thumb (DESIGN.md §5), with the list
 * padded by the bar's height. From 1024 px it is hidden; the header has the same button there.
 */
export function JobsAddBar() {
  const { style, barProps } = usePinnedBar(null);
  return (
    <div className="lg:hidden" style={style}>
      <div aria-hidden="true" style={{ height: "var(--pin-action-height)" }} />
      <PinnedAction barProps={barProps}>
        <Button variant="primary" href="/jobs/new" className="w-full">
          Add job
        </Button>
      </PinnedAction>
    </div>
  );
}
