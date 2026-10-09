"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PinnedAction, usePinnedBar } from "./field-entry";
import { NEEDS_CONNECTION, useOnline } from "./use-online";

/**
 * Add job (or any one primary link, via `href`) on a phone or tablet: pinned flush on the tab bar so it is under the thumb (DESIGN.md §5), as wide as the
 * list column, with the list padded by the bar's height. From 1024 px, and on a phone on its side, it is hidden; the
 * header has the same button there.
 */
export function JobsAddBar({
  label = "Add job",
  href = "/jobs/new",
  needsConnection = false,
  demoOffline = false,
  skeleton = false,
}: {
  label?: string;
  href?: string;
  /** The action can't happen offline (a payout): with no signal the button is disabled with the "Needs connection" line. */
  needsConnection?: boolean;
  demoOffline?: boolean;
  /** The bar while the page loads: the same pinned bar with a grey block where the button will be. */
  skeleton?: boolean;
}) {
  const { style, barProps } = usePinnedBar(null);
  const online = useOnline(demoOffline);
  const blocked = needsConnection && !online;
  return (
    <div className="jobs-add-bar lg:hidden" style={style}>
      <div aria-hidden="true" style={{ height: "var(--pin-action-height)" }} />
      <PinnedAction barProps={barProps} hint={blocked ? NEEDS_CONNECTION : undefined}>
        {skeleton ? (
          <Skeleton height={52} className="w-full" />
        ) : blocked ? (
          <Button variant="primary" disabled className="w-full">
            {label}
          </Button>
        ) : (
          <Button variant="primary" href={href} className="w-full">
            {label}
          </Button>
        )}
      </PinnedAction>
    </div>
  );
}

/** The same action in a desktop title row: disabled with the "Needs connection" line under it when there is no signal. */
export function OnlineOnlyHeadButton({ label, href, demoOffline = false }: { label: string; href: string; demoOffline?: boolean }) {
  const online = useOnline(demoOffline);
  if (online)
    return (
      <Button variant="primary" href={href}>
        {label}
      </Button>
    );
  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="primary" disabled>
        {label}
      </Button>
      <p className="text-meta text-ink">{NEEDS_CONNECTION}</p>
    </div>
  );
}
