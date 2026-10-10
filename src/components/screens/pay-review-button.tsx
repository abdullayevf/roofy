"use client";

import { Button } from "@/components/ui/button";
import { NEEDS_CONNECTION, useOnline } from "./use-online";

/** Open the draft to review. Pay runs never work offline, so with no signal it is disabled with the one "Needs connection" line. */
export function PayReviewButton({ label, href, demoOffline = false }: { label: string; href: string; demoOffline?: boolean }) {
  const online = useOnline(demoOffline);
  if (online)
    return (
      <Button variant="primary" href={href} className="w-full sm:w-auto sm:min-w-60 sm:self-start">
        {label}
      </Button>
    );
  return (
    <div data-pay-needs-connection="" className="flex flex-col gap-1">
      <Button variant="primary" disabled className="w-full sm:w-auto sm:min-w-60 sm:self-start">
        {label}
      </Button>
      <p className="text-meta text-ink">{NEEDS_CONNECTION}</p>
    </div>
  );
}
