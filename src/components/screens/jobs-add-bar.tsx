"use client";

import { Button } from "@/components/ui/button";
import { PinnedAction, usePinnedBar } from "./field-entry";

/**
 * Add job (or any one primary link, via `href`) on a phone or tablet: pinned flush on the tab bar so it is under the thumb (DESIGN.md §5), as wide as the
 * list column, with the list padded by the bar's height. From 1024 px, and on a phone on its side, it is hidden; the
 * header has the same button there.
 */
export function JobsAddBar({ label = "Add job", href = "/jobs/new" }: { label?: string; href?: string }) {
  const { style, barProps } = usePinnedBar(null);
  return (
    <div className="jobs-add-bar lg:hidden" style={style}>
      <div aria-hidden="true" style={{ height: "var(--pin-action-height)" }} />
      <PinnedAction barProps={barProps}>
        <Button variant="primary" href={href} className="w-full">
          {label}
        </Button>
      </PinnedAction>
    </div>
  );
}
